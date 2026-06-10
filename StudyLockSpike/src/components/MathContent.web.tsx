import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import '../web/mathContent.css';
import { splitMathContent } from '../lib/mathMarkup';

type MathContentProps = {
  value: string;
  tone?: 'body' | 'problem' | 'compact';
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const renderInlineMath = (value: string) => {
  const escaped = escapeHtml(value);
  return escaped.replace(
    /(\\\([\s\S]+?\\\)|\$[^$\n]+\$)/g,
    match => {
      const tex = match.startsWith('$')
        ? match.slice(1, -1)
        : match.slice(2, -2);
      try {
        return katex.renderToString(tex, {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        return match;
      }
    },
  );
};

export function MathContent({ tone = 'body', value }: MathContentProps) {
  return (
    <div className={`math-content math-content-${tone}`}>
      {splitMathContent(value).map((block, index) => {
        if (block.kind === 'math') {
          return (
            <div
              className="math-display"
              dangerouslySetInnerHTML={{
                __html: katex.renderToString(block.value, {
                  displayMode: true,
                  throwOnError: false,
                }),
              }}
              key={`${block.kind}-${index}`}
            />
          );
        }

        return (
          <p
            className="math-paragraph"
            dangerouslySetInnerHTML={{ __html: renderInlineMath(block.value) }}
            key={`${block.kind}-${index}`}
          />
        );
      })}
    </div>
  );
}
