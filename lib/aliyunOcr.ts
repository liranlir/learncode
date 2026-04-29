'use client';

import { loadAliyunOcrSettings } from './ocrSettings';

interface OcrWord {
  word?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface AliyunOcrData {
  content?: string;
  prism_wordsInfo?: OcrWord[];
}

export interface RecognizedCodeResult {
  text: string;
  raw: unknown;
}

const OCR_ACTION = 'RecognizeGeneral';
const OCR_VERSION = '2021-07-07';

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(data: ArrayBuffer | string): Promise<string> {
  const source = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return toHex(await crypto.subtle.digest('SHA-256', source));
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
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

function utcTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function normalizeHeaderValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function reconstructFromWords(words: OcrWord[] | undefined): string {
  if (!words || words.length === 0) return '';

  const normalized = words
    .filter((item) => item.word)
    .map((item) => ({
      text: item.word || '',
      x: item.x ?? 0,
      y: item.y ?? 0,
      height: item.height ?? 14,
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const lines: Array<typeof normalized> = [];
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

function extractText(payload: unknown): string {
  const data = payload as AliyunOcrData;
  const fromWords = reconstructFromWords(data.prism_wordsInfo);
  return fromWords || data.content?.trim() || '';
}

function parseOcrPayload(payload: unknown): RecognizedCodeResult {
  const proxyPayload = payload as { text?: string; raw?: unknown };
  if (typeof proxyPayload.text === 'string') {
    return { text: proxyPayload.text.trim(), raw: proxyPayload.raw || payload };
  }

  const root = payload as { Data?: string | AliyunOcrData; data?: AliyunOcrData };
  let data: unknown = root.data || root.Data || payload;

  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return { text: String(data), raw: payload };
    }
  }

  return {
    text: extractText(data),
    raw: payload,
  };
}

export async function recognizeCodeImage(file: File): Promise<RecognizedCodeResult> {
  const settings = loadAliyunOcrSettings();
  if (settings.proxyUrl.trim()) {
    return recognizeViaProxy(file, settings.proxyUrl.trim());
  }

  if (!settings.accessKeyId || !settings.accessKeySecret) {
    throw new Error('请先在 Settings 里填写 OCR Proxy URL，或填写阿里云 OCR AccessKey。');
  }

  const body = await file.arrayBuffer();
  const contentSha256 = await sha256Hex(body);
  const date = utcTimestamp();
  const nonce = crypto.randomUUID();
  const contentType = file.type || 'application/octet-stream';
  const endpoint = settings.endpoint;

  const headers: Record<string, string> = {
    'content-type': contentType,
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
  const signature = await hmacSha256Hex(settings.accessKeySecret, stringToSign);
  const authorization = `ACS3-HMAC-SHA256 Credential=${settings.accessKeyId},SignedHeaders=${signedHeaders},Signature=${signature}`;

  const response = await fetch(`https://${endpoint}/`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      'x-acs-action': OCR_ACTION,
      'x-acs-content-sha256': contentSha256,
      'x-acs-date': date,
      'x-acs-signature-nonce': nonce,
      'x-acs-version': OCR_VERSION,
    },
    body,
  });

  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = JSON.parse(text);
  } catch {
    // Keep the raw text for diagnostics.
  }

  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'Message' in payload
      ? String((payload as { Message?: string }).Message)
      : text;
    throw new Error(`阿里云 OCR 请求失败：${message}`);
  }

  const result = parseOcrPayload(payload);
  if (!result.text) {
    throw new Error('OCR 没有识别到可用文本，请换一张更清晰的代码照片。');
  }

  return result;
}

async function recognizeViaProxy(file: File, proxyUrl: string): Promise<RecognizedCodeResult> {
  const formData = new FormData();
  formData.append('image', file, file.name || 'code-photo.jpg');

  const response = await fetch(proxyUrl, {
    method: 'POST',
    body: formData,
  });

  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = JSON.parse(text);
  } catch {
    // Keep raw text if proxy returns plain diagnostics.
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String((payload as { error?: string }).error)
        : text;
    throw new Error(`OCR Proxy 请求失败：${message}`);
  }

  const result = parseOcrPayload(payload);
  if (!result.text) {
    throw new Error('OCR 没有识别到可用文本，请换一张更清晰的代码照片。');
  }

  return result;
}
