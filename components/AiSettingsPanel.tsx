'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Cloud, DownloadCloud, FlaskConical, KeyRound, Save, UploadCloud, XCircle } from 'lucide-react';
import {
  DEFAULT_AI_SETTINGS,
  AiSettings,
  loadAiSettings,
  saveAiSettings,
} from '../lib/aiSettings';
import {
  AliyunOcrSettings,
  DEFAULT_ALIYUN_OCR_SETTINGS,
  loadAliyunOcrSettings,
  saveAliyunOcrSettings,
} from '../lib/ocrSettings';
import { getReadableAiError, testAiConnection } from '../lib/ai';
import {
  CloudSyncSettings,
  DEFAULT_CLOUD_SYNC_SETTINGS,
  loadCloudSyncSettings,
  mergeKnowledgeEntries,
  pullCloudKnowledge,
  pushCloudKnowledge,
  saveCloudSyncSettings,
  testCloudKnowledgeSync,
} from '../lib/cloudSync';
import { useAppStore } from '../lib/store';

interface AiSettingsPanelProps {
  onClose: () => void;
  onSaved?: () => void;
}

type TestState = 'idle' | 'testing' | 'success' | 'error';

const AiSettingsPanel: React.FC<AiSettingsPanelProps> = ({ onClose, onSaved }) => {
  const { knowledgeList, setKnowledgeList } = useAppStore();
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [ocrSettings, setOcrSettings] = useState<AliyunOcrSettings>(DEFAULT_ALIYUN_OCR_SETTINGS);
  const [cloudSettings, setCloudSettings] = useState<CloudSyncSettings>(DEFAULT_CLOUD_SYNC_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState<TestState>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [syncState, setSyncState] = useState<TestState>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    setSettings(loadAiSettings());
    setOcrSettings(loadAliyunOcrSettings());
    setCloudSettings(loadCloudSyncSettings());
  }, []);

  const hasKey = settings.apiKey.trim().length > 0;
  const steps = useMemo(
    () => [
      { label: '填写 API Key', done: hasKey },
      { label: '保存并测试连接', done: testState === 'success' },
      { label: '打开代码文件夹', done: false },
      { label: '开始局部/全局提问', done: false },
    ],
    [hasKey, testState]
  );

  const update = (field: keyof AiSettings, value: string) => {
    setSaved(false);
    setTestState('idle');
    setTestMessage('');
    setSettings((current) => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    saveAiSettings(settings);
    saveAliyunOcrSettings(ocrSettings);
    saveCloudSyncSettings(cloudSettings);
    setSaved(true);
    onSaved?.();
  };

  const updateOcr = (field: keyof AliyunOcrSettings, value: string) => {
    setSaved(false);
    setOcrSettings((current) => ({ ...current, [field]: value }));
  };

  const updateCloud = (field: keyof CloudSyncSettings, value: string) => {
    setSaved(false);
    setSyncState('idle');
    setSyncMessage('');
    setCloudSettings((current) => ({ ...current, [field]: value }));
  };

  const withCloudSync = async (action: () => Promise<string>) => {
    handleSave();
    setSyncState('testing');
    setSyncMessage('正在连接云端...');

    try {
      const message = await action();
      setSyncState('success');
      setSyncMessage(message);
    } catch (error) {
      setSyncState('error');
      setSyncMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const handleTestCloud = () =>
    withCloudSync(async () => {
      const count = await testCloudKnowledgeSync(cloudSettings);
      return `云同步连接正常，云端当前有 ${count} 个知识点。`;
    });

  const handlePushCloud = () =>
    withCloudSync(async () => {
      const result = await pushCloudKnowledge(cloudSettings, knowledgeList);
      return `已上传 ${result.count} 个本地知识点到云端。`;
    });

  const handlePullCloud = () =>
    withCloudSync(async () => {
      const cloudEntries = await pullCloudKnowledge(cloudSettings);
      const merged = mergeKnowledgeEntries(knowledgeList, cloudEntries);
      setKnowledgeList(merged);
      return `已从云端拉取 ${cloudEntries.length} 个知识点，合并后本地共有 ${merged.length} 个。`;
    });

  const handleTest = async () => {
    handleSave();
    setTestState('testing');
    setTestMessage('');

    try {
      await testAiConnection();
      setTestState('success');
      setTestMessage('连接成功。现在可以打开文件夹并开始提问。');
    } catch (error) {
      setTestState('error');
      setTestMessage(getReadableAiError(error));
    }
  };

  return (
    <div className="flex flex-col h-full relative module-container" style={{ background: 'var(--bg-secondary)' }}>
      <div className="module-glow" />

      <div className="flex items-start justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(14, 165, 233, 0.2)' }}>
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <KeyRound size={16} />
            首次使用
          </h2>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            面向不会跑本地项目的用户：填一次 Key，之后直接打开网页使用。
          </p>
        </div>
        <button onClick={onClose} className="interactive-circle" title="关闭">
          <XCircle size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={step.label} className="onboarding-step">
              <span className={step.done ? 'step-dot done' : 'step-dot'}>{step.done ? '✓' : index + 1}</span>
              <span>{step.label}</span>
            </div>
          ))}
        </div>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--sky-secondary)' }}>
            DeepSeek API Key
          </span>
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => update('apiKey', e.target.value)}
            placeholder="sk-..."
            className="sky-input w-full mt-2"
          />
          <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            只保存在当前浏览器，不会上传到仓库，也不会写入代码文件夹。
          </p>
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--sky-secondary)' }}>
            API Base URL
          </span>
          <input
            type="text"
            value={settings.baseUrl}
            onChange={(e) => update('baseUrl', e.target.value)}
            placeholder={DEFAULT_AI_SETTINGS.baseUrl}
            className="sky-input w-full mt-2"
          />
          <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            默认直连 DeepSeek。如果 GitHub Pages 上被浏览器跨域拦截，可以换成你的代理地址。
          </p>
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--sky-secondary)' }}>
            Model
          </span>
          <input
            type="text"
            value={settings.model}
            onChange={(e) => update('model', e.target.value)}
            placeholder={DEFAULT_AI_SETTINGS.model}
            className="sky-input w-full mt-2"
          />
        </label>

        <div className="settings-section">
          <h3>阿里云 OCR</h3>
          <p>推荐填写 Cloudflare Worker 代理地址。AccessKey 直连只适合本地测试，浏览器通常会被 CORS 拦截。</p>
        </div>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--sky-secondary)' }}>
            OCR Proxy URL
          </span>
          <input
            type="text"
            value={ocrSettings.proxyUrl}
            onChange={(e) => updateOcr('proxyUrl', e.target.value)}
            placeholder="https://your-worker.workers.dev"
            className="sky-input w-full mt-2"
          />
          <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            GitHub Pages 上用这个。Worker 里保存阿里云密钥，前端不暴露 Secret。
          </p>
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--sky-secondary)' }}>
            AccessKey ID（本地直连备用）
          </span>
          <input
            type="text"
            value={ocrSettings.accessKeyId}
            onChange={(e) => updateOcr('accessKeyId', e.target.value)}
            placeholder="LTAI..."
            className="sky-input w-full mt-2"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--sky-secondary)' }}>
            AccessKey Secret（本地直连备用）
          </span>
          <input
            type="password"
            value={ocrSettings.accessKeySecret}
            onChange={(e) => updateOcr('accessKeySecret', e.target.value)}
            placeholder="AccessKey Secret"
            className="sky-input w-full mt-2"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--sky-secondary)' }}>
            OCR Endpoint
          </span>
          <input
            type="text"
            value={ocrSettings.endpoint}
            onChange={(e) => updateOcr('endpoint', e.target.value)}
            placeholder={DEFAULT_ALIYUN_OCR_SETTINGS.endpoint}
            className="sky-input w-full mt-2"
          />
        </label>

        <div className="settings-section">
          <h3>云端知识库同步</h3>
          <p>电脑和手机填写同一组同步空间名与同步密码，就会使用同一个 Cloudflare D1 知识库。</p>
        </div>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--sky-secondary)' }}>
            Worker URL
          </span>
          <input
            type="text"
            value={cloudSettings.workerUrl}
            onChange={(e) => updateCloud('workerUrl', e.target.value)}
            placeholder="https://sohard.1298411051.workers.dev"
            className="sky-input w-full mt-2"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--sky-secondary)' }}>
            同步空间名
          </span>
          <input
            type="text"
            value={cloudSettings.syncId}
            onChange={(e) => updateCloud('syncId', e.target.value)}
            placeholder="my-c-learning"
            className="sky-input w-full mt-2"
          />
          <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            3-80 位，只能包含字母、数字、点、下划线或连字符。
          </p>
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--sky-secondary)' }}>
            同步密码
          </span>
          <input
            type="password"
            value={cloudSettings.syncSecret}
            onChange={(e) => updateCloud('syncSecret', e.target.value)}
            placeholder="至少 6 位"
            className="sky-input w-full mt-2"
          />
          <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            密码只存在浏览器本地；D1 里只保存校验用的哈希。
          </p>
        </label>

        <div className="cloud-sync-actions">
          <button onClick={handleTestCloud} disabled={syncState === 'testing'}>
            <Cloud size={14} />
            测试
          </button>
          <button onClick={handlePushCloud} disabled={syncState === 'testing'}>
            <UploadCloud size={14} />
            上传本机
          </button>
          <button onClick={handlePullCloud} disabled={syncState === 'testing'}>
            <DownloadCloud size={14} />
            拉取合并
          </button>
        </div>

        {syncMessage && (
          <div
            className="rounded-lg p-3 text-xs leading-relaxed"
            style={{
              background: syncState === 'success' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: syncState === 'success' ? '#166534' : '#b91c1c',
              border: `1px solid ${syncState === 'success' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
            }}
          >
            {syncState === 'testing' ? '正在连接云端...' : syncMessage}
          </div>
        )}

        {testMessage && (
          <div
            className="rounded-lg p-3 text-xs leading-relaxed"
            style={{
              background: testState === 'success' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: testState === 'success' ? '#86efac' : '#fca5a5',
              border: `1px solid ${testState === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}
          >
            {testMessage}
          </div>
        )}
      </div>

      <div className="p-4 border-t space-y-2" style={{ borderColor: 'rgba(14, 165, 233, 0.2)' }}>
        <button onClick={handleTest} disabled={!hasKey || testState === 'testing'} className="interactive-pill w-full">
          <FlaskConical size={14} className="mr-2" />
          {testState === 'testing' ? '测试中...' : '保存并测试连接'}
        </button>
        <button onClick={handleSave} className="interactive-pill w-full">
          <Save size={14} className="mr-2" />
          仅保存设置
        </button>
        {saved && testState !== 'success' && (
          <p className="text-xs text-center flex items-center justify-center gap-1" style={{ color: 'var(--sky-secondary)' }}>
            <CheckCircle2 size={12} />
            已保存
          </p>
        )}
      </div>
    </div>
  );
};

export default AiSettingsPanel;
