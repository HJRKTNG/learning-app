#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(projectRoot, '..');

const DEFAULT_MODEL = 'gemini-2.5-flash';
const SUPPORTED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
]);
const MIME_BY_EXTENSION = {
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const OCR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    transcription: {
      type: 'string',
      description: 'Line-by-line transcription preserving the visible answer order.',
    },
    plainText: {
      type: 'string',
      description: 'Readable plain-text version of the recognized answer.',
    },
    latex: {
      type: 'string',
      description: 'LaTeX reconstruction of math expressions when possible.',
    },
    finalAnswer: {
      type: 'string',
      description: 'Final answer or conclusion if the image contains one.',
    },
    confidence: {
      type: 'number',
      description: 'Overall OCR confidence from 0 to 1.',
    },
    unclearSegments: {
      type: 'array',
      items: { type: 'string' },
      description: 'Parts that were hard to read or ambiguous.',
    },
    qualityFlags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Image or handwriting quality issues affecting OCR.',
    },
    notes: {
      type: 'string',
      description: 'Short notes useful for improving the capture or prompt.',
    },
  },
  required: [
    'transcription',
    'plainText',
    'latex',
    'finalAnswer',
    'confidence',
    'unclearSegments',
    'qualityFlags',
    'notes',
  ],
};

const OCR_PROMPT = [
  'You are an OCR engine for a Japanese learning app.',
  'Read the handwritten math answer in the image as accurately as possible.',
  'Preserve line breaks, calculation order, Japanese text, numbers, variables, and math symbols.',
  'If a math expression is visible, reconstruct it in LaTeX as well as plain text.',
  'Do not solve the problem. Only transcribe what is written.',
  'If a part is unreadable, mark it as [unclear] and explain it in unclearSegments.',
  'Return only JSON matching the response schema.',
].join('\n');

const usage = () => {
  console.log(`
Gemini handwriting OCR runner

Usage:
  npm run ocr:handwriting -- [options]

Options:
  --input <path>      Image file or directory. Default: ../手描き素材
  --output <path>     JSON output path. Default: tmp/ocr-handwriting/<timestamp>.json
  --limit <number>    Process only the first N images.
  --model <model>     Gemini model. Default: GEMINI_OCR_MODEL or gemini-2.5-flash
  --delay-ms <ms>     Delay between API calls. Default: 800
  --dry-run           List target images without calling Gemini.
  --help              Show this help.

Environment:
  GEMINI_API_KEY or GOOGLE_API_KEY is required unless --dry-run is used.
`);
};

const loadEnvFile = async filePath => {
  let content;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

const loadLocalEnv = async () => {
  await loadEnvFile(path.join(projectRoot, '.env.local'));
  await loadEnvFile(path.join(projectRoot, '.env'));
  await loadEnvFile(path.join(repoRoot, '.env'));
};

const parsePositiveInteger = (value, optionName) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${optionName} must be a positive integer.`);
  }
  return parsed;
};

const resolvePath = value =>
  path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);

const parseArgs = argv => {
  const options = {
    delayMs: 800,
    dryRun: false,
    input: path.join(repoRoot, '手描き素材'),
    limit: undefined,
    model: process.env.GEMINI_OCR_MODEL || DEFAULT_MODEL,
    output: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a value.`);
      }
      index += 1;
      return value;
    };

    switch (arg) {
      case '--delay-ms':
        options.delayMs = parsePositiveInteger(next(), '--delay-ms');
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        options.help = true;
        break;
      case '--input':
        options.input = resolvePath(next());
        break;
      case '--limit':
        options.limit = parsePositiveInteger(next(), '--limit');
        break;
      case '--model':
        options.model = next();
        break;
      case '--output':
        options.output = resolvePath(next());
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (!options.output) {
    options.output = path.join(
      projectRoot,
      'tmp',
      'ocr-handwriting',
      `gemini-handwriting-ocr-${stamp}.json`,
    );
  }

  return options;
};

const isImageFile = filePath =>
  SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());

const collectImageFiles = async inputPath => {
  const stat = await fs.stat(inputPath);
  if (stat.isFile()) {
    if (!isImageFile(inputPath)) {
      throw new Error(`Unsupported image type: ${inputPath}`);
    }
    return [inputPath];
  }
  if (!stat.isDirectory()) {
    throw new Error(`Input is not a file or directory: ${inputPath}`);
  }

  const files = [];
  const walk = async dir => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile() && isImageFile(entryPath)) {
        files.push(entryPath);
      }
    }
  };
  await walk(inputPath);
  return files;
};

const getMimeType = filePath => {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXTENSION[ext] || 'image/jpeg';
};

const relativeToRepo = filePath => path.relative(repoRoot, filePath);

const modelPath = model => (model.startsWith('models/') ? model : `models/${model}`);

const parseGeminiText = text => {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const withoutFence = trimmed
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '')
      .trim();
    try {
      return JSON.parse(withoutFence);
    } catch {
      const start = withoutFence.indexOf('{');
      const end = withoutFence.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(withoutFence.slice(start, end + 1));
      }
      throw new Error('Gemini response was not valid JSON.');
    }
  }
};

const readResponseJson = async response => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
};

const callGeminiOcr = async ({ apiKey, filePath, model }) => {
  const imageBytes = await fs.readFile(filePath);
  const imageBase64 = imageBytes.toString('base64');
  const request = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: getMimeType(filePath),
              data: imageBase64,
            },
          },
          {
            text: `${OCR_PROMPT}\n\nFile name: ${path.basename(filePath)}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: OCR_RESPONSE_SCHEMA,
      temperature: 0,
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${modelPath(model)}:generateContent`,
    {
      body: JSON.stringify(request),
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      method: 'POST',
    },
  );
  const responseJson = await readResponseJson(response);

  if (!response.ok) {
    const message =
      responseJson?.error?.message ||
      responseJson?.rawText ||
      `HTTP ${response.status}`;
    throw new Error(`Gemini API error: ${message}`);
  }

  const text = (responseJson.candidates?.[0]?.content?.parts || [])
    .map(part => part.text || '')
    .join('')
    .trim();
  if (!text) {
    throw new Error('Gemini response did not include OCR text.');
  }

  return {
    ocr: parseGeminiText(text),
    rawText: text,
    usageMetadata: responseJson.usageMetadata,
  };
};

const wait = milliseconds =>
  new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });

const writeJson = async (outputPath, payload) => {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const markdownEscape = value => String(value || '').replace(/\|/g, '\\|');
const htmlEscape = value =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const toBrowserPath = filePath =>
  encodeURI(filePath.split(path.sep).join('/')).replace(/#/g, '%23');

const writeMarkdownSummary = async (jsonOutputPath, payload) => {
  const markdownPath = jsonOutputPath.replace(/\.json$/i, '.md');
  const lines = [
    '# Gemini Handwriting OCR Results',
    '',
    `- Created: ${payload.createdAt}`,
    `- Model: ${payload.model}`,
    `- Input: ${payload.input}`,
    `- Total: ${payload.total}`,
    '',
    '| File | Status | Confidence | Final answer | Unclear segments |',
    '| --- | --- | ---: | --- | --- |',
  ];

  for (const result of payload.results) {
    const ocr = result.ocr || {};
    lines.push(
      `| ${[
        markdownEscape(result.file),
        result.status,
        typeof ocr.confidence === 'number' ? ocr.confidence.toFixed(2) : '',
        markdownEscape(ocr.finalAnswer || ''),
        markdownEscape((ocr.unclearSegments || []).join('; ')),
      ].join(' | ')} |`,
    );
  }

  lines.push('');

  for (const result of payload.results) {
    lines.push(`## ${result.file}`, '');
    if (result.status !== 'ok') {
      lines.push(`Error: ${result.error}`, '');
      continue;
    }
    lines.push('### Transcription', '', '```text');
    lines.push(result.ocr.transcription || '');
    lines.push('```', '', '### LaTeX', '', '```tex');
    lines.push(result.ocr.latex || '');
    lines.push('```', '');
  }

  await fs.writeFile(markdownPath, `${lines.join('\n')}\n`, 'utf8');
  return markdownPath;
};

const writeHtmlReport = async (jsonOutputPath, payload) => {
  const htmlPath = jsonOutputPath.replace(/\.json$/i, '.html');
  const reportDir = path.dirname(htmlPath);
  const cards = payload.results
    .map(result => {
      const imagePath = path.join(repoRoot, result.file);
      const imageSrc = toBrowserPath(path.relative(reportDir, imagePath));
      const ocr = result.ocr || {};
      const confidence =
        typeof ocr.confidence === 'number' ? ocr.confidence.toFixed(2) : '-';
      const unclear = (ocr.unclearSegments || []).join('\n') || '-';
      const quality = (ocr.qualityFlags || []).join('\n') || '-';

      if (result.status !== 'ok') {
        return `
          <section class="card error">
            <div class="imagePane">
              <img alt="${htmlEscape(result.file)}" src="${imageSrc}">
            </div>
            <div class="textPane">
              <h2>${htmlEscape(result.file)}</h2>
              <p class="status">Error</p>
              <pre>${htmlEscape(result.error)}</pre>
            </div>
          </section>`;
      }

      return `
        <section class="card">
          <div class="imagePane">
            <img alt="${htmlEscape(result.file)}" src="${imageSrc}">
          </div>
          <div class="textPane">
            <h2>${htmlEscape(result.file)}</h2>
            <dl class="meta">
              <div><dt>Status</dt><dd>${htmlEscape(result.status)}</dd></div>
              <div><dt>Confidence</dt><dd>${confidence}</dd></div>
              <div><dt>Final answer</dt><dd>${htmlEscape(ocr.finalAnswer || '-')}</dd></div>
            </dl>
            <h3>Transcription</h3>
            <pre>${htmlEscape(ocr.transcription)}</pre>
            <h3>LaTeX</h3>
            <pre>${htmlEscape(ocr.latex)}</pre>
            <h3>Unclear</h3>
            <pre>${htmlEscape(unclear)}</pre>
            <h3>Quality</h3>
            <pre>${htmlEscape(quality)}</pre>
            <h3>Notes</h3>
            <pre>${htmlEscape(ocr.notes)}</pre>
          </div>
        </section>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Gemini Handwriting OCR Results</title>
  <style>
    :root {
      color-scheme: light;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f6f7f9;
      color: #18202c;
    }
    body {
      margin: 0;
      padding: 24px;
    }
    header {
      max-width: 1240px;
      margin: 0 auto 18px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 24px;
      letter-spacing: 0;
    }
    .summary {
      margin: 0;
      color: #4c5563;
      font-size: 13px;
    }
    .card {
      display: grid;
      grid-template-columns: minmax(280px, 0.95fr) minmax(360px, 1.05fr);
      gap: 18px;
      max-width: 1240px;
      margin: 0 auto 18px;
      border: 1px solid #dfe3ea;
      border-radius: 8px;
      background: #ffffff;
      overflow: hidden;
    }
    .card.error {
      border-color: #efb2b2;
    }
    .imagePane {
      min-height: 520px;
      background: #20242d;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      overflow: auto;
    }
    .imagePane img {
      max-width: 100%;
      height: auto;
      display: block;
    }
    .textPane {
      min-width: 0;
      padding: 18px 18px 22px 0;
    }
    h2 {
      margin: 0 0 12px;
      font-size: 15px;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }
    h3 {
      margin: 16px 0 6px;
      font-size: 13px;
      color: #394254;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin: 0 0 12px;
    }
    .meta div {
      border-top: 1px solid #e5e8ee;
      padding-top: 8px;
    }
    dt {
      color: #697386;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    dd {
      margin: 4px 0 0;
      font-size: 13px;
      font-weight: 700;
      overflow-wrap: anywhere;
    }
    pre {
      margin: 0;
      padding: 10px;
      border: 1px solid #e2e6ed;
      border-radius: 6px;
      background: #fbfcfe;
      color: #1f2937;
      font: 13px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .status {
      color: #af2f2f;
      font-weight: 800;
    }
    @media (max-width: 860px) {
      body {
        padding: 12px;
      }
      .card {
        grid-template-columns: 1fr;
      }
      .imagePane {
        min-height: 320px;
      }
      .textPane {
        padding: 16px;
      }
      .meta {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>Gemini Handwriting OCR Results</h1>
    <p class="summary">Created: ${htmlEscape(payload.createdAt)} / Model: ${htmlEscape(payload.model)} / Total: ${payload.total}</p>
  </header>
  ${cards}
</body>
</html>
`;
  await fs.writeFile(htmlPath, html, 'utf8');
  return htmlPath;
};

const main = async () => {
  await loadLocalEnv();
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  const allFiles = await collectImageFiles(options.input);
  const files = options.limit ? allFiles.slice(0, options.limit) : allFiles;
  if (files.length === 0) {
    throw new Error(`No supported images found in ${options.input}`);
  }

  console.log(
    `${options.dryRun ? 'Dry run' : 'OCR'}: ${files.length} image(s), model ${options.model}`,
  );
  files.forEach(file => {
    console.log(`- ${relativeToRepo(file)}`);
  });

  if (options.dryRun) {
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY or GOOGLE_API_KEY is required. Put it in StudyLockSpike/.env.local or export it before running.',
    );
  }

  const payload = {
    createdAt: new Date().toISOString(),
    input: relativeToRepo(options.input),
    model: options.model,
    results: [],
    total: files.length,
  };

  for (const [index, file] of files.entries()) {
    const startedAt = Date.now();
    const label = `${index + 1}/${files.length} ${relativeToRepo(file)}`;
    process.stdout.write(`Running ${label} ... `);
    try {
      const response = await callGeminiOcr({
        apiKey,
        filePath: file,
        model: options.model,
      });
      const elapsedMs = Date.now() - startedAt;
      payload.results.push({
        elapsedMs,
        file: relativeToRepo(file),
        mimeType: getMimeType(file),
        ocr: response.ocr,
        status: 'ok',
        usageMetadata: response.usageMetadata,
      });
      console.log(`ok (${elapsedMs}ms)`);
    } catch (error) {
      payload.results.push({
        elapsedMs: Date.now() - startedAt,
        error: error.message,
        file: relativeToRepo(file),
        mimeType: getMimeType(file),
        status: 'error',
      });
      console.log(`error: ${error.message}`);
    }

    if (index < files.length - 1 && options.delayMs > 0) {
      await wait(options.delayMs);
    }
  }

  await writeJson(options.output, payload);
  const markdownPath = await writeMarkdownSummary(options.output, payload);
  const htmlPath = await writeHtmlReport(options.output, payload);
  console.log(`Wrote ${path.relative(process.cwd(), options.output)}`);
  console.log(`Wrote ${path.relative(process.cwd(), markdownPath)}`);
  console.log(`Wrote ${path.relative(process.cwd(), htmlPath)}`);
};

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
