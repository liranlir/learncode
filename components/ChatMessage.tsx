import React from 'react';
import { GlobalMessage } from '../lib/types';
import { FileCode, Globe, User } from 'lucide-react';

interface ChatMessageProps {
  message: GlobalMessage;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const timestamp = new Date(message.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const fileName = message.filePath?.split('/').pop();

  return (
    <div className={`flex flex-col mb-3 ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[90%] p-3 rounded-lg shadow-sm ${
          isUser
            ? 'bg-green-500 text-white rounded-br-none'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
        }`}
      >
        {/* 头部信息 */}
        <div className="flex items-center justify-between text-xs mb-1 gap-3">
          <div className="flex items-center gap-1.5">
            {isUser ? <User size={12} /> : <Globe size={12} />}
            <span className="font-semibold">{isUser ? '你' : 'AI'}</span>
          </div>
          <span className="opacity-75">{timestamp}</span>
        </div>

        {/* 文件信息 */}
        {fileName && isUser && (
          <div className="flex items-center gap-1 text-xs mb-1 opacity-75">
            <FileCode size={10} />
            <span className="truncate max-w-[150px]">{fileName}</span>
          </div>
        )}

        {/* 内容 */}
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </div>
  );
};

export default ChatMessage;
