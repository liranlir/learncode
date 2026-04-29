'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  Camera,
  ClipboardCheck,
  FolderOpen,
  Loader2,
  MessageSquare,
  Send,
  Settings,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import GlobalChatMessage from './GlobalChatMessage';
import FullHistoryPanel from './FullHistoryPanel';
import KnowledgeDetail from './KnowledgeDetail';
import AiSettingsPanel from './AiSettingsPanel';
import KnowledgeQuiz from './KnowledgeQuiz';
import CameraCodePanel from './CameraCodePanel';
import { consumeChatStream, getReadableAiError, streamChat } from '../lib/ai';
import { isAiConfigured } from '../lib/aiSettings';
import { loadFileTree, openDirectory } from '../hooks/useFileSystem';
import { KnowledgeEntry } from '../lib/types';

interface SidebarProps {
  selectedGlobalPrompt: string;
}

type Panel = 'ask' | 'scan' | 'knowledge' | 'quiz' | 'settings';

const tabs: Array<{ id: Panel; label: string; icon: React.ElementType }> = [
  { id: 'ask', label: 'Ask', icon: MessageSquare },
  { id: 'scan', label: 'Scan', icon: Camera },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { id: 'quiz', label: 'Quiz', icon: ClipboardCheck },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const Sidebar: React.FC<SidebarProps> = ({ selectedGlobalPrompt }) => {
  const {
    globalMessages,
    addGlobalMessage,
    clearGlobalMessages,
    addKnowledge,
    knowledgeList,
    openFiles,
    activeFilePath,
    setRootHandle,
    setFileTree,
  } = useAppStore();

  const [activePanel, setActivePanel] = useState<Panel>('ask');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [mounted, setMounted] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeEntry | null>(null);
  const [savedAnswerIds, setSavedAnswerIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    setAiReady(isAiConfigured());
  }, []);

  const activeFile = openFiles.find((file) => file.path === activeFilePath);
  const hasFiles = openFiles.length > 0;
  const recentKnowledge = [...knowledgeList].slice(-8).reverse();

  const buildContext = useCallback(
    () => openFiles.map((file) => ({ path: file.path, content: file.content })),
    [openFiles]
  );

  const handleOpenFolder = async () => {
    const handle = await openDirectory();
    if (handle) {
      setRootHandle(handle);
      setFileTree(await loadFileTree(handle));
    }
  };

  const handleUsePrompt = () => {
    if (selectedGlobalPrompt) setInput(selectedGlobalPrompt);
  };

  const handleSendMessage = async () => {
    if (input.trim() === '' || isLoading || !aiReady || !hasFiles) return;

    const question = input.trim();
    addGlobalMessage({
      role: 'user',
      content: question,
      filePath: activeFile?.path,
    });

    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    try {
      const stream = await streamChat({
        code: activeFile?.content || '',
        fullContext: buildContext(),
        question,
        mode: 'global',
        knowledgeList: knowledgeList.map((entry) => ({ concept: entry.concept, mode: entry.mode })),
      });

      const fullContent = await consumeChatStream(stream, setStreamingContent);
      if (fullContent) {
        addGlobalMessage({
          role: 'assistant',
          content: fullContent,
          filePath: activeFile?.path,
        });
      }
    } catch (error) {
      addGlobalMessage({
        role: 'assistant',
        content: `请求出错：${getReadableAiError(error)}`,
        filePath: activeFile?.path,
      });
    } finally {
      setIsLoading(false);
      setStreamingContent('');
    }
  };

  const getAnswerQuestion = (answerIndex: number) => {
    for (let index = answerIndex - 1; index >= 0; index -= 1) {
      if (globalMessages[index]?.role === 'user') return globalMessages[index].content;
    }
    return '代码讲解';
  };

  const makeKnowledgeTitle = (question: string, answer: string) => {
    const heading = answer.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim();
    if (heading) return heading.slice(0, 18);

    const compactQuestion = question.replace(/\s+/g, ' ').trim();
    if (compactQuestion) return compactQuestion.slice(0, 18);

    return 'AI 讲解';
  };

  const makeKnowledgeSummary = (answer: string) =>
    answer
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[#>*_`-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180) || 'AI 对代码的讲解。';

  const saveAnswerAsKnowledge = (answer: typeof globalMessages[number], answerIndex: number) => {
    if (answer.role !== 'assistant' || savedAnswerIds.has(answer.id)) return;

    const question = getAnswerQuestion(answerIndex);
    const relatedFile = openFiles.find((file) => file.path === answer.filePath) || activeFile;
    const context = [
      relatedFile?.content ? `代码:\n${relatedFile.content}` : '',
      `问题:\n${question}`,
      `回答:\n${answer.content}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    addKnowledge(
      makeKnowledgeTitle(question, answer.content),
      makeKnowledgeSummary(answer.content),
      context,
      answer.filePath || relatedFile?.path,
      undefined,
      ['AI讲解']
    );
    setSavedAnswerIds((current) => new Set(current).add(answer.id));
  };

  if (showHistory) {
    return <FullHistoryPanel onClose={() => setShowHistory(false)} />;
  }

  if (selectedKnowledge) {
    return <KnowledgeDetail knowledge={selectedKnowledge} onClose={() => setSelectedKnowledge(null)} />;
  }

  if (!mounted) {
    return (
      <div className="side-workbench side-loading">
        <span>加载中...</span>
      </div>
    );
  }

  const renderAskPanel = () => (
    <>
      <div className="side-panel-body">
        {!aiReady && (
          <div className="status-strip">
            <div>
              <strong>需要 API Key</strong>
              <span>填写后才能开始项目问答。</span>
            </div>
            <button onClick={() => setActivePanel('settings')}>设置</button>
          </div>
        )}

        {!hasFiles && globalMessages.length === 0 && (
          <div className="empty-panel side-empty">
            <MessageSquare size={22} />
            <p>还没有打开代码</p>
            <span>打开项目文件夹后，可以询问入口文件、调用关系和模块职责。</span>
            <button onClick={handleOpenFolder} className="quiet-button">
              <FolderOpen size={14} />
              打开文件夹
            </button>
          </div>
        )}

        {hasFiles && globalMessages.length === 0 && !isLoading && (
          <div className="empty-panel side-empty">
            <MessageSquare size={22} />
            <p>可以问整个项目了</p>
            <span>例如：入口文件在哪里？这个模块怎么运行？我应该先看哪几个文件？</span>
          </div>
        )}

        {(globalMessages.length > 0 || isLoading) && (
          <div className="assistant-thread">
            {globalMessages.slice(-6).map((message) => {
              const messageIndex = globalMessages.findIndex((item) => item.id === message.id);
              return (
                <GlobalChatMessage
                  key={message.id}
                  message={message}
                  canSave={message.role === 'assistant'}
                  saved={savedAnswerIds.has(message.id)}
                  onSaveKnowledge={() => saveAnswerAsKnowledge(message, messageIndex)}
                />
              );
            })}

            {isLoading && streamingContent && (
              <div className="streaming-answer">
                <span>AI</span>
                <p>{streamingContent}</p>
              </div>
            )}

            {isLoading && !streamingContent && (
              <div className="loading-row">
                <Loader2 className="animate-spin" size={16} />
                <span>AI 正在阅读项目...</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="chat-composer">
        <div className="composer-actions">
          {selectedGlobalPrompt && <button onClick={handleUsePrompt}>使用模板</button>}
          {globalMessages.length > 0 && <button onClick={() => setShowHistory(true)}>历史</button>}
          {globalMessages.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('确定清空所有全局对话吗？')) clearGlobalMessages();
              }}
            >
              <Trash2 size={12} />
              清空
            </button>
          )}
        </div>
        <div className="composer-input">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isLoading || !hasFiles || !aiReady}
            placeholder={!aiReady ? '先填写 API Key...' : !hasFiles ? '先打开文件夹...' : '问项目结构、入口文件、模块关系...'}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || input.trim() === '' || !hasFiles || !aiReady}
            title="发送"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </>
  );

  const renderKnowledgePanel = () => (
    <div className="side-panel-body">
      <div className="panel-heading">
        <div>
          <h3>知识库</h3>
          <p>{knowledgeList.length} 个知识点</p>
        </div>
        {knowledgeList.length > 0 && <button onClick={() => setShowHistory(true)}>管理</button>}
      </div>

      {recentKnowledge.length === 0 ? (
        <div className="empty-panel side-empty">
          <BookOpen size={22} />
          <p>还没有知识点</p>
          <span>圈选代码并保存知识点后，这里会变成你的复习材料。</span>
        </div>
      ) : (
        <div className="knowledge-list">
          {recentKnowledge.map((entry) => (
            <button key={entry.id} onClick={() => setSelectedKnowledge(entry)}>
              <strong>{entry.concept}</strong>
              <span>{entry.summary}</span>
              <small>{entry.tags?.slice(0, 3).map((tag) => `#${tag}`).join(' ')}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderPanel = () => {
    if (activePanel === 'settings') {
      return (
        <AiSettingsPanel
          onClose={() => setActivePanel('ask')}
          onSaved={() => setAiReady(isAiConfigured())}
        />
      );
    }

    if (activePanel === 'quiz') {
      return (
        <KnowledgeQuiz
          embedded
          knowledgeList={knowledgeList}
          onClose={() => setActivePanel('ask')}
          onReviewKnowledge={(knowledge) => setSelectedKnowledge(knowledge)}
        />
      );
    }

    if (activePanel === 'scan') {
      return (
        <CameraCodePanel
          onGoSettings={() => setActivePanel('settings')}
          onReadyToAsk={(question) => {
            setInput(question);
            setActivePanel('ask');
          }}
        />
      );
    }

    if (activePanel === 'knowledge') return renderKnowledgePanel();
    return renderAskPanel();
  };

  return (
    <div className="side-workbench">
      <header className="side-header">
        <div>
          <span className="side-kicker">LearnCode</span>
          <h2>学习助手</h2>
        </div>
        <div className={hasFiles ? 'side-status ready' : 'side-status'}>
          <span />
          {hasFiles ? 'Project' : 'Idle'}
        </div>
      </header>

      <nav className="side-tabs" aria-label="学习面板">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count = tab.id === 'knowledge' ? knowledgeList.length : tab.id === 'ask' ? globalMessages.length : 0;
          return (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id)}
              data-active={activePanel === tab.id}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              {count > 0 && <small>{count}</small>}
            </button>
          );
        })}
      </nav>

      <main className="side-panel">{renderPanel()}</main>
    </div>
  );
};

export default Sidebar;
