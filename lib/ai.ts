'use client';

import { AppState, KnowledgeEntry } from './types';
import { buildLocalPrompt, buildGlobalPrompt } from './prompts';
import { getChatCompletionsUrl, loadAiSettings } from './aiSettings';
import { QuizQuestion, QuizQuestionKind } from './quiz';

interface ChatPayload {
  code: string;
  fullContext?: Array<{ path: string; content: string }>;
  question: string;
  mode: 'local' | 'global';
  selection?: {
    startLine: number;
    endLine: number;
    text: string;
    filePath: string;
  };
  knowledgeList: Array<{ concept: string; mode: string }>;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CleanOcrCodeResult {
  fileName: string;
  code: string;
  note: string;
}

function requireAiSettings() {
  const settings = loadAiSettings();
  if (!settings.apiKey.trim()) {
    throw new Error('请先打开右侧设置，填写 DeepSeek API Key。');
  }
  return settings;
}

function buildUserContent(payload: ChatPayload): string {
  const { code, fullContext, question, mode, selection } = payload;

  if (mode === 'local' && selection) {
    return [
      `Selected code (${selection.filePath}:${selection.startLine}-${selection.endLine}):`,
      '```',
      selection.text,
      '```',
      '',
      `Question: ${question}`,
    ].join('\n');
  }

  const contextStr = fullContext
    ? fullContext
        .map((f) => `// File: ${f.path}\n\`\`\`\n${f.content.slice(0, 5000)}\n\`\`\``)
        .join('\n\n')
    : '';

  return [
    'Project files:',
    contextStr,
    '',
    'Current focused file:',
    '```',
    code.slice(0, 5000),
    '```',
    '',
    `Question: ${question}`,
  ].join('\n');
}

function buildMessages(payload: ChatPayload): ChatMessage[] {
  const { code, fullContext, mode, selection, knowledgeList, history = [] } = payload;

  const systemContent =
    mode === 'local' && selection
      ? buildLocalPrompt(selection, knowledgeList as AppState['knowledgeList'])
      : buildGlobalPrompt(code, fullContext || [], knowledgeList as AppState['knowledgeList']);

  return [
    { role: 'system', content: systemContent },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: buildUserContent(payload) },
  ];
}

async function parseErrorResponse(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  if (!text) return `${res.status} ${res.statusText}`;

  try {
    const data = JSON.parse(text);
    return data?.error?.message || data?.message || text;
  } catch {
    return text;
  }
}

export function getReadableAiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '未知错误');

  if (message.includes('401') || message.toLowerCase().includes('unauthorized')) {
    return 'API Key 不正确或没有权限，请检查是否复制完整。';
  }

  if (message.includes('402') || message.toLowerCase().includes('balance')) {
    return '账户余额或额度不足，请到服务商控制台确认。';
  }

  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return '浏览器无法连接到 API。可能是网络问题、Base URL 写错，或 GitHub Pages 直连被 CORS 拦截。';
  }

  return message;
}

export async function testAiConnection(): Promise<void> {
  const settings = requireAiSettings();
  const res = await fetch(getChatCompletionsUrl(settings), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: 'Reply with exactly: ok' },
        { role: 'user', content: 'ping' },
      ],
      stream: false,
      temperature: 0,
      max_tokens: 8,
    }),
  });

  if (!res.ok) {
    throw new Error(`AI connection test failed: ${await parseErrorResponse(res)}`);
  }
}

function parseJsonObject(content: string): Record<string, unknown> {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(jsonText);
  } catch {
    const start = jsonText.indexOf('{');
    const end = jsonText.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(jsonText.slice(start, end + 1));
    }
    throw new Error('AI did not return valid JSON.');
  }
}

function normalizeCleanedCodeResult(value: Record<string, unknown>, fallbackFileName: string): CleanOcrCodeResult {
  const fileName = String(value.fileName || fallbackFileName || 'photo-code.txt')
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim();
  const code = String(value.code || '').trim();
  const note = String(value.note || '').trim();

  return {
    fileName: fileName || 'photo-code.txt',
    code,
    note,
  };
}

export async function cleanOcrCodeText(ocrText: string, fallbackFileName = 'photo-code.txt'): Promise<CleanOcrCodeResult> {
  const settings = requireAiSettings();
  const compactText = ocrText.trim();

  if (!compactText) {
    return { fileName: fallbackFileName, code: '', note: 'OCR did not return text.' };
  }

  const systemPrompt = [
    '你是一个代码 OCR 整理助手。',
    '用户会给你一段从教材、屏幕或纸张照片里识别出来的混合文本，其中可能包含题干、中文说明、行号、页眉页脚、图注和代码。',
    '你的任务是只提取真正的源代码，并修正常见 OCR 错误，例如全角符号、中文标点、错误空格、把 0/O/1/l 识别错、把 #include 或 return 拆坏等。',
    '不要编造照片里没有的大段代码；如果只能看出一部分，就保留可确认的部分。',
    '根据代码内容推断合适的文件名和扩展名。',
    '只返回 JSON，不要 Markdown。',
    'JSON 格式：{"fileName":"photo-code.cpp","code":"整理后的代码","note":"一句话说明你做了什么；如果无法提取代码，说明原因"}',
  ].join('\n');

  const res = await fetch(getChatCompletionsUrl(settings), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            `Fallback file name: ${fallbackFileName}`,
            '',
            'OCR text:',
            '```',
            compactText.slice(0, 12000),
            '```',
          ].join('\n'),
        },
      ],
      stream: false,
      temperature: 0.1,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    throw new Error(`AI OCR cleanup failed: ${await parseErrorResponse(res)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  return normalizeCleanedCodeResult(parseJsonObject(content), fallbackFileName);
}

export async function streamChat(payload: ChatPayload): Promise<ReadableStream> {
  const settings = requireAiSettings();

  const res = await fetch(getChatCompletionsUrl(settings), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      messages: buildMessages(payload),
      stream: true,
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    throw new Error(`AI request failed: ${await parseErrorResponse(res)}`);
  }

  if (!res.body) {
    throw new Error('AI response did not include a readable stream.');
  }

  return res.body;
}

export async function consumeChatStream(
  stream: ReadableStream,
  onDelta: (content: string) => void
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || '';
          if (content) {
            fullContent += content;
            onDelta(fullContent);
          }
        } catch {
          // Ignore partial/diagnostic SSE lines from OpenAI-compatible providers.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullContent;
}

interface SummarizeKnowledgePayload {
  code: string;
  question: string;
  answer: string;
  filePath: string;
  lineRange: { start: number; end: number };
}

interface SummarizeKnowledgeResult {
  concept: string;
  summary: string;
  tags: string[];
}

export async function summarizeKnowledge(
  payload: SummarizeKnowledgePayload
): Promise<SummarizeKnowledgeResult> {
  const settings = requireAiSettings();
  const { code, question, answer, filePath, lineRange } = payload;

  const systemPrompt = [
    '你是一个代码学习知识点总结助手。',
    '请根据用户的局部代码提问对话，总结一个可以复习的知识点。',
    '必须返回 JSON：{"concept":"2-8字概念名","summary":"1-2句话总结","tags":["标签1","标签2"]}',
  ].join('\n');

  const userPrompt = [
    `文件: ${filePath} (${lineRange.start}-${lineRange.end} 行)`,
    '',
    '原始代码:',
    '```',
    code,
    '```',
    '',
    `用户问题: ${question}`,
    '',
    `AI 回答: ${answer}`,
  ].join('\n');

  const res = await fetch(getChatCompletionsUrl(settings), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: false,
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    throw new Error(`AI summary failed: ${await parseErrorResponse(res)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '{}';

  try {
    const result = JSON.parse(content);
    return {
      concept: result.concept || '知识点',
      summary: result.summary || answer.slice(0, 100),
      tags: Array.isArray(result.tags) ? result.tags : [],
    };
  } catch {
    return {
      concept: '知识点',
      summary: answer.slice(0, 100),
      tags: [],
    };
  }
}

interface AiQuizQuestion {
  knowledgeId?: string;
  kind?: QuizQuestionKind;
  prompt?: string;
  options?: string[];
  correctIndex?: number;
  explanation?: string;
}

function normalizeAiQuizQuestion(
  question: AiQuizQuestion,
  index: number,
  entries: KnowledgeEntry[]
): QuizQuestion | null {
  const source = entries.find((entry) => entry.id === question.knowledgeId) || entries[index % entries.length];
  const labels = Array.isArray(question.options)
    ? question.options.map((option) => String(option || '').trim()).filter(Boolean)
    : [];

  if (!source || !question.prompt || labels.length < 2) return null;

  const correctIndex = Math.min(Math.max(Number(question.correctIndex ?? 0), 0), labels.length - 1);
  const options = labels.slice(0, 4).map((label, optionIndex) => ({
    id: `ai-${index}-${optionIndex}`,
    label,
  }));

  return {
    id: `ai-${source.id}-${index}`,
    kind: question.kind === 'true-false' ? 'true-false' : 'summary-choice',
    knowledgeId: source.id,
    prompt: String(question.prompt).trim(),
    options,
    correctOptionId: options[correctIndex]?.id || options[0].id,
    explanation: String(question.explanation || source.summary || '复习对应知识点。').trim(),
  };
}

export async function generateAiQuizQuestions(entries: KnowledgeEntry[]): Promise<QuizQuestion[]> {
  const settings = requireAiSettings();
  const compactEntries = entries
    .filter((entry) => entry.concept || entry.summary)
    .slice(-12)
    .map((entry) => ({
      id: entry.id,
      concept: entry.concept,
      summary: entry.summary,
      tags: entry.tags || [],
      context: entry.context.slice(0, 1200),
    }));

  if (compactEntries.length === 0) return [];

  const systemPrompt = [
    '你是代码学习测验出题助手。',
    '根据用户保存的知识点生成适合手机刷题的中文测验。',
    '只返回 JSON，不要 Markdown。',
    'JSON 格式：{"questions":[{"knowledgeId":"知识点 id","kind":"summary-choice 或 concept-choice 或 true-false","prompt":"题干","options":["选项A","选项B","选项C","选项D"],"correctIndex":0,"explanation":"一句解析"}]}',
    '要求：题目覆盖不同知识点，选项简短，解析能帮助复习。判断题也用两个选项：正确、错误。',
  ].join('\n');

  const res = await fetch(getChatCompletionsUrl(settings), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ knowledge: compactEntries }) },
      ],
      stream: false,
      temperature: 0.35,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    throw new Error(`AI quiz failed: ${await parseErrorResponse(res)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);
  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

  return questions
    .map((question: AiQuizQuestion, index: number) => normalizeAiQuizQuestion(question, index, entries))
    .filter((question: QuizQuestion | null): question is QuizQuestion => Boolean(question))
    .slice(0, 8);
}
