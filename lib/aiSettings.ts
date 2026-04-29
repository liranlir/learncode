'use client';

export interface AiSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export const AI_SETTINGS_STORAGE_KEY = 'code-lens-ai-settings';

export const DEFAULT_AI_SETTINGS: AiSettings = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
};

export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  return trimmed || DEFAULT_AI_SETTINGS.baseUrl;
}

export function getChatCompletionsUrl(settings: AiSettings): string {
  return `${normalizeBaseUrl(settings.baseUrl)}/chat/completions`;
}

export function loadAiSettings(): AiSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_AI_SETTINGS;
  }

  try {
    const saved = window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!saved) return DEFAULT_AI_SETTINGS;

    const parsed = JSON.parse(saved) as Partial<AiSettings>;
    return {
      apiKey: parsed.apiKey || '',
      baseUrl: normalizeBaseUrl(parsed.baseUrl || DEFAULT_AI_SETTINGS.baseUrl),
      model: parsed.model || DEFAULT_AI_SETTINGS.model,
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAiSettings(settings: AiSettings): void {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    AI_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      apiKey: settings.apiKey.trim(),
      baseUrl: normalizeBaseUrl(settings.baseUrl),
      model: settings.model.trim() || DEFAULT_AI_SETTINGS.model,
    })
  );
}

export function isAiConfigured(): boolean {
  return loadAiSettings().apiKey.trim().length > 0;
}
