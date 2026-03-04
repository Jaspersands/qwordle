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
 * @param {string[]} tokens
 * @returns {{ re: number, im: number }[]}
 */
export function simulateSequence(numQubits, tokens) {
  const state = zeroState(numQubits);
  for (const token of tokens) {
    applyGateToken(state, numQubits, token);
  }
  return state;
}

/**
 * @param {{ re: number, im: number }[]} state
 * @param {number} numQubits
 * @param {string} token
 */
export function applyGateToken(state, numQubits, token) {
  let match = token.match(/^([XYZHST])$/);
  if (match) {
    const gate = match[1];
    applySingleQubitMatrix(state, numQubits, 0, SINGLE_QUBIT_MATRICES[gate]);
    return;
  }

  match = token.match(/^([XYZHST])(\d)$/);
  if (match) {
    const gate = match[1];
    const q = Number(match[2]);
    assertQubit(q, numQubits, token);
    applySingleQubitMatrix(state, numQubits, q, SINGLE_QUBIT_MATRICES[gate]);
    return;
  }

  if (token === "CX") {
    assertQubit(0, numQubits, token);
    assertQubit(1, numQubits, token);
    applyControlledX(state, numQubits, 0, 1);
    return;
  }

  match = token.match(/^CX(\d)(\d)$/);
  if (match) {
    const control = Number(match[1]);
    const target = Number(match[2]);
    assertQubit(control, numQubits, token);
    assertQubit(target, numQubits, token);
    assertDistinct([control, target], token);
    applyControlledX(state, numQubits, control, target);
    return;
  }

  if (token === "CZ") {
    assertQubit(0, numQubits, token);
    assertQubit(1, numQubits, token);
    applyControlledZ(state, numQubits, 0, 1);
    return;
  }

  match = token.match(/^CZ(\d)(\d)$/);
  if (match) {
    const control = Number(match[1]);
    const target = Number(match[2]);
    assertQubit(control, numQubits, token);
    assertQubit(target, numQubits, token);
    assertDistinct([control, target], token);
    applyControlledZ(state, numQubits, control, target);
    return;
  }

  if (token === "SWAP") {
    assertQubit(0, numQubits, token);
    assertQubit(1, numQubits, token);
    applySwap(state, numQubits, 0, 1);
    return;
  }

  match = token.match(/^SWAP(\d)(\d)$/);
  if (match) {
    const qa = Number(match[1]);
    const qb = Number(match[2]);
    assertQubit(qa, numQubits, token);
    assertQubit(qb, numQubits, token);
    assertDistinct([qa, qb], token);
    applySwap(state, numQubits, qa, qb);
    return;
  }

  if (token === "CCX") {
    assertQubit(0, numQubits, token);
    assertQubit(1, numQubits, token);
    assertQubit(2, numQubits, token);
    applyCCX(state, numQubits, 0, 1, 2);
    return;
  }

  match = token.match(/^CCX(\d)(\d)(\d)$/);
  if (match) {
    const c1 = Number(match[1]);
    const c2 = Number(match[2]);
    const target = Number(match[3]);
    assertQubit(c1, numQubits, token);
    assertQubit(c2, numQubits, token);
    assertQubit(target, numQubits, token);
    assertDistinct([c1, c2, target], token);
    applyCCX(state, numQubits, c1, c2, target);
    return;
  }

  if (token === "CSWAP") {
    assertQubit(0, numQubits, token);
    assertQubit(1, numQubits, token);
    assertQubit(2, numQubits, token);
    applyCSWAP(state, numQubits, 0, 1, 2);
    return;
  }

  match = token.match(/^CSWAP(\d)(\d)(\d)$/);
  if (match) {
    const control = Number(match[1]);
    const qa = Number(match[2]);
    const qb = Number(match[3]);
    assertQubit(control, numQubits, token);
    assertQubit(qa, numQubits, token);
    assertQubit(qb, numQubits, token);
    assertDistinct([control, qa, qb], token);
    applyCSWAP(state, numQubits, control, qa, qb);
    return;
  }

  throw new Error(`Unsupported gate token: ${token}`);
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
  if (new Set(indices).size !== indices.length) {
    throw new Error(`Token ${token} reuses qubit indices.`);
  }
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
