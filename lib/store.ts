import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState } from './types';

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 文件系统
      rootHandle: null,
      fileTree: null,
      openFiles: [],
      activeFilePath: null,
      
      // 选区状态
      selection: null,
      
      // 模式状态
      currentMode: 'global',
      
      // 局部对话（临时，不持久化）
      localConversation: null,
      
      // 全局对话历史
      globalMessages: [],
      
      // 知识库
      knowledgeList: [],

      // Actions
      setRootHandle: (handle) => set({ rootHandle: handle }),
      
      setFileTree: (tree) => set({ fileTree: tree }),
      
      openFile: (file) => set((state) => {
        const exists = state.openFiles.find(f => f.path === file.path);
        if (exists) {
          return { activeFilePath: file.path };
        }
        return {
          openFiles: [...state.openFiles, file],
          activeFilePath: file.path,
        };
      }),
      
      closeFile: (path) => set((state) => {
        const newOpenFiles = state.openFiles.filter(f => f.path !== path);
        let newActivePath = state.activeFilePath;
        if (state.activeFilePath === path) {
          newActivePath = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1].path : null;
        }
        return {
          openFiles: newOpenFiles,
          activeFilePath: newActivePath,
        };
      }),
      
      setActiveFile: (path) => set({ activeFilePath: path }),
      
      updateFileContent: (path, content) => set((state) => ({
        openFiles: state.openFiles.map(f =>
          f.path === path ? { ...f, content, isDirty: true } : f
        ),
      })),
      
      setSelection: (selection) => {
        set({ 
          selection,
          localConversation: null,
        });
        if (selection) {
          set({ currentMode: 'local' });
        }
      },
      
      clearSelection: () => set({ 
        selection: null, 
        currentMode: 'global',
        localConversation: null,
      }),
      
      // 局部对话
      setLocalConversation: (conv) => set({ localConversation: conv }),
      
      updateLocalAnswer: (answer, isStreaming) => set((state) => ({
        localConversation: state.localConversation 
          ? { ...state.localConversation, answer, isStreaming }
          : null,
      })),
      
      clearLocalConversation: () => set({ localConversation: null }),
      
      // 全局对话
      addGlobalMessage: (msg) => set((state) => ({
        globalMessages: [
          ...state.globalMessages,
          {
            ...msg,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
          },
        ],
      })),
      
      clearGlobalMessages: () => set({ globalMessages: [] }),
      
      // 知识库 - 使用 AI 总结的完整知识点
      addKnowledge: (concept, summary, context, filePath, lineRange, tags) =>
        set((state) => ({
          knowledgeList: [
            ...state.knowledgeList,
            {
              id: crypto.randomUUID(),
              concept,
              summary,
              context,
              filePath,
              lineRange,
              mode: state.currentMode,
              timestamp: Date.now(),
              tags: tags || [],
            },
          ],
        })),

      updateKnowledge: (id, patch) =>
        set((state) => ({
          knowledgeList: state.knowledgeList.map((entry) =>
            entry.id === id ? { ...entry, ...patch } : entry
          ),
        })),
        
      removeKnowledge: (id) =>
        set((state) => ({
          knowledgeList: state.knowledgeList.filter((k) => k.id !== id),
        })),

      setKnowledgeList: (entries) => set({ knowledgeList: entries }),
    }),
    {
      name: 'code-lens-storage',
      partialize: (state) => ({ 
        knowledgeList: state.knowledgeList,
        globalMessages: state.globalMessages,
      }),
    }
  )
);
