import {
  APP_STORAGE_VERSION,
  DEFAULT_CADENCE,
  DEFAULT_MODE,
  isCadence,
  isMode,
} from "./gate-catalog.js";
import { createEmptyStats } from "./game-engine.js";

const ROOT = `qwordle:${APP_STORAGE_VERSION}`;
const SETTINGS_KEY = `${ROOT}:settings`;
const GLOBAL_STATS_KEY = `${ROOT}:stats:global`;

const inMemoryFallback = (() => {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
  };
})();

/**
 * @param {Storage | undefined} provided
 */
function getStore(provided) {
  if (provided) {
    return provided;
  }

  // Fall back to in-memory storage if localStorage is blocked/unavailable.
  try {
    const store = globalThis.localStorage;
    if (!store) {
      return inMemoryFallback;
    }
    const probe = `${ROOT}:probe`;
    store.setItem(probe, "1");
    store.removeItem(probe);
    return store;
  } catch {
    return inMemoryFallback;
  }
}

/**
 * @param {string | null} value
 */
function parseJson(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * @param {string} mode
 * @param {string} cadence
 */
function activeGameKey(mode, cadence) {
  return `${ROOT}:active:${mode}:${cadence}`;
}

/**
 * @param {string} mode
 * @param {string} cadence
 * @param {string} puzzleId
 */
export function getGameKey(mode, cadence, puzzleId) {
  return `${ROOT}:game:${mode}:${cadence}:${puzzleId}`;
}

/**
 * @param {string} mode
 * @param {string} cadence
 */
export function getStatsKey(mode, cadence) {
  return `${ROOT}:stats:${mode}:${cadence}`;
}

/**
 * @param {Storage} [store]
 */
export function loadSettings(store) {
  const resolvedStore = getStore(store);
  const parsed = parseJson(resolvedStore.getItem(SETTINGS_KEY));

  if (!parsed || typeof parsed !== "object") {
    return {
      mode: DEFAULT_MODE,
      cadence: DEFAULT_CADENCE,
    };
  }

  return {
    mode: isMode(parsed.mode) ? parsed.mode : DEFAULT_MODE,
    cadence: isCadence(parsed.cadence) ? parsed.cadence : DEFAULT_CADENCE,
  };
}

/**
 * @param {{ mode: string, cadence: string }} settings
 * @param {Storage} [store]
 */
export function saveSettings(settings, store) {
  const resolvedStore = getStore(store);
  resolvedStore.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      mode: isMode(settings.mode) ? settings.mode : DEFAULT_MODE,
      cadence: isCadence(settings.cadence) ? settings.cadence : DEFAULT_CADENCE,
    }),
  );
}

/**
 * @param {any} stats
 */
function sanitizeStats(stats) {
  const fallback = createEmptyStats();
  if (!stats || typeof stats !== "object") {
    return fallback;
  }

  const distribution = Array.isArray(stats.guessDistribution)
    ? stats.guessDistribution.slice(0, 6)
    : fallback.guessDistribution;

  while (distribution.length < 6) {
    distribution.push(0);
  }

  return {
    played: Number.isFinite(stats.played) ? Math.max(0, Number(stats.played)) : 0,
    won: Number.isFinite(stats.won) ? Math.max(0, Number(stats.won)) : 0,
    currentStreak: Number.isFinite(stats.currentStreak)
      ? Math.max(0, Number(stats.currentStreak))
      : 0,
    maxStreak: Number.isFinite(stats.maxStreak) ? Math.max(0, Number(stats.maxStreak)) : 0,
    guessDistribution: distribution.map((value) =>
      Number.isFinite(value) ? Math.max(0, Number(value)) : 0,
    ),
  };
}

/**
 * @param {import('./game-engine.js').Stats} base
 * @param {import('./game-engine.js').Stats} next
 */
function mergeStats(base, next) {
  return {
    played: base.played + next.played,
    won: base.won + next.won,
    currentStreak: Math.max(base.currentStreak, next.currentStreak),
    maxStreak: Math.max(base.maxStreak, next.maxStreak),
    guessDistribution: base.guessDistribution.map((count, index) => count + next.guessDistribution[index]),
  };
}

/**
 * @param {Storage} store
 */
function loadLegacyStatsAggregate(store) {
  if (typeof store.length !== "number" || typeof store.key !== "function") {
    return null;
  }

  let found = false;
  let merged = createEmptyStats();

  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (!key || !key.startsWith(`${ROOT}:stats:`) || key === GLOBAL_STATS_KEY) {
      continue;
    }

    const parsed = parseJson(store.getItem(key));
    if (!parsed || typeof parsed !== "object") {
      continue;
    }

    found = true;
    merged = mergeStats(merged, sanitizeStats(parsed));
  }

  return found ? merged : null;
}

/**
 * @param {string} mode
 * @param {string} cadence
 * @param {Storage} [store]
 */
export function loadStats(mode, cadence, store) {
  const resolvedStore = getStore(store);
  const globalParsed = parseJson(resolvedStore.getItem(GLOBAL_STATS_KEY));
  if (globalParsed && typeof globalParsed === "object") {
    return sanitizeStats(globalParsed);
  }

  const scopedParsed = parseJson(resolvedStore.getItem(getStatsKey(mode, cadence)));
  if (scopedParsed && typeof scopedParsed === "object") {
    const sanitized = sanitizeStats(scopedParsed);
    resolvedStore.setItem(GLOBAL_STATS_KEY, JSON.stringify(sanitized));
    return sanitized;
  }

  const legacyMerged = loadLegacyStatsAggregate(resolvedStore);
  if (legacyMerged) {
    resolvedStore.setItem(GLOBAL_STATS_KEY, JSON.stringify(legacyMerged));
    return legacyMerged;
  }

  return createEmptyStats();
}

/**
 * @param {string} mode
 * @param {string} cadence
 * @param {import('./game-engine.js').Stats} stats
 * @param {Storage} [store]
 */
export function saveStats(mode, cadence, stats, store) {
  const resolvedStore = getStore(store);
  const sanitized = sanitizeStats(stats);
  resolvedStore.setItem(getStatsKey(mode, cadence), JSON.stringify(sanitized));
  resolvedStore.setItem(GLOBAL_STATS_KEY, JSON.stringify(sanitized));
}

/**
 * @param {import('./game-engine.js').GameState} gameState
 * @param {Storage} [store]
 */
export function saveGame(gameState, store) {
  const resolvedStore = getStore(store);
  const { mode, cadence } = gameState.config;
  const puzzleId = gameState.puzzle.id;
  resolvedStore.setItem(getGameKey(mode, cadence, puzzleId), JSON.stringify(gameState));
  resolvedStore.setItem(activeGameKey(mode, cadence), puzzleId);
}

/**
 * @param {string} mode
 * @param {string} cadence
 * @param {string} puzzleId
 * @param {Storage} [store]
 */
export function loadGame(mode, cadence, puzzleId, store) {
  const resolvedStore = getStore(store);
  const parsed = parseJson(resolvedStore.getItem(getGameKey(mode, cadence, puzzleId)));
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  return parsed;
}

/**
 * @param {string} mode
 * @param {string} cadence
 * @param {Storage} [store]
 */
export function loadActiveGame(mode, cadence, store) {
  const resolvedStore = getStore(store);
  const activePuzzleId = resolvedStore.getItem(activeGameKey(mode, cadence));
  if (!activePuzzleId) {
    return null;
  }

  return loadGame(mode, cadence, activePuzzleId, resolvedStore);
}

/**
 * @param {string} mode
 * @param {string} cadence
 * @param {Storage} [store]
 */
export function clearActiveGame(mode, cadence, store) {
  const resolvedStore = getStore(store);
  resolvedStore.removeItem(activeGameKey(mode, cadence));
}
