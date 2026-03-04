const MARK_TO_EMOJI = {
  correct: "🟩",
  present: "🟨",
  absent: "⬛",
};

/**
 * @param {'correct' | 'present' | 'absent'} mark
 */
export function markToEmoji(mark) {
  return MARK_TO_EMOJI[mark] ?? "⬛";
}

/**
 * @param {'in_progress' | 'won' | 'lost'} status
 * @param {number} guessesUsed
 * @param {number} maxGuesses
 */
export function getShareScore(status, guessesUsed, maxGuesses) {
  if (status === "won") {
    return `${guessesUsed}/${maxGuesses}`;
  }
  if (status === "lost") {
    return `X/${maxGuesses}`;
  }
  return `${guessesUsed}/${maxGuesses}*`;
}

/**
 * @param {{
 *   modeLabel: string,
 *   cadence: 'daily' | 'random',
 *   status: 'in_progress' | 'won' | 'lost',
 *   guesses: Array<{ marks: ('correct' | 'present' | 'absent')[], fidelity: number }>,
 *   maxGuesses: number,
 *   link: string,
 * }} input
 */
export function buildShareText(input) {
  const {
    modeLabel,
    cadence,
    status,
    guesses,
    maxGuesses,
    link,
  } = input;

  const cadenceLabel = cadence === "daily" ? "Daily" : "Unlimited";
  const score = getShareScore(status, guesses.length, maxGuesses);

  const gridLines = guesses.map((guess) => guess.marks.map(markToEmoji).join(""));
  const bestFidelity = guesses.length
    ? Math.max(...guesses.map((guess) => guess.fidelity))
    : 0;

  const lines = [
    `QWordle ${modeLabel} ${cadenceLabel} ${score}`,
    ...gridLines,
    `Fidelity: ${bestFidelity.toFixed(6)}`,
    `Play: ${link}`,
  ];

  return lines.join("\n");
}
