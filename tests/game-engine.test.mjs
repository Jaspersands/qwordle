import test from "node:test";
import assert from "node:assert/strict";

import {
  addToken,
  createEmptyStats,
  createGameConfig,
  createNewGame,
  recordGameResult,
  setCurrentInput,
  submitCurrentGuess,
} from "../src/game-engine.js";
import { getModeConfig } from "../src/gate-catalog.js";

function buildPuzzle(mode, cadence, answerTokens) {
  return {
    id: `${cadence}:${mode}:test`,
    mode,
    cadence,
    answerTokens,
    seedInfo: { source: "test" },
  };
}

test("game-engine: exact guess wins before guess limit", () => {
  const modeConfig = getModeConfig("beginner");
  const puzzle = buildPuzzle("beginner", "daily", ["X", "Y", "Z", "H", "S"]);
  let game = createNewGame(puzzle, createGameConfig("beginner", "daily"));

  game = setCurrentInput(game, puzzle.answerTokens);
  const result = submitCurrentGuess(game, modeConfig);

  assert.equal(result.ok, true);
  assert.equal(result.gameState.status, "won");
  assert.equal(result.gameState.currentRow, 1);
  assert.equal(result.completedNow, true);
});

test("game-engine: six misses produce loss", () => {
  const modeConfig = getModeConfig("beginner");
  const puzzle = buildPuzzle("beginner", "daily", ["H", "H", "H", "H", "H"]);
  let game = createNewGame(puzzle, createGameConfig("beginner", "daily"));

  for (let i = 0; i < 6; i += 1) {
    game = setCurrentInput(game, ["X", "X", "X", "X", "X"]);
    const result = submitCurrentGuess(game, modeConfig);
    assert.equal(result.ok, true);
    game = result.gameState;
  }

  assert.equal(game.status, "lost");
  assert.equal(game.currentRow, 6);
});

test("game-engine: addToken respects sequence length", () => {
  const modeConfig = getModeConfig("beginner");
  const puzzle = buildPuzzle("beginner", "daily", ["X", "Y", "Z", "H", "S"]);
  let game = createNewGame(puzzle, createGameConfig("beginner", "daily"));

  for (let i = 0; i < 10; i += 1) {
    game = addToken(game, modeConfig.tokens[i % modeConfig.tokens.length]);
  }

  assert.equal(game.currentInput.length, 5);
});

test("game-engine: stats update for win/loss boundaries", () => {
  let stats = createEmptyStats();

  stats = recordGameResult(stats, true, 2);
  assert.equal(stats.played, 1);
  assert.equal(stats.won, 1);
  assert.equal(stats.currentStreak, 1);
  assert.equal(stats.maxStreak, 1);
  assert.equal(stats.guessDistribution[1], 1);

  stats = recordGameResult(stats, false, 6);
  assert.equal(stats.played, 2);
  assert.equal(stats.won, 1);
  assert.equal(stats.currentStreak, 0);
  assert.equal(stats.maxStreak, 1);
});
