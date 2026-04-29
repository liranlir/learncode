'use client';

import React from 'react';
import { X, Globe, Sparkles } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { KnowledgeEntry } from '../lib/types';

interface KnowledgeTagProps {
  knowledge: KnowledgeEntry;
  onDelete?: (e: React.MouseEvent) => void;
}

const KnowledgeTag: React.FC<KnowledgeTagProps> = ({ knowledge, onDelete }) => {
  const { removeKnowledge } = useAppStore();
  const isLocal = knowledge.mode === 'local';

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(e);
    } else if (window.confirm(`确定删除知识点「${knowledge.concept}」吗？`)) {
      removeKnowledge(knowledge.id);
    }
  };

  const bgColor = isLocal 
    ? 'rgba(14, 165, 233, 0.15)' 
    : 'rgba(14, 165, 233, 0.1)';
  
  const borderColor = isLocal 
    ? 'rgba(14, 165, 233, 0.4)' 
    : 'rgba(14, 165, 233, 0.25)';

  return (
    <div
      className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer"
      style={{
        background: bgColor,
        border: '1px solid ' + borderColor,
        color: 'var(--sky-secondary)',
      }}
      title={knowledge.concept + ': ' + knowledge.summary}
    >
      {isLocal ? (
        <Sparkles size={10} style={{ color: 'var(--sky-primary)' }} />
      ) : (
        <Globe size={10} style={{ color: 'var(--sky-primary)' }} />
      )}
      
      <span className="font-medium truncate max-w-[80px]">{knowledge.concept}</span>
      
      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 transition-all p-0.5 rounded-full hover:bg-red-500/20"
        style={{ color: 'var(--text-muted)' }}
      >
        <X size={10} />
      </button>
    </div>
  );
};

export default KnowledgeTag;
