/**
 * main.js — UI logic for Secure File Locker
 * Two independent panels: Encrypt and Decrypt.
 * Falls back to cipher.js if the Python API is unreachable.
 */

import { vigenere } from "./cipher.js";

/* ─── Toast ──────────────────────────────────────────────────────── */
const toast = document.getElementById("toast");
const toastMsg = document.getElementById("toastMsg");
let toastTimer;

function showToast(msg, isError = false) {
  toastMsg.textContent = msg;
  toast.className = "toast " + (isError ? "toast--error" : "toast--ok");
  toast.setAttribute("aria-hidden", "false");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toast.setAttribute("aria-hidden", "true");
    toast.className = "toast";
  }, 2800);
}

/* ─── Copy helper ────────────────────────────────────────────────── */
function copyToClipboard(text) {
  if (!text || text.trim() === "") { showToast("Nothing to copy.", true); return; }
  navigator.clipboard.writeText(text).then(function () {
    showToast("Copied to clipboard.");
  });
}

/* ─── Download helper ────────────────────────────────────────────── */
function downloadTxt(text, filename) {
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("Downloaded " + filename);
}

/* ─── Eye toggle ─────────────────────────────────────────────────── */
function setupEye(eyeBtn, input) {
  eyeBtn.addEventListener("click", function () {
    var hidden = input.type === "password";
    input.type = hidden ? "text" : "password";
    eyeBtn.querySelector(".eye-icon").textContent = hidden ? "👁" : "🙈";
    eyeBtn.setAttribute("aria-label", hidden ? "Hide key" : "Show key");
  });
}

/* ─── Cipher runner ──────────────────────────────────────────────────
   Tries the Python API first, falls back to cipher.js automatically.
──────────────────────────────────────────────────────────────────── */
async function runCipher(text, key, mode) {
  // Try the Vercel Python function
  try {
    var res = await fetch("/api/cipher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text, key: key, mode: mode }),
    });
    if (res.ok) {
      var data = await res.json();
      if (typeof data.result === "string") return data.result;
    }
  } catch (_) {
    // API unreachable — use JS fallback below
  }
  // JS fallback: same algorithm as api/cipher.py
  return vigenere(text, key, mode === "encrypt");
}

/* ─── Panel builder ──────────────────────────────────────────────────
   Called once for "enc" (encrypt) and once for "dec" (decrypt).
   Every element ID in the HTML is prefixed with the same string,
   so this single function wires up both panels identically.
──────────────────────────────────────────────────────────────────── */
function buildPanel(prefix, mode) {

  // ── Grab all DOM elements for this panel ──
  var dropzone = document.getElementById(prefix + "Dropzone");
  var fileInput = document.getElementById(prefix + "FileInput");
  var textarea = document.getElementById(prefix + "TextInput");
  var keyInput = document.getElementById(prefix + "KeyInput");
  var eyeBtn = document.getElementById(prefix + "EyeBtn");
  var actionBtn = document.getElementById(prefix + "Btn");
  var spinner = document.getElementById(prefix + "Spinner");
  var outputBox = document.getElementById(prefix + "OutputBox");
  var placeholder = document.getElementById(prefix + "OutputPlaceholder");
  var badge = document.getElementById(prefix + "Badge");
  var outCopyBtn = document.getElementById(prefix + "OutputCopy");
  var outClearBtn = document.getElementById(prefix + "OutputClear");
  var dlBtn = document.getElementById(prefix + "DownloadBtn");
  var txtCopyBtn = document.getElementById(prefix + "TextCopy");
  var txtClearBtn = document.getElementById(prefix + "TextClear");
  var keyCopyBtn = document.getElementById(prefix + "KeyCopy");

  // Abort early if any element is missing — prevents silent null errors
  var elements = {
    dropzone, fileInput, textarea, keyInput, eyeBtn, actionBtn,
    spinner, outputBox, placeholder, badge, outCopyBtn, outClearBtn, dlBtn,
    txtCopyBtn, txtClearBtn, keyCopyBtn
  };
  for (var name in elements) {
    if (!elements[name]) {
      console.error("buildPanel(" + prefix + "): missing element #" + prefix + name);
      return;
    }
  }

  // ── State ──
  var fileContent = "";   // full text of uploaded file
  var resultText = "";   // last cipher output

  // ── Enable/disable the action button ──
  function refreshBtn() {
    var hasText = fileContent.length > 0 || textarea.value.trim().length > 0;
    var hasKey = keyInput.value.replace(/[^a-zA-Z]/g, "").length > 0;
    actionBtn.disabled = !(hasText && hasKey);
  }

  // ── Load a file via FileReader ──
  function loadFile(file) {
    if (!file) return;

    // Accept any plain text file — check MIME type, fall back to extension
    var isText = file.type.startsWith("text/") ||
      file.name.toLowerCase().endsWith(".txt");
    if (!isText) {
      showToast("Please upload a plain text (.txt) file.", true);
      return;
    }

    var reader = new FileReader();

    reader.onload = function (e) {
      fileContent = e.target.result;

      // Show preview in textarea (first 4000 chars)
      textarea.value = fileContent.length > 4000
        ? fileContent.slice(0, 4000) + "\n…[file preview truncated]"
        : fileContent;

      // Update dropzone appearance
      dropzone.classList.add("dropzone--loaded");
      dropzone.querySelector(".dropzone__label").textContent = file.name;
      dropzone.querySelector(".dropzone__hint").textContent =
        (file.size / 1024).toFixed(1) + " KB loaded";

      refreshBtn();
    };

    reader.onerror = function () {
      showToast("File could not be read.", true);
    };

    reader.readAsText(file);
  }

  // ── Reset the output area back to empty state ──
  function resetOutput() {
    resultText = "";
    outputBox.classList.remove("has-output");
    outputBox.textContent = "";
    outputBox.appendChild(placeholder);
    placeholder.hidden = false;
    badge.hidden = true;
    outCopyBtn.disabled = true;
    outClearBtn.disabled = true;
    dlBtn.disabled = true;
  }

  // ── Wire up events ──

  // File chosen via click
  fileInput.addEventListener("change", function (e) {
    if (e.target.files && e.target.files[0]) {
      loadFile(e.target.files[0]);
    }
  });

  // Drag over
  dropzone.addEventListener("dragover", function (e) {
    e.preventDefault();
    dropzone.classList.add("dropzone--over");
  });
  dropzone.addEventListener("dragleave", function () {
    dropzone.classList.remove("dropzone--over");
  });

  // Drop
  dropzone.addEventListener("drop", function (e) {
    e.preventDefault();
    dropzone.classList.remove("dropzone--over");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadFile(e.dataTransfer.files[0]);
    }
  });

  // Typing in textarea: discard loaded file, use typed text instead
  textarea.addEventListener("input", function () {
    if (fileContent !== "") {
      // User is editing — stop using the file
      fileContent = "";
      dropzone.classList.remove("dropzone--loaded");
      dropzone.querySelector(".dropzone__label").textContent = "Drop a .txt file, or click to browse";
      dropzone.querySelector(".dropzone__hint").textContent = ".txt only — stays in your browser";
    }
    refreshBtn();
  });

  // Key typing
  keyInput.addEventListener("input", refreshBtn);

  // Eye toggle
  setupEye(eyeBtn, keyInput);

  // Copy input text
  txtCopyBtn.addEventListener("click", function () {
    copyToClipboard(fileContent || textarea.value);
  });

  // Clear input
  txtClearBtn.addEventListener("click", function () {
    textarea.value = "";
    fileContent = "";
    fileInput.value = "";  // reset file picker so same file can be re-selected
    dropzone.classList.remove("dropzone--loaded");
    dropzone.querySelector(".dropzone__label").textContent = "Drop a .txt file, or click to browse";
    dropzone.querySelector(".dropzone__hint").textContent = ".txt only — stays in your browser";
    refreshBtn();
  });

  // Copy key
  keyCopyBtn.addEventListener("click", function () {
    copyToClipboard(keyInput.value);
  });

  // ── Main action: Encrypt or Decrypt ──
  actionBtn.addEventListener("click", async function () {
    var text = fileContent || textarea.value;
    var key = keyInput.value;

    if (!text || text.trim() === "") {
      showToast("Please enter or upload some text first.", true);
      return;
    }
    if (key.replace(/[^a-zA-Z]/g, "") === "") {
      showToast("Key must contain at least one letter.", true);
      return;
    }

    // Show spinner, disable button while processing
    spinner.hidden = false;
    actionBtn.disabled = true;

    try {
      resultText = await runCipher(text, key, mode);

      // Display result
      placeholder.hidden = true;
      outputBox.classList.add("has-output");
      outputBox.textContent = resultText.length > 8000
        ? resultText.slice(0, 8000) + "\n\n[preview truncated — download for full output]"
        : resultText;

      badge.hidden = false;
      outCopyBtn.disabled = false;
      outClearBtn.disabled = false;
      dlBtn.disabled = false;

      showToast(mode === "encrypt" ? "Encrypted successfully." : "Decrypted successfully.");

    } catch (err) {
      showToast(err.message || "Something went wrong.", true);
    } finally {
      spinner.hidden = true;   // always hide spinner when done
      refreshBtn();            // re-enable button if inputs are still valid
    }
  });

  // Copy output
  outCopyBtn.addEventListener("click", function () {
    copyToClipboard(resultText);
  });

  // Clear output
  outClearBtn.addEventListener("click", resetOutput);

  // Download output
  dlBtn.addEventListener("click", function () {
    downloadTxt(resultText, mode === "encrypt" ? "encrypted.txt" : "decrypted.txt");
  });
}

/* ─── Boot both panels ───────────────────────────────────────────── */
buildPanel("enc", "encrypt");
buildPanel("dec", "decrypt");


/* ─── Mode switcher (Encrypt & Save / Decrypt & Read tabs) ──────── */
var modeEncTab = document.getElementById("modeEncTab");
var modeDecTab = document.getElementById("modeDecTab");
var panelEnc = document.getElementById("panel-encrypt");
var panelDec = document.getElementById("panel-decrypt");

modeEncTab.addEventListener("click", function () {
  modeEncTab.classList.add("mode-tab--active");
  modeDecTab.classList.remove("mode-tab--active");
  modeEncTab.setAttribute("aria-selected", "true");
  modeDecTab.setAttribute("aria-selected", "false");
  panelEnc.hidden = false;
  panelDec.hidden = true;
});

modeDecTab.addEventListener("click", function () {
  modeDecTab.classList.add("mode-tab--active");
  modeEncTab.classList.remove("mode-tab--active");
  modeDecTab.setAttribute("aria-selected", "true");
  modeEncTab.setAttribute("aria-selected", "false");
  panelDec.hidden = false;
  panelEnc.hidden = true;
});


/* ─── Page navigation (nav tabs + About page CTA button) ────────── */
function switchPage(target) {
  document.querySelectorAll(".nav-tab").forEach(function (t) {
    t.setAttribute("aria-selected", String(t.dataset.page === target));
  });
  document.querySelectorAll(".page").forEach(function (p) {
    p.hidden = p.id !== "page-" + target;
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-page]").forEach(function (btn) {
  btn.addEventListener("click", function () { switchPage(btn.dataset.page); });
});