import test from "node:test";
import assert from "node:assert/strict";

import {
  createDailyPuzzle,
  createPuzzle,
  createRandomPuzzle,
  getLocalDateKey,
} from "../src/puzzle-generator.js";

test("puzzle-generator: local date key format", () => {
  const date = new Date(2026, 2, 3, 12, 30, 0);
  assert.equal(getLocalDateKey(date), "2026-03-03");
});

test("puzzle-generator: same mode/date yields same daily puzzle", () => {
  const date = new Date(2026, 2, 3, 12, 0, 0);

  const a = createDailyPuzzle("beginner", date);
  const b = createDailyPuzzle("beginner", date);

  assert.equal(a.id, b.id);
  assert.deepEqual(a.answerTokens, b.answerTokens);
});

test("puzzle-generator: changing date or mode changes daily puzzle", () => {
  const dateA = new Date(2026, 2, 3, 12, 0, 0);
  const dateB = new Date(2026, 2, 4, 12, 0, 0);

  const puzzleA = createDailyPuzzle("beginner", dateA);
  const puzzleB = createDailyPuzzle("beginner", dateB);
  const puzzleC = createDailyPuzzle("mixed", dateA);

  assert.notEqual(puzzleA.id, puzzleB.id);
  assert.notEqual(puzzleA.id, puzzleC.id);
});

test("puzzle-generator: random cadence creates unique ids", () => {
  const first = createRandomPuzzle("mixed");
  const second = createPuzzle("mixed", "random");

  assert.equal(first.cadence, "random");
  assert.equal(second.cadence, "random");
  assert.notEqual(first.id, second.id);
  assert.equal(first.answerTokens.length, 5);
  assert.equal(second.answerTokens.length, 5);
});
