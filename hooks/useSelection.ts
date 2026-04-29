'use client';

import { useEffect, useState, RefObject, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { useAppStore } from '../lib/store';

interface SelectionInfo {
  startLine: number;
  endLine: number;
  text: string;
  filePath: string;
}

interface UseSelectionReturn {
  selectionPosition: { top: number; left: number } | null;
  refreshSelection: () => void;
}

export function useSelection(
  editorRef: RefObject<monaco.editor.IStandaloneCodeEditor | null>,
  filePath: string | null
): UseSelectionReturn {
  const [selectionPosition, setSelectionPosition] = useState<{ top: number; left: number } | null>(null);
  const { setSelection, clearSelection, activeFilePath } = useAppStore();

  const refreshSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || !filePath) {
      setSelectionPosition(null);
      return;
    }

    const selection = editor.getSelection();
    const model = editor.getModel();

    if (selection && model && !selection.isEmpty()) {
      const selectedText = model.getValueInRange(selection);
      if (selectedText.trim().length > 0) {
        const startLine = selection.startLineNumber;
        const endLine = selection.endLineNumber;

        setSelection({
          startLine,
          endLine,
          text: selectedText,
          filePath,
        });

        // 计算浮动按钮位置
        const endPosition = editor.getScrolledVisiblePosition({
          lineNumber: selection.endLineNumber,
          column: selection.endColumn,
        });

        if (endPosition) {
          setSelectionPosition({
            top: endPosition.top - 40,
            left: endPosition.left + 20,
          });
        }
        return;
      }
    }

    // 如果没有有效选区
    clearSelection();
    setSelectionPosition(null);
  }, [editorRef, filePath, setSelection, clearSelection]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // 监听选区变化（带防抖）
    let timeoutId: NodeJS.Timeout;
    
    const disposable = editor.onDidChangeCursorSelection(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        refreshSelection();
      }, 200);
    });

    // 监听编辑器失去焦点
    const blurDisposable = editor.onDidBlurEditorWidget(() => {
      // 延迟清除，让用户有时间点击浮动按钮
      setTimeout(() => {
        // 不自动清除，让用户主动关闭
      }, 300);
    });

    return () => {
      clearTimeout(timeoutId);
      disposable.dispose();
      blurDisposable.dispose();
    };
  }, [editorRef, refreshSelection]);

  // 当切换文件时清除选区
  useEffect(() => {
    clearSelection();
    setSelectionPosition(null);
  }, [filePath, clearSelection]);

  return { selectionPosition, refreshSelection };
}
