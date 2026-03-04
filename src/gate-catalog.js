export const APP_STORAGE_VERSION = "v1";
export const SEQUENCE_LENGTH = 5;
export const MAX_GUESSES = 6;

/** @typedef {'beginner' | 'mixed' | 'advanced'} ModeId */
/** @typedef {'daily' | 'random'} Cadence */

const SINGLE_FAMILIES = ["X", "Y", "Z", "H", "S", "T"];
const MIXED_TOKENS = [...SINGLE_FAMILIES, "CX", "CZ", "SWAP"];
const ADVANCED_TOKENS = [...MIXED_TOKENS, "CCX", "CSWAP"];

/**
 * @type {Record<ModeId, {
 *   id: ModeId,
 *   label: string,
 *   qubits: number,
 *   tokens: string[]
 * }>}
 */
export const MODE_CONFIGS = {
  beginner: {
    id: "beginner",
    label: "Beginner",
    qubits: 1,
    tokens: SINGLE_FAMILIES,
  },
  mixed: {
    id: "mixed",
    label: "Mixed",
    qubits: 2,
    tokens: MIXED_TOKENS,
  },
  advanced: {
    id: "advanced",
    label: "Advanced",
    qubits: 3,
    tokens: ADVANCED_TOKENS,
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
