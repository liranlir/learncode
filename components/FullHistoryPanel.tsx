'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Download,
  Globe,
  Microscope,
  Search,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { KnowledgeEntry } from '../lib/types';
import { downloadKnowledgeMarkdown, saveKnowledgeMarkdown } from '../lib/knowledgeFile';
import MarkdownRenderer from './MarkdownRenderer';
import KnowledgeDetail from './KnowledgeDetail';

interface FullHistoryPanelProps {
  onClose: () => void;
}

const FullHistoryPanel: React.FC<FullHistoryPanelProps> = ({ onClose }) => {
  const {
    globalMessages,
    clearGlobalMessages,
    knowledgeList,
    rootHandle,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'global' | 'knowledge'>('knowledge');
  const [query, setQuery] = useState('');
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeEntry | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  const filteredKnowledge = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...knowledgeList].reverse();

    return [...knowledgeList].reverse().filter((entry) => {
      const haystack = [
        entry.concept,
        entry.summary,
        entry.filePath || '',
        entry.tags?.join(' ') || '',
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [knowledgeList, query]);

  const groupedGlobalMessages = globalMessages.reduce((groups, msg) => {
    const date = new Date(msg.timestamp).toLocaleDateString();
    groups[date] = groups[date] || [];
    groups[date].push(msg);
    return groups;
  }, {} as Record<string, typeof globalMessages>);

  const dates = Object.keys(groupedGlobalMessages).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  const toggleMessageExpand = (msgId: string) => {
    setExpandedMessages((current) => {
      const next = new Set(current);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const handleExportMarkdown = async () => {
    if (knowledgeList.length === 0) return;

    setIsExporting(true);
    try {
      if (rootHandle) {
        await saveKnowledgeMarkdown(rootHandle, knowledgeList);
      }
      downloadKnowledgeMarkdown(knowledgeList);
    } finally {
      setIsExporting(false);
    }
  };

  if (selectedKnowledge) {
    return (
      <KnowledgeDetail
        knowledge={selectedKnowledge}
        onClose={() => setSelectedKnowledge(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full module-container" style={{ background: 'var(--bg-secondary)' }}>
      <div className="module-glow" />

      <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: 'rgba(14, 165, 233, 0.2)' }}>
        <button onClick={onClose} className="interactive-circle" title="返回">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            学习记录
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            历史对话和知识点都在这里。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3">
        <button
          onClick={() => setActiveTab('knowledge')}
          className="interactive-pill"
          data-active={activeTab === 'knowledge'}
        >
          <BookOpen size={14} className="mr-1.5" />
          知识点 {knowledgeList.length}
        </button>
        <button
          onClick={() => setActiveTab('global')}
          className="interactive-pill"
          data-active={activeTab === 'global'}
        >
          <Globe size={14} className="mr-1.5" />
          对话 {globalMessages.length}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'knowledge' ? (
          <div className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="sky-input w-full pl-9"
                  placeholder="搜索概念、标签、文件"
                />
              </div>
              <button
                onClick={handleExportMarkdown}
                disabled={knowledgeList.length === 0 || isExporting}
                className="interactive-circle"
                title="导出 Markdown"
              >
                <Download size={15} />
              </button>
            </div>

            {filteredKnowledge.length === 0 ? (
              <div className="empty-panel">
                <BookOpen size={24} />
                <p>{knowledgeList.length === 0 ? '还没有知识点' : '没有匹配的知识点'}</p>
                <span>圈选代码后提问，再点击保存，就会沉淀到这里。</span>
              </div>
            ) : (
              filteredKnowledge.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedKnowledge(entry)}
                  className="knowledge-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {entry.mode === 'local' ? <Microscope size={13} /> : <Globe size={13} />}
                        <strong>{entry.concept}</strong>
                      </div>
                      <p>{entry.summary}</p>
                    </div>
                    <span className="knowledge-mode">{entry.mode === 'local' ? '局部' : '全局'}</span>
                  </div>
                  <div className="knowledge-meta">
                    {entry.filePath && <span>{entry.filePath.split('/').pop()}</span>}
                    {entry.tags?.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="p-3 space-y-4">
            {globalMessages.length === 0 ? (
              <div className="empty-panel">
                <Globe size={24} />
                <p>还没有全局对话</p>
                <span>打开文件夹后，在右下输入框问项目结构、入口文件或模块关系。</span>
              </div>
            ) : (
              <>
                {dates.map((date) => (
                  <div key={date} className="space-y-2">
                    <div className="history-date">
                      <Clock size={12} />
                      {date}
                    </div>
                    {groupedGlobalMessages[date].map((msg) => {
                      const isExpanded = expandedMessages.has(msg.id);
                      const shouldTruncate = msg.content.length > 360 && msg.role === 'assistant';

                      return (
                        <div key={msg.id} className={`history-message ${msg.role}`}>
                          <div className="history-message-head">
                            <span>{msg.role === 'user' ? '你' : 'AI'}</span>
                            <time>
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </time>
                          </div>
                          {msg.role === 'user' ? (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          ) : (
                            <>
                              <div className={shouldTruncate && !isExpanded ? 'max-h-36 overflow-hidden' : ''}>
                                <MarkdownRenderer content={msg.content} />
                              </div>
                              {shouldTruncate && (
                                <button onClick={() => toggleMessageExpand(msg.id)} className="history-expand">
                                  {isExpanded ? '收起' : '展开更多'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}

                <button
                  onClick={() => {
                    if (window.confirm('确定要清空所有全局对话吗？这个操作不能撤销。')) {
                      clearGlobalMessages();
                    }
                  }}
                  className="danger-button"
                >
                  <Trash2 size={14} />
                  清空所有对话
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FullHistoryPanel;
