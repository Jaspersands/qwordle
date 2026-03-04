import { MAX_GUESSES, SEQUENCE_LENGTH } from "./gate-catalog.js";
import { mergeMark } from "./feedback.js";

/**
 * @param {string} id
 */
function mustGetElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }
  return element;
}

/**
 * @param {Array<{ tokens: string[], marks: ('correct' | 'present' | 'absent')[] }>} guesses
 */
export function deriveKeyboardMarks(guesses) {
  /** @type {Record<string, 'correct' | 'present' | 'absent'>} */
  const marks = {};

  for (const guess of guesses) {
    for (let i = 0; i < guess.tokens.length; i += 1) {
      const token = guess.tokens[i];
      marks[token] = mergeMark(marks[token], guess.marks[i]);
    }
  }

  return marks;
}

/**
 * @param {{
 *   onModeChange: (mode: string) => void,
 *   onCadenceChange: (cadence: string) => void,
 *   onToken: (token: string) => void,
 *   onBackspace: () => void,
 *   onClear: () => void,
 *   onSubmit: () => void,
 *   onShare: () => void,
 *   onNewPuzzle: () => void,
 *   onOpenStats: () => void,
 *   onCloseStats: () => void,
 * }} handlers
 */
export function createUI(handlers) {
  const elements = {
    modeSelect: /** @type {HTMLSelectElement} */ (mustGetElement("mode-select")),
    cadenceSelect: /** @type {HTMLSelectElement} */ (mustGetElement("cadence-select")),
    newGameButton: /** @type {HTMLButtonElement} */ (mustGetElement("new-game-btn")),
    board: mustGetElement("board"),
    currentInput: mustGetElement("current-input"),
    keyboard: mustGetElement("keyboard"),
    statusMessage: mustGetElement("status-message"),
    fidelityValue: mustGetElement("fidelity-value"),
    equivalentMessage: mustGetElement("equivalent-message"),
    guessState: mustGetElement("guess-state"),
    targetState: mustGetElement("target-state"),
    answerSection: mustGetElement("answer-section"),
    answerReveal: mustGetElement("answer-reveal"),
    backspaceButton: /** @type {HTMLButtonElement} */ (mustGetElement("backspace-btn")),
    clearButton: /** @type {HTMLButtonElement} */ (mustGetElement("clear-btn")),
    submitButton: /** @type {HTMLButtonElement} */ (mustGetElement("submit-btn")),
    shareButton: /** @type {HTMLButtonElement} */ (mustGetElement("share-btn")),
    statsButton: /** @type {HTMLButtonElement} */ (mustGetElement("stats-button")),
    statsModal: /** @type {HTMLDialogElement} */ (mustGetElement("stats-modal")),
    closeStatsButton: /** @type {HTMLButtonElement} */ (mustGetElement("close-stats-btn")),
    statsContent: mustGetElement("stats-content"),
  };

  elements.modeSelect.addEventListener("change", (event) => {
    const target = /** @type {HTMLSelectElement} */ (event.target);
    handlers.onModeChange(target.value);
  });

  elements.cadenceSelect.addEventListener("change", (event) => {
    const target = /** @type {HTMLSelectElement} */ (event.target);
    handlers.onCadenceChange(target.value);
  });

  elements.keyboard.addEventListener("click", (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const button = target.closest("button[data-token]");
    if (!button) {
      return;
    }
    const token = button.getAttribute("data-token");
    if (token) {
      handlers.onToken(token);
    }
  });

  elements.backspaceButton.addEventListener("click", handlers.onBackspace);
  elements.clearButton.addEventListener("click", handlers.onClear);
  elements.submitButton.addEventListener("click", handlers.onSubmit);
  elements.shareButton.addEventListener("click", handlers.onShare);
  elements.newGameButton.addEventListener("click", handlers.onNewPuzzle);
  elements.statsButton.addEventListener("click", handlers.onOpenStats);
  elements.closeStatsButton.addEventListener("click", handlers.onCloseStats);

  elements.statsModal.addEventListener("click", (event) => {
    const rect = elements.statsModal.getBoundingClientRect();
    const isInDialog =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;

    if (!isInDialog) {
      handlers.onCloseStats();
    }
  });

  /**
   * @param {string[]} tokens
   */
  function renderCurrentInput(tokens) {
    elements.currentInput.innerHTML = "";
    for (let i = 0; i < SEQUENCE_LENGTH; i += 1) {
      const tile = document.createElement("div");
      tile.className = "current-token";
      tile.textContent = tokens[i] ?? "";
      elements.currentInput.appendChild(tile);
    }
  }

  /**
   * @param {import('./game-engine.js').GameState} gameState
   */
  function renderBoard(gameState) {
    elements.board.innerHTML = "";

    for (let row = 0; row < MAX_GUESSES; row += 1) {
      const rowElement = document.createElement("div");
      rowElement.className = "board-row";
      const guess = gameState.guesses[row];

      for (let col = 0; col < SEQUENCE_LENGTH; col += 1) {
        const cell = document.createElement("div");
        cell.className = "cell";

        if (guess) {
          cell.textContent = guess.tokens[col] ?? "";
          cell.classList.add(guess.marks[col] ?? "absent");
        } else if (row === gameState.guesses.length && gameState.status === "in_progress") {
          const token = gameState.currentInput[col] ?? "";
          cell.textContent = token;
          if (token) {
            cell.classList.add("pending");
          }
        }

        rowElement.appendChild(cell);
      }

      elements.board.appendChild(rowElement);
    }
  }

  /**
   * @param {string[]} tokens
   * @param {Record<string, 'correct' | 'present' | 'absent'>} keyboardMarks
   * @param {boolean} disabled
   */
  function renderKeyboard(tokens, keyboardMarks, disabled) {
    elements.keyboard.innerHTML = "";

    for (const token of tokens) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "key-btn";
      button.textContent = token;
      button.dataset.token = token;
      button.disabled = disabled;

      const mark = keyboardMarks[token];
      if (mark) {
        button.classList.add(mark);
      }

      elements.keyboard.appendChild(button);
    }
  }

  /**
   * @param {import('./game-engine.js').Stats} stats
   */
  function renderStats(stats) {
    const winRate = stats.played === 0 ? 0 : (stats.won / stats.played) * 100;
    const maxCount = Math.max(1, ...stats.guessDistribution);

    const distributionRows = stats.guessDistribution
      .map((count, index) => {
        const width = Math.max(4, Math.round((count / maxCount) * 100));
        return `
          <div class="dist-row">
            <span>${index + 1}</span>
            <div class="dist-bar" style="width:${width}%"></div>
            <span>${count}</span>
          </div>
        `;
      })
      .join("");

    elements.statsContent.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-label">Played</div><div class="stat-value">${stats.played}</div></div>
        <div class="stat-card"><div class="stat-label">Won</div><div class="stat-value">${stats.won}</div></div>
        <div class="stat-card"><div class="stat-label">Win Rate</div><div class="stat-value">${winRate.toFixed(0)}%</div></div>
        <div class="stat-card"><div class="stat-label">Streak</div><div class="stat-value">${stats.currentStreak}</div></div>
      </div>
      <h3>Guess Distribution</h3>
      ${distributionRows}
    `;
  }

  /**
   * @param {{
   *   settings: { mode: string, cadence: string },
 *   modeConfig: { tokens: string[] },
 *   gameState: import('./game-engine.js').GameState,
 *   stats: import('./game-engine.js').Stats,
 *   message: string,
 *   targetStateText: string,
 * }} viewModel
 */
  function render(viewModel) {
    const { settings, modeConfig, gameState, stats, message, targetStateText } = viewModel;

    elements.modeSelect.value = settings.mode;
    elements.cadenceSelect.value = settings.cadence;

    elements.newGameButton.textContent =
      settings.cadence === "random" ? "New Random Puzzle" : "Restart Daily Puzzle";

    renderBoard(gameState);
    renderCurrentInput(gameState.currentInput);

    const keyboardMarks = deriveKeyboardMarks(gameState.guesses);
    renderKeyboard(modeConfig.tokens, keyboardMarks, gameState.status !== "in_progress");

    elements.submitButton.disabled = gameState.status !== "in_progress";
    elements.shareButton.disabled = gameState.guesses.length === 0;

    let statusText = message || "Pick tokens from the keyboard to build your guess.";
    if (!message && gameState.status === "won") {
      statusText = `Solved in ${gameState.guesses.length}/${MAX_GUESSES}!`;
    }
    if (!message && gameState.status === "lost") {
      statusText = "No guesses left.";
    }

    elements.statusMessage.textContent = statusText;

    if (gameState.guesses.length === 0) {
      elements.fidelityValue.textContent = "Fidelity: --";
      elements.guessState.textContent = "No guess submitted yet.";
      elements.targetState.textContent = targetStateText;
      elements.equivalentMessage.classList.add("hidden");
    } else {
      const latest = gameState.guesses[gameState.guesses.length - 1];
      elements.fidelityValue.textContent = `Fidelity: ${latest.fidelity.toFixed(6)}`;
      elements.guessState.textContent = latest.guessStateText;
      elements.targetState.textContent = latest.targetStateText;

      if (latest.equivalent) {
        elements.equivalentMessage.classList.remove("hidden");
      } else {
        elements.equivalentMessage.classList.add("hidden");
      }
    }

    let answerText = "";
    if (gameState.status === "lost") {
      answerText = `Answer: ${gameState.puzzle.answerTokens.join(" ")}`;
    } else if (gameState.status === "won") {
      answerText = `Solved sequence: ${gameState.puzzle.answerTokens.join(" ")}`;
    }
    elements.answerReveal.textContent = answerText;
    elements.answerSection.classList.toggle("hidden", !answerText);

    renderStats(stats);
  }

  function openStatsModal() {
    if (!elements.statsModal.open) {
      elements.statsModal.showModal();
    }
  }

  function closeStatsModal() {
    if (elements.statsModal.open) {
      elements.statsModal.close();
    }
  }

  return {
    render,
    openStatsModal,
    closeStatsModal,
  };
}
