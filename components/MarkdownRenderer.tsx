'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 代码块
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <div className="my-2 rounded-lg overflow-hidden">
                <div className="bg-gray-700 dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-300 flex items-center justify-between">
                  <span>{match[1]}</span>
                </div>
                <pre className="bg-gray-800 dark:bg-gray-900 p-3 overflow-x-auto">
                  <code className="text-sm text-gray-200 font-mono">{children}</code>
                </pre>
              </div>
            ) : (
              <code
                className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm font-mono text-purple-600 dark:text-purple-400"
                {...props}
              >
                {children}
              </code>
            );
          },
          // 段落
          p({ children }) {
            return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>;
          },
          // 标题
          h1({ children }) {
            return <h1 className="text-xl font-bold mb-3 mt-4 text-gray-900 dark:text-white">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-lg font-bold mb-2 mt-3 text-gray-800 dark:text-gray-100">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-base font-semibold mb-2 mt-3 text-gray-800 dark:text-gray-200">{children}</h3>;
          },
          // 列表
          ul({ children }) {
            return <ul className="list-disc list-inside mb-3 space-y-1 ml-2">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-3 space-y-1 ml-2">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-gray-700 dark:text-gray-300">{children}</li>;
          },
          // 引用
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-blue-400 pl-3 py-1 my-3 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500">
                {children}
              </blockquote>
            );
          },
          // 表格
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3">
                <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-gray-100 dark:bg-gray-800">{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                {children}
              </td>
            );
          },
          // 链接
          a({ children, href }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {children}
              </a>
            );
          },
          // 分割线
          hr() {
            return <hr className="my-4 border-gray-300 dark:border-gray-600" />;
          },
          // 强调
          strong({ children }) {
            return <strong className="font-bold text-gray-900 dark:text-white">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic text-gray-800 dark:text-gray-200">{children}</em>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
