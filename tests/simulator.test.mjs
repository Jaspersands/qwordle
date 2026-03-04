import test from "node:test";
import assert from "node:assert/strict";

import {
  computeFidelity,
  simulateSequence,
  stateToTerms,
} from "../src/quantum/simulator.js";

function approxEqual(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test("simulator: H on |0> yields equal superposition", () => {
  const state = simulateSequence(1, ["H"]);
  const expected = 1 / Math.sqrt(2);

  approxEqual(state[0].re, expected);
  approxEqual(state[0].im, 0);
  approxEqual(state[1].re, expected);
  approxEqual(state[1].im, 0);
});

test("simulator: X flips basis state", () => {
  const state = simulateSequence(1, ["X"]);

  approxEqual(state[0].re, 0);
  approxEqual(state[1].re, 1);
});

test("simulator: CX maps |01> to |11>", () => {
  const state = simulateSequence(2, ["X", "CX"]);

  approxEqual(state[0].re, 0);
  approxEqual(state[1].re, 0);
  approxEqual(state[2].re, 0);
  approxEqual(state[3].re, 1);
});

test("simulator: fidelity with itself is 1", () => {
  const state = simulateSequence(2, ["H", "CX", "T"]);
  const fidelity = computeFidelity(state, state);
  approxEqual(fidelity, 1);
});

test("simulator: state terms include only non-negligible amplitudes", () => {
  const state = simulateSequence(1, ["H"]);
  const terms = stateToTerms(state, 1);

  assert.equal(terms.length, 2);
  assert.equal(terms[0].ket.startsWith("|"), true);
});
