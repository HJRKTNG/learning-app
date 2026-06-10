export type MathContentBlock =
  | {
      kind: 'math';
      value: string;
    }
  | {
      kind: 'text';
      value: string;
    };

const displayMathPattern = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])/g;

export const splitMathContent = (value: string): MathContentBlock[] => {
  const blocks: MathContentBlock[] = [];
  let lastIndex = 0;

  value.replace(displayMathPattern, (match, _group, offset: number) => {
    const textBefore = value.slice(lastIndex, offset).trim();
    if (textBefore) {
      blocks.push({ kind: 'text', value: textBefore });
    }

    const math = match.startsWith('$$')
      ? match.slice(2, -2)
      : match.slice(2, -2);
    blocks.push({ kind: 'math', value: math.trim() });
    lastIndex = offset + match.length;
    return match;
  });

  const tail = value.slice(lastIndex).trim();
  if (tail) {
    blocks.push({ kind: 'text', value: tail });
  }

  return blocks.length > 0 ? blocks : [{ kind: 'text', value }];
};
