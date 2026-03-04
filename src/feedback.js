/** @typedef {'correct' | 'present' | 'absent'} Mark */

const MARK_PRIORITY = {
  absent: 0,
  present: 1,
  correct: 2,
};

/**
 * @param {string[]} guessTokens
 * @param {string[]} answerTokens
 * @returns {Mark[]}
 */
export function scoreGuessTokens(guessTokens, answerTokens) {
  if (guessTokens.length !== answerTokens.length) {
    throw new Error("Guess and answer lengths must match.");
  }

  /** @type {Mark[]} */
  const marks = new Array(guessTokens.length).fill("absent");
  /** @type {Map<string, number>} */
  const leftovers = new Map();

  for (let i = 0; i < guessTokens.length; i += 1) {
    if (guessTokens[i] === answerTokens[i]) {
      marks[i] = "correct";
    } else {
      leftovers.set(answerTokens[i], (leftovers.get(answerTokens[i]) ?? 0) + 1);
    }
  }

  for (let i = 0; i < guessTokens.length; i += 1) {
    if (marks[i] === "correct") {
      continue;
    }
    const token = guessTokens[i];
    const remaining = leftovers.get(token) ?? 0;
    if (remaining > 0) {
      marks[i] = "present";
      leftovers.set(token, remaining - 1);
    }
  }

  return marks;
}

/**
 * @param {string[]} guessTokens
 * @param {string[]} answerTokens
 */
export function evaluateGuess(guessTokens, answerTokens) {
  const marks = scoreGuessTokens(guessTokens, answerTokens);
  const won = marks.every((mark) => mark === "correct");
  return { marks, won };
}

/**
 * @param {Mark | undefined} currentMark
 * @param {Mark} incomingMark
 * @returns {Mark}
 */
export function mergeMark(currentMark, incomingMark) {
  if (!currentMark) {
    return incomingMark;
  }
  return MARK_PRIORITY[incomingMark] > MARK_PRIORITY[currentMark]
    ? incomingMark
    : currentMark;
}
