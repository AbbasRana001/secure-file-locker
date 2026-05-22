/**
 * main.js — UI logic for Secure File Locker
 * Two independent panels: Encrypt and Decrypt.
 * Falls back to cipher.js if the Python API is unreachable.
 */

import { vigenere } from "./cipher.js";

/* ─── Toast ─────────────────────────────────────────────────────── */
const toast    = document.getElementById("toast");
const toastMsg = document.getElementById("toastMsg");
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

/* ─── Copy to clipboard ──────────────────────────────────────────── */
function copyText(text) {
  if (!text || !text.trim()) { showToast("Nothing to copy.", true); return; }
  navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard."));
}

/* ─── Download as .txt ───────────────────────────────────────────── */
function downloadTxt(text, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("Downloaded " + filename);
}

/* ─── Core cipher call ───────────────────────────────────────────────
   1. Try the Python serverless API.
   2. If that fails for ANY reason, run the same algorithm in cipher.js.
   Always returns the result string, or throws with a readable message.
──────────────────────────────────────────────────────────────────── */
async function runCipher(text, key, mode) {
  if (!text || text.trim() === "") throw new Error("No text to process.");
  if (!key || key.replace(/[^a-zA-Z]/g, "") === "") throw new Error("Key must contain at least one letter.");

  // Try API
  try {
    const res = await fetch("/api/cipher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, key, mode }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.result !== undefined) return data.result;
    }
  } catch (_) {
    // Network error or API unavailable — fall through to JS
  }

  // JS fallback — guaranteed to work offline / local file open
  return vigenere(text, key, mode === "encrypt");
}

/* ─── Eye toggle ─────────────────────────────────────────────────── */
function setupEye(eyeBtn, input) {
  eyeBtn.addEventListener("click", () => {
    const hidden = input.type === "password";
    input.type = hidden ? "text" : "password";
    eyeBtn.querySelector(".eye-icon").textContent = hidden ? "👁" : "🙈";
    eyeBtn.setAttribute("aria-label", hidden ? "Hide key" : "Show key");
  });
}

/* ─── Build one panel (encrypt or decrypt) ───────────────────────────
   All IDs are prefixed with `p` ("enc" or "dec") so this function
   works identically for both panels with zero duplication.
──────────────────────────────────────────────────────────────────── */
function buildPanel(p, mode) {
  // Grab every element by its prefixed ID
  const dropzone    = document.getElementById(p + "Dropzone");
  const fileInput   = document.getElementById(p + "FileInput");
  const textarea    = document.getElementById(p + "TextInput");
  const keyInput    = document.getElementById(p + "KeyInput");
  const eyeBtn      = document.getElementById(p + "EyeBtn");
  const actionBtn   = document.getElementById(p + "Btn");       // Encrypt / Decrypt
  const spinner     = document.getElementById(p + "Spinner");
  const outputBox   = document.getElementById(p + "OutputBox");
  const placeholder = document.getElementById(p + "OutputPlaceholder");
  const badge       = document.getElementById(p + "Badge");
  const outCopy     = document.getElementById(p + "OutputCopy");
  const outClear    = document.getElementById(p + "OutputClear");
  const dlBtn       = document.getElementById(p + "DownloadBtn");
  const txtCopy     = document.getElementById(p + "TextCopy");
  const txtClear    = document.getElementById(p + "TextClear");
  const keyCopy     = document.getElementById(p + "KeyCopy");

  // Holds the FULL text of any uploaded file (textarea may only show preview)
  let fileContent = "";
  // Holds the last cipher result
  let result = "";

  /* ── Enable / disable the action button ──
     Needs: something to process (file OR typed text) + a valid key   */
  function refreshBtn() {
    const hasText = fileContent.length > 0 || textarea.value.trim().length > 0;
    const hasKey  = keyInput.value.replace(/[^a-zA-Z]/g, "").length > 0;
    actionBtn.disabled = !(hasText && hasKey);
  }

  /* ── File loader ── */
  function loadFile(file) {
    if (!file) return;
    if (!file.name.endsWith(".txt")) {
      showToast("Only .txt files are supported.", true);
      return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      fileContent = e.target.result;          // store full text
      // Show preview in textarea
      textarea.value = fileContent.length > 4000
        ? fileContent.slice(0, 4000) + "…"
        : fileContent;
      // Update dropzone UI
      dropzone.classList.add("dropzone--loaded");
      dropzone.querySelector(".dropzone__label").textContent = file.name;
      dropzone.querySelector(".dropzone__hint").textContent  =
        (file.size / 1024).toFixed(1) + " KB loaded";
      refreshBtn();
    };
    reader.onerror = function() {
      showToast("Could not read the file.", true);
    };
    reader.readAsText(file);
  }

  /* ── Reset output area ── */
  function resetOutput() {
    result = "";
    outputBox.classList.remove("has-output");
    // Clear text content but keep the placeholder element inside
    while (outputBox.firstChild) outputBox.removeChild(outputBox.firstChild);
    outputBox.appendChild(placeholder);
    placeholder.hidden = false;
    badge.hidden = true;
    outCopy.disabled  = true;
    outClear.disabled = true;
    dlBtn.disabled    = true;
  }

  /* ── Events ── */

  // File input (click)
  fileInput.addEventListener("change", function(e) {
    loadFile(e.target.files[0]);
  });

  // Drag and drop
  dropzone.addEventListener("dragover", function(e) {
    e.preventDefault();
    dropzone.classList.add("dropzone--over");
  });
  dropzone.addEventListener("dragleave", function() {
    dropzone.classList.remove("dropzone--over");
  });
  dropzone.addEventListener("drop", function(e) {
    e.preventDefault();
    dropzone.classList.remove("dropzone--over");
    loadFile(e.dataTransfer.files[0]);
  });

  // Typing in textarea clears any loaded file
  textarea.addEventListener("input", function() {
    fileContent = "";
    refreshBtn();
  });

  // Key input
  keyInput.addEventListener("input", refreshBtn);

  // Eye toggle
  setupEye(eyeBtn, keyInput);

  // Copy plaintext / ciphertext
  txtCopy.addEventListener("click", function() {
    copyText(fileContent || textarea.value);
  });

  // Clear input
  txtClear.addEventListener("click", function() {
    textarea.value = "";
    fileContent    = "";
    dropzone.classList.remove("dropzone--loaded");
    dropzone.querySelector(".dropzone__label").textContent = "Drop a .txt file, or click to browse";
    dropzone.querySelector(".dropzone__hint").textContent  = ".txt only — stays in your browser";
    // Reset the file input so the same file can be re-selected
    fileInput.value = "";
    refreshBtn();
  });

  // Copy key
  keyCopy.addEventListener("click", function() {
    copyText(keyInput.value);
  });

  // Main action button (Encrypt or Decrypt)
  actionBtn.addEventListener("click", async function() {
    const text = fileContent || textarea.value;
    const key  = keyInput.value;

    spinner.hidden  = false;
    actionBtn.disabled = true;

    try {
      result = await runCipher(text, key, mode);

      // Render output
      placeholder.hidden = true;
      outputBox.classList.add("has-output");
      outputBox.textContent = result.length > 8000
        ? result.slice(0, 8000) + "\n\n[preview truncated — download for full output]"
        : result;

      badge.hidden      = false;
      outCopy.disabled  = false;
      outClear.disabled = false;
      dlBtn.disabled    = false;

      showToast(mode === "encrypt" ? "Encrypted successfully." : "Decrypted successfully.");
    } catch (err) {
      showToast(err.message || "Something went wrong.", true);
    } finally {
      spinner.hidden = false;
      refreshBtn();
    }
  });

  // Copy output
  outCopy.addEventListener("click", function() { copyText(result); });

  // Clear output
  outClear.addEventListener("click", resetOutput);

  // Download
  dlBtn.addEventListener("click", function() {
    downloadTxt(result, mode === "encrypt" ? "encrypted.txt" : "decrypted.txt");
  });
}

/* ─── Boot both panels ───────────────────────────────────────────── */
buildPanel("enc", "encrypt");
buildPanel("dec", "decrypt");

/* ─── Mode switcher (Encrypt & Save / Decrypt & Read) ───────────── */
const modeEncTab = document.getElementById("modeEncTab");
const modeDecTab = document.getElementById("modeDecTab");
const panelEnc   = document.getElementById("panel-encrypt");
const panelDec   = document.getElementById("panel-decrypt");

modeEncTab.addEventListener("click", function() {
  modeEncTab.classList.add("mode-tab--active");
  modeDecTab.classList.remove("mode-tab--active");
  modeEncTab.setAttribute("aria-selected", "true");
  modeDecTab.setAttribute("aria-selected", "false");
  panelEnc.hidden = false;
  panelDec.hidden = true;
});

modeDecTab.addEventListener("click", function() {
  modeDecTab.classList.add("mode-tab--active");
  modeEncTab.classList.remove("mode-tab--active");
  modeDecTab.setAttribute("aria-selected", "true");
  modeEncTab.setAttribute("aria-selected", "false");
  panelDec.hidden = false;
  panelEnc.hidden = true;
});

/* ─── Page navigation (nav tabs + CTA button) ───────────────────── */
function switchPage(target) {
  document.querySelectorAll(".nav-tab").forEach(function(t) {
    t.setAttribute("aria-selected", t.dataset.page === target);
  });
  document.querySelectorAll(".page").forEach(function(p) {
    p.hidden = p.id !== "page-" + target;
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-page]").forEach(function(btn) {
  btn.addEventListener("click", function() { switchPage(btn.dataset.page); });
});