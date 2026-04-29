'use client';

import { useState, useEffect } from 'react';
import { FileNode, detectLanguage } from '../lib/types';

// 检查浏览器是否支持 File System Access API
export function isFileSystemSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'showDirectoryPicker' in window && typeof window.showDirectoryPicker === 'function';
}

// Hook: 检测浏览器支持
export function useFileSystemSupport() {
  const [isSupported, setIsSupported] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    setIsSupported(isFileSystemSupported());
    setIsReady(true);
  }, []);
  
  return { isSupported, isReady };
}

// 打开文件夹选择器
export async function openDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof window === 'undefined') return null;
  
  try {
    const handle = await window.showDirectoryPicker();
    return handle;
  } catch (err) {
    console.log('Directory picker cancelled or failed:', err);
    return null;
  }
}

// 递归构建文件树
async function buildFileTree(
  handle: FileSystemDirectoryHandle,
  path: string = ''
): Promise<FileNode> {
  const node: FileNode = {
    name: handle.name,
    path: path || handle.name,
    type: 'directory',
    handle,
    children: [],
  };

  const children: FileNode[] = [];
  
  for await (const [name, childHandle] of handle.entries()) {
    const childPath = path ? `${path}/${name}` : name;
    
    if (childHandle.kind === 'directory') {
      if (name === 'node_modules' || name === '.git' || name === '.next' || name === 'dist' || name === 'build') {
        continue;
      }
      const childNode = await buildFileTree(childHandle as FileSystemDirectoryHandle, childPath);
      children.push(childNode);
    } else {
      children.push({
        name,
        path: childPath,
        type: 'file',
        handle: childHandle,
        language: detectLanguage(name),
      });
    }
  }

  children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  node.children = children;
  return node;
}

// 读取文件内容
export async function readFileContent(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return await file.text();
}

// 加载整个文件树
export async function loadFileTree(handle: FileSystemDirectoryHandle): Promise<FileNode> {
  return await buildFileTree(handle);
}

// 检查是否为文本文件
export function isTextFile(filename: string): boolean {
  const textExtensions = [
    'ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'h', 'hpp',
    'json', 'md', 'html', 'css', 'scss', 'less', 'yaml', 'yml', 'xml', 'sql',
    'sh', 'bash', 'vue', 'svelte', 'txt', 'ini', 'conf', 'config', 'log'
  ];
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return textExtensions.includes(ext);
}

// ============ 备用方案：文件上传 ============

// 从 File 对象创建 OpenFile
export async function createOpenFileFromUpload(file: File): Promise<{
  name: string;
  path: string;
  content: string;
  language: string;
}> {
  const content = await file.text();
  return {
    name: file.name,
    path: file.name,
    content,
    language: detectLanguage(file.name),
  };
}

// 处理多个文件上传
export async function handleFileUpload(
  files: FileList | null
): Promise<Array<{ name: string; path: string; content: string; language: string }>> {
  if (!files || files.length === 0) return [];
  
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (isTextFile(file.name)) {
      const openFile = await createOpenFileFromUpload(file);
      results.push(openFile);
    }
  }
  return results;
}
