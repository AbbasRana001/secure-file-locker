# Secure File Locker

A web application that encrypts and decrypts `.txt` files using the **Vigenère cipher**.

## Features

- Upload a `.txt` file or paste text directly
- Enter a secret keyword to encrypt or decrypt
- Download the output as a `.txt` file
- Fully client-side — no data ever leaves your browser

## How it works

The Vigenère cipher is a polyalphabetic substitution cipher:

- **Encrypt:** `Eᵢ = (Pᵢ + Kᵢ) mod 26`
- **Decrypt:** `Dᵢ = (Cᵢ − Kᵢ + 26) mod 26`

## Running locally

Just open `index.html` in any browser. No build step required.

## Deployment

Deployed on Vercel. Any push to `main` automatically redeploys the app.
