import test from "node:test";
import assert from "node:assert/strict";

import { evaluateGuess } from "../src/feedback.js";

test("feedback: exact match is all correct", () => {
  const answer = ["X", "H", "T", "S", "Z"];
  const guess = ["X", "H", "T", "S", "Z"];

  const result = evaluateGuess(guess, answer);
  assert.deepEqual(result.marks, ["correct", "correct", "correct", "correct", "correct"]);
  assert.equal(result.won, true);
});

test("feedback: duplicate over-guess is consumed correctly", () => {
  const answer = ["X", "X", "H", "Z", "T"];
  const guess = ["X", "H", "X", "X", "Y"];

  const result = evaluateGuess(guess, answer);
  assert.deepEqual(result.marks, ["correct", "present", "present", "absent", "absent"]);
  assert.equal(result.won, false);
});

test("feedback: mixed green/yellow/gray ordering", () => {
  const answer = ["H", "X", "Y", "Z", "S"];
  const guess = ["X", "H", "Y", "T", "S"];

  const result = evaluateGuess(guess, answer);
  assert.deepEqual(result.marks, ["present", "present", "correct", "absent", "correct"]);
});
