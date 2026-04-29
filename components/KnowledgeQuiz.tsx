'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react';
import { KnowledgeEntry } from '../lib/types';
import { generateKnowledgeQuiz, QuizQuestion } from '../lib/quiz';
import { generateAiQuizQuestions, getReadableAiError } from '../lib/ai';
import { isAiConfigured } from '../lib/aiSettings';

interface KnowledgeQuizProps {
  knowledgeList: KnowledgeEntry[];
  onClose: () => void;
  onReviewKnowledge?: (knowledge: KnowledgeEntry) => void;
  embedded?: boolean;
}

type AnswerMap = Record<string, string>;

function getScore(questions: QuizQuestion[], answers: AnswerMap): number {
  return questions.reduce((score, question) => {
    return answers[question.id] === question.correctOptionId ? score + 1 : score;
  }, 0);
}

const KnowledgeQuiz: React.FC<KnowledgeQuizProps> = ({
  knowledgeList,
  onClose,
  onReviewKnowledge,
  embedded = false,
}) => {
  const [sessionSeed, setSessionSeed] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [showResult, setShowResult] = useState(false);
  const [aiQuestions, setAiQuestions] = useState<QuizQuestion[] | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState('');

  const questions = useMemo(
    () => aiQuestions || generateKnowledgeQuiz(knowledgeList, { limit: 8, seed: sessionSeed }),
    [aiQuestions, knowledgeList, sessionSeed]
  );
  const canUseAiQuiz = isAiConfigured() && knowledgeList.length > 0;

  const currentQuestion = questions[currentIndex];
  const selectedOptionId = currentQuestion ? answers[currentQuestion.id] : undefined;
  const answered = Boolean(selectedOptionId);
  const finished = questions.length > 0 && showResult;
  const score = getScore(questions, answers);
  const accuracy = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  const resetQuiz = () => {
    setAnswers({});
    setCurrentIndex(0);
    setShowResult(false);
    setAiQuestions(null);
    setAiError('');
    setSessionSeed(Date.now());
  };

  const loadAiQuiz = async () => {
    if (!canUseAiQuiz || isGeneratingAi) return;

    setIsGeneratingAi(true);
    setAiError('');
    try {
      const generated = await generateAiQuizQuestions(knowledgeList);
      if (generated.length === 0) {
        setAiError('AI 没有生成可用题目，已保留本地题。');
        return;
      }
      setAiQuestions(generated);
      setAnswers({});
      setCurrentIndex(0);
      setShowResult(false);
    } catch (error) {
      setAiError(getReadableAiError(error));
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSelect = (optionId: string) => {
    if (!currentQuestion || answers[currentQuestion.id]) return;
    setAnswers((current) => ({
      ...current,
      [currentQuestion.id]: optionId,
    }));
  };

  const goNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((index) => index + 1);
    } else {
      setShowResult(true);
    }
  };

  const findKnowledge = (question: QuizQuestion) =>
    knowledgeList.find((entry) => entry.id === question.knowledgeId);

  const wrongQuestions = questions.filter(
    (question) => answers[question.id] && answers[question.id] !== question.correctOptionId
  );

  if (questions.length === 0) {
    return (
      <div className={embedded ? 'quiz-embedded' : 'flex flex-col h-full module-container'} style={{ background: 'var(--bg-secondary)' }}>
        {!embedded && <div className="module-glow" />}
        <div className="quiz-header">
          <button onClick={onClose} className="interactive-circle" title="返回">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2>知识测验</h2>
            <p>先收藏几个知识点，再来刷题巩固。</p>
          </div>
        </div>
        <div className="flex-1 p-4">
          <div className="empty-panel">
            <BookOpen size={24} />
            <p>还没有可出题的知识点</p>
            <span>在代码里圈选内容提问，然后保存为知识点，测验会自动从这些内容生成。</span>
          </div>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className={embedded ? 'quiz-embedded' : 'flex flex-col h-full module-container'} style={{ background: 'var(--bg-secondary)' }}>
        {!embedded && <div className="module-glow" />}
        <div className="quiz-header">
          <button onClick={onClose} className="interactive-circle" title="返回">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2>本轮结果</h2>
            <p>{questions.length} 道题，正确率 {accuracy}%</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <section className="quiz-result-card">
            <Trophy size={28} />
            <strong>{score} / {questions.length}</strong>
            <span>{accuracy >= 80 ? '掌握得不错，可以继续下一轮。' : '错题很有价值，复习一遍再刷会更稳。'}</span>
          </section>

          <section className="space-y-3">
            <div className="quiz-section-title">错题复习</div>
            {wrongQuestions.length === 0 ? (
              <div className="empty-panel compact">
                <CheckCircle2 size={22} />
                <p>这轮没有错题</p>
                <span>可以换一组题继续巩固。</span>
              </div>
            ) : (
              wrongQuestions.map((question) => {
                const source = findKnowledge(question);
                return (
                  <button
                    key={question.id}
                    onClick={() => source && onReviewKnowledge?.(source)}
                    className="quiz-review-item"
                  >
                    <span>{source?.concept || '知识点'}</span>
                    <small>{question.explanation}</small>
                  </button>
                );
              })
            )}
          </section>
        </div>

        <div className="quiz-footer">
          <button onClick={resetQuiz} className="interactive-pill w-full">
            <RotateCcw size={14} className="mr-2" />
            再来一轮
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? 'quiz-embedded' : 'flex flex-col h-full module-container'} style={{ background: 'var(--bg-secondary)' }}>
      {!embedded && <div className="module-glow" />}

      <div className="quiz-header">
        <button onClick={onClose} className="interactive-circle" title="返回">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2>知识测验</h2>
          <p>第 {currentIndex + 1} / {questions.length} 题</p>
        </div>
        {canUseAiQuiz && (
          <button onClick={loadAiQuiz} disabled={isGeneratingAi} className="quiz-ai-button">
            {isGeneratingAi ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            AI 出题
          </button>
        )}
      </div>

      <div className="quiz-progress">
        <div style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <section className="quiz-question-card">
          <div className="quiz-kind">
            {currentQuestion.kind === 'true-false' ? '判断题' : '选择题'}
          </div>
          <h3>{currentQuestion.prompt}</h3>

          <div className="quiz-options">
            {currentQuestion.options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              const isCorrect = currentQuestion.correctOptionId === option.id;
              const showCorrect = answered && isCorrect;
              const showWrong = answered && isSelected && !isCorrect;

              return (
                <button
                  key={option.id}
                  onClick={() => handleSelect(option.id)}
                  className="quiz-option"
                  data-correct={showCorrect}
                  data-wrong={showWrong}
                  disabled={answered}
                >
                  <span>{option.label}</span>
                  {showCorrect && <CheckCircle2 size={16} />}
                  {showWrong && <XCircle size={16} />}
                </button>
              );
            })}
          </div>

          {answered && (
            <div className="quiz-explanation">
              <strong>{selectedOptionId === currentQuestion.correctOptionId ? '答对了' : '这里要再看一眼'}</strong>
              <p>{currentQuestion.explanation}</p>
            </div>
          )}

          {aiError && <div className="quiz-error">{aiError}</div>}
        </section>
      </div>

      <div className="quiz-footer">
        <button
          onClick={goNext}
          disabled={!answered}
          className="interactive-pill w-full"
          style={{ opacity: answered ? 1 : 0.5 }}
        >
          {currentIndex === questions.length - 1 ? '查看结果' : '下一题'}
          <ChevronRight size={14} className="ml-2" />
        </button>
      </div>
    </div>
  );
};

export default KnowledgeQuiz;
