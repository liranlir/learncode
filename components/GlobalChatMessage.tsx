'use client';

import React from 'react';
import { FileCode, Globe, User } from 'lucide-react';
import { GlobalMessage } from '../lib/types';
import MarkdownRenderer from './MarkdownRenderer';

interface GlobalChatMessageProps {
  message: GlobalMessage;
}

const GlobalChatMessage: React.FC<GlobalChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const fileName = message.filePath?.split('/').pop();

  return (
    <article className={isUser ? 'chat-message user' : 'chat-message assistant'}>
      <div className="chat-bubble">
        <header className="chat-meta">
          <div>
            {isUser ? <User size={12} /> : <Globe size={12} />}
            <strong>{isUser ? '你' : 'AI'}</strong>
            <span>Global</span>
          </div>
          <time>{timestamp}</time>
        </header>

        {fileName && isUser && (
          <div className="chat-file">
            <FileCode size={11} />
            <span>{fileName}</span>
          </div>
        )}

        <div className="chat-content">
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>
      </div>
    </article>
  );
};

export default GlobalChatMessage;
