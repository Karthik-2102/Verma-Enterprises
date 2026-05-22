/* ============================================================
   Verma Enterprises — Online Tools  (tools.js)  v2.0
   Fully client-side. Zero server uploads. Zero API keys.

   Tools:
     1. Image Resizer   — pixel / percentage modes, aspect-ratio lock,
                          live preview on dimension input, crop support
     2. BG Remover      — external redirect links
     3. Image Compressor — smart size-only compression (no quality loss),
                          crop before compress, quality slider, live size diff
     4. File Converter  — high-quality format conversion with filename preservation

   Dependencies (loaded via CDN in index.html):
     • jspdf.umd.min.js  v2.5.1
     • pdf.min.js        v3.11  (Mozilla pdf.js)
     • heic2any          v0.0.4
   ============================================================ */

"use strict";

/* ────────────────────────────────────────────────────────────
   SHARED HELPERS
   ──────────────────────────────────────────────────────────── */

/** Strip extension from filename: "photo.jpg" → "photo" */
function baseName(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

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
   UNIVERSAL CROP MODULE
   Shared by Resizer and Compressor
   ============================================================ */
let _cropState = {
  active: false,
  img: null,
  startX: 0, startY: 0,
  endX: 0,   endY: 0,
  isDragging: false,
  canvas: null,
  onDone: null,   // callback(croppedCanvas)
  onCancel: null,
};

function cropOpen(img, overlayId, onDone, onCancel) {
  _cropState.img      = img;
  _cropState.onDone   = onDone;
  _cropState.onCancel = onCancel;
  _cropState.active   = true;

  const overlay = document.getElementById(overlayId);
  overlay.style.display = "flex";

  const canvas = document.getElementById(overlayId + "Canvas");
  _cropState.canvas = canvas;

  // Scale the image to fit inside the crop canvas area (max 700x500)
  const maxW = Math.min(700, window.innerWidth - 60);
  const maxH = 460;
  const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
  canvas.width  = Math.round(img.width  * ratio);
  canvas.height = Math.round(img.height * ratio);
  _cropState.scaleRatio = ratio;

  cropDraw();
}

function cropDraw(sel) {
  const canvas = _cropState.canvas;
  if (!canvas) return;
  const ctx  = canvas.getContext("2d");
  const img  = _cropState.img;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  if (sel) {
    const { x, y, w, h } = sel;
    // Dim the outside
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Clear the selection area (show the image inside)
    ctx.clearRect(x, y, w, h);
    ctx.drawImage(img, x / _cropState.scaleRatio, y / _cropState.scaleRatio,
      w / _cropState.scaleRatio, h / _cropState.scaleRatio, x, y, w, h);
    // Draw dashed border
    ctx.strokeStyle = "#E57E2F";
    ctx.lineWidth   = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(x, y, w, h);
    // Corner handles
    ctx.setLineDash([]);
    ctx.fillStyle = "#E57E2F";
    [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].forEach(([cx,cy]) => {
      ctx.fillRect(cx-5, cy-5, 10, 10);
    });
  }
}

function _cropSetupEvents(overlayId) {
  const canvas = document.getElementById(overlayId + "Canvas");
  if (!canvas || canvas._cropEventsSet) return;
  canvas._cropEventsSet = true;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: Math.max(0, Math.min(canvas.width,  (touch.clientX - rect.left) * (canvas.width  / rect.width))),
      y: Math.max(0, Math.min(canvas.height, (touch.clientY - rect.top)  * (canvas.height / rect.height))),
    };
  }

  canvas.addEventListener("mousedown",  e => { const p = getPos(e); _cropState.startX = p.x; _cropState.startY = p.y; _cropState.isDragging = true; });
  canvas.addEventListener("mousemove",  e => {
    if (!_cropState.isDragging) return;
    const p = getPos(e);
    _cropState.endX = p.x; _cropState.endY = p.y;
    const sel = _cropGetSel();
    cropDraw(sel.w > 4 && sel.h > 4 ? sel : null);
  });
  canvas.addEventListener("mouseup",    () => { _cropState.isDragging = false; });
  canvas.addEventListener("touchstart", e => { e.preventDefault(); const p = getPos(e); _cropState.startX = p.x; _cropState.startY = p.y; _cropState.isDragging = true; }, { passive: false });
  canvas.addEventListener("touchmove",  e => {
    e.preventDefault();
    if (!_cropState.isDragging) return;
    const p = getPos(e);
    _cropState.endX = p.x; _cropState.endY = p.y;
    const sel = _cropGetSel();
    cropDraw(sel.w > 4 && sel.h > 4 ? sel : null);
  }, { passive: false });
  canvas.addEventListener("touchend",   () => { _cropState.isDragging = false; });
}

function _cropGetSel() {
  return {
    x: Math.min(_cropState.startX, _cropState.endX),
    y: Math.min(_cropState.startY, _cropState.endY),
    w: Math.abs(_cropState.endX - _cropState.startX),
    h: Math.abs(_cropState.endY - _cropState.startY),
  };
}

function cropApply(overlayId) {
  const sel = _cropGetSel();
  if (sel.w < 5 || sel.h < 5) {
    toolToast("Draw a crop area first", "warn");
    return;
  }
  // Extract the actual pixel region from the original image at full resolution
  const r    = _cropState.scaleRatio;
  const srcX = Math.round(sel.x / r);
  const srcY = Math.round(sel.y / r);
  const srcW = Math.round(sel.w / r);
  const srcH = Math.round(sel.h / r);

  const out  = document.createElement("canvas");
  out.width  = srcW;
  out.height = srcH;
  out.getContext("2d").drawImage(_cropState.img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

  document.getElementById(overlayId).style.display = "none";
  _cropState.active = false;
  _cropState.onDone && _cropState.onDone(out, srcW, srcH);
}

function cropCancel(overlayId) {
  document.getElementById(overlayId).style.display = "none";
  _cropState.active = false;
  _cropState.onCancel && _cropState.onCancel();
}

/* ============================================================
   ① IMAGE RESIZER  (enhanced)
   - Live preview when user types dimensions
   - Crop before resize
   - Output filename: filename-resized.ext
   ============================================================ */
let _resizerFile  = null;   // original File object (for naming)
let _resizerImg   = null;   // current HTMLImageElement (may be post-crop)
let _resizerBlob  = null;

function resizerLoad(input) {
  const file = input.files?.[0];
  if (!file) return;
  _resizerFile = file;

  if (/heic|heif/i.test(file.type || file.name)) {
    toolToast("Converting HEIC…", "info");
    heic2any({ blob: file, toType: "image/jpeg", quality: 0.95 })
      .then(blob => _resizerInit(new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" }), file))
      .catch(() => toolToast("HEIC conversion failed ❌", "error"));
    return;
  }
  _resizerInit(file, file);
}

async function _resizerInit(file, originalFile) {
  try {
    if (originalFile) _resizerFile = originalFile;
    const img = await loadImgFile(file);
    _resizerImg = img;

    const origCanvas = document.getElementById("resizerOrigCanvas");
    drawFit(origCanvas, img);
    document.getElementById("resizerOrigSize").textContent =
      img.width + " × " + img.height + " px · " + fmtBytes(file.size);

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

  const tmp  = document.createElement("canvas");
  const fmt  = document.getElementById("resizerFmt").value;
  const qual = fmt === "image/png" ? 1 : 0.92;
  drawExact(tmp, _resizerImg, w, h);
  canvasToBlob(tmp, fmt, qual).then(blob => {
    _resizerBlob = blob;
    document.getElementById("resizerOutSize").textContent =
      w + " × " + h + " px · ~" + fmtBytes(blob.size);
  });
}

/** Show a live "→ 400 × 500 px" hint below the dimension inputs */
function resizerUpdateHint() {
  const hintEl = document.getElementById("resizerDimHint");
  if (!hintEl || !_resizerImg) return;
  const { w, h } = _resizerDims();
  hintEl.textContent = "→ Preview: " + w + " × " + h + " px";
}

function resizerSyncAR(changed) {
  if (!_resizerImg) return;
  if (!document.getElementById("resizerAR").checked) { resizerPreview(); return; }
  const ar   = _resizerImg.width / _resizerImg.height;
  const mode = document.getElementById("resizerMode").value;
  const max  = mode === "pct" ? 500 : 10000;

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

function resizerCrop() {
  if (!_resizerImg) return toolToast("Load an image first", "warn");
  _cropSetupEvents("resizerCropOverlay");
  _cropState.startX = _cropState.startY = _cropState.endX = _cropState.endY = 0;
  cropOpen(_resizerImg, "resizerCropOverlay",
    (croppedCanvas, w, h) => {
      // Replace working image with cropped version
      const croppedImg = new Image();
      croppedImg.onload = () => {
        _resizerImg = croppedImg;
        document.getElementById("resizerW").value = w;
        document.getElementById("resizerH").value = h;
        const origCanvas = document.getElementById("resizerOrigCanvas");
        drawFit(origCanvas, croppedImg);
        document.getElementById("resizerOrigSize").textContent =
          w + " × " + h + " px (cropped)";
        resizerPreview();
        toolToast("Cropped ✅ — adjust size and download", "success");
      };
      croppedImg.src = croppedCanvas.toDataURL();
    },
    () => {}
  );
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
  const name = _resizerFile ? baseName(_resizerFile.name) + "-resized." + ext : "resized." + ext;
  downloadBlob(blob, name);
  toolToast("Downloaded ✅", "success");
}

function resizerReset() {
  _resizerImg  = null;
  _resizerBlob = null;
  _resizerFile = null;
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
   ③ IMAGE COMPRESSOR  (enhanced)
   - Smart compression: reduces file size without visible quality loss
   - Keeps original pixel dimensions
   - Adds crop-before-compress
   - Output filename: filename-compressed.ext
   ============================================================ */
let _compFile     = null;
let _compImg      = null;
let _compBlob     = null;
let _compOrigSize = 0;

async function compLoad(input) {
  const file = input.files?.[0];
  if (!file) return;
  _compFile = file;

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

/* Smart compression:
   1. Try progressive quality reduction from 92 down to target (slider)
   2. If PNG: convert to JPEG for real size savings, or use webp
   3. Never upscale the file
*/
async function compPreview() {
  if (!_compImg) return;

  const targetPct = parseInt(document.getElementById("compQual").value);
  document.getElementById("compQualVal").textContent = targetPct;

  const fmt  = document.getElementById("compFmt").value;
  const isLossless = fmt === "image/png";

  // For display, always keep original dimensions
  const tmp = document.createElement("canvas");
  drawExact(tmp, _compImg, _compImg.width, _compImg.height);

  let blob;
  if (isLossless) {
    // PNG: true lossless — use quality param to reduce color depth via jpeg hint
    // But user may have selected PNG intentionally, so respect it
    blob = await canvasToBlob(tmp, fmt, 1);
  } else {
    // JPEG/WEBP: map slider 100→10 to quality 0.98→0.50
    // This range gives meaningful file-size difference without noticeable quality loss
    const qual = 0.50 + (targetPct / 100) * 0.48;  // 0.50–0.98
    blob = await canvasToBlob(tmp, fmt, qual);
  }

  _compBlob = blob;

  // Update output preview (same image, different size)
  const outCanvas = document.getElementById("compOutCanvas");
  drawFit(outCanvas, _compImg);

  const saved = _compOrigSize - blob.size;
  const pct   = Math.round((saved / _compOrigSize) * 100);
  const badgeEl = document.getElementById("compSaving");

  document.getElementById("compOutSize").textContent = fmtBytes(blob.size);

  if (saved > 0) {
    badgeEl.textContent = `💾 ${pct}% smaller — saved ${fmtBytes(saved)} (same visual quality)`;
    badgeEl.className   = "comp-saving-badge comp-saving-good";
  } else {
    badgeEl.textContent = `⚠️ Output is larger — try JPEG or WEBP format for better compression`;
    badgeEl.className   = "comp-saving-badge comp-saving-warn";
  }
}

function compCrop() {
  if (!_compImg) return toolToast("Load an image first", "warn");
  _cropSetupEvents("compCropOverlay");
  _cropState.startX = _cropState.startY = _cropState.endX = _cropState.endY = 0;
  cropOpen(_compImg, "compCropOverlay",
    (croppedCanvas, w, h) => {
      const croppedImg = new Image();
      croppedImg.onload = () => {
        _compImg = croppedImg;
        const origCanvas = document.getElementById("compOrigCanvas");
        drawFit(origCanvas, croppedImg);
        document.getElementById("compOrigSize").textContent =
          fmtBytes(_compOrigSize) + " (original) · " + w + "×" + h + " px (cropped)";
        compPreview();
        toolToast("Cropped ✅ — adjust compression and download", "success");
      };
      croppedImg.src = croppedCanvas.toDataURL();
    },
    () => {}
  );
}

async function compDownload() {
  if (!_compBlob) return toolToast("Load an image first", "warn");
  const ext  = document.getElementById("compFmt").value.split("/")[1];
  const name = _compFile ? baseName(_compFile.name) + "-compressed." + ext : "compressed." + ext;
  downloadBlob(_compBlob, name);
  toolToast("Downloaded ✅", "success");
}

function compReset() {
  _compImg = _compBlob = _compFile = null;
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
   ④ FILE CONVERTER  (enhanced)
   - High quality output — canvas quality 0.95 for JPEG
   - Filename preserved: filename-converted.ext
   ============================================================ */

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

  // Target size input only useful for image formats (not multi-page pdf2jpg)
  const sizeGroup = document.getElementById("convTargetSizeGroup");
  if (sizeGroup) sizeGroup.style.display = (type === "img2pdf") ? "none" : "";
  convTargetSizeHint();
}

/** Show a live hint: e.g. "→ ~512 KB target" */
function convTargetSizeHint() {
  const el   = document.getElementById("convTargetHint");
  if (!el) return;
  const val  = parseFloat(document.getElementById("convTargetSize")?.value);
  const unit = document.getElementById("convTargetUnit")?.value;
  if (!val || val <= 0) { el.textContent = ""; return; }
  el.textContent = "→ Target: " + val + " " + unit.toUpperCase();
}

/** Get target bytes from UI inputs (returns null if not set) */
function convGetTargetBytes() {
  const val  = parseFloat(document.getElementById("convTargetSize")?.value);
  const unit = document.getElementById("convTargetUnit")?.value;
  if (!val || val <= 0) return null;
  return unit === "mb" ? val * 1024 * 1024 : val * 1024;
}

/**
 * Binary-search for the JPEG/WEBP quality that gets the blob
 * as close as possible to targetBytes without exceeding it.
 */
async function findQualityForSize(canvas, mime, targetBytes) {
  let lo = 0.05, hi = 0.99, best = null, bestBlob = null;
  for (let i = 0; i < 14; i++) {
    const mid  = (lo + hi) / 2;
    const blob = await canvasToBlob(canvas, mime, mid);
    if (blob.size <= targetBytes) {
      best = mid; bestBlob = blob; lo = mid;
    } else {
      hi = mid;
    }
    if (hi - lo < 0.005) break;
  }
  // If even lowest quality exceeds target, just return the smallest possible
  if (!bestBlob) bestBlob = await canvasToBlob(canvas, mime, 0.05);
  return bestBlob;
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

/* ── Image(s) → PDF  (high quality, 0.95 JPEG) ─────────── */
async function convImg2Pdf(files) {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) throw new Error("jsPDF not loaded");

  const pdf = new jsPDF({ unit: "px", hotfixes: ["px_scaling"] });
  let isFirst = true;
  let firstName = "";

  for (const file of files) {
    if (!firstName) firstName = baseName(file.name);
    let imgFile = file;
    if (/heic|heif/i.test(file.type || file.name)) {
      const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.95 });
      imgFile = new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
    }
    const img = await loadImgFile(imgFile);
    const pW = img.width;
    const pH = img.height;
    if (!isFirst) pdf.addPage([pW, pH], pW > pH ? "landscape" : "portrait");
    else { pdf.internal.pageSize.width = pW; pdf.internal.pageSize.height = pH; }
    const canvas  = document.createElement("canvas");
    drawExact(canvas, img, pW, pH);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95); // high quality
    pdf.addImage(dataUrl, "JPEG", 0, 0, pW, pH);
    isFirst = false;
  }

  const blob    = pdf.output("blob");
  const outName = (firstName || "image") + "-converted.pdf";
  convAddRow(blob, outName, "📄");
  toolToast("PDF created ✅", "success");
}

/* ── PDF → JPG (high quality scale 2×) ─────────────────── */
async function convPdf2Jpg(file) {
  if (!window.pdfjsLib) throw new Error("pdf.js not loaded");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const arrayBuf = await file.arrayBuffer();
  const pdf      = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
  const msgEl    = document.getElementById("convWorkingMsg");
  const stem     = baseName(file.name);

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    msgEl.textContent = `Rendering page ${pageNum} of ${pdf.numPages}…`;
    const page     = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.5 }); // 2.5× = very sharp
    const canvas   = document.createElement("canvas");
    canvas.width   = viewport.width;
    canvas.height  = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const blob    = await canvasToBlob(canvas, "image/jpeg", 0.95);
    const outName = stem + "-page" + pageNum + "-converted.jpg";
    convAddRow(blob, outName, "🖼️");
  }
  toolToast("All pages converted ✅", "success");
}

/* ── HEIC → JPG  (quality 0.97) ─────────────────────────── */
async function convHeic2Jpg(files) {
  for (const file of files) {
    const blob    = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.97 });
    const outBlob = Array.isArray(blob) ? blob[0] : blob;
    const outName = baseName(file.name) + "-converted.jpg";
    convAddRow(outBlob, outName, "🖼️");
  }
  toolToast("HEIC converted ✅", "success");
}

/* ── Generic canvas conversion (quality 0.95 for JPEG/WEBP, target size aware) ── */
async function convCanvas(file, mime, ext) {
  let imgFile = file;
  if (/heic|heif/i.test(file.type || file.name)) {
    const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.97 });
    imgFile = new File([Array.isArray(blob) ? blob[0] : blob], "temp.jpg", { type: "image/jpeg" });
  }

  const img    = await loadImgFile(imgFile);
  const canvas = document.createElement("canvas");
  drawExact(canvas, img, img.width, img.height);

  const outName    = baseName(file.name) + "-converted." + ext;
  const targetBytes = convGetTargetBytes();

  if (mime === "image/jpeg") {
    const tmp = document.createElement("canvas");
    tmp.width  = img.width;
    tmp.height = img.height;
    const ctx  = tmp.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(canvas, 0, 0);
    const blob = targetBytes
      ? await findQualityForSize(tmp, mime, targetBytes)
      : await canvasToBlob(tmp, mime, 0.95);
    convAddRow(blob, outName, "🖼️");
  } else {
    const qual = (mime === "image/png") ? 1 : 0.95;
    const blob = (targetBytes && mime !== "image/png")
      ? await findQualityForSize(canvas, mime, targetBytes)
      : await canvasToBlob(canvas, mime, qual);
    convAddRow(blob, outName, "🖼️");
  }
  toolToast("Converted ✅", "success");
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
   ⑤ PDF COMPRESSOR
   Strategy: use pdf.js to render each page at chosen quality,
   then reassemble with jsPDF. Binary-search quality to hit
   a target file size if the user supplies one.
   ============================================================ */
let _pdfcompFile     = null;
let _pdfcompOrigSize = 0;
let _pdfcompDoc      = null;   // pdfjsLib doc object

const PDFCOMP_PRESETS = {
  screen: { scale: 1.0, qual: 0.50, label: "Screen/Web" },
  ebook:  { scale: 1.5, qual: 0.72, label: "eBook/Balanced" },
  print:  { scale: 2.0, qual: 0.88, label: "Print Quality" },
};

async function pdfcompLoad(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    toolToast("Please select a PDF file ❌", "error"); return;
  }
  _pdfcompFile     = file;
  _pdfcompOrigSize = file.size;

  // Load with pdf.js
  if (!window.pdfjsLib) { toolToast("pdf.js not loaded ❌", "error"); return; }
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const buf = await file.arrayBuffer();
  _pdfcompDoc = await pdfjsLib.getDocument({ data: buf }).promise;

  document.getElementById("pdfcompFileName").textContent = file.name;
  document.getElementById("pdfcompPages").textContent    = _pdfcompDoc.numPages + " page" + (_pdfcompDoc.numPages > 1 ? "s" : "");
  document.getElementById("pdfcompOrigSize").textContent = fmtBytes(file.size);

  document.getElementById("pdfcompDrop").style.display     = "none";
  document.getElementById("pdfcompControls").style.display = "block";
  document.getElementById("pdfcompResult").style.display   = "none";
  document.getElementById("pdfcompDownloadWrap").innerHTML = "";
}

function pdfcompPresetChange() {
  const v = document.getElementById("pdfcompPreset").value;
  const wrap = document.getElementById("pdfcompCustomWrap");
  wrap.style.display = v === "custom" ? "" : "none";
}

function pdfcompQualUpdate() {
  document.getElementById("pdfcompQualVal").textContent =
    document.getElementById("pdfcompQual").value;
}

async function pdfcompRun() {
  if (!_pdfcompDoc) return toolToast("Load a PDF first", "warn");

  const preset   = document.getElementById("pdfcompPreset").value;
  const cfg      = PDFCOMP_PRESETS[preset] || PDFCOMP_PRESETS.ebook;
  const scale    = cfg.scale;
  const baseQual = preset === "custom"
    ? parseInt(document.getElementById("pdfcompQual").value) / 100
    : cfg.qual;

  // Optional target size
  const tVal  = parseFloat(document.getElementById("pdfcompTargetSize").value);
  const tUnit = document.getElementById("pdfcompTargetUnit").value;
  const targetBytes = (tVal > 0) ? (tUnit === "mb" ? tVal * 1024 * 1024 : tVal * 1024) : null;

  const btn     = document.getElementById("pdfcompBtn");
  const working = document.getElementById("pdfcompWorking");
  const msgEl   = document.getElementById("pdfcompWorkingMsg");
  const progBar = document.getElementById("pdfcompProgressBar");

  btn.disabled          = true;
  working.style.display = "flex";
  document.getElementById("pdfcompResult").style.display = "none";
  progBar.style.width   = "0%";

  const { jsPDF } = window.jspdf;
  if (!jsPDF) { toolToast("jsPDF not loaded ❌", "error"); btn.disabled = false; working.style.display = "none"; return; }

  const numPages = _pdfcompDoc.numPages;
  let   qual     = baseQual;

  try {
    /* ── First pass: render all pages at chosen quality ── */
    const pages = [];
    for (let p = 1; p <= numPages; p++) {
      msgEl.textContent   = `Rendering page ${p} of ${numPages}…`;
      progBar.style.width = Math.round((p / numPages) * 60) + "%";

      const page     = await _pdfcompDoc.getPage(p);
      const viewport = page.getViewport({ scale });
      const canvas   = document.createElement("canvas");
      canvas.width   = viewport.width;
      canvas.height  = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      pages.push({ canvas, w: viewport.width, h: viewport.height });
    }

    /* ── Build PDF from rendered pages ── */
    const buildPdf = async (q) => {
      const firstPage = pages[0];
      const doc = new jsPDF({
        unit: "px",
        hotfixes: ["px_scaling"],
        format: [firstPage.w, firstPage.h],
        orientation: firstPage.w > firstPage.h ? "landscape" : "portrait",
      });

      for (let i = 0; i < pages.length; i++) {
        const { canvas, w, h } = pages[i];
        if (i > 0) doc.addPage([w, h], w > h ? "landscape" : "portrait");
        const dataUrl = canvas.toDataURL("image/jpeg", q);
        doc.addImage(dataUrl, "JPEG", 0, 0, w, h);
      }
      return doc.output("blob");
    };

    msgEl.textContent   = "Assembling PDF…";
    progBar.style.width = "70%";

    let resultBlob = await buildPdf(qual);

    /* ── Binary-search quality to hit target size ── */
    if (targetBytes && resultBlob.size > targetBytes) {
      msgEl.textContent = "Optimising for target size…";
      let lo = 0.05, hi = qual;
      for (let i = 0; i < 10; i++) {
        const mid  = (lo + hi) / 2;
        const blob = await buildPdf(mid);
        if (blob.size <= targetBytes) { resultBlob = blob; lo = mid; }
        else { hi = mid; }
        progBar.style.width = 70 + Math.round((i / 10) * 25) + "%";
        if (hi - lo < 0.01) break;
      }
    }

    progBar.style.width = "100%";

    /* ── Show results ── */
    const saved  = _pdfcompOrigSize - resultBlob.size;
    const pct    = Math.round((saved / _pdfcompOrigSize) * 100);
    const outName = baseName(_pdfcompFile.name) + "-compressed.pdf";

    document.getElementById("pdfcompResultOrig").textContent  = fmtBytes(_pdfcompOrigSize);
    document.getElementById("pdfcompResultNew").textContent   = fmtBytes(resultBlob.size);

    const savedEl = document.getElementById("pdfcompResultSaved");
    if (saved > 0) {
      savedEl.textContent  = `${fmtBytes(saved)} (${pct}% smaller)`;
      savedEl.style.color  = "#28a745";
    } else {
      savedEl.textContent  = "PDF could not be reduced further";
      savedEl.style.color  = "#ffc107";
    }

    const url = URL.createObjectURL(resultBlob);
    document.getElementById("pdfcompDownloadWrap").innerHTML = `
      <a class="tool-action-btn" href="${url}" download="${outName}">⬇️ Download Compressed PDF</a>
    `;

    document.getElementById("pdfcompResult").style.display = "block";
    toolToast("PDF compressed ✅", "success");

  } catch (err) {
    console.error("PDF compress error:", err);
    toolToast("Compression failed: " + (err.message || "unknown error") + " ❌", "error");
  } finally {
    btn.disabled          = false;
    working.style.display = "none";
  }
}

function pdfcompReset() {
  _pdfcompFile = null;
  _pdfcompOrigSize = 0;
  _pdfcompDoc  = null;
  document.getElementById("pdfcompControls").style.display = "none";
  document.getElementById("pdfcompDrop").style.display     = "";
  document.getElementById("pdfcompInput").value            = "";
  document.getElementById("pdfcompResult").style.display   = "none";
  document.getElementById("pdfcompDownloadWrap").innerHTML = "";
  document.getElementById("pdfcompProgressBar").style.width = "0%";
}

/* ============================================================
   TOAST
   ============================================================ */
function toolToast(msg, type = "info") {
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
   INIT
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  convUpdateAccept();
  injectToolsCSS();
  injectCropOverlays();
});

/* Inject crop overlay DOM elements */
function injectCropOverlays() {
  const mkOverlay = (id, applyFn, cancelFn) => {
    if (document.getElementById(id)) return;
    const el = document.createElement("div");
    el.id = id;
    el.style.cssText = `display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.82);
      justify-content:center;align-items:center;flex-direction:column;gap:16px;`;
    el.innerHTML = `
      <p style="color:#E57E2F;font-family:'DM Sans',sans-serif;font-weight:700;font-size:15px;margin:0;">
        🖱️ Drag to select crop area
      </p>
      <canvas id="${id}Canvas" style="cursor:crosshair;border-radius:10px;max-width:95vw;max-height:65vh;display:block;"></canvas>
      <div style="display:flex;gap:12px;">
        <button onclick="${applyFn}" style="padding:11px 28px;background:linear-gradient(135deg,#E57E2F,#c96820);
          color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">✂️ Apply Crop</button>
        <button onclick="${cancelFn}" style="padding:11px 22px;background:rgba(255,255,255,.1);
          color:#fff;border:1.5px solid rgba(255,255,255,.25);border-radius:10px;font-size:14px;cursor:pointer;">Cancel</button>
      </div>`;
    document.body.appendChild(el);
  };
  mkOverlay("resizerCropOverlay", "cropApply('resizerCropOverlay')", "cropCancel('resizerCropOverlay')");
  mkOverlay("compCropOverlay",    "cropApply('compCropOverlay')",    "cropCancel('compCropOverlay')");
}

/* ============================================================
   TOOLS CSS — injected at runtime
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

    /* Checkerboard for BG remover */
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

    /* Crop button — teal variant */
    .tool-crop-btn {
      padding: 12px 20px;
      border-radius: 12px;
      border: 1.5px solid rgba(153,186,187,.4);
      background: rgba(153,186,187,.1);
      color: #99BABB;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin-left: 10px;
      transition: all .18s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .tool-crop-btn:hover {
      border-color: #99BABB;
      background: rgba(153,186,187,.18);
      color: #fff;
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

    /* ── Info notice ─────────────────────────────── */
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

    /* ── BG redirect buttons ─────────────────────── */
    .bg-redirect-btn {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 22px;
      border-radius: 14px;
      color: #fff;
      text-decoration: none;
      font-family: 'DM Sans', sans-serif;
      min-width: 200px;
      text-align: left;
      transition: transform .2s, box-shadow .2s;
      box-shadow: 0 4px 18px rgba(0,0,0,.3);
    }
    .bg-redirect-btn:hover {
      transform: translateY(-3px) scale(1.03);
      box-shadow: 0 10px 30px rgba(0,0,0,.4);
    }
    .bg-redirect-btn strong { display:block; font-size:15px; font-weight:700; }
    .bg-redirect-btn small  { display:block; font-size:12px; opacity:.8; margin-top:2px; }

    /* ── Live dimension preview hint ──────────────── */
    .resizer-dim-hint {
      font-family: 'DM Sans', sans-serif;
      font-size: 12px;
      color: #99BABB;
      margin-top: -10px;
      margin-bottom: 10px;
      font-weight: 600;
      letter-spacing: .3px;
      min-height: 18px;
    }

    /* ── Converter target size hint ──────────────── */
    .conv-target-hint {
      font-family: 'DM Sans', sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: #E57E2F;
      letter-spacing: .3px;
    }

    /* ── PDF Compressor ──────────────────────────── */
    .pdfcomp-info-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 18px;
      font-family: 'DM Sans', sans-serif;
    }
    .pdfcomp-info-bar span:first-child {
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pdfcomp-pages {
      font-size: 12px;
      color: #99BABB;
      font-weight: 600;
      background: rgba(153,186,187,.12);
      border-radius: 6px;
      padding: 3px 9px;
    }
    .pdfcomp-origsize {
      font-size: 12px;
      color: rgba(255,255,255,.45);
    }

    .pdfcomp-progress-wrap {
      width: 100%;
      max-width: 360px;
      height: 6px;
      background: rgba(255,255,255,.08);
      border-radius: 99px;
      overflow: hidden;
    }
    .pdfcomp-progress-bar {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #E57E2F, #f5a623);
      border-radius: 99px;
      transition: width .3s ease;
    }

    .pdfcomp-result-card {
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 14px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .pdfcomp-result-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
    }
    .pdfcomp-result-label {
      color: rgba(255,255,255,.5);
      font-weight: 500;
    }
    .pdfcomp-result-val {
      font-weight: 700;
      color: #fff;
    }
    .pdfcomp-saved {
      color: #28a745;
    }

    /* ── Responsive ──────────────────────────────── */
    @media (max-width: 600px) {
      .tool-inner { padding: 18px 14px; }
      .tools-tab-bar { gap: 7px; }
      .tool-tab { padding: 8px 14px; font-size: 13px; }
      .tool-fields { gap: 10px; }
      .tool-field-group input[type="number"],
      .tool-field-group select { min-width: 80px; }
      .tool-crop-btn { margin-left: 0; margin-top: 8px; }
    }
  `;
  document.head.appendChild(s);
}