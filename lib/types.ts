export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  content?: string;
  language?: string;
  handle?: FileSystemHandle;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty?: boolean;
}

// 局部对话（临时，不持久化）
export interface LocalConversation {
  id: string;
  question: string;
  answer: string;
  isStreaming: boolean;
  timestamp: number;
}

// 全局对话（持久化到历史）
export interface GlobalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  filePath?: string;
  timestamp: number;
}

// 知识库条目 - 包含 AI 总结
export interface KnowledgeEntry {
  id: string;
  concept: string;      // AI 总结的概念名称（2-8字）
  summary: string;      // AI 总结的核心内容（1-2句话）
  context: string;      // 原始代码/上下文
  filePath?: string;
  lineRange?: { start: number; end: number };
  mode: 'local' | 'global';
  timestamp: number;
  tags?: string[];      // AI 提取的标签
}

export interface AppState {
  // 文件系统
  rootHandle: FileSystemDirectoryHandle | null;
  fileTree: FileNode | null;
  openFiles: OpenFile[];
  activeFilePath: string | null;
  
  // 选区状态
  selection: {
    startLine: number;
    endLine: number;
    text: string;
    filePath: string;
  } | null;
  
  // 模式状态
  currentMode: 'local' | 'global';
  
  // 局部对话（临时，每次新选区清空）
  localConversation: LocalConversation | null;
  
  // 全局对话历史（持久化）
  globalMessages: GlobalMessage[];
  
  // 知识库（共享，跨会话持久化）
  knowledgeList: KnowledgeEntry[];
  
  // Actions
  setRootHandle: (handle: FileSystemDirectoryHandle | null) => void;
  setFileTree: (tree: FileNode | null) => void;
  openFile: (file: OpenFile) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  updateFileContent: (path: string, content: string) => void;
  setSelection: (sel: AppState['selection']) => void;
  clearSelection: () => void;
  
  // 局部对话
  setLocalConversation: (conv: LocalConversation | null) => void;
  updateLocalAnswer: (answer: string, isStreaming: boolean) => void;
  clearLocalConversation: () => void;
  
  // 全局对话
  addGlobalMessage: (msg: Omit<GlobalMessage, 'id' | 'timestamp'>) => void;
  clearGlobalMessages: () => void;
  
  // 知识库 - 使用 AI 总结的完整信息
  addKnowledge: (
    concept: string,
    summary: string,
    context: string,
    filePath?: string,
    lineRange?: { start: number; end: number },
    tags?: string[]
  ) => void;
  updateKnowledge: (id: string, patch: Partial<Omit<KnowledgeEntry, 'id' | 'timestamp'>>) => void;
  removeKnowledge: (id: string) => void;
  setKnowledgeList: (entries: KnowledgeEntry[]) => void;
}

// 文件语言检测
export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'py': 'python',
    'java': 'java',
    'go': 'go',
    'rs': 'rust',
    'cpp': 'cpp',
    'c': 'c',
    'h': 'cpp',
    'hpp': 'cpp',
    'json': 'json',
    'md': 'markdown',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'sql': 'sql',
    'sh': 'shell',
    'bash': 'shell',
    'vue': 'vue',
    'svelte': 'svelte',
  };
  return langMap[ext] || 'plaintext';
}
