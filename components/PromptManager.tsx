'use client';

import React, { useState, useEffect } from 'react';
import { Microscope, Globe, Plus, Edit2, Trash2, Check, X, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { getAllPrompts, saveCustomPrompts, CustomPrompt, BUILTIN_PROMPTS } from '../lib/prompts';

interface PromptManagerProps {
  mode: 'local' | 'global';
  selectedPrompt: string;
  onSelectPrompt: (template: string) => void;
}

const PromptManager: React.FC<PromptManagerProps> = ({ mode, selectedPrompt, onSelectPrompt }) => {
  const [prompts, setPrompts] = useState<CustomPrompt[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTemplate, setEditTemplate] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // 加载提示词
  useEffect(() => {
    setPrompts(getAllPrompts(mode));
  }, [mode]);

  const handleSelect = (prompt: CustomPrompt) => {
    onSelectPrompt(prompt.template);
  };

  const handleDelete = (id: string) => {
    const customPrompts = prompts.filter(p => !p.isBuiltin && p.id !== id);
    saveCustomPrompts(customPrompts.filter(p => !p.isBuiltin));
    setPrompts(getAllPrompts(mode));
  };

  const handleStartEdit = (prompt: CustomPrompt) => {
    setEditingId(prompt.id);
    setEditName(prompt.name);
    setEditTemplate(prompt.template);
  };

  const handleSaveEdit = () => {
    if (!editName.trim() || !editTemplate.trim()) return;

    const customPrompts = prompts.filter(p => !p.isBuiltin);
    const existingIndex = customPrompts.findIndex(p => p.id === editingId);

    if (existingIndex >= 0) {
      customPrompts[existingIndex] = {
        ...customPrompts[existingIndex],
        name: editName.trim(),
        template: editTemplate.trim(),
      };
    } else {
      customPrompts.push({
        id: `custom-${Date.now()}`,
        name: editName.trim(),
        template: editTemplate.trim(),
        mode,
      });
    }

    saveCustomPrompts(customPrompts);
    setPrompts(getAllPrompts(mode));
    setEditingId(null);
    setIsCreating(false);
    setEditName('');
    setEditTemplate('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    setEditName('');
    setEditTemplate('');
  };

  const handleStartCreate = () => {
    setIsCreating(true);
    setEditingId('new');
    setEditName('');
    setEditTemplate('');
  };

  const currentPrompt = prompts.find(p => p.template === selectedPrompt);

  return (
    <div className="border-t dark:border-gray-700">
      {/* 标题栏 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          {mode === 'local' ? (
            <Microscope size={14} className="text-purple-500" />
          ) : (
            <Globe size={14} className="text-green-500" />
          )}
          <span>{mode === 'local' ? '局部提问模板' : '全局提问模板'}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-400 truncate max-w-[80px]">
            {currentPrompt?.name || '默认'}
          </span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* 展开内容 */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 max-h-64 overflow-y-auto">
          {/* 提示词列表 */}
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className={`group flex items-start gap-2 p-2 rounded text-xs cursor-pointer transition-colors ${
                selectedPrompt === prompt.template
                  ? mode === 'local'
                    ? 'bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800'
                    : 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <div
                className="flex-1 min-w-0"
                onClick={() => handleSelect(prompt)}
              >
                <div className="font-medium text-gray-700 dark:text-gray-300 truncate">
                  {prompt.name}
                  {prompt.isBuiltin && (
                    <span className="ml-1 text-gray-400">(内置)</span>
                  )}
                </div>
                <div className="text-gray-500 dark:text-gray-500 truncate mt-0.5">
                  {prompt.template.slice(0, 40)}...
                </div>
              </div>

              {/* 操作按钮 */}
              {!prompt.isBuiltin && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(prompt);
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(prompt.id);
                    }}
                    className="p-1 hover:bg-red-100 text-red-500 rounded"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* 添加按钮 */}
          {!isCreating && (
            <button
              onClick={handleStartCreate}
              className={`w-full flex items-center justify-center gap-1 px-3 py-2 rounded text-xs font-medium transition-colors ${
                mode === 'local'
                  ? 'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                  : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
              }`}
            >
              <Plus size={14} />
              自定义模板
            </button>
          )}

          {/* 编辑/创建表单 */}
          {(editingId || isCreating) && (
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="模板名称"
                className="w-full px-2 py-1.5 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white mb-2"
              />
              <textarea
                value={editTemplate}
                onChange={(e) => setEditTemplate(e.target.value)}
                placeholder="输入提示词模板..."
                rows={4}
                className="w-full px-2 py-1.5 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={handleCancelEdit}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X size={14} />
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editName.trim() || !editTemplate.trim()}
                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
                >
                  <Save size={14} />
                  保存
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PromptManager;
