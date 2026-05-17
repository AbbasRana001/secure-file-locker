# Secure File Locker

A web application that encrypts and decrypts `.txt` files using the **Vigenère cipher**.

## File Structure

```
secure-file-locker/
├── index.html        # Markup only — no inline styles or scripts
├── style.css         # All styling
├── main.js           # UI logic (ES module)
├── cipher.js         # Client-side Vigenère implementation (JS fallback)
├── api/
│   └── cipher.py     # Core cipher logic — Python serverless function (Vercel)
├── vercel.json       # Deployment config (static + Python function)
└── README.md
```

## Features

- Upload a `.txt` file or paste text directly
- Enter a secret keyword to encrypt or decrypt
- Download the output as a `.txt` file
- Python serverless function handles cipher logic; JavaScript fallback if API is unavailable
- Fully client-safe — no data stored or logged

## How it works

The Vigenère cipher is a polyalphabetic substitution cipher:

- **Encrypt:** `E(i) = (P(i) + K(i)) mod 26`
- **Decrypt:** `D(i) = (C(i) − K(i) + 26) mod 26`

Non-alphabetic characters (spaces, digits, punctuation) pass through unchanged.

## Running locally

```bash
# Option 1 — open directly (JS fallback, no Python)
open index.html

# Option 2 — run with Vercel CLI (enables Python function)
npm i -g vercel
vercel dev
```

## Deployment

Deployed on Vercel. Push to `main` to redeploy automatically.  
The `@vercel/python` builder handles `api/cipher.py` as a serverless function.