'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Loader2, MessageSquare, ChevronDown, ChevronUp, ChevronRight, Sparkles } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { streamChat, summarizeKnowledge, consumeChatStream, getReadableAiError } from '../lib/ai';
import { getAllPrompts } from '../lib/prompts';
import { addKnowledgeToFile } from '../lib/knowledgeFile';
import MarkdownRenderer from './MarkdownRenderer';

interface InlineChatProps {
  position: { x: number; y: number };
  selectionText: string;
  startLine: number;
  endLine: number;
  filePath: string;
  onClose: () => void;
  selectedPrompt: string;
}

const InlineChat: React.FC<InlineChatProps> = ({
  position,
  selectionText,
  startLine,
  endLine,
  filePath,
  onClose,
  selectedPrompt,
}) => {
  const [input, setInput] = useState('');
  const [showPrompts, setShowPrompts] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  
  const { 
    localConversation, 
    setLocalConversation, 
    updateLocalAnswer,
    knowledgeList,
    addKnowledge,
    rootHandle,
  } = useAppStore();

  const localPrompts = getAllPrompts('local');

  useEffect(() => {
    inputRef.current?.focus();
    if (selectedPrompt && !input) {
      setInput(selectedPrompt);
    }
  }, [selectedPrompt]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (chatRef.current && !chatRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleSend = async () => {
    if (input.trim() === '') return;

    const question = input.trim();
    
    setLocalConversation({
      id: crypto.randomUUID(),
      question,
      answer: '',
      isStreaming: true,
      timestamp: Date.now(),
    });

    setInput('');

    try {
      const payload = {
        code: '',
        question,
        mode: 'local' as const,
        selection: {
          startLine,
          endLine,
          text: selectionText,
          filePath,
        },
        knowledgeList: knowledgeList.map((k) => ({ concept: k.concept, mode: k.mode })),
      };

      const stream = await streamChat(payload);
      const fullContent = await consumeChatStream(stream, (content) =>
        updateLocalAnswer(content, true)
      );

      updateLocalAnswer(fullContent, false);
    } catch (error) {
      const errorMsg = `请求出错：${getReadableAiError(error)}`;
      updateLocalAnswer(errorMsg, false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // AI 总结并保存知识点
  const handleSmartSave = async () => {
    if (!localConversation?.answer || !rootHandle) {
      setSummaryError(rootHandle ? '请先完成对话' : '请先打开文件夹');
      return;
    }

    setIsSummarizing(true);
    setSummaryError('');

    try {
      const result = await summarizeKnowledge({
        code: selectionText,
        question: localConversation.question,
        answer: localConversation.answer,
        filePath,
        lineRange: { start: startLine, end: endLine },
      });

      addKnowledge(
        result.concept,
        result.summary,
        selectionText,
        filePath,
        { start: startLine, end: endLine },
        result.tags
      );

      await addKnowledgeToFile(rootHandle, {
        id: crypto.randomUUID(),
        concept: result.concept,
        summary: result.summary,
        context: selectionText,
        filePath,
        lineRange: { start: startLine, end: endLine },
        mode: 'local',
        timestamp: Date.now(),
        tags: result.tags,
      });

      alert(`✅ 已保存知识点: "${result.concept}"\n\n总结: ${result.summary}\n\n标签: ${result.tags.join(', ')}`);
    } catch (error) {
      console.error('Failed to summarize:', error);
      setSummaryError('总结失败，请重试');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSelectPrompt = (template: string) => {
    setInput(template);
    setShowPrompts(false);
    inputRef.current?.focus();
  };

  const chatWidth = 480;
  const chatHeight = 520;
  
  const adjustedX = Math.min(Math.max(10, position.x), window.innerWidth - chatWidth - 20);
  const adjustedY = Math.min(Math.max(10, position.y), window.innerHeight - chatHeight - 20);

  const canSave = localConversation?.answer && !localConversation?.isStreaming && !isSummarizing;

  return (
    <div
      ref={chatRef}
      className="fixed rounded-2xl z-50 overflow-hidden flex flex-col"
      style={{
        left: adjustedX,
        top: adjustedY,
        width: chatWidth,
        height: chatHeight,
        background: 'var(--bg-secondary)',
        border: '1px solid rgba(14, 165, 233, 0.4)',
        boxShadow: `
          0 25px 50px -12px rgba(0, 0, 0, 0.9),
          0 0 0 1px rgba(0, 0, 0, 0.5),
          0 0 60px rgba(14, 165, 233, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.05)
        `
      }}
    >
      {/* 顶部光晕 */}
      <div 
        className="absolute top-0 left-4 right-4 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(14, 165, 233, 0.8), transparent)'
        }}
      />

      {/* 头部 */}
      <div 
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ 
          background: 'linear-gradient(180deg, rgba(14, 165, 233, 0.1) 0%, transparent 100%)',
          borderBottom: '1px solid rgba(14, 165, 233, 0.2)'
        }}
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={16} style={{ color: 'var(--sky-primary)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            局部提问 ({startLine}-{endLine}行)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* 智能保存按钮 - 胶囊形 */}
          <button
            onClick={handleSmartSave}
            disabled={!canSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: canSave ? 'rgba(14, 165, 233, 0.2)' : 'var(--bg-tertiary)',
              color: canSave ? 'var(--sky-secondary)' : 'var(--text-muted)',
              border: `1px solid ${canSave ? 'rgba(14, 165, 233, 0.5)' : 'transparent'}`,
              opacity: canSave ? 1 : 0.6,
              cursor: canSave ? 'pointer' : 'not-allowed',
              boxShadow: canSave ? '0 0 15px rgba(14, 165, 233, 0.3)' : 'none'
            }}
            title={canSave ? 'AI 自动总结并保存' : '需先完成对话并打开文件夹'}
          >
            {isSummarizing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            {isSummarizing ? '总结中...' : '保存'}
          </button>
          <button
            onClick={onClose}
            className="interactive-circle"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {summaryError && (
        <div 
          className="px-4 py-2 text-xs flex-shrink-0"
          style={{ 
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#f87171',
            borderBottom: '1px solid rgba(239, 68, 68, 0.2)'
          }}
        >
          {summaryError}
        </div>
      )}

      {/* 选中的代码预览 */}
      <div 
        className="px-4 py-2 flex-shrink-0"
        style={{ 
          background: 'var(--bg-primary)',
          borderBottom: '1px solid rgba(14, 165, 233, 0.15)'
        }}
      >
        <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>选中的代码：</div>
        <pre 
          className="text-xs p-2 rounded-lg overflow-auto font-mono"
          style={{ 
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            maxHeight: '80px',
            border: '1px solid rgba(14, 165, 233, 0.1)'
          }}
        >
          {selectionText.length > 300 ? selectionText.slice(0, 300) + '...' : selectionText}
        </pre>
      </div>

      {/* 提示词选择 */}
      {!localConversation && (
        <div 
          className="flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(14, 165, 233, 0.15)' }}
        >
          <button
            onClick={() => setShowPrompts(!showPrompts)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span>选择提示词模板 ({localPrompts.length})</span>
            {showPrompts ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          
          {showPrompts && (
            <div className="px-3 pb-2 max-h-28 overflow-y-auto">
              {localPrompts.map((prompt) => (
                <button
                  key={prompt.id}
                  onClick={() => handleSelectPrompt(prompt.template)}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg mb-1 transition-all"
                  style={{ 
                    color: 'var(--text-secondary)',
                    background: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(14, 165, 233, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span className="font-medium">{prompt.name}</span>
                  {prompt.isBuiltin && (
                    <span className="ml-1" style={{ color: 'var(--text-muted)' }}>(内置)</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 对话内容 */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {localConversation && (
          <div className="space-y-4">
            {/* 用户问题 */}
            <div className="flex justify-end">
              <div 
                className="max-w-[85%] px-4 py-2 rounded-2xl rounded-br-sm text-sm"
                style={{ 
                  background: 'rgba(14, 165, 233, 0.2)',
                  color: 'var(--text-primary)',
                  border: '1px solid rgba(14, 165, 233, 0.3)'
                }}
              >
                {localConversation.question}
              </div>
            </div>
            
            {/* AI 回答 */}
            {(localConversation.answer || localConversation.isStreaming) && (
              <div className="flex justify-start">
                <div 
                  className="max-w-[95%] px-4 py-3 rounded-2xl rounded-bl-sm text-sm"
                  style={{ 
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '1px solid rgba(14, 165, 233, 0.2)'
                  }}
                >
                  <MarkdownRenderer content={localConversation.answer} />
                  {localConversation.isStreaming && (
                    <span 
                      className="inline-block w-2 h-4 ml-1 animate-pulse"
                      style={{ background: 'var(--sky-primary)' }}
                    ></span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 输入框 */}
      <div 
        className="p-3 flex-shrink-0"
        style={{ 
          background: 'var(--bg-primary)',
          borderTop: '1px solid rgba(14, 165, 233, 0.2)'
        }}
      >
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={localConversation?.isStreaming}
            placeholder={localConversation ? "继续提问..." : "输入问题或选择模板..."}
            className="sky-input flex-1"
          />
          <button
            onClick={handleSend}
            disabled={localConversation?.isStreaming || input.trim() === ''}
            className="interactive-circle"
            style={{
              opacity: localConversation?.isStreaming || input.trim() === '' ? 0.5 : 1,
              cursor: localConversation?.isStreaming || input.trim() === '' ? 'not-allowed' : 'pointer'
            }}
          >
            {localConversation?.isStreaming ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Enter 发送，ESC 关闭</span>
          {localConversation?.isStreaming && (
            <span className="text-xs" style={{ color: 'var(--sky-primary)' }}>思考中...</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default InlineChat;
