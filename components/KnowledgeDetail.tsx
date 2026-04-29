'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, Clock, Edit3, FileCode, Globe, Microscope, Save, Tag, Trash2, X } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { KnowledgeEntry } from '../lib/types';
import { removeKnowledgeFromFile, updateKnowledgeInFile } from '../lib/knowledgeFile';
import MarkdownRenderer from './MarkdownRenderer';

interface KnowledgeDetailProps {
  knowledge: KnowledgeEntry;
  onClose: () => void;
}

const tagTextToArray = (value: string) =>
  value
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);

const KnowledgeDetail: React.FC<KnowledgeDetailProps> = ({ knowledge, onClose }) => {
  const {
    setActiveFile,
    openFiles,
    updateKnowledge,
    removeKnowledge,
    rootHandle,
  } = useAppStore();

  const [isEditing, setIsEditing] = useState(false);
  const [concept, setConcept] = useState(knowledge.concept);
  const [summary, setSummary] = useState(knowledge.summary);
  const [tags, setTags] = useState((knowledge.tags || []).join(', '));
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    setConcept(knowledge.concept);
    setSummary(knowledge.summary);
    setTags((knowledge.tags || []).join(', '));
  }, [knowledge]);

  const isLocal = knowledge.mode === 'local';
  const fileName = knowledge.filePath?.split('/').pop();

  const handleGoToFile = () => {
    if (knowledge.filePath) {
      const file = openFiles.find((item) => item.path === knowledge.filePath);
      if (file) setActiveFile(knowledge.filePath);
    }
    onClose();
  };

  const handleSave = async () => {
    const patch = {
      concept: concept.trim() || '知识点',
      summary: summary.trim(),
      tags: tagTextToArray(tags),
    };
    const updated = { ...knowledge, ...patch };
    updateKnowledge(knowledge.id, patch);
    setIsEditing(false);

    if (rootHandle) {
      try {
        await updateKnowledgeInFile(rootHandle, updated);
        setSyncMessage('已同步到 .code-lens/knowledge.json');
      } catch {
        setSyncMessage('已保存到浏览器，本地知识库文件同步失败。');
      }
    } else {
      setSyncMessage('已保存到浏览器。打开文件夹后可以导出 Markdown。');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`确定删除知识点「${knowledge.concept}」吗？这个操作不能撤销。`)) {
      return;
    }

    removeKnowledge(knowledge.id);
    if (rootHandle) {
      await removeKnowledgeFromFile(rootHandle, knowledge.id).catch(() => undefined);
    }
    onClose();
  };

  return (
    <div className="flex flex-col h-full module-container" style={{ background: 'var(--bg-secondary)' }}>
      <div className="module-glow" />

      <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: 'rgba(14, 165, 233, 0.2)' }}>
        <button onClick={onClose} className="interactive-circle" title="返回">
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            {isLocal ? <Microscope size={15} /> : <Globe size={15} />}
            知识点详情
          </h2>
          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            {fileName || '未绑定文件'}
          </p>
        </div>
        <button onClick={() => setIsEditing((value) => !value)} className="interactive-circle" title="编辑">
          {isEditing ? <X size={15} /> : <Edit3 size={15} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isEditing ? (
          <div className="space-y-4">
            <label className="block">
              <span className="detail-label">概念</span>
              <input value={concept} onChange={(event) => setConcept(event.target.value)} className="sky-input w-full mt-2" />
            </label>
            <label className="block">
              <span className="detail-label">总结</span>
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={5}
                className="sky-input w-full mt-2 rounded-lg resize-none"
              />
            </label>
            <label className="block">
              <span className="detail-label">标签</span>
              <input value={tags} onChange={(event) => setTags(event.target.value)} className="sky-input w-full mt-2" />
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                用逗号或空格分隔。
              </p>
            </label>
            <button onClick={handleSave} className="interactive-pill w-full">
              <Save size={14} className="mr-2" />
              保存修改
            </button>
          </div>
        ) : (
          <>
            <section>
              <span className="detail-label">概念</span>
              <h3 className="text-xl font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                {knowledge.concept}
              </h3>
            </section>

            <section>
              <span className="detail-label">总结</span>
              <div className="detail-card mt-2">
                <MarkdownRenderer content={knowledge.summary} className="text-sm" />
              </div>
            </section>

            {knowledge.tags && knowledge.tags.length > 0 && (
              <section>
                <span className="detail-label flex items-center gap-1">
                  <Tag size={12} />
                  标签
                </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {knowledge.tags.map((tag) => (
                    <span key={tag} className="sky-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="flex flex-wrap gap-2">
              <span className="meta-pill">
                {isLocal ? <Microscope size={12} /> : <Globe size={12} />}
                {isLocal ? '局部提问' : '全局提问'}
              </span>
              {fileName && (
                <button onClick={handleGoToFile} className="meta-pill">
                  <FileCode size={12} />
                  {fileName}
                  {knowledge.lineRange && `:${knowledge.lineRange.start}-${knowledge.lineRange.end}`}
                </button>
              )}
              <span className="meta-pill">
                <Clock size={12} />
                {new Date(knowledge.timestamp).toLocaleString()}
              </span>
            </section>

            <section>
              <span className="detail-label">原始代码</span>
              <pre className="code-preview mt-2">{knowledge.context}</pre>
            </section>
          </>
        )}

        {syncMessage && (
          <div className="detail-card text-xs" style={{ color: 'var(--sky-secondary)' }}>
            {syncMessage}
          </div>
        )}
      </div>

      <div className="p-4 border-t" style={{ borderColor: 'rgba(14, 165, 233, 0.2)' }}>
        <button onClick={handleDelete} className="danger-button w-full">
          <Trash2 size={14} />
          删除知识点
        </button>
      </div>
    </div>
  );
};

export default KnowledgeDetail;
