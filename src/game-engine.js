import { evaluateGuess } from "./feedback.js";
import { MAX_GUESSES, SEQUENCE_LENGTH } from "./gate-catalog.js";
import {
  computeFidelity,
  formatTerms,
  roundFidelity,
  simulateSequence,
  stateToTerms,
} from "./quantum/simulator.js";

/** @typedef {'beginner' | 'mixed' | 'advanced'} ModeId */
/** @typedef {'daily' | 'random'} Cadence */

/**
 * @typedef {Object} GameConfig
 * @property {ModeId} mode
 * @property {Cadence} cadence
 * @property {5} sequenceLength
 * @property {6} maxGuesses
 */

/**
 * @typedef {Object} Puzzle
 * @property {string} id
 * @property {ModeId} mode
 * @property {Cadence} cadence
 * @property {string[]} answerTokens
 * @property {unknown} seedInfo
 */

/**
 * @typedef {Object} GuessEvaluation
 * @property {string[]} tokens
 * @property {('correct' | 'present' | 'absent')[]} marks
 * @property {number} fidelity
 * @property {boolean} won
 * @property {boolean} equivalent
 * @property {string} guessStateText
 * @property {string} targetStateText
 * @property {Array<{ basis: string, ket: string, amplitude: string, magnitude: number }>} guessTerms
 * @property {Array<{ basis: string, ket: string, amplitude: string, magnitude: number }>} targetTerms
 */

/**
 * @typedef {Object} GameState
 * @property {GameConfig} config
 * @property {Puzzle} puzzle
 * @property {GuessEvaluation[]} guesses
 * @property {string[]} currentInput
 * @property {number} currentRow
 * @property {'in_progress' | 'won' | 'lost'} status
 */

/**
 * @typedef {Object} Stats
 * @property {number} played
 * @property {number} won
 * @property {number} currentStreak
 * @property {number} maxStreak
 * @property {number[]} guessDistribution
 */

/**
 * @param {ModeId} mode
 * @param {Cadence} cadence
 * @returns {GameConfig}
 */
export function createGameConfig(mode, cadence) {
  return {
    mode,
    cadence,
    sequenceLength: SEQUENCE_LENGTH,
    maxGuesses: MAX_GUESSES,
  };
}

/**
 * @returns {Stats}
 */
export function createEmptyStats() {
  return {
    played: 0,
    won: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: new Array(MAX_GUESSES).fill(0),
  };
}

/**
 * @param {Puzzle} puzzle
 * @param {GameConfig} [config]
 * @returns {GameState}
 */
export function createNewGame(puzzle, config = createGameConfig(puzzle.mode, puzzle.cadence)) {
  return {
    config,
    puzzle,
    guesses: [],
    currentInput: [],
    currentRow: 0,
    status: "in_progress",
  };
}

/**
 * @param {GameState} gameState
 * @param {string} token
 */
export function addToken(gameState, token) {
  if (gameState.status !== "in_progress") {
    return gameState;
  }
  if (gameState.currentInput.length >= gameState.config.sequenceLength) {
    return gameState;
  }
  return {
    ...gameState,
    currentInput: [...gameState.currentInput, token],
  };
}

/**
 * @param {GameState} gameState
 */
export function removeToken(gameState) {
  if (gameState.status !== "in_progress" || gameState.currentInput.length === 0) {
    return gameState;
  }
  return {
    ...gameState,
    currentInput: gameState.currentInput.slice(0, -1),
  };
}

/**
 * @param {GameState} gameState
 */
export function clearInput(gameState) {
  if (gameState.status !== "in_progress") {
    return gameState;
  }
  return {
    ...gameState,
    currentInput: [],
  };
}

/**
 * @param {GameState} gameState
 * @param {string[]} tokens
 */
export function setCurrentInput(gameState, tokens) {
  return {
    ...gameState,
    currentInput: tokens.slice(0, gameState.config.sequenceLength),
  };
}

/**
 * @param {GameState} gameState
 */
export function isGameComplete(gameState) {
  return gameState.status === "won" || gameState.status === "lost";
}

/**
 * @param {GameState} gameState
 * @param {{ qubits: number, tokens: string[] }} modeConfig
 */
export function submitCurrentGuess(gameState, modeConfig) {
  if (gameState.status !== "in_progress") {
    return { ok: false, error: "This puzzle is already complete." };
  }

  if (gameState.currentInput.length !== gameState.config.sequenceLength) {
    return {
      ok: false,
      error: `Guess must contain exactly ${gameState.config.sequenceLength} gate tokens.`,
    };
  }

  const invalidToken = gameState.currentInput.find((token) => !modeConfig.tokens.includes(token));
  if (invalidToken) {
    return {
      ok: false,
      error: `Token ${invalidToken} is invalid for this mode.`,
    };
  }

  const guessTokens = [...gameState.currentInput];
  const answerTokens = gameState.puzzle.answerTokens;
  const { marks, won } = evaluateGuess(guessTokens, answerTokens);

  let fidelity = 0;
  let guessTerms = [];
  let targetTerms = [];
  let guessStateText = "";
  let targetStateText = "";

  try {
    const guessState = simulateSequence(modeConfig.qubits, guessTokens);
    const targetState = simulateSequence(modeConfig.qubits, answerTokens);
    fidelity = roundFidelity(computeFidelity(guessState, targetState));
    guessTerms = stateToTerms(guessState, modeConfig.qubits);
    targetTerms = stateToTerms(targetState, modeConfig.qubits);
    guessStateText = formatTerms(guessTerms);
    targetStateText = formatTerms(targetTerms);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Simulation failed.",
    };
  }

  const equivalent = !won && Math.abs(1 - fidelity) < 1e-9;

  const evaluation = {
    tokens: guessTokens,
    marks,
    fidelity,
    won,
    equivalent,
    guessStateText,
    targetStateText,
    guessTerms,
    targetTerms,
  };

  const nextGuesses = [...gameState.guesses, evaluation];
  const nextRow = gameState.currentRow + 1;

  let nextStatus = "in_progress";
  if (won) {
    nextStatus = "won";
  } else if (nextRow >= gameState.config.maxGuesses) {
    nextStatus = "lost";
  }

  const nextState = {
    ...gameState,
    guesses: nextGuesses,
    currentInput: [],
    currentRow: nextRow,
    status: nextStatus,
  };

  return {
    ok: true,
    evaluation,
    completedNow: gameState.status === "in_progress" && nextStatus !== "in_progress",
    gameState: nextState,
  };
}

/**
 * @param {Stats} stats
 * @param {boolean} won
 * @param {number} guessesUsed
 * @returns {Stats}
 */
export function recordGameResult(stats, won, guessesUsed) {
  const next = {
    ...stats,
    played: stats.played + 1,
    won: stats.won + (won ? 1 : 0),
    currentStreak: won ? stats.currentStreak + 1 : 0,
    maxStreak: stats.maxStreak,
    guessDistribution: [...stats.guessDistribution],
  };

  if (won) {
    const distIndex = Math.max(0, Math.min(MAX_GUESSES - 1, guessesUsed - 1));
    next.guessDistribution[distIndex] += 1;
    if (next.currentStreak > next.maxStreak) {
      next.maxStreak = next.currentStreak;
    }
  }

  return next;
}
