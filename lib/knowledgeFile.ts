'use client';

import { KnowledgeEntry } from './types';

const KNOWLEDGE_DIR = '.code-lens';
const KNOWLEDGE_FILE = 'knowledge.json';

export async function ensureKnowledgeDir(
  rootHandle: FileSystemDirectoryHandle
): Promise<FileSystemDirectoryHandle> {
  return rootHandle.getDirectoryHandle(KNOWLEDGE_DIR, { create: true });
}

export async function readKnowledgeFile(
  dirHandle: FileSystemDirectoryHandle
): Promise<KnowledgeEntry[]> {
  try {
    const fileHandle = await dirHandle.getFileHandle(KNOWLEDGE_FILE);
    const file = await fileHandle.getFile();
    const content = await file.text();
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export async function writeKnowledgeFile(
  dirHandle: FileSystemDirectoryHandle,
  entries: KnowledgeEntry[]
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(KNOWLEDGE_FILE, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(entries, null, 2));
  await writable.close();
}

export async function addKnowledgeToFile(
  rootHandle: FileSystemDirectoryHandle,
  entry: KnowledgeEntry
): Promise<void> {
  const dirHandle = await ensureKnowledgeDir(rootHandle);
  const entries = await readKnowledgeFile(dirHandle);
  entries.push(entry);
  await writeKnowledgeFile(dirHandle, entries);
}

export async function removeKnowledgeFromFile(
  rootHandle: FileSystemDirectoryHandle,
  id: string
): Promise<void> {
  const dirHandle = await ensureKnowledgeDir(rootHandle);
  const entries = await readKnowledgeFile(dirHandle);
  await writeKnowledgeFile(dirHandle, entries.filter((entry) => entry.id !== id));
}

export async function updateKnowledgeInFile(
  rootHandle: FileSystemDirectoryHandle,
  updatedEntry: KnowledgeEntry
): Promise<void> {
  const dirHandle = await ensureKnowledgeDir(rootHandle);
  const entries = await readKnowledgeFile(dirHandle);
  await writeKnowledgeFile(
    dirHandle,
    entries.map((entry) => (entry.id === updatedEntry.id ? updatedEntry : entry))
  );
}

export function exportKnowledgeToMarkdown(entries: KnowledgeEntry[]): string {
  const now = new Date().toLocaleString();
  let md = `# CodeLens 知识库\n\n`;
  md += `生成时间: ${now}\n\n`;
  md += `---\n\n`;

  entries.forEach((entry, index) => {
    md += `## ${index + 1}. ${entry.concept}\n\n`;
    md += `**文件**: \`${entry.filePath || '未知文件'}\``;
    if (entry.lineRange) {
      md += ` (第 ${entry.lineRange.start}-${entry.lineRange.end} 行)`;
    }
    md += `\n\n`;
    md += `**模式**: ${entry.mode === 'local' ? '局部提问' : '全局提问'}\n\n`;
    md += `**时间**: ${new Date(entry.timestamp).toLocaleString()}\n\n`;

    if (entry.tags && entry.tags.length > 0) {
      md += `**标签**: ${entry.tags.join(', ')}\n\n`;
    }

    md += `### 总结\n\n${entry.summary}\n\n`;
    md += `### 原始代码\n\n\`\`\`\n${entry.context}\n\`\`\`\n\n`;
    md += `---\n\n`;
  });

  return md;
}

export function downloadKnowledgeMarkdown(entries: KnowledgeEntry[]): void {
  const now = new Date().toISOString().slice(0, 10);
  const blob = new Blob([exportKnowledgeToMarkdown(entries)], {
    type: 'text/markdown;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `code-lens-knowledge-${now}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function saveKnowledgeMarkdown(
  rootHandle: FileSystemDirectoryHandle,
  entries: KnowledgeEntry[]
): Promise<void> {
  const dirHandle = await ensureKnowledgeDir(rootHandle);
  const now = new Date().toISOString().slice(0, 10);
  const filename = `knowledge-export-${now}.md`;

  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(exportKnowledgeToMarkdown(entries));
  await writable.close();
}
