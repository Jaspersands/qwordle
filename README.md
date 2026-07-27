# QWordle ⚛️

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-25%20passing-brightgreen.svg)](tests/)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](package.json)
[![Domain](https://img.shields.io/badge/domain-qwordle.jaspersands.com-purple.svg)](https://qwordle.jaspersands.com)

**QWordle** is a quantum computing twist on the classic Wordle puzzle game. Instead of guessing 5-letter English words, players construct 5-gate quantum circuit sequences to match a target quantum state vector.

Live Site: [qwordle.jaspersands.com](https://qwordle.jaspersands.com)

---

## 🎯 Overview & Game Rules

In QWordle, a secret target quantum circuit sequence is generated. Your goal is to deduce the exact 5-gate sequence within **6 guesses**.

Each guess provides feedback on two levels:
1. **Wordle-Style Tile Feedback**:
   - 🟩 **Green**: Correct gate type and correct position in the sequence.
   - 🟨 **Yellow**: Gate type exists in the target sequence, but in a different position.
   - ⬛ **Gray**: Gate type is not present in the remaining target sequence slots.
2. **Quantum State Fidelity**:
   - Calculates the exact quantum fidelity $F = |\langle \psi_{\text{guess}} | \psi_{\text{target}} \rangle|^2$ between your circuit's output state and the target state vector.
   - Displays the current quantum state superposition (e.g. $\frac{1}{\sqrt{2}}|00\rangle + \frac{1}{\sqrt{2}}|11\rangle$).

---

## 🚀 Key Features

* **3 Difficulty Modes**:
  * **Beginner**: 1-qubit circuits ($q_0$) with single-qubit Clifford & $T$ gates (`X`, `Y`, `Z`, `H`, `S`, `T`).
  * **Intermediate**: 2-qubit circuits ($q_0, q_1$) adding 2-qubit entangling gates (`CX`, `CZ`, `SWAP`). Interactive tile clicking allows custom qubit target/control mappings.
  * **Advanced**: 3-qubit circuits ($q_0, q_1, q_2$) adding 3-qubit gates (`CCX` / Toffoli, `CSWAP` / Fredkin).
* **2 Cadences**:
  * **Daily Puzzle**: Deterministic seed-based puzzle of the day shared globally across all players.
  * **Unlimited Random**: Practice mode with infinite randomly generated puzzles.
* **In-Browser Quantum State Vector Simulator**:
  * Native JavaScript complex linear algebra matrix-vector simulation engine (`src/quantum/simulator.js`).
  * Zero external runtime bundle dependencies.
* **Optional Qiskit Circuit Diagram Server**:
  * Embedded Python backend (`scripts/qiskit_render_server.py`) rendering high-resolution Qiskit circuit diagrams.
* **Progress & Stats Tracking**:
  * Saved via LocalStorage (win streak, distribution, current games per mode/cadence).
  * High-contrast mode, dark theme toggle, and shareable emoji grid output.

---

## 📂 Project Structure

```
qwordle/
├── index.html                  # Main application shell and UI layout
├── styles.css                  # Modern CSS design system with custom properties
├── package.json                # Project config and test scripts
├── CNAME                       # GitHub Pages custom domain config
├── src/
│   ├── main.js                 # App initialization and state controller
│   ├── ui.js                   # DOM rendering, event handling, animations
│   ├── game-engine.js          # Core game loop, mode management, turn tracking
│   ├── puzzle-generator.js     # Seeded PRNG for daily puzzles & random generator
│   ├── feedback.js             # Wordle-style score evaluation logic
│   ├── gate-catalog.js         # Quantum gate set definitions and qubit mappings
│   ├── storage.js              # LocalStorage persistence manager
│   ├── share.js                # Emoji matrix grid formatter for social sharing
│   ├── token-mapping.js        # Qubit index mapping utility
│   ├── qiskit-render-client.js # Client bridge for optional Qiskit server
│   └── quantum/
│       ├── simulator.js        # Full state-vector quantum circuit simulator
│       └── complex.js          # Complex number arithmetic library
├── scripts/
│   └── qiskit_render_server.py # Python Flask/Qiskit circuit diagram rendering service
└── tests/
    ├── feedback.test.mjs       # Unit tests for scoring algorithm
    ├── game-engine.test.mjs    # Unit tests for turn & state transitions
    ├── puzzle-generator.test.mjs # Unit tests for daily puzzle seeding
    ├── share.test.mjs          # Unit tests for share grid formatting
    ├── simulator.test.mjs      # Unit tests for state vector simulator
    └── storage.test.mjs        # Unit tests for persistence layer
```

---

## 🧪 Quantum Simulator Mechanics

The simulator models an $n$-qubit state vector $|\psi\rangle \in \mathbb{C}^{2^n}$ initialized to $|0\dots0\rangle$.

### Supported Quantum Gates
| Gate Symbol | Name | Matrix Representation / Operation |
| :--- | :--- | :--- |
| **X** | Pauli-X (NOT) | Bit flip: $|0\rangle \leftrightarrow |1\rangle$ |
| **Y** | Pauli-Y | Bit & phase flip: $Y = iXZ$ |
| **Z** | Pauli-Z | Phase flip: $|1\rangle \to -|1\rangle$ |
| **H** | Hadamard | Superposition: $|0\rangle \to \frac{|0\rangle + |1\rangle}{\sqrt{2}}$ |
| **S** | Phase ($\sqrt{Z}$) | Phase shift: $|1\rangle \to i|1\rangle$ |
| **T** | $\pi/8$ ($\sqrt{S}$) | Phase shift: $|1\rangle \to e^{i\pi/4}|1\rangle$ |
| **CX** | Controlled-NOT | Flips target qubit when control is $|1\rangle$ |
| **CZ** | Controlled-Z | Phase flips when both qubits are $|1\rangle$ |
| **SWAP** | Swap | Swaps state of two qubits |
| **CCX** | Toffoli | Controlled-Controlled-NOT on 3 qubits |
| **CSWAP** | Fredkin | Controlled-SWAP on 3 qubits |

### State Vector & Fidelity
Fidelity between the guess state $|\psi_g\rangle$ and target state $|\psi_t\rangle$ is computed as:
$$F = |\langle \psi_g | \psi_t \rangle|^2 = \left| \sum_{k=0}^{2^n-1} a_k^* b_k \right|^2$$

---

## 🛠️ Development & Testing

### Prerequisites
- **Node.js**: v18.0.0 or higher (uses native test runner `node --test`)
- **Python** (Optional, for Qiskit renderer): Python 3.9+ with `qiskit` and `matplotlib`

### Running Locally
Simply serve `index.html` using any local HTTP server (or double click `index.html`):

```bash
# Using Python builtin HTTP server
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

### Running Unit Tests
QWordle includes a zero-dependency native test suite:

```bash
npm test
```

### Running the Qiskit Circuit Renderer (Optional)
To enable server-side Qiskit circuit diagram rendering:

```bash
pip install qiskit matplotlib flask flask-cors
npm run qiskit-renderer
```

---

## 📜 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
