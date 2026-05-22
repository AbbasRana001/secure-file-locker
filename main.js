/**
 * main.js — UI logic for Secure File Locker
 * Two independent panels: Encrypt and Decrypt.
 * Calls Python API (/api/cipher) with client-side fallback via cipher.js.
 */

import { vigenere } from "./cipher.js";

/* ════════════════════════════════════════
   TOAST
════════════════════════════════════════ */
const toast = document.getElementById("toast");
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

/* ════════════════════════════════════════
   COPY HELPER — used for every copy button
════════════════════════════════════════ */
function copyText(text) {
  if (!text || !text.trim()) { showToast("Nothing to copy.", true); return; }
  navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard."));
}

/* ════════════════════════════════════════
   DOWNLOAD HELPER
════════════════════════════════════════ */
function downloadTxt(text, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`Downloaded ${filename}`);
}

/* ════════════════════════════════════════
   CIPHER RUNNER — calls API, falls back to JS
════════════════════════════════════════ */
async function runCipher(text, key, mode) {
  // Try the Python serverless API first
  try {
    const res = await fetch("/api/cipher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, key, mode }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.result;
    }
    // API returned an error status — fall through to JS fallback
    throw new Error("API error");
  } catch {
    // Fallback: run the exact same algorithm in cipher.js
    return vigenere(text, key, mode === "encrypt");
  }
}

/* ════════════════════════════════════════
   EYE TOGGLE HELPER
════════════════════════════════════════ */
function setupEyeToggle(eyeBtn, keyInput) {
  eyeBtn.addEventListener("click", () => {
    const isHidden = keyInput.type === "password";
    keyInput.type = isHidden ? "text" : "password";
    eyeBtn.querySelector(".eye-icon").textContent = isHidden ? "👁" : "🙈";
    eyeBtn.setAttribute("aria-label", isHidden ? "Hide key" : "Show key");
  });
}

/* ════════════════════════════════════════
   FILE LOADER HELPER
   Reads a .txt file, puts full content in fileState,
   shows a preview in the textarea, updates the dropzone UI.
════════════════════════════════════════ */
function setupDropzone(dropzone, fileInput, textarea, fileState, onLoaded) {
  // Click on file input
  fileInput.addEventListener("change", (e) => loadFile(e.target.files[0]));

  // Drag and drop
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

  // When user types in the textarea, clear any loaded file
  // so we use the typed text instead
  textarea.addEventListener("input", () => {
    fileState.text = "";
    onLoaded();
  });

  function loadFile(file) {
    if (!file) return;
    if (!file.name.endsWith(".txt")) {
      showToast("Only .txt files are supported.", true);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      // Store the FULL file text in state
      fileState.text = e.target.result;

      // Show a preview in the textarea (first 4000 chars)
      textarea.value = fileState.text.length > 4000
        ? fileState.text.slice(0, 4000) + "…"
        : fileState.text;

      // Update dropzone appearance
      dropzone.classList.add("dropzone--loaded");
      dropzone.querySelector(".dropzone__label").textContent = file.name;
      dropzone.querySelector(".dropzone__hint").textContent =
        (file.size / 1024).toFixed(1) + " KB loaded";

      // Tell the panel to re-check if the button should be enabled
      onLoaded();
    };
    reader.readAsText(file);
  }
}

/* ════════════════════════════════════════
   OUTPUT RENDERER
   Fills the output box with result text and enables action buttons.
════════════════════════════════════════ */
function renderOutput(outputBox, placeholder, badge, text) {
  placeholder.hidden = true;
  outputBox.classList.add("has-output");
  outputBox.textContent = text.length > 8000
    ? text.slice(0, 8000) + "\n\n[preview truncated — download for full output]"
    : text;
  badge.hidden = false;
}

function clearOutput(outputBox, placeholder, badge, buttons) {
  placeholder.hidden = false;
  outputBox.classList.remove("has-output");
  outputBox.textContent = "";
  outputBox.appendChild(placeholder);
  badge.hidden = true;
  buttons.forEach((b) => { b.disabled = true; });
}

/* ════════════════════════════════════════
   ENCRYPT PANEL
════════════════════════════════════════ */
(function setupEncryptPanel() {
  // State: holds the full text of any uploaded file
  const fileState = { text: "" };

  // DOM elements
  const dropzone = document.getElementById("encDropzone");
  const fileInput = document.getElementById("encFileInput");
  const textarea = document.getElementById("encTextInput");
  const keyInput = document.getElementById("encKeyInput");
  const eyeBtn = document.getElementById("encEyeBtn");
  const encBtn = document.getElementById("encBtn");
  const spinner = document.getElementById("encSpinner");
  const outputBox = document.getElementById("encOutputBox");
  const placeholder = document.getElementById("encOutputPlaceholder");
  const badge = document.getElementById("encBadge");
  const copyOutput = document.getElementById("encOutputCopy");
  const clearOutput_ = document.getElementById("encOutputClear");
  const downloadBtn = document.getElementById("encDownloadBtn");
  const copyText_ = document.getElementById("encTextCopy");
  const clearText = document.getElementById("encTextClear");
  const copyKey = document.getElementById("encKeyCopy");

  // Stored result for copy/download
  let result = "";

  /* Check whether the Encrypt button should be enabled.
     Requires: some text (typed or file loaded) AND a key with letters. */
  function updateBtn() {
    const hasText = textarea.value.trim().length > 0 || fileState.text.length > 0;
    const hasKey = keyInput.value.replace(/[^a-zA-Z]/g, "").length > 0;
    encBtn.disabled = !(hasText && hasKey);
  }

  // Wire up dropzone + file input + textarea clear-on-type
  setupDropzone(dropzone, fileInput, textarea, fileState, updateBtn);

  // Key input also triggers button check
  keyInput.addEventListener("input", updateBtn);

  // Eye toggle
  setupEyeToggle(eyeBtn, keyInput);

  // Copy plaintext button
  copyText_.addEventListener("click", () => copyText(fileState.text || textarea.value));

  // Clear plaintext button
  clearText.addEventListener("click", () => {
    textarea.value = "";
    fileState.text = "";
    // Reset dropzone appearance
    dropzone.classList.remove("dropzone--loaded");
    dropzone.querySelector(".dropzone__label").textContent = "Drop a .txt file, or click to browse";
    dropzone.querySelector(".dropzone__hint").textContent = ".txt only — stays in your browser";
    updateBtn();
  });

  // Copy key button
  copyKey.addEventListener("click", () => copyText(keyInput.value));

  // Encrypt button
  encBtn.addEventListener("click", async () => {
    const text = fileState.text || textarea.value;
    const key = keyInput.value;

    spinner.hidden = false;
    encBtn.disabled = true;

    try {
      result = await runCipher(text, key, "encrypt");
      renderOutput(outputBox, placeholder, badge, result);
      copyOutput.disabled = false;
      clearOutput_.disabled = false;
      downloadBtn.disabled = false;
      showToast("Encrypted successfully.");
    } catch (err) {
      showToast(err.message || "Encryption failed.", true);
    } finally {
      spinner.hidden = true;
      updateBtn();
    }
  });

  // Copy output button
  copyOutput.addEventListener("click", () => copyText(result));

  // Clear output button
  clearOutput_.addEventListener("click", () => {
    result = "";
    clearOutput(outputBox, placeholder, badge, [copyOutput, clearOutput_, downloadBtn]);
  });

  // Download button
  downloadBtn.addEventListener("click", () => downloadTxt(result, "encrypted.txt"));
})();


/* ════════════════════════════════════════
   DECRYPT PANEL
════════════════════════════════════════ */
(function setupDecryptPanel() {
  const fileState = { text: "" };

  const dropzone = document.getElementById("decDropzone");
  const fileInput = document.getElementById("decFileInput");
  const textarea = document.getElementById("decTextInput");
  const keyInput = document.getElementById("decKeyInput");
  const eyeBtn = document.getElementById("decEyeBtn");
  const decBtn = document.getElementById("decBtn");
  const spinner = document.getElementById("decSpinner");
  const outputBox = document.getElementById("decOutputBox");
  const placeholder = document.getElementById("decOutputPlaceholder");
  const badge = document.getElementById("decBadge");
  const copyOutput = document.getElementById("decOutputCopy");
  const clearOutput_ = document.getElementById("decOutputClear");
  const downloadBtn = document.getElementById("decDownloadBtn");
  const copyText_ = document.getElementById("decTextCopy");
  const clearText = document.getElementById("decTextClear");
  const copyKey = document.getElementById("decKeyCopy");

  let result = "";

  function updateBtn() {
    const hasText = textarea.value.trim().length > 0 || fileState.text.length > 0;
    const hasKey = keyInput.value.replace(/[^a-zA-Z]/g, "").length > 0;
    decBtn.disabled = !(hasText && hasKey);
  }

  setupDropzone(dropzone, fileInput, textarea, fileState, updateBtn);
  keyInput.addEventListener("input", updateBtn);
  setupEyeToggle(eyeBtn, keyInput);

  copyText_.addEventListener("click", () => copyText(fileState.text || textarea.value));

  clearText.addEventListener("click", () => {
    textarea.value = "";
    fileState.text = "";
    dropzone.classList.remove("dropzone--loaded");
    dropzone.querySelector(".dropzone__label").textContent = "Drop a .txt file, or click to browse";
    dropzone.querySelector(".dropzone__hint").textContent = ".txt only — stays in your browser";
    updateBtn();
  });

  copyKey.addEventListener("click", () => copyText(keyInput.value));

  decBtn.addEventListener("click", async () => {
    const text = fileState.text || textarea.value;
    const key = keyInput.value;

    spinner.hidden = false;
    decBtn.disabled = true;

    try {
      result = await runCipher(text, key, "decrypt");
      renderOutput(outputBox, placeholder, badge, result);
      copyOutput.disabled = false;
      clearOutput_.disabled = false;
      downloadBtn.disabled = false;
      showToast("Decrypted successfully.");
    } catch (err) {
      showToast(err.message || "Decryption failed.", true);
    } finally {
      spinner.hidden = true;
      updateBtn();
    }
  });

  copyOutput.addEventListener("click", () => copyText(result));

  clearOutput_.addEventListener("click", () => {
    result = "";
    clearOutput(outputBox, placeholder, badge, [copyOutput, clearOutput_, downloadBtn]);
  });

  downloadBtn.addEventListener("click", () => downloadTxt(result, "decrypted.txt"));
})();


/* ════════════════════════════════════════
   MODE SWITCHER (Encrypt & Save / Decrypt & Read tabs)
════════════════════════════════════════ */
const modeEncTab = document.getElementById("modeEncTab");
const modeDecTab = document.getElementById("modeDecTab");
const panelEnc = document.getElementById("panel-encrypt");
const panelDec = document.getElementById("panel-decrypt");

modeEncTab.addEventListener("click", () => {
  modeEncTab.classList.add("mode-tab--active");
  modeDecTab.classList.remove("mode-tab--active");
  modeEncTab.setAttribute("aria-selected", "true");
  modeDecTab.setAttribute("aria-selected", "false");
  panelEnc.hidden = false;
  panelDec.hidden = true;
});

modeDecTab.addEventListener("click", () => {
  modeDecTab.classList.add("mode-tab--active");
  modeEncTab.classList.remove("mode-tab--active");
  modeDecTab.setAttribute("aria-selected", "true");
  modeEncTab.setAttribute("aria-selected", "false");
  panelDec.hidden = false;
  panelEnc.hidden = true;
});


/* ════════════════════════════════════════
   PAGE NAVIGATION (nav tabs + "Try it yourself" CTA)
════════════════════════════════════════ */
function switchPage(target) {
  document.querySelectorAll(".nav-tab").forEach((t) => {
    t.setAttribute("aria-selected", t.dataset.page === target);
  });
  document.querySelectorAll(".page").forEach((p) => {
    p.hidden = p.id !== `page-${target}`;
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-page]").forEach((btn) => {
  btn.addEventListener("click", () => switchPage(btn.dataset.page));
});