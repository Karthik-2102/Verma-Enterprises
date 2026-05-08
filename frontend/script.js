const API =
"https://verma-enterprises-backend.onrender.com/api";

/* =====================================
INIT
===================================== */
document.addEventListener(
    "DOMContentLoaded", 
    initApp
);

function initApp() {
    hideUserSections();

    const token = localStorage.getItem("token");

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

/* =====================================
UTILS
===================================== */
function getToken() {
    return localStorage.getItem("token");
}

function decodeToken(token) {
    try {
        return JSON.parse(atob(token.split(".")[1]));
    } catch {
        return null;
    }
}

function authHeaders() {
    return { Authorization: getToken() };
}

function jsonHeaders() {
    return { "Content-Type": "application/json" };
}

/* =====================================
TAB SWITCH / FLIP CARD
===================================== */
function flip() {
    const card = document.getElementById("authCard");
    if (card) card.classList.toggle("flip");
}
/* =====================================
AUTH
===================================== */
function switchTab(tab) {
    const loginPanel    = document.getElementById("panelLogin");
    const registerPanel = document.getElementById("panelRegister");
    const tabLogin      = document.getElementById("tabLogin");
    const tabRegister   = document.getElementById("tabRegister");

    if (!loginPanel) return;

    if (tab === 'login') {
        loginPanel.classList.remove("hidden");
        registerPanel.classList.add("hidden");
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
    } else {
        registerPanel.classList.remove("hidden");
        loginPanel.classList.add("hidden");
        tabRegister.classList.add("active");
        tabLogin.classList.remove("active");
    }
}

function togglePass(inputId, el) {
    const input = document.getElementById(inputId);
    if (input.type === "password") {
        input.type = "text";
        el.style.opacity = "1";
    } else {
        input.type = "password";
        el.style.opacity = "0.5";
    }
}
async function sendOTP(type){

    let identifier = "";

    if(type === "signup"){

        identifier =
        document.getElementById("signupIdentifier")
        .value.trim().toLowerCase()

    }

    if(type === "forgot"){

        identifier =
        document.getElementById("fpIdentifier")
        ?.value
        ?.trim() || "";

    }

    if(!identifier){

        return alert(
            "Please enter email or mobile ❌"
        );

    }

    try{

        const res = await fetch(
            `${API}/otp/send-otp`,
            {

                method:"POST",

                headers: jsonHeaders(),

                body: JSON.stringify({
                    identifier
                })

            }
        );

        const data = await res.json();

        alert(
            data.message ||
            "OTP sent successfully ✅"
        );

    }catch(error){

        console.log(error);

        alert(
            "Failed to send OTP ❌"
        );

    }

}

/* =====================================
REGISTER
===================================== */
async function register() {

    const name =
    document.getElementById("name").value.trim();
    const identifier =
    document
    .getElementById(
        "signupIdentifier"
    )
    .value
    .trim()
    .toLowerCase();

    const password =
    document.getElementById("signupPassword").value;

    const otp =
    document.getElementById("signupOtp").value.trim();

    if(!name || !identifier || !password || !otp){
        return alert("Please fill all fields ❌");
    }

    const res = await fetch(`${API}/auth/register`, {

        method:"POST",

        headers: jsonHeaders(),

        body: JSON.stringify({
            name,
            identifier,
            password,
            otp
        })

    });

    const data = await res.json();

    if(data.success){

        alert("Registered successfully ✅");

        flip();

    }else{

        alert(data.message || "Registration failed ❌");

    }
}

/* =====================================
LOGIN
===================================== */
async function login() {

    const payload = {

        identifier:
        document
        .getElementById(
            "loginIdentifier"
        )
        .value.trim().toLowerCase(),

        password:
        document
        .getElementById(
            "loginPassword"
        )
        ?.value
        ?.trim()

    };

    const res = await fetch(
        `${API}/auth/login`,
        {
            method: "POST",
            headers: jsonHeaders(),
            body: JSON.stringify(
                payload
            )
        }
    );

    const data =
    await res.json();

    if (!data.success) {

        return alert(
            data.message ||
            "Login failed ❌"
        );

    }

    localStorage.setItem(
        "token",
        data.token
    );

    enterSite();

}

/* =====================================
FORGOT PASSWORD
===================================== */
function showForgot() {
    document.getElementById("forgotBox").classList.remove("hidden");
}

function closeForgot() {
    document.getElementById("forgotBox").classList.add("hidden");
    _firebaseConfirmResult = null;
}

async function resetPassword(){

    const identifier =
    document.getElementById("fpIdentifier").value.trim().toLowerCase();

    const otp =
    document.getElementById("fpOtp").value.trim();

    const newPassword =
    document.getElementById("newPassword").value;

    if(!identifier || !otp || !newPassword){
        return alert("Please fill all fields ❌");
    }

    const res = await fetch(`${API}/auth/reset-password`, {

        method:"POST",

        headers: jsonHeaders(),

        body: JSON.stringify({
            identifier,
            otp,
            newPassword
        })

    });

    const data = await res.json();

    if(data.success){

        alert("Password updated ✅");

        closeForgot();

    }else{

        alert(data.message || "Reset failed ❌");

    }
}
/* =====================================
ENTER SITE
===================================== */
function enterSite() {
    const token = getToken();
    if (!token) return;

    const user = decodeToken(token);

    if (user && user.role === "admin") {
        location.href = "admin.html";
        return;
    }

    document.getElementById("authPage").classList.add("hidden");
    document.getElementById("mainPage").classList.remove("hidden");
    document.getElementById("ordersSection").classList.remove("hidden");

    loadServices();

    loadUserOrders();

    loadProfile();

    setupUserSuggestions();
}

/* =====================================
LOGOUT
===================================== */
function logout() {
    localStorage.removeItem("token");
    location.href = "index.html";
}

/* =====================================
SIDEBAR
===================================== */
function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("active");
    document.getElementById("overlay").classList.toggle("active");
}

/* =====================================
SERVICES + CATEGORY FILTER + SEARCH
===================================== */
let currentServiceId  = null;
let allUserServices   = [];
let activeUserCategory = "all";

const SERVICE_CATEGORIES = [
    "Government Services",
    "Education Services",
    "Printing Services",
    "ID Card Services",
    "Banking Services"
];
const USER_SEARCH_SUGGESTIONS = [

    "PAN Card",

    "PAN Correction",

    "PAN Reprint",

    "Aadhar Update",

    "Passport",

    "Voter ID",

    "Income Certificate"

];

async function loadServices() {

    const res  = await fetch(`${API}/services`);
    const data = await res.json();

    allUserServices = data;

    buildCategoryTabs();
    renderUserServices();
}

function buildCategoryTabs() {

    const tabsEl = document.getElementById("categoryTabs");
    if (!tabsEl) return;

    // Get categories that actually have services
    const activeCats = new Set(allUserServices.map(s => s.category || "Government Services"));

    let html = `<button class="cat-tab active" data-cat="all" onclick="filterByCategory('all',this)">All</button>`;

    SERVICE_CATEGORIES.forEach(cat => {
        if (activeCats.has(cat)) {
            const shortName = cat.replace(" Services", "");
            html += `<button class="cat-tab" data-cat="${cat}" onclick="filterByCategory('${cat}',this)">${shortName}</button>`;
        }
    });

    tabsEl.innerHTML = html;
}

function filterByCategory(cat, el) {
    activeUserCategory = cat;

    // Update tab active state
    document.querySelectorAll(".cat-tab").forEach(t => t.classList.remove("active"));
    if (el) el.classList.add("active");

    renderUserServices();
}

function filterUserServices() {
    renderUserServices();
}

function getUserSuggestions(
    keyword
) {

    if (!keyword.trim()) {
        return [];
    }

    return USER_SEARCH_SUGGESTIONS
    .filter(item =>

        item
        .toLowerCase()
        .includes(
            keyword.toLowerCase()
        )

    );

}

function renderUserSuggestions(
    suggestions
) {

    let dropdown =
    document.getElementById(
        "userSuggestionBox"
    );

    if (!dropdown) {

        dropdown =
        document.createElement(
            "div"
        );

        dropdown.id =
        "userSuggestionBox";

        dropdown.style.cssText = `
            position:absolute;
            width:100%;
            max-height:250px;
            overflow-y:auto;
            background:#1A2C37;
            border:1px solid rgba(153,186,187,.2);
            border-radius:12px;
            z-index:999;
            margin-top:8px;
        `;

        const input =
        document.getElementById(
            "userSearchInput"
        );

        input.parentNode.appendChild(
            dropdown
        );

    }

    dropdown.innerHTML = "";

    if (!suggestions.length) {

        dropdown.style.display =
        "none";

        return;

    }

    dropdown.style.display =
    "block";

    suggestions.forEach(item => {

        const option =
        document.createElement(
            "div"
        );

        option.style.cssText = `
            padding:12px 16px;
            cursor:pointer;
            color:#fff;
            border-bottom:1px solid rgba(255,255,255,.05);
        `;

        option.innerText =
        item;

        option.onclick = () => {

            document.getElementById(
                "userSearchInput"
            ).value = item;

            dropdown.style.display =
            "none";

            renderUserServices();

        };

        dropdown.appendChild(
            option
        );

    });

}

function setupUserSuggestions() {

    const input =
    document.getElementById(
        "userSearchInput"
    );

    if (!input) return;

    input.addEventListener(
        "input",
        function(){

            const matches =
            getUserSuggestions(
                this.value
            );

            renderUserSuggestions(
                matches
            );

        }
    );

}

function renderUserServices() {

    const searchVal = (document.getElementById("userSearchInput")?.value || "").toLowerCase().trim();
    const grid = document.getElementById("services");
    const names = document.getElementById("serviceNames");

    grid.innerHTML  = "";
    if (names) names.innerHTML = "";

    let filtered = allUserServices;

    // Category filter
    if (activeUserCategory !== "all") {
        filtered = filtered.filter(s =>
            (s.category || "Government Services") === activeUserCategory
        );
    }

    // Keyword search (name, category, documents)
    if (searchVal) {
        filtered = filtered.filter(s => {
            const haystack = [
                s.name,
                s.category || "",
                ...(s.documents || [])
            ].join(" ").toLowerCase();
            return haystack.includes(searchVal);
        });
    }

    if (!filtered.length) {
        grid.innerHTML = `<p style="opacity:.6;padding:20px;">No services found for "${searchVal || activeUserCategory}".</p>`;
        return;
    }

    filtered.forEach(service => {
        const total = service.finalPrice || service.basePrice || 0;
        const cat   = service.category || "Government Services";

        grid.innerHTML += `
        <div class="service-card" onclick="openService('${service._id}')">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;">
                <h3 style="margin:0;font-size:18px;">${service.name}</h3>
                <span style="
                    background:rgba(153,186,187,.12);
                    border:1px solid rgba(153,186,187,.22);
                    color:#99BABB;
                    padding:3px 9px;
                    border-radius:999px;
                    font-size:10px;
                    font-weight:800;
                    white-space:nowrap;
                    flex-shrink:0;
                ">${cat.replace(" Services","")}</span>
            </div>
            <p class="service-price">₹${total}</p>
        </div>
        `;
    });
}

async function openService(id) {

    currentServiceId = id;

    const res     = await fetch(`${API}/services/${id}`);
    const service = await res.json();

    document.getElementById("modalTitle").innerText = service.name;

    const appCharge  = service.applicationCharge || service.basePrice || 0;
    const servCharge = service.serviceCharge || 0;
    const total      = service.finalPrice || (appCharge + servCharge);

    document.getElementById("modalAppCharge").innerText    = appCharge;
    document.getElementById("modalServiceCharge").innerText = servCharge;
    document.getElementById("modalPrice").innerText         = total;

    document.getElementById("modalDocs").innerHTML =
        (service.documents || []).map(doc => `<li>${doc}</li>`).join("");

    document.getElementById("serviceModal").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("serviceModal").classList.add("hidden");
}

/* =====================================
SUBMIT ORDER
===================================== */
async function submitService() {

    const files    = document.getElementById("fileUpload").files;
    const formData = new FormData();

    formData.append("serviceId", currentServiceId);

    for (let file of files) {
        formData.append("documents", file);
    }

    const res = await fetch(`${API}/orders/create`, {
        method: "POST",
        headers: authHeaders(),
        body: formData
    });

    const data = await res.json();

    if (data.success) {
        alert("Service submitted ✅");
        loadUserOrders();
        closeModal();
    } else {
        alert(data.message || "Failed ❌");
    }
}

/* =====================================
USER ORDERS
===================================== */
async function loadUserOrders() {

    const res  = await fetch(`${API}/orders/my-orders`, { headers: authHeaders() });
    const data = await res.json();
    const box  = document.getElementById("userOrders");

    box.innerHTML = "";

    const orders = data.orders || [];

    if (!orders.length) {
        box.innerHTML = "<p style='opacity:.6;padding:20px;'>No orders yet.</p>";
        return;
    }

    orders.forEach(order => {

        let badge = "#ffc107";
        let text  = "pending";

        if (order.status === "completed") { badge = "#28a745"; text = "completed"; }
        if (order.status === "rejected")  { badge = "#dc3545"; text = "Rejected"; }

        box.innerHTML += `
        <div class="order-card-small">

            <h3>${order.service?.name || "Service"}</h3>

            <div class="status-badge" style="background:${badge}">${text}</div>

            ${order.reason ? `<p>Reason: ${order.reason}</p>` : ""}

            <div class="order-right">

                ${order.finalWorkFile ? `
                    <a target="_blank" href="http://localhost:5000/${order.finalWorkFile}">
                        Final Work
                    </a>
                ` : ""}

                ${order.status === "completed" ? `
                    <button class="invoice-btn" onclick="downloadInvoice('${order._id}')">
                        Invoice
                    </button>
                ` : ""}

            </div>

        </div>
        `;
    });
}

/* =====================================
INVOICE
===================================== */
async function downloadInvoice(id) {

    const res  = await fetch(`${API}/orders/invoice/${id}`, { headers: authHeaders() });
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");

    a.href     = url;
    a.download = `invoice-${id}.pdf`;
    a.click();

    URL.revokeObjectURL(url);
}

/* =====================================
PROFILE
===================================== */
async function loadProfile() {

    const res  = await fetch(`${API}/auth/me`, { headers: authHeaders() });
    const data = await res.json();

    if (!data.success) return;

    const user   = data.user;
    const name   = user.name;
    const ident  = user.identifier;
    const letter = name.charAt(0).toUpperCase();

    document.getElementById("profileName").value        = name;
    document.getElementById("profileIdentifier").value  = ident;
    document.getElementById("welcomeText").innerText    = "Welcome, " + name;
    document.getElementById("avatarText").innerText     = letter;
    document.getElementById("sidebarAvatar").innerText  = letter;
}

async function updateProfile() {

    const pass    = document.getElementById("profilePassword").value;
    const confirm = document.getElementById("confirmPassword").value;

    if (pass.length < 4) return alert("Password must be at least 4 characters");
    if (pass !== confirm) return alert("Passwords do not match");

    const res = await fetch(`${API}/auth/change-password`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "authorization": getToken()
        },
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

function toggleProfileMenu() {
    document.getElementById("profileMenu").classList.toggle("hidden");
}

function openProfileModal() {
    document.getElementById("profileModal").classList.remove("hidden");
    toggleProfileMenu();
}

function closeProfileModal() {
    document.getElementById("profileModal").classList.add("hidden");
}

function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

    if (window.innerWidth <= 1024) {
        document.getElementById("sidebar").classList.remove("active");
        document.getElementById("overlay").classList.remove("active");
    }
}