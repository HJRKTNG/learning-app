export type GenerateProblemRequest = {
  subject: string;
  level: string;
  topic: string;
  difficulty?: string;
};

export type GenerateProblemConfig = {
  endpoint: string;
  token: string;
};

export type GeneratedProblem = {
  title: string;
  problem: string;
  answer: string;
  explanation: string;
  latex?: string;
  source: 'api' | 'fallback';
  raw: unknown;
};

const textFrom = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    const joined = value
      .map(item => textFrom(item))
      .filter(Boolean)
      .join('\n\n');
    return joined.length > 0 ? joined : undefined;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (
      textFrom(record.text) ??
      textFrom(record.markdown) ??
      textFrom(record.latex) ??
      textFrom(record.content) ??
      textFrom(record.value)
    );
  }
  return undefined;
};

const pickText = (
  source: Record<string, unknown>,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const direct = textFrom(source[key]);
    if (direct) {
      return direct;
    }
  }
  return undefined;
};

const normalizeGeneratedProblem = (json: unknown): GeneratedProblem => {
  const root =
    json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const nested =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root.result && typeof root.result === 'object'
        ? (root.result as Record<string, unknown>)
        : root;
  const problemText =
    pickText(nested, [
      'problem',
      'question',
      'prompt',
      'content',
      'statement',
      'body',
      'problem_text',
    ]) ??
    pickText(root, [
      'problem',
      'question',
      'prompt',
      'content',
      'statement',
      'body',
      'problem_text',
    ]) ??
    JSON.stringify(json, null, 2);
  const answerText =
    pickText(nested, [
      'answer',
      'final_answer',
      'correct_answer',
      'solution_answer',
      'result',
    ]) ??
    pickText(root, [
      'answer',
      'final_answer',
      'correct_answer',
      'solution_answer',
      'result',
    ]) ??
    '未取得';
  const explanationText =
    pickText(nested, [
      'explanation',
      'solution',
      'reasoning',
      'commentary',
      'steps',
      '解説',
    ]) ??
    pickText(root, [
      'explanation',
      'solution',
      'reasoning',
      'commentary',
      'steps',
      '解説',
    ]) ??
    '解説フィールドはAPIレスポンスから自動判別できませんでした。';

  return {
    title:
      pickText(nested, ['title', 'topic', 'name', 'unit']) ??
      pickText(root, ['title', 'topic', 'name', 'unit']) ??
      '生成された問題',
    problem: problemText,
    answer: answerText,
    explanation: explanationText,
    latex:
      pickText(nested, ['latex', 'tex', 'math', 'mmd']) ??
      pickText(root, ['latex', 'tex', 'math', 'mmd']),
    raw: json,
    source: 'api',
  };
};

export const generateStudyProblem = async (
  config: GenerateProblemConfig,
  request: GenerateProblemRequest,
): Promise<GeneratedProblem> => {
  const endpoint = config.endpoint.trim();
  const token = config.token.trim();

  if (!endpoint) {
    throw new Error('問題生成APIのURLが未設定です。');
  }
  if (!token) {
    throw new Error('問題生成APIのBearer tokenが未設定です。');
  }

  const response = await fetch(endpoint, {
    body: JSON.stringify(request),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const text = await response.text();
  let json: unknown = text;

  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { problem: text };
  }

  if (!response.ok) {
    const message =
      json && typeof json === 'object'
        ? JSON.stringify(json)
        : String(json || response.statusText);
    throw new Error(`問題生成APIエラー (${response.status}): ${message}`);
  }

  return normalizeGeneratedProblem(json);
};
