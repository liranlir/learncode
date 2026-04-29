// Cloudflare Worker for LearnCode.
// Features:
// - Aliyun OCR proxy at POST /
// - D1 knowledge sync at /api/knowledge
//
// Environment variables:
// ALIYUN_ACCESS_KEY_ID
// ALIYUN_ACCESS_KEY_SECRET
// ALIYUN_OCR_ENDPOINT = ocr-api.cn-hangzhou.aliyuncs.com
//
// Bindings:
// DB = D1 database binding

const OCR_ACTION = 'RecognizeGeneral';
const OCR_VERSION = '2021-07-07';
const MAX_KNOWLEDGE_ENTRIES = 500;

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-LearnCode-Sync-Id, X-LearnCode-Sync-Secret',
  };
}

function json(data, init = {}, origin = '*') {
  return Response.json(data, {
    ...init,
    headers: {
      ...corsHeaders(origin),
      ...(init.headers || {}),
    },
  });
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(data) {
  const source = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return toHex(await crypto.subtle.digest('SHA-256', source));
}

async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return toHex(signature);
}

function normalizeHeaderValue(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function utcTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function reconstructFromWords(words) {
  if (!Array.isArray(words) || words.length === 0) return '';

  const normalized = words
    .filter((item) => item.word)
    .map((item) => ({
      text: item.word || '',
      x: item.x ?? 0,
      y: item.y ?? 0,
      height: item.height ?? 14,
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const lines = [];
  for (const word of normalized) {
    const line = lines.find((items) => {
      const first = items[0];
      const threshold = Math.max(first.height, word.height, 14) * 0.65;
      return Math.abs(first.y - word.y) <= threshold;
    });
    if (line) line.push(word);
    else lines.push([word]);
  }

  return lines
    .map((line) =>
      line
        .sort((a, b) => a.x - b.x)
        .map((word) => word.text)
        .join(' ')
    )
    .join('\n')
    .trim();
}

function extractText(payload) {
  let data = payload?.Data || payload?.data || payload;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return data;
    }
  }
  return reconstructFromWords(data?.prism_wordsInfo) || data?.content?.trim() || '';
}

async function callAliyunOcr(body, env) {
  const endpoint = env.ALIYUN_OCR_ENDPOINT || 'ocr-api.cn-hangzhou.aliyuncs.com';
  const contentSha256 = await sha256Hex(body);
  const date = utcTimestamp();
  const nonce = crypto.randomUUID();
  const headers = {
    'content-type': 'application/octet-stream',
    host: endpoint,
    'x-acs-action': OCR_ACTION,
    'x-acs-content-sha256': contentSha256,
    'x-acs-date': date,
    'x-acs-signature-nonce': nonce,
    'x-acs-version': OCR_VERSION,
  };

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${normalizeHeaderValue(headers[name])}\n`)
    .join('');
  const signedHeaders = signedHeaderNames.join(';');
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    contentSha256,
  ].join('\n');
  const hashedCanonicalRequest = await sha256Hex(canonicalRequest);
  const stringToSign = `ACS3-HMAC-SHA256\n${hashedCanonicalRequest}`;
  const signature = await hmacSha256Hex(env.ALIYUN_ACCESS_KEY_SECRET, stringToSign);
  const authorization = `ACS3-HMAC-SHA256 Credential=${env.ALIYUN_ACCESS_KEY_ID},SignedHeaders=${signedHeaders},Signature=${signature}`;

  return fetch(`https://${endpoint}/`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': headers['content-type'],
      'x-acs-action': OCR_ACTION,
      'x-acs-content-sha256': contentSha256,
      'x-acs-date': date,
      'x-acs-signature-nonce': nonce,
      'x-acs-version': OCR_VERSION,
    },
    body,
  });
}

async function handleOcr(request, env, origin) {
  if (!env.ALIYUN_ACCESS_KEY_ID || !env.ALIYUN_ACCESS_KEY_SECRET) {
    return json({ error: 'Missing Aliyun OCR environment variables.' }, { status: 500 }, origin);
  }

  try {
    const formData = await request.formData();
    const image = formData.get('image');
    if (!(image instanceof File)) {
      return json({ error: 'Missing image file.' }, { status: 400 }, origin);
    }

    const body = await image.arrayBuffer();
    if (body.byteLength === 0) {
      return json({ error: 'Uploaded image file is empty.' }, { status: 400 }, origin);
    }

    const aliyunResponse = await callAliyunOcr(body, env);
    const rawText = await aliyunResponse.text();
    let payload = rawText;
    try {
      payload = JSON.parse(rawText);
    } catch {
      // Keep raw text for diagnostics.
    }

    if (!aliyunResponse.ok) {
      return json(
        { error: payload?.Message || rawText, raw: payload },
        { status: aliyunResponse.status },
        origin
      );
    }

    return json({ text: extractText(payload), raw: payload }, {}, origin);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 }, origin);
  }
}

async function ensureKnowledgeSchema(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS sync_spaces (
        sync_id TEXT PRIMARY KEY,
        secret_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS knowledge_entries (
        id TEXT NOT NULL,
        sync_id TEXT NOT NULL,
        concept TEXT NOT NULL,
        summary TEXT NOT NULL,
        context TEXT NOT NULL,
        file_path TEXT,
        line_start INTEGER,
        line_end INTEGER,
        mode TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        tags_json TEXT NOT NULL DEFAULT '[]',
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (sync_id, id)
      )`
    )
    .run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_knowledge_entries_sync_time ON knowledge_entries(sync_id, timestamp)`).run();
}

function getSyncCredentials(request) {
  const syncId = (request.headers.get('X-LearnCode-Sync-Id') || '').trim();
  const syncSecret = request.headers.get('X-LearnCode-Sync-Secret') || '';

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,79}$/.test(syncId)) {
    throw new Error('同步空间名需要 3-80 位，只能包含字母、数字、点、下划线或连字符。');
  }

  if (syncSecret.trim().length < 6) {
    throw new Error('同步密码至少需要 6 位。');
  }

  return { syncId, syncSecret };
}

async function ensureAuthorizedSpace(db, request) {
  const { syncId, syncSecret } = getSyncCredentials(request);
  const now = Date.now();
  const secretHash = await sha256Hex(`${syncId}:${syncSecret}`);
  const existing = await db
    .prepare('SELECT secret_hash FROM sync_spaces WHERE sync_id = ?')
    .bind(syncId)
    .first();

  if (!existing) {
    await db
      .prepare('INSERT INTO sync_spaces (sync_id, secret_hash, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .bind(syncId, secretHash, now, now)
      .run();
    return syncId;
  }

  if (existing.secret_hash !== secretHash) {
    throw new Error('同步空间名或同步密码不正确。');
  }

  await db.prepare('UPDATE sync_spaces SET updated_at = ? WHERE sync_id = ?').bind(now, syncId).run();
  return syncId;
}

function normalizeEntry(entry) {
  const id = String(entry?.id || crypto.randomUUID()).trim();
  const concept = String(entry?.concept || '').trim();
  const summary = String(entry?.summary || '').trim();
  const context = String(entry?.context || '');
  const mode = entry?.mode === 'local' ? 'local' : 'global';
  const timestamp = Number.isFinite(Number(entry?.timestamp)) ? Number(entry.timestamp) : Date.now();
  const tags = Array.isArray(entry?.tags) ? entry.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 12) : [];
  const lineRange = entry?.lineRange || null;

  if (!id || !concept || !summary) return null;

  return {
    id,
    concept,
    summary,
    context,
    filePath: entry?.filePath ? String(entry.filePath) : null,
    lineStart: Number.isFinite(Number(lineRange?.start)) ? Number(lineRange.start) : null,
    lineEnd: Number.isFinite(Number(lineRange?.end)) ? Number(lineRange.end) : null,
    mode,
    timestamp,
    tags,
  };
}

function rowToEntry(row) {
  let tags = [];
  try {
    tags = JSON.parse(row.tags_json || '[]');
  } catch {
    tags = [];
  }

  return {
    id: row.id,
    concept: row.concept,
    summary: row.summary,
    context: row.context,
    filePath: row.file_path || undefined,
    lineRange:
      Number.isFinite(row.line_start) && Number.isFinite(row.line_end)
        ? { start: row.line_start, end: row.line_end }
        : undefined,
    mode: row.mode === 'local' ? 'local' : 'global',
    timestamp: row.timestamp,
    tags,
  };
}

async function handleKnowledgeGet(request, env, origin) {
  if (!env.DB) return json({ error: 'Missing D1 binding DB.' }, { status: 500 }, origin);
  await ensureKnowledgeSchema(env.DB);
  const syncId = await ensureAuthorizedSpace(env.DB, request);
  const result = await env.DB
    .prepare(
      `SELECT id, concept, summary, context, file_path, line_start, line_end, mode, timestamp, tags_json
       FROM knowledge_entries
       WHERE sync_id = ?
       ORDER BY timestamp ASC`
    )
    .bind(syncId)
    .all();

  return json(
    {
      ok: true,
      syncId,
      entries: (result.results || []).map(rowToEntry),
    },
    {},
    origin
  );
}

async function handleKnowledgePost(request, env, origin) {
  if (!env.DB) return json({ error: 'Missing D1 binding DB.' }, { status: 500 }, origin);
  await ensureKnowledgeSchema(env.DB);
  const syncId = await ensureAuthorizedSpace(env.DB, request);
  const payload = await request.json().catch(() => null);
  const entries = Array.isArray(payload?.entries) ? payload.entries.map(normalizeEntry).filter(Boolean) : [];

  if (entries.length > MAX_KNOWLEDGE_ENTRIES) {
    return json({ error: `一次最多同步 ${MAX_KNOWLEDGE_ENTRIES} 个知识点。` }, { status: 400 }, origin);
  }

  const now = Date.now();
  const statements = [
    env.DB.prepare('DELETE FROM knowledge_entries WHERE sync_id = ?').bind(syncId),
    ...entries.map((entry) =>
      env.DB
        .prepare(
          `INSERT INTO knowledge_entries (
            id, sync_id, concept, summary, context, file_path, line_start, line_end, mode, timestamp, tags_json, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          entry.id,
          syncId,
          entry.concept,
          entry.summary,
          entry.context,
          entry.filePath,
          entry.lineStart,
          entry.lineEnd,
          entry.mode,
          entry.timestamp,
          JSON.stringify(entry.tags),
          now
        )
    ),
  ];

  await env.DB.batch(statements);
  return json({ ok: true, syncId, count: entries.length }, {}, origin);
}

async function handleKnowledge(request, env, origin) {
  try {
    if (request.method === 'GET') return handleKnowledgeGet(request, env, origin);
    if (request.method === 'POST') return handleKnowledgePost(request, env, origin);
    return json({ error: 'Use GET or POST for /api/knowledge.' }, { status: 405 }, origin);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }, origin);
  }
}

const worker = {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '*';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/api/knowledge') {
      return handleKnowledge(request, env, origin);
    }

    if (request.method === 'GET') {
      return json(
        {
          ok: true,
          service: 'learncode-worker',
          usage: {
            ocr: 'POST form-data with field "image" to /',
            knowledge: 'GET/POST /api/knowledge with X-LearnCode-Sync-Id and X-LearnCode-Sync-Secret headers',
          },
        },
        {},
        origin
      );
    }

    if (request.method !== 'POST') {
      return json({ error: 'Use POST with form-data field "image".' }, { status: 405 }, origin);
    }

    return handleOcr(request, env, origin);
  },
};

export default worker;
