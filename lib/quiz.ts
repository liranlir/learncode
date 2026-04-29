import { KnowledgeEntry } from './types';

export type QuizQuestionKind = 'concept-choice' | 'summary-choice' | 'true-false';

export interface QuizOption {
  id: string;
  label: string;
}

export interface QuizQuestion {
  id: string;
  kind: QuizQuestionKind;
  knowledgeId: string;
  prompt: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation: string;
}

interface GenerateQuizOptions {
  limit?: number;
  seed?: number;
}

const FALLBACK_SUMMARY_OPTIONS = [
  '这是一个辅助细节，不是这个知识点的核心。',
  '这是一个命名约定，不能完整解释代码行为。',
  '这是一个调用结果，而不是背后的实现逻辑。',
];

const FALLBACK_CONCEPT_OPTIONS = ['入口流程', '状态变化', '错误处理', '模块边界'];

function normalizeText(value: string | undefined, fallback: string): string {
  const text = (value || '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function createRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function shuffle<T>(items: T[], seed: number): T[] {
  const next = [...items];
  const random = createRandom(seed);

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function uniqueOptions(labels: string[], correctLabel: string, seed: number): QuizOption[] {
  const seen = new Set<string>();
  const normalized = labels
    .map((label) => normalizeText(label, '未命名选项'))
    .filter((label) => {
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    })
    .slice(0, 4);

  if (!normalized.includes(correctLabel)) {
    normalized.unshift(correctLabel);
  }

  return shuffle(normalized.slice(0, 4), seed).map((label, index) => ({
    id: `option-${index}`,
    label,
  }));
}

function optionIdFor(options: QuizOption[], label: string): string {
  return options.find((option) => option.label === label)?.id || options[0]?.id || 'option-0';
}

function buildSummaryQuestion(
  entry: KnowledgeEntry,
  allEntries: KnowledgeEntry[],
  seed: number
): QuizQuestion {
  const correct = normalizeText(entry.summary, `${entry.concept} 的核心含义`);
  const distractors = allEntries
    .filter((item) => item.id !== entry.id)
    .map((item) => item.summary)
    .concat(FALLBACK_SUMMARY_OPTIONS);
  const options = uniqueOptions([correct, ...distractors], correct, seed);

  return {
    id: `${entry.id}-summary`,
    kind: 'summary-choice',
    knowledgeId: entry.id,
    prompt: `“${normalizeText(entry.concept, '这个知识点')}”最准确的理解是？`,
    options,
    correctOptionId: optionIdFor(options, correct),
    explanation: correct,
  };
}

function buildConceptQuestion(
  entry: KnowledgeEntry,
  allEntries: KnowledgeEntry[],
  seed: number
): QuizQuestion {
  const correct = normalizeText(entry.concept, '未命名知识点');
  const distractors = allEntries
    .filter((item) => item.id !== entry.id)
    .map((item) => item.concept)
    .concat(FALLBACK_CONCEPT_OPTIONS);
  const options = uniqueOptions([correct, ...distractors], correct, seed);

  return {
    id: `${entry.id}-concept`,
    kind: 'concept-choice',
    knowledgeId: entry.id,
    prompt: `下面这段描述对应哪个知识点？\n${normalizeText(entry.summary, '暂无总结')}`,
    options,
    correctOptionId: optionIdFor(options, correct),
    explanation: `这条描述对应“${correct}”。`,
  };
}

function buildTrueFalseQuestion(
  entry: KnowledgeEntry,
  allEntries: KnowledgeEntry[],
  seed: number
): QuizQuestion {
  const otherEntries = allEntries.filter((item) => item.id !== entry.id);
  const shouldUseFalseStatement = otherEntries.length > 0 && seed % 2 === 0;
  const source = shouldUseFalseStatement
    ? otherEntries[seed % otherEntries.length]
    : entry;
  const correctLabel = shouldUseFalseStatement ? '错误' : '正确';
  const statement = normalizeText(source.summary, '暂无总结');
  const options = [
    { id: 'true', label: '正确' },
    { id: 'false', label: '错误' },
  ];

  return {
    id: `${entry.id}-true-false`,
    kind: 'true-false',
    knowledgeId: entry.id,
    prompt: `判断：下面这句话可以解释“${normalizeText(entry.concept, '这个知识点')}”。\n${statement}`,
    options,
    correctOptionId: correctLabel === '正确' ? 'true' : 'false',
    explanation: shouldUseFalseStatement
      ? `这句话更接近“${normalizeText(source.concept, '另一个知识点')}”，不是“${normalizeText(entry.concept, '这个知识点')}”。`
      : normalizeText(entry.summary, '这条判断来自知识点总结。'),
  };
}

export function generateKnowledgeQuiz(
  entries: KnowledgeEntry[],
  options: GenerateQuizOptions = {}
): QuizQuestion[] {
  const usableEntries = entries.filter((entry) => entry.concept || entry.summary);
  if (usableEntries.length === 0) return [];

  const limit = Math.max(1, options.limit ?? 8);
  const seed = options.seed ?? Date.now();
  const selectedEntries = shuffle(usableEntries, seed).slice(0, Math.min(usableEntries.length, limit));
  const questions = selectedEntries.flatMap((entry, index) => {
    const localSeed = seed + index * 17;
    return [
      buildSummaryQuestion(entry, usableEntries, localSeed),
      buildConceptQuestion(entry, usableEntries, localSeed + 1),
      buildTrueFalseQuestion(entry, usableEntries, localSeed + 2),
    ];
  });

  return shuffle(questions, seed + 101).slice(0, limit);
}
