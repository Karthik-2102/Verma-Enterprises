const API     = "https://verma-enterprises-backend.onrender.com/api";
const BACKEND = "https://verma-enterprises-backend.onrender.com";

/* =============================================
   INIT
   ============================================= */
document.addEventListener("DOMContentLoaded", initApp);

function initApp() {

    window.history.pushState(
        null,
        null,
        window.location.href
    );

    window.onpopstate =
    function () {

        const token =
        sessionStorage.getItem(
            "token"
        );

        if (!token) {

            location.replace(
                "index.html"
            );

        }

    };

    hideUserSections();

    const token =
    sessionStorage.getItem(
        "token"
    );

    if (token) {

        enterSite();

    }

}

function hideUserSections() {
    const mainPage = document.getElementById("mainPage");
    const orders   = document.getElementById("ordersSection");
    if (mainPage) mainPage.classList.add("hidden");
    if (orders)   orders.classList.add("hidden");
}

/* =============================================
   UTILITIES
   ============================================= */
function getToken()  { return sessionStorage.getItem("token"); }

function decodeToken(token) {
    try { return JSON.parse(atob(token.split(".")[1])); }
    catch { return null; }
}

function authHeaders() { return { Authorization: getToken() }; }
function jsonHeaders()  { return { "Content-Type": "application/json" }; }

/* =============================================
   AUTH — FLIP CARD
   ============================================= */
function flip() {
    document.getElementById("authCard")?.classList.toggle("flip");
}

function togglePass(inputId, el) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
    el.style.opacity = input.type === "text" ? "1" : "0.5";
}

/* =============================================
   OTP
   ============================================= */
async function sendOTP(type) {
    const id = type === "signup" ? "signupIdentifier" : "fpIdentifier";
    const identifier = document.getElementById(id)?.value?.trim() || "";

    if (!identifier) return alert("Please enter email or mobile ❌");

    try {
        const res  = await fetch(`${API}/otp/send-otp`, {
            method: "POST", headers: jsonHeaders(),
            body: JSON.stringify({ identifier })
        });
        const data = await res.json();
        alert(data.message || "OTP sent ✅");
    } catch { alert("Failed to send OTP ❌"); }
}

/* =============================================
   REGISTER
   ============================================= */
async function register() {
    const name       = document.getElementById("name").value.trim();
    const identifier = document.getElementById("signupIdentifier").value.trim();
    const password   = document.getElementById("signupPassword").value;

    if (!name || !identifier || !password)
        return alert("Please fill all fields ❌");

    const isEmail  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const isMobile = /^[6-9]\d{9}$/.test(identifier);

    if (!isEmail && !isMobile)
        return alert("Enter a valid email or 10-digit mobile number ❌");

    const res  = await fetch(`${API}/auth/register`, {
        method: "POST", headers: jsonHeaders(),
        body: JSON.stringify({ name, identifier, password })
    });
    const data = await res.json();

    if (data.success) { alert("Registered successfully ✅"); flip(); }
    else alert(data.message || "Registration failed ❌");
}

/* =============================================
   LOGIN
   ============================================= */
async function login() {
    const identifier = document.getElementById("loginIdentifier")?.value?.trim() || "";
    const password   = document.getElementById("loginPassword")?.value || "";

    if (!identifier || !password) return alert("Please fill all fields ❌");

    const res  = await fetch(`${API}/auth/login`, {
        method: "POST", headers: jsonHeaders(),
        body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();

    if (!data.success) return alert(data.message || "Login failed ❌");

    sessionStorage.setItem("token", data.token);
    enterSite();
}

/* =============================================
   FORGOT PASSWORD
   ============================================= */
function showForgot() {
    closeAdminForgot();
    document.getElementById("forgotBox").classList.remove("hidden");
}
function closeForgot() {
    document.getElementById("forgotBox").classList.add("hidden");
}

async function resetPassword() {
    const identifier  = document.getElementById("fpIdentifier").value.trim();
    const newPassword = document.getElementById("newPassword").value;

    if (!identifier || !newPassword) return alert("Please fill all fields ❌");

    const res  = await fetch(`${API}/auth/reset-password`, {
        method: "POST", headers: jsonHeaders(),
        body: JSON.stringify({ identifier, newPassword })
    });
    const data = await res.json();

    if (data.success) { alert("Password updated ✅"); closeForgot(); }
    else alert(data.message || "Reset failed ❌");
}

/* =============================================
   ENTER SITE
   ============================================= */
function enterSite() {
    const token = getToken();
    if (!token) return;

    const user = decodeToken(token);
    if (user?.role === "admin") { location.href = "admin.html"; return; }

    document.getElementById("authPage").classList.add("hidden");
    document.getElementById("mainPage").classList.remove("hidden");
    document.getElementById("ordersSection").classList.remove("hidden");

    loadServices();
    loadUserOrders();
    loadProfile();
}

function logout() {
    sessionStorage.removeItem("token");
    location.href = "index.html";
}

/* =============================================
   SIDEBAR
   ============================================= */
function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("active");
    document.getElementById("overlay").classList.toggle("active");
}

/* =============================================
   SERVICES
   ============================================= */
let currentServiceId      = null;
let allUserServices       = [];
let activeUserCategory    = "all";
let searchSuggestionIndex = -1;
let suggestionTimer       = null;

const SERVICE_CATEGORIES = [
    "Government Services",
    "Education Services",
    "Printing Services",
    "ID Card Services",
    "Pension & Welfare Services"
];

async function loadServices() {
    try {
        const res  = await fetch(`${API}/services`);
        allUserServices = await res.json();
        if (!Array.isArray(allUserServices)) allUserServices = [];
        buildCategoryTabs();
        renderUserServices();
    } catch (err) {
        console.error("Failed to load services:", err);
    }
}

function buildCategoryTabs() {
    const tabsEl = document.getElementById("categoryTabs");
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

function filterByCategory(cat, el) {
    activeUserCategory = cat;
    document.querySelectorAll(".cat-tab").forEach(t => t.classList.remove("active"));
    if (el) el.classList.add("active");

    const inp = document.getElementById("userSearchInput");
    if (inp) inp.value = "";
    hideSuggestions();
    renderUserServices();
}

function renderUserServices() {
    const searchVal = (document.getElementById("userSearchInput")?.value || "").toLowerCase().trim();
    const grid      = document.getElementById("services");
    if (!grid) return;
    grid.innerHTML  = "";

    const namesEl = document.getElementById("serviceNames");
    if (namesEl) namesEl.innerHTML = "";

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

/* =============================================
   SMART SEARCH SUGGESTIONS
   ============================================= */
function handleSearchInput(value) {
    clearTimeout(suggestionTimer);
    suggestionTimer = setTimeout(() => {
        buildSuggestions(value.trim());
        renderUserServices();
    }, 120);
}

function buildSuggestions(query) {
    const box = document.getElementById("searchSuggestions");
    if (!box) return;

    if (!query || query.length < 2) {
        hideSuggestions(); return;
    }

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
    const input = document.getElementById("userSearchInput");
    if (input) input.value = name;
    hideSuggestions();
    renderUserServices();
}

function showSuggestions() {
    const inp = document.getElementById("userSearchInput");
    if (inp?.value.trim().length >= 2) buildSuggestions(inp.value.trim());
}

function hideSuggestions() {
    const box = document.getElementById("searchSuggestions");
    if (box) { box.classList.remove("visible"); box.innerHTML = ""; }
    searchSuggestionIndex = -1;
}

function hideSuggestionsDelay() { setTimeout(hideSuggestions, 200); }

function handleSearchKeydown(e) {
    const box   = document.getElementById("searchSuggestions");
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

/* =============================================
   SERVICE MODAL
   ============================================= */
async function openService(id) {
    currentServiceId = id;
    const res     = await fetch(`${API}/services/${id}`);
    const service = await res.json();

    document.getElementById("modalTitle").innerText      = service.name;
    const app  = service.applicationCharge || service.basePrice || 0;
    const serv = service.serviceCharge || 0;
    document.getElementById("modalAppCharge").innerText     = app;
    document.getElementById("modalServiceCharge").innerText = serv;
    document.getElementById("modalPrice").innerText         = service.finalPrice || (app + serv);
    document.getElementById("modalDocs").innerHTML =
        (service.documents || []).map(d => `<li>${d}</li>`).join("");
    document.getElementById("serviceModal").classList.remove("hidden");
}

function closeModal() { document.getElementById("serviceModal").classList.add("hidden"); }

/* =============================================
   ORDER SUBMISSION
   ============================================= */
async function submitService() {

    if (!currentServiceId) {

        alert(
            "Please select a service ❌"
        );

        return;

    }

    const fileInput =
    document.getElementById(
        "fileUpload"
    );

    if (
        !fileInput ||
        !fileInput.files ||
        !fileInput.files.length
    ) {

        alert(
            "Please upload documents ❌"
        );

        return;

    }

    const formData =
    new FormData();

    formData.append(
        "serviceId",
        currentServiceId
    );

    Array.from(
        fileInput.files
    ).forEach(file => {

        formData.append(
            "documents",
            file
        );

    });

    try {

        const response =
        await fetch(

            `${API}/orders/create`,

            {
                method: "POST",

                headers: {
                    Authorization:
                    getToken()
                },

                body:
                formData
            }

        );

        const rawResponse =
        await response.text();

        let data;

        try {

            data =
            JSON.parse(
                rawResponse
            );

        }

        catch {

            console.error(
                "User Upload Raw Response:",
                rawResponse
            );

            alert(
                "Backend returned invalid response ❌"
            );

            return;

        }

        if (data.success) {

            alert(
                "Order placed successfully ✅"
            );

            closeModal();

            loadUserOrders();

            return;

        }

        alert(
            data.message ||
            "Upload failed ❌"
        );

    }

    catch (error) {

        console.error(
            "User Upload Error:",
            error
        );

        alert(
            "Upload failed ❌"
        );

    }

}

/* =============================================
   USER ORDERS + TIMELINE
   ============================================= */
const TIMELINE_STAGES = [
    "Order Placed", "Documents Verified", "Processing",
    "Ready for Delivery", "Completed"
];

async function loadUserOrders() {
    const res  = await fetch(`${API}/orders/my-orders`, { headers: authHeaders() });
    const data = await res.json();
    const box  = document.getElementById("userOrders");
    if (!box) return;
    box.innerHTML = "";

    const orders = data.orders || [];
    if (!orders.length) { box.innerHTML = "<p style='opacity:.6;padding:20px;'>No orders yet.</p>"; return; }

    orders.forEach(order => {
        let badgeColor = "#ffc107", statusText = "Pending";
        if (order.status === "completed") { badgeColor = "#28a745"; statusText = "Completed"; }
        if (order.status === "rejected")  { badgeColor = "#dc3545"; statusText = "Rejected"; }

        /* File URL — Cloudinary returns full https URL; legacy path needs BACKEND prefix */
        const fw = order.finalWorkFile || "";
        const fwRaw = fw.startsWith("http") ? fw : fw ? `${BACKEND}/${fw}` : "";

        /* Always use direct Cloudinary URL */
        const fwView = fwRaw;
        const fwHref = fwRaw;

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
                    <a class="user-file-btn"
                    href="${fwView}"
                    target="_blank"
                    rel="noopener noreferrer">
                    👁 View Final Work
                    </a>

                    <a class="user-file-btn"
                    href="${fwHref}"
                    download
                    target="_blank"
                    rel="noopener noreferrer">
                    📥 Download
                    </a>
                ` : ""}
                ${order.status === "completed" ? `<button class="invoice-btn" onclick="downloadInvoice('${order._id}')">Invoice</button>` : ""}
            </div>
        `;
        box.appendChild(card);
    });
}

function buildTimelineHTML(order) {
    if (order.status === "rejected") {
        return `
        <div class="order-timeline">
            <div style="font-size:12px;opacity:.6;margin-bottom:6px;">Order Status</div>
            <div style="display:flex;align-items:center;gap:8px;">
                <div class="tl-dot rejected"></div>
                <span style="font-size:12px;color:#dc3545;font-weight:700;">Order Rejected</span>
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
            <div class="tl-dot ${done?"done":active?"active":""}"></div>
            <div class="tl-label ${done?"done":active?"active":""}">${s}</div>
        </div>`;
        if (i < TIMELINE_STAGES.length - 1)
            html += `<div class="tl-connector ${done?"done":""}"></div>`;
    });

    return html + `</div></div>`;
}

/* =============================================
   INVOICE
   ============================================= */
async function downloadInvoice(id) {
    try {
        const res = await fetch(`${API}/orders/invoice/${id}`, { headers: authHeaders() });
        if (!res.ok) { const e = await res.json().catch(()=>({})); return alert(e.message || "Invoice failed ❌"); }
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url; a.download = `Verma-Invoice-${id}.pdf`; a.click();
        URL.revokeObjectURL(url);
    } catch { alert("Failed to download invoice ❌"); }
}

/* =============================================
   PROFILE
   ============================================= */
async function loadProfile() {
    const res  = await fetch(`${API}/auth/me`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success) return;

    const u = data.user, letter = (u.name || "U").charAt(0).toUpperCase();
    const el = id => document.getElementById(id);

    el("profileName")       && (el("profileName").value       = u.name);
    el("profileIdentifier") && (el("profileIdentifier").value = u.identifier);
    el("welcomeText")       && (el("welcomeText").innerText   = "Welcome, " + u.name);
    el("avatarText")        && (el("avatarText").innerText    = letter);
    el("sidebarAvatar")     && (el("sidebarAvatar").innerText = letter);
}

async function updateProfile() {
    const pass    = document.getElementById("profilePassword").value;
    const confirm = document.getElementById("confirmPassword").value;
    if (pass.length < 4) return alert("Password must be at least 4 characters");
    if (pass !== confirm)  return alert("Passwords do not match");

    const res  = await fetch(`${API}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: getToken() },
        body: JSON.stringify({ newPassword: pass })
    });
    const data = await res.json();
    alert(data.message);
    if (data.success) {
        closeProfileModal();
        document.getElementById("profilePassword").value = "";
        document.getElementById("confirmPassword").value = "";
    }
}

function toggleProfileMenu() { document.getElementById("profileMenu").classList.toggle("hidden"); }
function openProfileModal()  { document.getElementById("profileModal").classList.remove("hidden"); toggleProfileMenu(); }
function closeProfileModal() { document.getElementById("profileModal").classList.add("hidden"); }

function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    if (window.innerWidth <= 1024) {
        document.getElementById("sidebar")?.classList.remove("active");
        document.getElementById("overlay")?.classList.remove("active");
    }
}
/* =============================================
   ADMIN FORGOT PASSWORD
   ============================================= */
/* =============================================
   ADMIN FORGOT PASSWORD
   ============================================= */
function showAdminReset() {
    closeForgot();
    document.getElementById("adminForgotBox").classList.remove("hidden");
}

function closeAdminForgot() {
    const box = document.getElementById("adminForgotBox");
    if (box) box.classList.add("hidden");
    const id  = document.getElementById("adminFpIdentifier");
    const otp = document.getElementById("adminFpOtp");
    const pw  = document.getElementById("adminFpNewPassword");
    if (id)  id.value  = "";
    if (otp) otp.value = "";
    if (pw)  pw.value  = "";
}

async function sendAdminForgotOtp() {
    const identifier = document.getElementById("adminFpIdentifier").value.trim();
    if (!identifier) return alert("Please enter admin email ❌");

    try {
        const res  = await fetch(`${API}/auth/admin-forgot-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier })
        });
        const data = await res.json();
        alert(data.message);
    } catch (err) {
        alert("Network error ❌");
    }
}

async function resetAdminPassword() {
    const identifier  = document.getElementById("adminFpIdentifier").value.trim();
    const otp         = document.getElementById("adminFpOtp").value.trim();
    const newPassword = document.getElementById("adminFpNewPassword").value;

    if (!identifier)  return alert("Please enter admin email ❌");
    if (!otp)         return alert("Please enter OTP first ❌");
    if (!newPassword) return alert("Please enter new password ❌");

    try {
        const res  = await fetch(`${API}/auth/admin-forgot-reset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier, otp, newPassword })
        });
        const data = await res.json();
        alert(data.message);
        if (data.success) closeAdminForgot();
    } catch (err) {
        alert("Network error ❌");
    }
}