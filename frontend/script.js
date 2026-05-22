/* ============================================================
   Verma Enterprises — Main Script
   ============================================================ */

"use strict";

/* ─── CONSTANTS ──────────────────────────────────────────── */
const API =
"https://artistic-respect-production-e47c.up.railway.app/api";

const BACKEND =
"https://artistic-respect-production-e47c.up.railway.app";

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

  window.addEventListener("pagehide", e => {

      const isNavigatingInsideProject =

          document.activeElement?.tagName === "A";

      if (
          !e.persisted &&
          !isNavigatingInsideProject
      ) {

          // keep session alive during internal navigation

      }

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
      justify-content: center;
      width: 56px;
      height: 56px;
      padding: 0;
      gap: 0;
      border-radius: 999px;
      background: linear-gradient(135deg, #25d366 0%, #128c7e 100%);
      color: #fff;
      text-decoration: none;
      box-shadow: 0 6px 24px rgba(37,211,102,.5);
      overflow: hidden;
      white-space: nowrap;
      transition: width .4s cubic-bezier(.34,1.3,.64,1), gap .3s ease,
                  padding .3s ease, box-shadow .3s ease, transform .2s ease;
    }
    #whatsappBtn:hover {
      width: 218px;
      gap: 10px;
      padding: 0 20px 0 16px;
      justify-content: flex-start;
      box-shadow: 0 10px 36px rgba(37,211,102,.6);
      transform: translateY(-2px);
    }
    #whatsappBtn:active { transform: scale(.96); }
    #whatsappBtn .wa-icon {
      width: 26px; height: 26px;
      flex-shrink: 0; min-width: 26px; display: block;
    }
    #whatsappBtn .wa-label {
      font-size: 14px; font-weight: 700;
      font-family: 'DM Sans', sans-serif;
      max-width: 0; overflow: hidden; opacity: 0;
      transition: max-width .35s ease .05s, opacity .25s ease .1s;
    }
    #whatsappBtn:hover .wa-label { max-width: 160px; opacity: 1; }

    /* ── Official charge row ────────────────────── */
    .official-charge-row {
      background: rgba(99,102,241,.08);
      border: 1px solid rgba(99,102,241,.22);
      border-radius: 8px;
      padding: 10px 14px !important;
      margin: 2px 0;
    }
    .official-charge-tag {
      display: inline-block;
      margin-left: 8px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .4px;
      text-transform: uppercase;
      background: rgba(99,102,241,.2);
      color: #a5b4fc;
      border: 1px solid rgba(99,102,241,.35);
      border-radius: 4px;
      padding: 2px 6px;
      vertical-align: middle;
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
  btn.href = "https://wa.me/919576828238?text=Hello%2C%20I%20need%20support%20with%20Verma%20Enterprises%20services.";
  btn.target = "_blank";
  btn.rel    = "noopener noreferrer";
  btn.setAttribute("aria-label", "WhatsApp Support");
  btn.innerHTML = `
    <svg class="wa-icon" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 2C8.268 2 2 8.268 2 16c0 2.4.638 4.644 1.752 6.588L2 30l7.608-1.732A13.94 13.94 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2zm0 25.5a11.44 11.44 0 0 1-5.822-1.588l-.416-.248-4.316.98 1.02-4.194-.272-.43A11.44 11.44 0 0 1 4.5 16C4.5 9.596 9.596 4.5 16 4.5S27.5 9.596 27.5 16 22.404 27.5 16 27.5z"/>
      <path d="M22.1 19.16c-.33-.166-1.952-.964-2.254-1.074-.302-.11-.522-.166-.742.166-.22.33-.852 1.074-1.044 1.294-.192.22-.384.248-.714.082-.33-.166-1.394-.514-2.656-1.64-.982-.876-1.644-1.958-1.836-2.288-.192-.33-.02-.508.144-.674.148-.148.33-.386.496-.578.166-.194.22-.33.33-.552.11-.22.056-.414-.028-.58-.082-.166-.742-1.79-1.016-2.452-.268-.644-.542-.556-.742-.566-.192-.01-.414-.012-.634-.012-.22 0-.578.082-.88.414-.302.33-1.154 1.128-1.154 2.752s1.182 3.192 1.346 3.412c.166.22 2.328 3.556 5.642 4.988.788.34 1.402.544 1.882.696.79.252 1.51.216 2.078.13.634-.094 1.952-.798 2.228-1.57.276-.77.276-1.43.192-1.57-.082-.138-.302-.22-.632-.386z"/>
    </svg>
    <span class="wa-label">WhatsApp Support</span>
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
/* first-show guard — fetch stats only once per session */
let _heroStatsFetched = false;

function showPublicSite() {
  const pub  = el("publicSite");
  const dash = el("mainPage");

  /* Page transition: exit dashboard → enter public */
  if (dash && !dash.classList.contains("hidden")) {
    dash.classList.add("page-exit");
    setTimeout(() => {
      dash.classList.add("hidden");
      dash.classList.remove("page-exit");
      if (pub) {
        pub.classList.remove("hidden");
        pub.classList.add("page-enter");
        setTimeout(() => pub.classList.remove("page-enter"), 400);
      }
    }, 300);
  } else {
    pub?.classList.remove("hidden");
  }

  /* Fetch live completed count the very first time public site shows */
  if (!_heroStatsFetched) {
    _heroStatsFetched = true;
    fetchHeroStats();
  }

  stopLiveTracking();
}

function showDashboard() {
  const pub  = el("publicSite");
  const dash = el("mainPage");

  /* Page transition: exit public → enter dashboard */
  if (pub && !pub.classList.contains("hidden")) {
    pub.classList.add("page-exit");
    setTimeout(() => {
      pub.classList.add("hidden");
      pub.classList.remove("page-exit");
      if (dash) {
        dash.classList.remove("hidden");
        dash.classList.add("page-enter");
        el("ordersSection")?.classList.remove("hidden");
        renderDashTopbar();
        setTimeout(() => dash.classList.remove("page-enter"), 400);
      }
    }, 300);
  } else {
    dash?.classList.remove("hidden");
    el("ordersSection")?.classList.remove("hidden");
    renderDashTopbar();
  }
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
  // Nav avatar menu — close only when click is outside the avatar AND the menu
  const navAv = el("navAvatar");
  const navM  = el("profileMenu");
  if (navM && !navM.classList.contains("hidden")) {
    if (!navAv?.contains(e.target) && !navM.contains(e.target)) {
      navM.classList.add("hidden");
    }
  }

  // Dashboard avatar menu — close only when click is outside avatar text AND menu
  const dashM  = el("dashProfileMenu");
  const dashAv = el("avatarText");
  if (dashM && !dashM.classList.contains("hidden")) {
    if (!dashAv?.contains(e.target) && !dashM.contains(e.target)) {
      dashM.classList.add("hidden");
    }
  }
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

  // Start inactivity timer
  resetInactivityTimer();

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
  // 1. Hide Sign In button, show avatar
  el("navAuthBtn")?.classList.add("hidden");
  const navAv = el("navAvatar");
  if (navAv) {
    navAv.classList.remove("hidden");
    const letter = ((user?.name || "") || "U").charAt(0).toUpperCase();
    if (navAv.childNodes[0]) navAv.childNodes[0].textContent = letter;
  }

  // 2. Hide entire hero section after login
  const heroSection = el("heroSection");
  if (heroSection) {
    heroSection.style.display    = "none";
    heroSection.style.visibility = "hidden";
  }

  // 3. Add "My Applications" pill button in navbar next to avatar (only once)
  if (!el("navMyAppsBtn")) {
    const btn = document.createElement("button");
    btn.id        = "navMyAppsBtn";
    btn.textContent = "📋 My Applications";
    btn.onclick   = switchToDashboard;
    btn.style.cssText = [
      "padding:9px 18px",
      "border-radius:10px",
      "border:1.5px solid rgba(255,165,0,.6)",
      "background:rgba(255,165,0,.12)",
      "color:#f5a623",
      "font-family:'DM Sans',sans-serif",
      "font-size:13px",
      "font-weight:700",
      "cursor:pointer",
      "white-space:nowrap",
      "transition:background .2s"
    ].join(";");
    btn.onmouseover = () => btn.style.background = "rgba(255,165,0,.24)";
    btn.onmouseout  = () => btn.style.background = "rgba(255,165,0,.12)";
    const navRight = navAv?.parentElement;
    if (navRight) navRight.insertBefore(btn, navAv);
  }

  // 4. Remove "My Applications" from avatar dropdown (now in navbar)
  const profileMenu = el("profileMenu");
  if (profileMenu) {
    Array.from(profileMenu.children).forEach(item => {
      if (item.textContent.includes("My Applications")) item.remove();
    });
  }
}

// logout() is defined above in the AUTO-LOGOUT section — do not redefine here.

/* ============================================================
   PROFILE MENU TOGGLES
   ============================================================ */
function toggleProfileMenu(event) {
  // Stop this tap/click from bubbling to document's handleOutsideClick on the same tick
  if (event) event.stopPropagation();

  const dashVisible = !el("mainPage")?.classList.contains("hidden");
  if (dashVisible) {
    /* ── Dashboard context ── */
    const dashMenu = el("dashProfileMenu");
    if (!dashMenu) return;
    const isHidden = dashMenu.classList.contains("hidden");
    el("profileMenu")?.classList.add("hidden");
    dashMenu.classList.toggle("hidden", !isHidden);
  } else {
    /* ── Public site context ── */
    const navMenu = el("profileMenu");
    if (!navMenu) return;
    const isHidden = navMenu.classList.contains("hidden");
    el("dashProfileMenu")?.classList.add("hidden");
    navMenu.classList.toggle("hidden", !isHidden);
  }
}


document.addEventListener("DOMContentLoaded", () => {
  const profileMenu = el("profileMenu");
  if (profileMenu) {
    profileMenu.addEventListener("click", e => e.stopPropagation());
  }
  const dashProfileMenu = el("dashProfileMenu");
  if (dashProfileMenu) {
    dashProfileMenu.addEventListener("click", e => e.stopPropagation());
  }
});

function toggleDashProfileMenu() {
  /* Explicit dash-side toggle (called from dashProfileMenu items) */
  el("dashProfileMenu")?.classList.toggle("hidden");
}

/* Make accessible from inline HTML onclick attributes */
window.toggleProfileMenu     = toggleProfileMenu;
window.toggleDashProfileMenu = toggleDashProfileMenu;

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
      <button class="dash-nav-btn" onclick="backToPublic()">🏠 Home Page</button>
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
  /* Clear password fields on every open */
  ["profilePassword","confirmPassword"].forEach(id => {
    if (el(id)) el(id).value = "";
  });
  /* Reset strength bar */
  const bar = el("profileStrengthBar");
  const msg = el("profileStrengthMsg");
  if (bar) { bar.style.width = "0%"; }
  if (msg) msg.textContent = "";
  closeAllMenus();
}

function closeProfileModal() {
  el("profileModal")?.classList.add("hidden");
}

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
  const pass    = el("profilePassword")?.value  || "";
  const confirm = el("confirmPassword")?.value   || "";
  const btn     = document.querySelector("#profileModal .profile-update-btn");

  /* Strong password validation */
  const { valid } = evaluatePassword(pass);
  if (!valid) return toast("Password must be ≥6 chars with uppercase, number & special character ❌", "warn");
  if (pass !== confirm) return toast("Passwords do not match ❌", "warn");

  setBtnLoading(btn, true);
  try {
    const res  = await fetch(`${API}/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: getToken() },
      body: JSON.stringify({ newPassword: pass })
    });
    const data = await res.json();
    toast(data.message || (data.success ? "Password updated ✅" : "Failed ❌"), data.success ? "success" : "error");
    if (data.success) closeProfileModal();
  } catch (err) {
    console.error("Change password error:", err);
    toast("Network error — please try again ❌", "error");
  } finally {
    setBtnLoading(btn, false, "✅ Update Password");
  }
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

    /* Attach fixed-position quick-preview — no overflow issues */
    attachServicePreview(card, service);

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

    const app      = service.applicationCharge || service.basePrice || 0;
    const official = service.officialCharge    || 0;
    const serv     = service.serviceCharge     || 0;

    el("modalTitle").innerText              = service.name;
    el("modalAppCharge").innerText          = app;
    el("modalServiceCharge").innerText      = serv;
    el("modalPrice").innerText              = service.finalPrice || (app + serv);

    // Official charge row — show only when > 0
    const offRow = el("officialChargeRow");
    if (official > 0) {
      el("modalOfficialCharge").innerText = official;
      if (offRow) offRow.style.display = "";
    } else {
      el("modalOfficialCharge").innerText = 0;
      if (offRow) offRow.style.display = "none";
    }

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
   INVOICE DOWNLOAD — Backend PDF (PDFKit)
   ─────────────────────────────────────────────────────────────
   Calls GET /api/orders/invoice/:id on the backend, which
   streams a branded PDFKit-generated invoice as a download.
   ============================================================ */
async function downloadInvoice(orderId) {
  toast("Preparing invoice...", "info");
  try {
    const res = await fetch(`${API}/orders/invoice/${orderId}`, { headers: authHeaders() });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return toast(e.message || "Invoice failed ❌", "error");
    }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `VermaEnterprises-Invoice-${orderId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Invoice error:", err);
    toast("Failed to download invoice ❌", "error");
  }
}

/* ============================================================
   PASSWORD STRENGTH HELPERS
   ─────────────────────────────────────────────────────────────
   Rule: min 6 chars, ≥1 uppercase, ≥1 digit, ≥1 special char
   Pattern example: Upper@123
   ============================================================ */
const PWD_PATTERN = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

/**
 * Returns { valid, strength, label }
 * strength: 0 = weak, 1 = medium, 2 = strong
 */
function evaluatePassword(pwd) {
  if (!pwd) return { valid: false, strength: -1, label: "" };

  const hasUpper   = /[A-Z]/.test(pwd);
  const hasLower   = /[a-z]/.test(pwd);
  const hasDigit   = /\d/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
  const longEnough = pwd.length >= 6;
  const valid      = hasUpper && hasDigit && hasSpecial && longEnough;

  /* Score */
  const score = [hasUpper, hasLower, hasDigit, hasSpecial, longEnough, pwd.length >= 10].filter(Boolean).length;

  let strength, label;
  if (score <= 2)      { strength = 0; label = "Weak"; }
  else if (score <= 4) { strength = 1; label = "Medium"; }
  else                 { strength = 2; label = "Strong"; }

  return { valid, strength, label };
}

/** Update the strength bar + message for the forgot-password modal */
function checkForgotPwdStrength(pwd) {
  _renderStrengthBar("forgotStrengthBar", "forgotStrengthMsg", pwd);
}

/** Update the strength bar + message for the profile modal */
function checkProfilePwdStrength(pwd) {
  _renderStrengthBar("profileStrengthBar", "profileStrengthMsg", pwd);
}

function _renderStrengthBar(barId, msgId, pwd) {
  const bar = el(barId);
  const msg = el(msgId);
  if (!bar && !msg) return;

  const { strength, label, valid } = evaluatePassword(pwd);

  if (!pwd) {
    if (bar) { bar.style.width = "0%"; bar.className = "pwd-strength-bar"; }
    if (msg) msg.textContent = "";
    return;
  }

  const widths = ["33%", "66%", "100%"];
  const classes = ["pwd-weak", "pwd-medium", "pwd-strong"];
  const colors  = ["#ef4444", "#f59e0b", "#22c55e"];

  if (bar) {
    bar.style.width      = widths[strength] || "33%";
    bar.style.background = colors[strength] || colors[0];
    bar.className        = "pwd-strength-bar";
  }

  const hints = [];
  if (!/[A-Z]/.test(pwd))       hints.push("uppercase letter");
  if (!/\d/.test(pwd))          hints.push("number");
  if (!/[^A-Za-z0-9]/.test(pwd)) hints.push("special character");
  if (pwd.length < 6)           hints.push("6+ characters");

  if (msg) {
    msg.textContent = valid
      ? `✅ ${label} password`
      : `⚠️ ${label} — add: ${hints.join(", ")}`;
    msg.style.color = valid ? "#22c55e" : (strength === 1 ? "#f59e0b" : "#ef4444");
  }
}


/* ============================================================
   FORGOT PASSWORD — User (NO OTP)
   ─────────────────────────────────────────────────────────────
   Verifies: registered name + identifier must match the account.
   Sends: POST /api/auth/reset-password
          body: { identifier, name, newPassword }
   ============================================================ */

function openForgotModal() {
  closeAdminForgot();
  closeLoginModal();
  /* Clear all fields on open */
  ["fpName","fpIdentifier","fpNewPassword","fpConfirmPassword"].forEach(id => {
    if (el(id)) el(id).value = "";
  });
  const bar = el("forgotStrengthBar");
  const msg = el("forgotStrengthMsg");
  if (bar) { bar.style.width = "0%"; }
  if (msg) msg.textContent = "";
  el("forgotBox")?.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

/* Legacy alias */
function showForgot() { openForgotModal(); }

function closeForgot() {
  el("forgotBox")?.classList.add("hidden");
  document.body.style.overflow = "";
}

async function userResetPassword() {
  const name        = el("fpName")?.value.trim()        || "";
  const identifier  = el("fpIdentifier")?.value.trim()  || "";
  const newPassword = el("fpNewPassword")?.value         || "";
  const confirm     = el("fpConfirmPassword")?.value     || "";
  const btn         = el("forgotResetBtn");

  /* Basic presence checks */
  if (!name)       return toast("Please enter your registered full name ❌", "warn");
  if (!identifier) return toast("Please enter your registered email or mobile ❌", "warn");

  /* Strong password validation */
  const { valid } = evaluatePassword(newPassword);
  if (!valid) return toast("Password must be ≥6 chars with uppercase, number & special character ❌", "warn");
  if (newPassword !== confirm) return toast("Passwords do not match ❌", "warn");

  setBtnLoading(btn, true);
  try {
    const res  = await fetch(`${API}/auth/reset-password`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ identifier, name, newPassword })
    });
    const data = await res.json();

    if (data.success) {
      toast("Password reset successfully ✅ Please sign in.", "success");
      closeForgot();
      openLoginModal();
    } else {
      /* Backend will return a message like "Name does not match our records" */
      toast(data.message || "Verification failed ❌", "error");
    }
  } catch {
    toast("Network error ❌", "error");
  } finally {
    setBtnLoading(btn, false, "Reset Password");
  }
}

/* Legacy alias */
async function resetPassword() { await userResetPassword(); }


/* ============================================================
   ADMIN FORGOT PASSWORD  (unchanged — OTP flow preserved)
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

/* ============================================================
   VISUAL / UX UPGRADES
   ─────────────────────────────────────────────────────────────
   1. Live hero stat counters  — fetchHeroStats()
   2. Page transitions         — patched into show* above
   3. Back-to-Top button       — auto-injected
   4. Service card quick-preview popup — attachServicePreview()
   ============================================================ */

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────────────────────── */

/*
  Services Done base — all completions before the live counter
  was introduced. Real completed count from backend is ADDED to
  this so the number grows with every new order completed.
  e.g. BASE(500) + backend(6) = 506+
*/
const SERVICES_BASE = 500;

/*
  Stats that are brand trust badges — never count-animated,
  always displayed exactly as written in HTML.
  Key = substring to match in .stat-label text content.
*/
const STATIC_STATS = ["verified", "support", "24/7"];


/* ─────────────────────────────────────────────────────────────
   1. LIVE HERO STAT COUNTERS
   ───────────────────────────────────────────────────────────── */

/**
 * Fetches GET /api/orders/stats (public — no token needed).
 * Finds the "Services Done" .stat-num by its sibling .stat-label text,
 * adds SERVICES_BASE to the real completed count, then animates.
 *
 * "100% Verified" and "24/7 Support" are static trust badges
 * and are left exactly as written in the HTML.
 */
async function fetchHeroStats() {
  try {
    const res  = await fetch(`${API}/orders/stats`);
    const data = await res.json();
    if (!data.success) return;

    const realCompleted = data.stats.completed || 0;
    const displayCount  = SERVICES_BASE + realCompleted;  // e.g. 500 + 6 = 506

    /* Find the "Services Done" stat element by label text */
    document.querySelectorAll(".hero-stat").forEach(stat => {
      const label = stat.querySelector(".stat-label");
      const num   = stat.querySelector(".stat-num");
      if (!label || !num) return;

      const labelText = label.textContent.toLowerCase();

      /* Skip static trust-badge stats — never animate these */
      if (STATIC_STATS.some(s => labelText.includes(s))) return;

      if (labelText.includes("done") || labelText.includes("services")) {
        /* Mark as handled so IntersectionObserver doesn't re-run it */
        num.dataset.counted = "1";
        /* Animate from 0 → displayCount with "+" suffix */
        countUpTo(num, displayCount, "+", 1600);
      }
    });

  } catch (err) {
    /* Silent — hardcoded fallback values in HTML remain visible */
    console.warn("fetchHeroStats: using fallback —", err.message);
  }
}

/**
 * Smooth count-up animation from 0 → target.
 * Uses ease-out cubic so it decelerates naturally.
 *
 * @param {HTMLElement} el        — the .stat-num element
 * @param {number}      target    — final number to land on
 * @param {string}      suffix    — appended after number e.g. "+" or "%"
 * @param {number}      duration  — animation length in ms
 */
function countUpTo(el, target, suffix = "", duration = 1600) {
  if (!el) return;
  const startTime = performance.now();

  function step(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    /* Ease-out cubic */
    const eased    = 1 - Math.pow(1 - progress, 3);
    const current  = Math.round(eased * target);

    el.textContent = current + suffix;

    /* Micro pop scale on each tick */
    el.classList.add("counting");
    setTimeout(() => el.classList.remove("counting"), 80);

    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target + suffix; /* lock exact final value */
  }

  requestAnimationFrame(step);
}

/**
 * Parses a .stat-num element's existing text and runs countUpTo.
 * Used by IntersectionObserver for hardcoded stats like "100%".
 *
 * CRITICAL FIX — "24/7":
 *   raw = "24/7", suffix = "/7", target = 24
 *   We detect the slash and skip animation entirely, leaving
 *   the text exactly as "24/7" in the HTML.
 */
function countUpElement(el, duration = 1400) {
  if (!el || el.dataset.counted) return;

  const raw    = el.textContent.trim();     /* e.g. "500+", "100%", "24/7" */
  const suffix = raw.replace(/[\d,.]/g, ""); /* "+", "%", "/7" */

  /* ── FIX: skip any stat that contains a slash — it's a ratio like 24/7 ── */
  if (raw.includes("/")) {
    el.dataset.counted = "1"; /* mark as done so observer detaches */
    return;                   /* leave "24/7" exactly as written    */
  }

  const target = parseFloat(raw.replace(/[^0-9.]/g, "")) || 0;
  if (!target) { el.dataset.counted = "1"; return; }

  el.dataset.counted = "1";
  countUpTo(el, target, suffix, duration);
}

/**
 * IntersectionObserver — triggers countUpElement when a .stat-num
 * enters the viewport for the first time.
 * fetchHeroStats() pre-marks "Services Done" with dataset.counted="1"
 * so the observer skips it (already animated with the live value).
 */
function initStatCounters() {
  const stats = document.querySelectorAll(".stat-num");
  if (!stats.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        countUpElement(entry.target);
        observer.unobserve(entry.target); /* fire once then detach */
      }
    });
  }, { threshold: 0.6 });

  stats.forEach(s => observer.observe(s));
}

/* Boot counters on DOM ready */
document.addEventListener("DOMContentLoaded", initStatCounters);


/* ─────────────────────────────────────────────────────────────
   3. BACK-TO-TOP BUTTON
   ───────────────────────────────────────────────────────────── */
(function initBackToTop() {
  if (document.getElementById("backToTopBtn")) return;

  const btn = document.createElement("button");
  btn.id        = "backToTopBtn";
  btn.innerHTML = "↑";
  btn.setAttribute("aria-label", "Back to top");
  btn.title     = "Back to top";
  btn.onclick   = () => window.scrollTo({ top: 0, behavior: "smooth" });
  document.body.appendChild(btn);

  /* Throttled scroll — show after 400 px */
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      btn.classList.toggle("btt-visible", window.scrollY > 400);
      ticking = false;
    });
  }, { passive: true });
})();


/* ─────────────────────────────────────────────────────────────
   4. SERVICE CARD QUICK-PREVIEW POPUP
   ─────────────────────────────────────────────────────────────
   Uses position:fixed + getBoundingClientRect() — completely
   immune to overflow, clip, scroll containers, z-index issues.
   One shared element is reused across all cards.
   ───────────────────────────────────────────────────────────── */

let _previewEl      = null;  /* single shared DOM node          */
let _previewTimer   = null;  /* hide-delay handle               */
let _previewVisible = false; /* track visibility for scroll fix */

/** Lazily create the shared popup and attach it to <body> */
function _getPreviewEl() {
  if (!_previewEl) {
    _previewEl = document.createElement("div");
    _previewEl.className = "svc-preview";
    _previewEl.addEventListener("mousedown", e => e.stopPropagation());
    document.body.appendChild(_previewEl);
  }
  return _previewEl;
}

/**
 * Populate popup content and reposition it over the card.
 * @param {HTMLElement} card     — hovered service card
 * @param {Object}      service  — service data object
 */
function _showPreview(card, service) {
  clearTimeout(_previewTimer);

  const popup = _getPreviewEl();
  const total = service.finalPrice || service.basePrice || 0;
  const docs  = (service.documents || []).slice(0, 5);

  popup.innerHTML = `
    <div class="svc-preview__name">${service.name}</div>
    <div class="svc-preview__price">₹${total}</div>
    ${docs.length ? `
      <div class="svc-preview__docs-label">Required Documents</div>
      <div class="svc-preview__docs">
        ${docs.map(d => `<span class="svc-preview__doc">${d}</span>`).join("")}
        ${(service.documents?.length || 0) > 5
          ? `<span class="svc-preview__doc">+${service.documents.length - 5} more</span>`
          : ""}
      </div>` : ""}
    <div class="svc-preview__hint">👆 Click to apply</div>
  `;

  _repositionPreview(card, popup);
  popup.classList.add("visible");
  _previewVisible = true;
}

/**
 * Calculate viewport-relative coordinates.
 * Prefers ABOVE the card; falls back to BELOW if not enough room.
 */
function _repositionPreview(card, popup) {
  /* Temporarily render off-screen to measure size */
  popup.style.visibility = "hidden";
  popup.style.position   = "fixed";
  popup.style.left       = "-9999px";
  popup.style.top        = "-9999px";

  const cardRect = card.getBoundingClientRect();
  const popupW   = popup.offsetWidth  || 240;
  const popupH   = popup.offsetHeight || 180;
  const viewW    = window.innerWidth;
  const viewH    = window.innerHeight;
  const GAP      = 10;

  /* Horizontal: centre over card, clamp to viewport edges */
  let left = cardRect.left + cardRect.width / 2 - popupW / 2;
  left = Math.max(8, Math.min(left, viewW - popupW - 8));

  /* Vertical: above if space, else below */
  let top;
  const spaceAbove = cardRect.top;
  const spaceBelow = viewH - cardRect.bottom;

  if (spaceAbove >= popupH + GAP) {
    top = cardRect.top - popupH - GAP;
    popup.dataset.arrow = "down";
  } else if (spaceBelow >= popupH + GAP) {
    top = cardRect.bottom + GAP;
    popup.dataset.arrow = "up";
  } else {
    /* Tight — pick whichever side has more room */
    top = spaceAbove > spaceBelow
      ? Math.max(8, cardRect.top - popupH - GAP)
      : Math.min(cardRect.bottom + GAP, viewH - popupH - 8);
    popup.dataset.arrow = spaceAbove > spaceBelow ? "down" : "up";
  }

  popup.style.left       = left + "px";
  popup.style.top        = top  + "px";
  popup.style.visibility = "";
}

/**
 * Hide popup after a short delay.
 * The delay lets the cursor move from card edge → popup without flicker.
 */
function _hidePreview() {
  _previewTimer = setTimeout(() => {
    if (_previewEl) {
      _previewEl.classList.remove("visible");
      _previewVisible = false;
    }
  }, 100);
}

/** Cancel hide if cursor returns */
function _cancelHide() { clearTimeout(_previewTimer); }

/**
 * Attach hover and keyboard listeners to a service card.
 * Touch devices are skipped — tap directly opens the modal.
 * @param {HTMLElement} card
 * @param {Object}      service
 */
function attachServicePreview(card, service) {
  /* Skip on touch-primary devices */
  if (window.matchMedia("(hover: none)").matches) return;

  card.addEventListener("mouseenter", () => _showPreview(card, service));
  card.addEventListener("mouseleave", _hidePreview);

  /* Keep popup alive when cursor moves onto it */
  const popup = _getPreviewEl();
  popup.addEventListener("mouseenter", _cancelHide);
  popup.addEventListener("mouseleave", _hidePreview);

  /* Keyboard accessibility */
  card.setAttribute("tabindex", "0");
  card.addEventListener("focus", () => _showPreview(card, service));
  card.addEventListener("blur",  _hidePreview);
}

/* Reposition popup on scroll/resize so it doesn't drift */
window.addEventListener("scroll", () => {
  if (!_previewVisible || !_previewEl) return;
  const hovered = document.querySelector(".service-card:hover");
  if (hovered) _repositionPreview(hovered, _previewEl);
  else         _hidePreview();
}, { passive: true });

window.addEventListener("resize", () => {
  if (!_previewVisible || !_previewEl) return;
  const hovered = document.querySelector(".service-card:hover");
  if (hovered) _repositionPreview(hovered, _previewEl);
  else         _hidePreview();
}, { passive: true });