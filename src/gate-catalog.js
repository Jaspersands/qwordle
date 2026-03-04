export const APP_STORAGE_VERSION = "v1";
export const SEQUENCE_LENGTH = 5;
export const MAX_GUESSES = 6;

/** @typedef {'beginner' | 'mixed' | 'advanced'} ModeId */
/** @typedef {'daily' | 'random'} Cadence */

const SINGLE_FAMILIES = ["X", "Y", "Z", "H", "S", "T"];
const MIXED_TOKENS = [...SINGLE_FAMILIES, "CX", "CZ", "SWAP"];
const ADVANCED_TOKENS = [...MIXED_TOKENS, "CCX", "CSWAP"];

const BEGINNER_TOKEN_HINTS = Object.fromEntries(
  SINGLE_FAMILIES.map((gate) => [gate, `${gate}: apply to q0`]),
);

const INTERMEDIATE_TOKEN_HINTS = {
  ...BEGINNER_TOKEN_HINTS,
  CX: "CX: defaults to q0->q1, click tile to change",
  CZ: "CZ: defaults to q0->q1, click tile to change",
  SWAP: "SWAP: defaults to q0<->q1, click tile to change",
};

const ADVANCED_TOKEN_HINTS = {
  ...INTERMEDIATE_TOKEN_HINTS,
  CCX: "CCX: defaults to q0,q1->q2, click tile to change",
  CSWAP: "CSWAP: defaults to q0;q1<->q2, click tile to change",
};

/**
 * @type {Record<ModeId, {
 *   id: ModeId,
 *   label: string,
 *   qubits: number,
 *   tokens: string[],
 *   guideLines: string[],
 *   tokenHints: Record<string, string>,
 * }>}
 */
export const MODE_CONFIGS = {
  beginner: {
    id: "beginner",
    label: "Beginner",
    qubits: 1,
    tokens: SINGLE_FAMILIES,
    guideLines: ["Single-qubit gates (X, Y, Z, H, S, T) act on q0."],
    tokenHints: BEGINNER_TOKEN_HINTS,
  },
  mixed: {
    id: "mixed",
    label: "Intermediate",
    qubits: 2,
    tokens: MIXED_TOKENS,
    guideLines: [
      "By default: single gates use q0, and CX/CZ/SWAP use q0,q1.",
      "Click a gate tile in the active row to cycle its qubit mapping.",
    ],
    tokenHints: INTERMEDIATE_TOKEN_HINTS,
  },
  advanced: {
    id: "advanced",
    label: "Advanced",
    qubits: 3,
    tokens: ADVANCED_TOKENS,
    guideLines: [
      "By default: single gates use q0, pair gates use q0,q1, and CCX/CSWAP use q0,q1,q2.",
      "Click a gate tile in the active row to cycle its qubit mapping.",
    ],
    tokenHints: ADVANCED_TOKEN_HINTS,
  },
};

export const DEFAULT_MODE = "beginner";
export const DEFAULT_CADENCE = "daily";

/** @returns {ModeId[]} */
export function listModes() {
  return /** @type {ModeId[]} */ (Object.keys(MODE_CONFIGS));
}

/** @returns {Cadence[]} */
export function listCadences() {
  return ["daily", "random"];
}

/**
 * @param {string} mode
 * @returns {mode is ModeId}
 */
export function isMode(mode) {
  return Object.prototype.hasOwnProperty.call(MODE_CONFIGS, mode);
}

/**
 * @param {string} cadence
 * @returns {cadence is Cadence}
 */
export function isCadence(cadence) {
  return cadence === "daily" || cadence === "random";
}

/**
 * @param {ModeId} mode
 */
export function getModeConfig(mode) {
  return MODE_CONFIGS[mode];
}
