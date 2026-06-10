export type GenerateProblemRequest = {
  subject: string;
  level: string;
  topic: string;
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
  raw: unknown;
};

const textFrom = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
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

  return {
    title:
      pickText(nested, ['title', 'topic', 'name']) ??
      pickText(root, ['title', 'topic', 'name']) ??
      '生成された問題',
    problem:
      pickText(nested, ['problem', 'question', 'prompt', 'content']) ??
      pickText(root, ['problem', 'question', 'prompt', 'content']) ??
      JSON.stringify(json, null, 2),
    answer:
      pickText(nested, ['answer', 'final_answer', 'correct_answer']) ??
      pickText(root, ['answer', 'final_answer', 'correct_answer']) ??
      '未取得',
    explanation:
      pickText(nested, ['explanation', 'solution', 'reasoning', 'commentary']) ??
      pickText(root, ['explanation', 'solution', 'reasoning', 'commentary']) ??
      '解説フィールドはAPIレスポンスから自動判別できませんでした。',
    raw: json,
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
