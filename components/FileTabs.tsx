'use client';

import React from 'react';
import { FileCode, X } from 'lucide-react';
import { useAppStore } from '../lib/store';

const FileTabs: React.FC = () => {
  const { openFiles, activeFilePath, setActiveFile, closeFile } = useAppStore();

  if (openFiles.length === 0) {
    return (
      <div className="editor-tabs">
        <span className="editor-tabs-empty">从左侧文件树选择文件打开</span>
      </div>
    );
  }

  return (
    <div className="editor-tabs">
      {openFiles.map((file) => {
        const isActive = file.path === activeFilePath;
        return (
          <button
            key={file.path}
            onClick={() => setActiveFile(file.path)}
            className={isActive ? 'editor-tab active' : 'editor-tab'}
          >
            <FileCode size={14} />
            <span>{file.name}</span>
            {file.isDirty && <span className="dirty-dot" />}
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                closeFile(file.path);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  closeFile(file.path);
                }
              }}
              className="tab-close"
            >
              <X size={12} />
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default FileTabs;
