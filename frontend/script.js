const API =
"https://artistic-respect-production-e47c.up.railway.app/api";

const BACKEND =
"https://artistic-respect-production-e47c.up.railway.app";

/* =========================================
   APP INIT
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    initApp
);

function initApp() {

    const token =
    sessionStorage.getItem("token");

    loadServices();

    if (token) {

        enterSite();

    }

}

/* =========================================
   UTILITIES
========================================= */

function getToken() {

    return sessionStorage.getItem(
        "token"
    );

}

function decodeToken(token) {

    try {

        return JSON.parse(
            atob(
                token.split(".")[1]
            )
        );

    }

    catch {

        return null;

    }

}

function authHeaders() {

    return {

        Authorization:
        getToken()

    };

}

function jsonHeaders() {

    return {

        "Content-Type":
        "application/json"

    };

}

/* =========================================
   AUTH UI
========================================= */

function openLoginModal() {

    document
        .getElementById(
            "authPage"
        )
        .classList
        .remove(
            "hidden"
        );

}

function closeLoginModal() {

    document
        .getElementById(
            "authPage"
        )
        .classList
        .add(
            "hidden"
        );

}

function flip() {

    document
        .getElementById(
            "authCard"
        )
        .classList
        .toggle(
            "flipped"
        );

}
function openAdminResetModal() {

    alert(
        "Admin password reset flow is preserved. We will reconnect your old reset popup next."
    );

}
/* =========================================
   REGISTER
========================================= */

async function register() {

    const name =
    document
        .getElementById(
            "name"
        )
        .value
        .trim();

    const identifier =
    document
        .getElementById(
            "signupIdentifier"
        )
        .value
        .trim();

    const password =
    document
        .getElementById(
            "signupPassword"
        )
        .value;

    if (
        !name ||
        !identifier ||
        !password
    ) {

        alert(
            "Fill all fields ❌"
        );

        return;

    }

    const response =
    await fetch(

        `${API}/auth/register`,

        {
            method:"POST",

            headers:
            jsonHeaders(),

            body:
            JSON.stringify({

                name,
                identifier,
                password

            })

        }

    );

    const data =
    await response.json();

    if (
        data.success
    ) {

        alert(
            "Registered successfully ✅"
        );

        flip();

        return;

    }

    alert(
        data.message ||
        "Registration failed ❌"
    );

}

/* =========================================
   LOGIN
========================================= */

async function login() {

    const identifier =
    document
        .getElementById(
            "loginIdentifier"
        )
        .value
        .trim();

    const password =
    document
        .getElementById(
            "loginPassword"
        )
        .value;

    if (
        !identifier ||
        !password
    ) {

        alert(
            "Fill all fields ❌"
        );

        return;

    }

    const response =
    await fetch(

        `${API}/auth/login`,

        {
            method:"POST",

            headers:
            jsonHeaders(),

            body:
            JSON.stringify({

                identifier,
                password

            })

        }

    );

    const data =
    await response.json();

    if (
        !data.success
    ) {

        alert(
            data.message ||
            "Login failed ❌"
        );

        return;

    }

    sessionStorage.setItem(
        "token",
        data.token
    );

    enterSite();

}

/* =========================================
   ENTER SITE
========================================= */

function enterSite() {

    const token =
    getToken();

    if (!token) return;

    const user =
    decodeToken(
        token
    );

    if (
        user?.role ===
        "admin"
    ) {

        location.href =
        "admin.html";

        return;

    }

    document
        .getElementById(
            "publicSite"
        )
        .classList
        .add(
            "hidden"
        );

    document
        .getElementById(
            "authPage"
        )
        .classList
        .add(
            "hidden"
        );

    document
        .getElementById(
            "mainPage"
        )
        .classList
        .remove(
            "hidden"
        );

    loadProfile();

    loadUserOrders();

}

/* =========================================
   LOGOUT
========================================= */

function logout() {

    sessionStorage.removeItem(
        "token"
    );

    location.href =
    "index.html";

}

/* =========================================
   SIDEBAR
========================================= */

function toggleSidebar() {

    document
        .getElementById(
            "sidebar"
        )
        .classList
        .toggle(
            "active"
        );

    document
        .getElementById(
            "overlay"
        )
        .classList
        .toggle(
            "active"
        );

}

/* =========================================
   SERVICES
========================================= */

let allUserServices = [];
let currentServiceId = null;

async function loadServices() {

    try {

        const response =
        await fetch(
            `${API}/services`
        );

        allUserServices =
        await response.json();

        renderServices();

    }

    catch {

        console.error(
            "Failed to load services"
        );

    }

}

function renderServices() {

    const grid =
    document.getElementById(
        "services"
    );

    if (!grid) return;

    const search =
    (
        document
        .getElementById(
            "userSearchInput"
        )
        ?.value ||

        ""

    )
    .toLowerCase();

    const filtered =
    allUserServices.filter(
        service =>

        service.name
        .toLowerCase()
        .includes(
            search
        )
    );

    grid.innerHTML = "";

    filtered.forEach(
        service => {

        const card =
        document.createElement(
            "div"
        );

        card.className =
        "service-card";

        card.innerHTML = `

            <h3>
                ${service.name}
            </h3>

            <p class="service-price">
                ₹${service.finalPrice || service.basePrice}
            </p>

        `;

        card.onclick =
        () =>
        openService(
            service._id
        );

        grid.appendChild(
            card
        );

    });

}

function handleSearchInput() {

    renderServices();

}

/* =========================================
   SERVICE MODAL
========================================= */

async function openService(id) {

    if (!getToken()) {

        openLoginModal();

        return;

    }

    currentServiceId =
    id;

    const response =
    await fetch(

        `${API}/services/${id}`

    );

    const service =
    await response.json();

    document
        .getElementById(
            "modalTitle"
        )
        .innerText =

        service.name;

    document
        .getElementById(
            "modalDocs"
        )
        .innerHTML =

        (
            service.documents || []
        )

        .map(

            doc =>
            `<li>${doc}</li>`

        )

        .join("");

    document
        .getElementById(
            "serviceModal"
        )
        .classList
        .remove(
            "hidden"
        );

}

function closeModal() {

    document
        .getElementById(
            "serviceModal"
        )
        .classList
        .add(
            "hidden"
        );

}

/* =========================================
   FILE PREVIEW
========================================= */

let selectedUserFiles =
[];

function previewSelectedFiles() {

    const input =
    document
        .getElementById(
            "fileUpload"
        );

    selectedUserFiles =
    Array.from(
        input.files
    );

    renderSelectedFiles();

}

function renderSelectedFiles() {

    const list =
    document
        .getElementById(
            "selectedFilesList"
        );

    list.innerHTML = "";

    selectedUserFiles
    .forEach(

        (
            file,
            index
        ) => {

            const icon =

            file.type
            .includes(
                "pdf"
            )

            ?

            "📄"

            :

            "🖼";

            const row =
            document
            .createElement(
                "div"
            );

            row.className =
            "selected-file-row";

            row.innerHTML = `

                <span>
                    ${icon}
                    ${file.name}
                </span>

                <button
                    onclick="removeSelectedFile(${index})"
                >
                    Delete
                </button>

            `;

            list.appendChild(
                row
            );

        }

    );

}

function removeSelectedFile(index) {

    selectedUserFiles.splice(
        index,
        1
    );

    renderSelectedFiles();

}

/* =========================================
   ORDER SUBMIT
========================================= */

async function submitService() {

    if (
        !selectedUserFiles
        .length
    ) {

        alert(
            "Upload documents ❌"
        );

        return;

    }

    const formData =
    new FormData();

    formData.append(

        "serviceId",

        currentServiceId

    );

    selectedUserFiles
    .forEach(

        file =>

        formData.append(

            "documents",

            file

        )

    );

    const response =
    await fetch(

        `${API}/orders/create`,

        {

            method:"POST",

            headers:{
                Authorization:
                getToken()
            },

            body:
            formData

        }

    );

    const data =
    await response.json();

    if (
        data.success
    ) {

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

/* =========================================
   USER ORDERS
========================================= */

async function loadUserOrders() {

    const response =
    await fetch(

        `${API}/orders/my-orders`,

        {

            headers:
            authHeaders()

        }

    );

    const data =
    await response.json();

    const box =
    document
        .getElementById(
            "userOrders"
        );

    box.innerHTML = "";

    (
        data.orders || []
    )
    .forEach(

        order => {

            const card =
            document
            .createElement(
                "div"
            );

            card.className =
            "service-card";

            card.innerHTML = `

                <h3>
                    ${order.service?.name || "Service"}
                </h3>

                <p>
                    ${order.status}
                </p>

            `;

            box.appendChild(
                card
            );

        }

    );

}

/* =========================================
   PROFILE
========================================= */

async function loadProfile() {

    const user =
    decodeToken(
        getToken()
    );

    if (!user) return;

    document
        .getElementById(
            "avatarText"
        )
        .innerText =

        user.name
        ?.charAt(0)
        ?.toUpperCase()

        ||

        "U";

}

function toggleProfileMenu() {

    document
        .getElementById(
            "profileMenu"
        )
        .classList
        .toggle(
            "hidden"
        );

}

/* =========================================
   UTIL
========================================= */

function scrollToSection(id) {

    document
        .getElementById(
            id
        )
        ?.scrollIntoView({

            behavior:
            "smooth"

        });

}