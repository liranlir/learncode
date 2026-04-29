'use client';

import { KnowledgeEntry } from './types';

export interface CloudSyncSettings {
  workerUrl: string;
  syncId: string;
  syncSecret: string;
}

export interface CloudKnowledgeResponse {
  ok: boolean;
  syncId: string;
  entries: KnowledgeEntry[];
}

const STORAGE_KEY = 'code-lens-cloud-sync-settings';

export const DEFAULT_CLOUD_SYNC_SETTINGS: CloudSyncSettings = {
  workerUrl: '',
  syncId: '',
  syncSecret: '',
};

export function loadCloudSyncSettings(): CloudSyncSettings {
  if (typeof window === 'undefined') return DEFAULT_CLOUD_SYNC_SETTINGS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CLOUD_SYNC_SETTINGS;
    return { ...DEFAULT_CLOUD_SYNC_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CLOUD_SYNC_SETTINGS;
  }
}

export function saveCloudSyncSettings(settings: CloudSyncSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function isCloudSyncConfigured(settings = loadCloudSyncSettings()): boolean {
  return (
    settings.workerUrl.trim().length > 0 &&
    settings.syncId.trim().length >= 3 &&
    settings.syncSecret.trim().length >= 6
  );
}

function getKnowledgeUrl(settings: CloudSyncSettings): string {
  const base = settings.workerUrl.trim().replace(/\/+$/, '');
  if (!base) throw new Error('请先填写 Cloudflare Worker URL。');
  return `${base}/api/knowledge`;
}

function getSyncHeaders(settings: CloudSyncSettings): HeadersInit {
  const syncId = settings.syncId.trim();
  const syncSecret = settings.syncSecret;

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,79}$/.test(syncId)) {
    throw new Error('同步空间名需要 3-80 位，只能包含字母、数字、点、下划线或连字符。');
  }

  if (syncSecret.trim().length < 6) {
    throw new Error('同步密码至少需要 6 位。');
  }

  return {
    'Content-Type': 'application/json',
    'X-LearnCode-Sync-Id': syncId,
    'X-LearnCode-Sync-Secret': syncSecret,
  };
}

async function parseCloudError(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  if (!text) return `${response.status} ${response.statusText}`;

  try {
    const data = JSON.parse(text);
    return data.error || data.message || text;
  } catch {
    return text;
  }
}

function normalizeKnowledgeEntry(entry: KnowledgeEntry): KnowledgeEntry {
  return {
    ...entry,
    concept: String(entry.concept || '').trim(),
    summary: String(entry.summary || '').trim(),
    context: String(entry.context || ''),
    mode: entry.mode === 'local' ? 'local' : 'global',
    timestamp: Number.isFinite(Number(entry.timestamp)) ? Number(entry.timestamp) : Date.now(),
    tags: Array.isArray(entry.tags) ? entry.tags : [],
  };
}

export function mergeKnowledgeEntries(localEntries: KnowledgeEntry[], cloudEntries: KnowledgeEntry[]): KnowledgeEntry[] {
  const merged = new Map<string, KnowledgeEntry>();

  for (const entry of localEntries) {
    merged.set(entry.id, normalizeKnowledgeEntry(entry));
  }

  for (const entry of cloudEntries) {
    const existing = merged.get(entry.id);
    if (!existing || entry.timestamp >= existing.timestamp) {
      merged.set(entry.id, normalizeKnowledgeEntry(entry));
    }
  }

  return [...merged.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export async function pullCloudKnowledge(settings: CloudSyncSettings): Promise<KnowledgeEntry[]> {
  const response = await fetch(getKnowledgeUrl(settings), {
    method: 'GET',
    headers: getSyncHeaders(settings),
  });

  if (!response.ok) {
    throw new Error(await parseCloudError(response));
  }

  const data = (await response.json()) as CloudKnowledgeResponse;
  return Array.isArray(data.entries) ? data.entries.map(normalizeKnowledgeEntry) : [];
}

export async function pushCloudKnowledge(
  settings: CloudSyncSettings,
  entries: KnowledgeEntry[]
): Promise<{ count: number }> {
  const response = await fetch(getKnowledgeUrl(settings), {
    method: 'POST',
    headers: getSyncHeaders(settings),
    body: JSON.stringify({ entries: entries.map(normalizeKnowledgeEntry) }),
  });

  if (!response.ok) {
    throw new Error(await parseCloudError(response));
  }

  const data = await response.json();
  return { count: Number(data.count || entries.length) };
}

export async function testCloudKnowledgeSync(settings: CloudSyncSettings): Promise<number> {
  const entries = await pullCloudKnowledge(settings);
  return entries.length;
}
