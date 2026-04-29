'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, FileUp, FolderOpen, RefreshCw } from 'lucide-react';
import { useAppStore } from '../lib/store';
import FileTree from './FileTree';
import PromptManager from './PromptManager';
import {
  handleFileUpload,
  isFileSystemSupported,
  loadFileTree,
  openDirectory,
} from '../hooks/useFileSystem';

interface ExplorerProps {
  selectedLocalPrompt: string;
  selectedGlobalPrompt: string;
  onSelectLocalPrompt: (template: string) => void;
  onSelectGlobalPrompt: (template: string) => void;
}

const Explorer: React.FC<ExplorerProps> = ({
  selectedLocalPrompt,
  selectedGlobalPrompt,
  onSelectLocalPrompt,
  onSelectGlobalPrompt,
}) => {
  const {
    rootHandle,
    setRootHandle,
    setFileTree,
    openFiles,
    activeFilePath,
    setActiveFile,
    openFile,
  } = useAppStore();

  const [mounted, setMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleOpenFolder = async () => {
    const handle = await openDirectory();
    if (handle) {
      setRootHandle(handle);
      setFileTree(await loadFileTree(handle));
    }
  };

  const handleRefresh = async () => {
    if (rootHandle) {
      setFileTree(await loadFileTree(rootHandle));
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = await handleFileUpload(event.target.files);
    files.forEach((file) => openFile(file));
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const files = await handleFileUpload(event.dataTransfer.files);
    files.forEach((file) => openFile(file));
  };

  if (!mounted) {
    return (
      <div className="project-pane loading">
        <span>加载中...</span>
      </div>
    );
  }

  return (
    <div
      className="project-pane"
      data-dragging={isDragging}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      <header className="project-header">
        <div>
          <span>Project</span>
          <h2>{rootHandle?.name || '未打开项目'}</h2>
        </div>
        <div className="project-actions">
          {rootHandle && (
            <button onClick={handleRefresh} title="刷新文件树">
              <RefreshCw size={15} />
            </button>
          )}
          <button onClick={handleOpenFolder} title="打开文件夹">
            <FolderOpen size={15} />
          </button>
        </div>
      </header>

      {!isFileSystemSupported() && (
        <div className="project-note">当前浏览器不支持打开文件夹，可以上传单个文件。</div>
      )}

      {!rootHandle && (
        <section className="project-start">
          <button onClick={handleOpenFolder}>
            <FolderOpen size={15} />
            打开文件夹
          </button>
          <button onClick={() => fileInputRef.current?.click()}>
            <FileUp size={15} />
            上传文件
          </button>
          <p>也可以把代码文件拖到这里。</p>
        </section>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept=".ts,.tsx,.js,.jsx,.py,.java,.go,.rs,.cpp,.c,.h,.json,.md,.html,.css,.vue,.svelte,.txt"
      />

      <div className="project-tree">
        <FileTree onFileSelect={(path) => setActiveFile(path)} />
      </div>

      {openFiles.length > 0 && (
        <section className="open-files">
          <div className="open-files-title">Open {openFiles.length}</div>
          {openFiles.map((file) => (
            <button
              key={file.path}
              onClick={() => setActiveFile(file.path)}
              data-active={file.path === activeFilePath}
            >
              <span>{file.name}</span>
              {file.isDirty && <small />}
            </button>
          ))}
        </section>
      )}

      <section className="prompt-drawer">
        <button onClick={() => setShowPrompts((value) => !value)}>
          <span>提示词模板</span>
          {showPrompts ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {showPrompts && (
          <div className="prompt-drawer-body">
            <PromptManager
              mode="local"
              selectedPrompt={selectedLocalPrompt}
              onSelectPrompt={onSelectLocalPrompt}
            />
            <PromptManager
              mode="global"
              selectedPrompt={selectedGlobalPrompt}
              onSelectPrompt={onSelectGlobalPrompt}
            />
          </div>
        )}
      </section>
    </div>
  );
};

export default Explorer;
