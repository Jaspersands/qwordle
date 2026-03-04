import test from "node:test";
import assert from "node:assert/strict";

import { buildShareText, getShareScore, markToEmoji } from "../src/share.js";

test("share: mark mapping", () => {
  assert.equal(markToEmoji("correct"), "🟩");
  assert.equal(markToEmoji("present"), "🟨");
  assert.equal(markToEmoji("absent"), "⬛");
});

test("share: score formatting", () => {
  assert.equal(getShareScore("won", 3, 6), "3/6");
  assert.equal(getShareScore("lost", 6, 6), "X/6");
  assert.equal(getShareScore("in_progress", 2, 6), "2/6*");
});

test("share: text contains emoji rows and link", () => {
  const text = buildShareText({
    modeLabel: "Beginner",
    cadence: "daily",
    status: "won",
    guesses: [
      { marks: ["present", "absent", "absent", "correct", "absent"], fidelity: 0.5 },
      { marks: ["correct", "correct", "correct", "correct", "correct"], fidelity: 1 },
    ],
    maxGuesses: 6,
    link: "http://localhost:8080/",
  });

  assert.match(text, /QWordle Beginner Daily 2\/6/);
  assert.match(text, /🟨⬛⬛🟩⬛/);
  assert.match(text, /🟩🟩🟩🟩🟩/);
  assert.match(text, /Play: http:\/\/localhost:8080\//);
});
