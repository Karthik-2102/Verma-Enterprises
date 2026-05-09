const API     = "https://verma-enterprises-backend.onrender.com/api";
const BACKEND = "https://verma-enterprises-backend.onrender.com";

/* Resolve file URL — handles both Cloudinary (full https) and legacy local paths */
function resolveFileURL(path) {
    if (!path) return "";
    return path.startsWith("http") ? path : `${BACKEND}/${path}`;
}

const SERVICE_CATEGORIES = [
    "Government Services",
    "Education Services",
    "Printing Services",
    "ID Card Services",
    "Banking Services"
];

const TIMELINE_STAGES = [
    "Order Placed",
    "Documents Verified",
    "Processing",
    "Ready for Delivery",
    "Completed"
];

/* =============================================
   INIT
   ============================================= */
document.addEventListener("DOMContentLoaded", initAdmin);

function initAdmin() {

    const token = sessionStorage.getItem("token");

    if (!token) {
        location.href = "index.html";
        return;
    }

    const user = decodeToken(token);

    if (!user || user.role !== "admin") {
        location.href = "index.html";
        return;
    }

    loadServices();
    loadOrders();
    loadActivityLogs();
    setupPriceCalculator();
    setupServiceSearch();
}

/* =============================================
   PRICE CALCULATOR
   ============================================= */
function setupPriceCalculator() {
    const appCharge  = document.getElementById("applicationCharge");
    const servCharge = document.getElementById("serviceCharge");
    const total      = document.getElementById("totalPriceDisplay");

    if (appCharge && servCharge && total) {
        const calc = () => {
            const app  = parseFloat(appCharge.value) || 0;
            const serv = parseFloat(servCharge.value) || 0;
            total.textContent = app + serv;
        };
        appCharge.addEventListener("input", calc);
        servCharge.addEventListener("input", calc);
    }
}

function calculateEditTotal() {
    const app  = parseFloat(document.getElementById("editApplicationCharge").value) || 0;
    const serv = parseFloat(document.getElementById("editServiceCharge").value) || 0;
    document.getElementById("editTotalPriceDisplay").textContent = app + serv;
}

/* =============================================
   UTILITIES
   ============================================= */
function getToken() {

    return sessionStorage.getItem(
        "token"
    );

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
    return {
        "Content-Type": "application/json",
        Authorization: getToken()
    };
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

/* =============================================
   LOGOUT
   ============================================= */
function logout() {
    sessionStorage.removeItem("token");
    location.href = "index.html";
}

/* =============================================
   SERVICE SEARCH & FILTER STATE
   ============================================= */
let serviceFilter = {
    search: "",
    category: "all",
    sort: "default"
};

let allServices = [];

function setupServiceSearch() {
    const searchEl = document.getElementById("serviceSearchInput");
    const catEl    = document.getElementById("serviceCategoryFilter");
    const sortEl   = document.getElementById("serviceSortFilter");

    if (searchEl) {
        searchEl.addEventListener("input", (e) => {
            serviceFilter.search = e.target.value.toLowerCase();
            renderFilteredServices();
        });
    }

    if (catEl) {
        catEl.addEventListener("change", (e) => {
            serviceFilter.category = e.target.value;
            renderFilteredServices();
        });
    }

    if (sortEl) {
        sortEl.addEventListener("change", (e) => {
            serviceFilter.sort = e.target.value;
            renderFilteredServices();
        });
    }
}

function renderFilteredServices() {
    let filtered = [...allServices];

    if (serviceFilter.search) {
        filtered = filtered.filter(s =>
            s.name.toLowerCase().includes(serviceFilter.search) ||
            (s.category || "").toLowerCase().includes(serviceFilter.search)
        );
    }

    if (serviceFilter.category !== "all") {
        filtered = filtered.filter(s =>
            (s.category || "Government Services") === serviceFilter.category
        );
    }

    if (serviceFilter.sort === "price-asc") {
        filtered.sort((a, b) => (a.finalPrice || 0) - (b.finalPrice || 0));
    } else if (serviceFilter.sort === "price-desc") {
        filtered.sort((a, b) => (b.finalPrice || 0) - (a.finalPrice || 0));
    } else if (serviceFilter.sort === "name") {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    renderServiceList(filtered);
}

/* =============================================
   SERVICES — LOAD & RENDER
   ============================================= */
async function loadServices() {
    try {
        const res = await fetch(`${API}/services`);
        allServices = await res.json();
        renderFilteredServices();
    } catch (err) {
        console.error("Failed to load services:", err);
    }
}

function getCategoryBadgeColor(category) {
    const colors = {
        "Government Services": { bg: "rgba(208,6,13,.18)",   border: "rgba(208,6,13,.40)",   text: "#ff6b6b" },
        "Education Services":  { bg: "rgba(62,94,104,.25)",  border: "rgba(153,186,187,.40)", text: "#99BABB" },
        "Printing Services":   { bg: "rgba(229,126,47,.18)", border: "rgba(229,126,47,.40)",  text: "#E57E2F" },
        "ID Card Services":    { bg: "rgba(80,160,80,.18)",  border: "rgba(80,200,80,.35)",   text: "#5cb85c" },
        "Banking Services":    { bg: "rgba(70,100,200,.18)", border: "rgba(100,140,255,.35)", text: "#7BAAF7" }
    };
    return colors[category] || colors["Government Services"];
}

function renderServiceList(services) {
    const box = document.getElementById("list");
    box.innerHTML = "";

    if (!services.length) {
        box.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:40px;opacity:.6;font-size:18px;">
                No services found.
            </div>`;
        return;
    }

    services.forEach(service => {
        const appCharge  = service.applicationCharge || service.basePrice || 0;
        const servCharge = service.serviceCharge || 0;
        const total      = service.finalPrice || (appCharge + servCharge);
        const cat        = service.category || "Government Services";
        const badgeColor = getCategoryBadgeColor(cat);

        box.innerHTML += `
        <div class="admin-service-card">

            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px;">
                <h3 style="margin:0;font-size:18px;flex:1;">${service.name}</h3>
                <span class="cat-badge" style="
                    background:${badgeColor.bg};
                    border:1px solid ${badgeColor.border};
                    color:${badgeColor.text};
                    padding:4px 10px;
                    border-radius:999px;
                    font-size:11px;
                    font-weight:800;
                    white-space:normal;
                    word-break:break-word;
                    text-align:center;
                    max-width:130px;
                    line-height:1.5;
                    flex-shrink:1;
                ">${cat}</span>
            </div>

            <div class="service-price-breakdown">
                <p><strong>Application:</strong> ₹${appCharge}</p>
                <p><strong>Service:</strong> ₹${servCharge}</p>
                <p class="total-price"><strong>Total:</strong> ₹${total}</p>
            </div>

            <div class="service-actions">
                <button class="edit-btn" onclick="openEditService('${service._id}')">Edit</button>
                <button class="delete-btn" onclick="deleteService('${service._id}')">Delete</button>
            </div>

        </div>
        `;
    });
}

async function addService() {

    const appCharge  = parseFloat(document.getElementById("applicationCharge").value) || 0;
    const servCharge = parseFloat(document.getElementById("serviceCharge").value) || 0;
    const category   = document.getElementById("serviceCategory")?.value || "Government Services";

    const payload = {
        name: document.getElementById("name").value.trim(),
        applicationCharge: appCharge,
        serviceCharge: servCharge,
        basePrice: appCharge,
        finalPrice: appCharge + servCharge,
        documents: document.getElementById("documents").value
            .split(",")
            .map(d => d.trim())
            .filter(d => d),
        category
    };

    if (!payload.name) {
        return alert("Please enter service name ❌");
    }

    const res = await fetch(`${API}/services/create`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success || data._id) {
        showToast("Service added successfully ✅");

        document.getElementById("name").value = "";
        document.getElementById("applicationCharge").value = "";
        document.getElementById("serviceCharge").value = "";
        document.getElementById("documents").value = "";
        document.getElementById("totalPriceDisplay").textContent = "0";
        if (document.getElementById("serviceCategory")) {
            document.getElementById("serviceCategory").value = "Government Services";
        }

        loadServices();
        loadActivityLogs();
    } else {
        alert(data.message || "Failed to add service ❌");
    }
}

async function deleteService(id) {
    if (!confirm("Are you sure you want to delete this service?")) return;

    await fetch(`${API}/services/delete/${id}`, {
        method: "DELETE",
        headers: authHeaders()
    });

    showToast("Service deleted ✅");
    loadServices();
    loadActivityLogs();
}

/* =============================================
   EDIT SERVICE MODAL
   ============================================= */
let currentEditServiceId = null;

async function openEditService(id) {
    currentEditServiceId = id;

    const res     = await fetch(`${API}/services/${id}`);
    const service = await res.json();

    document.getElementById("editName").value              = service.name || "";
    document.getElementById("editApplicationCharge").value = service.applicationCharge || service.basePrice || 0;
    document.getElementById("editServiceCharge").value     = service.serviceCharge || 0;
    document.getElementById("editDocuments").value         = (service.documents || []).join(", ");

    const editCatEl = document.getElementById("editServiceCategory");
    if (editCatEl) {
        editCatEl.value = service.category || "Government Services";
    }

    calculateEditTotal();

    document.getElementById("editServiceModal").classList.remove("hidden");
}

async function updateService() {

    if (!currentEditServiceId) {
        return alert("No service selected ❌");
    }

    const appCharge  = parseFloat(document.getElementById("editApplicationCharge").value) || 0;
    const servCharge = parseFloat(document.getElementById("editServiceCharge").value) || 0;
    const name       = document.getElementById("editName").value.trim();
    const category   = document.getElementById("editServiceCategory")?.value || "Government Services";

    if (!name) {
        return alert("Please enter service name ❌");
    }

    const payload = {
        name,
        applicationCharge: appCharge,
        serviceCharge: servCharge,
        basePrice: appCharge,
        finalPrice: appCharge + servCharge,
        documents: document.getElementById("editDocuments").value
            .split(",")
            .map(d => d.trim())
            .filter(d => d),
        category
    };

    try {
        const res = await fetch(`${API}/services/update/${currentEditServiceId}`, {
            method: "PUT",
            headers: jsonHeaders(),
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.success || data._id || data.service) {
            showToast("Service updated successfully ✅");
            closeEditService();
            loadServices();
            loadActivityLogs();
        } else {
            alert(data.message || "Failed to update service ❌");
        }
    } catch (err) {
        console.error("Update failed:", err);
        alert("Network error. Please check your connection.");
    }
}

function closeEditService() {
    document.getElementById("editServiceModal").classList.add("hidden");
    currentEditServiceId = null;
}

/* =============================================
   ORDERS — LOAD & RENDER
   ============================================= */
async function loadOrders() {

    const res  = await fetch(`${API}/orders`, { headers: authHeaders() });
    const data = await res.json();

    const search = document.getElementById("searchBox")?.value?.toLowerCase() || "";

    let orders = data.orders || [];

    orders = orders.filter(order => {
        const text = `
        ${order.user?.name || ""}
        ${order.user?.identifier || ""}
        ${order.service?.name || ""}
        ${order.status || ""}
        `.toLowerCase();
        return text.includes(search);
    });

    updateStats(orders);
    renderOrders(orders);
    setTimeout(() => { updateStats(orders); }, 100);
}

/* =============================================
   STATS
   ============================================= */
function updateStats(orders) {

    let total     = orders.length;
    let pending   = orders.filter(x => x.status === "pending").length;
    let completed = orders.filter(x => x.status === "completed").length;
    let rejected  = orders.filter(x => x.status === "rejected").length;

    let todayRevenue   = 0;
    let weeklyRevenue  = 0;
    let monthlyRevenue = 0;
    let totalRevenue   = 0;

    const now = new Date();

    orders.forEach(order => {
        if (order.status !== "completed") return;

        const price     = Number(order.service?.finalPrice || 0);
        const orderDate = new Date(order.createdAt);

        totalRevenue += price;

        if (orderDate.toDateString() === now.toDateString()) {
            todayRevenue += price;
        }

        const diffDays = (now - orderDate) / (1000 * 60 * 60 * 24);
        if (diffDays <= 7) weeklyRevenue += price;

        if (
            orderDate.getMonth() === now.getMonth() &&
            orderDate.getFullYear() === now.getFullYear()
        ) {
            monthlyRevenue += price;
        }
    });

    setText("totalOrders",     total);
    setText("pendingOrders",   pending);
    setText("completedOrders", completed);
    setText("rejectedOrders",  rejected);
    setText("todayRevenue",    `₹${todayRevenue}`);
    setText("weeklyRevenue",   `₹${weeklyRevenue}`);
    setText("monthlyRevenue",  `₹${monthlyRevenue}`);
    setText("totalRevenue",    `₹${totalRevenue}`);

    drawCharts(todayRevenue, weeklyRevenue, monthlyRevenue, totalRevenue);
}

/* =============================================
   RENDER ORDERS — WITH TIMELINE CONTROLS
   ============================================= */
function renderOrders(orders) {

    const box = document.getElementById("orders");
    box.innerHTML = "";

    if (!orders.length) {
        box.innerHTML = "<p style='padding:20px;opacity:.6;'>No orders found.</p>";
        return;
    }

    orders.forEach(order => {

        let color = "#ffc107";
        if (order.status === "completed") color = "#28a745";
        if (order.status === "rejected")  color = "#dc3545";

        const currentStage = order.timelineStage || "Order Placed";

        /* Timeline stage selector for admin */
        const timelineOptions = TIMELINE_STAGES.map(stage => `
            <option value="${stage}" ${stage === currentStage ? "selected" : ""}>${stage}</option>
        `).join("");

        box.innerHTML += `
        <div class="admin-order-card">

            <h3>${order.service?.name || "Service"}</h3>

            <p>${order.user?.name || "User"} (${order.user?.identifier || ""})</p>

            <small>${new Date(order.createdAt).toLocaleString()}</small>

            <div style="display:flex;align-items:center;gap:8px;margin:8px 0;">
                <div class="status-badge" style="background:${color}">
                    ${order.status}
                </div>
                <span class="admin-timeline-badge">${currentStage}</span>
            </div>

            ${order.reason ? `<p>Reason: ${order.reason}</p>` : ""}

            <!-- Timeline Stage Control -->
            <div class="timeline-control-wrap">
                <label style="font-size:12px;opacity:.6;display:block;margin-bottom:6px;">Update Timeline Stage</label>
                <select class="timeline-select" id="timeline-${order._id}">
                    ${timelineOptions}
                </select>
                <button class="timeline-update-btn" onclick="updateTimeline('${order._id}')">
                    Update Stage
                </button>
            </div>

            <div class="admin-order-right">

                ${(order.files || []).map((file, fi) => `
                    <a class="user-file-btn" target="_blank" href="${resolveFileURL(file)}">
                        User File ${order.files.length > 1 ? fi + 1 : ""}
                    </a>
                `).join("")}

                ${order.finalWorkFile ? `
                    <a class="final-work-btn" target="_blank" href="${resolveFileURL(order.finalWorkFile)}">
                        Final Work
                    </a>
                ` : ""}

            </div>

            ${order.status === "pending" ? `
                <div class="admin-actions">
                    <button onclick="completeOrder('${order._id}')">Complete</button>
                    <input id="reason-${order._id}" placeholder="Reject reason">
                    <button onclick="rejectOrder('${order._id}')">Reject</button>
                </div>
            ` : ""}

            ${order.status === "completed" ? `
                <div class="admin-actions">
                    <input type="file" id="work-${order._id}">
                    <button onclick="uploadWork('${order._id}')">Upload Work</button>
                </div>
            ` : ""}

        </div>
        `;
    });
}

/* =============================================
   ORDER STATUS ACTIONS
   ============================================= */
async function completeOrder(id) {
    await fetch(`${API}/orders/update/${id}`, {
        method: "PUT",
        headers: jsonHeaders(),
        body: JSON.stringify({ status: "completed" })
    });
    loadOrders();
    loadActivityLogs();
}

async function rejectOrder(id) {
    const reason = document.getElementById(`reason-${id}`)?.value?.trim();

    if (!reason) return alert("Enter reason");

    await fetch(`${API}/orders/update/${id}`, {
        method: "PUT",
        headers: jsonHeaders(),
        body: JSON.stringify({ status: "rejected", reason })
    });
    loadOrders();
    loadActivityLogs();
}

async function uploadWork(id) {

    const fileInput =
    document.getElementById(
        `upload-${id}`
    );

    if (

        !fileInput ||

        !fileInput.files ||

        !fileInput.files[0]

    ) {

        alert(
            "Please select a file first ❌"
        );

        return;

    }

    const formData =
    new FormData();

    formData.append(

        "workFile",

        fileInput.files[0]

    );

    try {

        const res =
        await fetch(

            `${API}/orders/upload-work/${id}`,

            {

                method:
                "POST",

                headers: {

                    Authorization:
                    getToken()

                },

                body:
                formData

            }

        );

        const data =
        await res.json();

        if (data.success) {

            showToast(
                "Final work uploaded ✅"
            );

            loadOrders();

            return;

        }

        console.error(
            "Admin Upload Error:",
            data
        );

        alert(

            typeof data.message === "string"

            ?

            data.message

            :

            JSON.stringify(
                data,
                null,
                2
            )

        );

    }

    catch (err) {

        console.error(
            "Upload Request Failed:",
            err
        );

        alert(

            err.message ||

            "Upload failed ❌"

        );

    }

}

/* =============================================
   ORDER TIMELINE UPDATE
   ============================================= */
async function updateTimeline(orderId) {

    const select = document.getElementById(`timeline-${orderId}`);
    const stage  = select?.value;

    if (!stage) return;

    try {
        const res = await fetch(`${API}/orders/timeline/${orderId}`, {
            method: "PUT",
            headers: jsonHeaders(),
            body: JSON.stringify({ timelineStage: stage })
        });

        const data = await res.json();

        if (data.success) {
            showToast(`Timeline updated: ${stage} ✅`);
            loadOrders();
            loadActivityLogs();
        } else {
            alert(data.message || "Failed to update timeline");
        }
    } catch (err) {
        console.error("Timeline update error:", err);
        alert("Network error");
    }
}

/* =============================================
   CHARTS
   ============================================= */
let barChartInstance  = null;
let lineChartInstance = null;

function drawCharts(today, week, month, total) {

    const barCtx  = document.getElementById("barChart")?.getContext("2d");
    const lineCtx = document.getElementById("lineChart")?.getContext("2d");

    if (!barCtx || !lineCtx) return;

    if (barChartInstance)  barChartInstance.destroy();
    if (lineChartInstance) lineChartInstance.destroy();

    barChartInstance = new Chart(barCtx, {
        type: "bar",
        data: {
            labels: ["Today", "Week", "Month", "Total"],
            datasets: [{
                label: "Revenue ₹",
                data: [today, week, month, total],
                backgroundColor: [
                    "rgba(62,94,104,.85)",
                    "rgba(44,69,80,.85)",
                    "rgba(153,186,187,.75)",
                    "rgba(160,0,5,.80)"
                ],
                borderColor: ["#3E5E68", "#2C4550", "#99BABB", "#D0060D"],
                borderWidth: 1,
                borderRadius: 10
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: "#fff" } } },
            scales: {
                x: { ticks: { color: "#fff" } },
                y: { ticks: { color: "#fff" } }
            }
        }
    });

    lineChartInstance = new Chart(lineCtx, {
        type: "line",
        data: {
            labels: ["Today", "Week", "Month", "Total"],
            datasets: [{
                label: "Growth",
                data: [today, week, month, total],
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                borderColor: "#D0060D",
                backgroundColor: "rgba(160,0,5,.15)",
                pointBackgroundColor: "#D0060D",
                pointBorderColor: "#fff",
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: "#fff" } } },
            scales: {
                x: { ticks: { color: "#fff" } },
                y: { ticks: { color: "#fff" } }
            }
        }
    });
}

/* =============================================
   ACTIVITY LOGS
   ============================================= */
async function loadActivityLogs() {

    const search    = document.getElementById("activitySearchInput")?.value?.trim() || "";
    const container = document.getElementById("activityLogList");

    if (!container) return;

    try {
        const url = search
            ? `${API}/orders/activity-logs?search=${encodeURIComponent(search)}`
            : `${API}/orders/activity-logs`;

        const res  = await fetch(url, { headers: authHeaders() });
        const data = await res.json();

        if (!data.success || !data.logs.length) {
            container.innerHTML = `<div class="activity-log-empty">No activity logs found.</div>`;
            return;
        }

        const categoryIcons = {
            service:  "⚙️",
            order:    "📋",
            pricing:  "💰",
            upload:   "📤",
            timeline: "🕐"
        };

        container.innerHTML = data.logs.map(log => {

            const icon    = categoryIcons[log.category] || "📋";
            const dateStr = new Date(log.createdAt).toLocaleString();

            return `
            <div class="activity-log-item" data-cat="${log.category}">
                <div class="activity-log-icon">${icon}</div>
                <div class="activity-log-body">
                    <div class="activity-log-action">${log.action}</div>
                    <div class="activity-log-meta">
                        ${log.adminName} &nbsp;·&nbsp; ${dateStr}
                    </div>
                </div>
            </div>`;

        }).join("");

    } catch (err) {
        console.error("Activity log load error:", err);
        container.innerHTML = `<div class="activity-log-empty">Failed to load activity logs.</div>`;
    }
}

/* =============================================
   ADMIN PROFILE
   ============================================= */
async function openAdminProfile() {

    const res  = await fetch(`${API}/auth/me`, { headers: authHeaders() });
    const data = await res.json();

    if (data.success) {
        document.getElementById("adminName").value       = data.user.name;
        document.getElementById("adminIdentifier").value = data.user.identifier;
    }

    document.getElementById("adminProfileModal").classList.remove("hidden");
}

function closeAdminProfile() {
    document.getElementById("adminProfileModal").classList.add("hidden");
}

async function sendAdminOtp() {
    const res  = await fetch(`${API}/auth/admin-send-otp`, {
        method: "POST",
        headers: jsonHeaders()
    });
    const data = await res.json();
    alert(data.message);
}

async function changeAdminPassword() {
    const pass    = document.getElementById("adminPass").value;
    const confirm = document.getElementById("adminConfirm").value;
    const otp     = document.getElementById("adminOtp").value;

    if (pass !== confirm) return alert("Passwords do not match");

    const res = await fetch(`${API}/auth/admin-change-password`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ newPassword: pass, otp })
    });

    const data = await res.json();
    alert(data.message);

    if (data.success) closeAdminProfile();
}

/* =============================================
   TOAST NOTIFICATION
   ============================================= */
function showToast(msg) {
    let toast = document.getElementById("adminToast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "adminToast";
        toast.style.cssText = `
            position:fixed;
            bottom:32px;
            right:32px;
            background:linear-gradient(90deg,#2C4550,#3E5E68);
            color:#fff;
            padding:16px 26px;
            border-radius:16px;
            font-weight:800;
            font-size:16px;
            z-index:9999;
            box-shadow:0 12px 30px rgba(0,0,0,.4);
            transition:.4s;
            transform:translateY(80px);
            opacity:0;
        `;
        document.body.appendChild(toast);
    }

    toast.textContent = msg;
    toast.style.transform = "translateY(0)";
    toast.style.opacity = "1";

    setTimeout(() => {
        toast.style.transform = "translateY(80px)";
        toast.style.opacity = "0";
    }, 3000);
}