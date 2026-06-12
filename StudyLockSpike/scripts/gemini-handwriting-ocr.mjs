#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(projectRoot, '..');

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_DELAY_MS = 800;
const DEFAULT_PADDING_RATIO = 0.07;
const BBOX_SCALE = 1000;
const INK_LUMINANCE_THRESHOLD = 150;
const HORIZONTAL_BLANK_DENSITY = 0.012;
const VERTICAL_BLANK_DENSITY = 0.02;
const MIN_BLANK_BAND_PX = 10;
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

const LAYOUT_SCHEMA = {
  type: 'object',
  properties: {
    pageSummary: {
      type: 'string',
      description:
        'Short visual summary of the page and how the answer areas are grouped.',
    },
    coarseText: {
      type: 'string',
      description:
        'Very rough OCR for orientation only. It is allowed to be incomplete.',
    },
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          blockId: {
            type: 'string',
            description: 'Stable local id such as p15 or block-1.',
          },
          label: {
            type: 'string',
            description: 'Visible label such as 問題15, 7, or Problem 2.',
          },
          problemNumber: {
            type: 'string',
            description: 'Problem number if visible, otherwise empty string.',
          },
          blockType: {
            type: 'string',
            description: 'problem, subproblem, calculation, note, or unknown.',
          },
          bbox: {
            type: 'object',
            properties: {
              x: {
                type: 'integer',
                description: 'Left coordinate normalized to 0-1000.',
              },
              y: {
                type: 'integer',
                description: 'Top coordinate normalized to 0-1000.',
              },
              width: {
                type: 'integer',
                description: 'Width normalized to 0-1000.',
              },
              height: {
                type: 'integer',
                description: 'Height normalized to 0-1000.',
              },
            },
            required: ['x', 'y', 'width', 'height'],
          },
          confidence: {
            type: 'number',
            description: 'Confidence that the block bounds contain one coherent answer.',
          },
          reason: {
            type: 'string',
            description: 'Why this region is one coherent problem/answer block.',
          },
        },
        required: [
          'blockId',
          'label',
          'problemNumber',
          'blockType',
          'bbox',
          'confidence',
          'reason',
        ],
      },
    },
    layoutWarnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Warnings such as overlap, unclear headings, or cut-off text.',
    },
  },
  required: ['pageSummary', 'coarseText', 'blocks', 'layoutWarnings'],
};

const BLOCK_OCR_SCHEMA = {
  type: 'object',
  properties: {
    blockId: { type: 'string' },
    label: { type: 'string' },
    transcription: {
      type: 'string',
      description:
        'Faithful line-by-line transcription. Preserve visible mistakes and uncertainty.',
    },
    plainText: {
      type: 'string',
      description: 'Readable plain text preserving the written order.',
    },
    latex: {
      type: 'string',
      description:
        'Best-effort LaTeX for the written math. Do not silently fix student errors.',
    },
    finalAnswer: {
      type: 'string',
      description: 'Visible final answer if one exists. Empty string if not visible.',
    },
    confidence: {
      type: 'number',
      description: 'Overall OCR confidence from 0 to 1 for this cropped block.',
    },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          lineNo: { type: 'integer' },
          rawText: {
            type: 'string',
            description: 'Most faithful visual transcription of the line.',
          },
          latex: {
            type: 'string',
            description: 'LaTeX for the line if possible, otherwise empty string.',
          },
          confidence: { type: 'number' },
          uncertainSpans: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                raw: { type: 'string' },
                alternatives: {
                  type: 'array',
                  items: { type: 'string' },
                },
                reason: { type: 'string' },
              },
              required: ['raw', 'alternatives', 'reason'],
            },
          },
        },
        required: ['lineNo', 'rawText', 'latex', 'confidence', 'uncertainSpans'],
      },
    },
    unclearSegments: {
      type: 'array',
      items: { type: 'string' },
    },
    qualityFlags: {
      type: 'array',
      items: { type: 'string' },
    },
    notes: { type: 'string' },
  },
  required: [
    'blockId',
    'label',
    'transcription',
    'plainText',
    'latex',
    'finalAnswer',
    'confidence',
    'lines',
    'unclearSegments',
    'qualityFlags',
    'notes',
  ],
};

const VALIDATION_SCHEMA = {
  type: 'object',
  properties: {
    normalizedText: {
      type: 'string',
      description:
        'Clean display text based on OCR, keeping visible student mistakes unchanged.',
    },
    normalizedLatex: {
      type: 'string',
      description:
        'Display-quality LaTeX based on OCR, keeping visible student mistakes unchanged.',
    },
    verdict: {
      type: 'string',
      description:
        'accepted, has_ocr_suspects, has_student_mistakes, or needs_review.',
    },
    flags: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            description:
              'ocr_suspect, student_mistake, notation_jump, arithmetic_check, or needs_review.',
          },
          lineNo: { type: 'integer' },
          raw: { type: 'string' },
          suggestion: {
            type: 'string',
            description:
              'Candidate correction for OCR suspects. Empty for clear student mistakes.',
          },
          reason: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['kind', 'lineNo', 'raw', 'suggestion', 'reason', 'confidence'],
      },
    },
    notationMap: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          role: { type: 'string' },
          firstLineNo: { type: 'integer' },
        },
        required: ['symbol', 'role', 'firstLineNo'],
      },
    },
    studentMistakes: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Places that appear clearly written but mathematically/logically mistaken. Do not correct them.',
    },
    ocrSuspects: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Places likely caused by OCR ambiguity or inconsistent symbol reading.',
    },
    reviewerNotes: {
      type: 'string',
      description: 'Short notes for comparing the crop against the OCR.',
    },
  },
  required: [
    'normalizedText',
    'normalizedLatex',
    'verdict',
    'flags',
    'notationMap',
    'studentMistakes',
    'ocrSuspects',
    'reviewerNotes',
  ],
};

const LAYOUT_PROMPT = [
  'You are doing only coarse OCR and layout analysis for a Japanese handwritten math/electronics answer sheet.',
  'Goal: split the page into coherent problem/answer blocks before detailed OCR.',
  'Return bounding boxes for each visible problem or one coherent answer group.',
  'Use normalized coordinates from 0 to 1000: x, y, width, height.',
  'Prefer problem-number blocks such as 問題7, 問題8, 問題15, etc.',
  'If headings are unclear, use visual separation, blank space, indentation, and line flow.',
  'Do not solve or correct math. Coarse text is only for orientation.',
  'Every bounding-box boundary must pass through blank whitespace. Never split through handwriting, formulas, punctuation, or a problem heading.',
  'If there is no blank whitespace between two visible groups, merge them into one block rather than cutting through text.',
  'Make boxes slightly generous so no handwriting is cut off, but do not include the next problem heading after a blank separator.',
  'Return only JSON matching the schema.',
].join('\n');

const BLOCK_OCR_PROMPT = [
  'You are an OCR engine for a Japanese learning app.',
  'This image is a cropped problem/answer block from a handwritten math/electronics answer sheet.',
  'Read exactly what is written in this crop.',
  'Preserve line breaks, calculation order, Japanese text, numbers, variables, subscripts, superscripts, and math symbols.',
  'Do not solve the problem. Do not silently fix student mistakes.',
  'If a written expression seems mathematically wrong but is visually clear, transcribe the wrong expression as written.',
  'If a symbol is visually ambiguous, keep the most faithful raw reading and list alternatives in uncertainSpans.',
  'Return display-friendly LaTeX when possible, but keep the raw transcription separate.',
  'Return only JSON matching the schema.',
].join('\n');

const VALIDATION_PROMPT = [
  'You are checking OCR output for a Japanese learning app.',
  'Use the cropped image and the OCR JSON to detect suspicious symbol jumps and obvious OCR mistakes.',
  'Important: never replace a visually clear student mistake with the mathematically correct answer.',
  'Classify issues as:',
  '- ocr_suspect: visual ambiguity and surrounding notation suggest an OCR error.',
  '- student_mistake: the handwriting clearly says something that is logically or arithmetically wrong.',
  '- notation_jump: a symbol suddenly appears without definition or conflicts with nearby notation.',
  '- needs_review: cannot decide.',
  'Prefer ocr_suspect over student_mistake when a visually similar token would make the local notation consistent.',
  'Examples: 10/log10 in a decibel calculation is likely an OCR reading of 10log10; blank denominator after E^2/ is likely a missed symbol; V_ki surrounded by V_i is likely an OCR suspect.',
  'Use student_mistake only when the written token is visually clear and there is no close visual alternative that explains the issue.',
  'The normalizedText and normalizedLatex are for display only. They may clean formatting, but must preserve student mistakes.',
  'Preserve the original line breaks in normalizedText and normalizedLatex. Do not collapse multi-line work into one paragraph.',
  'For every suggested OCR correction, explain why it is only a candidate.',
  'Return only JSON matching the schema.',
].join('\n');

const usage = () => {
  console.log(`
Gemini handwriting OCR runner

Usage:
  npm run ocr:handwriting -- [options]

Options:
  --input <path>       Image file or directory. Default: ../手描き素材
  --output <path>      JSON output path. Default: tmp/ocr-handwriting/<timestamp>.json
  --limit <number>     Process only the first N page images.
  --max-blocks <num>   OCR only the first N detected blocks per page.
  --model <model>      Gemini model. Default: GEMINI_OCR_MODEL or gemini-2.5-flash
  --delay-ms <ms>      Delay between API calls. Default: ${DEFAULT_DELAY_MS}
  --padding-ratio <n>  Extra crop padding around each bbox. Default: ${DEFAULT_PADDING_RATIO}
  --layout-only        Run only page layout detection and crop generation.
  --no-validate        Skip the final correction/logic validation pass.
  --dry-run            List target images without calling Gemini.
  --help               Show this help.

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

const parseNonNegativeNumber = (value, optionName) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${optionName} must be a non-negative number.`);
  }
  return parsed;
};

const resolvePath = value =>
  path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);

const parseArgs = argv => {
  const options = {
    delayMs: DEFAULT_DELAY_MS,
    dryRun: false,
    input: path.join(repoRoot, '手描き素材'),
    layoutOnly: false,
    limit: undefined,
    maxBlocks: undefined,
    model: process.env.GEMINI_OCR_MODEL || DEFAULT_MODEL,
    output: undefined,
    paddingRatio: DEFAULT_PADDING_RATIO,
    validate: true,
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
      case '--layout-only':
        options.layoutOnly = true;
        break;
      case '--limit':
        options.limit = parsePositiveInteger(next(), '--limit');
        break;
      case '--max-blocks':
        options.maxBlocks = parsePositiveInteger(next(), '--max-blocks');
        break;
      case '--model':
        options.model = next();
        break;
      case '--no-validate':
        options.validate = false;
        break;
      case '--output':
        options.output = resolvePath(next());
        break;
      case '--padding-ratio':
        options.paddingRatio = parseNonNegativeNumber(next(), '--padding-ratio');
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
      `segmented-gemini-ocr-${stamp}.json`,
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

const wait = milliseconds =>
  new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });

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

const createRequestParts = async ({ filePath, prompt }) => {
  const imageBytes = await fs.readFile(filePath);
  return [
    {
      inline_data: {
        mime_type: getMimeType(filePath),
        data: imageBytes.toString('base64'),
      },
    },
    { text: prompt },
  ];
};

const callGeminiJson = async ({
  apiKey,
  filePath,
  mediaResolution = 'MEDIA_RESOLUTION_HIGH',
  model,
  prompt,
  schema,
}) => {
  const request = {
    contents: [
      {
        parts: await createRequestParts({ filePath, prompt }),
      },
    ],
    generationConfig: {
      mediaResolution,
      responseMimeType: 'application/json',
      responseSchema: schema,
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
    throw new Error('Gemini response did not include JSON text.');
  }

  return {
    data: parseGeminiText(text),
    rawText: text,
    usageMetadata: responseJson.usageMetadata,
  };
};

const sanitizeName = value =>
  String(value || 'block')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'block';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const bboxToRawPixels = ({ bbox, imageHeight, imageWidth }) => {
  const left = Math.floor(clamp((bbox.x / BBOX_SCALE) * imageWidth, 0, imageWidth - 1));
  const top = Math.floor(clamp((bbox.y / BBOX_SCALE) * imageHeight, 0, imageHeight - 1));
  const right = Math.ceil(
    clamp(((bbox.x + bbox.width) / BBOX_SCALE) * imageWidth, left + 1, imageWidth),
  );
  const bottom = Math.ceil(
    clamp(((bbox.y + bbox.height) / BBOX_SCALE) * imageHeight, top + 1, imageHeight),
  );

  return {
    height: Math.max(1, bottom - top),
    left,
    top,
    width: Math.max(1, right - left),
  };
};

const cropToNormalizedBbox = ({ crop, imageHeight, imageWidth }) => ({
  height: Math.round((crop.height / imageHeight) * BBOX_SCALE),
  width: Math.round((crop.width / imageWidth) * BBOX_SCALE),
  x: Math.round((crop.left / imageWidth) * BBOX_SCALE),
  y: Math.round((crop.top / imageHeight) * BBOX_SCALE),
});

const bboxToPixels = ({ bbox, imageHeight, imageWidth, paddingRatio }) => {
  const rawLeft = (bbox.x / BBOX_SCALE) * imageWidth;
  const rawTop = (bbox.y / BBOX_SCALE) * imageHeight;
  const rawWidth = (bbox.width / BBOX_SCALE) * imageWidth;
  const rawHeight = (bbox.height / BBOX_SCALE) * imageHeight;
  const padX = Math.max(8, rawWidth * paddingRatio);
  const padY = Math.max(8, rawHeight * paddingRatio);

  const left = Math.floor(clamp(rawLeft - padX, 0, imageWidth - 1));
  const top = Math.floor(clamp(rawTop - padY, 0, imageHeight - 1));
  const right = Math.ceil(clamp(rawLeft + rawWidth + padX, left + 1, imageWidth));
  const bottom = Math.ceil(
    clamp(rawTop + rawHeight + padY, top + 1, imageHeight),
  );

  return {
    height: Math.max(1, bottom - top),
    left,
    top,
    width: Math.max(1, right - left),
  };
};

const isInk = value => value < INK_LUMINANCE_THRESHOLD;

const createWhitespaceAnalyzer = async pageFile => {
  const { data, info } = await sharp(pageFile)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;

  const safeX = value => clamp(Math.round(value), 0, width - 1);
  const safeY = value => clamp(Math.round(value), 0, height - 1);

  const rowInkDensity = ({ left, right, y }) => {
    const row = safeY(y);
    const x1 = safeX(Math.min(left, right));
    const x2 = safeX(Math.max(left, right));
    let ink = 0;
    let count = 0;
    for (let x = x1; x <= x2; x += 1) {
      if (isInk(data[row * width + x])) {
        ink += 1;
      }
      count += 1;
    }
    return count > 0 ? ink / count : 0;
  };

  const columnInkDensity = ({ bottom, top, x }) => {
    const column = safeX(x);
    const y1 = safeY(Math.min(top, bottom));
    const y2 = safeY(Math.max(top, bottom));
    let ink = 0;
    let count = 0;
    for (let y = y1; y <= y2; y += 1) {
      if (isInk(data[y * width + column])) {
        ink += 1;
      }
      count += 1;
    }
    return count > 0 ? ink / count : 0;
  };

  return {
    columnInkDensity,
    height,
    rowInkDensity,
    width,
  };
};

const findBlankBands = ({
  densityAt,
  densityThreshold,
  from,
  minBandPx = MIN_BLANK_BAND_PX,
  to,
}) => {
  const start = Math.max(0, Math.floor(Math.min(from, to)));
  const end = Math.floor(Math.max(from, to));
  const bands = [];
  let bandStart = null;

  for (let position = start; position <= end; position += 1) {
    const blank = densityAt(position) <= densityThreshold;
    if (blank && bandStart === null) {
      bandStart = position;
    }
    if ((!blank || position === end) && bandStart !== null) {
      const bandEnd = blank && position === end ? position : position - 1;
      if (bandEnd - bandStart + 1 >= minBandPx) {
        bands.push({
          center: Math.round((bandStart + bandEnd) / 2),
          end: bandEnd,
          start: bandStart,
        });
      }
      bandStart = null;
    }
  }

  return bands;
};

const nearestBand = ({ bands, target }) => {
  if (bands.length === 0) {
    return null;
  }
  return bands.reduce((best, band) =>
    Math.abs(band.center - target) < Math.abs(best.center - target) ? band : best,
  );
};

const widestBand = ({ bands, target }) => {
  if (bands.length === 0) {
    return null;
  }
  return bands.reduce((best, band) => {
    const bandWidth = band.end - band.start;
    const bestWidth = best.end - best.start;
    if (bandWidth !== bestWidth) {
      return bandWidth > bestWidth ? band : best;
    }
    return Math.abs(band.center - target) < Math.abs(best.center - target)
      ? band
      : best;
  });
};

const findColumnSeparator = analyzer => {
  const from = Math.floor(analyzer.width * 0.35);
  const to = Math.floor(analyzer.width * 0.65);
  const bands = findBlankBands({
    densityAt: x =>
      analyzer.columnInkDensity({
        bottom: Math.floor(analyzer.height * 0.96),
        top: Math.floor(analyzer.height * 0.04),
        x,
      }),
    densityThreshold: VERTICAL_BLANK_DENSITY,
    from,
    minBandPx: 24,
    to,
  });
  const band = widestBand({
    bands,
    target: Math.floor(analyzer.width / 2),
  });
  if (!band || band.end - band.start < 24) {
    return null;
  }
  return {
    ...band,
    x: band.center,
  };
};

const horizontalOverlapRatio = (a, b) => {
  const overlap = Math.max(
    0,
    Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left),
  );
  return overlap / Math.max(1, Math.min(a.width, b.width));
};

const verticalOverlapRatio = (a, b) => {
  const overlap = Math.max(
    0,
    Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top),
  );
  return overlap / Math.max(1, Math.min(a.height, b.height));
};

const findNeighbor = ({ direction, rawBlocks, target }) => {
  const targetCenterX = target.raw.left + target.raw.width / 2;
  const targetCenterY = target.raw.top + target.raw.height / 2;
  const candidates = rawBlocks
    .filter(block => block !== target)
    .filter(block => {
      const centerX = block.raw.left + block.raw.width / 2;
      const centerY = block.raw.top + block.raw.height / 2;
      if (direction === 'previous') {
        return centerY < targetCenterY && horizontalOverlapRatio(target.raw, block.raw) > 0.22;
      }
      if (direction === 'next') {
        return centerY > targetCenterY && horizontalOverlapRatio(target.raw, block.raw) > 0.22;
      }
      if (direction === 'left') {
        return centerX < targetCenterX && verticalOverlapRatio(target.raw, block.raw) > 0.18;
      }
      return centerX > targetCenterX && verticalOverlapRatio(target.raw, block.raw) > 0.18;
    });

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((best, block) => {
    const blockCenterX = block.raw.left + block.raw.width / 2;
    const blockCenterY = block.raw.top + block.raw.height / 2;
    const bestCenterX = best.raw.left + best.raw.width / 2;
    const bestCenterY = best.raw.top + best.raw.height / 2;

    if (direction === 'previous' || direction === 'next') {
      return Math.abs(blockCenterY - targetCenterY) <
        Math.abs(bestCenterY - targetCenterY)
        ? block
        : best;
    }

    return Math.abs(blockCenterX - targetCenterX) <
      Math.abs(bestCenterX - targetCenterX)
      ? block
      : best;
  });
};

const edgeHasInk = ({ analyzer, crop, edge }) => {
  const densityCrop = crop.densityCrop || crop;
  if (edge === 'top' || edge === 'bottom') {
    const y = edge === 'top' ? crop.top : crop.top + crop.height - 1;
    return (
      analyzer.rowInkDensity({
        left: densityCrop.left,
        right: densityCrop.left + densityCrop.width - 1,
        y,
      }) > HORIZONTAL_BLANK_DENSITY
    );
  }

  const x = edge === 'left' ? crop.left : crop.left + crop.width - 1;
  return (
    analyzer.columnInkDensity({
      bottom: densityCrop.top + densityCrop.height - 1,
      top: densityCrop.top,
      x,
    }) > VERTICAL_BLANK_DENSITY
  );
};

const snapBoundaryToBlank = ({
  analyzer,
  crop,
  densityCrop = crop,
  edge,
  preference = 'nearest',
  maxPosition,
  minPosition,
  searchTarget,
}) => {
  if (edge === 'top' || edge === 'bottom') {
    const bands = findBlankBands({
      densityAt: y =>
        analyzer.rowInkDensity({
          left: densityCrop.left,
          right: densityCrop.left + densityCrop.width - 1,
          y,
        }),
      densityThreshold: HORIZONTAL_BLANK_DENSITY,
      from: minPosition,
      to: maxPosition,
    });
    const band =
      preference === 'widest'
        ? widestBand({ bands, target: searchTarget })
        : nearestBand({ bands, target: searchTarget });
    if (!band) {
      return null;
    }
    return edge === 'top' ? band.end + 1 : band.start;
  }

  const bands = findBlankBands({
    densityAt: x =>
      analyzer.columnInkDensity({
        bottom: densityCrop.top + densityCrop.height - 1,
        top: densityCrop.top,
        x,
      }),
    densityThreshold: VERTICAL_BLANK_DENSITY,
    from: minPosition,
    to: maxPosition,
    minBandPx: Math.max(8, Math.floor(MIN_BLANK_BAND_PX * 0.8)),
  });
  const band =
    preference === 'widest'
      ? widestBand({ bands, target: searchTarget })
      : nearestBand({ bands, target: searchTarget });
  if (!band) {
    return null;
  }
  return edge === 'left' ? band.end + 1 : band.start;
};

const findInkBounds = ({ analyzer, region }) => {
  const horizontalThreshold = Math.max(0.004, HORIZONTAL_BLANK_DENSITY * 0.6);
  const verticalThreshold = Math.max(0.004, VERTICAL_BLANK_DENSITY * 0.45);
  const left = clamp(region.left, 0, analyzer.width - 1);
  const right = clamp(region.left + region.width - 1, left, analyzer.width - 1);
  const top = clamp(region.top, 0, analyzer.height - 1);
  const bottom = clamp(region.top + region.height - 1, top, analyzer.height - 1);
  let firstRow = null;
  let lastRow = null;
  let firstColumn = null;
  let lastColumn = null;

  for (let y = top; y <= bottom; y += 1) {
    const density = analyzer.rowInkDensity({ left, right, y });
    if (density > horizontalThreshold) {
      firstRow = firstRow ?? y;
      lastRow = y;
    }
  }

  for (let x = left; x <= right; x += 1) {
    const density = analyzer.columnInkDensity({ bottom, top, x });
    if (density > verticalThreshold) {
      firstColumn = firstColumn ?? x;
      lastColumn = x;
    }
  }

  if (
    firstRow === null ||
    lastRow === null ||
    firstColumn === null ||
    lastColumn === null
  ) {
    return null;
  }

  return {
    bottom: lastRow,
    left: firstColumn,
    right: lastColumn,
    top: firstRow,
  };
};

const refineCropToWhitespace = ({
  analyzer,
  blockInfo,
  columnSeparator,
  imageHeight,
  imageWidth,
  initialCrop,
  rawBlocks,
}) => {
  const crop = { ...initialCrop };
  const target = blockInfo;
  const previous = findNeighbor({ direction: 'previous', rawBlocks, target });
  const next = findNeighbor({ direction: 'next', rawBlocks, target });
  const leftNeighbor = findNeighbor({ direction: 'left', rawBlocks, target });
  const rightNeighbor = findNeighbor({ direction: 'right', rawBlocks, target });
  const notes = [];
  const inkBounds = findInkBounds({
    analyzer,
    region: target.raw,
  });
  const previousInkBounds = previous
    ? findInkBounds({ analyzer, region: previous.raw })
    : null;
  const nextInkBounds = next
    ? findInkBounds({ analyzer, region: next.raw })
    : null;
  const leftNeighborInkBounds = leftNeighbor
    ? findInkBounds({ analyzer, region: leftNeighbor.raw })
    : null;
  const rightNeighborInkBounds = rightNeighbor
    ? findInkBounds({ analyzer, region: rightNeighbor.raw })
    : null;
  const paddedInkBounds = findInkBounds({
    analyzer,
    region: initialCrop,
  });
  const bottomBodyInsetLeft = Math.floor(initialCrop.width * 0.16);
  const bottomBodyInsetRight = Math.floor(initialCrop.width * 0.06);
  const paddedBodyInkBounds = findInkBounds({
    analyzer,
    region: {
      height: initialCrop.height,
      left: initialCrop.left + bottomBodyInsetLeft,
      top: initialCrop.top,
      width: Math.max(
        1,
        initialCrop.width - bottomBodyInsetLeft - bottomBodyInsetRight,
      ),
    },
  });
  let leftSeparatorLimit = null;
  let rightSeparatorLimit = null;
  const horizontalDensityCrop = () => {
    const margin = Math.max(6, Math.floor(target.raw.width * 0.12));
    const left = clamp(target.raw.left + margin, 0, imageWidth - 1);
    const right = clamp(target.raw.left + target.raw.width - margin, left + 1, imageWidth);
    return {
      height: crop.height,
      left,
      top: crop.top,
      width: Math.max(1, right - left),
    };
  };
  const verticalDensityCrop = () => {
    const margin = Math.max(6, Math.floor(target.raw.height * 0.08));
    const top = clamp(target.raw.top + margin, 0, imageHeight - 1);
    const bottom = clamp(target.raw.top + target.raw.height - margin, top + 1, imageHeight);
    return {
      height: Math.max(1, bottom - top),
      left: crop.left,
      top,
      width: crop.width,
    };
  };
  const sideSeparatorDensityCrop = () => {
    const topMargin = Math.max(8, Math.floor(target.raw.height * 0.32));
    const bottomMargin = Math.max(4, Math.floor(target.raw.height * 0.06));
    const top = clamp(target.raw.top + topMargin, 0, imageHeight - 1);
    const bottom = clamp(
      target.raw.top + target.raw.height - bottomMargin,
      top + 1,
      imageHeight,
    );
    return {
      height: Math.max(1, bottom - top),
      left: crop.left,
      top,
      width: crop.width,
    };
  };

  const applyBoundary = (edge, value, reason) => {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return;
    }
    if (edge === 'top') {
      const nextBottom = crop.top + crop.height;
      const top = clamp(Math.round(value), 0, nextBottom - 1);
      if (top !== crop.top) {
        notes.push(`${edge}:${crop.top}->${top} ${reason}`);
        crop.height = nextBottom - top;
        crop.top = top;
      }
      return;
    }
    if (edge === 'bottom') {
      const bottom = clamp(Math.round(value), crop.top + 1, imageHeight);
      const currentBottom = crop.top + crop.height;
      if (bottom !== currentBottom) {
        notes.push(`${edge}:${currentBottom}->${bottom} ${reason}`);
        crop.height = bottom - crop.top;
      }
      return;
    }
    if (edge === 'left') {
      const nextRight = crop.left + crop.width;
      const left = clamp(Math.round(value), 0, nextRight - 1);
      if (left !== crop.left) {
        notes.push(`${edge}:${crop.left}->${left} ${reason}`);
        crop.width = nextRight - left;
        crop.left = left;
      }
      return;
    }
    const right = clamp(Math.round(value), crop.left + 1, imageWidth);
    const currentRight = crop.left + crop.width;
    if (right !== currentRight) {
      notes.push(`${edge}:${currentRight}->${right} ${reason}`);
      crop.width = right - crop.left;
    }
  };

  if (columnSeparator) {
    const targetCenterX = target.raw.left + target.raw.width / 2;
    if (targetCenterX < columnSeparator.x && crop.left + crop.width > columnSeparator.start) {
      applyBoundary(
        'right',
        Math.max(columnSeparator.start - 4, crop.left + 1),
        'page-column-separator',
      );
    } else if (targetCenterX > columnSeparator.x && crop.left < columnSeparator.end) {
      applyBoundary(
        'left',
        Math.min(columnSeparator.end + 4, crop.left + crop.width - 1),
        'page-column-separator',
      );
    }
  }

  const targetCenterX = target.raw.left + target.raw.width / 2;
  if (targetCenterX > imageWidth * 0.52 && crop.left < imageWidth * 0.45) {
    const densityCrop = sideSeparatorDensityCrop();
    const bands = findBlankBands({
      densityAt: x =>
        analyzer.columnInkDensity({
          bottom: densityCrop.top + densityCrop.height - 1,
          top: densityCrop.top,
          x,
        }),
      densityThreshold: VERTICAL_BLANK_DENSITY,
      from: Math.floor(imageWidth * 0.38),
      minBandPx: Math.max(8, Math.floor(MIN_BLANK_BAND_PX * 0.8)),
      to: Math.min(
        Math.floor(imageWidth * 0.58),
        target.raw.left + Math.floor(target.raw.width * 0.25),
      ),
    });
    const band = nearestBand({
      bands,
      target: Math.floor(imageWidth * 0.47),
    });
    if (band && band.start > crop.left) {
      applyBoundary('left', band.start, 'page-column-gutter');
    }
  }

  if (previous) {
    const bandTop = previousInkBounds
      ? previousInkBounds.bottom
      : previous.raw.top + previous.raw.height;
    const bandBottom = target.raw.top;
    if (bandBottom - bandTop > MIN_BLANK_BAND_PX) {
      applyBoundary(
        'top',
        snapBoundaryToBlank({
          analyzer,
          crop,
          densityCrop: horizontalDensityCrop(),
          edge: 'top',
          maxPosition: bandBottom,
          minPosition: bandTop,
          searchTarget: target.raw.top,
        }),
        `prev=${previous.block.label}`,
      );
    }
  }

  if (next) {
    const bandTop = target.raw.top + Math.floor(target.raw.height * 0.45);
    const bandBottom = nextInkBounds ? nextInkBounds.top : next.raw.top;
    if (bandBottom - bandTop > MIN_BLANK_BAND_PX) {
      const candidate = snapBoundaryToBlank({
        analyzer,
        crop,
        densityCrop: horizontalDensityCrop(),
        edge: 'bottom',
        maxPosition: bandBottom,
        minPosition: bandTop,
        searchTarget: next.raw.top,
      });
      applyBoundary(
        'bottom',
        candidate !== null && candidate < crop.top + crop.height ? candidate : null,
        `next=${next.block.label}`,
      );
    }
  }

  if (leftNeighbor) {
    const neighborRight = leftNeighborInkBounds
      ? leftNeighborInkBounds.right
      : leftNeighbor.raw.left + leftNeighbor.raw.width;
    const separatorSearchPadding = Math.max(24, Math.floor(target.raw.width * 0.12));
    const bandLeft = Math.min(neighborRight, target.raw.left) - separatorSearchPadding;
    const bandRight = target.raw.left;
    if (bandRight - bandLeft > MIN_BLANK_BAND_PX) {
      const densityCrop = sideSeparatorDensityCrop();
      const bands = findBlankBands({
        densityAt: x =>
          analyzer.columnInkDensity({
            bottom: densityCrop.top + densityCrop.height - 1,
            top: densityCrop.top,
            x,
          }),
        densityThreshold: VERTICAL_BLANK_DENSITY,
        from: Math.max(0, bandLeft),
        minBandPx: Math.max(8, Math.floor(MIN_BLANK_BAND_PX * 0.8)),
        to: Math.min(
          bandRight + separatorSearchPadding,
          crop.left + crop.width - 1,
        ),
      });
      const band = nearestBand({ bands, target: crop.left });
      const candidate = band ? band.start : null;
      leftSeparatorLimit = candidate;
      applyBoundary(
        'left',
        candidate !== null && candidate > crop.left
          ? candidate
          : candidate === null && crop.left < Math.max(bandLeft, target.raw.left)
            ? Math.min(Math.max(bandLeft, target.raw.left) + 6, crop.left + crop.width - 1)
            : null,
        `left=${leftNeighbor.block.label}`,
      );
    }
  }

  if (rightNeighbor) {
    const targetRight = target.raw.left + target.raw.width;
    const neighborLeft = rightNeighborInkBounds
      ? rightNeighborInkBounds.left
      : rightNeighbor.raw.left;
    const separatorSearchPadding = Math.max(24, Math.floor(target.raw.width * 0.12));
    const bandLeft = targetRight - separatorSearchPadding;
    const bandRight = Math.max(neighborLeft, targetRight) + separatorSearchPadding;
    if (bandRight - bandLeft > MIN_BLANK_BAND_PX) {
      const candidate = snapBoundaryToBlank({
        analyzer,
        crop,
        densityCrop: sideSeparatorDensityCrop(),
        edge: 'right',
        maxPosition: Math.min(bandRight, crop.left + crop.width - 1),
        minPosition: Math.max(0, bandLeft),
        searchTarget: crop.left + crop.width - 1,
      });
      rightSeparatorLimit = candidate;
      applyBoundary(
        'right',
        candidate !== null && candidate < crop.left + crop.width
          ? candidate
          : crop.left + crop.width >
              Math.min(bandRight, target.raw.left + target.raw.width)
            ? Math.max(
                Math.min(bandRight, target.raw.left + target.raw.width) - 6,
                crop.left + 1,
              )
            : null,
        `right=${rightNeighbor.block.label}`,
      );
    }
  }

  for (const edge of ['top', 'bottom', 'left', 'right']) {
    const densityCrop =
      edge === 'top' || edge === 'bottom'
        ? horizontalDensityCrop()
        : verticalDensityCrop();
    if (!edgeHasInk({ analyzer, crop: { ...crop, densityCrop }, edge })) {
      continue;
    }
    const current =
      edge === 'top'
        ? crop.top
        : edge === 'bottom'
          ? crop.top + crop.height - 1
          : edge === 'left'
            ? crop.left
            : crop.left + crop.width - 1;
    const isHorizontal = edge === 'top' || edge === 'bottom';
    const search = Math.max(24, Math.round((isHorizontal ? crop.height : crop.width) * 0.12));
    const value = snapBoundaryToBlank({
      analyzer,
      crop,
      densityCrop,
      edge,
      maxPosition:
        edge === 'top' || edge === 'left'
          ? current
          : Math.min(isHorizontal ? imageHeight - 1 : imageWidth - 1, current + search),
      minPosition:
        edge === 'top' || edge === 'left'
          ? Math.max(0, current - search)
          : current,
      searchTarget: current,
    });
    applyBoundary(edge, value, 'edge-ink');
  }

  if (inkBounds) {
    const verticalGuard = Math.max(8, Math.floor(target.raw.height * 0.035));
    const horizontalGuard = Math.max(4, Math.floor(target.raw.width * 0.012));
    const verticalNeighborBuffer = Math.max(6, Math.floor(target.raw.height * 0.015));
    const horizontalNeighborBuffer = Math.max(12, Math.floor(target.raw.width * 0.025));
    const leftInkBounds =
      leftNeighbor && paddedInkBounds ? paddedInkBounds : inkBounds;
    const bottomInkBounds =
      next && paddedBodyInkBounds ? paddedBodyInkBounds : inkBounds;
    const topLimit = previous
      ? (previousInkBounds?.bottom ?? previous.raw.top + previous.raw.height) +
        verticalNeighborBuffer
      : 0;
    const bottomLimit = next
      ? (nextInkBounds?.top ?? next.raw.top) - verticalNeighborBuffer
      : imageHeight;
    const leftLimit = leftNeighbor
      ? leftSeparatorLimit ??
        (leftNeighborInkBounds?.right ??
          leftNeighbor.raw.left + leftNeighbor.raw.width) +
          horizontalNeighborBuffer
      : 0;
    const rightLimit = rightNeighbor
      ? rightSeparatorLimit ??
        Math.min(rightNeighborInkBounds?.left ?? rightNeighbor.raw.left, rightNeighbor.raw.left) -
          horizontalNeighborBuffer
      : imageWidth;
    applyBoundary(
      'top',
      Math.min(crop.top, Math.max(topLimit, inkBounds.top - verticalGuard)),
      'ink-bounds-guard',
    );
    applyBoundary(
      'bottom',
      Math.max(
        crop.top + crop.height,
        Math.min(bottomLimit, bottomInkBounds.bottom + verticalGuard),
      ),
      'ink-bounds-guard',
    );
    applyBoundary(
      'left',
      Math.min(
        crop.left,
        Math.max(
          leftLimit,
          leftNeighbor ? crop.left - 70 : leftInkBounds.left - horizontalGuard,
          leftInkBounds.left - horizontalGuard,
        ),
      ),
      'ink-bounds-guard',
    );
    applyBoundary(
      'right',
      Math.max(
        crop.left + crop.width,
        Math.min(
          rightLimit,
          rightNeighbor ? crop.left + crop.width + 70 : inkBounds.right + horizontalGuard,
          inkBounds.right + horizontalGuard,
        ),
      ),
      'ink-bounds-guard',
    );
  }

  return {
    crop,
    notes,
  };
};

const normalizeBlock = (block, index) => {
  const bbox = block?.bbox || {};
  const safeBbox = {
    height: clamp(Number.parseInt(bbox.height, 10) || BBOX_SCALE, 1, BBOX_SCALE),
    width: clamp(Number.parseInt(bbox.width, 10) || BBOX_SCALE, 1, BBOX_SCALE),
    x: clamp(Number.parseInt(bbox.x, 10) || 0, 0, BBOX_SCALE - 1),
    y: clamp(Number.parseInt(bbox.y, 10) || 0, 0, BBOX_SCALE - 1),
  };

  if (safeBbox.x + safeBbox.width > BBOX_SCALE) {
    safeBbox.width = BBOX_SCALE - safeBbox.x;
  }
  if (safeBbox.y + safeBbox.height > BBOX_SCALE) {
    safeBbox.height = BBOX_SCALE - safeBbox.y;
  }

  return {
    bbox: safeBbox,
    blockId: block?.blockId || `block-${index + 1}`,
    blockType: block?.blockType || 'unknown',
    confidence:
      typeof block?.confidence === 'number' ? block.confidence : Number(block?.confidence) || 0,
    label: block?.label || `Block ${index + 1}`,
    problemNumber: block?.problemNumber || '',
    reason: block?.reason || '',
  };
};

const fallbackLayout = () => ({
  blocks: [
    normalizeBlock(
      {
        bbox: { height: BBOX_SCALE, width: BBOX_SCALE, x: 0, y: 0 },
        blockId: 'whole-page',
        blockType: 'problem',
        confidence: 0.2,
        label: 'whole-page',
        problemNumber: '',
        reason: 'Gemini did not return usable layout blocks.',
      },
      0,
    ),
  ],
  coarseText: '',
  layoutWarnings: ['Layout detection returned no blocks; using whole page.'],
  pageSummary: 'Whole page fallback.',
});

const normalizeLayout = layout => {
  const rawBlocks = Array.isArray(layout?.blocks) ? layout.blocks : [];
  const blocks = rawBlocks
    .map(normalizeBlock)
    .filter(block => block.bbox.width > 5 && block.bbox.height > 5)
    .sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);

  if (blocks.length === 0) {
    return fallbackLayout();
  }

  return {
    blocks,
    coarseText: layout?.coarseText || '',
    layoutWarnings: Array.isArray(layout?.layoutWarnings)
      ? layout.layoutWarnings
      : [],
    pageSummary: layout?.pageSummary || '',
  };
};

const cropBlocks = async ({
  blocks,
  contextBlocks = blocks,
  cropsDir,
  pageFile,
  paddingRatio,
}) => {
  const metadata = await sharp(pageFile).metadata();
  const imageWidth = metadata.width;
  const imageHeight = metadata.height;
  if (!imageWidth || !imageHeight) {
    throw new Error(`Cannot read image dimensions: ${pageFile}`);
  }

  await fs.rm(cropsDir, { force: true, recursive: true });
  await fs.mkdir(cropsDir, { recursive: true });
  const baseName = sanitizeName(path.basename(pageFile, path.extname(pageFile)));
  const analyzer = await createWhitespaceAnalyzer(pageFile);
  const columnSeparator = findColumnSeparator(analyzer);
  const rawBlocks = contextBlocks.map(block => ({
    block,
    raw: bboxToRawPixels({
      bbox: block.bbox,
      imageHeight,
      imageWidth,
    }),
  }));

  const croppedBlocks = [];
  for (const [index, block] of blocks.entries()) {
    const initialCrop = bboxToPixels({
      bbox: block.bbox,
      imageHeight,
      imageWidth,
      paddingRatio,
    });
    const blockInfo = rawBlocks[index];
    const matchingBlockInfo =
      rawBlocks.find(info => info.block === block) ||
      rawBlocks.find(
        info =>
          info.block.blockId === block.blockId &&
          info.block.label === block.label,
      ) ||
      blockInfo;
    const refined = refineCropToWhitespace({
      analyzer,
      blockInfo: matchingBlockInfo,
      columnSeparator,
      imageHeight,
      imageWidth,
      initialCrop,
      rawBlocks,
    });
    const crop = refined.crop;
    const cropName = `${baseName}-${String(index + 1).padStart(2, '0')}-${sanitizeName(block.label || block.blockId)}.jpg`;
    const cropPath = path.join(cropsDir, cropName);

    await sharp(pageFile)
      .extract(crop)
      .jpeg({ mozjpeg: true, quality: 92 })
      .toFile(cropPath);

    croppedBlocks.push({
      ...block,
      cropPath,
      cropRelativePath: relativeToRepo(cropPath),
      originalBBox: block.bbox,
      pixelBBox: crop,
      pixelOriginalBBox: matchingBlockInfo.raw,
      refinedBBox: cropToNormalizedBbox({
        crop,
        imageHeight,
        imageWidth,
      }),
      whitespaceRefinement: {
        notes: refined.notes,
      },
    });
  }

  return {
    blocks: croppedBlocks,
    imageHeight,
    imageWidth,
  };
};

const ocrBlock = async ({ apiKey, block, model, pageFile }) => {
  const prompt = [
    BLOCK_OCR_PROMPT,
    '',
    `Original page: ${path.basename(pageFile)}`,
    `Block id: ${block.blockId}`,
    `Visible block label: ${block.label}`,
    `Detected problem number: ${block.problemNumber || '(none)'}`,
  ].join('\n');
  const response = await callGeminiJson({
    apiKey,
    filePath: block.cropPath,
    model,
    prompt,
    schema: BLOCK_OCR_SCHEMA,
  });

  return {
    ...response,
    data: {
      ...response.data,
      blockId: response.data?.blockId || block.blockId,
      label: response.data?.label || block.label,
    },
  };
};

const validateBlock = async ({ apiKey, block, model, ocr }) => {
  const prompt = [
    VALIDATION_PROMPT,
    '',
    'OCR JSON to check:',
    JSON.stringify(ocr, null, 2),
  ].join('\n');
  return callGeminiJson({
    apiKey,
    filePath: block.cropPath,
    model,
    prompt,
    schema: VALIDATION_SCHEMA,
  });
};

const lineCount = value =>
  String(value || '')
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0).length;

const preserveLineBreaks = ({ fallback, value }) => {
  const cleanValue = String(value || '').trim();
  const cleanFallback = String(fallback || '').trim();
  if (!cleanValue) {
    return cleanFallback;
  }

  const valueLines = lineCount(cleanValue);
  const fallbackLines = lineCount(cleanFallback);
  if (fallbackLines >= 3 && valueLines <= Math.max(1, Math.floor(fallbackLines / 2))) {
    return cleanFallback;
  }

  return cleanValue;
};

const looksLikeLogDivisionOcr = value =>
  /(?:^|[^A-Za-z])[-+]?10\/log(?:₁₀|10)?/i.test(String(value || ''));

const looksLikeZ0As20Ocr = value =>
  /W\s*=\s*E\^?2\s*\/\s*20\s*=\s*E\^?2\s*\/\s*120\s*π/i.test(
    String(value || ''),
  );

const suggestLogMultiplication = value =>
  String(value || '').replace(/([-+]?)10\/log/g, '$110log');

const suggestZ0For20 = value =>
  String(value || '')
    .replace(/E\^2\s*\/\s*20\s*=\s*E\^2\s*\/\s*120π/g, 'E^2 / Z_0 = E^2 / 120π')
    .replace(
      /\\frac\{E\^2\}\{20\}/g,
      '\\frac{E^2}{Z_0}',
    );

const applyDomainHeuristics = ({ ocr, validation }) => {
  if (!validation) {
    return validation;
  }

  let changedLogDivision = false;
  const flags = (validation.flags || []).map(flag => {
    if (!looksLikeLogDivisionOcr(flag.raw)) {
      return flag;
    }
    changedLogDivision = true;
    return {
      ...flag,
      confidence: Math.min(Number(flag.confidence) || 0.72, 0.78),
      kind: 'ocr_suspect',
      reason:
        '利得/デシベル計算では 10log の形が自然で、手書きの密着した 10log が 10/log と読まれた可能性が高い。rawは保持し、画像確認用の補正候補として扱う。',
      suggestion: suggestLogMultiplication(flag.raw),
    };
  });

  if (!changedLogDivision && looksLikeLogDivisionOcr(ocr?.transcription)) {
    changedLogDivision = true;
    flags.push({
      confidence: 0.72,
      kind: 'ocr_suspect',
      lineNo: 0,
      raw: '10/log',
      reason:
        '利得/デシベル計算の文脈で 10/log が出ているため、10log のOCR揺れ候補として提示する。',
      suggestion: '10log',
    });
  }

  const changedZ0As20 =
    looksLikeZ0As20Ocr(ocr?.transcription) ||
    looksLikeZ0As20Ocr(validation.normalizedText);
  if (changedZ0As20) {
    flags.push({
      confidence: 0.76,
      kind: 'ocr_suspect',
      lineNo: 1,
      raw: 'E^2 / 20',
      reason:
        '同じ行に E^2/120π があり、自由空間の固有インピーダンスの文脈では Z_0 が自然。手書きの Z_0 が 20 と読まれた可能性が高い。',
      suggestion: 'E^2 / Z_0',
    });
  }

  if (!changedLogDivision && !changedZ0As20) {
    return {
      ...validation,
      flags,
    };
  }

  const hasStudentMistake = flags.some(flag =>
    ['arithmetic_check', 'student_mistake'].includes(flag.kind),
  );
  const hasOcrSuspect = flags.some(flag =>
    ['notation_jump', 'ocr_suspect'].includes(flag.kind),
  );

  return {
    ...validation,
    flags,
    normalizedLatex: suggestZ0For20(validation.normalizedLatex),
    normalizedText: suggestZ0For20(
      suggestLogMultiplication(validation.normalizedText),
    ),
    ocrSuspects: [
      ...(validation.ocrSuspects || []),
      ...(changedLogDivision
        ? ['10/log は 10log のOCR揺れ候補として扱う。']
        : []),
      ...(changedZ0As20
        ? ['E^2/20 は E^2/Z_0 のOCR揺れ候補として扱う。']
        : []),
    ],
    verdict: hasStudentMistake
      ? 'has_student_mistakes'
      : hasOcrSuspect
        ? 'has_ocr_suspects'
        : validation.verdict,
  };
};

const normalizeValidationForDisplay = ({ ocr, validation }) => {
  if (!validation) {
    return validation;
  }

  return applyDomainHeuristics({
    ocr,
    validation: {
    ...validation,
    normalizedLatex: preserveLineBreaks({
      fallback: ocr?.latex,
      value: validation.normalizedLatex,
    }),
    normalizedText: preserveLineBreaks({
      fallback: ocr?.transcription || ocr?.plainText,
      value: validation.normalizedText,
    }),
    },
  });
};

const runPagePipeline = async ({ apiKey, file, options, pageIndex, total }) => {
  const pageStartedAt = Date.now();
  const pageLabel = `${pageIndex + 1}/${total} ${relativeToRepo(file)}`;
  console.log(`Page ${pageLabel}`);
  process.stdout.write('  layout ... ');

  const layoutResponse = await callGeminiJson({
    apiKey,
    filePath: file,
    model: options.model,
    prompt: `${LAYOUT_PROMPT}\n\nFile name: ${path.basename(file)}`,
    schema: LAYOUT_SCHEMA,
  });
  const layout = normalizeLayout(layoutResponse.data);
  const selectedBlocks = options.maxBlocks
    ? layout.blocks.slice(0, options.maxBlocks)
    : layout.blocks;
  console.log(`ok (${selectedBlocks.length}/${layout.blocks.length} block(s))`);

  const outputBase = path.basename(options.output, path.extname(options.output));
  const cropsDir = path.join(
    path.dirname(options.output),
    `${outputBase}-crops`,
    sanitizeName(path.basename(file, path.extname(file))),
  );
  const cropResult = await cropBlocks({
    blocks: selectedBlocks,
    contextBlocks: layout.blocks,
    cropsDir,
    pageFile: file,
    paddingRatio: options.paddingRatio,
  });

  const blockResults = [];
  if (!options.layoutOnly) {
    for (const [blockIndex, block] of cropResult.blocks.entries()) {
      const blockPrefix = `  block ${blockIndex + 1}/${cropResult.blocks.length} ${block.label}`;
      process.stdout.write(`${blockPrefix} OCR ... `);
      const blockStartedAt = Date.now();
      try {
        const ocrResponse = await ocrBlock({
          apiKey,
          block,
          model: options.model,
          pageFile: file,
        });
        const ocrElapsedMs = Date.now() - blockStartedAt;
        console.log(`ok (${ocrElapsedMs}ms)`);

        let validation = null;
        let validationUsageMetadata = null;
        if (options.validate) {
          process.stdout.write(`${blockPrefix} validation ... `);
          const validationStartedAt = Date.now();
          const validationResponse = await validateBlock({
            apiKey,
            block,
            model: options.model,
            ocr: ocrResponse.data,
          });
          validation = normalizeValidationForDisplay({
            ocr: ocrResponse.data,
            validation: validationResponse.data,
          });
          validationUsageMetadata = validationResponse.usageMetadata;
          console.log(`ok (${Date.now() - validationStartedAt}ms)`);
        }

        blockResults.push({
          ...block,
          ocr: ocrResponse.data,
          ocrElapsedMs,
          ocrUsageMetadata: ocrResponse.usageMetadata,
          status: 'ok',
          validation,
          validationUsageMetadata,
        });
      } catch (error) {
        blockResults.push({
          ...block,
          error: error.message,
          status: 'error',
        });
        console.log(`error: ${error.message}`);
      }

      if (
        options.delayMs > 0 &&
        blockIndex < cropResult.blocks.length - 1
      ) {
        await wait(options.delayMs);
      }
    }
  } else {
    blockResults.push(
      ...cropResult.blocks.map(block => ({
        ...block,
        status: 'layout-only',
      })),
    );
  }

  return {
    blocks: blockResults,
    elapsedMs: Date.now() - pageStartedAt,
    file: relativeToRepo(file),
    imageHeight: cropResult.imageHeight,
    imageWidth: cropResult.imageWidth,
    layout,
    layoutUsageMetadata: layoutResponse.usageMetadata,
    status: 'ok',
  };
};

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

const attrEscape = value => htmlEscape(value).replace(/'/g, '&#39;');
const toBrowserPath = filePath =>
  encodeURI(filePath.split(path.sep).join('/')).replace(/#/g, '%23');

const blockTitle = block =>
  [block.label, block.problemNumber ? `(${block.problemNumber})` : '']
    .filter(Boolean)
    .join(' ');

const verdictClass = verdict => {
  if (verdict === 'accepted') {
    return 'good';
  }
  if (verdict === 'has_student_mistakes') {
    return 'warn';
  }
  if (verdict === 'has_ocr_suspects') {
    return 'suspect';
  }
  return 'review';
};

const writeMarkdownSummary = async (jsonOutputPath, payload) => {
  const markdownPath = jsonOutputPath.replace(/\.json$/i, '.md');
  const lines = [
    '# Segmented Gemini Handwriting OCR Results',
    '',
    `- Created: ${payload.createdAt}`,
    `- Model: ${payload.model}`,
    `- Input: ${payload.input}`,
    `- Pages: ${payload.total}`,
    `- Pipeline: layout -> crop -> block OCR -> ${payload.options.validate ? 'validation' : 'no validation'}`,
    '',
  ];

  for (const page of payload.results) {
    lines.push(`## ${page.file}`, '');
    lines.push(page.layout.pageSummary || '');
    lines.push('');
    lines.push('| Block | Status | Confidence | Verdict | Final answer |');
    lines.push('| --- | --- | ---: | --- | --- |');
    for (const block of page.blocks) {
      lines.push(
        `| ${[
          markdownEscape(blockTitle(block)),
          block.status,
          typeof block.ocr?.confidence === 'number'
            ? block.ocr.confidence.toFixed(2)
            : '',
          block.validation?.verdict || '',
          markdownEscape(block.ocr?.finalAnswer || ''),
        ].join(' | ')} |`,
      );
    }
    lines.push('');

    for (const block of page.blocks) {
      lines.push(`### ${blockTitle(block)}`, '');
      lines.push(`Crop: ${block.cropRelativePath}`, '');
      if (block.status !== 'ok') {
        lines.push(`Status: ${block.status}`, block.error || '', '');
        continue;
      }
      lines.push('#### Raw OCR', '', '```text', block.ocr.transcription || '', '```', '');
      lines.push('#### Normalized Text', '', '```text');
      lines.push(block.validation?.normalizedText || block.ocr.plainText || '');
      lines.push('```', '');
      lines.push('#### TeX', '', '```tex');
      lines.push(block.validation?.normalizedLatex || block.ocr.latex || '');
      lines.push('```', '');
      if (block.validation?.flags?.length) {
        lines.push('#### Flags', '');
        for (const flag of block.validation.flags) {
          lines.push(
            `- ${flag.kind} line ${flag.lineNo}: ${flag.raw} -> ${flag.suggestion || '(no correction)'} / ${flag.reason}`,
          );
        }
        lines.push('');
      }
    }
  }

  await fs.writeFile(markdownPath, `${lines.join('\n')}\n`, 'utf8');
  return markdownPath;
};

const renderOverlayBoxes = page =>
  page.blocks
    .map((block, index) => {
      const bbox = block.refinedBBox || block.bbox;
      return `<div class="overlayBox ${verdictClass(block.validation?.verdict)}"
        style="left:${bbox.x / 10}%;top:${bbox.y / 10}%;width:${bbox.width / 10}%;height:${bbox.height / 10}%;">
        <span>${index + 1}. ${htmlEscape(block.label)}</span>
      </div>`;
    })
    .join('\n');

const renderFlags = validation => {
  const flags = validation?.flags || [];
  if (flags.length === 0) {
    return '<p class="empty">なし</p>';
  }
  return `<ul class="flagList">${flags
    .map(
      flag => `<li class="${verdictClass(
        flag.kind === 'student_mistake'
          ? 'has_student_mistakes'
          : flag.kind === 'ocr_suspect' || flag.kind === 'notation_jump'
            ? 'has_ocr_suspects'
            : 'needs_review',
      )}">
        <strong>${htmlEscape(flag.kind)}</strong>
        <span>line ${flag.lineNo}: ${htmlEscape(flag.raw)}</span>
        ${
          flag.suggestion
            ? `<span class="suggestion">候補: ${htmlEscape(flag.suggestion)}</span>`
            : ''
        }
        <em>${htmlEscape(flag.reason)}</em>
      </li>`,
    )
    .join('')}</ul>`;
};

const renderLineRows = block => {
  const lines = block.ocr?.lines || [];
  if (lines.length === 0) {
    return '<p class="empty">行データなし</p>';
  }
  return `<table class="lineTable">
    <thead><tr><th>#</th><th>Raw</th><th>TeX整形</th><th>候補</th></tr></thead>
    <tbody>
      ${lines
        .map(line => {
          const uncertain = (line.uncertainSpans || [])
            .map(
              span =>
                `${span.raw}: ${(span.alternatives || []).join(', ')} (${span.reason})`,
            )
            .join('\n');
          return `<tr>
            <td>${line.lineNo}</td>
            <td><pre>${htmlEscape(line.rawText)}</pre></td>
            <td><div class="mathBlock">$$${htmlEscape(line.latex || line.rawText)}$$</div></td>
            <td><pre>${htmlEscape(uncertain || '-')}</pre></td>
          </tr>`;
        })
        .join('')}
    </tbody>
  </table>`;
};

const renderBlockCards = (page, reportDir) =>
  page.blocks
    .map((block, index) => {
      const cropPath = path.join(repoRoot, block.cropRelativePath);
      const cropSrc = toBrowserPath(path.relative(reportDir, cropPath));
      const ocr = block.ocr || {};
      const validation = block.validation || {};
      const confidence =
        typeof ocr.confidence === 'number' ? ocr.confidence.toFixed(2) : '-';
      const verdict = validation.verdict || block.status;
      const normalizedLatex = validation.normalizedLatex || ocr.latex || '';
      const normalizedText = validation.normalizedText || ocr.plainText || '';

      return `<section class="blockCard ${verdictClass(verdict)}">
        <div class="blockHeader">
          <h3>${index + 1}. ${htmlEscape(blockTitle(block))}</h3>
          <div class="chips">
            <span>${htmlEscape(block.status)}</span>
            <span>OCR ${confidence}</span>
            <span class="${verdictClass(verdict)}">${htmlEscape(verdict)}</span>
          </div>
        </div>
        <div class="blockGrid">
          <div>
            <img class="cropImage" alt="${attrEscape(blockTitle(block))}" src="${cropSrc}">
            <dl class="bbox">
              <div><dt>original</dt><dd>${block.originalBBox?.x ?? block.bbox.x}, ${block.originalBBox?.y ?? block.bbox.y}, ${block.originalBBox?.width ?? block.bbox.width}, ${block.originalBBox?.height ?? block.bbox.height}</dd></div>
              <div><dt>refined</dt><dd>${block.refinedBBox?.x ?? block.bbox.x}, ${block.refinedBBox?.y ?? block.bbox.y}, ${block.refinedBBox?.width ?? block.bbox.width}, ${block.refinedBBox?.height ?? block.bbox.height}</dd></div>
              <div><dt>crop</dt><dd>${block.pixelBBox?.left}, ${block.pixelBBox?.top}, ${block.pixelBBox?.width}, ${block.pixelBBox?.height}</dd></div>
              ${
                block.whitespaceRefinement?.notes?.length
                  ? `<div><dt>snap</dt><dd>${htmlEscape(block.whitespaceRefinement.notes.join(' / '))}</dd></div>`
                  : ''
              }
            </dl>
          </div>
          <div class="comparePane">
            ${
              block.status === 'ok'
                ? `<div class="tabs">
                    <section>
                      <h4>Raw OCR</h4>
                      <pre>${htmlEscape(ocr.transcription)}</pre>
                    </section>
                    <section>
                      <h4>補正候補つき表示</h4>
                      <pre>${htmlEscape(normalizedText)}</pre>
                    </section>
                    <section>
                      <h4>TeX整形</h4>
                      <div class="mathBlock">$$${htmlEscape(normalizedLatex)}$$</div>
                      <pre>${htmlEscape(normalizedLatex)}</pre>
                    </section>
                    <section>
                      <h4>怪しい箇所 / 手書きミス候補</h4>
                      ${renderFlags(validation)}
                    </section>
                  </div>`
                : `<pre>${htmlEscape(block.error || block.status)}</pre>`
            }
          </div>
        </div>
        ${
          block.status === 'ok'
            ? `<details>
                <summary>行ごとのOCRとTeXを見る</summary>
                ${renderLineRows(block)}
              </details>`
            : ''
        }
      </section>`;
    })
    .join('\n');

const writeHtmlReport = async (jsonOutputPath, payload) => {
  const htmlPath = jsonOutputPath.replace(/\.json$/i, '.html');
  const reportDir = path.dirname(htmlPath);
  const pageSections = payload.results
    .map(page => {
      const imagePath = path.join(repoRoot, page.file);
      const imageSrc = toBrowserPath(path.relative(reportDir, imagePath));
      return `<section class="pageSection">
        <header class="pageHeader">
          <h2>${htmlEscape(page.file)}</h2>
          <p>${htmlEscape(page.layout.pageSummary || '')}</p>
          ${
            page.layout.layoutWarnings?.length
              ? `<pre class="warnings">${htmlEscape(page.layout.layoutWarnings.join('\n'))}</pre>`
              : ''
          }
        </header>
        <div class="pageGrid">
          <div class="sourcePane">
            <div class="sourceImageWrap">
              <img alt="${attrEscape(page.file)}" src="${imageSrc}">
              ${renderOverlayBoxes(page)}
            </div>
            <h3>粗OCR</h3>
            <pre>${htmlEscape(page.layout.coarseText || '')}</pre>
          </div>
          <div class="blocksPane">
            ${renderBlockCards(page, reportDir)}
          </div>
        </div>
      </section>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Segmented Gemini OCR Report</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.css">
  <style>
    :root {
      color-scheme: light;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f4f6f8;
      color: #17202c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
    }
    body > header {
      max-width: 1480px;
      margin: 0 auto 18px;
    }
    h1, h2, h3, h4 {
      letter-spacing: 0;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 25px;
    }
    .summary {
      margin: 0;
      color: #526071;
      font-size: 13px;
      line-height: 1.5;
    }
    .pageSection {
      max-width: 1480px;
      margin: 0 auto 28px;
      border: 1px solid #dbe1ea;
      border-radius: 8px;
      background: #ffffff;
      overflow: hidden;
    }
    .pageHeader {
      padding: 16px 18px;
      border-bottom: 1px solid #e4e8ef;
    }
    .pageHeader h2 {
      margin: 0 0 6px;
      font-size: 16px;
      overflow-wrap: anywhere;
    }
    .pageHeader p {
      margin: 0;
      color: #536174;
      font-size: 13px;
    }
    .pageGrid {
      display: grid;
      grid-template-columns: minmax(340px, 0.75fr) minmax(520px, 1.25fr);
      min-height: 620px;
    }
    .sourcePane {
      border-right: 1px solid #e4e8ef;
      background: #f9fafc;
      padding: 14px;
      min-width: 0;
    }
    .sourcePane h3 {
      margin: 14px 0 6px;
      font-size: 13px;
    }
    .sourceImageWrap {
      position: relative;
      background: #20242d;
      overflow: auto;
      max-height: 760px;
    }
    .sourceImageWrap img {
      display: block;
      width: 100%;
      height: auto;
    }
    .overlayBox {
      position: absolute;
      border: 2px solid #2f74d0;
      background: rgba(47, 116, 208, 0.08);
      pointer-events: none;
    }
    .overlayBox.good { border-color: #1f8a5b; background: rgba(31, 138, 91, 0.08); }
    .overlayBox.warn { border-color: #b7791f; background: rgba(183, 121, 31, 0.1); }
    .overlayBox.suspect { border-color: #b83280; background: rgba(184, 50, 128, 0.1); }
    .overlayBox.review { border-color: #697386; background: rgba(105, 115, 134, 0.1); }
    .overlayBox span {
      display: inline-block;
      max-width: 100%;
      padding: 2px 5px;
      background: rgba(255, 255, 255, 0.92);
      color: #111827;
      font-size: 11px;
      font-weight: 800;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .blocksPane {
      padding: 14px;
      min-width: 0;
    }
    .blockCard {
      border: 1px solid #dfe5ee;
      border-left-width: 4px;
      border-radius: 8px;
      margin: 0 0 14px;
      overflow: hidden;
      background: #ffffff;
    }
    .blockCard.good { border-left-color: #1f8a5b; }
    .blockCard.warn { border-left-color: #b7791f; }
    .blockCard.suspect { border-left-color: #b83280; }
    .blockCard.review { border-left-color: #697386; }
    .blockHeader {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid #edf0f5;
    }
    .blockHeader h3 {
      margin: 0;
      font-size: 15px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 6px;
      min-width: 160px;
    }
    .chips span {
      padding: 3px 7px;
      border: 1px solid #d9dee8;
      border-radius: 999px;
      background: #f8fafc;
      color: #3d4757;
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
    }
    .chips .good { border-color: #b8dfcc; color: #176344; }
    .chips .warn { border-color: #edd39d; color: #815b12; }
    .chips .suspect { border-color: #efbfdc; color: #8a1d5d; }
    .chips .review { border-color: #ced6e1; color: #4e596a; }
    .blockGrid {
      display: grid;
      grid-template-columns: minmax(240px, 0.7fr) minmax(360px, 1.3fr);
      gap: 14px;
      padding: 14px;
    }
    .cropImage {
      display: block;
      width: 100%;
      height: auto;
      border: 1px solid #dfe5ee;
      background: #20242d;
    }
    .bbox {
      display: grid;
      gap: 6px;
      margin: 10px 0 0;
      color: #596579;
      font-size: 11px;
    }
    .bbox div {
      display: grid;
      grid-template-columns: 48px 1fr;
      gap: 8px;
    }
    .bbox dt {
      font-weight: 800;
      text-transform: uppercase;
    }
    .bbox dd { margin: 0; overflow-wrap: anywhere; }
    .comparePane {
      min-width: 0;
    }
    .tabs {
      display: grid;
      gap: 12px;
    }
    h4 {
      margin: 0 0 6px;
      color: #394457;
      font-size: 13px;
    }
    pre {
      margin: 0;
      padding: 10px;
      border: 1px solid #e1e6ef;
      border-radius: 6px;
      background: #fbfcfe;
      color: #1f2937;
      font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .mathBlock {
      margin: 0 0 8px;
      padding: 10px;
      border: 1px solid #e1e6ef;
      border-radius: 6px;
      background: #ffffff;
      overflow-x: auto;
      font-size: 14px;
    }
    .flagList {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .flagList li {
      display: grid;
      gap: 4px;
      padding: 9px 10px;
      border: 1px solid #dfe5ee;
      border-radius: 6px;
      background: #fbfcfe;
      font-size: 12px;
    }
    .flagList li.warn { border-color: #edd39d; background: #fffaf0; }
    .flagList li.suspect { border-color: #efbfdc; background: #fff7fb; }
    .flagList li.review { border-color: #ced6e1; background: #f8fafc; }
    .flagList strong {
      color: #17202c;
    }
    .flagList .suggestion {
      color: #1f5f9f;
      font-weight: 800;
    }
    .flagList em {
      color: #586579;
      font-style: normal;
      line-height: 1.45;
    }
    details {
      border-top: 1px solid #edf0f5;
      padding: 10px 14px 14px;
    }
    summary {
      cursor: pointer;
      color: #394457;
      font-size: 13px;
      font-weight: 800;
    }
    .lineTable {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 12px;
    }
    .lineTable th,
    .lineTable td {
      vertical-align: top;
      border: 1px solid #e1e6ef;
      padding: 8px;
    }
    .lineTable th {
      background: #f6f8fb;
      text-align: left;
    }
    .lineTable td:first-child {
      width: 42px;
      color: #657184;
      font-weight: 800;
    }
    .empty {
      margin: 0;
      color: #697386;
      font-size: 12px;
    }
    .warnings {
      margin-top: 8px;
      border-color: #edd39d;
      background: #fffaf0;
    }
    @media (max-width: 980px) {
      body {
        padding: 10px;
      }
      .pageGrid,
      .blockGrid {
        grid-template-columns: 1fr;
      }
      .sourcePane {
        border-right: 0;
        border-bottom: 1px solid #e4e8ef;
      }
      .blockHeader {
        display: grid;
      }
      .chips {
        justify-content: flex-start;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>Segmented Gemini OCR Report</h1>
    <p class="summary">
      Created: ${htmlEscape(payload.createdAt)} /
      Model: ${htmlEscape(payload.model)} /
      Pages: ${payload.total} /
      Pipeline: layout -> crop -> block OCR -> ${payload.options.validate ? 'validation' : 'no validation'}
    </p>
  </header>
  ${pageSections}
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/contrib/auto-render.min.js"></script>
  <script>
    window.addEventListener('DOMContentLoaded', () => {
      if (!window.renderMathInElement) return;
      window.renderMathInElement(document.body, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '\\\\(', right: '\\\\)', display: false}
        ],
        throwOnError: false
      });
    });
  </script>
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
    `${options.dryRun ? 'Dry run' : 'Segmented OCR'}: ${files.length} page image(s), model ${options.model}`,
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
    options: {
      layoutOnly: options.layoutOnly,
      maxBlocks: options.maxBlocks || null,
      paddingRatio: options.paddingRatio,
      validate: options.validate,
    },
    results: [],
    total: files.length,
  };

  for (const [index, file] of files.entries()) {
    try {
      payload.results.push(
        await runPagePipeline({
          apiKey,
          file,
          options,
          pageIndex: index,
          total: files.length,
        }),
      );
    } catch (error) {
      payload.results.push({
        blocks: [],
        elapsedMs: 0,
        error: error.message,
        file: relativeToRepo(file),
        layout: fallbackLayout(),
        status: 'error',
      });
      console.log(`Page error: ${error.message}`);
    }

    if (options.delayMs > 0 && index < files.length - 1) {
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
