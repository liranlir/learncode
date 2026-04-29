'use client';

import React from 'react';
import { Microscope, Globe, FileCode } from 'lucide-react';
import { useAppStore } from '../lib/store';

const ModeIndicator: React.FC = () => {
  const { currentMode, activeFilePath, openFiles } = useAppStore();

  const isLocal = currentMode === 'local';
  const activeFile = openFiles.find(f => f.path === activeFilePath);

  return (
    <div className="space-y-2">
      {/* 当前文件 */}
      {activeFile && (
        <div 
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ 
            background: 'var(--bg-tertiary)',
            border: '1px solid rgba(14, 165, 233, 0.2)'
          }}
        >
          <FileCode size={14} style={{ color: 'var(--sky-primary)' }} />
          <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
            {activeFile.name}
          </span>
        </div>
      )}

      {/* 模式指示器 - 胶囊形 */}
      <div 
        className="flex items-center justify-between px-3 py-2 rounded-xl"
        style={{ 
          background: 'var(--bg-tertiary)',
          border: '1px solid rgba(14, 165, 233, 0.2)'
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: isLocal 
                ? 'rgba(14, 165, 233, 0.2)' 
                : 'rgba(14, 165, 233, 0.15)',
              color: isLocal ? 'var(--sky-secondary)' : 'var(--sky-primary)',
              border: `1px solid ${isLocal ? 'rgba(14, 165, 233, 0.5)' : 'rgba(14, 165, 233, 0.3)'}`,
              boxShadow: isLocal ? '0 0 10px rgba(14, 165, 233, 0.2)' : 'none'
            }}
          >
            {isLocal ? <Microscope size={14} /> : <Globe size={14} />}
            {isLocal ? 'Local Mode' : 'Global Mode'}
          </div>
        </div>
      </div>

      {/* 模式说明 */}
      <div className="px-1 space-y-1">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {isLocal ? (
            <>
              <span style={{ color: 'var(--sky-primary)' }}>●</span> 右键圈选代码 → 提问
            </>
          ) : (
            <>
              <span style={{ color: 'var(--sky-primary)' }}>●</span> 在下方输入框提问
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default ModeIndicator;
