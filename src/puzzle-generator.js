import {
  MAX_GUESSES,
  MODE_CONFIGS,
  SEQUENCE_LENGTH,
  getModeConfig,
  isMode,
} from "./gate-catalog.js";

/**
 * @param {Date} [date]
 */
export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * @param {string} value
 */
export function hashString(value) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * @param {number} seed
 */
export function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {() => number} random
 * @param {string[]} tokenSet
 * @param {number} length
 */
export function sampleSequence(random, tokenSet, length = SEQUENCE_LENGTH) {
  const sequence = [];
  for (let i = 0; i < length; i += 1) {
    const pick = tokenSet[Math.floor(random() * tokenSet.length)];
    sequence.push(pick);
  }

  const allSame = sequence.every((token) => token === sequence[0]);
  if (allSame && tokenSet.length > 1) {
    const replacementIndex = Math.floor(random() * length);
    let replacement = sequence[replacementIndex];
    while (replacement === sequence[replacementIndex]) {
      replacement = tokenSet[Math.floor(random() * tokenSet.length)];
    }
    sequence[replacementIndex] = replacement;
  }

  return sequence;
}

/**
 * @param {keyof typeof MODE_CONFIGS} mode
 * @param {Date} [date]
 */
export function createDailyPuzzle(mode, date = new Date()) {
  if (!isMode(mode)) {
    throw new Error(`Unknown mode: ${mode}`);
  }

  const modeConfig = getModeConfig(mode);
  const dateKey = getLocalDateKey(date);
  const seedSource = `qwordle|${mode}|${dateKey}|v1`;
  const seed = hashString(seedSource);
  const random = mulberry32(seed);
  const answerTokens = sampleSequence(random, modeConfig.tokens, SEQUENCE_LENGTH);

  return {
    id: `daily:${mode}:${dateKey}`,
    mode,
    cadence: "daily",
    answerTokens,
    seedInfo: {
      dateKey,
      seed,
      source: seedSource,
    },
    sequenceLength: SEQUENCE_LENGTH,
    maxGuesses: MAX_GUESSES,
  };
}

/**
 * @param {keyof typeof MODE_CONFIGS} mode
 */
export function createRandomPuzzle(mode) {
  if (!isMode(mode)) {
    throw new Error(`Unknown mode: ${mode}`);
  }

  const modeConfig = getModeConfig(mode);
  const answerTokens = sampleSequence(Math.random, modeConfig.tokens, SEQUENCE_LENGTH);
  const randomPart = Math.floor(Math.random() * 1e12).toString(36);

  return {
    id: `random:${mode}:${Date.now().toString(36)}:${randomPart}`,
    mode,
    cadence: "random",
    answerTokens,
    seedInfo: {
      source: "Math.random",
    },
    sequenceLength: SEQUENCE_LENGTH,
    maxGuesses: MAX_GUESSES,
  };
}

/**
 * @param {keyof typeof MODE_CONFIGS} mode
 * @param {'daily' | 'random'} cadence
 * @param {Date} [date]
 */
export function createPuzzle(mode, cadence, date = new Date()) {
  if (cadence === "daily") {
    return createDailyPuzzle(mode, date);
  }
  return createRandomPuzzle(mode);
}
