'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Editor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useAppStore } from '../lib/store';
import FileTabs from './FileTabs';
import ContextMenu from './ContextMenu';
import InlineChat from './InlineChat';

interface CodeEditorProps {
  selectedLocalPrompt: string;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ selectedLocalPrompt }) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const { openFiles, activeFilePath, updateFileContent, setSelection, clearSelection } = useAppStore();

  const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, visible: false });
  const [inlineChat, setInlineChat] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    selectionText: string;
    startLine: number;
    endLine: number;
  } | null>(null);

  const activeFile = openFiles.find((file) => file.path === activeFilePath);

  function handleEditorWillMount(monacoInstance: typeof monaco) {
    monacoInstance.editor.defineTheme('codeLensLight', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: '', foreground: '1f2937', background: 'ffffff' },
        { token: 'comment', foreground: '7c8796', fontStyle: 'italic' },
        { token: 'keyword', foreground: '2563eb' },
        { token: 'number', foreground: 'b45309' },
        { token: 'string', foreground: '047857' },
        { token: 'type', foreground: '6d28d9' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#1f2937',
        'editorGutter.background': '#ffffff',
        'editorLineNumber.foreground': '#9aa4b2',
        'editorLineNumber.activeForeground': '#2563eb',
        'editorCursor.foreground': '#2563eb',
        'editor.selectionBackground': '#bfdbfe',
        'editor.inactiveSelectionBackground': '#e5e7eb',
        'editor.lineHighlightBackground': '#f8fafc',
        'editorIndentGuide.background1': '#e5e7eb',
        'editorIndentGuide.activeBackground1': '#93c5fd',
        'scrollbarSlider.background': '#cbd5e180',
        'scrollbarSlider.hoverBackground': '#94a3b8aa',
        'minimap.background': '#ffffff',
      },
    });
  }

  function handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor) {
    editorRef.current = editor;

    editor.onContextMenu((event) => {
      event.event.preventDefault();
      event.event.stopPropagation();

      const selection = editor.getSelection();
      const model = editor.getModel();
      if (!selection || selection.isEmpty() || !model) return;

      const selectedText = model.getValueInRange(selection);
      if (!selectedText.trim()) return;

      setSelection({
        startLine: selection.startLineNumber,
        endLine: selection.endLineNumber,
        text: selectedText,
        filePath: activeFilePath || '',
      });

      const mouseEvent = event.event as unknown as { posx?: number; posy?: number };
      setContextMenu({
        x: mouseEvent.posx || 0,
        y: mouseEvent.posy || 0,
        visible: true,
      });
    });

    editor.onMouseDown(() => {
      setContextMenu((current) => ({ ...current, visible: false }));
    });

    editor.onDidChangeCursorSelection((event) => {
      const selection = event.selection;
      const model = editor.getModel();

      if (model && !selection.isEmpty()) {
        const selectedText = model.getValueInRange(selection);
        if (selectedText.trim()) {
          setSelection({
            startLine: selection.startLineNumber,
            endLine: selection.endLineNumber,
            text: selectedText,
            filePath: activeFilePath || '',
          });
          return;
        }
      }

      clearSelection();
    });
  }

  function handleEditorChange(value: string | undefined) {
    if (value !== undefined && activeFilePath) {
      updateFileContent(activeFilePath, value);
    }
  }

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && activeFile) {
      const currentValue = editor.getValue();
      if (currentValue !== activeFile.content) {
        editor.setValue(activeFile.content);
      }
    }
  }, [activeFile]);

  const handleAsk = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = editor.getSelection();
    const model = editor.getModel();
    if (!selection || !model) return;

    const selectedText = model.getValueInRange(selection);
    const visiblePosition = editor.getScrolledVisiblePosition(selection.getStartPosition());
    const editorDom = editor.getDomNode();

    if (visiblePosition && editorDom) {
      const rect = editorDom.getBoundingClientRect();
      setInlineChat({
        visible: true,
        position: {
          x: rect.left + visiblePosition.left + 28,
          y: rect.top + visiblePosition.top + 28,
        },
        selectionText: selectedText,
        startLine: selection.startLineNumber,
        endLine: selection.endLineNumber,
      });
    }
  }, []);

  const closeInlineChat = useCallback(() => setInlineChat(null), []);

  if (!activeFile) {
    return (
      <div className="flex flex-col h-full editor-shell">
        <FileTabs />
        <div className="flex-1 flex items-center justify-center editor-empty">
          <div className="text-center">
            <p className="mb-3" style={{ color: 'var(--text-secondary)' }}>
              从左侧 Explorer 选择文件，或打开文件夹
            </p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              支持 TS / JS / Python / Java / Go / Rust / Vue / C 等代码文件
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative editor-shell">
      <FileTabs />
      <div className="flex-1 relative">
        <Editor
          height="100%"
          language={activeFile.language}
          value={activeFile.content}
          theme="codeLensLight"
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: true, scale: 0.75 },
            fontSize: 14,
            lineHeight: 22,
            fontFamily: 'JetBrains Mono, Cascadia Code, Consolas, monospace',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            folding: true,
            bracketPairColorization: { enabled: true },
            contextmenu: false,
            overviewRulerBorder: false,
            padding: { top: 12, bottom: 12 },
          }}
        />

        {contextMenu.visible && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu((current) => ({ ...current, visible: false }))}
            onAsk={handleAsk}
            onExplain={handleAsk}
            onBookmark={handleAsk}
          />
        )}

        {inlineChat?.visible && activeFilePath && (
          <InlineChat
            position={inlineChat.position}
            selectionText={inlineChat.selectionText}
            startLine={inlineChat.startLine}
            endLine={inlineChat.endLine}
            filePath={activeFilePath}
            onClose={closeInlineChat}
            selectedPrompt={selectedLocalPrompt}
          />
        )}
      </div>
    </div>
  );
};

export default CodeEditor;
