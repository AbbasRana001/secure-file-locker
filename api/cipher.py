"""
Vigenère Cipher — Vercel Python Serverless Function
Handles POST /api/cipher with JSON body:
  { "text": str, "key": str, "mode": "encrypt" | "decrypt" }
Returns:
  { "result": str } or { "error": str }
"""

import json
import re


def vigenere(text: str, key: str, encrypt: bool) -> str:
    """
    Apply the Vigenère cipher to `text` using `key`.
    Non-alphabetic characters pass through unchanged.
    Encrypt:  E(i) = (P(i) + K(i)) mod 26
    Decrypt:  D(i) = (C(i) - K(i) + 26) mod 26
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


def handler(request):
    """Vercel Python handler."""
    # CORS headers for browser fetch
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if request.method == "OPTIONS":
        return Response("", status=204, headers=headers)

    if request.method != "POST":
        body = json.dumps({"error": "Method not allowed."})
        return Response(body, status=405, headers=headers)

    try:
        payload = request.json
        text = payload.get("text", "")
        key = payload.get("key", "")
        mode = payload.get("mode", "")

        if mode not in ("encrypt", "decrypt"):
            raise ValueError("mode must be 'encrypt' or 'decrypt'.")
        if not text:
            raise ValueError("text is required.")
        if not key:
            raise ValueError("key is required.")

        result = vigenere(text, key, encrypt=(mode == "encrypt"))
        body = json.dumps({"result": result})
        return Response(body, status=200, headers=headers)

    except (KeyError, ValueError, TypeError) as exc:
        body = json.dumps({"error": str(exc)})
        return Response(body, status=400, headers=headers)