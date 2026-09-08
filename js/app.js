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

function handleApiMessage(event) {

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


                        form.remove();

                        iframe.remove();


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


    if (!element) {

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

    } catch (error) {

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

function formatDate(date) {

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

function esc(value) {

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


function escapeJs(value) {

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
   PÁGINA DE REGISTROS
   ========================================================= */

async function renderRecordsPage() {

    const root =
        document.getElementById(
            "recordsPage"
        );


    if (!root) {

        return;
    }


    const vehicle =
        new URLSearchParams(
            window.location.search
        ).get(
            "vehicle"
        );


    if (!vehicle) {

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


    if (!root) {

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


    if (!root) {

        return;
    }


    const vehicle =
        VEHICLES.find(
            item =>
                item.nombre ===
                vehicleName
        );


    if (!vehicle) {

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

    } catch (error) {

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


    if (!list) {

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


    if (!form) {

        return;
    }


    window._existingImages =
        [];


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


                        document.getElementById(
                            "usuario"
                        ).value =
                            this.dataset.value;
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


                        document.getElementById(
                            "condicion"
                        ).value =
                            this.dataset.value;


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


    if (!hidden) {

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
        ).value;


    const condition =
        document.getElementById(
            "condicion"
        ).value;


    const conditionComment =
        document.getElementById(
            "comentarioCondicion"
        ).value.trim();


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
        )
            .value
            .trim();


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
            ).value,

        placa:
            document.getElementById(
                "placa"
            ).value,

        fechaHora:
            document.getElementById(
                "fechaHora"
            ).value,

        kilometraje:
            document.getElementById(
                "kilometraje"
            ).value,

        usuario:
            user,

        responsable:
            document.getElementById(
                "responsable"
            ).value.trim(),

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
            ).value,

        comentario:
            document.getElementById(
                "comentario"
            ).value.trim(),

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


    /*
        El cuadro aparece inmediatamente.

        Todavía no mostramos el mensaje
        "Registro creado correctamente"
        porque esperamos la confirmación de Google.
    */

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


        window._pendingPhotoData =
            [];


        document.getElementById(
            "recordId"
        ).value =
            savedRecord.id;


        renderImagePreview();


        showSaveConfirmation(
            savedRecord,
            isEditing
        );

    } catch (error) {

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
   MOSTRAR CUADRO MIENTRAS SE GUARDA
   ========================================================= */

function showSavingConfirmation(
    isEditing
) {

    const modal =
        document.getElementById(
            "saveConfirmation"
        );


    if (!modal) {

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


    /*
        Guardamos si fue creación o edición.

        Esto se utiliza cuando se presiona Cerrar.
    */

    window._lastSaveWasEditing =
        isEditing;


    if (!modal) {

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


    /*
        Cuando fue un registro NUEVO,
        se limpia todo al presionar Cerrar.

        Cuando fue una EDICIÓN,
        dejamos la información.
    */

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


    if (!form) {

        return;
    }


    /*
        Limpiar campos normales.
    */

    form.reset();


    /*
        Limpiar ID.
    */

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


    /*
        Habilitar y limpiar vehículo.
    */

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


    /*
        Limpiar placa.
    */

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


    /*
        Colocar nueva fecha y hora.
    */

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


    /*
        Limpiar usuario.
    */

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


    /*
        Limpiar puntos revisados.
    */

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


    /*
        Limpiar condición.
    */

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


    /*
        Limpiar comentario de condición.
    */

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


    /*
        Limpiar fotografías.
    */

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


    window._pendingPhotoData =
        [];


    renderImagePreview();


    /*
        Restaurar título.
    */

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


    /*
        Preparar para un nuevo registro.
    */

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
   FOTOGRAFÍAS
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

    } catch (error) {

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
   CREAR NOMBRE JPG
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
        image.thumbnailUrl ||
        image.url ||
        image.data ||
        ""
    );
}


/* =========================================================
   PREVISUALIZACIÓN DE FOTOGRAFÍAS
   ========================================================= */

function renderImagePreview() {

    const preview =
        document.getElementById(
            "preview"
        );


    if (!preview) {

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


    preview.innerHTML =
        [
            ...existing,
            ...pending
        ]
            .map(
                image => {

                    const source =
                        getImageSource(
                            image
                        );


                    return source
                        ? `

                            <img
                                src="${esc(source)}"
                                alt="Imagen del vehículo">

                        `
                        : "";
                }
            )
            .join("");
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


        document.getElementById(
            "recordId"
        ).value =
            record.id;


        const vehicle =
            document.getElementById(
                "vehiculo"
            );


        vehicle.value =
            record.vehiculo;


        /*
            El vehículo no cambia
            cuando estamos editando.
        */

        vehicle.disabled =
            true;


        updatePlate();


        document.getElementById(
            "fechaHora"
        ).value =
            record.fechaHora ||
            "";


        document.getElementById(
            "kilometraje"
        ).value =
            record.kilometraje ||
            "";


        document.getElementById(
            "usuario"
        ).value =
            record.usuario ||
            "";


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


        document.getElementById(
            "responsable"
        ).value =
            record.responsable ||
            "";


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


        document.getElementById(
            "condicion"
        ).value =
            record.condicion ||
            "";


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


        document.getElementById(
            "comentarioCondicion"
        ).value =
            record.comentarioCondicion ||
            "";


        toggleConditionComment();


        document.getElementById(
            "motivo"
        ).value =
            record.motivo ||
            "";


        document.getElementById(
            "comentario"
        ).value =
            record.comentario ||
            "";


        window._existingImages =
            Array.isArray(
                record.imagenes
            )
                ? record.imagenes
                : [];


        window._pendingPhotoData =
            [];


        renderImagePreview();

    } catch (error) {

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


    if (!root) {

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


        root.innerHTML = `

            <div class="nav-actions">

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
                                ${esc(record.vehiculo || "Sin información")}
                            </strong>

                        </div>


                        <div class="detail-info">

                            <span class="detail-info-label">
                                Placa
                            </span>

                            <strong>
                                ${esc(record.placa || "Sin información")}
                            </strong>

                        </div>


                        <div class="detail-info">

                            <span class="detail-info-label">
                                Fecha y hora
                            </span>

                            <strong>
                                ${esc(record.fechaHora || "Sin información")}
                            </strong>

                        </div>


                        <div class="detail-info">

                            <span class="detail-info-label">
                                Kilometraje actual del vehículo
                            </span>

                            <strong>
                                ${esc(record.kilometraje || "Sin información")}
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
                                ${esc(record.usuario || "Sin información")}
                            </strong>

                        </div>


                        <div class="detail-data-block">

                            <span class="detail-info-label">
                                Responsable de la Inspección
                            </span>

                            <strong>
                                ${esc(record.responsable || "Sin información")}
                            </strong>

                        </div>

                    </div>


                    <div class="detail-group">

                        <span class="detail-info-label detail-group-title">
                            Puntos revisados antes de usar el vehículo
                        </span>

                        ${renderSelectedReviewPoints(record.puntos)}

                    </div>


                    <div class="detail-group detail-two-columns">

                        <div class="detail-data-block">

                            <span class="detail-info-label">
                                Condición del vehículo
                            </span>

                            <strong>
                                ${esc(record.condicion || "Sin información")}
                            </strong>

                        </div>


                        <div class="detail-data-block">

                            <span class="detail-info-label">
                                Motivo por el que se utiliza el vehículo
                            </span>

                            <strong>
                                ${esc(record.motivo || "Sin información")}
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
                                        ${esc(record.comentarioCondicion)}
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
                ? esc(record.comentario)
                : "Sin comentarios adicionales"
            }

                        </p>

                    </div>


                    <div class="detail-group detail-photo-group">

                        <span class="detail-info-label detail-group-title">
                            Imágenes de condiciones del vehículo
                        </span>

                        ${renderRecordPhotos(record.imagenes)}


                        ${record.carpetaFotosUrl
                ? `

                                    <div class="photo-folder-action">

                                        <a
                                            href="${esc(record.carpetaFotosUrl)}"
                                            target="_blank"
                                            rel="noopener"
                                            class="btn secondary">

                                            Ver carpeta de fotografías

                                        </a>

                                    </div>

                                `
                : ""
            }

                    </div>


                    <div class="detail-card-actions">

                        <a
                            href="mantenimiento.html?id=${encodeURIComponent(record.id)}"
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

    } catch (error) {

        console.error(
            "Error al cargar el detalle.",
            error
        );


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
                    No fue posible cargar el registro
                </h1>

                <p>
                    ${esc(error.message)}
                </p>

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
   FOTOGRAFÍAS DEL DETALLE
   ========================================================= */

function renderRecordPhotos(
    images
) {

    if (
        !Array.isArray(
            images
        ) ||
        !images.length
    ) {

        return `

            <div class="detail-no-photos">
                No se registraron imágenes para esta revisión.
            </div>

        `;
    }


    const valid =
        images.filter(
            image =>
                Boolean(
                    getImageSource(
                        image
                    )
                )
        );


    if (
        !valid.length
    ) {

        return `

            <div class="detail-no-photos">
                No se registraron imágenes para esta revisión.
            </div>

        `;
    }


    return `

        <div class="photo-detail">

            ${valid.map(
        image => {

            const source =
                getImageSource(
                    image
                );


            const openUrl =
                image &&
                    typeof image ===
                    "object" &&
                    image.url
                    ? image.url
                    : source;


            return `

                        <div class="detail-photo">

                            <a
                                href="${esc(openUrl)}"
                                target="_blank"
                                rel="noopener">

                                <img
                                    src="${esc(source)}"
                                    alt="Imagen de condición del vehículo"
                                    loading="lazy">

                            </a>

                        </div>

                    `;
        }
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


    /*
        Verificar que ExcelJS se haya cargado.
    */

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


    /*
        Bloqueamos temporalmente el botón
        para evitar descargas duplicadas.
    */

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

        /*
            Consultar registros de Google Sheets.
        */

        const allRecords =
            await getAllRecordsFromServer();


        if (
            !Array.isArray(
                allRecords
            ) ||
            allRecords.length === 0
        ) {

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


        /*
            Filtrar por vehículo cuando
            la persona lo solicite.
        */

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


        /*
            CREAR LIBRO
        */

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


        /*
            COLUMNAS
        */

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


        /*
            AGREGAR REGISTROS
        */

        records.forEach(
            record => {

                const points =
                    normalizeReviewPoints(
                        record.puntos
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
                            record.carpetaFotosUrl
                                ? "Ver fotografías"
                                : "Sin fotografías"

                    });


                /*
                    Enlace a la carpeta de fotografías.
                */

                if (
                    record.carpetaFotosUrl
                ) {

                    /*
                        Fotografías es la columna número 13.
                    */

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


        /*
            ENCABEZADO
        */

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


        /*
            FORMATO DE FILAS
        */

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


        /*
            FILTROS
        */

        sheet.autoFilter = {

            from:
                "A1",

            to:
                "M1"

        };


        /*
            CONGELAR PRIMERA FILA
        */

        sheet.views = [

            {

                state:
                    "frozen",

                ySplit:
                    1

            }

        ];


        /*
            CREAR ARCHIVO
        */

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


        /*
            NOMBRE DEL ARCHIVO
        */

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


        /*
            CREAR URL TEMPORAL
        */

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


        /*
            Iniciar descarga.
        */

        link.click();


        /*
            IMPORTANTE:

            No eliminamos el enlace ni la URL
            inmediatamente porque Firefox puede
            cancelar la descarga.

            Esperamos 2 segundos.
        */

        window.setTimeout(
            function () {

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


    } catch (error) {

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