'use client';

import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useAppStore } from '../lib/store';

interface InlineActionProps {
  style: React.CSSProperties;
}

// 这个组件现在主要作为后备方案，实际功能已集成到 ContextMenu 和 InlineChat 中
const InlineAction: React.FC<InlineActionProps> = ({ style }) => {
  const { selection, addKnowledge } = useAppStore();
  const [showInput, setShowInput] = useState(false);
  const [concept, setConcept] = useState('');

  const handleBookmark = () => {
    if (selection) {
      setShowInput(true);
    }
  };

  const handleAddKnowledge = () => {
    if (selection && concept.trim()) {
      // 使用新的 addKnowledge 签名，summary 暂时用 concept 代替
      addKnowledge(
        concept.trim(),
        `手动添加的知识点：${concept.trim()}`,
        selection.text,
        selection.filePath,
        { start: selection.startLine, end: selection.endLine },
        []
      );
      setConcept('');
      setShowInput(false);
    }
  };

  if (!selection) return null;

  if (showInput) {
    return (
      <div
        className="absolute bg-white dark:bg-gray-800 shadow-xl rounded-lg p-3 z-50 min-w-[250px] border dark:border-gray-700"
        style={style}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Sparkles size={12} className="text-purple-500" />
            收藏知识点
          </span>
          <button
            onClick={() => setShowInput(false)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X size={14} />
          </button>
        </div>
        <div className="space-y-2">
          <input
            type="text"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="知识点名称"
            className="w-full px-3 py-2 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            autoFocus
            onKeyPress={(e) => e.key === 'Enter' && handleAddKnowledge()}
          />
          <p className="text-xs text-gray-400">
            提示：使用右键菜单的"提问"可获得 AI 自动总结
          </p>
          <button
            onClick={handleAddKnowledge}
            className="w-full px-3 py-2 bg-green-500 text-white rounded-md text-sm hover:bg-green-600 transition-colors"
          >
            手动添加
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default InlineAction;
