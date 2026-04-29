import { AppState } from './types';

// 内置提示词模板
export const BUILTIN_PROMPTS = {
  local: [
    {
      id: 'local-explain',
      name: '解释代码',
      template: `请解释这段代码的：
1. 语法功能（1句话）
2. 执行机制和变量流转
3. 在当前上下文中的职责
4. 常见误用或边界情况`,
    },
    {
      id: 'local-bug',
      name: '查找Bug',
      template: `请分析这段代码可能存在的：
1. 潜在Bug或逻辑错误
2. 边界情况处理
3. 性能问题
4. 改进建议`,
    },
    {
      id: 'local-refactor',
      name: '重构建议',
      template: `请对这段代码提供重构建议：
1. 代码可读性改进
2. 设计模式应用
3. 更好的命名建议
4. 简化方案`,
    },
    {
      id: 'local-algorithm',
      name: '算法分析',
      template: `请分析这段代码的算法：
1. 时间复杂度
2. 空间复杂度
3. 算法类型和原理
4. 优化可能性`,
    },
  ],
  global: [
    {
      id: 'global-architecture',
      name: '架构分析',
      template: `请从架构角度分析这个项目：
1. 整体架构模式
2. 模块之间的关系
3. 数据流向
4. 设计模式应用`,
    },
    {
      id: 'global-entry',
      name: '入口分析',
      template: `请分析项目的入口和流程：
1. 程序入口点
2. 主要执行流程
3. 核心模块职责
4. 调用链分析`,
    },
    {
      id: 'global-improve',
      name: '改进建议',
      template: `请提供项目级别的改进建议：
1. 架构设计优化
2. 代码组织建议
3. 最佳实践应用
4. 潜在风险点`,
    },
    {
      id: 'global-tech',
      name: '技术栈分析',
      template: `请分析项目使用的技术栈：
1. 主要技术选型
2. 依赖关系分析
3. 技术选型合理性
4. 替代方案建议`,
    },
  ],
};

// 用户自定义提示词存储
export interface CustomPrompt {
  id: string;
  name: string;
  template: string;
  mode: 'local' | 'global';
  isBuiltin?: boolean;
}

// 从 localStorage 加载自定义提示词
export function loadCustomPrompts(): CustomPrompt[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('code-lens-custom-prompts');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load custom prompts:', e);
  }
  return [];
}

// 保存自定义提示词到 localStorage
export function saveCustomPrompts(prompts: CustomPrompt[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('code-lens-custom-prompts', JSON.stringify(prompts));
  } catch (e) {
    console.error('Failed to save custom prompts:', e);
  }
}

// 获取所有提示词（内置 + 自定义）
export function getAllPrompts(mode: 'local' | 'global'): CustomPrompt[] {
  const builtins = BUILTIN_PROMPTS[mode].map(p => ({ ...p, mode, isBuiltin: true }));
  const customs = loadCustomPrompts().filter(p => p.mode === mode);
  return [...builtins, ...customs];
}

// Local Mode System Prompt - 聚焦当前选区
export function buildLocalPrompt(
  selection: NonNullable<AppState['selection']>,
  knowledgeList: AppState['knowledgeList'],
  customPrompt?: string
): string {
  const relevantKnowledge = knowledgeList.filter((k) =>
    selection.text.toLowerCase().includes(k.concept.toLowerCase())
  );

  const basePrompt = customPrompt || `请解释这段代码的：
1. 语法功能（1句话）
2. 执行机制和变量流转
3. 在当前上下文中的职责
4. 常见误用或边界情况`;

  return `用户圈选了第 ${selection.startLine}-${selection.endLine} 行代码。

【用户要求】
${basePrompt}

【用户已掌握的相关知识点】
${relevantKnowledge.length > 0 
  ? relevantKnowledge.map(k => `- ${k.concept}`).join('\n')
  : '无'}

【约束】
- 只分析这 ${selection.endLine - selection.startLine + 1} 行代码
- 禁止提及其他文件、函数实现、全局架构
- 如果代码引用了外部符号，仅说明"引用了外部函数 X"，不解释 X 的实现`;
}

// Global Mode System Prompt - 项目架构视角
export function buildGlobalPrompt(
  currentCode: string,
  contextFiles: Array<{ path: string; content: string }>,
  knowledgeList: AppState['knowledgeList'],
  customPrompt?: string
): string {
  const fileList = contextFiles.map((f) => `- ${f.path}`).join('\n');

  const basePrompt = customPrompt || `请从架构角度分析这个项目：
1. 整体架构模式
2. 模块之间的关系
3. 数据流向
4. 设计模式应用`;

  return `【项目文件列表】
${fileList || '- 当前文件'}

【用户要求】
${basePrompt}

【已掌握的知识点】
${knowledgeList.length > 0
  ? knowledgeList.map(k => `- ${k.concept}${k.filePath ? ` (${k.filePath.split('/').pop()})` : ''}`).join('\n')
  : '无'}

【约束】
- 从宏观角度回答
- 禁止逐行解释语法（除非用户明确要求）
- 引用代码时使用"文件名:行号"格式`;
}
