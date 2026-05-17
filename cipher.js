/**
 * cipher.js — Vigenère Cipher (client-side module)
 * Mirrors the logic in api/cipher.py.
 * Used as a local fallback if the API call fails.
 *
 * Encrypt:  E(i) = (P(i) + K(i)) mod 26
 * Decrypt:  D(i) = (C(i) − K(i) + 26) mod 26
 */

/**
 * @param {string} text
 * @param {string} key   — letters only; non-letters are stripped
 * @param {boolean} encrypt
 * @returns {string}
 */
export function vigenere(text, key, encrypt) {
  const k = key.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (!k.length) throw new Error("Key must contain at least one letter.");

  let j = 0;
  return [...text]
    .map((ch) => {
      if (/[a-zA-Z]/.test(ch)) {
        const base  = ch === ch.toUpperCase() ? 65 : 97;
        const shift = k.charCodeAt(j % k.length) - 65;
        const code  = ch.toUpperCase().charCodeAt(0) - 65;
        const s     = encrypt ? (code + shift) % 26 : (code - shift + 26) % 26;
        j++;
        return String.fromCharCode(s + base);
      }
      return ch;
    })
    .join("");
}