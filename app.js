/* =========================================================
   ASADA OROSI - APLICACIÓN PRINCIPAL
   ========================================================= */


/* =========================================================
   CONFIGURACIÓN GENERAL
   ========================================================= */

const VEHICLES = [
    {
        nombre: "Toyota Rush",
        placa: "BPW199"
    },
    {
        nombre: "Isuzu D-Max Gris",
        placa: "CL376760"
    },
    {
        nombre: "Isuzu D-Max Blanco",
        placa: "AGV"
    }
];


const API_URL =
    "https://script.google.com/macros/s/AKfycbxkIq00buHztZezEuUgN4E-yFYl75qWgBfNX6t89CMf2kbPRkh3uSt1bgmKJZudLlax/exec";


const API_RESPONSE_TYPE =
    "ASADA_API_RESPONSE";


const API_TIMEOUT_MS =
    120000;


const API_PENDING_REQUESTS =
    new Map();


/* =========================================================
   COMUNICACIÓN CON GOOGLE APPS SCRIPT
   ========================================================= */

function createRequestId() {

    if (
        window.crypto &&
        typeof window.crypto.randomUUID === "function"
    ) {

        return window.crypto.randomUUID();
    }


    return (
        Date.now().toString(36) +
        "_" +
        Math.random().toString(36).slice(2)
    );
}


/* =========================================================
   RECIBIR RESPUESTA DE APPS SCRIPT
   ========================================================= */

function handleApiMessage(
    event
) {

    const message =
        event.data;


    if (
        !message ||
        typeof message !== "object" ||
        message.type !== API_RESPONSE_TYPE ||
        !message.requestId
    ) {

        return;
    }


    const pending =
        API_PENDING_REQUESTS.get(
            message.requestId
        );


    if (!pending) {

        return;
    }


    API_PENDING_REQUESTS.delete(
        message.requestId
    );


    clearTimeout(
        pending.timeoutId
    );


    if (
        pending.form &&
        pending.form.parentNode
    ) {

        pending.form.remove();
    }


    if (
        pending.iframe &&
        pending.iframe.parentNode
    ) {

        pending.iframe.remove();
    }


    if (
        message.success === true
    ) {

        pending.resolve(
            message.data || {}
        );

        return;
    }


    pending.reject(
        new Error(
            message.message ||
            "No fue posible completar la solicitud."
        )
    );
}


window.addEventListener(
    "message",
    handleApiMessage
);


/* =========================================================
   LLAMAR A GOOGLE APPS SCRIPT
   ========================================================= */

function callApi(
    action,
    values = {}
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const requestId =
                createRequestId();


            const frameName =
                "asadaApiFrame_" +
                requestId.replace(
                    /[^a-zA-Z0-9_]/g,
                    ""
                );


            const iframe =
                document.createElement(
                    "iframe"
                );


            iframe.name =
                frameName;


            iframe.style.display =
                "none";


            iframe.setAttribute(
                "aria-hidden",
                "true"
            );


            const form =
                document.createElement(
                    "form"
                );


            form.method =
                "POST";


            form.action =
                API_URL;


            form.target =
                frameName;


            form.style.display =
                "none";


            form.acceptCharset =
                "UTF-8";


            const input =
                document.createElement(
                    "input"
                );


            input.type =
                "hidden";


            input.name =
                "payload";


            input.value =
                JSON.stringify({
                    requestId,
                    action,
                    ...values
                });


            form.appendChild(
                input
            );


            document.body.appendChild(
                iframe
            );


            document.body.appendChild(
                form
            );


            const timeoutId =
                window.setTimeout(
                    () => {

                        API_PENDING_REQUESTS.delete(
                            requestId
                        );


                        if (
                            form.parentNode
                        ) {

                            form.remove();
                        }


                        if (
                            iframe.parentNode
                        ) {

                            iframe.remove();
                        }


                        reject(
                            new Error(
                                "La conexión con Google tardó demasiado. Revise Internet e intente nuevamente."
                            )
                        );

                    },
                    API_TIMEOUT_MS
                );


            API_PENDING_REQUESTS.set(
                requestId,
                {
                    resolve,
                    reject,
                    timeoutId,
                    form,
                    iframe
                }
            );


            form.submit();
        }
    );
}


/* =========================================================
   CONSULTAR TODOS LOS REGISTROS
   ========================================================= */

async function getAllRecordsFromServer() {

    const result =
        await callApi(
            "getAllRecords"
        );


    return Array.isArray(
        result.records
    )

        ? result.records

        : [];
}


/* =========================================================
   CONSULTAR REGISTROS POR VEHÍCULO
   ========================================================= */

async function getRecordsByVehicleFromServer(
    vehicle
) {

    const result =
        await callApi(
            "getRecordsByVehicle",
            {
                vehicle
            }
        );


    return Array.isArray(
        result.records
    )

        ? result.records

        : [];
}


/* =========================================================
   CONSULTAR REGISTRO POR ID
   ========================================================= */

async function getRecordByIdFromServer(
    id
) {

    const result =
        await callApi(
            "getRecordById",
            {
                id
            }
        );


    return result.record ||
        null;
}


/* =========================================================
   GUARDAR REGISTRO
   ========================================================= */

async function saveRecordOnServer(
    record,
    mode
) {

    const result =
        await callApi(
            "saveRecord",
            {
                record,
                mode
            }
        );


    if (
        !result.record
    ) {

        throw new Error(
            "Google no devolvió el registro guardado."
        );
    }


    return result.record;
}


/* =========================================================
   PROBAR SERVIDOR
   ========================================================= */

async function pingServer() {

    return callApi(
        "ping"
    );
}


/* =========================================================
   MENÚ
   ========================================================= */

function toggleMenu() {

    const menu =
        document.getElementById(
            "sideMenu"
        );


    if (
        menu
    ) {

        menu.classList.toggle(
            "open"
        );
    }
}


/* =========================================================
   ESTADO DE CONEXIÓN
   ========================================================= */

function setConnectionStatus(
    text,
    online
) {

    const element =
        document.getElementById(
            "connectionStatus"
        );


    if (
        !element
    ) {

        return;
    }


    element.textContent =
        text;


    element.className =
        online

            ? "connection online"

            : "connection offline";
}


function updateConnection() {

    setConnectionStatus(
        navigator.onLine

            ? "En línea"

            : "Sin conexión",

        navigator.onLine
    );
}


async function verifyServerConnection() {

    if (
        !navigator.onLine
    ) {

        updateConnection();

        return;
    }


    try {

        await pingServer();


        setConnectionStatus(
            "En línea",
            true
        );


    } catch (
    error
    ) {

        console.error(
            "No fue posible conectar con Google Apps Script.",
            error
        );


        setConnectionStatus(
            "Sin conexión con el servidor",
            false
        );
    }
}


window.addEventListener(
    "online",
    verifyServerConnection
);


window.addEventListener(
    "offline",
    updateConnection
);


/* =========================================================
   FECHA
   ========================================================= */

function formatDate(
    date
) {

    const pad =
        number =>
            String(
                number
            ).padStart(
                2,
                "0"
            );


    return (
        date.getFullYear() +
        "-" +
        pad(
            date.getMonth() + 1
        ) +
        "-" +
        pad(
            date.getDate()
        ) +
        " " +
        pad(
            date.getHours()
        ) +
        ":" +
        pad(
            date.getMinutes()
        )
    );
}


/* =========================================================
   PLACA AUTOMÁTICA
   ========================================================= */

function updatePlate() {

    const select =
        document.getElementById(
            "vehiculo"
        );


    const plate =
        document.getElementById(
            "placa"
        );


    if (
        !select ||
        !plate
    ) {

        return;
    }


    const vehicle =
        VEHICLES.find(
            item =>
                item.nombre ===
                select.value
        );


    plate.value =
        vehicle

            ? vehicle.placa

            : "";
}


/* =========================================================
   PROTECCIÓN DE TEXTO
   ========================================================= */

function esc(
    value
) {

    return String(
        value ?? ""
    ).replace(
        /[&<>"']/g,
        character => {

            const replacements = {

                "&":
                    "&amp;",

                "<":
                    "&lt;",

                ">":
                    "&gt;",

                '"':
                    "&quot;",

                "'":
                    "&#039;"

            };


            return replacements[
                character
            ];
        }
    );
}


function escapeJs(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /\\/g,
            "\\\\"
        )
        .replace(
            /'/g,
            "\\'"
        );
}


/* =========================================================
   NORMALIZAR PUNTOS
   ========================================================= */

function normalizeReviewPoints(
    points
) {

    if (
        Array.isArray(
            points
        )
    ) {

        return points
            .map(
                point =>
                    String(
                        point || ""
                    ).trim()
            )
            .filter(
                Boolean
            );
    }


    if (
        typeof points ===
        "string"
    ) {

        return points
            .split(
                "|"
            )
            .map(
                point =>
                    point.trim()
            )
            .filter(
                Boolean
            );
    }


    return [];
}


/* =========================================================
   COMPROBAR SI UN REGISTRO TIENE FOTOGRAFÍAS
   ========================================================= */

function hasRecordPhotos(
    record
) {

    if (
        !record
    ) {

        return false;
    }


    const images =
        Array.isArray(
            record.imagenes
        )

            ? record.imagenes.filter(
                image =>
                    Boolean(
                        image
                    )
            )

            : [];


    const folderUrl =
        String(
            record.carpetaFotosUrl || ""
        ).trim();


    /*
        Esto permite manejar también los registros antiguos.

        Si antiguamente se creó una carpeta vacía,
        pero FotosJSON está vacío, se considera que
        NO tiene fotografías.
    */

    return (
        images.length > 0 &&
        folderUrl !== ""
    );
}


/* =========================================================
   PÁGINA DE REGISTROS
   ========================================================= */

async function renderRecordsPage() {

    const root =
        document.getElementById(
            "recordsPage"
        );


    if (
        !root
    ) {

        return;
    }


    const vehicle =
        new URLSearchParams(
            window.location.search
        ).get(
            "vehicle"
        );


    if (
        !vehicle
    ) {

        renderVehicleSelection();

        return;
    }


    await renderVehicleRecords(
        vehicle
    );
}


/* =========================================================
   SELECCIÓN DE VEHÍCULO
   ========================================================= */

function renderVehicleSelection() {

    const root =
        document.getElementById(
            "recordsPage"
        );


    if (
        !root
    ) {

        return;
    }


    root.innerHTML = `

        <div class="nav-actions">

            <a
                href="index.html"
                class="btn-back">

                Volver al inicio

            </a>

        </div>


        <div class="page-head">

            <div>

                <span class="eyebrow">
                    REGISTRO DE REVISIONES
                </span>


                <h1>
                    Seleccione un vehículo
                </h1>


                <p>
                    Seleccione el vehículo cuyos registros desea consultar.
                </p>

            </div>

        </div>


        <div class="vehicle-selection-grid">

            ${VEHICLES.map(
        vehicle => `

                    <button
                        type="button"
                        class="vehicle-selection-card"
                        onclick="selectVehicle('${escapeJs(vehicle.nombre)}')">

                        <div class="vehicle-selection-content">

                            <span class="vehicle-selection-label">
                                VEHÍCULO
                            </span>


                            <h2>
                                ${esc(vehicle.nombre)}
                            </h2>


                            <p>
                                Placa: ${esc(vehicle.placa)}
                            </p>


                            <span class="vehicle-selection-action">
                                Consultar registros
                            </span>

                        </div>

                    </button>

                `
    ).join("")}

        </div>

    `;
}


function selectVehicle(
    vehicleName
) {

    window.location.href =
        "registros.html?vehicle=" +
        encodeURIComponent(
            vehicleName
        );
}


function renderVehicles() {

    renderVehicleSelection();
}


/* =========================================================
   REGISTROS DE UN VEHÍCULO
   ========================================================= */

async function renderVehicleRecords(
    vehicleName
) {

    const root =
        document.getElementById(
            "recordsPage"
        );


    if (
        !root
    ) {

        return;
    }


    const vehicle =
        VEHICLES.find(
            item =>
                item.nombre ===
                vehicleName
        );


    if (
        !vehicle
    ) {

        root.innerHTML = `

            <div class="nav-actions">

                <a
                    href="registros.html"
                    class="btn-back">

                    Volver

                </a>


                <a
                    href="index.html"
                    class="btn-back">

                    Volver al inicio

                </a>

            </div>


            <div class="empty-state">

                <h1>
                    Vehículo no encontrado
                </h1>


                <p>
                    El vehículo solicitado no existe.
                </p>

            </div>

        `;


        return;
    }


    root.innerHTML = `

        <div class="nav-actions">

            <a
                href="registros.html"
                class="btn-back">

                Volver

            </a>


            <a
                href="index.html"
                class="btn-back">

                Volver al inicio

            </a>

        </div>


        <div class="page-head">

            <div>

                <span class="eyebrow">
                    REGISTRO DE REVISIONES
                </span>


                <h1>
                    ${esc(vehicle.nombre)}
                </h1>


                <p>
                    Placa: ${esc(vehicle.placa)}
                </p>

            </div>

        </div>


        <section class="record-filters">

            <div class="record-filter-title">

                <h2>
                    Buscar registros
                </h2>


                <p>
                    Puede utilizar uno o varios filtros.
                </p>

            </div>


            <div class="record-filter-grid">

                <label>

                    Fecha

                    <input
                        type="date"
                        id="filterDate">

                </label>


                <label>

                    Quién utilizó el vehículo

                    <input
                        type="text"
                        id="filterUser"
                        placeholder="Buscar por usuario">

                </label>


                <label>

                    Responsable de la Inspección

                    <input
                        type="text"
                        id="filterResponsible"
                        placeholder="Buscar por responsable">

                </label>


                <label>

                    ID del registro

                    <input
                        type="text"
                        id="filterId"
                        maxlength="6"
                        placeholder="Ejemplo: A7K92P"
                        autocomplete="off">

                </label>

            </div>


            <div class="search-actions">

                <button
                    type="button"
                    class="btn primary"
                    onclick="filterVehicleRecords()">

                    Buscar

                </button>


                <button
                    type="button"
                    class="btn secondary"
                    onclick="clearVehicleFilters()">

                    Limpiar

                </button>

            </div>

        </section>


        <div
            id="vehicleRecordsList"
            class="records-list">

            <div class="empty-state">

                <p>
                    Cargando registros...
                </p>

            </div>

        </div>

    `;


    try {

        const records =
            await getRecordsByVehicleFromServer(
                vehicleName
            );


        records.sort(
            (
                first,
                second
            ) =>
                String(
                    second.fechaHora || ""
                ).localeCompare(
                    String(
                        first.fechaHora || ""
                    )
                )
        );


        window.currentVehicleRecords =
            records;


        renderRecordList(
            records
        );


    } catch (
    error
    ) {

        console.error(
            "Error al cargar registros.",
            error
        );


        const list =
            document.getElementById(
                "vehicleRecordsList"
            );


        if (
            list
        ) {

            list.innerHTML = `

                <div class="empty-state">

                    <h2>
                        No fue posible cargar los registros
                    </h2>


                    <p>
                        ${esc(error.message)}
                    </p>


                    <button
                        type="button"
                        class="btn primary"
                        onclick="renderVehicleRecords('${escapeJs(vehicleName)}')">

                        Intentar nuevamente

                    </button>

                </div>

            `;
        }
    }
}


/* =========================================================
   LISTA DE REGISTROS
   ========================================================= */

function renderRecordList(
    records
) {

    const list =
        document.getElementById(
            "vehicleRecordsList"
        );


    if (
        !list
    ) {

        return;
    }


    if (
        !Array.isArray(
            records
        ) ||
        records.length === 0
    ) {

        list.innerHTML = `

            <div class="empty-state">

                <h2>
                    No hay registros
                </h2>


                <p>
                    No existen revisiones que coincidan con la búsqueda.
                </p>


                <a
                    href="mantenimiento.html"
                    class="btn primary">

                    Crear registro de revisión

                </a>

            </div>

        `;


        return;
    }


    list.innerHTML =
        records.map(
            record => `

                <article class="record-card">

                    <div class="record-card-top">

                        <div>

                            <span class="record-label">
                                REGISTRO
                            </span>


                            <h2>
                                ${esc(record.id)}
                            </h2>

                        </div>


                        <div class="record-vehicle">

                            <strong>
                                ${esc(record.vehiculo)}
                            </strong>


                            <span>
                                ${esc(record.placa)}
                            </span>

                        </div>

                    </div>


                    <div class="record-data-grid">

                        <div class="record-data">

                            <span>
                                Fecha y hora
                            </span>


                            <strong>
                                ${esc(record.fechaHora || "Sin información")}
                            </strong>

                        </div>


                        <div class="record-data">

                            <span>
                                El carro lo utilizó
                            </span>


                            <strong>
                                ${esc(record.usuario || "Sin información")}
                            </strong>

                        </div>


                        <div class="record-data">

                            <span>
                                Responsable de la Inspección
                            </span>


                            <strong>
                                ${esc(record.responsable || "Sin información")}
                            </strong>

                        </div>

                    </div>


                    <div class="record-card-actions">

                        <a
                            href="detalle.html?id=${encodeURIComponent(record.id)}"
                            class="btn primary">

                            Consultar registro

                        </a>

                    </div>

                </article>

            `
        ).join("");
}


/* =========================================================
   FILTROS
   ========================================================= */

function filterVehicleRecords() {

    const records =
        window.currentVehicleRecords ||
        [];


    const date =
        document.getElementById(
            "filterDate"
        )?.value || "";


    const user =
        document.getElementById(
            "filterUser"
        )?.value
            .trim()
            .toLowerCase() || "";


    const responsible =
        document.getElementById(
            "filterResponsible"
        )?.value
            .trim()
            .toLowerCase() || "";


    const id =
        document.getElementById(
            "filterId"
        )?.value
            .trim()
            .toUpperCase() || "";


    const filtered =
        records.filter(
            record => (

                (
                    !date ||
                    String(
                        record.fechaHora || ""
                    ).startsWith(
                        date
                    )
                ) &&

                (
                    !user ||
                    String(
                        record.usuario || ""
                    )
                        .toLowerCase()
                        .includes(
                            user
                        )
                ) &&

                (
                    !responsible ||
                    String(
                        record.responsable || ""
                    )
                        .toLowerCase()
                        .includes(
                            responsible
                        )
                ) &&

                (
                    !id ||
                    String(
                        record.id || ""
                    )
                        .toUpperCase()
                        .includes(
                            id
                        )
                )

            )
        );


    renderRecordList(
        filtered
    );
}


/* =========================================================
   LIMPIAR FILTROS
   ========================================================= */

function clearVehicleFilters() {

    [
        "filterDate",
        "filterUser",
        "filterResponsible",
        "filterId"
    ].forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );


            if (
                element
            ) {

                element.value =
                    "";
            }
        }
    );


    renderRecordList(
        window.currentVehicleRecords ||
        []
    );
}


/* =========================================================
   FORMULARIO
   ========================================================= */

async function initMaintenanceForm() {

    const form =
        document.getElementById(
            "maintenanceForm"
        );


    if (
        !form
    ) {

        return;
    }


    window._existingImages =
        [];


    window._existingPhotoFolderUrl =
        "";


    window._pendingPhotoData =
        [];


    window._lastSaveWasEditing =
        null;


    const id =
        new URLSearchParams(
            window.location.search
        ).get(
            "id"
        );


    if (
        id
    ) {

        await loadRecord(
            id
        );


    } else {

        const dateInput =
            document.getElementById(
                "fechaHora"
            );


        if (
            dateInput
        ) {

            dateInput.value =
                formatDate(
                    new Date()
                );
        }
    }


    document
        .querySelectorAll(
            '.choice[data-group="usuario"]'
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        document
                            .querySelectorAll(
                                '.choice[data-group="usuario"]'
                            )
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "selected"
                                    )
                            );


                        this.classList.add(
                            "selected"
                        );


                        const hidden =
                            document.getElementById(
                                "usuario"
                            );


                        if (
                            hidden
                        ) {

                            hidden.value =
                                this.dataset.value;
                        }
                    }
                );
            }
        );


    document
        .querySelectorAll(
            ".condition"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        document
                            .querySelectorAll(
                                ".condition"
                            )
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "selected"
                                    )
                            );


                        this.classList.add(
                            "selected"
                        );


                        const hidden =
                            document.getElementById(
                                "condicion"
                            );


                        if (
                            hidden
                        ) {

                            hidden.value =
                                this.dataset.value;
                        }


                        toggleConditionComment();
                    }
                );
            }
        );


    document
        .querySelectorAll(
            ".multi-choice"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        this.classList.toggle(
                            "selected"
                        );


                        updateSelectedPointsHidden();
                    }
                );
            }
        );


    const imageInput =
        document.getElementById(
            "imagenes"
        );


    if (
        imageInput
    ) {

        imageInput.addEventListener(
            "change",
            previewImages
        );
    }


    form.addEventListener(
        "submit",
        saveMaintenanceForm
    );


    updateConnection();
}


/* =========================================================
   ACTUALIZAR PUNTOS OCULTOS
   ========================================================= */

function updateSelectedPointsHidden() {

    const hidden =
        document.getElementById(
            "puntosHidden"
        );


    if (
        !hidden
    ) {

        return;
    }


    hidden.value =
        [
            ...document.querySelectorAll(
                ".multi-choice.selected"
            )
        ]
            .map(
                item =>
                    item.dataset.value
            )
            .join(
                "|"
            );
}


/* =========================================================
   GUARDAR FORMULARIO
   ========================================================= */

async function saveMaintenanceForm(
    event
) {

    event.preventDefault();


    const form =
        event.currentTarget;


    const submit =
        form.querySelector(
            'button[type="submit"]'
        );


    const originalText =
        submit

            ? submit.textContent

            : "";


    const user =
        document.getElementById(
            "usuario"
        )?.value || "";


    const condition =
        document.getElementById(
            "condicion"
        )?.value || "";


    const conditionComment =
        document.getElementById(
            "comentarioCondicion"
        )?.value
            .trim() || "";


    if (
        !user
    ) {

        alert(
            "Seleccione quién utilizará el vehículo."
        );


        return;
    }


    if (
        !condition
    ) {

        alert(
            "Seleccione la condición del vehículo."
        );


        return;
    }


    if (
        (
            condition === "Regular" ||
            condition === "Sucio"
        ) &&
        !conditionComment
    ) {

        alert(
            "Debe escribir un comentario cuando la condición sea Regular o Sucio."
        );


        return;
    }


    if (
        !navigator.onLine
    ) {

        alert(
            "Se necesita conexión a Internet para guardar el registro en Google."
        );


        return;
    }


    const existingId =
        document.getElementById(
            "recordId"
        )?.value
            .trim() || "";


    const isEditing =
        Boolean(
            existingId
        );


    const record = {

        id:
            existingId,

        vehiculo:
            document.getElementById(
                "vehiculo"
            )?.value || "",

        placa:
            document.getElementById(
                "placa"
            )?.value || "",

        fechaHora:
            document.getElementById(
                "fechaHora"
            )?.value || "",

        kilometraje:
            document.getElementById(
                "kilometraje"
            )?.value || "",

        usuario:
            user,

        responsable:
            document.getElementById(
                "responsable"
            )?.value
                .trim() || "",

        puntos:
            [
                ...document.querySelectorAll(
                    ".multi-choice.selected"
                )
            ].map(
                item =>
                    item.dataset.value
            ),

        condicion:
            condition,

        comentarioCondicion:
            conditionComment,

        motivo:
            document.getElementById(
                "motivo"
            )?.value || "",

        comentario:
            document.getElementById(
                "comentario"
            )?.value
                .trim() || "",

        nuevasFotos:
            Array.isArray(
                window._pendingPhotoData
            )

                ? window._pendingPhotoData

                : []

    };


    if (
        submit
    ) {

        submit.disabled =
            true;


        submit.textContent =
            isEditing

                ? "Actualizando registro..."

                : "Guardando registro...";
    }


    showSavingConfirmation(
        isEditing
    );


    try {

        const savedRecord =
            await saveRecordOnServer(
                record,
                isEditing

                    ? "update"

                    : "create"
            );


        window._existingImages =
            Array.isArray(
                savedRecord.imagenes
            )

                ? savedRecord.imagenes

                : [];


        window._existingPhotoFolderUrl =
            savedRecord.carpetaFotosUrl ||
            "";


        window._pendingPhotoData =
            [];


        const recordId =
            document.getElementById(
                "recordId"
            );


        if (
            recordId
        ) {

            recordId.value =
                savedRecord.id;
        }


        renderImagePreview();


        showSaveConfirmation(
            savedRecord,
            isEditing
        );


    } catch (
    error
    ) {

        console.error(
            "Error al guardar el registro.",
            error
        );


        hideSaveConfirmation();


        alert(
            error.message ||
            "No fue posible guardar el registro."
        );


    } finally {

        if (
            submit
        ) {

            submit.disabled =
                false;


            submit.textContent =
                originalText;
        }
    }
}


/* =========================================================
   MOSTRAR CUADRO MIENTRAS GUARDA
   ========================================================= */

function showSavingConfirmation(
    isEditing
) {

    const modal =
        document.getElementById(
            "saveConfirmation"
        );


    if (
        !modal
    ) {

        return;
    }


    const title =
        document.getElementById(
            "confirmationTitle"
        );


    const message =
        document.getElementById(
            "confirmationMessage"
        );


    const id =
        document.getElementById(
            "confirmationRecordId"
        );


    const idBox =
        modal.querySelector(
            ".confirmation-id-box"
        );


    const buttons =
        modal.querySelectorAll(
            ".confirmation-actions button"
        );


    if (
        title
    ) {

        title.textContent =
            isEditing

                ? "Actualizando registro"

                : "Guardando registro";
    }


    if (
        message
    ) {

        message.textContent =
            isEditing

                ? "Estamos actualizando la información. Espere un momento."

                : "Estamos guardando la información. Espere un momento.";
    }


    if (
        id
    ) {

        id.textContent =
            "";
    }


    if (
        idBox
    ) {

        idBox.style.display =
            "none";
    }


    buttons.forEach(
        button => {

            button.disabled =
                true;
        }
    );


    modal.classList.remove(
        "hidden"
    );


    document.body.classList.add(
        "modal-open"
    );
}


/* =========================================================
   CONFIRMACIÓN DE GUARDADO
   ========================================================= */

function showSaveConfirmation(
    record,
    isEditing
) {

    const modal =
        document.getElementById(
            "saveConfirmation"
        );


    window._lastSaveWasEditing =
        isEditing;


    if (
        !modal
    ) {

        alert(
            isEditing

                ? "Registro actualizado correctamente."

                : "Registro creado correctamente."
        );


        return;
    }


    const title =
        document.getElementById(
            "confirmationTitle"
        );


    const message =
        document.getElementById(
            "confirmationMessage"
        );


    const id =
        document.getElementById(
            "confirmationRecordId"
        );


    const viewRecords =
        document.getElementById(
            "confirmationViewRecords"
        );


    const idBox =
        modal.querySelector(
            ".confirmation-id-box"
        );


    const buttons =
        modal.querySelectorAll(
            ".confirmation-actions button"
        );


    if (
        idBox
    ) {

        idBox.style.display =
            "";
    }


    buttons.forEach(
        button => {

            button.disabled =
                false;
        }
    );


    if (
        title
    ) {

        title.textContent =
            isEditing

                ? "Registro actualizado correctamente"

                : "Registro creado correctamente";
    }


    if (
        message
    ) {

        message.textContent =
            isEditing

                ? "Los cambios fueron guardados correctamente."

                : "La revisión fue registrada correctamente.";
    }


    if (
        id
    ) {

        id.textContent =
            record.id;
    }


    if (
        viewRecords
    ) {

        viewRecords.onclick =
            () => {

                window.location.href =
                    "registros.html?vehicle=" +
                    encodeURIComponent(
                        record.vehiculo
                    );
            };
    }


    modal.classList.remove(
        "hidden"
    );


    document.body.classList.add(
        "modal-open"
    );
}


/* =========================================================
   OCULTAR CUADRO
   ========================================================= */

function hideSaveConfirmation() {

    const modal =
        document.getElementById(
            "saveConfirmation"
        );


    if (
        modal
    ) {

        modal.classList.add(
            "hidden"
        );
    }


    document.body.classList.remove(
        "modal-open"
    );
}


/* =========================================================
   CERRAR CONFIRMACIÓN
   ========================================================= */

function closeSaveConfirmation() {

    hideSaveConfirmation();


    if (
        window._lastSaveWasEditing ===
        false
    ) {

        resetMaintenanceForm();
    }
}


/* =========================================================
   LIMPIAR FORMULARIO
   ========================================================= */

function resetMaintenanceForm() {

    const form =
        document.getElementById(
            "maintenanceForm"
        );


    if (
        !form
    ) {

        return;
    }


    form.reset();


    const recordId =
        document.getElementById(
            "recordId"
        );


    if (
        recordId
    ) {

        recordId.value =
            "";
    }


    const vehicle =
        document.getElementById(
            "vehiculo"
        );


    if (
        vehicle
    ) {

        vehicle.disabled =
            false;


        vehicle.value =
            "";
    }


    const plate =
        document.getElementById(
            "placa"
        );


    if (
        plate
    ) {

        plate.value =
            "";
    }


    const dateInput =
        document.getElementById(
            "fechaHora"
        );


    if (
        dateInput
    ) {

        dateInput.value =
            formatDate(
                new Date()
            );
    }


    const user =
        document.getElementById(
            "usuario"
        );


    if (
        user
    ) {

        user.value =
            "";
    }


    document
        .querySelectorAll(
            '.choice[data-group="usuario"]'
        )
        .forEach(
            button => {

                button.classList.remove(
                    "selected"
                );
            }
        );


    document
        .querySelectorAll(
            ".multi-choice"
        )
        .forEach(
            button => {

                button.classList.remove(
                    "selected"
                );
            }
        );


    const points =
        document.getElementById(
            "puntosHidden"
        );


    if (
        points
    ) {

        points.value =
            "";
    }


    const condition =
        document.getElementById(
            "condicion"
        );


    if (
        condition
    ) {

        condition.value =
            "";
    }


    document
        .querySelectorAll(
            ".condition"
        )
        .forEach(
            button => {

                button.classList.remove(
                    "selected"
                );
            }
        );


    const conditionComment =
        document.getElementById(
            "comentarioCondicion"
        );


    if (
        conditionComment
    ) {

        conditionComment.value =
            "";


        conditionComment.required =
            false;
    }


    const conditionWrap =
        document.getElementById(
            "conditionCommentWrap"
        );


    if (
        conditionWrap
    ) {

        conditionWrap.classList.add(
            "hidden"
        );
    }


    const imageInput =
        document.getElementById(
            "imagenes"
        );


    if (
        imageInput
    ) {

        imageInput.value =
            "";
    }


    window._existingImages =
        [];


    window._existingPhotoFolderUrl =
        "";


    window._pendingPhotoData =
        [];


    renderImagePreview();


    const title =
        document.getElementById(
            "formTitle"
        );


    if (
        title
    ) {

        title.textContent =
            "Nueva revisión diaria";
    }


    window._lastSaveWasEditing =
        false;
}


/* =========================================================
   CREAR OTRO REGISTRO
   ========================================================= */

function createAnotherRecord() {

    window.location.href =
        "mantenimiento.html";
}


/* =========================================================
   COMENTARIO DE CONDICIÓN
   ========================================================= */

function toggleConditionComment() {

    const condition =
        document.getElementById(
            "condicion"
        );


    const wrapper =
        document.getElementById(
            "conditionCommentWrap"
        );


    const comment =
        document.getElementById(
            "comentarioCondicion"
        );


    if (
        !condition ||
        !wrapper ||
        !comment
    ) {

        return;
    }


    const required =
        condition.value === "Regular" ||
        condition.value === "Sucio";


    wrapper.classList.toggle(
        "hidden",
        !required
    );


    comment.required =
        required;


    if (
        !required
    ) {

        comment.value =
            "";
    }
}


/* =========================================================
   FOTOGRAFÍAS DEL FORMULARIO
   ========================================================= */

async function previewImages(
    event
) {

    const files =
        Array.from(
            event.target.files ||
            []
        );


    if (
        !files.length
    ) {

        return;
    }


    const current =
        Array.isArray(
            window._pendingPhotoData
        )

            ? window._pendingPhotoData.length

            : 0;


    if (
        current +
        files.length >
        10
    ) {

        event.target.value =
            "";


        alert(
            "Puede agregar un máximo de 10 fotografías nuevas por cada guardado."
        );


        return;
    }


    try {

        const newImages =
            [];


        for (
            const file of files
        ) {

            newImages.push(
                await compressImageFile(
                    file
                )
            );
        }


        window._pendingPhotoData =
            Array.isArray(
                window._pendingPhotoData
            )

                ? window._pendingPhotoData

                : [];


        window._pendingPhotoData.push(
            ...newImages
        );


        renderImagePreview();


    } catch (
    error
    ) {

        console.error(
            "Error al procesar imágenes.",
            error
        );


        alert(
            error.message ||
            "No fue posible procesar una de las imágenes seleccionadas."
        );
    }


    event.target.value =
        "";
}


/* =========================================================
   COMPRIMIR FOTOGRAFÍA
   ========================================================= */

async function compressImageFile(
    file
) {

    if (
        !file ||
        !String(
            file.type || ""
        ).startsWith(
            "image/"
        )
    ) {

        throw new Error(
            "Seleccione únicamente archivos de imagen."
        );
    }


    const source =
        await readFileAsDataUrl(
            file
        );


    const image =
        await loadImageElement(
            source
        );


    const maxDimension =
        1600;


    let width =
        image.naturalWidth ||
        image.width;


    let height =
        image.naturalHeight ||
        image.height;


    if (
        !width ||
        !height
    ) {

        throw new Error(
            "No fue posible obtener las dimensiones de una fotografía."
        );
    }


    const scale =
        Math.min(
            1,
            maxDimension /
            Math.max(
                width,
                height
            )
        );


    width =
        Math.max(
            1,
            Math.round(
                width * scale
            )
        );


    height =
        Math.max(
            1,
            Math.round(
                height * scale
            )
        );


    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        width;


    canvas.height =
        height;


    const context =
        canvas.getContext(
            "2d"
        );


    if (
        !context
    ) {

        throw new Error(
            "No fue posible preparar la fotografía."
        );
    }


    context.drawImage(
        image,
        0,
        0,
        width,
        height
    );


    return {

        name:
            createJpegFileName(
                file.name
            ),

        data:
            canvas.toDataURL(
                "image/jpeg",
                0.78
            )

    };
}


/* =========================================================
   NOMBRE JPG
   ========================================================= */

function createJpegFileName(
    name
) {

    const base =
        String(
            name || "foto"
        )
            .replace(
                /\.[^.]+$/,
                ""
            )
            .trim() ||
        "foto";


    return base +
        ".jpg";
}


/* =========================================================
   LEER ARCHIVO
   ========================================================= */

function readFileAsDataUrl(
    file
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const reader =
                new FileReader();


            reader.onload =
                () =>
                    resolve(
                        reader.result
                    );


            reader.onerror =
                () =>
                    reject(
                        new Error(
                            "No fue posible leer una fotografía."
                        )
                    );


            reader.readAsDataURL(
                file
            );
        }
    );
}


/* =========================================================
   CARGAR IMAGEN
   ========================================================= */

function loadImageElement(
    source
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const image =
                new Image();


            image.onload =
                () =>
                    resolve(
                        image
                    );


            image.onerror =
                () =>
                    reject(
                        new Error(
                            "El navegador no pudo procesar una fotografía. Intente utilizar JPG, PNG o WEBP."
                        )
                    );


            image.src =
                source;
        }
    );
}


/* =========================================================
   OBTENER URL DE IMAGEN
   ========================================================= */

function getImageSource(
    image
) {

    if (
        typeof image ===
        "string"
    ) {

        return image;
    }


    if (
        !image ||
        typeof image !==
        "object"
    ) {

        return "";
    }


    return (
        image.data ||
        image.thumbnailUrl ||
        image.url ||
        ""
    );
}


/* =========================================================
   PREVISUALIZACIÓN DE FOTOGRAFÍAS

   Solo mostramos en el formulario las fotografías
   NUEVAS elegidas en el dispositivo.

   Las fotografías antiguas de Drive no se cargan
   como miniaturas para evitar imágenes rotas.
   ========================================================= */

function renderImagePreview() {

    const preview =
        document.getElementById(
            "preview"
        );


    if (
        !preview
    ) {

        return;
    }


    const existing =
        Array.isArray(
            window._existingImages
        )

            ? window._existingImages

            : [];


    const pending =
        Array.isArray(
            window._pendingPhotoData
        )

            ? window._pendingPhotoData

            : [];


    let html =
        "";


    if (
        existing.length > 0
    ) {

        html += `

            <p class="note">

                Este registro ya tiene ${existing.length}
                fotografía${existing.length === 1 ? "" : "s"}
                guardada${existing.length === 1 ? "" : "s"}.
                Se conservarán al actualizar el registro.

            </p>

        `;
    }


    html +=
        pending
            .map(
                image => {

                    const source =
                        image &&
                            image.data

                            ? image.data

                            : "";


                    return source

                        ? `

                            <img
                                src="${esc(source)}"
                                alt="Fotografía nueva seleccionada">

                        `

                        : "";
                }
            )
            .join(
                ""
            );


    preview.innerHTML =
        html;
}


/* =========================================================
   CARGAR REGISTRO PARA EDITAR
   ========================================================= */

async function loadRecord(
    id
) {

    try {

        const record =
            await getRecordByIdFromServer(
                id
            );


        if (
            !record
        ) {

            alert(
                "Registro no encontrado."
            );


            window.location.href =
                "registros.html";


            return;
        }


        const title =
            document.getElementById(
                "formTitle"
            );


        if (
            title
        ) {

            title.textContent =
                "Editar revisión diaria";
        }


        const recordId =
            document.getElementById(
                "recordId"
            );


        if (
            recordId
        ) {

            recordId.value =
                record.id;
        }


        const vehicle =
            document.getElementById(
                "vehiculo"
            );


        if (
            vehicle
        ) {

            vehicle.value =
                record.vehiculo;


            vehicle.disabled =
                true;
        }


        updatePlate();


        const fechaHora =
            document.getElementById(
                "fechaHora"
            );


        if (
            fechaHora
        ) {

            fechaHora.value =
                record.fechaHora ||
                "";
        }


        const kilometraje =
            document.getElementById(
                "kilometraje"
            );


        if (
            kilometraje
        ) {

            kilometraje.value =
                record.kilometraje ||
                "";
        }


        const usuario =
            document.getElementById(
                "usuario"
            );


        if (
            usuario
        ) {

            usuario.value =
                record.usuario ||
                "";
        }


        document
            .querySelectorAll(
                '[data-group="usuario"]'
            )
            .forEach(
                button => {

                    button.classList.toggle(
                        "selected",
                        button.dataset.value ===
                        record.usuario
                    );
                }
            );


        const responsable =
            document.getElementById(
                "responsable"
            );


        if (
            responsable
        ) {

            responsable.value =
                record.responsable ||
                "";
        }


        const points =
            normalizeReviewPoints(
                record.puntos
            );


        document
            .querySelectorAll(
                ".multi-choice"
            )
            .forEach(
                button => {

                    button.classList.toggle(
                        "selected",
                        points.includes(
                            button.dataset.value
                        )
                    );
                }
            );


        updateSelectedPointsHidden();


        const condicion =
            document.getElementById(
                "condicion"
            );


        if (
            condicion
        ) {

            condicion.value =
                record.condicion ||
                "";
        }


        document
            .querySelectorAll(
                ".condition"
            )
            .forEach(
                button => {

                    button.classList.toggle(
                        "selected",
                        button.dataset.value ===
                        record.condicion
                    );
                }
            );


        const comentarioCondicion =
            document.getElementById(
                "comentarioCondicion"
            );


        if (
            comentarioCondicion
        ) {

            comentarioCondicion.value =
                record.comentarioCondicion ||
                "";
        }


        toggleConditionComment();


        const motivo =
            document.getElementById(
                "motivo"
            );


        if (
            motivo
        ) {

            motivo.value =
                record.motivo ||
                "";
        }


        const comentario =
            document.getElementById(
                "comentario"
            );


        if (
            comentario
        ) {

            comentario.value =
                record.comentario ||
                "";
        }


        window._existingImages =
            Array.isArray(
                record.imagenes
            )

                ? record.imagenes

                : [];


        window._existingPhotoFolderUrl =
            record.carpetaFotosUrl ||
            "";


        window._pendingPhotoData =
            [];


        renderImagePreview();


    } catch (
    error
    ) {

        console.error(
            "Error al cargar el registro.",
            error
        );


        alert(
            error.message ||
            "No fue posible cargar el registro."
        );


        window.location.href =
            "registros.html";
    }
}


/* =========================================================
   DETALLE DEL REGISTRO
   ========================================================= */

async function renderDetail() {

    const root =
        document.getElementById(
            "detail"
        );


    if (
        !root
    ) {

        return;
    }


    const id =
        new URLSearchParams(
            window.location.search
        ).get(
            "id"
        );


    if (
        !id
    ) {

        renderMissingRecord(
            root
        );


        return;
    }


    root.innerHTML = `

        <div class="empty-state">

            <p>
                Cargando registro...
            </p>

        </div>

    `;


    try {

        const record =
            await getRecordByIdFromServer(
                id
            );


        if (
            !record
        ) {

            renderMissingRecord(
                root
            );


            return;
        }


        const backUrl =
            "registros.html?vehicle=" +
            encodeURIComponent(
                record.vehiculo
            );


        const hasPhotos =
            hasRecordPhotos(
                record
            );


        root.innerHTML = `

            <div class="page-head detail-page-head">

                <div>

                    <span class="eyebrow">
                        FORMULARIO DE REVISIÓN DIARIA
                    </span>


                    <h1>
                        ${esc(record.vehiculo)}
                    </h1>


                    <p>
                        Consulta de la revisión registrada para este vehículo.
                    </p>

                </div>

            </div>


            <div class="detail-shell">


                <section class="detail-card">

                    <div class="detail-card-header">

                        <h2>
                            Información del vehículo
                        </h2>

                    </div>


                    <div class="vehicle-info-grid">


                        <div class="detail-info">

                            <span class="detail-info-label">
                                Vehículo
                            </span>


                            <strong>
                                ${esc(
            record.vehiculo ||
            "Sin información"
        )}
                            </strong>

                        </div>


                        <div class="detail-info">

                            <span class="detail-info-label">
                                Placa
                            </span>


                            <strong>
                                ${esc(
            record.placa ||
            "Sin información"
        )}
                            </strong>

                        </div>


                        <div class="detail-info">

                            <span class="detail-info-label">
                                Fecha y hora
                            </span>


                            <strong>
                                ${esc(
            record.fechaHora ||
            "Sin información"
        )}
                            </strong>

                        </div>


                        <div class="detail-info">

                            <span class="detail-info-label">
                                Kilometraje actual del vehículo
                            </span>


                            <strong>
                                ${esc(
            record.kilometraje ||
            "Sin información"
        )}
                            </strong>

                        </div>


                    </div>

                </section>


                <section class="detail-card detail-review-card">

                    <div class="detail-card-header">

                        <h2>
                            Información de la revisión
                        </h2>

                    </div>


                    <div class="detail-group detail-two-columns">


                        <div class="detail-data-block">

                            <span class="detail-info-label">
                                El carro lo utilizará
                            </span>


                            <strong>
                                ${esc(
            record.usuario ||
            "Sin información"
        )}
                            </strong>

                        </div>


                        <div class="detail-data-block">

                            <span class="detail-info-label">
                                Responsable de la Inspección
                            </span>


                            <strong>
                                ${esc(
            record.responsable ||
            "Sin información"
        )}
                            </strong>

                        </div>


                    </div>


                    <div class="detail-group">

                        <span class="detail-info-label detail-group-title">
                            Puntos revisados antes de usar el vehículo
                        </span>


                        ${renderSelectedReviewPoints(
            record.puntos
        )}

                    </div>


                    <div class="detail-group detail-two-columns">


                        <div class="detail-data-block">

                            <span class="detail-info-label">
                                Condición del vehículo
                            </span>


                            <strong>
                                ${esc(
            record.condicion ||
            "Sin información"
        )}
                            </strong>

                        </div>


                        <div class="detail-data-block">

                            <span class="detail-info-label">
                                Motivo por el que se utiliza el vehículo
                            </span>


                            <strong>
                                ${esc(
            record.motivo ||
            "Sin información"
        )}
                            </strong>

                        </div>


                    </div>


                    ${record.comentarioCondicion

                ? `

                            <div class="detail-group">

                                <span class="detail-info-label">
                                    Comentario sobre la condición
                                </span>


                                <p class="detail-text">
                                    ${esc(
                    record.comentarioCondicion
                )}
                                </p>

                            </div>

                        `

                : ""

            }


                    <div class="detail-group">

                        <span class="detail-info-label">
                            Comentario General
                        </span>


                        <p class="detail-text">

                            ${record.comentario

                ? esc(
                    record.comentario
                )

                : "Sin comentarios adicionales"

            }

                        </p>

                    </div>


                    <div class="detail-group detail-photo-group">

                        <span class="detail-info-label detail-group-title">
                            Fotografías
                        </span>


                        ${hasPhotos

                ? `

                                <div class="photo-folder-action">

                                    <a
                                        href="${esc(
                    record.carpetaFotosUrl
                )}"
                                        target="_blank"
                                        rel="noopener"
                                        class="btn secondary">

                                        Ver fotografías

                                    </a>

                                </div>

                            `

                : `

                                <p class="detail-no-photos">
                                    No se registraron fotografías para esta revisión.
                                </p>

                            `

            }

                    </div>


                    <div class="detail-card-actions">

                        <a
                            href="mantenimiento.html?id=${encodeURIComponent(
                record.id
            )}"
                            class="btn primary">

                            Editar registro

                        </a>

                    </div>


                </section>


            </div>


            <div class="nav-actions detail-bottom-navigation">

                <a
                    href="${backUrl}"
                    class="btn-back">

                    Volver

                </a>


                <a
                    href="index.html"
                    class="btn-back">

                    Volver al inicio

                </a>

            </div>

        `;


    } catch (
    error
    ) {

        console.error(
            "Error al cargar el detalle.",
            error
        );


        root.innerHTML = `

            <div class="empty-state">

                <h1>
                    No fue posible cargar el registro
                </h1>


                <p>
                    ${esc(
            error.message
        )}
                </p>

            </div>


            <div class="nav-actions detail-bottom-navigation">

                <a
                    href="registros.html"
                    class="btn-back">

                    Volver

                </a>


                <a
                    href="index.html"
                    class="btn-back">

                    Volver al inicio

                </a>

            </div>

        `;
    }
}

/* =========================================================
   REGISTRO NO ENCONTRADO
   ========================================================= */

function renderMissingRecord(
    root
) {

    root.innerHTML = `

        <div class="nav-actions">

            <a
                href="registros.html"
                class="btn-back">

                Volver

            </a>


            <a
                href="index.html"
                class="btn-back">

                Volver al inicio

            </a>

        </div>


        <div class="empty-state">

            <h1>
                Registro no encontrado
            </h1>


            <p>
                El registro solicitado no existe.
            </p>

        </div>

    `;
}


/* =========================================================
   PUNTOS REVISADOS DEL DETALLE
   ========================================================= */

function renderSelectedReviewPoints(
    points
) {

    const selected =
        normalizeReviewPoints(
            points
        );


    if (
        !selected.length
    ) {

        return `

            <p class="no-review-points">
                No se revisó ningún punto.
            </p>

        `;
    }


    return `

        <div class="selected-review-points">

            ${selected.map(
        point => `

                    <span class="selected-review-point">
                        ${esc(point)}
                    </span>

                `
    ).join("")}

        </div>

    `;
}


/* =========================================================
   EXCEL
   ========================================================= */

function toggleVehicleExport() {

    const scope =
        document.getElementById(
            "exportScope"
        );


    const wrap =
        document.getElementById(
            "exportVehicleWrap"
        );


    const select =
        document.getElementById(
            "exportVehicle"
        );


    const description =
        document.getElementById(
            "exportDescription"
        );


    if (
        !scope ||
        !wrap
    ) {

        return;
    }


    if (
        scope.value ===
        "all"
    ) {

        wrap.classList.add(
            "hidden"
        );


        if (
            select
        ) {

            select.value =
                "";
        }


        if (
            description
        ) {

            description.textContent =
                "El archivo incluirá todos los registros de revisión existentes.";
        }


    } else {

        wrap.classList.remove(
            "hidden"
        );


        if (
            description
        ) {

            description.textContent =
                "El archivo incluirá únicamente los registros del vehículo seleccionado.";
        }
    }
}


/* =========================================================
   DESCARGAR EXCEL
   ========================================================= */

async function exportExcel() {

    const button =
        document.getElementById(
            "downloadExcelButton"
        );


    const status =
        document.getElementById(
            "excelStatus"
        );


    const originalButtonText =
        button

            ? button.textContent

            : "Descargar archivo";


    if (
        typeof ExcelJS ===
        "undefined"
    ) {

        alert(
            "No fue posible cargar la herramienta de Excel. Revise su conexión a Internet y vuelva a cargar la página."
        );


        return;
    }


    const scopeElement =
        document.getElementById(
            "exportScope"
        );


    if (
        !scopeElement
    ) {

        alert(
            "No fue posible determinar los registros que desea descargar."
        );


        return;
    }


    if (
        button
    ) {

        button.disabled =
            true;


        button.textContent =
            "Preparando archivo...";
    }


    if (
        status
    ) {

        status.textContent =
            "Consultando los registros...";
    }


    try {

        const allRecords =
            await getAllRecordsFromServer();


        if (
            !Array.isArray(
                allRecords
            ) ||
            allRecords.length === 0
        ) {

            if (
                status
            ) {

                status.textContent =
                    "";
            }


            alert(
                "No existen registros para descargar."
            );


            return;
        }


        const scope =
            scopeElement.value;


        let selectedVehicle =
            "";


        let records =
            allRecords;


        if (
            scope ===
            "vehicle"
        ) {

            const vehicleElement =
                document.getElementById(
                    "exportVehicle"
                );


            selectedVehicle =
                vehicleElement

                    ? vehicleElement.value

                    : "";


            if (
                !selectedVehicle
            ) {

                if (
                    status
                ) {

                    status.textContent =
                        "";
                }


                alert(
                    "Seleccione el vehículo cuyos registros desea descargar."
                );


                return;
            }


            records =
                allRecords.filter(
                    record =>
                        record.vehiculo ===
                        selectedVehicle
                );


            if (
                records.length === 0
            ) {

                if (
                    status
                ) {

                    status.textContent =
                        "";
                }


                alert(
                    "El vehículo seleccionado todavía no tiene registros para descargar."
                );


                return;
            }
        }


        if (
            status
        ) {

            status.textContent =
                "Creando el archivo Excel...";
        }


        const workbook =
            new ExcelJS.Workbook();


        workbook.creator =
            "ASADA Orosi";


        workbook.created =
            new Date();


        const sheet =
            workbook.addWorksheet(
                "Registro de revisiones"
            );


        sheet.columns = [

            {
                header:
                    "ID",

                key:
                    "id",

                width:
                    12
            },


            {
                header:
                    "Vehículo",

                key:
                    "vehiculo",

                width:
                    27
            },


            {
                header:
                    "Placa",

                key:
                    "placa",

                width:
                    17
            },


            {
                header:
                    "Fecha y hora",

                key:
                    "fecha",

                width:
                    22
            },


            {
                header:
                    "El carro lo utilizó",

                key:
                    "usuario",

                width:
                    30
            },


            {
                header:
                    "Responsable de la Inspección",

                key:
                    "responsable",

                width:
                    35
            },


            {
                header:
                    "Kilometraje",

                key:
                    "kilometraje",

                width:
                    18
            },


            {
                header:
                    "Puntos revisados",

                key:
                    "puntos",

                width:
                    55
            },


            {
                header:
                    "Condición",

                key:
                    "condicion",

                width:
                    18
            },


            {
                header:
                    "Comentario de condición",

                key:
                    "comentarioCondicion",

                width:
                    40
            },


            {
                header:
                    "Motivo de uso",

                key:
                    "motivo",

                width:
                    40
            },


            {
                header:
                    "Comentario General",

                key:
                    "comentario",

                width:
                    45
            },


            {
                header:
                    "Fotografías",

                key:
                    "fotografias",

                width:
                    24
            }

        ];


        records.forEach(
            record => {

                const points =
                    normalizeReviewPoints(
                        record.puntos
                    );


                const hasPhotos =
                    hasRecordPhotos(
                        record
                    );


                const row =
                    sheet.addRow({

                        id:
                            record.id || "",

                        vehiculo:
                            record.vehiculo || "",

                        placa:
                            record.placa || "",

                        fecha:
                            record.fechaHora || "",

                        usuario:
                            record.usuario || "",

                        responsable:
                            record.responsable || "",

                        kilometraje:
                            record.kilometraje || "",

                        puntos:
                            points.length

                                ? points.join(", ")

                                : "No se revisó ningún punto",

                        condicion:
                            record.condicion || "",

                        comentarioCondicion:
                            record.comentarioCondicion || "",

                        motivo:
                            record.motivo || "",

                        comentario:
                            record.comentario || "",

                        fotografias:
                            hasPhotos

                                ? "Ver fotografías"

                                : ""

                    });


                if (
                    hasPhotos
                ) {

                    const photoCell =
                        row.getCell(
                            13
                        );


                    photoCell.value = {

                        text:
                            "Ver fotografías",

                        hyperlink:
                            record.carpetaFotosUrl

                    };


                    photoCell.font = {

                        underline:
                            true

                    };
                }
            }
        );


        const header =
            sheet.getRow(
                1
            );


        header.height =
            28;


        header.eachCell(
            cell => {

                cell.fill = {

                    type:
                        "pattern",

                    pattern:
                        "solid",

                    fgColor: {

                        argb:
                            "FF20CDB0"

                    }

                };


                cell.font = {

                    bold:
                        true,

                    color: {

                        argb:
                            "FF071512"

                    }

                };


                cell.alignment = {

                    vertical:
                        "middle",

                    horizontal:
                        "center",

                    wrapText:
                        true

                };


                cell.border = {

                    top: {
                        style:
                            "thin"
                    },

                    left: {
                        style:
                            "thin"
                    },

                    bottom: {
                        style:
                            "thin"
                    },

                    right: {
                        style:
                            "thin"
                    }

                };
            }
        );


        sheet.eachRow(
            (
                row,
                rowNumber
            ) => {

                if (
                    rowNumber ===
                    1
                ) {

                    return;
                }


                row.eachCell(
                    {
                        includeEmpty:
                            true
                    },

                    cell => {

                        cell.alignment = {

                            vertical:
                                "top",

                            wrapText:
                                true

                        };


                        cell.border = {

                            top: {
                                style:
                                    "thin"
                            },

                            left: {
                                style:
                                    "thin"
                            },

                            bottom: {
                                style:
                                    "thin"
                            },

                            right: {
                                style:
                                    "thin"
                            }

                        };
                    }
                );
            }
        );


        sheet.autoFilter = {

            from:
                "A1",

            to:
                "M1"

        };


        sheet.views = [

            {

                state:
                    "frozen",

                ySplit:
                    1

            }

        ];


        const buffer =
            await workbook.xlsx.writeBuffer();


        const blob =
            new Blob(
                [
                    buffer
                ],
                {
                    type:
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                }
            );


        const fileName =
            scope ===
                "all"

                ? (
                    "ASADA_Todos_los_Registros_" +
                    getExcelFileDate() +
                    ".xlsx"
                )

                : (
                    "ASADA_" +
                    safeFileName(
                        selectedVehicle
                    ) +
                    "_" +
                    getExcelFileDate() +
                    ".xlsx"
                );


        const downloadUrl =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href =
            downloadUrl;


        link.download =
            fileName;


        link.style.display =
            "none";


        document.body.appendChild(
            link
        );


        link.click();


        window.setTimeout(
            () => {

                URL.revokeObjectURL(
                    downloadUrl
                );


                if (
                    link.parentNode
                ) {

                    link.remove();
                }

            },
            2000
        );


        if (
            status
        ) {

            status.textContent =
                "Archivo generado correctamente.";
        }


    } catch (
    error
    ) {

        console.error(
            "Error al generar el Excel:",
            error
        );


        if (
            status
        ) {

            status.textContent =
                "No fue posible generar el archivo.";
        }


        alert(
            "No fue posible descargar el archivo Excel. " +
            (
                error &&
                    error.message

                    ? error.message

                    : "Ocurrió un error desconocido."
            )
        );


    } finally {

        if (
            button
        ) {

            button.disabled =
                false;


            button.textContent =
                originalButtonText;
        }
    }
}


/* =========================================================
   NOMBRE SEGURO DEL ARCHIVO
   ========================================================= */

function safeFileName(
    value
) {

    return String(
        value || ""
    )
        .normalize(
            "NFD"
        )
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /[^a-zA-Z0-9]+/g,
            "_"
        )
        .replace(
            /^_+|_+$/g,
            ""
        );
}


/* =========================================================
   FECHA DEL EXCEL
   ========================================================= */

function getExcelFileDate() {

    const now =
        new Date();


    const pad =
        value =>
            String(
                value
            ).padStart(
                2,
                "0"
            );


    return (
        now.getFullYear() +
        "-" +
        pad(
            now.getMonth() + 1
        ) +
        "-" +
        pad(
            now.getDate()
        )
    );
}


/* =========================================================
   INICIALIZACIÓN
   ========================================================= */

updateConnection();


document.addEventListener(
    "DOMContentLoaded",
    function () {

        if (
            document.getElementById(
                "connectionStatus"
            )
        ) {

            verifyServerConnection();
        }


        if (
            document.getElementById(
                "exportScope"
            )
        ) {

            toggleVehicleExport();
        }
    }
);


/* =========================================================
   SERVICE WORKER
   ========================================================= */

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        function () {

            navigator.serviceWorker
                .register(
                    "sw.js"
                )
                .catch(
                    error => {

                        console.error(
                            "No fue posible registrar el Service Worker.",
                            error
                        );
                    }
                );
        }
    );
}

/* =========================================================
   PASO 2
   COMBUSTIBLE Y VIDEO DE CONDICIÓN
   ========================================================= */


/* =========================================================
   CONFIGURACIÓN DEL VIDEO
   ========================================================= */

const ASADA_MAX_CONDITION_VIDEO_SECONDS =
    60;


const ASADA_MAX_CONDITION_VIDEO_BYTES =
    25 * 1024 * 1024;


/*
    Video nuevo seleccionado por el usuario.
*/

window._pendingConditionVideoData =
    null;


/*
    Video que ya existe cuando estamos editando
    un registro.
*/

window._existingConditionVideo =
    null;



/* =========================================================
   LEER VIDEO COMO BASE64
   ========================================================= */

function asadaReadVideoAsDataUrl(
    file
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const reader =
                new FileReader();


            reader.onload =
                () => {

                    resolve(
                        reader.result
                    );

                };


            reader.onerror =
                () => {

                    reject(
                        new Error(
                            "No fue posible leer el video seleccionado."
                        )
                    );

                };


            reader.readAsDataURL(
                file
            );

        }
    );
}



/* =========================================================
   OBTENER DURACIÓN DEL VIDEO
   ========================================================= */

function asadaGetVideoDuration(
    file
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const video =
                document.createElement(
                    "video"
                );


            const objectUrl =
                URL.createObjectURL(
                    file
                );


            video.preload =
                "metadata";


            video.onloadedmetadata =
                () => {

                    const duration =
                        Number(
                            video.duration || 0
                        );


                    URL.revokeObjectURL(
                        objectUrl
                    );


                    resolve(
                        duration
                    );

                };


            video.onerror =
                () => {

                    URL.revokeObjectURL(
                        objectUrl
                    );


                    reject(
                        new Error(
                            "No fue posible leer la duración del video."
                        )
                    );

                };


            video.src =
                objectUrl;

        }
    );
}



/* =========================================================
   QUITAR VIDEO NUEVO
   ========================================================= */

function asadaClearPendingConditionVideo() {

    window._pendingConditionVideoData =
        null;


    const input =
        document.getElementById(
            "videoCondicion"
        );


    if (
        input
    ) {

        input.value =
            "";

    }


    asadaRenderConditionVideoPreview();

}



/* =========================================================
   MOSTRAR VISTA PREVIA DEL VIDEO
   ========================================================= */

function asadaRenderConditionVideoPreview() {

    const container =
        document.getElementById(
            "videoPreview"
        );


    if (
        !container
    ) {

        return;

    }


    const pending =
        window._pendingConditionVideoData;


    const existing =
        window._existingConditionVideo;



    /*
        VIDEO NUEVO
    */

    if (
        pending &&
        pending.data
    ) {

        container.innerHTML = `

            <div class="video-preview-card">

                <video
                    controls
                    preload="metadata">

                    <source
                        src="${pending.data}"
                        type="${esc(
            pending.type ||
            "video/mp4"
        )}">

                    Su navegador no puede reproducir este video.

                </video>


                <p>
                    ${esc(
            pending.name ||
            "Video de condición"
        )}
                </p>


                <button
                    type="button"
                    class="btn secondary"
                    onclick="asadaClearPendingConditionVideo()">

                    Quitar video

                </button>

            </div>

        `;


        return;

    }



    /*
        VIDEO YA GUARDADO
    */

    if (
        existing &&
        existing.url
    ) {

        container.innerHTML = `

            <div class="video-preview-card">

                <p>
                    Este registro ya tiene un video de condición guardado.
                </p>


                <a
                    class="btn secondary"
                    href="${esc(
            existing.url
        )}"
                    target="_blank"
                    rel="noopener noreferrer">

                    Ver video guardado

                </a>

            </div>

        `;


        return;

    }



    /*
        SIN VIDEO
    */

    container.innerHTML =
        "";

}



/* =========================================================
   PROCESAR VIDEO SELECCIONADO
   ========================================================= */

async function asadaPreviewConditionVideo(
    event
) {

    const input =
        event.currentTarget;


    const file =
        input.files &&
        input.files[0];


    if (
        !file
    ) {

        return;

    }


    try {


        /* ---------------------------------------------
           VALIDAR QUE SEA VIDEO
           --------------------------------------------- */

        if (
            !String(
                file.type || ""
            ).startsWith(
                "video/"
            )
        ) {

            throw new Error(
                "Seleccione únicamente un archivo de video."
            );

        }



        /* ---------------------------------------------
           VALIDAR PESO
           --------------------------------------------- */

        if (
            file.size >
            ASADA_MAX_CONDITION_VIDEO_BYTES
        ) {

            throw new Error(
                "El video es demasiado pesado. " +
                "El tamaño máximo permitido es de 25 MB. " +
                "Puede grabar un video más corto o con menor calidad."
            );

        }



        /* ---------------------------------------------
           VALIDAR DURACIÓN
           --------------------------------------------- */

        const duration =
            await asadaGetVideoDuration(
                file
            );


        if (
            !Number.isFinite(
                duration
            ) ||
            duration <= 0
        ) {

            throw new Error(
                "No fue posible comprobar la duración del video."
            );

        }


        if (
            duration >
            ASADA_MAX_CONDITION_VIDEO_SECONDS +
            0.25
        ) {

            throw new Error(
                "El video no puede superar 1 minuto de duración."
            );

        }



        /* ---------------------------------------------
           CONVERTIR A BASE64
           --------------------------------------------- */

        const data =
            await asadaReadVideoAsDataUrl(
                file
            );



        /* ---------------------------------------------
           GUARDAR TEMPORALMENTE
           --------------------------------------------- */

        window._pendingConditionVideoData = {

            name:
                file.name ||
                "video-condicion",

            type:
                file.type ||
                "video/mp4",

            size:
                file.size,

            duration:
                Math.round(
                    duration
                ),

            data:
                data

        };


        asadaRenderConditionVideoPreview();


    } catch (
    error
    ) {

        console.error(
            "Error al procesar el video.",
            error
        );


        input.value =
            "";


        window._pendingConditionVideoData =
            null;


        asadaRenderConditionVideoPreview();


        alert(
            error.message ||
            "No fue posible procesar el video seleccionado."
        );

    }

}



/* =========================================================
   AMPLIAR INICIALIZACIÓN DEL FORMULARIO
   ========================================================= */

const asadaOriginalInitMaintenanceForm =
    initMaintenanceForm;


initMaintenanceForm =
    async function () {


        window._pendingConditionVideoData =
            null;


        window._existingConditionVideo =
            null;



        /*
            Ejecutamos toda tu inicialización anterior.
        */

        await asadaOriginalInitMaintenanceForm();



        /*
            Agregamos ahora el evento del video.
        */

        const videoInput =
            document.getElementById(
                "videoCondicion"
            );


        if (
            videoInput &&
            !videoInput.dataset.asadaListener
        ) {

            videoInput.addEventListener(
                "change",
                asadaPreviewConditionVideo
            );


            videoInput.dataset.asadaListener =
                "1";

        }


        asadaRenderConditionVideoPreview();

    };



/* =========================================================
   AMPLIAR LÓGICA DE CONDICIÓN
   ========================================================= */

const asadaOriginalToggleConditionComment =
    toggleConditionComment;


toggleConditionComment =
    function () {


        /*
            Ejecutamos primero la función que ya tenías.

            Esa función:
            - muestra comentario para Regular/Sucio
            - vuelve obligatorio el comentario
            - oculta el bloque para Limpio
        */

        asadaOriginalToggleConditionComment();



        const condition =
            document.getElementById(
                "condicion"
            )?.value || "";



        /*
            Si cambia a Limpio no debe quedar
            un video nuevo seleccionado.
        */

        if (
            condition ===
            "Limpio"
        ) {

            window._pendingConditionVideoData =
                null;


            window._existingConditionVideo =
                null;


            const videoInput =
                document.getElementById(
                    "videoCondicion"
                );


            if (
                videoInput
            ) {

                videoInput.value =
                    "";

            }


            asadaRenderConditionVideoPreview();

        }

    };



/* =========================================================
   AMPLIAR DATOS QUE SE ENVÍAN A GOOGLE
   ========================================================= */

const asadaOriginalSaveRecordOnServer =
    saveRecordOnServer;


saveRecordOnServer =
    async function (
        record,
        mode
    ) {


        const condition =
            document.getElementById(
                "condicion"
            )?.value || "";



        /*
            Tomamos el objeto que ya creaba tu aplicación
            y le añadimos los campos nuevos.
        */

        const extendedRecord = {

            ...record,


            nivelCombustible:

                document.getElementById(
                    "nivelCombustible"
                )?.value || "",


            nuevoVideoCondicion:

                window._pendingConditionVideoData ||
                null,


            eliminarVideoCondicion:

                condition ===
                "Limpio"

        };



        /*
            Enviamos el registro usando la función
            original que ya funcionaba.
        */

        const savedRecord =
            await asadaOriginalSaveRecordOnServer(
                extendedRecord,
                mode
            );



        /*
            Después de guardar quitamos el video
            temporal del navegador.
        */

        window._pendingConditionVideoData =
            null;



        /*
            Si Google devuelve un video guardado,
            lo dejamos como video existente.
        */

        if (
            savedRecord
        ) {


            if (
                savedRecord.videoCondicion &&
                savedRecord.videoCondicion.url
            ) {

                window._existingConditionVideo =
                    savedRecord.videoCondicion;


            } else if (
                savedRecord.videoCondicionUrl
            ) {

                window._existingConditionVideo = {

                    url:
                        savedRecord.videoCondicionUrl

                };


            } else {

                window._existingConditionVideo =
                    null;

            }

        }


        asadaRenderConditionVideoPreview();


        return savedRecord;

    };



/* =========================================================
   CARGAR COMBUSTIBLE Y VIDEO AL EDITAR
   ========================================================= */

const asadaOriginalLoadRecord =
    loadRecord;


loadRecord =
    async function (
        id
    ) {


        /*
            Primero cargamos todo lo que ya cargaba
            tu formulario.
        */

        await asadaOriginalLoadRecord(
            id
        );


        try {


            /*
                Consultamos nuevamente el registro
                para leer los nuevos campos.
            */

            const record =
                await getRecordByIdFromServer(
                    id
                );


            if (
                !record
            ) {

                return;

            }



            /* -----------------------------------------
               COMBUSTIBLE
               ----------------------------------------- */

            const fuel =
                document.getElementById(
                    "nivelCombustible"
                );


            if (
                fuel
            ) {

                fuel.value =
                    record.nivelCombustible ||
                    "";

            }



            /* -----------------------------------------
               VIDEO EXISTENTE
               ----------------------------------------- */

            if (
                record.videoCondicion &&
                record.videoCondicion.url
            ) {

                window._existingConditionVideo =
                    record.videoCondicion;


            } else if (
                record.videoCondicionUrl
            ) {

                window._existingConditionVideo = {

                    url:
                        record.videoCondicionUrl

                };


            } else {

                window._existingConditionVideo =
                    null;

            }


            asadaRenderConditionVideoPreview();


        } catch (
        error
        ) {

            console.error(
                "No fue posible cargar combustible o video.",
                error
            );

        }

    };



/* =========================================================
   LIMPIAR CAMPOS NUEVOS
   ========================================================= */

const asadaOriginalResetMaintenanceForm =
    resetMaintenanceForm;


resetMaintenanceForm =
    function () {


        /*
            Limpiamos primero todo el formulario
            como ya lo hacía tu código.
        */

        asadaOriginalResetMaintenanceForm();



        /* ---------------------------------------------
           COMBUSTIBLE
           --------------------------------------------- */

        const fuel =
            document.getElementById(
                "nivelCombustible"
            );


        if (
            fuel
        ) {

            fuel.value =
                "";

        }



        /* ---------------------------------------------
           VIDEO
           --------------------------------------------- */

        const videoInput =
            document.getElementById(
                "videoCondicion"
            );


        if (
            videoInput
        ) {

            videoInput.value =
                "";

        }


        window._pendingConditionVideoData =
            null;


        window._existingConditionVideo =
            null;


        asadaRenderConditionVideoPreview();

    };

/* =========================================================
PASO 3
MOSTRAR COMBUSTIBLE Y VIDEO EN EL DETALLE
========================================================= */


/* =========================================================
   GUARDAMOS LA FUNCIÓN ORIGINAL
   ========================================================= */

const asadaOriginalRenderDetail =
    renderDetail;


/* =========================================================
   AMPLIAR DETALLE DEL REGISTRO
   ========================================================= */

renderDetail =
    async function () {


        /*
            Primero dejamos que se cargue el detalle
            exactamente como ya lo hacía tu aplicación.
        */

        await asadaOriginalRenderDetail();



        const root =
            document.getElementById(
                "detail"
            );


        if (
            !root
        ) {

            return;

        }



        const id =
            new URLSearchParams(
                window.location.search
            ).get(
                "id"
            );


        if (
            !id
        ) {

            return;

        }



        try {


            /*
                Consultamos el registro para obtener
                los nuevos campos.
            */

            const record =
                await getRecordByIdFromServer(
                    id
                );


            if (
                !record
            ) {

                return;

            }



            /* =================================================
               NIVEL DE COMBUSTIBLE
               ================================================= */

            const vehicleInfoGrid =
                root.querySelector(
                    ".vehicle-info-grid"
                );


            if (
                vehicleInfoGrid &&
                !document.getElementById(
                    "detailFuelLevel"
                )
            ) {


                vehicleInfoGrid.insertAdjacentHTML(
                    "beforeend",
                    `

                        <div
                            class="detail-info"
                            id="detailFuelLevel">

                            <span class="detail-info-label">
                                Nivel de combustible
                            </span>


                            <strong>

                                ${esc(
                        record.nivelCombustible ||
                        "Sin información"
                    )}

                            </strong>

                        </div>

                    `
                );

            }



            /* =================================================
               VIDEO DE CONDICIÓN
               ================================================= */

            let videoUrl =
                "";


            let videoDuration =
                0;



            /*
                Primero intentamos leer el objeto completo.
            */

            if (
                record.videoCondicion &&
                typeof record.videoCondicion ===
                "object"
            ) {


                videoUrl =
                    String(
                        record.videoCondicion.url ||
                        ""
                    ).trim();


                videoDuration =
                    Number(
                        record.videoCondicion.duration ||
                        0
                    );

            }



            /*
                Si no vino el objeto completo,
                utilizamos la URL guardada directamente.
            */

            if (
                !videoUrl &&
                record.videoCondicionUrl
            ) {

                videoUrl =
                    String(
                        record.videoCondicionUrl
                    ).trim();

            }



            /*
                Solo mostramos esta sección cuando
                realmente existe un video.
            */

            if (
                videoUrl &&
                !document.getElementById(
                    "detailConditionVideo"
                )
            ) {


                const reviewCard =
                    root.querySelector(
                        ".detail-review-card"
                    );


                if (
                    reviewCard
                ) {


                    const photoGroup =
                        reviewCard.querySelector(
                            ".detail-photo-group"
                        );


                    const actions =
                        reviewCard.querySelector(
                            ".detail-card-actions"
                        );



                    const durationText =
                        videoDuration > 0

                            ? `

                                <p class="detail-text">
                                    Duración aproximada:
                                    ${esc(
                                videoDuration
                            )}
                                    segundos
                                </p>

                            `

                            : "";



                    const videoHtml = `

                        <div
                            class="detail-group detail-video-group"
                            id="detailConditionVideo">

                            <span
                                class="detail-info-label detail-group-title">

                                Video de condición

                            </span>


                            ${durationText}


                            <div class="photo-folder-action">

                                <a
                                    href="${esc(
                        videoUrl
                    )}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="btn secondary">

                                    Ver video de condición

                                </a>

                            </div>

                        </div>

                    `;



                    /*
                        Lo ponemos antes de las fotografías.
                    */

                    if (
                        photoGroup
                    ) {

                        photoGroup.insertAdjacentHTML(
                            "beforebegin",
                            videoHtml
                        );


                    } else if (
                        actions
                    ) {

                        actions.insertAdjacentHTML(
                            "beforebegin",
                            videoHtml
                        );

                    }

                }

            }


        } catch (
        error
        ) {


            /*
                Si este pequeño complemento falla,
                no queremos que se dañe todo el detalle.
            */

            console.error(
                "No fue posible mostrar combustible o video en el detalle.",
                error
            );

        }

    };

/* =========================================================
PASO 4
MODO CLARO Y MODO OSCURO
========================================================= */


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const ASADA_THEME_STORAGE_KEY =
    "asada-theme";


/* =========================================================
   OBTENER TEMA GUARDADO
   ========================================================= */

function asadaGetSavedTheme() {

    const savedTheme =
        localStorage.getItem(
            ASADA_THEME_STORAGE_KEY
        );


    if (
        savedTheme === "light" ||
        savedTheme === "dark"
    ) {

        return savedTheme;
    }


    /*
        El diseño actual de la aplicación es oscuro,
        por eso será el modo predeterminado.
    */

    return "dark";
}


/* =========================================================
   APLICAR TEMA
   ========================================================= */

function asadaApplyTheme(
    theme
) {

    const safeTheme =
        theme === "light"

            ? "light"

            : "dark";


    document.documentElement.setAttribute(
        "data-theme",
        safeTheme
    );


    /*
        Guardar la preferencia.
    */

    localStorage.setItem(
        ASADA_THEME_STORAGE_KEY,
        safeTheme
    );


    /*
        Cambiar el color utilizado por el navegador
        en la parte superior.
    */

    const themeMeta =
        document.querySelector(
            'meta[name="theme-color"]'
        );


    if (
        themeMeta
    ) {

        themeMeta.setAttribute(
            "content",
            safeTheme === "light"

                ? "#f4f6f7"

                : "#16181c"
        );
    }


    /*
        Actualizar botón.
    */

    const button =
        document.getElementById(
            "asadaThemeButton"
        );


    if (
        button
    ) {

        if (
            safeTheme === "dark"
        ) {

            button.textContent =
                "Modo claro";


            button.setAttribute(
                "aria-label",
                "Cambiar a modo claro"
            );

        } else {

            button.textContent =
                "Modo oscuro";


            button.setAttribute(
                "aria-label",
                "Cambiar a modo oscuro"
            );
        }
    }
}


/* =========================================================
   CAMBIAR TEMA
   ========================================================= */

function asadaToggleTheme() {

    const currentTheme =
        document.documentElement.getAttribute(
            "data-theme"
        ) || "dark";


    const newTheme =
        currentTheme === "dark"

            ? "light"

            : "dark";


    asadaApplyTheme(
        newTheme
    );
}


/* =========================================================
   CREAR BOTÓN EN LA BARRA SUPERIOR
   ========================================================= */

function asadaCreateThemeButton() {

    const topbar =
        document.querySelector(
            ".topbar"
        );


    if (
        !topbar
    ) {

        return;
    }


    /*
        Evitar crear dos botones.
    */

    if (
        document.getElementById(
            "asadaThemeButton"
        )
    ) {

        return;
    }


    const button =
        document.createElement(
            "button"
        );


    button.type =
        "button";


    button.id =
        "asadaThemeButton";


    button.className =
        "theme-toggle-btn";


    button.addEventListener(
        "click",
        asadaToggleTheme
    );


    topbar.appendChild(
        button
    );


    /*
        Colocar el texto correcto.
    */

    asadaApplyTheme(
        asadaGetSavedTheme()
    );
}


/* =========================================================
   INICIAR TEMA
   ========================================================= */

/*
    Aplicamos el tema guardado inmediatamente.
*/

asadaApplyTheme(
    asadaGetSavedTheme()
);


/*
    Cuando la página esté lista,
    agregamos el botón.
*/

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        asadaCreateThemeButton
    );

} else {

    asadaCreateThemeButton();
}

/* =========================================================
   PASO 5
   ACCESIBILIDAD Y MENÚ DE ACCIDENTES
   ========================================================= */


/* =========================================================
   CARGAR PLUGIN DE ACCESIBILIDAD
   ========================================================= */

function asadaLoadAccessibilityPlugin() {

    if (
        document.getElementById(
            "asadaAccessibilityPlugin"
        )
    ) {

        return;
    }


    const script =
        document.createElement(
            "script"
        );


    script.id =
        "asadaAccessibilityPlugin";


    /*
        Dejamos la versión fija para evitar que una
        actualización futura cambie el comportamiento
        de la aplicación sin que nosotros lo sepamos.
    */

    script.src =
        "https://cdn.jsdelivr.net/npm/sienna-accessibility@2.2.333";


    script.async =
        true;


    script.onerror =
        function () {

            console.error(
                "No fue posible cargar el complemento de accesibilidad."
            );

        };


    document.body.appendChild(
        script
    );
}



/* =========================================================
   AGREGAR ACCIDENTES AL MENÚ LATERAL
   ========================================================= */

function asadaAddAccidentMenuLinks() {

    const menu =
        document.getElementById(
            "sideMenu"
        );


    if (
        !menu
    ) {

        return;
    }


    /*
        Evitamos agregar los enlaces dos veces.
    */

    if (
        document.getElementById(
            "menuCreateAccident"
        )
    ) {

        return;
    }


    const excelLink =
        Array.from(
            menu.querySelectorAll(
                "a"
            )
        ).find(
            link =>
                link.getAttribute(
                    "href"
                ) ===
                "excel.html"
        );


    const createLink =
        document.createElement(
            "a"
        );


    createLink.id =
        "menuCreateAccident";


    createLink.href =
        "crear-accidente.html";


    createLink.textContent =
        "Crear registro de daño y accidente";


    const listLink =
        document.createElement(
            "a"
        );


    listLink.id =
        "menuAccidentList";


    listLink.href =
        "accidentes.html";


    listLink.textContent =
        "Listado de daños y accidentes";


    if (
        excelLink
    ) {

        menu.insertBefore(
            createLink,
            excelLink
        );


        menu.insertBefore(
            listLink,
            excelLink
        );

    } else {

        menu.appendChild(
            createLink
        );


        menu.appendChild(
            listLink
        );
    }
}



/* =========================================================
   INICIAR
   ========================================================= */

function asadaInitGlobalTools() {

    asadaAddAccidentMenuLinks();

    asadaLoadAccessibilityPlugin();
}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        asadaInitGlobalTools
    );

} else {

    asadaInitGlobalTools();
}

/* =========================================================
   PASO 6
   DAÑOS Y ACCIDENTES - MAPA Y FORMULARIO
   ========================================================= */


/* =========================================================
   VARIABLES DE ACCIDENTES
   ========================================================= */

window._accidentMap =
    null;


window._accidentMarker =
    null;


window._pendingAccidentPhotoData =
    [];


/* =========================================================
   PLACA AUTOMÁTICA
   ========================================================= */

function updateAccidentPlate() {

    const vehicleSelect =
        document.getElementById(
            "accidentVehicle"
        );


    const plateInput =
        document.getElementById(
            "accidentPlate"
        );


    if (
        !vehicleSelect ||
        !plateInput
    ) {

        return;
    }


    const vehicle =
        VEHICLES.find(
            item =>
                item.nombre ===
                vehicleSelect.value
        );


    plateInput.value =
        vehicle

            ? vehicle.placa

            : "";
}


/* =========================================================
   CREAR MAPA
   ========================================================= */

function initAccidentMap() {

    const container =
        document.getElementById(
            "accidentMap"
        );


    if (
        !container
    ) {

        return;
    }


    if (
        typeof L ===
        "undefined"
    ) {

        console.error(
            "Leaflet no está disponible."
        );


        return;
    }


    if (
        window._accidentMap
    ) {

        return;
    }


    /*
        Ubicación inicial aproximada para mostrar
        la zona de Orosi mientras todavía no se
        han obtenido las coordenadas del dispositivo.
    */

    const initialLatitude =
        9.80;


    const initialLongitude =
        -83.85;


    window._accidentMap =
        L.map(
            "accidentMap",
            {
                zoomControl:
                    true
            }
        )
            .setView(
                [
                    initialLatitude,
                    initialLongitude
                ],
                13
            );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom:
                19,

            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
        }
    ).addTo(
        window._accidentMap
    );


    /*
        Corregir tamaño después de que el navegador
        haya terminado de dibujar la página.
    */

    window.setTimeout(
        function () {

            if (
                window._accidentMap
            ) {

                window._accidentMap.invalidateSize();
            }

        },
        250
    );
}


/* =========================================================
   COLOCAR MARCADOR
   ========================================================= */

function setAccidentMapPosition(
    latitude,
    longitude
) {

    if (
        !window._accidentMap
    ) {

        initAccidentMap();
    }


    if (
        !window._accidentMap
    ) {

        return;
    }


    const coordinates = [

        Number(
            latitude
        ),

        Number(
            longitude
        )

    ];


    if (
        !Number.isFinite(
            coordinates[0]
        ) ||
        !Number.isFinite(
            coordinates[1]
        )
    ) {

        return;
    }


    if (
        window._accidentMarker
    ) {

        window._accidentMarker.setLatLng(
            coordinates
        );

    } else {

        window._accidentMarker =
            L.marker(
                coordinates
            )
                .addTo(
                    window._accidentMap
                )
                .bindPopup(
                    "Ubicación registrada"
                );
    }


    window._accidentMap.setView(
        coordinates,
        17
    );


    window._accidentMarker.openPopup();
}


/* =========================================================
   OBTENER GPS
   ========================================================= */

function captureAccidentLocation() {

    const status =
        document.getElementById(
            "accidentGpsStatus"
        );


    const button =
        document.getElementById(
            "accidentGpsButton"
        );


    if (
        !navigator.geolocation
    ) {

        if (
            status
        ) {

            status.textContent =
                "Este dispositivo no permite obtener la ubicación GPS.";
        }


        return;
    }


    if (
        status
    ) {

        status.textContent =
            "Obteniendo ubicación...";
    }


    if (
        button
    ) {

        button.disabled =
            true;


        button.textContent =
            "Obteniendo ubicación...";
    }


    navigator.geolocation.getCurrentPosition(

        function (
            position
        ) {

            const coordinates =
                position.coords;


            const latitude =
                Number(
                    coordinates.latitude
                );


            const longitude =
                Number(
                    coordinates.longitude
                );


            const altitude =
                coordinates.altitude;


            const accuracy =
                coordinates.accuracy;



            const latitudeInput =
                document.getElementById(
                    "accidentLatitude"
                );


            const longitudeInput =
                document.getElementById(
                    "accidentLongitude"
                );


            const altitudeInput =
                document.getElementById(
                    "accidentAltitude"
                );


            const accuracyInput =
                document.getElementById(
                    "accidentAccuracy"
                );



            /*
                Y = LATITUD
            */

            if (
                latitudeInput
            ) {

                latitudeInput.value =
                    latitude.toFixed(
                        6
                    );
            }



            /*
                X = LONGITUD
            */

            if (
                longitudeInput
            ) {

                longitudeInput.value =
                    longitude.toFixed(
                        6
                    );
            }



            /*
                ALTITUD

                Algunos teléfonos no proporcionan
                este dato.
            */

            if (
                altitudeInput
            ) {

                altitudeInput.value =
                    Number.isFinite(
                        Number(
                            altitude
                        )
                    )

                        ? Number(
                            altitude
                        ).toFixed(
                            1
                        )

                        : "No disponible";
            }



            /*
                PRECISIÓN
            */

            if (
                accuracyInput
            ) {

                accuracyInput.value =
                    Number.isFinite(
                        Number(
                            accuracy
                        )
                    )

                        ? Number(
                            accuracy
                        ).toFixed(
                            1
                        )

                        : "";
            }



            /*
                ACTUALIZAR MAPA
            */

            setAccidentMapPosition(
                latitude,
                longitude
            );



            if (
                status
            ) {

                status.textContent =
                    "Ubicación obtenida correctamente.";
            }



            if (
                button
            ) {

                button.disabled =
                    false;


                button.textContent =
                    "Actualizar ubicación";
            }

        },


        function (
            error
        ) {

            console.error(
                "Error de geolocalización.",
                error
            );


            let message =
                "No fue posible obtener la ubicación.";


            switch (
            error.code
            ) {

                case 1:

                    message =
                        "No se autorizó el acceso a la ubicación.";

                    break;


                case 2:

                    message =
                        "El dispositivo no pudo determinar la ubicación.";

                    break;


                case 3:

                    message =
                        "La búsqueda de la ubicación tardó demasiado.";

                    break;
            }


            if (
                status
            ) {

                status.textContent =
                    message;
            }


            if (
                button
            ) {

                button.disabled =
                    false;


                button.textContent =
                    "Obtener ubicación actual";
            }

        },


        {
            enableHighAccuracy:
                true,

            timeout:
                20000,

            maximumAge:
                0
        }
    );
}


/* =========================================================
   FOTOS DE ACCIDENTE
   ========================================================= */

async function previewAccidentPhotos(
    event
) {

    const files =
        Array.from(
            event.target.files ||
            []
        );


    if (
        files.length ===
        0
    ) {

        return;
    }


    const currentPhotos =
        Array.isArray(
            window._pendingAccidentPhotoData
        )

            ? window._pendingAccidentPhotoData

            : [];


    if (
        currentPhotos.length +
        files.length >
        10
    ) {

        alert(
            "Puede seleccionar un máximo de 10 fotografías."
        );


        event.target.value =
            "";


        return;
    }


    try {

        const newPhotos =
            [];


        for (
            const file of files
        ) {

            /*
                Reutilizamos la compresión de imágenes
                que ya utiliza el formulario de revisiones.
            */

            const photo =
                await compressImageFile(
                    file
                );


            newPhotos.push(
                photo
            );
        }


        window._pendingAccidentPhotoData =
            [
                ...currentPhotos,
                ...newPhotos
            ];


        renderAccidentPhotoPreview();


    } catch (
    error
    ) {

        console.error(
            "Error al preparar fotografías del accidente.",
            error
        );


        alert(
            error.message ||
            "No fue posible procesar una de las fotografías."
        );
    }


    event.target.value =
        "";
}


/* =========================================================
   MOSTRAR FOTOS
   ========================================================= */

function renderAccidentPhotoPreview() {

    const preview =
        document.getElementById(
            "accidentPhotoPreview"
        );


    if (
        !preview
    ) {

        return;
    }


    const photos =
        Array.isArray(
            window._pendingAccidentPhotoData
        )

            ? window._pendingAccidentPhotoData

            : [];


    preview.innerHTML =
        photos
            .map(
                function (
                    photo,
                    index
                ) {

                    if (
                        !photo ||
                        !photo.data
                    ) {

                        return "";
                    }


                    return `

                        <div class="accident-photo-preview-item">

                            <img
                                src="${esc(
                        photo.data
                    )}"
                                alt="Fotografía ${index + 1} del daño o accidente">

                        </div>

                    `;
                }
            )
            .join(
                ""
            );
}


/* =========================================================
   VALIDAR GPS ANTES DEL FUTURO GUARDADO
   ========================================================= */

function validateAccidentGps() {

    const latitude =
        document.getElementById(
            "accidentLatitude"
        )?.value || "";


    const longitude =
        document.getElementById(
            "accidentLongitude"
        )?.value || "";


    if (
        !latitude ||
        !longitude
    ) {

        alert(
            "Debe obtener la ubicación GPS antes de guardar el registro."
        );


        return false;
    }


    return true;
}


/* =========================================================
   INICIAR FORMULARIO
   ========================================================= */

function initAccidentForm() {

    const form =
        document.getElementById(
            "accidentForm"
        );


    if (
        !form
    ) {

        return;
    }


    window._pendingAccidentPhotoData =
        [];


    /*
        FECHA Y HORA AUTOMÁTICA
    */

    const dateInput =
        document.getElementById(
            "accidentDateTime"
        );


    if (
        dateInput &&
        !dateInput.value
    ) {

        dateInput.value =
            formatDate(
                new Date()
            );
    }


    /*
        PLACA
    */

    updateAccidentPlate();


    /*
        MAPA
    */

    initAccidentMap();


    /*
        FOTOGRAFÍAS
    */

    const photosInput =
        document.getElementById(
            "accidentPhotos"
        );


    if (
        photosInput
    ) {

        photosInput.addEventListener(
            "change",
            previewAccidentPhotos
        );
    }


    /*
        Hasta que conectemos Code.gs evitamos
        que el navegador recargue accidentalmente
        la página si presiona Guardar.
    */

    form.addEventListener(
        "submit",
        function (
            event
        ) {

            event.preventDefault();


            if (
                typeof saveAccidentRecord ===
                "function"
            ) {

                saveAccidentRecord(
                    event
                );


                return;
            }


            alert(
                "El formulario y el mapa ya están preparados. Falta conectar el guardado con Google Apps Script."
            );
        }
    );
}