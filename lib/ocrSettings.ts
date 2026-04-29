'use client';

export interface AliyunOcrSettings {
  accessKeyId: string;
  accessKeySecret: string;
  endpoint: string;
  proxyUrl: string;
}

export const ALIYUN_OCR_SETTINGS_STORAGE_KEY = 'code-lens-aliyun-ocr-settings';

export const DEFAULT_ALIYUN_OCR_SETTINGS: AliyunOcrSettings = {
  accessKeyId: '',
  accessKeySecret: '',
  endpoint: 'ocr-api.cn-hangzhou.aliyuncs.com',
  proxyUrl: '',
};

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '') || DEFAULT_ALIYUN_OCR_SETTINGS.endpoint;
}

export function loadAliyunOcrSettings(): AliyunOcrSettings {
  if (typeof window === 'undefined') return DEFAULT_ALIYUN_OCR_SETTINGS;

  try {
    const saved = window.localStorage.getItem(ALIYUN_OCR_SETTINGS_STORAGE_KEY);
    if (!saved) return DEFAULT_ALIYUN_OCR_SETTINGS;

    const parsed = JSON.parse(saved) as Partial<AliyunOcrSettings>;
    return {
      accessKeyId: parsed.accessKeyId || '',
      accessKeySecret: parsed.accessKeySecret || '',
      endpoint: normalizeEndpoint(parsed.endpoint || DEFAULT_ALIYUN_OCR_SETTINGS.endpoint),
      proxyUrl: parsed.proxyUrl || '',
    };
  } catch {
    return DEFAULT_ALIYUN_OCR_SETTINGS;
  }
}

export function saveAliyunOcrSettings(settings: AliyunOcrSettings): void {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    ALIYUN_OCR_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      accessKeyId: settings.accessKeyId.trim(),
      accessKeySecret: settings.accessKeySecret.trim(),
      endpoint: normalizeEndpoint(settings.endpoint),
      proxyUrl: settings.proxyUrl.trim(),
    })
  );
}

export function isAliyunOcrConfigured(): boolean {
  const settings = loadAliyunOcrSettings();
  return Boolean(settings.proxyUrl.trim() || (settings.accessKeyId.trim() && settings.accessKeySecret.trim()));
}
