/* ============================================================
   Verma Enterprises — Main Script
   Fixes applied:
     1. Logged-in users no longer see "Sign In" on return visit
     2. Auth input fields styled cleanly (injected CSS)
     3. Navbar anchor links use preventDefault — no page refresh
     4. Live order tracking: auto-polls every 15s when dashboard open
     5. Sidebar removed — inline nav buttons on dashboard
     6. "Get Started" hero btn → hidden after login, replaced by
        "My Applications" button that opens the dashboard
     7. Avatar dropdown → Profile + Logout only (no My Applications)
     8. WhatsApp Support fixed button (bottom-right)
     9. Auto-logout on browser/tab close (beforeunload + pagehide)
    10. Inactivity auto-logout after 30 min idle
   All backend endpoints, auth, upload, invoice logic preserved.
   ============================================================ */

"use strict";

/* ─── CONSTANTS ──────────────────────────────────────────── */
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

/* ─── MUTABLE STATE ──────────────────────────────────────── */
let currentServiceId      = null;
let allUserServices       = [];
let activeUserCategory    = "all";
let searchSuggestionIndex = -1;
let suggestionTimer       = null;
let selectedFiles         = [];
let pendingServiceId      = null;
let isMobileNavOpen       = false;
let liveTrackingTimer     = null;   // setInterval handle for auto-refresh
let inactivityTimer       = null;   // auto-logout on idle
const INACTIVITY_LIMIT    = 30 * 60 * 1000; // 30 minutes ms

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  injectBaseStyles();

  // Intercept all navbar anchor clicks — prevent hard reload
  document.querySelectorAll(".nav-links a, .mobile-nav-drawer a").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      const href = a.getAttribute("href");
      if (href && href.startsWith("#")) smoothNav(href.slice(1));
      closeMobileNav();
    });
  });

  // Close profile menus on outside click
  document.addEventListener("click", handleOutsideClick);

  // Sticky navbar on scroll
  window.addEventListener("scroll", handleNavbarScroll);

  // History guard
  window.history.pushState(null, null, window.location.href);
  window.onpopstate = () => { if (!getToken()) location.replace("index.html"); };

  // ── Auto-logout on browser/tab close ──────────────────────
  // pagehide fires reliably on mobile + desktop; beforeunload is
  // a fallback for some browsers. We only clear the token when the
  // page is NOT being put into the bfcache (persisted === false).
  window.addEventListener("pagehide", e => {
    if (!e.persisted) silentLogout();
  });
  window.addEventListener("beforeunload", () => {
    silentLogout();
  });

  // ── Inactivity auto-logout (30 min) ───────────────────────
  ["mousemove","mousedown","keydown","touchstart","scroll","click"].forEach(ev =>
    document.addEventListener(ev, resetInactivityTimer, { passive: true })
  );

  // ── WhatsApp Support button ────────────────────────────────
  injectWhatsAppButton();

  // Boot
  runPageLoader(() => {
    const token = getToken();
    if (token) {
      enterSite();
    } else {
      showPublicSite();
      loadServices();
    }
  });
}

/* ============================================================
   INJECTED STYLES
   Auth input fix + dashboard layout overrides (no sidebar)
   ============================================================ */
function injectBaseStyles() {
  if (document.getElementById("veBaseStyles")) return;
  const s = document.createElement("style");
  s.id = "veBaseStyles";
  s.textContent = `
    /* ── Auth field upgrade ─────────────────── */
    .auth-field-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255,255,255,0.07);
      border: 1.5px solid rgba(255,255,255,0.13);
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 14px;
      transition: border-color .2s, background .2s;
    }
    .auth-field-wrap:focus-within {
      border-color: rgba(255,165,0,.7);
      background: rgba(255,255,255,0.10);
    }
    .auth-field-wrap input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #fff;
      font-size: 15px;
      font-family: inherit;
      caret-color: orange;
    }
    .auth-field-wrap input::placeholder { color: rgba(255,255,255,.38); }
    .auth-field-icon { font-size: 18px; flex-shrink: 0; user-select: none; }
    .auth-eye { cursor: pointer; font-size: 17px; flex-shrink: 0; opacity: .5; transition: opacity .2s; }
    .auth-eye:hover { opacity: 1; }

    /* ── Dashboard: no sidebar, full-width layout ── */
    .dashboard { display: flex; flex-direction: column; min-height: 100vh; }
    .dashboard .topbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 28px; position: sticky; top: 0; z-index: 200;
      background: rgba(10,10,15,.96); backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255,255,255,.07);
    }
    .dashboard .topbar h2 { font-size: 20px; font-weight: 700; color: #e8a000; letter-spacing: .5px; }
    /* Hide the old hamburger — no sidebar */
    .dashboard .menu-btn { display: none !important; }
    /* Hide the old sidebar + overlay */
    #sidebar, #overlay { display: none !important; }

    /* ── Dash welcome bar with inline nav buttons ── */
    .dash-welcome-bar {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 12px; margin-bottom: 24px;
    }
    .dash-nav-btns { display: flex; gap: 10px; flex-wrap: wrap; }
    .dash-nav-btn {
      padding: 9px 20px; border-radius: 10px; border: 1.5px solid rgba(255,255,255,.15);
      background: rgba(255,255,255,.06); color: #fff; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: background .2s, border-color .2s;
    }
    .dash-nav-btn:hover { background: rgba(255,255,255,.13); border-color: rgba(255,165,0,.5); }
    .dash-nav-btn.active { background: rgba(255,165,0,.18); border-color: #e8a000; color: #e8a000; }

    /* ── Live tracking pulse indicator ── */
    .live-dot {
      display: inline-block; width: 8px; height: 8px; border-radius: 50%;
      background: #22c55e; margin-right: 6px;
      animation: livePulse 1.6s ease-in-out infinite;
    }
    @keyframes livePulse {
      0%,100% { opacity: 1; transform: scale(1); }
      50%      { opacity: .4; transform: scale(1.4); }
    }

    /* ── File rows ─────────────────────────────── */
    .file-row {
      display: flex; align-items: center; gap: 12px; padding: 10px 14px;
      background: rgba(255,255,255,.06); border-radius: 10px; margin-top: 10px;
      border: 1px solid rgba(255,255,255,.1); transition: background .2s;
    }
    .file-row:hover { background: rgba(255,255,255,.1); }
    .file-row-icon { font-size: 24px; flex-shrink: 0; }
    .file-row-info { flex: 1; min-width: 0; }
    .file-row-name { display: block; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .file-row-size { font-size: 11px; opacity: .6; }
    .file-row-delete {
      background: rgba(239,68,68,.15); color: #ef4444; border: none;
      border-radius: 50%; width: 28px; height: 28px; cursor: pointer; font-size: 14px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background .2s;
    }
    .file-row-delete:hover { background: rgba(239,68,68,.35); }
    .file-drop-zone.dragging { border-color: #e8a000; background: rgba(232,160,0,.08); }

    /* ── Toast ──────────────────────────────────── */
    @keyframes toastIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: none; } }

    /* ── Skeleton shimmer ───────────────────────── */
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* ── Page loader fade ───────────────────────── */
    #pageLoader.fade-out { opacity: 0; transition: opacity .5s; }

    /* ── WhatsApp fixed button ──────────────────── */
    #whatsappBtn {
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 9000;
      display: flex;
      align-items: center;
      gap: 10px;
      background: linear-gradient(135deg, #25d366 0%, #128c7e 100%);
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      padding: 13px 20px 13px 16px;
      border-radius: 50px;
      border: none;
      cursor: pointer;
      box-shadow: 0 6px 28px rgba(37,211,102,.45);
      text-decoration: none;
      transition: transform .22s cubic-bezier(.34,1.56,.64,1), box-shadow .22s;
      animation: waBounceIn .6s cubic-bezier(.34,1.56,.64,1) both;
    }
    #whatsappBtn:hover {
      transform: translateY(-3px) scale(1.04);
      box-shadow: 0 10px 36px rgba(37,211,102,.55);
    }
    #whatsappBtn:active { transform: scale(.97); }
    #whatsappBtn .wa-icon {
      width: 22px; height: 22px; flex-shrink: 0;
    }
    @keyframes waBounceIn {
      0%   { opacity: 0; transform: translateY(40px) scale(.8); }
      100% { opacity: 1; transform: translateY(0)   scale(1);   }
    }

    /* ── Hero CTA swap (logged-in) ──────────────── */
    .hero-cta-secondary.logged-in-cta {
      background: linear-gradient(135deg, rgba(255,165,0,.18), rgba(255,165,0,.08));
      border: 1.5px solid rgba(255,165,0,.6);
      color: #f5a623;
      font-weight: 700;
    }
    .hero-cta-secondary.logged-in-cta:hover {
      background: rgba(255,165,0,.25);
    }
  `;
  document.head.appendChild(s);
}

/* ============================================================
   WHATSAPP SUPPORT BUTTON
   ============================================================ */
function injectWhatsAppButton() {
  if (document.getElementById("whatsappBtn")) return;
  const btn = document.createElement("a");
  btn.id   = "whatsappBtn";
  btn.href = "https://wa.me/919576882823?text=Hello%2C%20I%20need%20support%20with%20Verma%20Enterprises%20services.";
  btn.target = "_blank";
  btn.rel    = "noopener noreferrer";
  btn.setAttribute("aria-label", "WhatsApp Support");
  btn.innerHTML = `
    <svg class="wa-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15
               -.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075
               -.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059
               -.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52
               .149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52
               -.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51
               -.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372
               -.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074
               .149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625
               .712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413
               .248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.418
               A9.953 9.953 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z
               M12 20a7.95 7.95 0 0 1-4.054-1.107l-.29-.173-3.005.856.854-2.938
               -.19-.302A7.96 7.96 0 0 1 4 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/>
    </svg>
    WhatsApp Support
  `;
  document.body.appendChild(btn);
}

/* ============================================================
   AUTO-LOGOUT — browser close + inactivity
   ============================================================ */

/** Clears session without redirecting (used in unload events) */
function silentLogout() {
  stopLiveTracking();
  stopInactivityTimer();
  sessionStorage.removeItem("token");
}

/** Full logout with redirect */
function logout() {
  silentLogout();
  location.href = "index.html";
}

function resetInactivityTimer() {
  if (!getToken()) return; // only relevant when logged in
  stopInactivityTimer();
  inactivityTimer = setTimeout(() => {
    toast("You were logged out due to inactivity.", "warn");
    setTimeout(logout, 1800); // give toast 1.8 s to show
  }, INACTIVITY_LIMIT);
}

function stopInactivityTimer() {
  if (inactivityTimer) { clearTimeout(inactivityTimer); inactivityTimer = null; }
}

/* ============================================================
   PAGE LOADER
   ============================================================ */
function runPageLoader(callback) {
  const loader = document.getElementById("pageLoader");
  const bar    = document.getElementById("loaderBar");
  const msg    = document.getElementById("loaderMsg");
  if (!loader) { callback(); return; }

  const messages = ["Loading services...", "Preparing your panel...", "Almost ready..."];
  let progress = 0, msgIdx = 0;

  const tick = setInterval(() => {
    progress += Math.random() * 22 + 8;
    if (bar) bar.style.width = Math.min(progress, 93) + "%";
    msgIdx = Math.min(msgIdx + 1, messages.length - 1);
    if (msg) msg.textContent = messages[msgIdx];
    if (progress >= 93) clearInterval(tick);
  }, 350);

  const finish = () => {
    clearInterval(tick);
    if (bar) bar.style.width = "100%";
    setTimeout(() => {
      loader.classList.add("fade-out");
      setTimeout(() => { loader.style.display = "none"; callback(); }, 500);
    }, 300);
  };

  window.addEventListener("load", finish, { once: true });
  setTimeout(finish, 3200); // hard fallback
}

/* ============================================================
   UTILITIES
   ============================================================ */
const el = id => document.getElementById(id);
const getToken      = ()  => sessionStorage.getItem("token");
const authHeaders   = ()  => ({ Authorization: getToken() });
const jsonHeaders   = ()  => ({ "Content-Type": "application/json" });

function decodeToken(token) {
  try { return JSON.parse(atob(token.split(".")[1])); }
  catch { return null; }
}

function toast(message, type = "info") {
  let c = el("toastContainer");
  if (!c) {
    c = document.createElement("div");
    c.id = "toastContainer";
    c.style.cssText = "position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;";
    document.body.appendChild(c);
  }
  const colors = { info: "#4361ee", success: "#22c55e", error: "#ef4444", warn: "#f59e0b" };
  const t = document.createElement("div");
  t.style.cssText = `background:${colors[type]||colors.info};color:#fff;padding:13px 20px;
    border-radius:12px;font-size:14px;font-weight:500;
    box-shadow:0 8px 24px rgba(0,0,0,.3);min-width:230px;max-width:320px;
    animation:toastIn .3s ease;`;
  t.textContent = message;
  c.appendChild(t);
  setTimeout(() => { t.style.cssText += "opacity:0;transition:opacity .4s;"; setTimeout(() => t.remove(), 400); }, 3400);
}

function setBtnLoading(btn, loading, originalText) {
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.orig = btn.textContent;
    btn.textContent  = "Please wait...";
    btn.style.opacity = "0.7";
  } else {
    btn.disabled = false;
    btn.textContent  = originalText || btn.dataset.orig || "Submit";
    btn.style.opacity = "";
  }
}

function showSkeleton(containerId, count = 4) {
  const c = el(containerId);
  if (!c) return;
  c.innerHTML = Array.from({ length: count }, () =>
    `<div style="background:linear-gradient(90deg,rgba(255,255,255,.05) 25%,rgba(255,255,255,.1) 50%,rgba(255,255,255,.05) 75%);
      background-size:200% 100%;animation:shimmer 1.4s infinite;min-height:110px;border-radius:16px;"></div>`
  ).join("");
}

/* ============================================================
   LAYOUT VISIBILITY
   ============================================================ */
function showPublicSite() {
  el("publicSite")?.classList.remove("hidden");
  el("mainPage")?.classList.add("hidden");
  stopLiveTracking();
}

function showDashboard() {
  el("publicSite")?.classList.add("hidden");
  el("mainPage")?.classList.remove("hidden");
  el("ordersSection")?.classList.remove("hidden");
  renderDashTopbar();
}

function backToPublic() {
  showPublicSite();
  closeAllMenus();
}

function switchToDashboard() {
  if (!getToken()) { openLoginModal(); return; }
  showDashboard();
  loadUserOrders();
  startLiveTracking();
  closeAllMenus();
}

/* ============================================================
   NAVBAR HELPERS
   ============================================================ */
function handleNavbarScroll() {
  const nav = el("mainNavbar");
  if (nav) nav.style.background = window.scrollY > 40 ? "rgba(10,10,15,.97)" : "";
}

/* Smooth scroll — used by nav links (href default prevented in initApp) */
function smoothNav(sectionId) {
  const section = el(sectionId);
  if (!section) return;
  // If dashboard is showing, switch back to public first then scroll
  if (!el("publicSite")?.classList.contains("hidden")) {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    showPublicSite();
    setTimeout(() => section.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }
}

/* ============================================================
   MOBILE NAV
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
   LOGIN MODAL
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

function handleModalBackdropClick(event, modalId) {
  if (event.target.id !== modalId) return;
  const map = {
    authPage: closeLoginModal,
    serviceModal: closeModal,
    profileModal: closeProfileModal,
    forgotBox: closeForgot,
    adminForgotBox: closeAdminForgot
  };
  map[modalId]?.();
}

function handleOutsideClick(e) {
  // Nav avatar menu
  const navAv  = el("navAvatar");
  const navM   = el("profileMenu");
  if (navM && !navM.classList.contains("hidden") && !navAv?.contains(e.target))
    navM.classList.add("hidden");

  // Dashboard avatar menu
  const dashM  = el("dashProfileMenu");
  const dashAv = el("avatarText");
  if (dashM && !dashM.classList.contains("hidden") &&
      !dashAv?.contains(e.target) && !dashM.contains(e.target))
    dashM.classList.add("hidden");
}

function closeAllMenus() {
  el("profileMenu")?.classList.add("hidden");
  el("dashProfileMenu")?.classList.add("hidden");
}

/* ============================================================
   AUTH — FLIP CARD
   ============================================================ */
function flip() { el("authCard")?.classList.toggle("flip"); }

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
  const name       = el("name")?.value.trim()             || "";
  const identifier = el("signupIdentifier")?.value.trim() || "";
  const password   = el("signupPassword")?.value          || "";
  const btn        = document.querySelector(".auth-back .auth-btn");

  if (!name || !identifier || !password) return toast("Please fill all fields ❌", "warn");

  const isEmail  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  const isMobile = /^[6-9]\d{9}$/.test(identifier);
  if (!isEmail && !isMobile) return toast("Enter a valid email or 10-digit mobile number ❌", "warn");

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
  const password   = el("loginPassword")?.value          || "";
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

    // Resume pending apply if user was redirected to login
    if (pendingServiceId) {
      const sid = pendingServiceId;
      pendingServiceId = null;
      openService(sid, true);
    }
  } catch { toast("Network error ❌", "error"); }
  finally { setBtnLoading(btn, false, "Sign In"); }
}

/* ============================================================
   ENTER SITE  ← FIX: called both on login AND on page load
   when token already exists — always updates navbar state
   ============================================================ */
function enterSite() {
  const token = getToken();
  if (!token) return;

  const user = decodeToken(token);
  if (user?.role === "admin") { location.href = "admin.html"; return; }

  // Always update navbar regardless of how we got here
  updateNavbarAuthState(user);

  // Load profile + services (public site stays visible)
  showPublicSite();
  loadServices();
  loadProfile();
}

/**
 * Show avatar, hide Sign In button, set the avatar letter.
 * Called both after login and on DOMContentLoaded if token exists.
 */
function updateNavbarAuthState(user) {
  el("navAuthBtn")?.classList.add("hidden");
  const navAv = el("navAvatar");
  if (navAv) {
    navAv.classList.remove("hidden");
    const letter = ((user?.name || "") || "U").charAt(0).toUpperCase();
    // First child node is the letter text node (before the dropdown div)
    if (navAv.childNodes[0]) navAv.childNodes[0].textContent = letter;
  }
}

function logout() {
  stopLiveTracking();
  sessionStorage.removeItem("token");
  location.href = "index.html";
}

/* ============================================================
   PROFILE MENU TOGGLES
   ============================================================ */
function toggleProfileMenu()     { el("profileMenu")?.classList.toggle("hidden"); }
function toggleDashProfileMenu() { el("dashProfileMenu")?.classList.toggle("hidden"); }
window.toggleProfileMenu = toggleProfileMenu; // accessible from inline HTML

/* ============================================================
   DASHBOARD TOPBAR  (replaces sidebar)
   Renders: avatar + "My Applications" + profile dropdown
   ============================================================ */
function renderDashTopbar() {
  // The HTML topbar already has avatarText + dashProfileMenu.
  // We just make sure the sidebar toggle button is hidden (CSS does this)
  // and that the topbar profile area shows correct items.
  // dashProfileMenu in HTML already has: Profile, Browse Services, Logout
  // so no changes needed there — just ensure avatar letter is current.
}

/* ============================================================
   DASHBOARD — "My Applications" inline button in welcome bar
   Overrides the old static HTML welcome bar with nav buttons
   ============================================================ */
function renderDashWelcomeBar(userName) {
  const bar = document.querySelector(".dash-welcome-bar");
  if (!bar) return;
  bar.innerHTML = `
    <div>
      <h2>My Applications</h2>
      <p class="dash-subtitle">
        <span class="live-dot"></span>Live tracking active
      </p>
    </div>
    <div class="dash-nav-btns">
      <button class="dash-nav-btn active" onclick="loadUserOrders()">📋 My Applications</button>
      <button class="dash-nav-btn" onclick="backToPublic()">🌐 Browse Services</button>
    </div>
  `;
}

/* ============================================================
   SIDEBAR stubs (HTML still calls these — keep to avoid errors)
   ============================================================ */
function toggleSidebar() { /* sidebar removed — no-op */ }
function scrollToSection(id) {
  el(id)?.scrollIntoView({ behavior: "smooth" });
}

/* ============================================================
   PROFILE MODAL
   ============================================================ */
function openProfileModal() {
  el("profileModal")?.classList.remove("hidden");
  closeAllMenus();
}
function closeProfileModal() { el("profileModal")?.classList.add("hidden"); }

async function loadProfile() {
  try {
    const res  = await fetch(`${API}/auth/me`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success) return;

    const u      = data.user;
    const letter = (u.name || "U").charAt(0).toUpperCase();

    if (el("profileName"))       el("profileName").value       = u.name       || "";
    if (el("profileIdentifier")) el("profileIdentifier").value = u.identifier || "";
    if (el("welcomeText"))       el("welcomeText").innerText   = "Welcome, " + u.name;
    if (el("avatarText"))        el("avatarText").innerText    = letter;
    if (el("sidebarAvatar"))     el("sidebarAvatar").innerText = letter;

    // Sync nav avatar letter
    const navAv = el("navAvatar");
    if (navAv && navAv.childNodes[0]) navAv.childNodes[0].textContent = letter;

    // Rebuild the welcome bar with the user's name
    renderDashWelcomeBar(u.name);
  } catch (err) {
    console.error("Profile load error:", err);
  }
}

async function updateProfile() {
  const pass    = el("profilePassword")?.value || "";
  const confirm = el("confirmPassword")?.value  || "";
  const btn     = document.querySelector("#profileModal .auth-btn");

  if (pass.length < 4) return toast("Password must be at least 4 characters", "warn");
  if (pass !== confirm) return toast("Passwords do not match ❌", "warn");

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
    console.error("loadServices error:", err);
    const grid = el("services");
    if (grid) grid.innerHTML = `<p style="opacity:.6;padding:20px;">Could not load services. Please try again.</p>`;
  }
}

function buildCategoryTabs() {
  const tabsEl = el("categoryTabs");
  if (!tabsEl) return;
  const used = new Set(allUserServices.map(s => s.category || "Government Services"));
  let html = `<button class="cat-tab active" onclick="filterByCategory('all',this)">All</button>`;
  SERVICE_CATEGORIES.forEach(cat => {
    if (used.has(cat)) {
      html += `<button class="cat-tab" onclick="filterByCategory('${cat}',this)">${cat.replace(" Services","")}</button>`;
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
  if (activeUserCategory !== "all")
    filtered = filtered.filter(s => (s.category || "Government Services") === activeUserCategory);
  if (searchVal)
    filtered = filtered.filter(s =>
      [s.name, s.category || "", ...(s.documents || [])].join(" ").toLowerCase().includes(searchVal));

  if (!filtered.length) {
    grid.innerHTML = `<p style="opacity:.6;padding:20px;">No services found${searchVal ? ` for "${searchVal}"` : ""}.</p>`;
    return;
  }

  grid.innerHTML = "";
  filtered.forEach(service => {
    const total = service.finalPrice || service.basePrice || 0;
    const short = (service.category || "Government Services").replace(" Services", "");
    const card  = document.createElement("div");
    card.className = "service-card";
    card.onclick   = () => openService(service._id);
    card.innerHTML = `
      <div class="service-card-header">
        <h3 class="service-card-name">${service.name}</h3>
        <span class="service-cat-badge">${short}</span>
      </div>
      <p class="service-price">₹${total}</p>`;
    grid.appendChild(card);
  });
}

/* ============================================================
   SMART SEARCH
   ============================================================ */
function handleSearchInput(value) {
  clearTimeout(suggestionTimer);
  suggestionTimer = setTimeout(() => { buildSuggestions(value.trim()); renderUserServices(); }, 120);
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
    box.classList.add("visible"); return;
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
  hideSuggestions(); renderUserServices();
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
  if (e.key === "ArrowDown") { e.preventDefault(); searchSuggestionIndex = Math.min(searchSuggestionIndex + 1, items.length - 1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); searchSuggestionIndex = Math.max(searchSuggestionIndex - 1, -1); }
  else if (e.key === "Enter") {
    if (searchSuggestionIndex >= 0 && items[searchSuggestionIndex]) selectSuggestion(items[searchSuggestionIndex].dataset.name);
    else { hideSuggestions(); renderUserServices(); }
    return;
  } else if (e.key === "Escape") { hideSuggestions(); return; }
  items.forEach((item, i) => item.classList.toggle("active", i === searchSuggestionIndex));
}

/* ============================================================
   SERVICE DETAIL MODAL
   ============================================================ */
async function openService(id, showUploadImmediately = false) {
  currentServiceId = id;

  // Reset state
  el("fileUploadSection")?.classList.add("hidden");
  el("submitBtn")?.classList.add("hidden");
  el("applyBtn")?.classList.remove("hidden");
  selectedFiles = [];
  renderFileList();

  // Show modal immediately with loading placeholders
  if (el("modalTitle"))          el("modalTitle").innerText         = "Loading...";
  if (el("modalAppCharge"))      el("modalAppCharge").innerText     = "—";
  if (el("modalServiceCharge"))  el("modalServiceCharge").innerText = "—";
  if (el("modalPrice"))          el("modalPrice").innerText         = "—";
  if (el("modalDocs"))           el("modalDocs").innerHTML          = "<li>Loading...</li>";
  el("serviceModal")?.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  try {
    const res     = await fetch(`${API}/services/${id}`);
    const service = await res.json();

    const app  = service.applicationCharge || service.basePrice || 0;
    const serv = service.serviceCharge     || 0;

    el("modalTitle").innerText              = service.name;
    el("modalAppCharge").innerText          = app;
    el("modalServiceCharge").innerText      = serv;
    el("modalPrice").innerText              = service.finalPrice || (app + serv);
    el("modalDocs").innerHTML               =
      (service.documents || []).map(d => `<li>${d}</li>`).join("") ||
      "<li>No specific documents listed.</li>";

    if (showUploadImmediately && getToken()) revealUploadSection();
  } catch (err) {
    console.error("openService error:", err);
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

/** Apply clicked: gate on auth, then reveal upload */
function handleApply() {
  if (!getToken()) {
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
   FILE UPLOAD — multi-file with per-row preview
   ============================================================ */
function handleFileSelect(fileList) { addFiles(Array.from(fileList)); }

function handleFileDragOver(e)  { e.preventDefault(); el("fileDropZone")?.classList.add("dragging"); }
function handleFileDragLeave(e) { e.preventDefault(); el("fileDropZone")?.classList.remove("dragging"); }
function handleFileDrop(e) {
  e.preventDefault();
  el("fileDropZone")?.classList.remove("dragging");
  addFiles(Array.from(e.dataTransfer?.files || []));
}

function addFiles(newFiles) {
  const ALLOWED = /\.(jpg|jpeg|png|heic|heif|webp|pdf)$/i;
  newFiles.forEach(file => {
    const ok = file.type.startsWith("image/") || file.type === "application/pdf" || ALLOWED.test(file.name);
    if (!ok)   { toast(`"${file.name}" type not supported`, "warn"); return; }
    const dup  = selectedFiles.some(f => f.name === file.name && f.size === file.size);
    if (dup)   { toast(`"${file.name}" already added`, "warn"); return; }
    selectedFiles.push(file);
  });
  renderFileList();
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderFileList();
}

function renderFileList() {
  const list = el("selectedFilesList");
  if (!list) return;
  if (!selectedFiles.length) { list.innerHTML = ""; return; }
  list.innerHTML = selectedFiles.map((file, i) => {
    const isPdf  = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const sizeKb = (file.size / 1024).toFixed(1);
    return `<div class="file-row" id="fileRow${i}">
      <span class="file-row-icon">${isPdf ? "📄" : "🖼️"}</span>
      <div class="file-row-info">
        <span class="file-row-name">${file.name}</span>
        <span class="file-row-size">${sizeKb} KB</span>
      </div>
      <button class="file-row-delete" onclick="removeFile(${i})" aria-label="Remove">✕</button>
    </div>`;
  }).join("");
}

/* ============================================================
   ORDER SUBMISSION
   ============================================================ */
async function submitService() {
  if (!currentServiceId)    return toast("Please select a service ❌", "warn");
  if (!selectedFiles.length) return toast("Please upload at least one document ❌", "warn");

  const btn = el("submitBtn");
  setBtnLoading(btn, true);

  const fd = new FormData();
  fd.append("serviceId", currentServiceId);
  selectedFiles.forEach(f => fd.append("documents", f));

  try {
    const res  = await fetch(`${API}/orders/create`, {
      method: "POST", headers: { Authorization: getToken() }, body: fd
    });
    const raw  = await res.text();
    let data;
    try { data = JSON.parse(raw); }
    catch { console.error("Raw response:", raw); toast("Backend returned invalid response ❌", "error"); return; }

    if (data.success) {
      toast("Application submitted successfully ✅", "success");
      closeModal();
      if (!el("mainPage")?.classList.contains("hidden")) loadUserOrders();
    } else {
      toast(data.message || "Upload failed ❌", "error");
    }
  } catch (err) {
    console.error("submitService error:", err);
    toast("Upload failed. Check your connection ❌", "error");
  } finally {
    setBtnLoading(btn, false, "📤 Submit Application");
  }
}

/* ============================================================
   LIVE TRACKING — auto-polls every 15 s when dashboard is open
   Only updates cards whose status/stage actually changed
   (silent refresh — no skeleton flash, no scroll jump)
   ============================================================ */
const POLL_INTERVAL = 15000; // 15 seconds

function startLiveTracking() {
  stopLiveTracking(); // clear any existing timer
  liveTrackingTimer = setInterval(async () => {
    // Only poll when dashboard is actually visible
    if (el("mainPage")?.classList.contains("hidden")) return;
    await silentRefreshOrders();
  }, POLL_INTERVAL);
}

function stopLiveTracking() {
  if (liveTrackingTimer) { clearInterval(liveTrackingTimer); liveTrackingTimer = null; }
}

/** Fetches orders and updates only cards whose data has changed */
async function silentRefreshOrders() {
  try {
    const res  = await fetch(`${API}/orders/my-orders`, { headers: authHeaders() });
    const data = await res.json();
    const orders = data.orders || [];

    orders.forEach(order => {
      const existingCard = document.querySelector(`[data-order-id="${order._id}"]`);
      if (!existingCard) {
        // New order appeared — full reload
        loadUserOrders(); return;
      }
      // Compare status + stage to decide if this card needs a re-render
      const prevStatus = existingCard.dataset.orderStatus;
      const prevStage  = existingCard.dataset.orderStage  || "";
      const curStatus  = order.status;
      const curStage   = order.timelineStage || "Order Placed";

      if (prevStatus !== curStatus || prevStage !== curStage) {
        // Re-render just this card in place
        existingCard.outerHTML = buildOrderCardHTML(order);
      }
    });
  } catch { /* silent — network blip */ }
}

/* ============================================================
   USER ORDERS — full load (with skeleton)
   ============================================================ */
async function loadUserOrders() {
  const box = el("userOrders");
  if (!box) return;
  showSkeleton("userOrders", 3);

  try {
    const res  = await fetch(`${API}/orders/my-orders`, { headers: authHeaders() });
    const data = await res.json();
    box.innerHTML = "";

    const orders = data.orders || [];
    if (!orders.length) {
      box.innerHTML = `
        <div style="text-align:center;padding:48px;opacity:.6;">
          <p style="font-size:48px;">📋</p>
          <p style="margin-top:8px;">No applications yet.</p>
          <button class="dash-nav-btn" onclick="backToPublic()" style="margin-top:16px;">Browse Services</button>
        </div>`;
      return;
    }

    orders.forEach(order => {
      const card = document.createElement("div");
      card.innerHTML = buildOrderCardHTML(order);
      box.appendChild(card.firstElementChild);
    });

    // Start live tracking whenever orders are loaded into the dashboard
    startLiveTracking();
  } catch (err) {
    console.error("loadUserOrders error:", err);
    if (box) box.innerHTML = `<p style="opacity:.6;padding:20px;">Failed to load. Please try again.</p>`;
  }
}

/** Builds the full HTML string for one order card.
 *  data-order-id, data-order-status, data-order-stage attributes
 *  let silentRefreshOrders() detect changes without a full reload. */
function buildOrderCardHTML(order) {
  let badgeColor = "#ffc107", statusText = "Pending";
  if (order.status === "completed") { badgeColor = "#22c55e"; statusText = "Completed"; }
  if (order.status === "rejected")  { badgeColor = "#ef4444"; statusText = "Rejected"; }

  const fw    = order.finalWorkFile || "";
  const fwRaw = fw.startsWith("http") ? fw : fw ? `${BACKEND}/${fw}` : "";
  const stage = order.timelineStage || "Order Placed";

  return `
    <div class="order-card-small"
         data-order-id="${order._id}"
         data-order-status="${order.status}"
         data-order-stage="${stage}">
      <h3>${order.service?.name || "Service"}</h3>
      <small class="order-card-date">${new Date(order.createdAt).toLocaleString()}</small>
      <div class="status-badge" style="background:${badgeColor};margin:8px 0;">${statusText}</div>
      ${order.reason ? `<p class="order-reject-reason">Reason: ${order.reason}</p>` : ""}
      ${buildTimelineHTML(order)}
      <div class="order-right">
        ${fwRaw ? `
          <a class="user-file-btn" href="${fwRaw}" target="_blank" rel="noopener noreferrer">👁 View Final Work</a>
          <a class="user-file-btn" href="${fwRaw}" download target="_blank" rel="noopener noreferrer">📥 Download</a>` : ""}
        ${order.status === "completed" ? `<button class="invoice-btn" onclick="downloadInvoice('${order._id}')">Invoice</button>` : ""}
      </div>
    </div>`;
}

function buildTimelineHTML(order) {
  if (order.status === "rejected") {
    return `<div class="order-timeline">
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
    html += `<div class="tl-step">
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
    if (!res.ok) { const e = await res.json().catch(()=>({})); return toast(e.message || "Invoice failed ❌", "error"); }
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
function showForgot()  { closeAdminForgot(); el("forgotBox")?.classList.remove("hidden"); }
function closeForgot() { el("forgotBox")?.classList.add("hidden"); }

async function resetPassword() {
  const identifier  = el("fpIdentifier")?.value.trim() || "";
  const newPassword = el("newPassword")?.value          || "";
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
function openAdminResetModal() { closeForgot(); el("adminForgotBox")?.classList.remove("hidden"); }
function closeAdminForgot() {
  el("adminForgotBox")?.classList.add("hidden");
  ["adminFpIdentifier","adminFpOtp","adminFpNewPassword"].forEach(id => { if (el(id)) el(id).value = ""; });
}

async function sendAdminForgotOtp() {
  const identifier = el("adminFpIdentifier")?.value.trim() || "";
  if (!identifier) return toast("Please enter admin email ❌", "warn");
  const btn = document.querySelector("#adminForgotBox .auth-btn");
  setBtnLoading(btn, true);
  try {
    const res  = await fetch(`${API}/auth/admin-forgot-otp`, {
      method: "POST", headers: jsonHeaders(), body: JSON.stringify({ identifier })
    });
    const data = await res.json();
    toast(data.message, data.success ? "success" : "error");
  } catch { toast("Network error ❌", "error"); }
  finally { setBtnLoading(btn, false, "Send OTP"); }
}

async function resetAdminPassword() {
  const identifier  = el("adminFpIdentifier")?.value.trim()  || "";
  const otp         = el("adminFpOtp")?.value.trim()          || "";
  const newPassword = el("adminFpNewPassword")?.value          || "";
  if (!identifier)  return toast("Please enter admin email ❌", "warn");
  if (!otp)         return toast("Please enter OTP first ❌", "warn");
  if (!newPassword) return toast("Please enter new password ❌", "warn");
  try {
    const res  = await fetch(`${API}/auth/admin-forgot-reset`, {
      method: "POST", headers: jsonHeaders(),
      body: JSON.stringify({ identifier, otp, newPassword })
    });
    const data = await res.json();
    toast(data.message, data.success ? "success" : "error");
    if (data.success) closeAdminForgot();
  } catch { toast("Network error ❌", "error"); }
}

/* ============================================================
   OTP (preserved)
   ============================================================ */
async function sendOTP(type) {
  const idField    = type === "signup" ? "signupIdentifier" : "fpIdentifier";
  const identifier = el(idField)?.value.trim() || "";
  if (!identifier) return toast("Please enter email or mobile ❌", "warn");
  try {
    const res  = await fetch(`${API}/otp/send-otp`, {
      method: "POST", headers: jsonHeaders(), body: JSON.stringify({ identifier })
    });
    const data = await res.json();
    toast(data.message || "OTP sent ✅", data.success ? "success" : "error");
  } catch { toast("Failed to send OTP ❌", "error"); }
}