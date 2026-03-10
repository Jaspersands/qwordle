const DEFAULT_RENDER_ENDPOINT = "http://127.0.0.1:8765/render";
const RENDER_TIMEOUT_MS = 15000;

/** @type {Map<string, { circuitSvg: string, blochSteps: Array<{ step: number, label: string, image: string }> }>} */
const renderCache = new Map();

/**
 * @returns {string}
 */
function getConfiguredEndpoint() {
  if (
    typeof globalThis !== "undefined" &&
    typeof globalThis.QISKIT_RENDER_URL === "string" &&
    globalThis.QISKIT_RENDER_URL.length > 0
  ) {
    return globalThis.QISKIT_RENDER_URL;
  }
  return "";
}

/**
 * @param {string[]} values
 */
function unique(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
}

function getRenderEndpoints() {
  const configured = getConfiguredEndpoint();
  if (configured) {
    return [configured];
  }

  /** @type {string[]} */
  const candidates = [];
  if (typeof globalThis !== "undefined" && globalThis.location?.origin) {
    candidates.push(`${globalThis.location.origin}/render`);
  }
  candidates.push("http://localhost:8765/render");
  candidates.push(DEFAULT_RENDER_ENDPOINT);
  return unique(candidates);
}

/**
 * @param {string} endpoint
 * @param {number} numQubits
 * @param {string[]} tokens
 */
async function renderFromEndpoint(endpoint, numQubits, tokens) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, RENDER_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        numQubits,
        tokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`Renderer responded with ${response.status}.`);
    }

    const payload = await response.json();
    if (!isValidPayload(payload)) {
      throw new Error("Renderer returned an invalid payload.");
    }

    return {
      ok: true,
      payload,
    };
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? `Renderer request timed out (${endpoint}).`
        : error instanceof Error
          ? `${error.message} (${endpoint})`
          : `Unable to reach Qiskit renderer (${endpoint}).`;
    return {
      ok: false,
      error: reason,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * @param {number} numQubits
 * @param {string[]} tokens
 */
function getCacheKey(numQubits, tokens) {
  return `${numQubits}:${tokens.join("|")}`;
}

/**
 * @param {unknown} payload
 */
function isValidPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = /** @type {{ circuitSvg?: unknown, blochSteps?: unknown }} */ (payload);
  if (typeof candidate.circuitSvg !== "string") {
    return false;
  }
  if (!Array.isArray(candidate.blochSteps)) {
    return false;
  }

  return candidate.blochSteps.every(
    (entry) => {
      if (!entry || typeof entry !== "object") {
        return false;
      }
      const candidateEntry = /** @type {{ step?: unknown, label?: unknown, image?: unknown }} */ (entry);
      return (
        Number.isInteger(candidateEntry.step) &&
        typeof candidateEntry.label === "string" &&
        typeof candidateEntry.image === "string"
      );
    },
  );
}

/**
 * @param {number} numQubits
 * @param {string[]} tokens
 */
export async function renderQiskitArtifacts(numQubits, tokens) {
  const cacheKey = getCacheKey(numQubits, tokens);
  const cached = renderCache.get(cacheKey);
  if (cached) {
    return {
      ok: true,
      cached: true,
      data: cached,
    };
  }

  const endpoints = getRenderEndpoints();
  /** @type {string[]} */
  const errors = [];

  for (const endpoint of endpoints) {
    const attempt = await renderFromEndpoint(endpoint, numQubits, tokens);
    if (attempt.ok) {
      renderCache.set(cacheKey, attempt.payload);
      return {
        ok: true,
        cached: false,
        data: attempt.payload,
      };
    }
    errors.push(attempt.error);
  }

  return {
    ok: false,
    error: errors[0] ?? "Unable to reach Qiskit renderer.",
  };
}

export function clearQiskitRenderCache() {
  renderCache.clear();
}
