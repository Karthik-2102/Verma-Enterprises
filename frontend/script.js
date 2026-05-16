/* ============================================================
   Verma Enterprises — Main Script  (Updated)
   Architecture:
     • Public landing page visible to all
     • Login/Register via navbar modal
     • Service detail modal → Apply → Auth gate → Upload → Submit
     • Dashboard: My Applications + Live Tracking (no service list)
     • Premium UX: loaders, transitions, skeleton cards, toasts
   All backend API connections, endpoint names, and auth logic
   preserved exactly from the original implementation.
   ============================================================ */

"use strict";

/* ────────────────────────────────────────────────────────────
   CONSTANTS
   ──────────────────────────────────────────────────────────── */
const API     = "https://artistic-respect-production-e47c.up.railway.app/api";
const BACKEND = "https://artistic-respect-production-e47c.up.railway.app";

const TIMELINE_STAGES = [
  "Order Placed",
  "Documents Verified",
  "Processing",
  "Ready for Delivery",
  "Completed"
];

const SERVICE_CATEGORIES = [
  "Government Services",
  "Education Services",
  "Printing Services",
  "ID Card Services",
  "Pension & Welfare Services"
];

/* ────────────────────────────────────────────────────────────
   MUTABLE STATE
   ──────────────────────────────────────────────────────────── */
let currentServiceId       = null;  // id of the service open in the detail modal
let allUserServices        = [];    // full service list fetched from API
let activeUserCategory     = "all"; // active filter tab
let searchSuggestionIndex  = -1;    // keyboard nav index for search dropdown
let suggestionTimer        = null;  // debounce handle for search input
let selectedFiles          = [];    // file objects chosen for upload (multi-file)
let pendingServiceId       = null;  // service id awaiting auth before Apply
let isMobileNavOpen        = false; // mobile drawer toggle state

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  // Prevent back-button from revealing protected pages
  window.history.pushState(null, null, window.location.href);
  window.onpopstate = () => {
    if (!getToken()) location.replace("index.html");
  };

  // Show the premium page loader, then boot
  runPageLoader(() => {
    const token = getToken();
    if (token) {
      enterSite();
    } else {
      showPublicSite();
      loadServices(); // services visible publicly without login
    }
  });

  // Close profile menus on outside click
  document.addEventListener("click", handleOutsideClick);

  // Sticky navbar shadow on scroll
  window.addEventListener("scroll", handleNavbarScroll);
}

/* ============================================================
   PAGE LOADER — Premium animated entrance
   ============================================================ */
function runPageLoader(callback) {
  const loader  = document.getElementById("pageLoader");
  const bar     = document.getElementById("loaderBar");
  const msg     = document.getElementById("loaderMsg");
  if (!loader)  { callback(); return; }

  const messages = ["Loading services...", "Preparing dashboard...", "Almost ready..."];
  let   progress = 0;
  let   msgIndex = 0;

  const tick = setInterval(() => {
    progress += Math.random() * 22 + 8;
    if (bar) bar.style.width = Math.min(progress, 95) + "%";
    msgIndex = Math.min(msgIndex + 1, messages.length - 1);
    if (msg) msg.textContent = messages[msgIndex];

    if (progress >= 95) clearInterval(tick);
  }, 350);

  // Finish loader after resources settle
  window.addEventListener("load", () => {
    clearInterval(tick);
    if (bar) bar.style.width = "100%";
    setTimeout(() => {
      loader.classList.add("fade-out");
      setTimeout(() => {
        loader.style.display = "none";
        callback();
      }, 500);
    }, 400);
  });

  // Fallback if load event already fired or takes too long
  setTimeout(() => {
    clearInterval(tick);
    if (bar) bar.style.width = "100%";
    loader.classList.add("fade-out");
    setTimeout(() => { loader.style.display = "none"; callback(); }, 500);
  }, 3500);
}

/* ============================================================
   UTILITIES
   ============================================================ */
const el = id => document.getElementById(id);

function getToken()  { return sessionStorage.getItem("token"); }

function decodeToken(token) {
  try { return JSON.parse(atob(token.split(".")[1])); }
  catch { return null; }
}

function authHeaders() { return { Authorization: getToken() }; }
function jsonHeaders()  { return { "Content-Type": "application/json" }; }

/** Non-blocking toast notification (replaces most alert() calls) */
function toast(message, type = "info") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.style.cssText =
      "position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;";
    document.body.appendChild(container);
  }

  const t = document.createElement("div");
  const colors = { info: "#4361ee", success: "#22c55e", error: "#ef4444", warn: "#f59e0b" };
  t.style.cssText = `
    background:${colors[type] || colors.info};color:#fff;
    padding:14px 20px;border-radius:12px;font-size:14px;font-weight:500;
    box-shadow:0 8px 24px rgba(0,0,0,.25);min-width:240px;max-width:340px;
    animation:toastIn .3s ease;pointer-events:none;
  `;
  t.textContent = message;

  // Inject keyframe once
  if (!document.getElementById("toastKF")) {
    const s = document.createElement("style");
    s.id = "toastKF";
    s.textContent = "@keyframes toastIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}";
    document.head.appendChild(s);
  }

  container.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .4s"; setTimeout(() => t.remove(), 400); }, 3500);
}

/** Set a button to loading / restore state */
function setBtnLoading(btn, loading, originalText) {
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = "Please wait...";
    btn.style.opacity = "0.7";
  } else {
    btn.disabled = false;
    btn.textContent = originalText || btn.dataset.originalText || "Submit";
    btn.style.opacity = "";
  }
}

/** Show skeleton placeholder rows inside a container */
function showSkeleton(containerId, count = 4) {
  const container = el(containerId);
  if (!container) return;
  let html = "";
  for (let i = 0; i < count; i++) {
    html += `<div class="service-card skeleton-card" style="
      background:linear-gradient(90deg,rgba(255,255,255,.05) 25%,rgba(255,255,255,.1) 50%,rgba(255,255,255,.05) 75%);
      background-size:200% 100%;animation:shimmer 1.4s infinite;
      min-height:100px;border-radius:16px;
    "></div>`;
  }
  if (!document.getElementById("shimmerKF")) {
    const s = document.createElement("style");
    s.id = "shimmerKF";
    s.textContent = "@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}";
    document.head.appendChild(s);
  }
  container.innerHTML = html;
}

/* ============================================================
   LAYOUT VISIBILITY HELPERS
   ============================================================ */
function showPublicSite() {
  el("publicSite")?.classList.remove("hidden");
  el("mainPage")?.classList.add("hidden");
}

function showDashboard() {
  el("publicSite")?.classList.add("hidden");
  el("mainPage")?.classList.remove("hidden");
  el("ordersSection")?.classList.remove("hidden");
}

function backToPublic() {
  showPublicSite();
  closeDashProfileMenu();
}

function switchToDashboard() {
  if (!getToken()) { openLoginModal(); return; }
  showDashboard();
  closeDashProfileMenu();
  loadUserOrders();
}

/* ============================================================
   NAVBAR SCROLL EFFECT
   ============================================================ */
function handleNavbarScroll() {
  const navbar = el("mainNavbar");
  if (!navbar) return;
  navbar.style.background = window.scrollY > 40
    ? "rgba(10,10,15,.97)"
    : "";
}

/* ============================================================
   SMOOTH NAVIGATION (anchor scroll)
   ============================================================ */
function smoothNav(sectionId) {
  const section = el(sectionId);
  if (!section) return;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ============================================================
   MOBILE NAV DRAWER
   ============================================================ */
function toggleMobileNav() {
  const drawer = el("mobileNavDrawer");
  const btn    = el("mobileMenuBtn");
  if (!drawer) return;

  isMobileNavOpen = !isMobileNavOpen;
  drawer.classList.toggle("hidden", !isMobileNavOpen);
  if (btn) btn.textContent = isMobileNavOpen ? "✕" : "☰";
}

function closeMobileNav() {
  isMobileNavOpen = false;
  el("mobileNavDrawer")?.classList.add("hidden");
  const btn = el("mobileMenuBtn");
  if (btn) btn.textContent = "☰";
}

/* ============================================================
   LOGIN MODAL  (Navbar-driven — replaces old card-based flow)
   ============================================================ */
function openLoginModal(pendingId = null) {
  if (pendingId) pendingServiceId = pendingId;
  el("authPage")?.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeLoginModal() {
  el("authPage")?.classList.add("hidden");
  document.body.style.overflow = "";
}

/** Backdrop click: close modal if user clicks outside the card */
function handleModalBackdropClick(event, modalId) {
  if (event.target.id === modalId) {
    if (modalId === "authPage")    closeLoginModal();
    if (modalId === "serviceModal") closeModal();
    if (modalId === "profileModal") closeProfileModal();
    if (modalId === "forgotBox")    closeForgot();
    if (modalId === "adminForgotBox") closeAdminForgot();
  }
}

/** Outside-click handler for profile dropdown menus */
function handleOutsideClick(e) {
  const navAvatar = el("navAvatar");
  const profileMenu = el("profileMenu");
  if (profileMenu && !profileMenu.classList.contains("hidden")) {
    if (!navAvatar?.contains(e.target)) profileMenu.classList.add("hidden");
  }

  const dashMenu = el("dashProfileMenu");
  const avatarBtn = el("avatarText");
  if (dashMenu && !dashMenu.classList.contains("hidden")) {
    if (!avatarBtn?.contains(e.target) && !dashMenu.contains(e.target)) {
      dashMenu.classList.add("hidden");
    }
  }
}

/* ============================================================
   AUTH — FLIP CARD (Login ↔ Register)
   ============================================================ */
function flip() {
  el("authCard")?.classList.toggle("flip");
}

function togglePass(inputId, iconEl) {
  const input = el(inputId);
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
  iconEl.style.opacity = input.type === "text" ? "1" : "0.5";
}

/* ============================================================
   REGISTER
   ============================================================ */
async function register() {
  const name       = el("name")?.value.trim() || "";
  const identifier = el("signupIdentifier")?.value.trim() || "";
  const password   = el("signupPassword")?.value || "";
  const btn        = document.querySelector(".auth-back .auth-btn");

  if (!name || !identifier || !password)
    return toast("Please fill all fields ❌", "warn");

  const isEmail  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  const isMobile = /^[6-9]\d{9}$/.test(identifier);

  if (!isEmail && !isMobile)
    return toast("Enter a valid email or 10-digit mobile number ❌", "warn");

  setBtnLoading(btn, true);
  try {
    const res  = await fetch(`${API}/auth/register`, {
      method: "POST", headers: jsonHeaders(),
      body: JSON.stringify({ name, identifier, password })
    });
    const data = await res.json();
    if (data.success) { toast("Registered successfully ✅", "success"); flip(); }
    else toast(data.message || "Registration failed ❌", "error");
  } catch { toast("Network error ❌", "error"); }
  finally { setBtnLoading(btn, false, "Register"); }
}

/* ============================================================
   LOGIN
   ============================================================ */
async function login() {
  const identifier = el("loginIdentifier")?.value.trim() || "";
  const password   = el("loginPassword")?.value || "";
  const btn        = document.querySelector(".auth-front .auth-btn");

  if (!identifier || !password) return toast("Please fill all fields ❌", "warn");

  setBtnLoading(btn, true);
  try {
    const res  = await fetch(`${API}/auth/login`, {
      method: "POST", headers: jsonHeaders(),
      body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();
    if (!data.success) return toast(data.message || "Login failed ❌", "error");

    sessionStorage.setItem("token", data.token);
    closeLoginModal();
    enterSite();

    // If user was trying to apply for a service, re-open that service modal
    if (pendingServiceId) {
      const sid = pendingServiceId;
      pendingServiceId = null;
      openService(sid, true); // true = show upload immediately
    }
  } catch { toast("Network error ❌", "error"); }
  finally { setBtnLoading(btn, false, "Sign In"); }
}

/* ============================================================
   ENTER SITE — post-auth routing
   ============================================================ */
function enterSite() {
  const token = getToken();
  if (!token) return;

  const user = decodeToken(token);
  if (user?.role === "admin") { location.href = "admin.html"; return; }

  // Update navbar: hide Sign In, show avatar
  el("navAuthBtn")?.classList.add("hidden");
  el("navAvatar")?.classList.remove("hidden");

  // Set avatar letter
  const letter = (user?.name || "U").charAt(0).toUpperCase();
  const avatarEl = el("navAvatar");
  if (avatarEl) {
    // Keep the menu inside; only change the first text node
    avatarEl.childNodes[0].textContent = letter;
  }

  // Stay on public site (dashboard only on explicit nav)
  loadServices();
  loadProfile();
}

function logout() {
  sessionStorage.removeItem("token");
  location.href = "index.html";
}

/* ============================================================
   PROFILE MENU TOGGLES
   ============================================================ */
function toggleProfileMenu() {
  el("profileMenu")?.classList.toggle("hidden");
}

function closeDashProfileMenu() {
  el("dashProfileMenu")?.classList.add("hidden");
}

function toggleDashProfileMenu() {
  el("dashProfileMenu")?.classList.toggle("hidden");
}

// Re-export for inline onclick in HTML
window.toggleProfileMenu = toggleProfileMenu;

/* ============================================================
   DASHBOARD SIDEBAR
   ============================================================ */
function toggleSidebar() {
  el("sidebar")?.classList.toggle("active");
  el("overlay")?.classList.toggle("active");
}

function scrollToSection(id) {
  el(id)?.scrollIntoView({ behavior: "smooth" });
  if (window.innerWidth <= 1024) {
    el("sidebar")?.classList.remove("active");
    el("overlay")?.classList.remove("active");
  }
}

/* ============================================================
   PROFILE MODAL
   ============================================================ */
function openProfileModal() {
  el("profileModal")?.classList.remove("hidden");
  // Close any open dropdown
  el("profileMenu")?.classList.add("hidden");
  el("dashProfileMenu")?.classList.add("hidden");
}

function closeProfileModal() {
  el("profileModal")?.classList.add("hidden");
}

/* ============================================================
   LOAD PROFILE DATA
   ============================================================ */
async function loadProfile() {
  try {
    const res  = await fetch(`${API}/auth/me`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success) return;

    const u      = data.user;
    const letter = (u.name || "U").charAt(0).toUpperCase();

    if (el("profileName"))       el("profileName").value       = u.name || "";
    if (el("profileIdentifier")) el("profileIdentifier").value = u.identifier || "";
    if (el("welcomeText"))       el("welcomeText").innerText   = "Welcome, " + u.name;
    if (el("avatarText"))        el("avatarText").innerText    = letter;
    if (el("sidebarAvatar"))     el("sidebarAvatar").innerText = letter;

    // Update nav avatar letter (first text node)
    const navAv = el("navAvatar");
    if (navAv) navAv.childNodes[0].textContent = letter;
  } catch (err) {
    console.error("Profile load error:", err);
  }
}

async function updateProfile() {
  const pass    = el("profilePassword")?.value || "";
  const confirm = el("confirmPassword")?.value || "";
  const btn     = document.querySelector("#profileModal .auth-btn");

  if (pass.length < 4)  return toast("Password must be at least 4 characters", "warn");
  if (pass !== confirm)  return toast("Passwords do not match ❌", "warn");

  setBtnLoading(btn, true);
  try {
    const res  = await fetch(`${API}/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: getToken() },
      body: JSON.stringify({ newPassword: pass })
    });
    const data = await res.json();
    toast(data.message, data.success ? "success" : "error");
    if (data.success) {
      closeProfileModal();
      el("profilePassword").value = "";
      el("confirmPassword").value  = "";
    }
  } catch { toast("Network error ❌", "error"); }
  finally { setBtnLoading(btn, false, "Update Password"); }
}

/* ============================================================
   SERVICES — PUBLIC GRID
   ============================================================ */
async function loadServices() {
  showSkeleton("services", 6);
  try {
    const res = await fetch(`${API}/services`);
    allUserServices = await res.json();
    if (!Array.isArray(allUserServices)) allUserServices = [];
    buildCategoryTabs();
    renderUserServices();
  } catch (err) {
    console.error("Failed to load services:", err);
    const grid = el("services");
    if (grid) grid.innerHTML = `<p style="opacity:.6;padding:20px;">Could not load services. Please try again later.</p>`;
  }
}

function buildCategoryTabs() {
  const tabsEl = el("categoryTabs");
  if (!tabsEl) return;

  const used = new Set(allUserServices.map(s => s.category || "Government Services"));
  let html = `<button class="cat-tab active" onclick="filterByCategory('all',this)">All</button>`;
  SERVICE_CATEGORIES.forEach(cat => {
    if (used.has(cat)) {
      const label = cat.replace(" Services", "");
      html += `<button class="cat-tab" onclick="filterByCategory('${cat}',this)">${label}</button>`;
    }
  });
  tabsEl.innerHTML = html;
}

function filterByCategory(cat, tabEl) {
  activeUserCategory = cat;
  document.querySelectorAll(".cat-tab").forEach(t => t.classList.remove("active"));
  if (tabEl) tabEl.classList.add("active");

  const inp = el("userSearchInput");
  if (inp) inp.value = "";
  hideSuggestions();
  renderUserServices();
}

function renderUserServices() {
  const searchVal = (el("userSearchInput")?.value || "").toLowerCase().trim();
  const grid      = el("services");
  if (!grid) return;

  let filtered = [...allUserServices];

  if (activeUserCategory !== "all") {
    filtered = filtered.filter(s =>
      (s.category || "Government Services") === activeUserCategory
    );
  }

  if (searchVal) {
    filtered = filtered.filter(s =>
      [s.name, s.category || "", ...(s.documents || [])].join(" ").toLowerCase().includes(searchVal)
    );
  }

  if (!filtered.length) {
    grid.innerHTML = `<p style="opacity:.6;padding:20px;">No services found${searchVal ? ` for "${searchVal}"` : ""}.</p>`;
    return;
  }

  grid.innerHTML = "";
  filtered.forEach(service => {
    const total = service.finalPrice || service.basePrice || 0;
    const short = (service.category || "Government Services").replace(" Services", "");

    const card = document.createElement("div");
    card.className = "service-card";
    card.onclick   = () => openService(service._id);
    card.innerHTML = `
      <div class="service-card-header">
        <h3 class="service-card-name">${service.name}</h3>
        <span class="service-cat-badge">${short}</span>
      </div>
      <p class="service-price">₹${total}</p>
    `;
    grid.appendChild(card);
  });
}

/* ============================================================
   SEARCH SUGGESTIONS
   ============================================================ */
function handleSearchInput(value) {
  clearTimeout(suggestionTimer);
  suggestionTimer = setTimeout(() => {
    buildSuggestions(value.trim());
    renderUserServices();
  }, 120);
}

function buildSuggestions(query) {
  const box = el("searchSuggestions");
  if (!box) return;

  if (!query || query.length < 2) { hideSuggestions(); return; }

  const lq      = query.toLowerCase();
  const matches = allUserServices.filter(s =>
    s.name.toLowerCase().includes(lq) || (s.category || "").toLowerCase().includes(lq)
  ).slice(0, 6);

  if (!matches.length) {
    box.innerHTML = `<div class="suggestion-empty">No suggestions found</div>`;
    box.classList.add("visible");
    return;
  }

  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  box.innerHTML = matches.map((s, i) => {
    const hl = s.name.replace(new RegExp(`(${safe})`, "gi"), `<span class="suggestion-highlight">$1</span>`);
    return `<div class="suggestion-item" data-index="${i}" data-name="${s.name.replace(/"/g,"&quot;")}" onmousedown="selectSuggestion(this.dataset.name)">${hl}</div>`;
  }).join("");

  box.classList.add("visible");
  searchSuggestionIndex = -1;
}

function selectSuggestion(name) {
  const input = el("userSearchInput");
  if (input) input.value = name;
  hideSuggestions();
  renderUserServices();
}

function showSuggestions() {
  const inp = el("userSearchInput");
  if (inp?.value.trim().length >= 2) buildSuggestions(inp.value.trim());
}

function hideSuggestions() {
  const box = el("searchSuggestions");
  if (box) { box.classList.remove("visible"); box.innerHTML = ""; }
  searchSuggestionIndex = -1;
}

function hideSuggestionsDelay() { setTimeout(hideSuggestions, 200); }

function handleSearchKeydown(e) {
  const box   = el("searchSuggestions");
  const items = box?.querySelectorAll(".suggestion-item") || [];
  if (!items.length) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    searchSuggestionIndex = Math.min(searchSuggestionIndex + 1, items.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    searchSuggestionIndex = Math.max(searchSuggestionIndex - 1, -1);
  } else if (e.key === "Enter") {
    if (searchSuggestionIndex >= 0 && items[searchSuggestionIndex]) {
      selectSuggestion(items[searchSuggestionIndex].dataset.name);
    } else { hideSuggestions(); renderUserServices(); }
    return;
  } else if (e.key === "Escape") { hideSuggestions(); return; }

  items.forEach((item, i) => item.classList.toggle("active", i === searchSuggestionIndex));
}

/* ============================================================
   SERVICE DETAIL MODAL
   New flow:
     1. User clicks service card → modal opens (public)
     2. User clicks "Apply Now" → if not logged in → open login modal
                                → if logged in       → show upload section
     3. User uploads files and clicks "Submit Application"
   ============================================================ */
async function openService(id, showUploadImmediately = false) {
  currentServiceId = id;

  // Reset modal state
  el("fileUploadSection")?.classList.add("hidden");
  el("submitBtn")?.classList.add("hidden");
  el("applyBtn")?.classList.remove("hidden");
  selectedFiles = [];
  renderFileList();

  // Show modal with skeleton
  el("modalTitle").innerText              = "Loading...";
  el("modalAppCharge").innerText          = "—";
  el("modalServiceCharge").innerText      = "—";
  el("modalPrice").innerText              = "—";
  el("modalDocs").innerHTML               = "<li>Loading documents...</li>";
  el("serviceModal")?.classList.remove("hidden");
  document.body.style.overflow            = "hidden";

  try {
    const res     = await fetch(`${API}/services/${id}`);
    const service = await res.json();

    const app  = service.applicationCharge || service.basePrice || 0;
    const serv = service.serviceCharge || 0;

    el("modalTitle").innerText              = service.name;
    el("modalAppCharge").innerText          = app;
    el("modalServiceCharge").innerText      = serv;
    el("modalPrice").innerText              = service.finalPrice || (app + serv);
    el("modalDocs").innerHTML               =
      (service.documents || []).map(d => `<li>${d}</li>`).join("") || "<li>No specific documents listed.</li>";

    // If called right after login for a pending apply, skip straight to upload
    if (showUploadImmediately && getToken()) revealUploadSection();
  } catch (err) {
    console.error("Service load error:", err);
    toast("Failed to load service details ❌", "error");
    closeModal();
  }
}

function closeModal() {
  el("serviceModal")?.classList.add("hidden");
  document.body.style.overflow = "";
  selectedFiles    = [];
  currentServiceId = null;
  renderFileList();
}

/** Apply button logic: gate on login */
function handleApply() {
  if (!getToken()) {
    // Not logged in — save which service they want, open login
    pendingServiceId = currentServiceId;
    closeModal();
    openLoginModal();
  } else {
    revealUploadSection();
  }
}

function revealUploadSection() {
  el("fileUploadSection")?.classList.remove("hidden");
  el("applyBtn")?.classList.add("hidden");
  el("submitBtn")?.classList.remove("hidden");
  el("fileUploadSection")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ============================================================
   FILE UPLOAD — Multi-file with preview rows
   Supported: JPG, JPEG, PNG, HEIC, WEBP, PDF + image/*
   ============================================================ */

/** Native input onChange */
function handleFileSelect(fileList) {
  addFiles(Array.from(fileList));
}

/** Drag-and-drop handlers */
function handleFileDragOver(e) {
  e.preventDefault();
  el("fileDropZone")?.classList.add("dragging");
}

function handleFileDragLeave(e) {
  e.preventDefault();
  el("fileDropZone")?.classList.remove("dragging");
}

function handleFileDrop(e) {
  e.preventDefault();
  el("fileDropZone")?.classList.remove("dragging");
  const files = Array.from(e.dataTransfer?.files || []);
  addFiles(files);
}

/** Add new files to the selectedFiles array (avoid duplicates by name+size) */
function addFiles(newFiles) {
  const ALLOWED = /\.(jpg|jpeg|png|heic|heif|webp|pdf)$/i;

  newFiles.forEach(file => {
    // Basic type check
    const okType = file.type.startsWith("image/") || file.type === "application/pdf" || ALLOWED.test(file.name);
    if (!okType) { toast(`"${file.name}" is not a supported file type`, "warn"); return; }

    // Duplicate check
    const exists = selectedFiles.some(f => f.name === file.name && f.size === file.size);
    if (exists) { toast(`"${file.name}" is already added`, "warn"); return; }

    selectedFiles.push(file);
  });

  renderFileList();
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderFileList();
}

/** Render one row per file with icon + name + delete button */
function renderFileList() {
  const list = el("selectedFilesList");
  if (!list) return;

  if (!selectedFiles.length) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = selectedFiles.map((file, i) => {
    const isPdf  = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const icon   = isPdf ? "📄" : "🖼️";
    const sizeKb = (file.size / 1024).toFixed(1);
    return `
      <div class="file-row" id="fileRow${i}">
        <span class="file-row-icon">${icon}</span>
        <div class="file-row-info">
          <span class="file-row-name">${file.name}</span>
          <span class="file-row-size">${sizeKb} KB</span>
        </div>
        <button class="file-row-delete" onclick="removeFile(${i})" aria-label="Remove file">✕</button>
      </div>
    `;
  }).join("");

  // Inject file-row styles once
  if (!document.getElementById("fileRowCSS")) {
    const s = document.createElement("style");
    s.id = "fileRowCSS";
    s.textContent = `
      .file-row{display:flex;align-items:center;gap:12px;padding:10px 14px;
        background:rgba(255,255,255,.06);border-radius:10px;margin-top:10px;
        border:1px solid rgba(255,255,255,.1);transition:background .2s}
      .file-row:hover{background:rgba(255,255,255,.1)}
      .file-row-icon{font-size:24px;flex-shrink:0}
      .file-row-info{flex:1;min-width:0}
      .file-row-name{display:block;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .file-row-size{font-size:11px;opacity:.6}
      .file-row-delete{background:rgba(239,68,68,.15);color:#ef4444;border:none;
        border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:14px;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .2s}
      .file-row-delete:hover{background:rgba(239,68,68,.35)}
      .file-drop-zone.dragging{border-color:var(--accent,#6c63ff);background:rgba(108,99,255,.1)}
    `;
    document.head.appendChild(s);
  }
}

/* ============================================================
   ORDER SUBMISSION
   ============================================================ */
async function submitService() {
  if (!currentServiceId)   return toast("Please select a service ❌", "warn");
  if (!selectedFiles.length) return toast("Please upload at least one document ❌", "warn");

  const btn = el("submitBtn");
  setBtnLoading(btn, true);

  const formData = new FormData();
  formData.append("serviceId", currentServiceId);
  selectedFiles.forEach(file => formData.append("documents", file));

  try {
    const response  = await fetch(`${API}/orders/create`, {
      method: "POST",
      headers: { Authorization: getToken() },
      body: formData
    });

    const rawResponse = await response.text();
    let data;
    try { data = JSON.parse(rawResponse); }
    catch {
      console.error("Upload raw response:", rawResponse);
      toast("Backend returned invalid response ❌", "error");
      return;
    }

    if (data.success) {
      toast("Application submitted successfully ✅", "success");
      closeModal();
      // If dashboard is open, refresh orders
      if (!el("mainPage")?.classList.contains("hidden")) loadUserOrders();
    } else {
      toast(data.message || "Upload failed ❌", "error");
    }
  } catch (err) {
    console.error("Submission error:", err);
    toast("Upload failed. Please check your connection ❌", "error");
  } finally {
    setBtnLoading(btn, false, "📤 Submit Application");
  }
}

/* ============================================================
   USER ORDERS + LIVE TIMELINE TRACKING
   Dashboard shows applied services + tracking only (no browse)
   ============================================================ */
async function loadUserOrders() {
  const box = el("userOrders");
  if (!box) return;

  // Skeleton while loading
  showSkeleton("userOrders", 3);

  try {
    const res  = await fetch(`${API}/orders/my-orders`, { headers: authHeaders() });
    const data = await res.json();
    box.innerHTML = "";

    const orders = data.orders || [];
    if (!orders.length) {
      box.innerHTML = `
        <div style="text-align:center;padding:40px;opacity:.6;">
          <p style="font-size:48px;">📋</p>
          <p>No applications yet.</p>
          <button class="browse-services-btn" onclick="backToPublic()" style="margin-top:12px;">Browse Services</button>
        </div>`;
      return;
    }

    orders.forEach(order => {
      let badgeColor = "#ffc107", statusText = "Pending";
      if (order.status === "completed") { badgeColor = "#22c55e"; statusText = "Completed"; }
      if (order.status === "rejected")  { badgeColor = "#ef4444"; statusText = "Rejected"; }

      const fw    = order.finalWorkFile || "";
      const fwRaw = fw.startsWith("http") ? fw : fw ? `${BACKEND}/${fw}` : "";

      const card = document.createElement("div");
      card.className = "order-card-small";
      card.innerHTML = `
        <h3>${order.service?.name || "Service"}</h3>
        <small class="order-card-date">${new Date(order.createdAt).toLocaleString()}</small>
        <div class="status-badge" style="background:${badgeColor};margin:8px 0;">${statusText}</div>
        ${order.reason ? `<p class="order-reject-reason">Reason: ${order.reason}</p>` : ""}
        ${buildTimelineHTML(order)}
        <div class="order-right">
          ${fwRaw ? `
            <a class="user-file-btn" href="${fwRaw}" target="_blank" rel="noopener noreferrer">👁 View Final Work</a>
            <a class="user-file-btn" href="${fwRaw}" download target="_blank" rel="noopener noreferrer">📥 Download</a>
          ` : ""}
          ${order.status === "completed" ? `<button class="invoice-btn" onclick="downloadInvoice('${order._id}')">Invoice</button>` : ""}
        </div>
      `;
      box.appendChild(card);
    });
  } catch (err) {
    console.error("Orders load error:", err);
    if (box) box.innerHTML = `<p style="opacity:.6;padding:20px;">Failed to load applications. Please try again.</p>`;
  }
}

function buildTimelineHTML(order) {
  if (order.status === "rejected") {
    return `
      <div class="order-timeline">
        <div style="font-size:12px;opacity:.6;margin-bottom:6px;">Order Status</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="tl-dot rejected"></div>
          <span style="font-size:12px;color:#ef4444;font-weight:700;">Order Rejected</span>
        </div>
      </div>`;
  }

  const stage = order.timelineStage || "Order Placed";
  const idx   = TIMELINE_STAGES.indexOf(stage);

  let html = `<div class="order-timeline">
    <div style="font-size:12px;opacity:.6;margin-bottom:8px;">Order Progress</div>
    <div class="timeline-stages">`;

  TIMELINE_STAGES.forEach((s, i) => {
    const done   = i < idx;
    const active = i === idx;
    html += `
      <div class="tl-step">
        <div class="tl-dot ${done ? "done" : active ? "active" : ""}"></div>
        <div class="tl-label ${done ? "done" : active ? "active" : ""}">${s}</div>
      </div>`;
    if (i < TIMELINE_STAGES.length - 1)
      html += `<div class="tl-connector ${done ? "done" : ""}"></div>`;
  });

  return html + `</div></div>`;
}

/* ============================================================
   INVOICE DOWNLOAD
   ============================================================ */
async function downloadInvoice(id) {
  try {
    const res = await fetch(`${API}/orders/invoice/${id}`, { headers: authHeaders() });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return toast(e.message || "Invoice failed ❌", "error");
    }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `Verma-Enterprises-Invoice-${id}.pdf`; a.click();
    URL.revokeObjectURL(url);
  } catch { toast("Failed to download invoice ❌", "error"); }
}

/* ============================================================
   FORGOT PASSWORD — User
   ============================================================ */
function showForgot() {
  closeAdminForgot();
  el("forgotBox")?.classList.remove("hidden");
}

function closeForgot() {
  el("forgotBox")?.classList.add("hidden");
}

async function resetPassword() {
  const identifier  = el("fpIdentifier")?.value.trim() || "";
  const newPassword = el("newPassword")?.value || "";
  const btn         = document.querySelector("#forgotBox .auth-btn");

  if (!identifier || !newPassword) return toast("Please fill all fields ❌", "warn");

  setBtnLoading(btn, true);
  try {
    const res  = await fetch(`${API}/auth/reset-password`, {
      method: "POST", headers: jsonHeaders(),
      body: JSON.stringify({ identifier, newPassword })
    });
    const data = await res.json();
    if (data.success) { toast("Password updated ✅", "success"); closeForgot(); }
    else toast(data.message || "Reset failed ❌", "error");
  } catch { toast("Network error ❌", "error"); }
  finally { setBtnLoading(btn, false, "Reset Password"); }
}

/* ============================================================
   ADMIN FORGOT PASSWORD
   ============================================================ */
function openAdminResetModal() {
  closeForgot();
  el("adminForgotBox")?.classList.remove("hidden");
}

function closeAdminForgot() {
  el("adminForgotBox")?.classList.add("hidden");
  const clearIds = ["adminFpIdentifier", "adminFpOtp", "adminFpNewPassword"];
  clearIds.forEach(id => { if (el(id)) el(id).value = ""; });
}

async function sendAdminForgotOtp() {
  const identifier = el("adminFpIdentifier")?.value.trim() || "";
  if (!identifier) return toast("Please enter admin email ❌", "warn");

  const btn = document.querySelector("#adminForgotBox .auth-btn");
  setBtnLoading(btn, true);
  try {
    const res  = await fetch(`${API}/auth/admin-forgot-otp`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ identifier })
    });
    const data = await res.json();
    toast(data.message, data.success ? "success" : "error");
  } catch { toast("Network error ❌", "error"); }
  finally { setBtnLoading(btn, false, "Send OTP"); }
}

async function resetAdminPassword() {
  const identifier  = el("adminFpIdentifier")?.value.trim() || "";
  const otp         = el("adminFpOtp")?.value.trim() || "";
  const newPassword = el("adminFpNewPassword")?.value || "";

  if (!identifier)  return toast("Please enter admin email ❌", "warn");
  if (!otp)         return toast("Please enter OTP first ❌", "warn");
  if (!newPassword) return toast("Please enter new password ❌", "warn");

  try {
    const res  = await fetch(`${API}/auth/admin-forgot-reset`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ identifier, otp, newPassword })
    });
    const data = await res.json();
    toast(data.message, data.success ? "success" : "error");
    if (data.success) closeAdminForgot();
  } catch { toast("Network error ❌", "error"); }
}

/* ============================================================
   OTP (preserved for any future use)
   ============================================================ */
async function sendOTP(type) {
  const idField = type === "signup" ? "signupIdentifier" : "fpIdentifier";
  const identifier = el(idField)?.value.trim() || "";
  if (!identifier) return toast("Please enter email or mobile ❌", "warn");

  try {
    const res  = await fetch(`${API}/otp/send-otp`, {
      method: "POST", headers: jsonHeaders(),
      body: JSON.stringify({ identifier })
    });
    const data = await res.json();
    toast(data.message || "OTP sent ✅", data.success ? "success" : "error");
  } catch { toast("Failed to send OTP ❌", "error"); }
}