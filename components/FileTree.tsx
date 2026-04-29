'use client';

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileCode, FileText } from 'lucide-react';
import { FileNode } from '../lib/types';
import { useAppStore } from '../lib/store';
import { readFileContent, isTextFile } from '../hooks/useFileSystem';

interface FileTreeNodeProps {
  node: FileNode;
  level: number;
  onFileClick: (node: FileNode) => void;
  activePath: string | null;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, level, onFileClick, activePath }) => {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const isActive = node.path === activePath;

  const handleClick = async () => {
    if (node.type === 'directory') {
      setIsExpanded(!isExpanded);
    } else {
      if (isTextFile(node.name)) {
        onFileClick(node);
      }
    }
  };

  const paddingLeft = level * 8 + 4;

  if (node.type === 'directory') {
    return (
      <div>
        <div
          onClick={handleClick}
          className="file-tree-item"
          style={{ 
            paddingLeft: `${paddingLeft}px`,
            background: isExpanded ? 'rgba(14, 165, 233, 0.08)' : 'rgba(255, 255, 255, 0.02)',
            boxShadow: isExpanded 
              ? '0 2px 8px rgba(14, 165, 233, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)' 
              : '0 1px 3px rgba(0, 0, 0, 0.3)',
          }}
        >
          {isExpanded ? (
            <ChevronDown size={14} style={{ color: 'var(--sky-primary)' }} className="mr-0.5 flex-shrink-0" />
          ) : (
            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} className="mr-0.5 flex-shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen size={14} style={{ color: 'var(--sky-secondary)' }} className="mr-1 flex-shrink-0" />
          ) : (
            <Folder size={14} style={{ color: 'var(--text-muted)' }} className="mr-1 flex-shrink-0" />
          )}
          <span 
            className="text-xs truncate"
            style={{ color: isExpanded ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          >
            {node.name}
          </span>
        </div>
        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                level={level + 1}
                onFileClick={onFileClick}
                activePath={activePath}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const canOpen = isTextFile(node.name);
  
  return (
    <div
      onClick={canOpen ? handleClick : undefined}
      className="file-tree-item"
      style={{
        paddingLeft: `${paddingLeft + 16}px`,
        background: isActive 
          ? 'rgba(14, 165, 233, 0.15)' 
          : 'rgba(255, 255, 255, 0.02)',
        boxShadow: isActive 
          ? '0 0 12px rgba(14, 165, 233, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08)' 
          : '0 1px 3px rgba(0, 0, 0, 0.3)',
        border: isActive ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid transparent',
        cursor: canOpen ? 'pointer' : 'not-allowed',
        opacity: canOpen ? 1 : 0.5,
      }}
      title={canOpen ? '点击打开' : '不支持打开此文件类型'}
    >
      {node.name.match(/\.(ts|tsx|js|jsx|py|java|go|rs|vue|svelte)$/i) ? (
        <FileCode size={14} style={{ color: 'var(--sky-primary)' }} className="mr-1 flex-shrink-0" />
      ) : (
        <FileText size={14} style={{ color: 'var(--text-muted)' }} className="mr-1 flex-shrink-0" />
      )}
      <span 
        className="text-xs truncate"
        style={{ 
          color: isActive ? 'var(--sky-secondary)' : (canOpen ? 'var(--text-secondary)' : 'var(--text-muted)'),
        }}
      >
        {node.name}
      </span>
    </div>
  );
};

interface FileTreeProps {
  onFileSelect?: (path: string) => void;
}

const FileTree: React.FC<FileTreeProps> = ({ onFileSelect }) => {
  const { fileTree, openFile, setActiveFile, activeFilePath } = useAppStore();

  const handleFileClick = async (node: FileNode) => {
    if (node.type !== 'file') return;

    if (node.handle) {
      try {
        const content = await readFileContent(node.handle as FileSystemFileHandle);
        const file = {
          path: node.path,
          name: node.name,
          content,
          language: node.language || 'plaintext',
        };
        openFile(file);
        onFileSelect?.(node.path);
      } catch (err) {
        console.error('Failed to read file:', err);
      }
    } else {
      const file = {
        path: node.path,
        name: node.name,
        content: node.content || '',
        language: node.language || 'plaintext',
      };
      openFile(file);
      onFileSelect?.(node.path);
    }
  };

  if (!fileTree) {
    return (
      <div className="p-2 text-center">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          打开文件夹或上传文件
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full py-1">
      <FileTreeNode
        node={fileTree}
        level={0}
        onFileClick={handleFileClick}
        activePath={activeFilePath}
      />
    </div>
  );
};

export default FileTree;
