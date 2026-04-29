'use client';

import React from 'react';
import { ArrowLeft, Clock, MessageSquare, Trash2 } from 'lucide-react';
import { useAppStore } from '../lib/store';

interface HistoryPanelProps {
  onClose: () => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ onClose }) => {
  const { globalMessages, knowledgeList, clearGlobalMessages } = useAppStore();

  // 按日期分组
  const groupedMessages = globalMessages.reduce((groups, msg) => {
    const date = new Date(msg.timestamp).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(msg);
    return groups;
  }, {} as Record<string, typeof globalMessages>);

  const dates = Object.keys(groupedMessages).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="p-3 border-b dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
          >
            <ArrowLeft size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
          <h2 className="font-semibold text-gray-800 dark:text-white text-sm flex items-center gap-2">
            <Clock size={16} />
            对话历史
          </h2>
        </div>
        {globalMessages.length > 0 && (
          <button
            onClick={clearGlobalMessages}
            className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          >
            <Trash2 size={12} />
            清空
          </button>
        )}
      </div>

      {/* 统计信息 */}
      <div className="p-3 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
        <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <MessageSquare size={12} />
            <span>{globalMessages.length} 条消息</span>
          </div>
          <div className="flex items-center gap-1">
            <span>💡</span>
            <span>{knowledgeList.length} 个知识点</span>
          </div>
        </div>
      </div>

      {/* 历史列表 */}
      <div className="flex-1 overflow-y-auto p-3">
        {globalMessages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              暂无历史对话
            </p>
            <p className="text-xs text-gray-400 mt-2">
              全局模式的对话会显示在这里
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {dates.map((date) => (
              <div key={date}>
                <div className="sticky top-0 bg-white dark:bg-gray-800 py-1 mb-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">
                    {date}
                  </span>
                </div>
                <div className="space-y-2">
                  {groupedMessages[date].map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg text-sm ${
                        msg.role === 'user'
                          ? 'bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-l-4 border-blue-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium ${
                          msg.role === 'user' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'
                        }`}>
                          {msg.role === 'user' ? '你' : 'AI'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(msg.timestamp).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 line-clamp-3">
                        {msg.content}
                      </p>
                      {msg.filePath && (
                        <p className="text-xs text-gray-400 mt-1 truncate">
                          📄 {msg.filePath.split('/').pop()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="p-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          💡 局部提问不会记录在历史中
        </p>
      </div>
    </div>
  );
};

export default HistoryPanel;
