"""
Vigenère Cipher — Vercel Python Serverless Function
POST /api/cipher
Body: { "text": str, "key": str, "mode": "encrypt" | "decrypt" }
"""

import json
import re
from http.server import BaseHTTPRequestHandler


def vigenere(text: str, key: str, encrypt: bool) -> str:
    """
    Apply the Vigenère cipher.
    Encrypt:  E(i) = (P(i) + K(i)) mod 26
    Decrypt:  D(i) = (C(i) - K(i) + 26) mod 26
    Non-alphabetic characters pass through unchanged.
    """
    key = re.sub(r"[^A-Za-z]", "", key).upper()
    if not key:
        raise ValueError("Key must contain at least one letter.")

    result = []
    key_index = 0

    for ch in text:
        if ch.isalpha():
            base = ord("A") if ch.isupper() else ord("a")
            shift = ord(key[key_index % len(key)]) - ord("A")
            code = ord(ch.upper()) - ord("A")
            shifted = (code + shift) % 26 if encrypt else (code - shift + 26) % 26
            result.append(chr(shifted + base))
            key_index += 1
        else:
            result.append(ch)

    return "".join(result)


class handler(BaseHTTPRequestHandler):

    def _send(self, status: int, body: dict):
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self._send(204, {})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        try:
            payload = json.loads(self.rfile.read(length))
            text = payload.get("text", "")
            key  = payload.get("key", "")
            mode = payload.get("mode", "")

            if mode not in ("encrypt", "decrypt"):
                raise ValueError("mode must be 'encrypt' or 'decrypt'.")
            if not text:
                raise ValueError("text is required.")
            if not key:
                raise ValueError("key is required.")

            result = vigenere(text, key, encrypt=(mode == "encrypt"))
            self._send(200, {"result": result})

        except (ValueError, KeyError, TypeError) as exc:
            self._send(400, {"error": str(exc)})
        except Exception:
            self._send(500, {"error": "Internal server error."})