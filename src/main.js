import {
  createGameConfig,
  createNewGame,
  addToken,
  clearInput,
  recordGameResult,
  refreshGuessSimulations,
  removeToken,
  submitCurrentGuess,
} from "./game-engine.js";
import { createPuzzle } from "./puzzle-generator.js";
import {
  DEFAULT_CADENCE,
  DEFAULT_MODE,
  MAX_GUESSES,
  SEQUENCE_LENGTH,
  getModeConfig,
  isCadence,
  isMode,
} from "./gate-catalog.js";
import {
  loadActiveGame,
  loadSettings,
  loadStats,
  saveGame,
  saveSettings,
  saveStats,
} from "./storage.js";
import { buildShareText } from "./share.js";
import { formatTerms, simulateSequence, stateToTerms } from "./quantum/simulator.js";
import {
  buildMappingOptions,
  canCycleTokenMapping,
  mappingToSimulationToken,
  normalizeTokenMapping,
} from "./token-mapping.js";
import { createUI } from "./ui.js";

const SHARE_URL = "https://jaspersands.github.io/qwordle/";

/**
 * @typedef {{
 *   settings: { mode: import('./gate-catalog.js').ModeId, cadence: import('./gate-catalog.js').Cadence },
 *   modeConfig: ReturnType<typeof getModeConfig>,
 *   gameState: import('./game-engine.js').GameState,
 *   currentInputMappings: string[],
 *   stats: import('./game-engine.js').Stats,
 *   message: string,
 *   targetStateText: string,
 * }} AppState
 */

/**
 * @param {any} game
 * @param {string} mode
 * @param {string} cadence
 */
function isUsableGame(game, mode, cadence) {
  if (!game || typeof game !== "object") {
    return false;
  }

  if (!game.config || !game.puzzle) {
    return false;
  }

  if (game.config.mode !== mode || game.config.cadence !== cadence) {
    return false;
  }

  if (game.puzzle.mode !== mode || game.puzzle.cadence !== cadence) {
    return false;
  }

  if (!Array.isArray(game.guesses) || !Array.isArray(game.currentInput)) {
    return false;
  }

  if (!Number.isInteger(game.currentRow) || game.currentRow < 0 || game.currentRow > MAX_GUESSES) {
    return false;
  }

  if (!["in_progress", "won", "lost"].includes(game.status)) {
    return false;
  }

  const modeConfig = getModeConfig(mode);
  const allowedTokens = new Set(modeConfig.tokens);
  const isValidToken = (token) => typeof token === "string" && allowedTokens.has(token);

  if (
    !Array.isArray(game.puzzle.answerTokens) ||
    game.puzzle.answerTokens.length !== SEQUENCE_LENGTH ||
    !game.puzzle.answerTokens.every(isValidToken)
  ) {
    return false;
  }

  if (game.currentInput.length > SEQUENCE_LENGTH || !game.currentInput.every(isValidToken)) {
    return false;
  }

  for (const guess of game.guesses) {
    if (!guess || typeof guess !== "object") {
      return false;
    }

    if (
      !Array.isArray(guess.tokens) ||
      guess.tokens.length !== SEQUENCE_LENGTH ||
      !guess.tokens.every(isValidToken)
    ) {
      return false;
    }

    if (
      !Array.isArray(guess.marks) ||
      guess.marks.length !== SEQUENCE_LENGTH ||
      !guess.marks.every((mark) => mark === "correct" || mark === "present" || mark === "absent")
    ) {
      return false;
    }
  }

  return true;
}

function getShareLink() {
  return SHARE_URL;
}

/**
 * @param {string} text
 * @param {string} link
 */
async function shareOrCopy(text, link) {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: "QWordle",
        text,
        url: link,
      });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return "copied";
  }

  throw new Error("Sharing is not supported in this browser.");
}

/**
 * @param {string[]} tokens
 * @param {ReturnType<typeof getModeConfig>} modeConfig
 * @param {string[]} [existing]
 */
function buildCurrentInputMappings(tokens, modeConfig, existing = []) {
  return tokens.map((token, index) =>
    normalizeTokenMapping(token, modeConfig.qubits, existing[index]),
  );
}

/**
 * @param {ReturnType<typeof getModeConfig>} modeConfig
 * @param {import('./game-engine.js').GameState} gameState
 */
function computeTargetStateText(modeConfig, gameState) {
  try {
    const simulationTokens = gameState.puzzle.answerTokens.map((token) =>
      mappingToSimulationToken(token, modeConfig.qubits, undefined),
    );
    const targetState = simulateSequence(modeConfig.qubits, simulationTokens);
    return formatTerms(stateToTerms(targetState, modeConfig.qubits));
  } catch (error) {
    return error instanceof Error ? `Target simulation error: ${error.message}` : "Target simulation error.";
  }
}

function refreshSimulationViews() {
  state.gameState = refreshGuessSimulations(state.gameState, state.modeConfig);
  state.targetStateText = computeTargetStateText(state.modeConfig, state.gameState);
}

/**
 * @param {import('./gate-catalog.js').ModeId} mode
 * @param {import('./gate-catalog.js').Cadence} cadence
 * @param {boolean} forceNew
 */
function resolveGame(mode, cadence, forceNew = false) {
  const config = createGameConfig(mode, cadence);

  if (cadence === "daily") {
    const todayPuzzle = createPuzzle(mode, "daily");

    if (!forceNew) {
      const stored = loadActiveGame(mode, cadence);
      if (
        isUsableGame(stored, mode, cadence) &&
        stored.puzzle.id === todayPuzzle.id &&
        stored.status === "in_progress"
      ) {
        return stored;
      }
    }

    return createNewGame(todayPuzzle, config);
  }

  if (!forceNew) {
    const stored = loadActiveGame(mode, cadence);
    if (isUsableGame(stored, mode, cadence) && stored.status === "in_progress") {
      return stored;
    }
  }

  const randomPuzzle = createPuzzle(mode, "random");
  return createNewGame(randomPuzzle, config);
}

const initialSettings = loadSettings();
const mode = isMode(initialSettings.mode) ? initialSettings.mode : DEFAULT_MODE;
const cadence = isCadence(initialSettings.cadence) ? initialSettings.cadence : DEFAULT_CADENCE;
const initialModeConfig = getModeConfig(mode);
const initialGameState = resolveGame(mode, cadence);

/** @type {AppState} */
const state = {
  settings: {
    mode,
    cadence,
  },
  modeConfig: initialModeConfig,
  gameState: refreshGuessSimulations(initialGameState, initialModeConfig),
  currentInputMappings: buildCurrentInputMappings(initialGameState.currentInput, initialModeConfig),
  stats: loadStats(mode, cadence),
  message: "",
  targetStateText: "",
};
state.targetStateText = computeTargetStateText(state.modeConfig, state.gameState);

saveSettings(state.settings);
saveGame(state.gameState);

const ui = createUI({
  onModeChange(nextMode) {
    if (!isMode(nextMode) || nextMode === state.settings.mode) {
      return;
    }

    state.settings.mode = nextMode;
    state.modeConfig = getModeConfig(nextMode);
    state.gameState = resolveGame(nextMode, state.settings.cadence);
    state.currentInputMappings = buildCurrentInputMappings(state.gameState.currentInput, state.modeConfig);
    state.stats = loadStats(nextMode, state.settings.cadence);
    state.message = `Mode changed to ${state.modeConfig.label}.`;
    refreshSimulationViews();

    saveSettings(state.settings);
    saveGame(state.gameState);
    render();
  },

  onCadenceChange(nextCadence) {
    if (!isCadence(nextCadence) || nextCadence === state.settings.cadence) {
      return;
    }

    state.settings.cadence = nextCadence;
    state.gameState = resolveGame(state.settings.mode, nextCadence);
    state.currentInputMappings = buildCurrentInputMappings(state.gameState.currentInput, state.modeConfig);
    state.stats = loadStats(state.settings.mode, nextCadence);
    state.message = nextCadence === "daily" ? "Daily puzzle loaded." : "Unlimited random mode loaded.";
    refreshSimulationViews();

    saveSettings(state.settings);
    saveGame(state.gameState);
    render();
  },

  onToken(token) {
    const nextGame = addToken(state.gameState, token);
    if (nextGame === state.gameState) {
      if (state.gameState.status !== "in_progress") {
        state.message = "Puzzle is complete. Start a new one to keep playing.";
      }
      render();
      return;
    }

    state.gameState = nextGame;
    state.currentInputMappings = buildCurrentInputMappings(
      state.gameState.currentInput,
      state.modeConfig,
      state.currentInputMappings,
    );
    state.message = "";
    saveGame(state.gameState);
    render();
  },

  onBoardCellClick(index) {
    if (state.gameState.status !== "in_progress") {
      return;
    }

    const token = state.gameState.currentInput[index];
    if (!token) {
      return;
    }

    if (!canCycleTokenMapping(token, state.modeConfig.qubits)) {
      return;
    }

    const options = buildMappingOptions(token, state.modeConfig.qubits);
    if (options.length <= 1) {
      return;
    }

    const current = normalizeTokenMapping(token, state.modeConfig.qubits, state.currentInputMappings[index]);
    const currentIndex = options.indexOf(current);
    const nextIndex = (currentIndex + 1) % options.length;
    state.currentInputMappings[index] = options[nextIndex];
    state.message = "";
    render();
  },

  onBackspace() {
    state.gameState = removeToken(state.gameState);
    state.currentInputMappings = buildCurrentInputMappings(
      state.gameState.currentInput,
      state.modeConfig,
      state.currentInputMappings,
    );
    state.message = "";
    saveGame(state.gameState);
    render();
  },

  onClear() {
    state.gameState = clearInput(state.gameState);
    state.currentInputMappings = [];
    state.message = "";
    saveGame(state.gameState);
    render();
  },

  onSubmit() {
    const previousStatus = state.gameState.status;
    const result = submitCurrentGuess(state.gameState, state.modeConfig, state.currentInputMappings);

    if (!result.ok) {
      state.message = result.error;
      render();
      return;
    }

    state.gameState = result.gameState;
    state.currentInputMappings = [];

    if (result.completedNow && previousStatus === "in_progress") {
      const won = state.gameState.status === "won";
      const guessesUsed = state.gameState.guesses.length;
      state.stats = recordGameResult(state.stats, won, guessesUsed);
      saveStats(state.settings.mode, state.settings.cadence, state.stats);

      if (won) {
        state.message = `Solved in ${guessesUsed}/${MAX_GUESSES}.`;
      } else {
        state.message = `Out of guesses. Answer: ${state.gameState.puzzle.answerTokens.join(" ")}`;
      }
    } else if (result.evaluation.equivalent) {
      state.message = "Quantum-equivalent state. Token order still matters for the win.";
    } else {
      state.message = `Guess ${state.gameState.guesses.length}/${MAX_GUESSES} submitted.`;
    }

    saveGame(state.gameState);
    render();
  },

  async onShare() {
    if (state.gameState.guesses.length === 0) {
      state.message = "Make at least one guess before sharing.";
      render();
      return;
    }

    const link = getShareLink();
    const text = buildShareText({
      modeLabel: state.modeConfig.label,
      cadence: state.settings.cadence,
      status: state.gameState.status,
      guesses: state.gameState.guesses,
      maxGuesses: MAX_GUESSES,
      link,
    });

    try {
      const outcome = await shareOrCopy(text, link);
      if (outcome === "shared") {
        state.message = "Shared.";
      } else if (outcome === "copied") {
        state.message = "Share text copied to clipboard.";
      }
    } catch (error) {
      state.message = error instanceof Error ? error.message : "Unable to share.";
    }

    render();
  },

  onNewPuzzle() {
    const forceNew = true;
    state.gameState = resolveGame(state.settings.mode, state.settings.cadence, forceNew);
    state.currentInputMappings = buildCurrentInputMappings(state.gameState.currentInput, state.modeConfig);
    state.message =
      state.settings.cadence === "daily"
        ? "Daily puzzle restarted."
        : "New random puzzle generated.";
    refreshSimulationViews();

    saveGame(state.gameState);
    render();
  },

  onOpenStats() {
    ui.openStatsModal();
  },

  onCloseStats() {
    ui.closeStatsModal();
  },
});

function render() {
  ui.render({
    settings: state.settings,
    modeConfig: state.modeConfig,
    gameState: state.gameState,
    currentInputMappings: state.currentInputMappings,
    stats: state.stats,
    message: state.message,
    targetStateText: state.targetStateText,
  });
}

render();
