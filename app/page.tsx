'use client';

import { useState } from 'react';
import Explorer from '@/components/Explorer';
import CodeEditor from '@/components/CodeEditor';
import Sidebar from '@/components/Sidebar';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function Home() {
  const [selectedLocalPrompt, setSelectedLocalPrompt] = useState('');
  const [selectedGlobalPrompt, setSelectedGlobalPrompt] = useState('');
  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(420);

  const startResize = (side: 'left' | 'right') => (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startLeft = leftWidth;
    const startRight = rightWidth;

    const handleMove = (moveEvent: PointerEvent) => {
      if (side === 'left') {
        setLeftWidth(clamp(startLeft + moveEvent.clientX - startX, 220, 360));
      } else {
        setRightWidth(clamp(startRight - moveEvent.clientX + startX, 360, 560));
      }
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  return (
    <div className="min-h-[100dvh] flex app-shell workbench-shell">
      <div className="workbench-panel project-column" style={{ width: leftWidth }}>
        <Explorer
          selectedLocalPrompt={selectedLocalPrompt}
          selectedGlobalPrompt={selectedGlobalPrompt}
          onSelectLocalPrompt={setSelectedLocalPrompt}
          onSelectGlobalPrompt={setSelectedGlobalPrompt}
        />
      </div>

      <div className="resize-handle" onPointerDown={startResize('left')} title="拖动调整项目栏宽度" />

      <div className="editor-stage">
        <CodeEditor selectedLocalPrompt={selectedLocalPrompt} />
      </div>

      <div className="resize-handle" onPointerDown={startResize('right')} title="拖动调整学习栏宽度" />

      <div className="workbench-panel assistant-column" style={{ width: rightWidth }}>
        <Sidebar selectedGlobalPrompt={selectedGlobalPrompt} />
      </div>
    </div>
  );
}
