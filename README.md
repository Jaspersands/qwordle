# QWordle

A Wordle-style web game where you guess a 5-gate quantum circuit sequence to match a target quantum state.

Live site: [qwordle.jaspersands.com](https://qwordle.jaspersands.com)

## How it Works

1. Build a 5-gate quantum circuit in **6 attempts or fewer**.
2. After each guess, tiles show standard Wordle feedback:
   - **Green**: Correct gate and correct slot.
   - **Yellow**: Gate is in the sequence, but in a different slot.
   - **Gray**: Gate is not in the remaining sequence.
3. The board displays the resulting quantum state vector and computes state fidelity ($F = |\langle \psi_{\text{guess}} | \psi_{\text{target}} \rangle|^2$) against the target state.

## Game Modes

- **Beginner**: 1 qubit (`q0`), single-qubit gates (`X`, `Y`, `Z`, `H`, `S`, `T`).
- **Intermediate**: 2 qubits (`q0`, `q1`), adds 2-qubit gates (`CX`, `CZ`, `SWAP`). Click tiles on the active row to cycle qubit mappings.
- **Advanced**: 3 qubits (`q0`, `q1`, `q2`), adds 3-qubit gates (`CCX`, `CSWAP`).

Modes can be played as a **Daily Puzzle** (same seed each day) or **Unlimited Random**.

## Project Layout

- `index.html` / `styles.css` – App shell and styles.
- `src/main.js` & `src/game-engine.js` – Game loop and state handling.
- `src/quantum/simulator.js` – In-browser state-vector quantum simulator (no runtime dependencies).
- `src/puzzle-generator.js` – Seeded PRNG for daily puzzles.
- `scripts/qiskit_render_server.py` – Optional Flask backend to render circuit diagrams with Qiskit.
- `tests/` – Unit test suite using Node's native test runner.

## Running Locally & Testing

Serve the directory with any local HTTP server:

```bash
python3 -m http.server 8000
```

Run unit tests:

```bash
npm test
```

Optionally run the Qiskit diagram renderer:

```bash
pip install qiskit matplotlib flask flask-cors
npm run qiskit-renderer
```

## License

MIT
