#!/usr/bin/env python3
"""Local Qiskit renderer for circuit and Bloch sphere visuals."""

from __future__ import annotations

import argparse
import base64
import io
import json
import re
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

import matplotlib

matplotlib.use("Agg")

from matplotlib import pyplot as plt
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector
from qiskit.visualization import plot_bloch_multivector

MAX_BODY_BYTES = 128_000
MAX_TOKEN_COUNT = 64
PROJECT_ROOT = Path(__file__).resolve().parent.parent

SINGLE_PATTERN = re.compile(r"^([XYZHST])(\d)$")
CX_PATTERN = re.compile(r"^CX(\d)(\d)$")
CZ_PATTERN = re.compile(r"^CZ(\d)(\d)$")
SWAP_PATTERN = re.compile(r"^SWAP(\d)(\d)$")
CCX_PATTERN = re.compile(r"^CCX(\d)(\d)(\d)$")
CSWAP_PATTERN = re.compile(r"^CSWAP(\d)(\d)(\d)$")


def _require_qubit(index: int, num_qubits: int, token: str) -> None:
    if index < 0 or index >= num_qubits:
        raise ValueError(f"Token {token} references invalid qubit {index}.")


def _require_distinct(indices: list[int], token: str) -> None:
    if len(set(indices)) != len(indices):
        raise ValueError(f"Token {token} reuses qubit indices.")


def apply_token(qc: QuantumCircuit, num_qubits: int, token: str) -> None:
    if not isinstance(token, str) or not token:
        raise ValueError("Each token must be a non-empty string.")

    match = SINGLE_PATTERN.match(token)
    if match:
        gate, target_text = match.groups()
        target = int(target_text)
        _require_qubit(target, num_qubits, token)
        if gate == "X":
            qc.x(target)
        elif gate == "Y":
            qc.y(target)
        elif gate == "Z":
            qc.z(target)
        elif gate == "H":
            qc.h(target)
        elif gate == "S":
            qc.s(target)
        elif gate == "T":
            qc.t(target)
        else:
            raise ValueError(f"Unsupported gate token: {token}")
        return

    match = CX_PATTERN.match(token)
    if match:
        control = int(match.group(1))
        target = int(match.group(2))
        _require_qubit(control, num_qubits, token)
        _require_qubit(target, num_qubits, token)
        _require_distinct([control, target], token)
        qc.cx(control, target)
        return

    match = CZ_PATTERN.match(token)
    if match:
        control = int(match.group(1))
        target = int(match.group(2))
        _require_qubit(control, num_qubits, token)
        _require_qubit(target, num_qubits, token)
        _require_distinct([control, target], token)
        qc.cz(control, target)
        return

    match = SWAP_PATTERN.match(token)
    if match:
        qa = int(match.group(1))
        qb = int(match.group(2))
        _require_qubit(qa, num_qubits, token)
        _require_qubit(qb, num_qubits, token)
        _require_distinct([qa, qb], token)
        qc.swap(qa, qb)
        return

    match = CCX_PATTERN.match(token)
    if match:
        control1 = int(match.group(1))
        control2 = int(match.group(2))
        target = int(match.group(3))
        _require_qubit(control1, num_qubits, token)
        _require_qubit(control2, num_qubits, token)
        _require_qubit(target, num_qubits, token)
        _require_distinct([control1, control2, target], token)
        qc.ccx(control1, control2, target)
        return

    match = CSWAP_PATTERN.match(token)
    if match:
        control = int(match.group(1))
        swap_a = int(match.group(2))
        swap_b = int(match.group(3))
        _require_qubit(control, num_qubits, token)
        _require_qubit(swap_a, num_qubits, token)
        _require_qubit(swap_b, num_qubits, token)
        _require_distinct([control, swap_a, swap_b], token)
        qc.cswap(control, swap_a, swap_b)
        return

    raise ValueError(f"Unsupported gate token: {token}")


def circuit_svg(qc: QuantumCircuit) -> str:
    figure = qc.draw(output="mpl", fold=-1)
    stream = io.StringIO()
    figure.savefig(stream, format="svg", bbox_inches="tight")
    plt.close(figure)
    return stream.getvalue()


def bloch_data_url(state: Statevector) -> str:
    figure = plot_bloch_multivector(state)
    stream = io.BytesIO()
    figure.savefig(stream, format="png", dpi=140, bbox_inches="tight")
    plt.close(figure)
    encoded = base64.b64encode(stream.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def render_payload(num_qubits: int, tokens: list[str]) -> dict[str, Any]:
    if not isinstance(num_qubits, int) or num_qubits < 1 or num_qubits > 3:
        raise ValueError("numQubits must be an integer between 1 and 3.")
    if not isinstance(tokens, list):
        raise ValueError("tokens must be a list of gate tokens.")
    if len(tokens) > MAX_TOKEN_COUNT:
        raise ValueError(f"tokens can contain at most {MAX_TOKEN_COUNT} entries.")

    qc = QuantumCircuit(num_qubits)
    states = [Statevector.from_label("0" * num_qubits)]

    for token in tokens:
        apply_token(qc, num_qubits, token)
        states.append(Statevector.from_instruction(qc))

    bloch_steps = []
    for step_index, state in enumerate(states):
        if step_index == 0:
            label = f"Start |{'0' * num_qubits}>"
        else:
            label = f"After {tokens[step_index - 1]}"
        bloch_steps.append(
            {
                "step": step_index,
                "label": label,
                "image": bloch_data_url(state),
            }
        )

    return {
        "circuitSvg": circuit_svg(qc),
        "blochSteps": bloch_steps,
    }


class QiskitRenderHandler(BaseHTTPRequestHandler):
    server_version = "QiskitRender/1.0"

    def _set_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        # Required by some browsers when an HTTPS page calls a localhost/private endpoint.
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self._set_cors_headers()
        self.end_headers()

    def _send_file(self, file_path: Path) -> None:
        if not file_path.exists() or not file_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "File not found.")
            return

        suffix = file_path.suffix.lower()
        content_type = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".mjs": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".ico": "image/x-icon",
            ".txt": "text/plain; charset=utf-8",
        }.get(suffix, "application/octet-stream")

        body = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        raw_path = unquote(parsed.path or "/")
        if raw_path == "/":
            self._send_file(PROJECT_ROOT / "index.html")
            return
        if raw_path == "/render":
            self._send_json(HTTPStatus.METHOD_NOT_ALLOWED, {"error": "Use POST /render."})
            return

        requested = (PROJECT_ROOT / raw_path.lstrip("/")).resolve()
        try:
            requested.relative_to(PROJECT_ROOT)
        except ValueError:
            self.send_error(HTTPStatus.FORBIDDEN, "Forbidden path.")
            return
        self._send_file(requested)

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/render":
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
            return

        content_length_raw = self.headers.get("Content-Length", "0")
        try:
            content_length = int(content_length_raw)
        except ValueError:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Invalid Content-Length header."})
            return

        if content_length <= 0:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Request body is required."})
            return
        if content_length > MAX_BODY_BYTES:
            self._send_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "Request too large."})
            return

        body = self.rfile.read(content_length)
        try:
            payload = json.loads(body)
            num_qubits = payload.get("numQubits")
            tokens = payload.get("tokens")
            rendered = render_payload(num_qubits, tokens)
        except ValueError as error:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        except Exception as error:  # pragma: no cover - defensive fallback
            self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(error)})
            return

        self._send_json(HTTPStatus.OK, rendered)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        return


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve Qiskit circuit/Bloch renders over HTTP.")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind.")
    parser.add_argument("--port", default=8765, type=int, help="Port to listen on.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), QiskitRenderHandler)
    print(f"Qiskit renderer listening on http://{args.host}:{args.port}/render")
    server.serve_forever()


if __name__ == "__main__":
    main()
