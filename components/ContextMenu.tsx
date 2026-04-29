'use client';

import React, { useEffect, useRef } from 'react';
import { Bookmark, Lightbulb, MessageSquare } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAsk: () => void;
  onExplain: () => void;
  onBookmark: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onClose,
  onAsk,
  onExplain,
  onBookmark,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const adjustedX = Math.min(x, window.innerWidth - 190);
  const adjustedY = Math.min(y, window.innerHeight - 170);

  const itemClass = 'context-menu-item';

  return (
    <div ref={menuRef} className="context-menu" style={{ left: adjustedX, top: adjustedY }}>
      <div className="context-menu-title">对选中代码</div>

      <button
        onClick={() => {
          onAsk();
          onClose();
        }}
        className={itemClass}
      >
        <MessageSquare size={15} />
        提问
      </button>

      <button
        onClick={() => {
          onExplain();
          onClose();
        }}
        className={itemClass}
      >
        <Lightbulb size={15} />
        解释
      </button>

      <button
        onClick={() => {
          onBookmark();
          onClose();
        }}
        className={itemClass}
      >
        <Bookmark size={15} />
        收藏为知识点
      </button>
    </div>
  );
};

export default ContextMenu;
