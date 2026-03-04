import test from "node:test";
import assert from "node:assert/strict";

import { createGameConfig, createNewGame } from "../src/game-engine.js";
import {
  loadActiveGame,
  loadSettings,
  loadStats,
  saveGame,
  saveSettings,
  saveStats,
} from "../src/storage.js";

class MemoryStorage {
  constructor() {
    this.data = new Map();
  }

  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }

  setItem(key, value) {
    this.data.set(key, String(value));
  }

  removeItem(key) {
    this.data.delete(key);
  }

  clear() {
    this.data.clear();
  }
}

function buildGame(mode, cadence, id) {
  const puzzle = {
    id,
    mode,
    cadence,
    answerTokens: ["X", "Y", "Z", "H", "S"],
    seedInfo: { source: "test" },
  };

  return createNewGame(puzzle, createGameConfig(mode, cadence));
}

test("storage: settings default and save/load", () => {
  const storage = new MemoryStorage();

  const defaults = loadSettings(storage);
  assert.equal(defaults.mode, "beginner");
  assert.equal(defaults.cadence, "daily");

  saveSettings({ mode: "advanced", cadence: "random" }, storage);
  const loaded = loadSettings(storage);

  assert.equal(loaded.mode, "advanced");
  assert.equal(loaded.cadence, "random");
});

test("storage: save and load active game", () => {
  const storage = new MemoryStorage();
  const game = buildGame("mixed", "daily", "daily:mixed:2026-03-03");

  saveGame(game, storage);

  const loaded = loadActiveGame("mixed", "daily", storage);
  assert.equal(loaded?.puzzle.id, game.puzzle.id);
  assert.deepEqual(loaded?.puzzle.answerTokens, game.puzzle.answerTokens);
});

test("storage: stats are segmented by mode/cadence", () => {
  const storage = new MemoryStorage();

  saveStats(
    "beginner",
    "daily",
    {
      played: 3,
      won: 2,
      currentStreak: 1,
      maxStreak: 2,
      guessDistribution: [0, 1, 1, 0, 0, 0],
    },
    storage,
  );

  saveStats(
    "advanced",
    "random",
    {
      played: 10,
      won: 4,
      currentStreak: 0,
      maxStreak: 3,
      guessDistribution: [1, 1, 1, 1, 0, 0],
    },
    storage,
  );

  const beginner = loadStats("beginner", "daily", storage);
  const advanced = loadStats("advanced", "random", storage);

  assert.equal(beginner.played, 3);
  assert.equal(advanced.played, 10);
  assert.notDeepEqual(beginner, advanced);
});
