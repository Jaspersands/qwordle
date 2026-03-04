import {
  absSquared,
  add,
  clone,
  complex,
  conjugate,
  formatComplex,
  multiply,
  scale,
} from "./complex.js";

const SQRT_1_2 = 1 / Math.sqrt(2);
const EPSILON = 1e-12;
const WIRE_SEGMENT = "-----";

const ZERO = complex(0, 0);
const ONE = complex(1, 0);
const NEG_ONE = complex(-1, 0);
const I = complex(0, 1);
const NEG_I = complex(0, -1);
const T_PHASE = complex(SQRT_1_2, SQRT_1_2);

const SINGLE_QUBIT_MATRICES = {
  X: [
    [ZERO, ONE],
    [ONE, ZERO],
  ],
  Y: [
    [ZERO, NEG_I],
    [I, ZERO],
  ],
  Z: [
    [ONE, ZERO],
    [ZERO, NEG_ONE],
  ],
  H: [
    [complex(SQRT_1_2, 0), complex(SQRT_1_2, 0)],
    [complex(SQRT_1_2, 0), complex(-SQRT_1_2, 0)],
  ],
  S: [
    [ONE, ZERO],
    [ZERO, I],
  ],
  T: [
    [ONE, ZERO],
    [ZERO, T_PHASE],
  ],
};

/**
 * @typedef {{
 *   singleQubitTarget?: number,
 *   twoQubit?: { control: number, target: number },
 *   ccx?: { control1: number, control2: number, target: number },
 *   cswap?: { control: number, swapA: number, swapB: number },
 * }} SimulationMapping
 */

/**
 * @typedef {{
 *   singleQubitTarget: number,
 *   twoQubit: { control: number, target: number },
 *   ccx: { control1: number, control2: number, target: number },
 *   cswap: { control: number, swapA: number, swapB: number },
 * }} NormalizedSimulationMapping
 */

/**
 * @typedef {{ kind: 'single', gate: string, target: number } |
 *   { kind: 'cx', control: number, target: number } |
 *   { kind: 'cz', control: number, target: number } |
 *   { kind: 'swap', qa: number, qb: number } |
 *   { kind: 'ccx', control1: number, control2: number, target: number } |
 *   { kind: 'cswap', control: number, swapA: number, swapB: number }} GateOperation
 */

/**
 * @param {number} numQubits
 * @returns {{ re: number, im: number }[]}
 */
export function zeroState(numQubits) {
  if (numQubits < 1 || numQubits > 3) {
    throw new Error("Qubit count must be between 1 and 3.");
  }

  const size = 1 << numQubits;
  const state = new Array(size);
  for (let i = 0; i < size; i += 1) {
    state[i] = complex(0, 0);
  }
  state[0] = complex(1, 0);
  return state;
}

/**
 * @param {{ re: number, im: number }[]} state
 * @returns {{ re: number, im: number }[]}
 */
export function cloneState(state) {
  return state.map((amp) => clone(amp));
}

/**
 * @param {number} numQubits
 * @returns {NormalizedSimulationMapping}
 */
export function getDefaultSimulationMapping(numQubits) {
  const second = numQubits > 1 ? 1 : 0;
  const third = numQubits > 2 ? 2 : second;

  return {
    singleQubitTarget: 0,
    twoQubit: {
      control: 0,
      target: second,
    },
    ccx: {
      control1: 0,
      control2: second,
      target: third,
    },
    cswap: {
      control: 0,
      swapA: second,
      swapB: third,
    },
  };
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} numQubits
 */
function sanitizeIndex(value, fallback, numQubits) {
  if (!Number.isInteger(value)) {
    return fallback;
  }
  if (value < 0 || value >= numQubits) {
    return fallback;
  }
  return Number(value);
}

/**
 * @param {number[]} values
 */
function areDistinct(values) {
  return new Set(values).size === values.length;
}

/**
 * @param {number} numQubits
 * @param {SimulationMapping | undefined} mapping
 * @returns {NormalizedSimulationMapping}
 */
export function normalizeSimulationMapping(numQubits, mapping) {
  const defaults = getDefaultSimulationMapping(numQubits);

  let singleQubitTarget = sanitizeIndex(
    mapping?.singleQubitTarget,
    defaults.singleQubitTarget,
    numQubits,
  );

  let twoControl = sanitizeIndex(mapping?.twoQubit?.control, defaults.twoQubit.control, numQubits);
  let twoTarget = sanitizeIndex(mapping?.twoQubit?.target, defaults.twoQubit.target, numQubits);

  if (numQubits > 1 && twoControl === twoTarget) {
    twoControl = defaults.twoQubit.control;
    twoTarget = defaults.twoQubit.target;
  }

  let ccxControl1 = sanitizeIndex(mapping?.ccx?.control1, defaults.ccx.control1, numQubits);
  let ccxControl2 = sanitizeIndex(mapping?.ccx?.control2, defaults.ccx.control2, numQubits);
  let ccxTarget = sanitizeIndex(mapping?.ccx?.target, defaults.ccx.target, numQubits);

  if (numQubits > 2 && !areDistinct([ccxControl1, ccxControl2, ccxTarget])) {
    ccxControl1 = defaults.ccx.control1;
    ccxControl2 = defaults.ccx.control2;
    ccxTarget = defaults.ccx.target;
  }

  let cswapControl = sanitizeIndex(mapping?.cswap?.control, defaults.cswap.control, numQubits);
  let cswapSwapA = sanitizeIndex(mapping?.cswap?.swapA, defaults.cswap.swapA, numQubits);
  let cswapSwapB = sanitizeIndex(mapping?.cswap?.swapB, defaults.cswap.swapB, numQubits);

  if (numQubits > 2 && !areDistinct([cswapControl, cswapSwapA, cswapSwapB])) {
    cswapControl = defaults.cswap.control;
    cswapSwapA = defaults.cswap.swapA;
    cswapSwapB = defaults.cswap.swapB;
  }

  // Single-gate mapping always needs a valid index.
  singleQubitTarget = sanitizeIndex(singleQubitTarget, 0, numQubits);

  return {
    singleQubitTarget,
    twoQubit: {
      control: twoControl,
      target: twoTarget,
    },
    ccx: {
      control1: ccxControl1,
      control2: ccxControl2,
      target: ccxTarget,
    },
    cswap: {
      control: cswapControl,
      swapA: cswapSwapA,
      swapB: cswapSwapB,
    },
  };
}

/**
 * @param {number} index
 * @param {number} numQubits
 * @param {string} token
 */
function assertQubit(index, numQubits, token) {
  if (index < 0 || index >= numQubits) {
    throw new Error(`Token ${token} references invalid qubit ${index}.`);
  }
}

/**
 * @param {number[]} indices
 * @param {string} token
 */
function assertDistinct(indices, token) {
  if (!areDistinct(indices)) {
    throw new Error(`Token ${token} reuses qubit indices.`);
  }
}

/**
 * @param {string} token
 * @param {number} numQubits
 * @param {SimulationMapping | undefined} mapping
 * @returns {GateOperation}
 */
export function resolveGateOperation(token, numQubits, mapping) {
  const normalized = normalizeSimulationMapping(numQubits, mapping);

  let match = token.match(/^([XYZHST])$/);
  if (match) {
    const gate = match[1];
    const target = normalized.singleQubitTarget;
    assertQubit(target, numQubits, token);
    return { kind: "single", gate, target };
  }

  match = token.match(/^([XYZHST])(\d)$/);
  if (match) {
    const gate = match[1];
    const target = Number(match[2]);
    assertQubit(target, numQubits, token);
    return { kind: "single", gate, target };
  }

  if (token === "CX") {
    const { control, target } = normalized.twoQubit;
    assertQubit(control, numQubits, token);
    assertQubit(target, numQubits, token);
    assertDistinct([control, target], token);
    return { kind: "cx", control, target };
  }

  match = token.match(/^CX(\d)(\d)$/);
  if (match) {
    const control = Number(match[1]);
    const target = Number(match[2]);
    assertQubit(control, numQubits, token);
    assertQubit(target, numQubits, token);
    assertDistinct([control, target], token);
    return { kind: "cx", control, target };
  }

  if (token === "CZ") {
    const { control, target } = normalized.twoQubit;
    assertQubit(control, numQubits, token);
    assertQubit(target, numQubits, token);
    assertDistinct([control, target], token);
    return { kind: "cz", control, target };
  }

  match = token.match(/^CZ(\d)(\d)$/);
  if (match) {
    const control = Number(match[1]);
    const target = Number(match[2]);
    assertQubit(control, numQubits, token);
    assertQubit(target, numQubits, token);
    assertDistinct([control, target], token);
    return { kind: "cz", control, target };
  }

  if (token === "SWAP") {
    const { control, target } = normalized.twoQubit;
    assertQubit(control, numQubits, token);
    assertQubit(target, numQubits, token);
    assertDistinct([control, target], token);
    return { kind: "swap", qa: control, qb: target };
  }

  match = token.match(/^SWAP(\d)(\d)$/);
  if (match) {
    const qa = Number(match[1]);
    const qb = Number(match[2]);
    assertQubit(qa, numQubits, token);
    assertQubit(qb, numQubits, token);
    assertDistinct([qa, qb], token);
    return { kind: "swap", qa, qb };
  }

  if (token === "CCX") {
    const { control1, control2, target } = normalized.ccx;
    assertQubit(control1, numQubits, token);
    assertQubit(control2, numQubits, token);
    assertQubit(target, numQubits, token);
    assertDistinct([control1, control2, target], token);
    return { kind: "ccx", control1, control2, target };
  }

  match = token.match(/^CCX(\d)(\d)(\d)$/);
  if (match) {
    const control1 = Number(match[1]);
    const control2 = Number(match[2]);
    const target = Number(match[3]);
    assertQubit(control1, numQubits, token);
    assertQubit(control2, numQubits, token);
    assertQubit(target, numQubits, token);
    assertDistinct([control1, control2, target], token);
    return { kind: "ccx", control1, control2, target };
  }

  if (token === "CSWAP") {
    const { control, swapA, swapB } = normalized.cswap;
    assertQubit(control, numQubits, token);
    assertQubit(swapA, numQubits, token);
    assertQubit(swapB, numQubits, token);
    assertDistinct([control, swapA, swapB], token);
    return { kind: "cswap", control, swapA, swapB };
  }

  match = token.match(/^CSWAP(\d)(\d)(\d)$/);
  if (match) {
    const control = Number(match[1]);
    const swapA = Number(match[2]);
    const swapB = Number(match[3]);
    assertQubit(control, numQubits, token);
    assertQubit(swapA, numQubits, token);
    assertQubit(swapB, numQubits, token);
    assertDistinct([control, swapA, swapB], token);
    return { kind: "cswap", control, swapA, swapB };
  }

  throw new Error(`Unsupported gate token: ${token}`);
}

/**
 * @param {number} index
 * @param {number} bit
 */
function isBitSet(index, bit) {
  return ((index >> bit) & 1) === 1;
}

/**
 * @param {{ re: number, im: number }[]} state
 * @param {number} i
 * @param {number} j
 */
function swapAmplitudes(state, i, j) {
  const tmp = state[i];
  state[i] = state[j];
  state[j] = tmp;
}

/**
 * @param {{ re: number, im: number }[]} state
 * @param {number} numQubits
 * @param {number} target
 * @param {[[{re:number,im:number},{re:number,im:number}],[{re:number,im:number},{re:number,im:number}]]} matrix
 */
function applySingleQubitMatrix(state, numQubits, target, matrix) {
  const size = 1 << numQubits;
  const mask = 1 << target;

  for (let i = 0; i < size; i += 1) {
    if ((i & mask) !== 0) {
      continue;
    }

    const j = i | mask;
    const a0 = state[i];
    const a1 = state[j];

    const new0 = add(multiply(matrix[0][0], a0), multiply(matrix[0][1], a1));
    const new1 = add(multiply(matrix[1][0], a0), multiply(matrix[1][1], a1));

    state[i] = new0;
    state[j] = new1;
  }
}

/**
 * @param {{ re: number, im: number }[]} state
 * @param {number} numQubits
 * @param {number} control
 * @param {number} target
 */
function applyControlledX(state, numQubits, control, target) {
  const size = 1 << numQubits;
  const targetMask = 1 << target;

  for (let i = 0; i < size; i += 1) {
    if (!isBitSet(i, control) || isBitSet(i, target)) {
      continue;
    }
    const j = i | targetMask;
    swapAmplitudes(state, i, j);
  }
}

/**
 * @param {{ re: number, im: number }[]} state
 * @param {number} numQubits
 * @param {number} control
 * @param {number} target
 */
function applyControlledZ(state, numQubits, control, target) {
  const size = 1 << numQubits;
  for (let i = 0; i < size; i += 1) {
    if (isBitSet(i, control) && isBitSet(i, target)) {
      state[i] = scale(state[i], -1);
    }
  }
}

/**
 * @param {{ re: number, im: number }[]} state
 * @param {number} numQubits
 * @param {number} qa
 * @param {number} qb
 */
function applySwap(state, numQubits, qa, qb) {
  const size = 1 << numQubits;
  const qaMask = 1 << qa;
  const qbMask = 1 << qb;

  for (let i = 0; i < size; i += 1) {
    const a = isBitSet(i, qa);
    const b = isBitSet(i, qb);

    if (a || !b) {
      continue;
    }

    const j = (i | qaMask) & ~qbMask;
    swapAmplitudes(state, i, j);
  }
}

/**
 * @param {{ re: number, im: number }[]} state
 * @param {number} numQubits
 * @param {number} c1
 * @param {number} c2
 * @param {number} target
 */
function applyCCX(state, numQubits, c1, c2, target) {
  const size = 1 << numQubits;
  const targetMask = 1 << target;

  for (let i = 0; i < size; i += 1) {
    if (!isBitSet(i, c1) || !isBitSet(i, c2) || isBitSet(i, target)) {
      continue;
    }
    const j = i | targetMask;
    swapAmplitudes(state, i, j);
  }
}

/**
 * @param {{ re: number, im: number }[]} state
 * @param {number} numQubits
 * @param {number} control
 * @param {number} qa
 * @param {number} qb
 */
function applyCSWAP(state, numQubits, control, qa, qb) {
  const size = 1 << numQubits;
  const qaMask = 1 << qa;
  const qbMask = 1 << qb;

  for (let i = 0; i < size; i += 1) {
    if (!isBitSet(i, control)) {
      continue;
    }

    const a = isBitSet(i, qa);
    const b = isBitSet(i, qb);

    if (a || !b) {
      continue;
    }

    const j = (i | qaMask) & ~qbMask;
    swapAmplitudes(state, i, j);
  }
}

/**
 * @param {{ re: number, im: number }[]} state
 * @param {number} numQubits
 * @param {string} token
 * @param {SimulationMapping | undefined} mapping
 */
export function applyGateToken(state, numQubits, token, mapping) {
  const op = resolveGateOperation(token, numQubits, mapping);

  if (op.kind === "single") {
    applySingleQubitMatrix(state, numQubits, op.target, SINGLE_QUBIT_MATRICES[op.gate]);
    return;
  }
  if (op.kind === "cx") {
    applyControlledX(state, numQubits, op.control, op.target);
    return;
  }
  if (op.kind === "cz") {
    applyControlledZ(state, numQubits, op.control, op.target);
    return;
  }
  if (op.kind === "swap") {
    applySwap(state, numQubits, op.qa, op.qb);
    return;
  }
  if (op.kind === "ccx") {
    applyCCX(state, numQubits, op.control1, op.control2, op.target);
    return;
  }

  applyCSWAP(state, numQubits, op.control, op.swapA, op.swapB);
}

/**
 * @param {number} numQubits
 * @param {string[]} tokens
 * @param {SimulationMapping | undefined} mapping
 * @returns {{ re: number, im: number }[]}
 */
export function simulateSequence(numQubits, tokens, mapping) {
  const state = zeroState(numQubits);
  for (const token of tokens) {
    applyGateToken(state, numQubits, token, mapping);
  }
  return state;
}

/**
 * @param {number} q
 * @param {number} a
 * @param {number} b
 */
function isStrictBetween(q, a, b) {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return q > min && q < max;
}

/**
 * @param {number} q
 * @param {number[]} qubits
 */
function isStrictBetweenRange(q, qubits) {
  const min = Math.min(...qubits);
  const max = Math.max(...qubits);
  return q > min && q < max;
}

/**
 * @param {string} marker
 */
function markerSegment(marker) {
  return `--${marker}--`;
}

/**
 * @param {string} gate
 */
function singleSegment(gate) {
  return `-[${gate}]-`;
}

/**
 * @param {GateOperation} op
 * @param {number} qubit
 */
function circuitSegmentForQubit(op, qubit) {
  if (op.kind === "single") {
    return qubit === op.target ? singleSegment(op.gate) : WIRE_SEGMENT;
  }

  if (op.kind === "cx" || op.kind === "cz") {
    if (qubit === op.control) {
      return markerSegment("o");
    }
    if (qubit === op.target) {
      return markerSegment(op.kind === "cx" ? "X" : "Z");
    }
    return isStrictBetween(qubit, op.control, op.target) ? markerSegment("|") : WIRE_SEGMENT;
  }

  if (op.kind === "swap") {
    if (qubit === op.qa || qubit === op.qb) {
      return markerSegment("x");
    }
    return isStrictBetween(qubit, op.qa, op.qb) ? markerSegment("|") : WIRE_SEGMENT;
  }

  if (op.kind === "ccx") {
    if (qubit === op.control1 || qubit === op.control2) {
      return markerSegment("o");
    }
    if (qubit === op.target) {
      return markerSegment("X");
    }
    return isStrictBetweenRange(qubit, [op.control1, op.control2, op.target])
      ? markerSegment("|")
      : WIRE_SEGMENT;
  }

  if (qubit === op.control) {
    return markerSegment("o");
  }
  if (qubit === op.swapA || qubit === op.swapB) {
    return markerSegment("x");
  }
  return isStrictBetweenRange(qubit, [op.control, op.swapA, op.swapB])
    ? markerSegment("|")
    : WIRE_SEGMENT;
}

/**
 * @param {string[]} tokens
 * @param {number} numQubits
 * @param {SimulationMapping | undefined} mapping
 */
export function formatCircuit(tokens, numQubits, mapping) {
  const lines = Array.from({ length: numQubits }, (_, q) => `q${q}: `);

  for (const token of tokens) {
    const op = resolveGateOperation(token, numQubits, mapping);
    for (let q = 0; q < numQubits; q += 1) {
      lines[q] += `${circuitSegmentForQubit(op, q)} `;
    }
  }

  return lines.join("\n");
}

/**
 * @param {{ re: number, im: number }[]} stateA
 * @param {{ re: number, im: number }[]} stateB
 * @returns {number}
 */
export function computeFidelity(stateA, stateB) {
  if (stateA.length !== stateB.length) {
    throw new Error("State sizes do not match.");
  }

  let inner = complex(0, 0);
  for (let i = 0; i < stateA.length; i += 1) {
    inner = add(inner, multiply(conjugate(stateA[i]), stateB[i]));
  }

  const fidelity = absSquared(inner);
  return fidelity > 1 && fidelity - 1 < 1e-9 ? 1 : fidelity;
}

/**
 * @param {number} index
 * @param {number} numQubits
 */
function basisBits(index, numQubits) {
  return index.toString(2).padStart(numQubits, "0");
}

/**
 * @param {{ re: number, im: number }[]} state
 * @param {number} numQubits
 * @param {number} epsilon
 * @param {number} maxTerms
 */
export function stateToTerms(state, numQubits, epsilon = 1e-6, maxTerms = 8) {
  /** @type {{ basis: string, ket: string, amplitude: string, magnitude: number, re: number, im: number }[]} */
  const terms = [];
  const threshold = epsilon * epsilon;

  for (let i = 0; i < state.length; i += 1) {
    const amplitude = state[i];
    const magSq = absSquared(amplitude);

    if (magSq <= threshold) {
      continue;
    }

    const basis = basisBits(i, numQubits);
    terms.push({
      basis,
      ket: `|${basis}>`,
      amplitude: formatComplex(amplitude, 3),
      magnitude: Math.sqrt(magSq),
      re: amplitude.re,
      im: amplitude.im,
    });
  }

  terms.sort((a, b) => b.magnitude - a.magnitude || a.basis.localeCompare(b.basis));
  return terms.slice(0, maxTerms);
}

/**
 * @param {{ ket: string, amplitude: string }[]} terms
 */
export function formatTerms(terms) {
  if (terms.length === 0) {
    return "0";
  }
  return terms.map((term) => `${term.amplitude} ${term.ket}`).join("\n");
}

/**
 * @param {number} value
 */
export function roundFidelity(value) {
  if (Math.abs(value) < EPSILON) {
    return 0;
  }
  if (Math.abs(1 - value) < EPSILON) {
    return 1;
  }
  return value;
}
