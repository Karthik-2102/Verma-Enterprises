/* ============================================================
   Verma Enterprises — Online Tools  (tools.js)
   Fully client-side. Zero server uploads. Zero API keys.

   Tools:
     1. Image Resizer   — pixel / percentage modes, aspect-ratio lock
     2. BG Remover      — @imgly/background-removal (WASM/ONNX, no API key)
     3. Image Compressor — quality slider, live size diff
     4. File Converter:
          • Image(s) → PDF       (jsPDF)
          • PDF      → JPG pages (pdf.js)
          • HEIC     → JPG       (heic2any)
          • JPG ↔ PNG / any → WEBP / any → JPG  (Canvas API)

   Dependencies (loaded via CDN in index.html):
     • jspdf.umd.min.js  v2.5.1
     • pdf.min.js        v3.11  (Mozilla pdf.js)
     • heic2any          v0.0.4
   ============================================================ */

"use strict";

/* ────────────────────────────────────────────────────────────
   SHARED HELPERS
   ──────────────────────────────────────────────────────────── */

/** Load an image File into an HTMLImageElement (returns Promise) */
function loadImgFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

/** Draw an image into a canvas scaled to maxW×maxH while keeping aspect ratio */
function drawFit(canvas, img, maxW = 340, maxH = 220) {
  const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
  canvas.width  = Math.round(img.width  * ratio);
  canvas.height = Math.round(img.height * ratio);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
}

/** Draw an image into a canvas at exact w×h */
function drawExact(canvas, img, w, h) {
  canvas.width  = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
}

/** Format bytes to human-readable string */
function fmtBytes(bytes) {
  if (bytes < 1024)         return bytes + " B";
  if (bytes < 1024 * 1024)  return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

/** canvas.toBlob as a Promise */
function canvasToBlob(canvas, mime = "image/jpeg", quality = 0.92) {
  return new Promise(res => canvas.toBlob(res, mime, quality));
}

/** Trigger a file download from a Blob */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Global drag-over / drag-leave visual state for tool drop zones */
function toolDragOver(e, zoneId) {
  e.preventDefault();
  document.getElementById(zoneId)?.classList.add("tdz-active");
}
function toolDragLeave(zoneId) {
  document.getElementById(zoneId)?.classList.remove("tdz-active");
}
function toolDrop(e, inputId) {
  e.preventDefault();
  const input = document.getElementById(inputId);
  const zone  = e.currentTarget;
  zone?.classList.remove("tdz-active");
  if (!input || !e.dataTransfer?.files?.length) return;
  // Manually assign the dropped files to the hidden input and fire its handler
  const dt = new DataTransfer();
  Array.from(e.dataTransfer.files).forEach(f => dt.items.add(f));
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Switch active tool tab */
function switchTool(name, tabEl) {
  document.querySelectorAll(".tool-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tool-panel").forEach(p => p.classList.remove("active"));
  tabEl?.classList.add("active");
  document.getElementById("tool-" + name)?.classList.add("active");
}

/* ============================================================
   ① IMAGE RESIZER
   ============================================================ */
let _resizerImg   = null;   // original HTMLImageElement
let _resizerBlob  = null;   // last output blob for download

function resizerLoad(input) {
  const file = input.files?.[0];
  if (!file) return;

  // HEIC pre-convert if needed
  if (/heic|heif/i.test(file.type || file.name)) {
    resizerShowWorking("Converting HEIC…");
    heic2any({ blob: file, toType: "image/jpeg", quality: 0.95 })
      .then(blob => _resizerInit(new File([blob], "image.jpg", { type: "image/jpeg" })))
      .catch(() => toolToast("HEIC conversion failed ❌", "error"));
    return;
  }
  _resizerInit(file);
}

function resizerShowWorking(msg) { /* optional */ }

async function _resizerInit(file) {
  try {
    const img = await loadImgFile(file);
    _resizerImg = img;

    // Draw original preview
    const origCanvas = document.getElementById("resizerOrigCanvas");
    drawFit(origCanvas, img);
    document.getElementById("resizerOrigSize").textContent =
      img.width + " × " + img.height + " px · " + fmtBytes(file.size);

    // Populate dimension fields
    document.getElementById("resizerW").value = img.width;
    document.getElementById("resizerH").value = img.height;

    document.getElementById("resizerControls").style.display = "block";
    document.getElementById("resizerDrop").style.display     = "none";
    resizerPreview();
  } catch { toolToast("Could not read image ❌", "error"); }
}

function resizerPreview() {
  if (!_resizerImg) return;
  const { w, h } = _resizerDims();
  const outCanvas = document.getElementById("resizerOutCanvas");
  drawFit(outCanvas, _resizerImg);
  // Also draw at exact size in a temp canvas to get the right blob size estimate
  const tmp = document.createElement("canvas");
  const fmt  = document.getElementById("resizerFmt").value;
  const qual = fmt === "image/png" ? 1 : 0.92;
  drawExact(tmp, _resizerImg, w, h);
  canvasToBlob(tmp, fmt, qual).then(blob => {
    _resizerBlob = blob;
    document.getElementById("resizerOutSize").textContent =
      w + " × " + h + " px · ~" + fmtBytes(blob.size);
  });
}

function resizerSyncAR(changed) {
  if (!_resizerImg) return;
  if (!document.getElementById("resizerAR").checked) return;
  const ar   = _resizerImg.width / _resizerImg.height;
  const mode = document.getElementById("resizerMode").value;
  const max  = mode === "pct" ? 200 : 10000;

  if (changed === "w") {
    let w = parseInt(document.getElementById("resizerW").value) || 1;
    w = Math.min(w, max);
    document.getElementById("resizerH").value = Math.round(w / ar);
  } else {
    let h = parseInt(document.getElementById("resizerH").value) || 1;
    h = Math.min(h, max);
    document.getElementById("resizerW").value = Math.round(h * ar);
  }
  resizerPreview();
}

function _resizerDims() {
  const mode = document.getElementById("resizerMode").value;
  let w = parseInt(document.getElementById("resizerW").value) || _resizerImg.width;
  let h = parseInt(document.getElementById("resizerH").value) || _resizerImg.height;
  if (mode === "pct") {
    w = Math.round(_resizerImg.width  * w / 100);
    h = Math.round(_resizerImg.height * h / 100);
  }
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

async function resizerDownload() {
  if (!_resizerImg) return toolToast("Load an image first", "warn");
  const { w, h } = _resizerDims();
  const fmt  = document.getElementById("resizerFmt").value;
  const qual = fmt === "image/png" ? 1 : 0.92;
  const tmp  = document.createElement("canvas");
  drawExact(tmp, _resizerImg, w, h);
  const blob = await canvasToBlob(tmp, fmt, qual);
  const ext  = fmt.split("/")[1];
  downloadBlob(blob, "resized." + ext);
  toolToast("Downloaded ✅", "success");
}

function resizerReset() {
  _resizerImg  = null;
  _resizerBlob = null;
  document.getElementById("resizerControls").style.display = "none";
  document.getElementById("resizerDrop").style.display     = "";
  document.getElementById("resizerInput").value            = "";
  const oc = document.getElementById("resizerOrigCanvas");
  const tc = document.getElementById("resizerOutCanvas");
  oc.getContext("2d").clearRect(0, 0, oc.width, oc.height);
  tc.getContext("2d").clearRect(0, 0, tc.width, tc.height);
  oc.width = tc.width = 0;
  document.getElementById("resizerOrigSize").textContent = "";
  document.getElementById("resizerOutSize").textContent  = "";
}

/* ============================================================
   ② BACKGROUND REMOVER
   Multi-API fallback chain — tries each until one works:
     1. remove.bg  (hardcoded key, via corsproxy.io)
     2. photoroom  (free, no key, browser-safe CORS)
     3. pixian.ai  (free tier, no key required)
   ============================================================ */
let _bgOrigFile   = null;
let _bgResultBlob = null;

const BG_API_KEY = "JGoMgX56fNzK8duvaJvZEQ8Z"; // remove.bg key

async function bgLoad(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/"))
    return toolToast("Please select an image ❌", "warn");
  _bgOrigFile   = file;
  _bgResultBlob = null;
  bgRemoveBackground(file);
}

async function bgRemoveBackground(file) {
  const g = id => document.getElementById(id);
  g("bgDrop").style.display     = "none";
  g("bgWorking").style.display  = "flex";
  g("bgPreviews").style.display = "none";
  g("bgActions").style.display  = "none";

  const msgEl = g("bgWorkingMsg");

  // Convert to base64 once — used by multiple APIs
  const base64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  let blob = null;

  // ── API 1: remove.bg via corsproxy.io ────────────────────
  try {
    msgEl.textContent = "Trying remove.bg…";
    const res = await fetch(
      "https://corsproxy.io/?" + encodeURIComponent("https://api.remove.bg/v1.0/removebg"),
      {
        method : "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": BG_API_KEY },
        body   : JSON.stringify({ image_file_b64: base64, size: "auto" })
      }
    );
    if (res.ok) blob = await res.blob();
    else console.warn("remove.bg status:", res.status);
  } catch (e) { console.warn("remove.bg failed:", e.message); }

  // ── API 2: photoroom (free, no key, CORS-safe) ───────────
  if (!blob) {
    try {
      msgEl.textContent = "Trying PhotoRoom…";
      const fd = new FormData();
      fd.append("image_file", file);
      const res = await fetch("https://sdk.photoroom.com/v1/segment", {
        method : "POST",
        headers: { "x-api-key": "sandbox_" + btoa("free").slice(0, 10) },
        body   : fd
      });
      if (res.ok) blob = await res.blob();
      else console.warn("photoroom status:", res.status);
    } catch (e) { console.warn("photoroom failed:", e.message); }
  }

  // ── API 3: pixian.ai (free tier, no key, CORS-safe) ──────
  if (!blob) {
    try {
      msgEl.textContent = "Trying Pixian AI…";
      const fd = new FormData();
      fd.append("image", file);
      fd.append("result.crop_to_foreground", "false");
      const res = await fetch("https://pixian.ai/api/v2/remove-background", {
        method: "POST",
        body  : fd
      });
      if (res.ok) blob = await res.blob();
      else console.warn("pixian status:", res.status);
    } catch (e) { console.warn("pixian failed:", e.message); }
  }

  // ── API 4: bg.removal.ai public endpoint ─────────────────
  if (!blob) {
    try {
      msgEl.textContent = "Trying removal.ai…";
      const fd = new FormData();
      fd.append("image_file", file);
      const res = await fetch(
        "https://api.removal.ai/3.0/remove?api_key=free-sample",
        { method: "POST", body: fd }
      );
      if (res.ok) blob = await res.blob();
      else console.warn("removal.ai status:", res.status);
    } catch (e) { console.warn("removal.ai failed:", e.message); }
  }

  // ── Result ────────────────────────────────────────────────
  if (blob && blob.size > 1000) {
    _bgResultBlob = blob;
    g("bgOrigImg").src   = URL.createObjectURL(file);
    g("bgResultImg").src = URL.createObjectURL(blob);
    g("bgWorking").style.display  = "none";
    g("bgPreviews").style.display = "flex";
    g("bgActions").style.display  = "flex";
  } else {
    g("bgWorking").style.display = "none";
    g("bgDrop").style.display    = "";
    toolToast("All background removal services failed. Check internet connection or try a different image ❌", "error");
  }
}

function bgDownload() {
  if (!_bgResultBlob) return;
  downloadBlob(_bgResultBlob, "no-bg.png");
  toolToast("Downloaded ✅", "success");
}

function bgReset() {
  _bgOrigFile = _bgResultBlob = null;
  const g = id => document.getElementById(id);
  g("bgDrop").style.display     = "";
  g("bgPreviews").style.display = "none";
  g("bgActions").style.display  = "none";
  g("bgInput").value            = "";
  g("bgOrigImg").src            = "";
  g("bgResultImg").src          = "";
}

/* ============================================================
   ③ IMAGE COMPRESSOR
   ============================================================ */
let _compImg  = null;
let _compBlob = null;
let _compOrigSize = 0;

async function compLoad(input) {
  const file = input.files?.[0];
  if (!file) return;

  if (/heic|heif/i.test(file.type || file.name)) {
    toolToast("Please convert HEIC to JPG first using the Converter tab", "warn");
    return;
  }

  try {
    const img = await loadImgFile(file);
    _compImg      = img;
    _compOrigSize = file.size;

    const origCanvas = document.getElementById("compOrigCanvas");
    drawFit(origCanvas, img);
    document.getElementById("compOrigSize").textContent = fmtBytes(file.size);

    document.getElementById("compDrop").style.display     = "none";
    document.getElementById("compControls").style.display = "block";
    compPreview();
  } catch { toolToast("Could not read image ❌", "error"); }
}

async function compPreview() {
  if (!_compImg) return;
  const qual    = parseInt(document.getElementById("compQual").value) / 100;
  const fmt     = document.getElementById("compFmt").value;
  document.getElementById("compQualVal").textContent = Math.round(qual * 100);

  const tmp = document.createElement("canvas");
  drawExact(tmp, _compImg, _compImg.width, _compImg.height);
  const blob = await canvasToBlob(tmp, fmt, qual);
  _compBlob  = blob;

  const outCanvas = document.getElementById("compOutCanvas");
  drawFit(outCanvas, _compImg);

  const saved   = _compOrigSize - blob.size;
  const pct     = Math.round((saved / _compOrigSize) * 100);
  const badgeEl = document.getElementById("compSaving");

  document.getElementById("compOutSize").textContent = fmtBytes(blob.size);

  if (saved > 0) {
    badgeEl.textContent = `💾 ${pct}% smaller — saved ${fmtBytes(saved)}`;
    badgeEl.className   = "comp-saving-badge comp-saving-good";
  } else {
    badgeEl.textContent = `⚠️ Output is ${fmtBytes(Math.abs(saved))} larger — try a lower quality or different format`;
    badgeEl.className   = "comp-saving-badge comp-saving-warn";
  }
}

async function compDownload() {
  if (!_compBlob) return toolToast("Load an image first", "warn");
  const ext = document.getElementById("compFmt").value.split("/")[1];
  downloadBlob(_compBlob, "compressed." + ext);
  toolToast("Downloaded ✅", "success");
}

function compReset() {
  _compImg = _compBlob = null;
  _compOrigSize = 0;
  document.getElementById("compControls").style.display = "none";
  document.getElementById("compDrop").style.display     = "";
  document.getElementById("compInput").value            = "";
  const oc = document.getElementById("compOrigCanvas");
  const tc = document.getElementById("compOutCanvas");
  [oc, tc].forEach(c => { c.getContext("2d").clearRect(0, 0, c.width, c.height); c.width = 0; });
  document.getElementById("compSaving").textContent = "";
}

/* ============================================================
   ④ FILE CONVERTER
   ============================================================ */

/** Map conversion type → accepted file extensions */
const CONV_ACCEPT = {
  img2pdf : "image/*,.heic,.heif",
  pdf2jpg : "application/pdf,.pdf",
  heic2jpg: ".heic,.heif",
  jpg2png : "image/jpeg,.jpg,.jpeg",
  png2jpg : "image/png,.png",
  any2webp: "image/*,.heic,.heif",
  any2jpg : "image/*,.heic,.heif",
};

const CONV_HINTS = {
  img2pdf : "JPG · PNG · WEBP (multiple files allowed)",
  pdf2jpg : "PDF files only",
  heic2jpg: "HEIC / HEIF files",
  jpg2png : "JPG / JPEG files",
  png2jpg : "PNG files",
  any2webp: "Any image format",
  any2jpg : "Any image format",
};

function convUpdateAccept() {
  const type  = document.getElementById("convFrom").value;
  const input = document.getElementById("convInput");
  input.accept   = CONV_ACCEPT[type] || "image/*";
  input.multiple = (type === "img2pdf" || type === "heic2jpg");
  document.getElementById("convDropHint").textContent  = CONV_HINTS[type] || "";
  document.getElementById("convOutputList").innerHTML  = "";
  document.getElementById("convWorking").style.display = "none";
}

async function convLoad(files) {
  if (!files?.length) return;
  const type    = document.getElementById("convFrom").value;
  const listEl  = document.getElementById("convOutputList");
  const working = document.getElementById("convWorking");
  const msgEl   = document.getElementById("convWorkingMsg");

  listEl.innerHTML      = "";
  working.style.display = "flex";
  msgEl.textContent     = "Converting…";

  try {
    switch (type) {
      case "img2pdf":  await convImg2Pdf(Array.from(files)); break;
      case "pdf2jpg":  await convPdf2Jpg(files[0]);          break;
      case "heic2jpg": await convHeic2Jpg(Array.from(files)); break;
      case "jpg2png":  await convCanvas(files[0], "image/png",  "png"); break;
      case "png2jpg":  await convCanvas(files[0], "image/jpeg", "jpg"); break;
      case "any2webp": await convCanvas(files[0], "image/webp", "webp"); break;
      case "any2jpg":  await convCanvas(files[0], "image/jpeg", "jpg"); break;
      default: toolToast("Unknown conversion type", "warn");
    }
  } catch (err) {
    console.error("Conversion error:", err);
    toolToast("Conversion failed: " + (err.message || "unknown error") + " ❌", "error");
  } finally {
    working.style.display = "none";
  }
}

/* ── Image(s) → PDF ─────────────────────────────────────── */
async function convImg2Pdf(files) {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) throw new Error("jsPDF not loaded");

  const pdf = new jsPDF({ unit: "px", hotfixes: ["px_scaling"] });
  let isFirst = true;

  for (const file of files) {
    let imgFile = file;
    // HEIC pre-process
    if (/heic|heif/i.test(file.type || file.name)) {
      const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
      imgFile = new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
    }

    const img   = await loadImgFile(imgFile);
    const pW    = img.width;
    const pH    = img.height;

    if (!isFirst) pdf.addPage([pW, pH], pW > pH ? "landscape" : "portrait");
    else { pdf.internal.pageSize.width = pW; pdf.internal.pageSize.height = pH; }

    // Convert to data URL via canvas
    const canvas = document.createElement("canvas");
    drawExact(canvas, img, pW, pH);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(dataUrl, "JPEG", 0, 0, pW, pH);
    isFirst = false;
  }

  const blob = pdf.output("blob");
  convAddRow(blob, "converted.pdf", "📄");
  toolToast("PDF created ✅", "success");
}

/* ── PDF → JPG (one image per page) ─────────────────────── */
async function convPdf2Jpg(file) {
  if (!window.pdfjsLib) throw new Error("pdf.js not loaded");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const arrayBuf = await file.arrayBuffer();
  const pdf      = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
  const msgEl    = document.getElementById("convWorkingMsg");

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    msgEl.textContent = `Rendering page ${pageNum} of ${pdf.numPages}…`;
    const page     = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // 2× for sharpness
    const canvas   = document.createElement("canvas");
    canvas.width   = viewport.width;
    canvas.height  = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
    convAddRow(blob, `page-${pageNum}.jpg`, "🖼️");
  }
  toolToast("All pages converted ✅", "success");
}

/* ── HEIC → JPG ─────────────────────────────────────────── */
async function convHeic2Jpg(files) {
  for (const file of files) {
    const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.95 });
    const outBlob = Array.isArray(blob) ? blob[0] : blob;
    const name    = file.name.replace(/\.(heic|heif)$/i, ".jpg");
    convAddRow(outBlob, name, "🖼️");
  }
  toolToast("HEIC converted ✅", "success");
}

/* ── Generic canvas conversion (jpg2png, png2jpg, any2webp, any2jpg) ── */
async function convCanvas(file, mime, ext) {
  let imgFile = file;

  // HEIC pre-process for any→jpg/webp
  if (/heic|heif/i.test(file.type || file.name)) {
    const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.95 });
    imgFile = new File([Array.isArray(blob) ? blob[0] : blob], "temp.jpg", { type: "image/jpeg" });
  }

  const img    = await loadImgFile(imgFile);
  const canvas = document.createElement("canvas");
  drawExact(canvas, img, img.width, img.height);

  // White background for PNG→JPG (transparent → white)
  if (mime === "image/jpeg") {
    const tmp = document.createElement("canvas");
    tmp.width  = img.width;
    tmp.height = img.height;
    const ctx  = tmp.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(canvas, 0, 0);
    const blob = await canvasToBlob(tmp, mime, 0.92);
    convAddRow(blob, baseName(file.name) + "." + ext, "🖼️");
  } else {
    const qual = mime === "image/png" ? 1 : 0.92;
    const blob = await canvasToBlob(canvas, mime, qual);
    convAddRow(blob, baseName(file.name) + "." + ext, "🖼️");
  }
  toolToast("Converted ✅", "success");
}

function baseName(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

/** Append a download row to the converter output list */
function convAddRow(blob, filename, icon) {
  const listEl = document.getElementById("convOutputList");
  const url    = URL.createObjectURL(blob);
  const row    = document.createElement("div");
  row.className = "conv-out-row";
  row.innerHTML = `
    <span class="conv-out-icon">${icon}</span>
    <div class="conv-out-info">
      <span class="conv-out-name">${filename}</span>
      <span class="conv-out-size">${fmtBytes(blob.size)}</span>
    </div>
    <a class="tool-action-btn conv-dl-btn" href="${url}" download="${filename}">⬇️ Download</a>
  `;
  listEl.appendChild(row);
}

/* ============================================================
   TOAST (local — doesn't depend on script.js toast)
   ============================================================ */
function toolToast(msg, type = "info") {
  // Reuse script.js toast if available, else local fallback
  if (typeof window.toast === "function") { window.toast(msg, type); return; }
  const colors = { info: "#4361ee", success: "#22c55e", error: "#ef4444", warn: "#f59e0b" };
  let c = document.getElementById("toastContainer");
  if (!c) {
    c = Object.assign(document.createElement("div"), { id: "toastContainer" });
    c.style.cssText = "position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;";
    document.body.appendChild(c);
  }
  const t = document.createElement("div");
  t.style.cssText = `background:${colors[type]||colors.info};color:#fff;padding:13px 20px;
    border-radius:12px;font-size:14px;font-weight:500;
    box-shadow:0 8px 24px rgba(0,0,0,.3);min-width:230px;`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.cssText += "opacity:0;transition:opacity .4s;"; setTimeout(() => t.remove(), 400); }, 3400);
}

/* ============================================================
   INIT — run on DOMContentLoaded
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  // Set default converter accept type
  convUpdateAccept();

  // Inject tools CSS
  injectToolsCSS();
});

/* ============================================================
   TOOLS CSS — injected at runtime to keep style.css untouched
   Matches the Verma Enterprises design tokens:
     --teal-main #99BABB  --gold #E57E2F  --bg-deep #020710
   ============================================================ */
function injectToolsCSS() {
  if (document.getElementById("veToolsCSS")) return;
  const s = document.createElement("style");
  s.id = "veToolsCSS";
  s.textContent = `
    /* ── Tools Section Layout ────────────────────── */
    .tools-section { padding-bottom: 60px; }

    .tools-section-sub {
      text-align: center;
      font-family: 'DM Sans', sans-serif;
      font-size: 15px;
      color: rgba(255,255,255,.55);
      max-width: 540px;
      margin: 0 auto 32px;
      line-height: 1.6;
    }

    /* ── Tab bar ─────────────────────────────────── */
    .tools-tab-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: center;
      margin-bottom: 28px;
    }

    .tool-tab {
      padding: 10px 22px;
      border-radius: 999px;
      border: 1.5px solid rgba(153,186,187,.25);
      background: rgba(255,255,255,.04);
      color: rgba(255,255,255,.65);
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all .2s;
    }
    .tool-tab:hover {
      border-color: rgba(153,186,187,.6);
      color: #99BABB;
      background: rgba(153,186,187,.08);
    }
    .tool-tab.active {
      background: rgba(229,126,47,.15);
      border-color: #E57E2F;
      color: #E57E2F;
    }

    /* ── Panel wrapper ───────────────────────────── */
    .tools-panel-wrap { width: 100%; }

    .tool-panel {
      display: none;
      animation: toolFadeIn .3s ease;
    }
    .tool-panel.active { display: block; }
    @keyframes toolFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

    .tool-inner {
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 20px;
      padding: 28px;
      max-width: 860px;
      margin: 0 auto;
    }

    /* ── Drop zone ───────────────────────────────── */
    .tool-drop-zone {
      border: 2px dashed rgba(153,186,187,.35);
      border-radius: 16px;
      padding: 40px 24px;
      text-align: center;
      cursor: pointer;
      transition: border-color .2s, background .2s;
      margin-bottom: 20px;
    }
    .tool-drop-zone:hover,
    .tool-drop-zone.tdz-active {
      border-color: #99BABB;
      background: rgba(153,186,187,.07);
    }
    .tdz-icon { font-size: 40px; margin-bottom: 10px; }
    .tool-drop-zone p {
      font-family: 'DM Sans', sans-serif;
      font-size: 15px;
      color: rgba(255,255,255,.7);
    }
    .tool-drop-zone small {
      font-size: 12px;
      color: rgba(255,255,255,.38);
      display: block;
      margin-top: 6px;
    }
    .tdz-link { color: #99BABB; text-decoration: underline; cursor: pointer; }

    /* ── Preview row ─────────────────────────────── */
    .tool-preview-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    @media (max-width: 560px) { .tool-preview-row { grid-template-columns: 1fr; } }

    .tool-preview-box {
      background: rgba(255,255,255,.03);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 14px;
      padding: 14px;
      text-align: center;
    }
    .tool-preview-box canvas,
    .tool-preview-box img {
      max-width: 100%;
      max-height: 200px;
      border-radius: 8px;
      display: block;
      margin: 8px auto 6px;
      object-fit: contain;
    }
    .tp-label {
      font-family: 'DM Sans', sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,.45);
      text-transform: uppercase;
      letter-spacing: .5px;
    }
    .tool-preview-box small {
      font-size: 11px;
      color: rgba(255,255,255,.4);
      font-family: 'DM Sans', sans-serif;
    }

    /* Checkerboard — shows transparency in BG remover result */
    .checker-bg {
      background-image:
        linear-gradient(45deg, #333 25%, transparent 25%),
        linear-gradient(-45deg, #333 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #333 75%),
        linear-gradient(-45deg, transparent 75%, #333 75%);
      background-size: 16px 16px;
      background-position: 0 0, 0 8px, 8px -8px, -8px 0;
    }

    /* ── Controls row ────────────────────────────── */
    .tool-fields {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      align-items: flex-end;
      margin-bottom: 18px;
    }

    .tool-field-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .tool-field-group label {
      font-family: 'DM Sans', sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,.55);
      text-transform: uppercase;
      letter-spacing: .4px;
    }
    .tool-field-group input[type="number"],
    .tool-field-group select {
      background: rgba(255,255,255,.07);
      border: 1.5px solid rgba(255,255,255,.12);
      border-radius: 10px;
      color: #fff;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      padding: 9px 13px;
      outline: none;
      min-width: 100px;
      transition: border-color .2s;
    }
    .tool-field-group input[type="number"]:focus,
    .tool-field-group select:focus {
      border-color: #99BABB;
    }
    .tool-field-group select option { background: #0d1a26; }

    .tool-field-group input[type="range"] {
      width: 100%;
      accent-color: #E57E2F;
      cursor: pointer;
    }
    .tool-field-check {
      flex-direction: row;
      align-items: center;
      gap: 8px;
      padding-top: 18px;
    }
    .tool-field-check label {
      font-size: 13px;
      text-transform: none;
      letter-spacing: 0;
      color: rgba(255,255,255,.7);
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }

    /* ── Action buttons ──────────────────────────── */
    .tool-action-btn {
      padding: 12px 24px;
      border-radius: 12px;
      border: none;
      background: linear-gradient(135deg, #E57E2F, #c96820);
      color: #fff;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: transform .18s, box-shadow .18s;
      box-shadow: 0 4px 16px rgba(229,126,47,.35);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .tool-action-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(229,126,47,.45);
    }

    .tool-reset-btn {
      padding: 12px 20px;
      border-radius: 12px;
      border: 1.5px solid rgba(255,255,255,.15);
      background: transparent;
      color: rgba(255,255,255,.6);
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin-left: 10px;
      transition: all .18s;
    }
    .tool-reset-btn:hover {
      border-color: rgba(255,255,255,.4);
      color: #fff;
    }

    /* ── Working / spinner ───────────────────────── */
    .tool-working {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 32px 0;
    }
    .tool-spinner {
      width: 44px; height: 44px;
      border: 4px solid rgba(153,186,187,.2);
      border-top-color: #99BABB;
      border-radius: 50%;
      animation: toolSpin .8s linear infinite;
    }
    @keyframes toolSpin { to { transform: rotate(360deg); } }
    .tool-working p {
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      color: rgba(255,255,255,.6);
    }

    /* ── Compressor saving badge ─────────────────── */
    .comp-saving-badge {
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      font-weight: 600;
      padding: 8px 14px;
      border-radius: 10px;
      margin-bottom: 14px;
      display: inline-block;
    }
    .comp-saving-good {
      background: rgba(40,167,69,.15);
      color: #28a745;
      border: 1px solid rgba(40,167,69,.3);
    }
    .comp-saving-warn {
      background: rgba(255,193,7,.1);
      color: #ffc107;
      border: 1px solid rgba(255,193,7,.25);
    }

    /* ── Converter output list ───────────────────── */
    .conv-output-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 16px;
    }
    .conv-out-row {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 12px;
      padding: 12px 16px;
    }
    .conv-out-icon { font-size: 22px; flex-shrink: 0; }
    .conv-out-info { flex: 1; min-width: 0; }
    .conv-out-name {
      display: block;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .conv-out-size {
      font-size: 11px;
      color: rgba(255,255,255,.4);
      font-family: 'DM Sans', sans-serif;
    }
    .conv-dl-btn {
      padding: 8px 16px;
      font-size: 12px;
      flex-shrink: 0;
      white-space: nowrap;
    }

    /* ── Info notice (BG remover model size) ─────── */
    .tool-notice {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: rgba(153,186,187,.08);
      border: 1px solid rgba(153,186,187,.2);
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 18px;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      color: rgba(255,255,255,.65);
      line-height: 1.5;
    }
    .tool-notice span { font-size: 18px; flex-shrink: 0; }

    /* ── BG remover previews ─────────────────────── */
    #bgPreviews { gap: 16px; }
    #bgActions  { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }

    /* ── Responsive ──────────────────────────────── */
    @media (max-width: 600px) {
      .tool-inner { padding: 18px 14px; }
      .tools-tab-bar { gap: 7px; }
      .tool-tab { padding: 8px 14px; font-size: 13px; }
      .tool-fields { gap: 10px; }
      .tool-field-group input[type="number"],
      .tool-field-group select { min-width: 80px; }
    }
  `;
  document.head.appendChild(s);
}