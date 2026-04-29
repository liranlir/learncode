'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Camera, FileCode, ImageUp, Loader2, Wand2 } from 'lucide-react';
import { detectLanguage } from '../lib/types';
import { cleanOcrCodeText, getReadableAiError } from '../lib/ai';
import { recognizeCodeImage } from '../lib/aliyunOcr';
import { isAliyunOcrConfigured } from '../lib/ocrSettings';
import { useAppStore } from '../lib/store';

interface CameraCodePanelProps {
  onGoSettings: () => void;
  onReadyToAsk: (question: string) => void;
}

function guessFileName(text: string): string {
  if (/^\s*#include\s+/m.test(text)) return 'photo-code.c';
  if (/^\s*import\s+React|from\s+['"]react['"]/m.test(text)) return 'photo-code.tsx';
  if (/^\s*def\s+\w+|^\s*import\s+\w+/m.test(text)) return 'photo-code.py';
  if (/^\s*package\s+main|func\s+main\s*\(/m.test(text)) return 'photo-code.go';
  if (/public\s+class\s+\w+/m.test(text)) return 'photo-code.java';
  if (/fn\s+main\s*\(/m.test(text)) return 'photo-code.rs';
  return 'photo-code.txt';
}

async function enhanceImageForOcr(file: File): Promise<File> {
  const image = await createImageBitmap(file);
  const maxSide = 2200;
  const scale = Math.min(maxSide / Math.max(image.width, image.height), 2.4);
  const width = Math.max(1, Math.round(image.width * Math.max(scale, 1)));
  const height = Math.max(1, Math.round(image.height * Math.max(scale, 1)));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const contrast = 1.35;
  const brightness = 8;

  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const adjusted = Math.max(0, Math.min(255, (gray - 128) * contrast + 128 + brightness));
    data[index] = adjusted;
    data[index + 1] = adjusted;
    data[index + 2] = adjusted;
  }

  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.92);
  });

  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '-ocr.jpg', {
    type: 'image/jpeg',
  });
}

const CameraCodePanel: React.FC<CameraCodePanelProps> = ({ onGoSettings, onReadyToAsk }) => {
  const { openFile } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [code, setCode] = useState('');
  const [fileName, setFileName] = useState('photo-code.txt');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognizeStage, setRecognizeStage] = useState<'idle' | 'ocr' | 'clean'>('idle');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');

  const configured = isAliyunOcrConfigured();
  const canCreateFile = code.trim().length > 0 && fileName.trim().length > 0;

  const language = useMemo(() => detectLanguage(fileName), [fileName]);

  const handlePickImage = (file: File | undefined) => {
    if (!file) return;
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setCode('');
    setMessage('');
    setNotice('');
  };

  const handleRecognize = async () => {
    if (!imageFile) {
      setMessage('先拍照或上传一张代码图片。');
      return;
    }

    setIsRecognizing(true);
    setRecognizeStage('ocr');
    setMessage('');
    setNotice('');
    try {
      const enhancedImage = await enhanceImageForOcr(imageFile);
      const result = await recognizeCodeImage(enhancedImage);
      const text = result.text.trim();
      const rawFileName = guessFileName(text);

      try {
        setRecognizeStage('clean');
        const cleaned = await cleanOcrCodeText(text, rawFileName);
        const cleanedCode = cleaned.code.trim();

        if (cleanedCode) {
          setCode(cleanedCode);
          setFileName(cleaned.fileName || guessFileName(cleanedCode));
          setNotice(cleaned.note || '已用 AI 从 OCR 文本中整理出代码，请在生成文件前快速检查一遍。');
        } else {
          setCode(text);
          setFileName(rawFileName);
          setMessage(cleaned.note || 'AI 没能从 OCR 文本里提取出明确代码，已先保留 OCR 原文。');
        }
      } catch (cleanupError) {
        setCode(text);
        setFileName(rawFileName);
        setMessage(`OCR 已完成，但 AI 整理失败：${getReadableAiError(cleanupError)}。已先保留 OCR 原文。`);
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      const corsHint = text.includes('Failed to fetch')
        ? '浏览器可能拦截了阿里云跨域请求，后续可以加一个 Cloudflare Worker 代理。'
        : text;
      setMessage(corsHint);
    } finally {
      setIsRecognizing(false);
      setRecognizeStage('idle');
    }
  };

  const handleCreateFile = () => {
    const name = fileName.trim() || 'photo-code.txt';
    const content = code.trimEnd();
    openFile({
      name,
      path: `camera/${Date.now()}-${name}`,
      content,
      language: detectLanguage(name),
      isDirty: true,
    });
    onReadyToAsk('请讲解这个拍照识别生成的代码文件，先说明它整体做什么，再按关键函数/语句解释。');
  };

  return (
    <div className="side-panel-body camera-panel">
      <div className="panel-heading">
        <div>
          <h3>拍照识别代码</h3>
          <p>手机拍代码，OCR 后生成临时文件。</p>
        </div>
      </div>

      {!configured && (
        <div className="status-strip">
          <div>
            <strong>需要阿里云 OCR Key</strong>
            <span>填写 AccessKey 后才能识别图片。</span>
          </div>
          <button onClick={onGoSettings}>去设置</button>
        </div>
      )}

      <div className="camera-actions">
        <button onClick={() => cameraInputRef.current?.click()}>
          <Camera size={15} />
          拍照
        </button>
        <button onClick={() => fileInputRef.current?.click()}>
          <ImageUp size={15} />
          上传图片
        </button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => handlePickImage(event.target.files?.[0])}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handlePickImage(event.target.files?.[0])}
      />

      {previewUrl ? (
        <img src={previewUrl} alt="待识别代码照片预览" className="camera-preview" />
      ) : (
        <div className="empty-panel side-empty">
          <Camera size={22} />
          <p>拍一张代码照片</p>
          <span>尽量让代码区域占满画面，保持对焦和光线。</span>
        </div>
      )}

      <button
        onClick={handleRecognize}
        disabled={!configured || !imageFile || isRecognizing}
        className="primary-action"
      >
        {isRecognizing ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
        {recognizeStage === 'ocr' ? 'OCR 识别中...' : recognizeStage === 'clean' ? 'AI 整理中...' : '识别并整理代码'}
      </button>

      {message && <div className="inline-error">{message}</div>}
      {notice && <div className="inline-note">{notice}</div>}

      {code && (
        <section className="recognized-code">
          <label>
            <span>文件名</span>
            <input value={fileName} onChange={(event) => setFileName(event.target.value)} />
          </label>
          <label>
            <span>AI 整理结果 · {language}</span>
            <textarea value={code} onChange={(event) => setCode(event.target.value)} rows={12} />
          </label>
          <button onClick={handleCreateFile} disabled={!canCreateFile} className="primary-action">
            <FileCode size={15} />
            生成文件并准备讲解
          </button>
        </section>
      )}
    </div>
  );
};

export default CameraCodePanel;
