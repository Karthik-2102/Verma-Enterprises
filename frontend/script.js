const API =
"https://artistic-respect-production-e47c.up.railway.app/api";

let allUserServices = [];
let currentServiceId = null;
let selectedUserFiles = [];

/* Application bootstrap */

document.addEventListener(
    "DOMContentLoaded",
    initializeApplication
);

function initializeApplication(){

    loadServices();

    const token =
    sessionStorage.getItem(
        "token"
    );

    if(token){

        enterDashboard();

    }

}

/* Common helpers */

function getToken(){

    return sessionStorage.getItem(
        "token"
    );

}

function getAuthHeaders(){

    return {

        Authorization:
        getToken()

    };

}

/* Authentication */

function openLoginModal(){

    document
        .getElementById(
            "authPage"
        )
        .classList
        .remove(
            "hidden"
        );

}

function closeLoginModal(){

    document
        .getElementById(
            "authPage"
        )
        .classList
        .add(
            "hidden"
        );

}

function flip(){

    document
        .getElementById(
            "authCard"
        )
        .classList
        .toggle(
            "flipped"
        );

}

async function register(){

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

    const response =
    await fetch(

        `${API}/auth/register`,

        {

            method:"POST",

            headers:{
                "Content-Type":
                "application/json"
            },

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

    alert(
        data.message
    );

}

async function login(){

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

    const response =
    await fetch(

        `${API}/auth/login`,

        {

            method:"POST",

            headers:{
                "Content-Type":
                "application/json"
            },

            body:
            JSON.stringify({

                identifier,
                password

            })

        }

    );

    const data =
    await response.json();

    if(!data.token){

        alert(
            data.message
        );

        return;

    }

    sessionStorage.setItem(

        "token",

        data.token

    );

    enterDashboard();

}

function logout(){

    sessionStorage.clear();

    location.reload();

}

/* Password recovery */

async function openForgotPassword(){

    const identifier =
    prompt(
        "Enter email or mobile"
    );

    if(!identifier) return;

    const response =
    await fetch(

        `${API}/auth/forgot-password`,

        {

            method:"POST",

            headers:{
                "Content-Type":
                "application/json"
            },

            body:
            JSON.stringify({

                identifier

            })

        }

    );

    const data =
    await response.json();

    alert(
        data.message
    );

}

async function openAdminResetModal(){

    const identifier =
    prompt(
        "Admin email or mobile"
    );

    if(!identifier) return;

    const password =
    prompt(
        "New password"
    );

    if(!password) return;

    const response =
    await fetch(

        `${API}/auth/admin-reset-password`,

        {

            method:"POST",

            headers:{
                "Content-Type":
                "application/json"
            },

            body:
            JSON.stringify({

                identifier,
                newPassword:
                password

            })

        }

    );

    const data =
    await response.json();

    alert(
        data.message
    );

}

/* Dashboard */

function enterDashboard(){

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

function toggleSidebar(){

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

function toggleProfileMenu(){

    document
        .getElementById(
            "profileMenu"
        )
        .classList
        .toggle(
            "hidden"
        );

}

/* Services */

async function loadServices(){

    const response =
    await fetch(
        `${API}/services`
    );

    allUserServices =
    await response.json();

    renderServices();

}

function renderServices(){

    const container =
    document
        .getElementById(
            "services"
        );

    if(!container) return;

    container.innerHTML = "";

    allUserServices.forEach(

        service => {

            const card =
            document
            .createElement(
                "div"
            );

            card.className =
            "service-card";

            card.innerHTML = `

                <h3>
                    ${service.name}
                </h3>

                <p class="service-price">
                    ₹${service.finalPrice}
                </p>

            `;

            card.onclick =
            () =>
            openService(
                service._id
            );

            container
            .appendChild(
                card
            );

        }

    );

}

async function openService(id){

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
        .innerHTML = `

            <li>
                Application Charge:
                ₹${service.applicationCharge || 0}
            </li>

            <li>
                Service Charge:
                ₹${service.serviceCharge || 0}
            </li>

            <li>
                Total:
                ₹${service.finalPrice || 0}
            </li>

            <br>

            ${
                service.documents
                .map(

                    doc =>

                    `<li>${doc}</li>`

                )

                .join("")

            }

        `;

    document
        .getElementById(
            "serviceModal"
        )
        .classList
        .remove(
            "hidden"
        );

}

function closeModal(){

    document
        .getElementById(
            "serviceModal"
        )
        .classList
        .add(
            "hidden"
        );

}

function startApply(){

    if(!getToken()){

        closeModal();

        openLoginModal();

        return;

    }

}

/* Upload */

function previewSelectedFiles(){

    const input =
    document
        .getElementById(
            "fileUpload"
        );

    selectedUserFiles =
    Array.from(
        input.files
    );

    renderFilePreview();

}

function renderFilePreview(){

    const container =
    document
        .getElementById(
            "selectedFilesList"
        );

    container.innerHTML = "";

    selectedUserFiles.forEach(

        (
            file,
            index
        ) => {

            const row =
            document
            .createElement(
                "div"
            );

            row.className =
            "selected-file-row";

            row.innerHTML = `

                <span>
                    ${file.name}
                </span>

                <button
                    onclick="removeFile(${index})"
                >
                    Delete
                </button>

            `;

            container
            .appendChild(
                row
            );

        }

    );

}

function removeFile(index){

    selectedUserFiles.splice(
        index,
        1
    );

    renderFilePreview();

}

/* Orders */

async function submitService(){

    if(
        !selectedUserFiles.length
    ){

        alert(
            "Upload documents"
        );

        return;

    }

    const formData =
    new FormData();

    formData.append(

        "serviceId",

        currentServiceId

    );

    selectedUserFiles.forEach(

        file => {

            formData.append(

                "documents",

                file

            );

        }

    );

    const response =
    await fetch(

        `${API}/orders/create`,

        {

            method:"POST",

            headers:
            getAuthHeaders(),

            body:
            formData

        }

    );

    const data =
    await response.json();

    alert(
        data.message
    );

    closeModal();

    loadUserOrders();

}

async function loadUserOrders(){

    const response =
    await fetch(

        `${API}/orders/my-orders`,

        {

            headers:
            getAuthHeaders()

        }

    );

    const data =
    await response.json();

    const container =
    document
        .getElementById(
            "userOrders"
        );

    container.innerHTML = "";

    data.orders.forEach(

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
                    ${order.service?.name}
                </h3>

                <p>
                    ${order.status}
                </p>

            `;

            container
            .appendChild(
                card
            );

        }

    );

}

/* Profile */

function loadProfile(){

    const avatar =
    document
        .getElementById(
            "avatarText"
        );

    avatar.innerText =
    "user".toUpperCase();

}