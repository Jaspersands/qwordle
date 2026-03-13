import { MAX_GUESSES, SEQUENCE_LENGTH } from "./gate-catalog.js";
import { mergeMark } from "./feedback.js";
import { canCycleTokenMapping, formatTokenForBoard } from "./token-mapping.js";

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
 *   onBoardCellClick: (index: number) => void,
 *   onNewPuzzle: () => void,
 *   onOpenHelp: () => void,
 *   onCloseHelp: () => void,
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
    keyboard: mustGetElement("keyboard"),
    modeGuide: mustGetElement("mode-guide"),
    statusMessage: mustGetElement("status-message"),
    fidelityValue: mustGetElement("fidelity-value"),
    equivalentMessage: mustGetElement("equivalent-message"),
    guessState: mustGetElement("guess-state"),
    targetState: mustGetElement("target-state"),
    guessCircuit: mustGetElement("guess-circuit"),
    qiskitStatus: mustGetElement("qiskit-status"),
    blochSteps: mustGetElement("bloch-steps"),
    answerSection: mustGetElement("answer-section"),
    answerReveal: mustGetElement("answer-reveal"),
    backspaceButton: /** @type {HTMLButtonElement} */ (mustGetElement("backspace-btn")),
    clearButton: /** @type {HTMLButtonElement} */ (mustGetElement("clear-btn")),
    submitButton: /** @type {HTMLButtonElement} */ (mustGetElement("submit-btn")),
    shareButton: /** @type {HTMLButtonElement} */ (mustGetElement("share-btn")),
    helpButton: /** @type {HTMLButtonElement} */ (mustGetElement("help-button")),
    helpModal: /** @type {HTMLDialogElement} */ (mustGetElement("help-modal")),
    closeHelpButton: /** @type {HTMLButtonElement} */ (mustGetElement("close-help-btn")),
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

  elements.board.addEventListener("click", (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const cell = target.closest(".cell.editable[data-current-col]");
    if (!cell) {
      return;
    }

    const colValue = cell.getAttribute("data-current-col");
    if (!colValue) {
      return;
    }

    const index = Number(colValue);
    if (!Number.isInteger(index) || index < 0 || index >= SEQUENCE_LENGTH) {
      return;
    }

    handlers.onBoardCellClick(index);
  });

  elements.backspaceButton.addEventListener("click", handlers.onBackspace);
  elements.clearButton.addEventListener("click", handlers.onClear);
  elements.submitButton.addEventListener("click", handlers.onSubmit);
  elements.shareButton.addEventListener("click", handlers.onShare);
  elements.newGameButton.addEventListener("click", handlers.onNewPuzzle);
  elements.helpButton.addEventListener("click", handlers.onOpenHelp);
  elements.closeHelpButton.addEventListener("click", handlers.onCloseHelp);
  elements.statsButton.addEventListener("click", handlers.onOpenStats);
  elements.closeStatsButton.addEventListener("click", handlers.onCloseStats);

  elements.helpModal.addEventListener("click", (event) => {
    const rect = elements.helpModal.getBoundingClientRect();
    const isInDialog =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;

    if (!isInDialog) {
      handlers.onCloseHelp();
    }
  });

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
   * @param {import('./game-engine.js').GameState} gameState
   * @param {{ qubits: number }} modeConfig
   * @param {string[]} currentInputMappings
   */
  function renderBoard(gameState, modeConfig, currentInputMappings) {
    elements.board.innerHTML = "";

    for (let row = 0; row < MAX_GUESSES; row += 1) {
      const rowElement = document.createElement("div");
      rowElement.className = "board-row";
      const guess = gameState.guesses[row];

      for (let col = 0; col < SEQUENCE_LENGTH; col += 1) {
        const cell = document.createElement("div");
        cell.className = "cell";

        if (guess) {
          const token = guess.tokens[col] ?? "";
          const mapping = Array.isArray(guess.mappings) ? guess.mappings[col] : undefined;
          cell.textContent = formatTokenForBoard(token, mapping, modeConfig.qubits);
          cell.classList.add(guess.marks[col] ?? "absent");
        } else if (row === gameState.guesses.length && gameState.status === "in_progress") {
          const token = gameState.currentInput[col] ?? "";
          if (token) {
            const mapping = currentInputMappings[col];
            cell.textContent = formatTokenForBoard(token, mapping, modeConfig.qubits);
            cell.classList.add("pending");
            if (canCycleTokenMapping(token, modeConfig.qubits)) {
              cell.classList.add("editable");
              cell.setAttribute("data-current-col", String(col));
            }
          }
        }

        rowElement.appendChild(cell);
      }

      elements.board.appendChild(rowElement);
    }
  }

  /**
   * @param {string[]} tokens
   * @param {Record<string, string>} tokenHints
   * @param {Record<string, 'correct' | 'present' | 'absent'>} keyboardMarks
   * @param {boolean} disabled
   */
  function renderKeyboard(tokens, tokenHints, keyboardMarks, disabled) {
    elements.keyboard.innerHTML = "";

    for (const token of tokens) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "key-btn";
      button.textContent = token;
      button.dataset.token = token;
      button.disabled = disabled;
      button.title = tokenHints[token] ?? token;

      const mark = keyboardMarks[token];
      if (mark) {
        button.classList.add(mark);
      }

      elements.keyboard.appendChild(button);
    }
  }

  /**
   * @param {string[]} guideLines
   */
  function renderModeGuide(guideLines) {
    if (!guideLines || guideLines.length === 0) {
      elements.modeGuide.innerHTML = "";
      return;
    }

    const items = guideLines.map((line) => `<li>${line}</li>`).join("");
    elements.modeGuide.innerHTML = `<h3>Gate Targets</h3><ul>${items}</ul>`;
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
   *   status: 'idle' | 'loading' | 'ready' | 'error',
   *   circuitSvg: string,
   *   blochSteps: Array<{
   *     step: number,
   *     gate: string,
   *     label: string,
   *     stateText: string,
   *     image: string,
   *     qubitImages: Array<{ qubit: number, image: string }>,
   *   }>,
   *   error: string,
   * } | undefined} qiskitVisualization
   * @param {string} fallbackCircuitText
   */
  function renderQiskitVisuals(qiskitVisualization, fallbackCircuitText) {
    elements.guessCircuit.innerHTML = "";
    elements.blochSteps.innerHTML = "";

    if (!qiskitVisualization || qiskitVisualization.status === "idle") {
      elements.qiskitStatus.textContent = "No guess submitted yet.";
      return;
    }

    if (qiskitVisualization.status === "loading") {
      elements.qiskitStatus.textContent = "Rendering with Qiskit...";
      return;
    }

    if (qiskitVisualization.status === "error") {
      elements.qiskitStatus.textContent = qiskitVisualization.error;

      const fallback = document.createElement("pre");
      fallback.className = "qiskit-fallback";
      fallback.textContent = fallbackCircuitText;
      elements.guessCircuit.appendChild(fallback);
      return;
    }

    elements.qiskitStatus.textContent = "Rendered with Qiskit.";
    const normalizedSvg = qiskitVisualization.circuitSvg
      .replace(/<\?xml[\s\S]*?\?>/i, "")
      .replace(/<!doctype[\s\S]*?>/i, "")
      .trim();
    elements.guessCircuit.innerHTML = normalizedSvg;

    for (const step of qiskitVisualization.blochSteps) {
      const card = document.createElement("article");
      card.className = "bloch-step";

      const visual = document.createElement("div");
      visual.className = "bloch-step-visual";

      const title = document.createElement("p");
      title.className = "bloch-step-title";
      title.textContent = `Step ${step.step}: ${step.label}`;
      visual.appendChild(title);

      const qubitGrid = document.createElement("div");
      qubitGrid.className = "bloch-qubit-grid";

      const qubitImages =
        Array.isArray(step.qubitImages) && step.qubitImages.length > 0
          ? step.qubitImages
          : [{ qubit: 0, image: step.image }];

      for (const qubitImage of qubitImages) {
        const qubitCard = document.createElement("figure");
        qubitCard.className = "bloch-qubit-card";

        const qubitLabel = document.createElement("figcaption");
        qubitLabel.textContent = `q${qubitImage.qubit}`;
        qubitCard.appendChild(qubitLabel);

        const image = document.createElement("img");
        image.src = qubitImage.image;
        image.alt = `Bloch sphere for step ${step.step}, qubit ${qubitImage.qubit}`;
        image.loading = "lazy";
        image.decoding = "async";
        qubitCard.appendChild(image);
        qubitGrid.appendChild(qubitCard);
      }
      visual.appendChild(qubitGrid);

      const details = document.createElement("div");
      details.className = "bloch-step-details";

      const gate = document.createElement("p");
      gate.className = "bloch-step-gate";
      gate.textContent = `Gate Applied: ${step.gate}`;
      details.appendChild(gate);

      const state = document.createElement("pre");
      state.className = "bloch-step-state";
      state.textContent = step.stateText || "State unavailable.";
      details.appendChild(state);

      card.appendChild(visual);
      card.appendChild(details);

      elements.blochSteps.appendChild(card);
    }
  }

  /**
   * @param {{
   *   settings: { mode: string, cadence: string },
   *   modeConfig: { qubits: number, tokens: string[], guideLines?: string[], tokenHints?: Record<string, string> },
   *   gameState: import('./game-engine.js').GameState,
   *   currentInputMappings: string[],
   *   stats: import('./game-engine.js').Stats,
   *   message: string,
   *   targetStateText: string,
   *   qiskitVisualization: {
   *     status: 'idle' | 'loading' | 'ready' | 'error',
   *     circuitSvg: string,
   *     blochSteps: Array<{
   *       step: number,
   *       gate: string,
   *       label: string,
   *       stateText: string,
   *       image: string,
   *       qubitImages: Array<{ qubit: number, image: string }>,
   *     }>,
   *     error: string,
   *   },
   * }} viewModel
   */
  function render(viewModel) {
    const {
      settings,
      modeConfig,
      gameState,
      currentInputMappings,
      stats,
      message,
      targetStateText,
      qiskitVisualization,
    } = viewModel;

    elements.modeSelect.value = settings.mode;
    elements.cadenceSelect.value = settings.cadence;

    elements.newGameButton.textContent =
      settings.cadence === "random" ? "New Random Puzzle" : "Restart Daily Puzzle";

    renderBoard(gameState, modeConfig, currentInputMappings);

    const keyboardMarks = deriveKeyboardMarks(gameState.guesses);
    renderKeyboard(
      modeConfig.tokens,
      modeConfig.tokenHints ?? {},
      keyboardMarks,
      false,
    );
    renderModeGuide(modeConfig.guideLines ?? []);

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
      renderQiskitVisuals(qiskitVisualization, "No guess submitted yet.");
      elements.equivalentMessage.classList.add("hidden");
    } else {
      const latest = gameState.guesses[gameState.guesses.length - 1];
      elements.fidelityValue.textContent = `Fidelity: ${latest.fidelity.toFixed(6)}`;
      elements.guessState.textContent = latest.guessStateText;
      renderQiskitVisuals(
        qiskitVisualization,
        latest.guessCircuitText ?? "No guess submitted yet.",
      );

      if (latest.equivalent) {
        elements.equivalentMessage.classList.remove("hidden");
      } else {
        elements.equivalentMessage.classList.add("hidden");
      }
    }

    elements.targetState.textContent = targetStateText;

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

  function openHelpModal() {
    if (!elements.helpModal.open) {
      elements.helpModal.showModal();
    }
  }

  function closeHelpModal() {
    if (elements.helpModal.open) {
      elements.helpModal.close();
    }
  }

  function closeStatsModal() {
    if (elements.statsModal.open) {
      elements.statsModal.close();
    }
  }

  return {
    render,
    openHelpModal,
    closeHelpModal,
    openStatsModal,
    closeStatsModal,
  };
}
