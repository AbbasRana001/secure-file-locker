/**
 * main.js — UI logic for Secure File Locker
 * Calls the Python API (/api/cipher) with a client-side fallback via cipher.js.
 */

import { vigenere } from "./cipher.js";

/* ── State ── */
let fileText = "";
let outputText = "";

/* ── DOM refs ── */
const dropzone  = document.getElementById("dropzone");
const fileInput  = document.getElementById("fileInput");
const textarea   = document.getElementById("textInput");
const keyInput   = document.getElementById("keyInput");
const eyeBtn     = document.getElementById("eyeBtn");
const encBtn     = document.getElementById("encBtn");
const decBtn     = document.getElementById("decBtn");
const outputBox  = document.getElementById("outputBox");
const outputPlaceholder = document.getElementById("outputPlaceholder");
const outputBadge = document.getElementById("outputBadge");
const copyBtn    = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const spinner    = document.getElementById("spinner");
const toast      = document.getElementById("toast");
const toastMsg   = document.getElementById("toastMsg");

/* ── Toast ── */
let toastTimer;
function showToast(msg, isError = false) {
  toastMsg.textContent = msg;
  toast.className = `toast ${isError ? "toast--error" : "toast--ok"}`;
  toast.setAttribute("aria-hidden", "false");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.setAttribute("aria-hidden", "true");
    toast.className = "toast";
  }, 2800);
}

/* ── Button enable/disable ── */
function updateButtons() {
  const hasText = textarea.value.trim() || fileText;
  const hasKey  = keyInput.value.replace(/[^a-zA-Z]/g, "").length > 0;
  const ready   = !!(hasText && hasKey);
  encBtn.disabled = !ready;
  decBtn.disabled = !ready;
}

/* ── Show output ── */
function renderOutput(text, mode) {
  outputText = text;
  outputPlaceholder.hidden = true;
  outputBox.textContent = text.length > 8000
    ? text.slice(0, 8000) + "\n\n[preview truncated — download for full output]"
    : text;
  outputBadge.textContent = mode === "encrypt" ? "🔒 Encrypted" : "🔓 Decrypted";
  outputBadge.className   = `badge ${mode === "encrypt" ? "badge--enc" : "badge--dec"}`;
  outputBadge.hidden = false;
  copyBtn.disabled = false;
  downloadBtn.disabled = false;
}

/* ── Call Python API, fall back to JS ── */
async function runCipher(mode) {
  const text = fileText || textarea.value;
  const key  = keyInput.value;

  if (!key.replace(/[^a-zA-Z]/g, "")) {
    showToast("Key must contain at least one letter.", true);
    return;
  }

  spinner.hidden = false;
  encBtn.disabled = decBtn.disabled = true;

  try {
    const res = await fetch("/api/cipher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, key, mode }),
    });

    if (res.ok) {
      const data = await res.json();
      renderOutput(data.result, mode);
      showToast(mode === "encrypt" ? "Encrypted successfully." : "Decrypted successfully.");
    } else {
      throw new Error("API error");
    }
  } catch {
    // Fallback: run cipher in JS (same algorithm as cipher.py)
    try {
      const result = vigenere(text, key, mode === "encrypt");
      renderOutput(result, mode);
      showToast(mode === "encrypt" ? "Encrypted successfully." : "Decrypted successfully.");
    } catch (err) {
      showToast(err.message, true);
    }
  } finally {
    spinner.hidden = true;
    updateButtons();
  }
}

/* ── File handling ── */
function loadFile(file) {
  if (!file) return;
  if (!file.name.endsWith(".txt")) {
    showToast("Only .txt files are supported.", true);
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    fileText = e.target.result;
    textarea.value = fileText.length > 4000
      ? fileText.slice(0, 4000) + "…"
      : fileText;
    dropzone.classList.add("dropzone--loaded");
    dropzone.querySelector(".dropzone__label").textContent = file.name;
    dropzone.querySelector(".dropzone__hint").textContent =
      (file.size / 1024).toFixed(1) + " KB loaded";
    updateButtons();
  };
  reader.readAsText(file);
}

/* ── Events ── */
fileInput.addEventListener("change", (e) => loadFile(e.target.files[0]));

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dropzone--over");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dropzone--over"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dropzone--over");
  loadFile(e.dataTransfer.files[0]);
});

textarea.addEventListener("input", () => { fileText = ""; updateButtons(); });
keyInput.addEventListener("input", updateButtons);

eyeBtn.addEventListener("click", () => {
  const show = keyInput.type === "password";
  keyInput.type = show ? "text" : "password";
  eyeBtn.setAttribute("aria-label", show ? "Hide key" : "Show key");
  eyeBtn.querySelector(".eye-icon").textContent = show ? "👁" : "🙈";
});

encBtn.addEventListener("click", () => runCipher("encrypt"));
decBtn.addEventListener("click", () => runCipher("decrypt"));

copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(outputText).then(() => showToast("Copied to clipboard."));
});

downloadBtn.addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([outputText], { type: "text/plain" }));
  a.download = "output.txt";
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("Downloaded output.txt");
});

/* ── Tab navigation ── */
document.querySelectorAll(".nav-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.page;
    document.querySelectorAll(".nav-tab").forEach((t) =>
      t.setAttribute("aria-selected", t.dataset.page === target)
    );
    document.querySelectorAll(".page").forEach((p) => {
      p.hidden = p.id !== `page-${target}`;
    });
  });
});