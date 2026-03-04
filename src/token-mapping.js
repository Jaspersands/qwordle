const SINGLE_TOKENS = new Set(["X", "Y", "Z", "H", "S", "T"]);
const PAIR_TOKENS = new Set(["CX", "CZ", "SWAP"]);
const TRIPLE_TOKENS = new Set(["CCX", "CSWAP"]);

/**
 * @param {string} token
 */
export function getTokenArity(token) {
  if (SINGLE_TOKENS.has(token)) {
    return 1;
  }
  if (PAIR_TOKENS.has(token)) {
    return 2;
  }
  if (TRIPLE_TOKENS.has(token)) {
    return 3;
  }
  return 0;
}

/**
 * @param {string} token
 * @param {number} numQubits
 */
export function buildMappingOptions(token, numQubits) {
  const arity = getTokenArity(token);
  /** @type {string[]} */
  const options = [];

  if (arity === 1) {
    for (let q = 0; q < numQubits; q += 1) {
      options.push(String(q));
    }
    return options;
  }

  if (arity === 2) {
    for (let a = 0; a < numQubits; a += 1) {
      for (let b = 0; b < numQubits; b += 1) {
        if (a === b) {
          continue;
        }
        options.push(`${a},${b}`);
      }
    }
    return options;
  }

  if (arity === 3) {
    for (let a = 0; a < numQubits; a += 1) {
      for (let b = 0; b < numQubits; b += 1) {
        for (let c = 0; c < numQubits; c += 1) {
          if (new Set([a, b, c]).size !== 3) {
            continue;
          }
          options.push(`${a},${b},${c}`);
        }
      }
    }
    return options;
  }

  return options;
}

/**
 * @param {string} token
 * @param {number} numQubits
 */
export function getDefaultMapping(token, numQubits) {
  const options = buildMappingOptions(token, numQubits);
  return options[0] ?? "";
}

/**
 * @param {string} token
 * @param {number} numQubits
 * @param {string | undefined} mapping
 */
export function normalizeTokenMapping(token, numQubits, mapping) {
  const options = buildMappingOptions(token, numQubits);
  if (options.length === 0) {
    return "";
  }
  if (typeof mapping === "string" && options.includes(mapping)) {
    return mapping;
  }
  return options[0];
}

/**
 * @param {string} token
 * @param {number} numQubits
 */
export function canCycleTokenMapping(token, numQubits) {
  if (numQubits <= 1) {
    return false;
  }
  return buildMappingOptions(token, numQubits).length > 1;
}

/**
 * @param {string} token
 * @param {number} numQubits
 * @param {string | undefined} mapping
 */
export function mappingToSimulationToken(token, numQubits, mapping) {
  const normalized = normalizeTokenMapping(token, numQubits, mapping);
  if (!normalized) {
    return token;
  }

  const parts = normalized.split(",");
  const arity = getTokenArity(token);

  if (arity === 1) {
    return `${token}${parts[0]}`;
  }

  if (arity === 2) {
    return `${token}${parts[0]}${parts[1]}`;
  }

  if (arity === 3) {
    return `${token}${parts[0]}${parts[1]}${parts[2]}`;
  }

  return token;
}

/**
 * @param {string} token
 * @param {number} numQubits
 * @param {string | undefined} mapping
 */
export function formatMappingLabel(token, numQubits, mapping) {
  const normalized = normalizeTokenMapping(token, numQubits, mapping);
  if (!normalized) {
    return "";
  }

  const parts = normalized.split(",").map(Number);
  const arity = getTokenArity(token);

  if (arity === 1) {
    return `q${parts[0]}`;
  }

  if (arity === 2) {
    if (token === "SWAP") {
      return `q${parts[0]}↔q${parts[1]}`;
    }
    return `q${parts[0]}→q${parts[1]}`;
  }

  if (arity === 3) {
    if (token === "CCX") {
      return `q${parts[0]},q${parts[1]}→q${parts[2]}`;
    }
    return `q${parts[0]};q${parts[1]}↔q${parts[2]}`;
  }

  return "";
}

/**
 * @param {string} token
 * @param {string | undefined} mapping
 * @param {number} numQubits
 */
export function formatTokenForBoard(token, mapping, numQubits) {
  if (!token) {
    return "";
  }
  if (numQubits <= 1) {
    return token;
  }
  const label = formatMappingLabel(token, numQubits, mapping);
  return label ? `${token}[${label}]` : token;
}
