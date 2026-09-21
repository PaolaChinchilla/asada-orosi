/* =========================================================
   ASADA OROSI
   SEGURIDAD DEL FRONTEND, BORRADORES Y FLUJO DE ENVÍO

   Este archivo se carga al final de cada página, después de
   app.js y de los scripts específicos del formulario.

   La seguridad real está en Apps Script. Este archivo solamente
   adapta la interfaz y mejora la experiencia del usuario.
   ========================================================= */

(function () {
    "use strict";

    const state = {
        user: null,
        authPromise: null,
        originalCallApi: null,
        pendingSubmission: null,
        pendingDeletion: null,
        operatorKey: "",
        operatorSelectionShown: false,
        restoringDraft: false,
        formStates: new WeakMap(),
        observer: null,
        localDraftDbPromise: null,
        onlineSyncPromise: null
    };

    let resolveAuthReady;
    let authReadyResolved = false;

    const authReady = new Promise(resolve => {
        resolveAuthReady = resolve;
    });

    // app.js usa esta promesa para detener consultas de listados mientras
    // se valida la sesión. Así se evita una carrera al cargar la página.
    window.ASADA_AUTH_READY = authReady;

    function finishAuthReady(user) {
        if (authReadyResolved) {
            return;
        }

        authReadyResolved = true;
        window.ASADA_AUTH_USER = user || null;
        resolveAuthReady(user || null);
    }

    const restrictedPages = [
        "registros.html",
        "accidentes.html",
        "factibilidades.html",
        "excel.html",
        "detalle.html",
        "detalle-accidente.html",
        "detalle-factibilidad.html"
    ];

    const restrictedActions = new Set([
        "getAllRecords",
        "getRecordsByVehicle",
        "getRecordById",
        "getAllAccidents",
        "getAccidentsByVehicle",
        "getAccidentById",
        "getAllFactibilidades",
        "getFactibilidadById",
        "saveFactibilidadPdf",
        "getFactibilidadImageData",
        "getFactibilidadMapData",
        "exportRecords",
        "exportAccidents",
        "exportFactibilidades"
    ]);

    const draftTypes = [
        "mantenimiento",
        "accidente",
        "factibilidad"
    ];

    const SESSION_STORAGE_KEY =
        "ASADA_SESSION_TOKEN";

    const OFFLINE_SESSION_STORAGE_KEY =
        "ASADA_OFFLINE_SESSION";

    const SESSION_LOCAL_TTL_MS =
        24 * 60 * 60 * 1000;

    const LAST_USER_STORAGE_KEY =
        "ASADA_LAST_USER";

    const LOCAL_DRAFT_DB_NAME =
        "ASADA_OFFLINE_DRAFTS_V1";

    const LOCAL_DRAFT_STORE_NAME =
        "drafts";

    const LOCAL_DRAFT_PREFIX =
        "ASADA_LOCAL_DRAFT:";

    const CLIENT_ID_STORAGE_KEY =
        "ASADA_CLIENT_ID";

    const OPERATOR_STORAGE_KEY =
        "ASADA_SHARED_OPERATOR";

    const SHARED_WORKER_EMAIL =
        "asadarosi4@gmail.com";

    const SHARED_OPERATOR_OPTIONS = [
        { key: "fontanero_1", label: "Guillermo" },
        { key: "fontanero_2", label: "Paul" },
        { key: "fontanero_3", label: "Roberto" },
        { key: "fontanero_4", label: "Rodolfo" }
    ];

    const SERVER_DRAFT_DELAY_MS =
        5000;

    function currentPage() {
        return String(
            window.location.pathname.split("/").pop() ||
            "index.html"
        ).toLowerCase();
    }

    function getFormKind(form) {
        if (!form) {
            return "";
        }

        if (form.id === "maintenanceForm") {
            return "mantenimiento";
        }

        if (form.id === "accidentForm") {
            return "accidente";
        }

        if (form.id === "factibilidadForm") {
            return "factibilidad";
        }

        return "";
    }

    function getQueryId() {
        return String(
            new URLSearchParams(window.location.search).get("id") ||
            ""
        ).trim();
    }

    function escapeHtml(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/[&<>"']/g, character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            })[character]);
    }

    function escapeSelector(value) {
        if (window.CSS && typeof window.CSS.escape === "function") {
            return window.CSS.escape(value);
        }

        return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
    }

    function setStatusMessage(message, isError) {
        const root = document.getElementById("factibilidadApp") ||
            document.querySelector("main.page") ||
            document.querySelector("main");

        if (!root) {
            return;
        }

        root.innerHTML = `
            <section class="asada-access-denied" role="alert">
                <span class="asada-access-label">ACCESO AL SISTEMA</span>
                <h1>${escapeHtml(isError ? "No fue posible validar su cuenta" : "Acceso restringido")}</h1>
                <p>${escapeHtml(message)}</p>
                <button type="button" class="btn primary" onclick="window.location.reload()">
                    Intentar nuevamente
                </button>
            </section>
        `;
    }

    function getMainRoot() {
        return document.getElementById("factibilidadApp") ||
            document.querySelector("main.page") ||
            document.querySelector("main");
    }

    function showEmailLogin(message) {
        const root = getMainRoot();

        if (!root) {
            return;
        }

        root.innerHTML = `
            <section class="asada-login-required" role="main">
                <span class="asada-access-label">ASADA OROSI</span>
                <h1>Iniciar sesión</h1>
                <p data-asada-login-message>${escapeHtml(message || "Escriba su correo autorizado para recibir un código temporal.")}</p>
                <form id="asadaEmailLoginForm">
                    <label>
                        Correo electrónico
                        <input type="email" id="asadaLoginEmail" autocomplete="email" required placeholder="correo@ejemplo.com">
                    </label>
                    <div id="asadaWorkerProfileStep" hidden>
                        <label>
                            Perfil de fontanero
                            <select id="asadaLoginOperator" autocomplete="off">
                                <option value="">Seleccione su perfil</option>
                                ${SHARED_OPERATOR_OPTIONS.map(option => `
                                    <option value="${escapeHtml(option.key)}">
                                        ${escapeHtml(option.label)}
                                    </option>
                                `).join("")}
                            </select>
                        </label>
                        <p class="note">Este perfil separa sus borradores de los demás fontaneros que usan la misma cuenta.</p>
                    </div>
                    <button type="submit" class="btn primary" id="asadaRequestCodeButton">Enviar código</button>
                </form>
                <div id="asadaCodeStep" hidden>
                    <p id="asadaCodeMessage">Revise su correo e ingrese el código de seis dígitos.</p>
                    <label>
                        Código temporal
                        <input type="text" id="asadaLoginCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required>
                    </label>
                    <button type="button" class="btn primary" id="asadaVerifyCodeButton">Verificar e ingresar</button>
                </div>
                <p class="note">No se utiliza una contraseña. El código vence en 10 minutos y la sesión dura 24 horas. Los borradores se conservan aunque cierre la página o pierda Internet.</p>
            </section>
        `;

        const form = document.getElementById("asadaEmailLoginForm");
        const emailInput = document.getElementById("asadaLoginEmail");
        const codeStep = document.getElementById("asadaCodeStep");
        const codeInput = document.getElementById("asadaLoginCode");
        const codeMessage = document.getElementById("asadaCodeMessage");
        const requestButton = document.getElementById("asadaRequestCodeButton");
        const verifyButton = document.getElementById("asadaVerifyCodeButton");
        const profileStep = document.getElementById("asadaWorkerProfileStep");
        const operatorSelect = document.getElementById("asadaLoginOperator");
        let authorizedEmail = "";
        let loginRequestId = "";

        const updateLoginProfileVisibility = () => {
            const email = String(emailInput?.value || "").trim().toLowerCase();
            const isShared = email === SHARED_WORKER_EMAIL;

            if (profileStep) {
                profileStep.hidden = !isShared;
            }

            if (operatorSelect) {
                operatorSelect.required = isShared;

                if (isShared && state.operatorKey) {
                    operatorSelect.value = state.operatorKey;
                }

                if (!isShared) {
                    operatorSelect.value = "";
                }
            }
        };

        emailInput?.addEventListener("input", updateLoginProfileVisibility);
        updateLoginProfileVisibility();

        const callUnauthenticatedApi = (action, values) => {
            const api = state.originalCallApi || window.callApi;

            if (typeof api !== "function") {
                throw new Error("No se encontró la conexión con Apps Script.");
            }

            return api(action, values);
        };

        form?.addEventListener("submit", async event => {
            event.preventDefault();
            const email = String(emailInput?.value || "").trim().toLowerCase();

            if (!email) {
                return;
            }

            const isSharedWorkerEmail = email === SHARED_WORKER_EMAIL;
            const selectedOperatorKey = String(operatorSelect?.value || "").trim();

            if (isSharedWorkerEmail && !setOperatorKey(selectedOperatorKey)) {
                const messageNode = document.querySelector("[data-asada-login-message]");

                if (messageNode) {
                    messageNode.textContent = "Seleccione primero el perfil de Guillermo, Paul, Roberto o Rodolfo.";
                }

                return;
            }

            requestButton.disabled = true;
            requestButton.textContent = "Enviando...";
            loginRequestId = typeof createRequestId === "function"
                ? createRequestId()
                : "login_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);

            try {
                await callUnauthenticatedApi("requestLoginCode", {
                    email,
                    loginRequestId,
                    perfil: isSharedWorkerEmail
                        ? getOperatorLabel(selectedOperatorKey)
                        : ""
                });
                authorizedEmail = email;
                codeStep.hidden = false;
                codeMessage.textContent = "Enviamos un código temporal a " + email + ". Revise también la carpeta de correo no deseado. Solicitud: " + loginRequestId.slice(-8);
                codeInput.value = "";
                codeInput.focus();
            } catch (error) {
                const messageNode = document.querySelector("[data-asada-login-message]");
                if (messageNode) {
                    messageNode.textContent = error.message || "No fue posible enviar el código.";
                }
            } finally {
                requestButton.disabled = false;
                requestButton.textContent = "Enviar código";
            }
        });

        verifyButton?.addEventListener("click", async () => {
            const email = authorizedEmail || String(emailInput?.value || "").trim().toLowerCase();
            const code = String(codeInput?.value || "").trim();

            if (!email || !/^\d{6}$/.test(code)) {
                codeMessage.textContent = "Ingrese el código de seis dígitos recibido por correo.";
                return;
            }

            verifyButton.disabled = true;
            verifyButton.textContent = "Verificando...";

            try {
                const response = getResponseData(
                    await callUnauthenticatedApi("verifyLoginCode", {
                        email,
                        codigo: code,
                        loginRequestId
                    })
                );

                if (!response.sessionToken) {
                    throw new Error("No se pudo crear la sesión.");
                }

                rememberSessionToken(response.sessionToken);
                window.location.reload();
            } catch (error) {
                codeMessage.textContent = error.message || "El código no es válido o ya venció.";
            } finally {
                verifyButton.disabled = false;
                verifyButton.textContent = "Verificar e ingresar";
            }
        });
    }

    function getResponseData(response) {
        if (
            response &&
            Object.prototype.hasOwnProperty.call(response, "data")
        ) {
            return response.data || {};
        }

        return response || {};
    }

    function pageNameFromHref(value) {
        return String(value || "")
            .split("?")[0]
            .split("#")[0]
            .replace(/\\/g, "/")
            .split("/")
            .pop()
            .toLowerCase();
    }

    function isRestrictedPageLink(link) {
        return restrictedPages.includes(
            pageNameFromHref(link?.getAttribute("href"))
        );
    }

    function rememberSessionToken(token) {
        const value = String(token || "").trim();

        if (!value) {
            return;
        }

        sessionStorage.setItem(SESSION_STORAGE_KEY, value);

        try {
            localStorage.setItem(
                OFFLINE_SESSION_STORAGE_KEY,
                JSON.stringify({
                    token: value,
                    expiresAt: Date.now() + SESSION_LOCAL_TTL_MS
                })
            );
        } catch (error) {
            console.warn("No fue posible conservar la sesión para el modo offline.", error);
        }
    }

    function getSessionToken() {
        const current = String(
            sessionStorage.getItem(SESSION_STORAGE_KEY) || ""
        ).trim();

        if (current) {
            return current;
        }

        try {
            const stored = JSON.parse(
                localStorage.getItem(OFFLINE_SESSION_STORAGE_KEY) || "null"
            );

            if (
                stored &&
                stored.token &&
                Number(stored.expiresAt) > Date.now()
            ) {
                sessionStorage.setItem(SESSION_STORAGE_KEY, stored.token);
                return String(stored.token);
            }

            localStorage.removeItem(OFFLINE_SESSION_STORAGE_KEY);
        } catch (error) {
            // Se solicitará autenticación si no se puede leer el almacenamiento.
        }

        return "";
    }

    function clearSessionToken() {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);

        try {
            localStorage.removeItem(OFFLINE_SESSION_STORAGE_KEY);
        } catch (error) {
            // No se interrumpe el cierre de sesión.
        }
    }

    function setUserState(user) {
        state.user = user || null;

        if (!user) {
            return;
        }

        window.ASADA_USER = user;
        document.documentElement.dataset.asadaRole = user.role || "worker";
        state.operatorKey = isSharedWorker(user)
            ? getStoredOperatorKey()
            : "";

        try {
            localStorage.setItem(
                LAST_USER_STORAGE_KEY,
                JSON.stringify({
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    isAdmin: Boolean(user.isAdmin)
                })
            );
        } catch (error) {
            console.warn("No fue posible guardar la identidad local.", error);
        }
    }

    function isSharedWorker(user) {
        return Boolean(
            user &&
            !user.isAdmin &&
            String(user.email || "").trim().toLowerCase() === SHARED_WORKER_EMAIL
        );
    }

    function getStoredOperatorKey() {
        try {
            const key = String(
                localStorage.getItem(OPERATOR_STORAGE_KEY) || ""
            ).trim();

            return SHARED_OPERATOR_OPTIONS.some(option => option.key === key)
                ? key
                : "";
        } catch (error) {
            return "";
        }
    }

    function getOperatorLabel(key) {
        const option = SHARED_OPERATOR_OPTIONS.find(
            item => item.key === key
        );

        return option ? option.label : "";
    }

    function setOperatorKey(key) {
        const valid = SHARED_OPERATOR_OPTIONS.some(
            option => option.key === key
        );

        if (!valid) {
            return false;
        }

        state.operatorKey = key;

        try {
            localStorage.setItem(OPERATOR_STORAGE_KEY, key);
        } catch (error) {
            console.warn("No fue posible guardar el fontanero seleccionado.", error);
        }

        return true;
    }

    function getSessionProfile(user) {
        const email = String(user?.email || "").trim().toLowerCase();

        const knownProfiles = {
            "ronald.rojas@asadaorosi.com": {
                name: "Ronald Rojas",
                role: "Ingeniero"
            },
            "maria.barrantes@asadaorosi.com": {
                name: "María Barrantes",
                role: "Asistente administrativa"
            },
            "chinchillap086@gmail.com": {
                name: "Paola Chinchilla",
                role: "Administradora"
            }
        };

        if (knownProfiles[email]) {
            return knownProfiles[email];
        }

        if (isSharedWorker(user)) {
            return {
                name: getOperatorLabel(state.operatorKey) || "Fontanero",
                role: "Trabajador"
            };
        }

        return {
            name: user?.name || email,
            role: user?.isAdmin ? "Administrador" : "Trabajador"
        };
    }

    function renderSessionControl() {
        const topbar = document.querySelector(".topbar");

        if (!topbar || !state.user) {
            document.getElementById("asadaSessionControl")?.remove();
            return;
        }

        let control = document.getElementById("asadaSessionControl");

        if (!control) {
            control = document.createElement("div");
            control.id = "asadaSessionControl";
            control.className = "asada-session-control";
            control.innerHTML = `
                <div class="asada-session-identity">
                    <strong data-asada-session-name></strong>
                    <span data-asada-session-role></span>
                </div>
                <div class="asada-session-actions">
                    <button type="button" class="btn secondary asada-change-operator" data-asada-change-operator>
                        Cambiar fontanero
                    </button>
                    <button type="button" class="btn secondary asada-logout-button" data-asada-logout>
                        Cerrar sesión
                    </button>
                </div>
            `;

            topbar.append(control);

            control
                .querySelector("[data-asada-logout]")
                ?.addEventListener("click", logoutSession);

            control
                .querySelector("[data-asada-change-operator]")
                ?.addEventListener("click", () => showOperatorPicker(true));
        }

        const profile = getSessionProfile(state.user);
        control.querySelector("[data-asada-session-name]").textContent =
            "Sesión: " + profile.name;
        control.querySelector("[data-asada-session-role]").textContent = profile.role;

        const changeOperator = control.querySelector("[data-asada-change-operator]");
        if (changeOperator) {
            changeOperator.hidden = !isSharedWorker(state.user);
        }
    }

    function hideOperatorPicker() {
        const overlay = document.getElementById("asadaOperatorPicker");

        if (overlay) {
            overlay.classList.add("hidden");
        }
    }

    function showOperatorPicker(force) {
        if (!isSharedWorker(state.user)) {
            return;
        }

        let overlay = document.getElementById("asadaOperatorPicker");

        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "asadaOperatorPicker";
            overlay.className = "asada-operator-picker hidden";
            document.body.append(overlay);
        }

        const current = state.operatorKey || getStoredOperatorKey();
        overlay.innerHTML = `
            <div class="asada-operator-dialog" role="dialog" aria-modal="true" aria-labelledby="asadaOperatorTitle">
                <span class="asada-access-label">CUENTA COMPARTIDA ASADA</span>
                <h2 id="asadaOperatorTitle">¿Quién utilizará este dispositivo?</h2>
                <p>Seleccione el fontanero para separar sus borradores. Esta selección no cambia el correo de acceso.</p>
                <div class="asada-operator-options">
                    ${SHARED_OPERATOR_OPTIONS.map(option => `
                        <button type="button" class="asada-operator-option ${option.key === current ? "is-selected" : ""}" data-asada-operator="${option.key}">
                            ${escapeHtml(option.label)}
                        </button>
                    `).join("")}
                </div>
            </div>
        `;

        overlay.classList.remove("hidden");
        document.body.classList.add("modal-open");

        overlay.querySelectorAll("[data-asada-operator]").forEach(button => {
            button.addEventListener("click", () => {
                const key = String(button.dataset.asadaOperator || "");

                if (!setOperatorKey(key)) {
                    return;
                }

                hideOperatorPicker();
                document.body.classList.remove("modal-open");
                renderSessionControl();
                if (initializeAuthenticatedUi()) {
                    syncLocalDrafts();
                }
            });
        });

        if (!force && current) {
            hideOperatorPicker();
            document.body.classList.remove("modal-open");
        }
    }

    function ensureLogoutModal() {
        let modal = document.getElementById("asadaLogoutModal");

        if (modal) {
            return modal;
        }

        modal = document.createElement("div");
        modal.id = "asadaLogoutModal";
        modal.className = "asada-logout-modal hidden";
        modal.innerHTML = `
            <div class="asada-logout-dialog" role="dialog" aria-modal="true" aria-labelledby="asadaLogoutTitle">
                <div class="asada-logout-icon" aria-hidden="true">↪</div>
                <div class="asada-logout-content">
                    <span class="asada-access-label">ASADA OROSI</span>
                    <h2 id="asadaLogoutTitle">¿Cerrar sesión?</h2>
                    <p data-asada-logout-message></p>
                </div>
                <div class="asada-logout-note">
                    Sus borradores se conservarán y podrá recuperarlos cuando vuelva a iniciar sesión.
                </div>
                <div class="asada-logout-actions">
                    <button type="button" class="btn secondary" data-asada-logout-cancel>
                        Cancelar
                    </button>
                    <button type="button" class="btn primary" data-asada-logout-confirm>
                        Sí, cerrar sesión
                    </button>
                </div>
            </div>
        `;

        document.body.append(modal);

        modal
            .querySelector("[data-asada-logout-cancel]")
            ?.addEventListener("click", closeLogoutModal);

        modal
            .querySelector("[data-asada-logout-confirm]")
            ?.addEventListener("click", performLogout);

        modal.addEventListener("click", event => {
            if (event.target === modal) {
                closeLogoutModal();
            }
        });

        return modal;
    }

    function closeLogoutModal() {
        const modal = document.getElementById("asadaLogoutModal");

        modal?.classList.add("hidden");
        document.body.classList.remove("modal-open");
    }

    function performLogout() {
        closeLogoutModal();
        state.observer?.disconnect();
        state.observer = null;
        state.authPromise = null;
        state.pendingSubmission = null;
        state.pendingDeletion = null;
        state.operatorSelectionShown = false;
        clearSessionToken();
        state.user = null;
        window.ASADA_USER = null;
        delete document.documentElement.dataset.asadaRole;
        hideOperatorPicker();
        document.body.classList.remove("modal-open");
        hideRestrictedMenuLinks();
        renderSessionControl();
        showEmailLogin("La sesión se cerró correctamente.");
    }

    function logoutSession() {
        const modal = ensureLogoutModal();
        const message = modal.querySelector("[data-asada-logout-message]");

        if (message) {
            message.textContent = navigator.onLine
                ? "¿Está segura de que desea cerrar la sesión?"
                : "Está sin conexión. Si cierra la sesión necesitará Internet para recibir otro código. ¿Desea continuar?";
        }

        modal.classList.remove("hidden");
        document.body.classList.add("modal-open");
        modal.querySelector("[data-asada-logout-cancel]")?.focus();
    }

    function getDraftClientId() {
        const base = getClientId();
        const operator = isSharedWorker(state.user)
            ? state.operatorKey || "sin_operador"
            : "principal";

        return (base + "_" + operator)
            .replace(/[^a-zA-Z0-9_-]/g, "")
            .slice(0, 80);
    }

    function getCachedUser() {
        try {
            const raw = localStorage.getItem(LAST_USER_STORAGE_KEY);
            const user = raw ? JSON.parse(raw) : null;

            return user && user.email ? user : null;
        } catch (error) {
            return null;
        }
    }

    function updateOfflineBanner() {
        let banner = document.getElementById("asadaOfflineBanner");

        if (!banner) {
            banner = document.createElement("div");
            banner.id = "asadaOfflineBanner";
            banner.className = "asada-offline-banner";
            banner.setAttribute("role", "status");
            document.body.append(banner);
        }

        if (navigator.onLine) {
            banner.hidden = true;
            banner.textContent = "";
        } else {
            banner.hidden = false;
            banner.textContent =
                "Sin conexión. Puede continuar llenando el formulario; el borrador se guardará en este dispositivo.";
        }
    }

    function getClientId() {
        try {
            let clientId = localStorage.getItem(CLIENT_ID_STORAGE_KEY);

            if (!clientId) {
                clientId = window.crypto && typeof window.crypto.randomUUID === "function"
                    ? window.crypto.randomUUID()
                    : "cliente_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);

                localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
            }

            return clientId;
        } catch (error) {
            return "cliente_temporal";
        }
    }

    function localDraftKey(kind) {
        const email = state.user && state.user.email
            ? String(state.user.email).trim().toLowerCase()
            : "sin-usuario";

        return LOCAL_DRAFT_PREFIX + email + ":" + getDraftClientId() + ":" + kind;
    }

    function openLocalDraftDb() {
        if (state.localDraftDbPromise) {
            return state.localDraftDbPromise;
        }

        if (!window.indexedDB) {
            return Promise.reject(new Error("IndexedDB no está disponible."));
        }

        state.localDraftDbPromise = new Promise((resolve, reject) => {
            const request = window.indexedDB.open(LOCAL_DRAFT_DB_NAME, 1);

            request.onupgradeneeded = event => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(LOCAL_DRAFT_STORE_NAME)) {
                    db.createObjectStore(LOCAL_DRAFT_STORE_NAME, {
                        keyPath: "key"
                    });
                }
            };

            request.onsuccess = event => {
                const db = event.target.result;
                db.onversionchange = () => db.close();
                resolve(db);
            };

            request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento local."));
        });

        return state.localDraftDbPromise;
    }

    function idbRequest(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error("Error de almacenamiento local."));
        });
    }

    async function getLocalDraft(kind) {
        const key = localDraftKey(kind);

        try {
            const db = await openLocalDraftDb();
            const transaction = db.transaction(LOCAL_DRAFT_STORE_NAME, "readonly");
            const result = await idbRequest(
                transaction.objectStore(LOCAL_DRAFT_STORE_NAME).get(key)
            );

            if (result) {
                return result.draft || result;
            }
        } catch (error) {
            console.warn("IndexedDB no está disponible; se usará almacenamiento alterno.", error);
        }

        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    }

    async function saveLocalDraft(draft) {
        const kind = draft && draft.tipo;

        if (!kind || !state.user) {
            return false;
        }

        const key = localDraftKey(kind);
        const value = {
            key,
            draft: {
                ...draft,
                correo: state.user.email,
                fechaActualizacion: draft.fechaActualizacion || new Date().toISOString()
            }
        };

        try {
            const db = await openLocalDraftDb();
            const transaction = db.transaction(LOCAL_DRAFT_STORE_NAME, "readwrite");
            await idbRequest(
                transaction.objectStore(LOCAL_DRAFT_STORE_NAME).put(value)
            );
            return true;
        } catch (error) {
            try {
                localStorage.setItem(key, JSON.stringify(value.draft));
                return true;
            } catch (storageError) {
                console.warn("No fue posible guardar el borrador local.", storageError);
                return false;
            }
        }
    }

    async function deleteLocalDraft(kind) {
        const key = localDraftKey(kind);

        try {
            const db = await openLocalDraftDb();
            const transaction = db.transaction(LOCAL_DRAFT_STORE_NAME, "readwrite");
            await idbRequest(
                transaction.objectStore(LOCAL_DRAFT_STORE_NAME).delete(key)
            );
        } catch (error) {
            // Se continúa con el almacenamiento alterno.
        }

        try {
            localStorage.removeItem(key);
        } catch (error) {
            // No se interrumpe el flujo si el navegador bloquea localStorage.
        }
    }

    function draftTimestamp(draft) {
        const value = draft && (
            draft.fechaActualizacion ||
            draft.updatedAt ||
            draft.localUpdatedAt
        );
        const time = value ? new Date(value).getTime() : 0;

        return Number.isFinite(time) ? time : 0;
    }

    async function getCurrentUser() {
        if (state.authPromise) {
            return state.authPromise;
        }

        state.originalCallApi = state.originalCallApi || window.callApi;

        if (typeof state.originalCallApi !== "function") {
            throw new Error("No se encontró la conexión con Apps Script.");
        }

        const sessionToken = getSessionToken();

        if (!sessionToken) {
            throw new Error("LOGIN_REQUIRED");
        }

        state.authPromise = state.originalCallApi("getCurrentUser", { sessionToken })
            .then(getResponseData)
            .then(data => {
                if (!data.user || !data.user.email) {
                    throw new Error("No se pudo validar la identidad de la cuenta.");
                }

                setUserState(data.user);
                return data.user;
            })
            .catch(error => {
                state.authPromise = null;
                throw error;
            });

        return state.authPromise;
    }

    function installApiGuard() {
        if (
            typeof window.callApi !== "function" ||
            window.callApi.__asadaGuarded === true
        ) {
            return;
        }

        state.originalCallApi = window.callApi;

        const guardedCallApi = async function (action, values) {
            if (
                restrictedActions.has(String(action || "")) &&
                (!state.user || !state.user.isAdmin)
            ) {
                throw new Error(
                    "Los trabajadores no tienen permiso para consultar listados, detalles, reportes ni Excel."
                );
            }

            try {
                const requestValues = {
                    ...(values || {}),
                    sessionToken: getSessionToken()
                };
                const result = await state.originalCallApi(action, requestValues);

                if (
                    (action === "saveRecord" || action === "saveAccident") &&
                    state.pendingSubmission
                ) {
                    const pending = state.pendingSubmission;
                    state.pendingSubmission = null;

                    window.setTimeout(() => {
                        showPostSavePreview(
                            pending.kind,
                            getResponseData(result).record ||
                            getResponseData(result).accident ||
                            null,
                            pending.snapshot
                        );
                    }, 0);
                }

                return result;
            } catch (error) {
                if (action === "saveRecord" || action === "saveAccident") {
                    state.pendingSubmission = null;
                }

                throw error;
            }
        };

        guardedCallApi.__asadaGuarded = true;
        window.callApi = guardedCallApi;
    }

    function hideRestrictedMenuLinks() {
        document.querySelectorAll("a[href]").forEach(link => {
            if (isRestrictedPageLink(link)) {
                const canView = Boolean(state.user && state.user.isAdmin);

                link.hidden = !canView;

                if (canView) {
                    link.removeAttribute("aria-hidden");
                    link.style.removeProperty("display");
                } else {
                    link.setAttribute("aria-hidden", "true");
                    link.style.display = "none";
                }
            }
        });
    }

    function installRestrictedNavigationGuard() {
        if (installRestrictedNavigationGuard.installed) {
            return;
        }

        installRestrictedNavigationGuard.installed = true;

        document.addEventListener(
            "click",
            event => {
                const link = event.target.closest?.("a[href]");

                if (!link || !isRestrictedPageLink(link)) {
                    return;
                }

                if (state.user && state.user.isAdmin) {
                    return;
                }

                event.preventDefault();
                event.stopImmediatePropagation();

                if (state.user) {
                    setStatusMessage(
                        "Su cuenta de trabajador solo puede crear registros y ver la vista previa de lo que acaba de enviar.",
                        false
                    );
                }
            },
            true
        );
    }

    function enforcePageAccess() {
        const page = currentPage();
        const queryId = getQueryId();

        if (!state.user) {
            if (restrictedPages.includes(page) || queryId) {
                setStatusMessage(
                    "Debe iniciar sesión para consultar este contenido.",
                    false
                );
                return false;
            }

            return true;
        }

        if (
            !state.user.isAdmin &&
            (
                restrictedPages.includes(page) ||
                queryId
            )
        ) {
            setStatusMessage(
                "Su cuenta puede crear registros, pero no puede consultar listados, reportes, Excel ni registros enviados.",
                false
            );
            return false;
        }

        return true;
    }

    function getControlKey(control) {
        return String(control.name || control.id || "").trim();
    }

    function getControlLabel(control) {
        const label = control.closest("label");

        if (label) {
            const clone = label.cloneNode(true);
            clone.querySelectorAll("input, select, textarea, button").forEach(item => item.remove());
            const text = clone.textContent.replace(/\s+/g, " ").trim();

            if (text) {
                return text;
            }
        }

        return getControlKey(control) || "Campo";
    }

    function getControlDisplayValue(control) {
        if (control.tagName === "SELECT") {
            const option = control.options[control.selectedIndex];
            return option ? option.textContent.trim() : control.value;
        }

        return String(control.value || "").trim();
    }

    function collectFormData(form) {
        const values = {};

        Array.from(form.elements || []).forEach(control => {
            const key = getControlKey(control);

            if (
                !key ||
                control.type === "file"
            ) {
                return;
            }

            if (control.type === "radio") {
                if (control.checked) {
                    values[key] = control.value;
                }
                return;
            }

            if (control.type === "checkbox") {
                if (!Array.isArray(values[key])) {
                    values[key] = [];
                }

                if (control.checked) {
                    values[key].push(control.value || "on");
                }
                return;
            }

            values[key] = control.value;
        });

        const choices = [];

        form.querySelectorAll(".choice.selected, .multi-choice.selected, .condition.selected")
            .forEach(item => {
                choices.push({
                    group: String(item.dataset.group || "").trim(),
                    value: String(item.dataset.value || item.textContent || "").trim()
                });
            });

        return {
            values,
            choices
        };
    }

    function collectMedia(kind) {
        let source = [];

        if (kind === "mantenimiento") {
            source = [
                ...(Array.isArray(window._pendingPhotoData) ? window._pendingPhotoData : []),
                ...(window._pendingConditionVideoData ? [window._pendingConditionVideoData] : [])
            ];
        } else if (kind === "accidente") {
            source = Array.isArray(window._pendingAccidentPhotoData)
                ? window._pendingAccidentPhotoData
                : [];
        } else if (kind === "factibilidad") {
            source = window.ASADA_FACTIBILIDAD_DRAFT_IMAGE
                ? [window.ASADA_FACTIBILIDAD_DRAFT_IMAGE]
                : [];
        }

        return source
            .filter(item => item && item.data && String(item.data).startsWith("data:"))
            .map(item => ({
                name: item.name || "archivo",
                mimeType: item.mimeType || "",
                data: item.data
            }));
    }

    function countMedia(kind) {
        return collectMedia(kind).length;
    }

    function snapshotForm(form) {
        const kind = getFormKind(form);
        const data = collectFormData(form);
        const rows = [];
        const seen = new Set();

        Array.from(form.elements || []).forEach(control => {
            const key = getControlKey(control);

            if (
                !key ||
                control.type === "file" ||
                control.type === "hidden" ||
                control.type === "submit" ||
                control.type === "button"
            ) {
                return;
            }

            if (control.type === "radio" && !control.checked) {
                return;
            }

            if (control.type === "checkbox" && !control.checked) {
                return;
            }

            const value = getControlDisplayValue(control);

            if (!value && control.type !== "checkbox") {
                return;
            }

            const rowKey = key + "|" + value;

            if (seen.has(rowKey)) {
                return;
            }

            seen.add(rowKey);
            rows.push({
                label: getControlLabel(control),
                value: value || "Sí"
            });
        });

        data.choices.forEach(choice => {
            const label = choice.group || "Selección";
            const rowKey = label + "|" + choice.value;

            if (!seen.has(rowKey)) {
                seen.add(rowKey);
                rows.push({
                    label,
                    value: choice.value
                });
            }
        });

        const id = String(
            form.querySelector("#recordId, #accidentId, [name=\"id\"]")?.value ||
            ""
        ).trim();

        return {
            kind,
            editing: Boolean(id || getQueryId()),
            recordId: id,
            rows,
            mediaCount: countMedia(kind)
        };
    }

    function formHasSubmittedId(form) {
        if (getQueryId()) {
            return true;
        }

        return Boolean(String(
            form.querySelector("#recordId, #accidentId, [name=\"id\"]")?.value ||
            ""
        ).trim());
    }

    function findControls(form, key) {
        return Array.from(form.elements || [])
            .filter(control => getControlKey(control) === key);
    }

    function applyDraftValues(form, draft) {
        const data = draft && draft.datos ? draft.datos : {};
        const values = data.values || {};

        state.restoringDraft = true;

        try {
            Object.keys(values).forEach(key => {
                const controls = findControls(form, key);

                if (!controls.length) {
                    return;
                }

                const value = values[key];

                controls.forEach(control => {
                    if (control.type === "radio") {
                        control.checked = String(control.value) === String(value);
                    } else if (control.type === "checkbox") {
                        const valuesArray = Array.isArray(value) ? value : [value];
                        control.checked = valuesArray.map(String).includes(String(control.value || "on"));
                    } else {
                        control.value = value === null || value === undefined ? "" : value;
                    }
                });
            });

            const selected = Array.isArray(data.choices) ? data.choices : [];

            form.querySelectorAll(".choice[data-value], .multi-choice[data-value], .condition[data-value]")
                .forEach(item => {
                    const group = String(item.dataset.group || "").trim();
                    const value = String(item.dataset.value || item.textContent || "").trim();
                    const wanted = selected.some(choice =>
                        String(choice.group || "").trim() === group &&
                        String(choice.value || "").trim() === value
                    );

                    if (wanted && !item.classList.contains("selected")) {
                        item.click();
                    }
                });

            form.dispatchEvent(new Event("input", { bubbles: true }));
            form.dispatchEvent(new Event("change", { bubbles: true }));
        } finally {
            state.restoringDraft = false;
        }

        const files = Array.isArray(draft.archivos) ? draft.archivos : [];
        applyDraftMedia(getFormKind(form), files);
    }

    function applyDraftMedia(kind, files) {
        const validFiles = files.filter(item => item && item.data);

        if (kind === "mantenimiento") {
            window._pendingPhotoData = validFiles.filter(item =>
                String(item.mimeType || "").startsWith("image/")
            );

            const video = validFiles.find(item =>
                String(item.mimeType || "").startsWith("video/")
            );

            window._pendingConditionVideoData = video || null;

            if (typeof window.renderImagePreview === "function") {
                window.renderImagePreview();
            }

            if (typeof window.renderConditionVideoPreview === "function") {
                window.renderConditionVideoPreview();
            }
        } else if (kind === "accidente") {
            window._pendingAccidentPhotoData = validFiles.filter(item =>
                String(item.mimeType || "").startsWith("image/")
            );

            if (typeof window.renderAccidentPhotoPreview === "function") {
                window.renderAccidentPhotoPreview();
            }
        } else if (
            kind === "factibilidad" &&
            validFiles[0] &&
            typeof window.ASADA_APPLY_FACTIBILIDAD_DRAFT_IMAGE === "function"
        ) {
            window.ASADA_APPLY_FACTIBILIDAD_DRAFT_IMAGE(validFiles[0]);
        }
    }

    function showDraftNote(form) {
        if (form.querySelector("[data-asada-draft-note]")) {
            return;
        }

        const note = document.createElement("p");
        note.className = "note asada-draft-note";
        note.dataset.asadaDraftNote = "true";
        note.textContent = "Los cambios se guardan como borrador y se sincronizan con su correo autorizado.";
        form.parentElement.insertBefore(note, form);
    }

    function setDraftNoteState(form, message, type) {
        showDraftNote(form);

        const note = form.querySelector("[data-asada-draft-note]");

        if (!note) {
            return;
        }

        note.textContent = message;
        note.classList.remove("is-local", "is-syncing", "is-error", "is-success");

        if (type) {
            note.classList.add(type);
        }
    }

    function buildDraftPayload(form) {
        const kind = getFormKind(form);

        return {
            tipo: kind,
            datos: collectFormData(form),
            archivos: collectMedia(kind),
            fechaActualizacion: new Date().toISOString(),
            correo: state.user && state.user.email
                ? state.user.email
                : "",
            clienteId: getDraftClientId(),
            operador: isSharedWorker(state.user)
                ? getOperatorLabel(state.operatorKey)
                : ""
        };
    }

    async function persistDraftLocally(form, draft) {
        const saved = await saveLocalDraft(draft);

        if (saved) {
            setDraftNoteState(
                form,
                navigator.onLine
                    ? "Borrador guardado localmente; se sincronizará con el servidor."
                    : "Sin conexión: borrador guardado en este dispositivo.",
                "is-local"
            );
        }

        return saved;
    }

    async function syncDraftToServer(form, draft) {
        if (!navigator.onLine || !state.user || formHasSubmittedId(form)) {
            return false;
        }

        setDraftNoteState(form, "Sincronizando borrador...", "is-syncing");

        try {
            await window.callApi("saveDraft", { draft });
            setDraftNoteState(
                form,
                "Borrador guardado y sincronizado con su correo autorizado.",
                "is-success"
            );
            return true;
        } catch (error) {
            setDraftNoteState(
                form,
                "Borrador guardado en este dispositivo. Se sincronizará cuando vuelva la conexión.",
                "is-local"
            );
            return false;
        }
    }

    function scheduleDraftSave(form) {
        if (
            state.restoringDraft ||
            !state.user ||
            formHasSubmittedId(form)
        ) {
            return;
        }

        const current = state.formStates.get(form);

        if (current && current.timer) {
            window.clearTimeout(current.timer);
        }

        const draft = buildDraftPayload(form);
        persistDraftLocally(form, draft);

        const timer = window.setTimeout(async () => {
            const kind = getFormKind(form);

            if (!kind || !state.user || formHasSubmittedId(form)) {
                return;
            }

            await syncDraftToServer(form, buildDraftPayload(form));
        }, SERVER_DRAFT_DELAY_MS);

        state.formStates.set(form, { timer, lastDraft: draft });
    }

    async function restoreDraft(form) {
        const kind = getFormKind(form);

        if (
            !kind ||
            formHasSubmittedId(form)
        ) {
            return;
        }

        const localDraft = await getLocalDraft(kind);
        let serverDraft = null;

        try {
            if (navigator.onLine) {
                const response = await window.callApi("getDraft", {
                    tipo: kind,
                    clienteId: getDraftClientId()
                });
                serverDraft = response && response.draft;
            }
        } catch (error) {
            serverDraft = null;
        }

        const draft = draftTimestamp(localDraft) > draftTimestamp(serverDraft)
            ? localDraft
            : serverDraft || localDraft;

        if (!draft) {
            return;
        }

        applyDraftValues(form, draft);
        showDraftNote(form);

        if (draft === localDraft && draftTimestamp(localDraft) > draftTimestamp(serverDraft)) {
            await syncDraftToServer(form, localDraft);
        } else if (serverDraft) {
            await saveLocalDraft({
                ...serverDraft,
                tipo: kind,
                correo: state.user.email
            });
            setDraftNoteState(
                form,
                "Borrador recuperado y sincronizado con su correo autorizado.",
                "is-success"
            );
        }
    }

    async function syncLocalDrafts() {
        if (!state.user || !navigator.onLine || state.onlineSyncPromise) {
            return;
        }

        state.onlineSyncPromise = (async () => {
            for (const kind of draftTypes) {
                const draft = await getLocalDraft(kind);

                if (!draft || !draft.datos) {
                    continue;
                }

                try {
                    const response = await window.callApi("getDraft", {
                        tipo: kind,
                        clienteId: getDraftClientId()
                    });
                    const serverDraft = response && response.draft;

                    if (serverDraft && draftTimestamp(serverDraft) >= draftTimestamp(draft)) {
                        await saveLocalDraft({
                            ...serverDraft,
                            tipo: kind,
                            correo: state.user.email
                        });
                        continue;
                    }

                    await window.callApi("saveDraft", { draft });
                } catch (error) {
                    // Se intentará nuevamente en el próximo evento online.
                }
            }
        })().finally(() => {
            state.onlineSyncPromise = null;
        });

        await state.onlineSyncPromise;
    }

    function installDraftForForm(form) {
        const kind = getFormKind(form);

        if (
            !kind ||
            state.formStates.has(form)
        ) {
            return;
        }

        state.formStates.set(form, { timer: null });

        form.addEventListener("input", () => scheduleDraftSave(form));
        form.addEventListener("change", () => scheduleDraftSave(form));
        form.addEventListener("click", event => {
            if (event.target.closest(".choice, .multi-choice, .condition, .upload-box")) {
                scheduleDraftSave(form);
            }
        });

        restoreDraft(form);
    }

    function installForms() {
        document.querySelectorAll("#maintenanceForm, #accidentForm, #factibilidadForm")
            .forEach(installDraftForForm);
    }

    function getRecordTypeLabel(kind) {
        const labels = {
            mantenimiento: "revisión de vehículo",
            accidente: "daño o accidente",
            factibilidad: "inspección de factibilidad de agua potable"
        };

        return labels[kind] || "registro";
    }

    function getListPageForKind(kind) {
        const pages = {
            mantenimiento: "registros.html",
            accidente: "accidentes.html",
            factibilidad: "factibilidades.html"
        };

        return pages[kind] || "index.html";
    }

    function getKindForDeleteAction(action) {
        const kinds = {
            deleteRecord: "mantenimiento",
            deleteAccident: "accidente",
            deleteFactibilidad: "factibilidad"
        };

        return kinds[action] || "";
    }

    function setModalContent(mode, snapshot, savedRecord) {
        const modal = ensureModal();
        const title = modal.querySelector("[data-asada-modal-title]");
        const message = modal.querySelector("[data-asada-modal-message]");
        const list = modal.querySelector("[data-asada-modal-list]");
        const confirmButton = modal.querySelector("[data-asada-confirm]");
        const closeButton = modal.querySelector("[data-asada-close]");
        const newButton = modal.querySelector("[data-asada-new]");

        const kind = snapshot.kind || "";
        const recordType = getRecordTypeLabel(kind);
        const recordId = savedRecord && savedRecord.id
            ? String(savedRecord.id)
            : String(snapshot.recordId || "").trim();

        confirmButton.classList.remove("asada-danger-button");
        newButton.hidden = true;
        modal.dataset.asadaPreviewKind = kind;
        modal.dataset.asadaModalMode = mode;
        modal.dataset.asadaAfterClose = "";

        if (mode === "confirm") {
            title.textContent = snapshot.editing
                ? "Actualizar " + recordType
                : "Crear " + recordType;
            message.textContent = snapshot.editing
                ? "¿Está segura de actualizar este " + recordType + "? Verifique el ID y la información antes de continuar."
                : "¿Está segura de enviar este " + recordType + "? Una vez creado, los trabajadores no podrán editarlo.";
            confirmButton.hidden = false;
            confirmButton.textContent = "Confirmar y guardar";
            closeButton.textContent = "Cancelar";
        } else if (mode === "delete") {
            title.textContent = "Eliminar " + recordType;
            message.textContent = "¿Está segura de eliminar este " + recordType + "? Esta acción no se puede deshacer.";
            confirmButton.hidden = false;
            confirmButton.textContent = "Eliminar definitivamente";
            confirmButton.classList.add("asada-danger-button");
            closeButton.textContent = "Cancelar";
        } else if (mode === "deleted") {
            title.textContent = recordType.charAt(0).toUpperCase() + recordType.slice(1) + " eliminado correctamente";
            message.textContent = "El registro se eliminó correctamente y ya no aparece en el listado.";
            confirmButton.hidden = true;
            closeButton.textContent = "Volver al listado";
            modal.dataset.asadaAfterClose = "list";
        } else if (mode === "error") {
            title.textContent = "No fue posible completar la acción";
            message.textContent = "Revise el mensaje siguiente y vuelva a intentarlo si es necesario.";
            confirmButton.hidden = true;
            closeButton.textContent = "Cerrar";
        } else {
            title.textContent = snapshot.editing
                ? recordType.charAt(0).toUpperCase() + recordType.slice(1) + " actualizado correctamente"
                : recordType.charAt(0).toUpperCase() + recordType.slice(1) + " creado correctamente";
            message.textContent = recordId
                ? "La información se guardó correctamente. ID del registro: " + recordId
                : "La información se guardó correctamente.";
            confirmButton.hidden = true;
            closeButton.textContent = snapshot.editing
                ? "Aceptar y volver al listado"
                : "Aceptar y limpiar formulario";
            // La confirmación final solo ofrece una acción de Aceptar.
            newButton.hidden = true;
            modal.dataset.asadaAfterClose = snapshot.editing
                ? "list"
                : "reset";
        }

        const rows = snapshot.rows.slice();

        if (recordId) {
            rows.unshift({ label: "Identificador", value: recordId });
        }

        if (snapshot.mediaCount > 0) {
            rows.push({
                label: "Archivos adjuntos",
                value: String(snapshot.mediaCount)
            });
        }

        list.innerHTML = rows.length
            ? rows.map(row => `
                <div class="asada-preview-row">
                    <span>${escapeHtml(row.label)}</span>
                    <strong>${escapeHtml(row.value)}</strong>
                </div>
            `).join("")
            : "<p class=\"note\">No hay campos adicionales para mostrar.</p>";

        modal.classList.remove("hidden");
        document.body.classList.add("modal-open");
    }

    function ensureModal() {
        let modal = document.getElementById("asadaSecurityModal");

        if (modal) {
            return modal;
        }

        modal = document.createElement("div");
        modal.id = "asadaSecurityModal";
        modal.className = "asada-security-modal hidden";
        modal.innerHTML = `
            <div class="asada-security-dialog" role="dialog" aria-modal="true" aria-labelledby="asadaSecurityModalTitle">
                <div class="asada-security-header">
                    <span class="asada-access-label">ASADA OROSI</span>
                    <h2 id="asadaSecurityModalTitle" data-asada-modal-title>Confirmar envío</h2>
                </div>
                <div class="asada-security-body">
                    <p data-asada-modal-message></p>
                    <div class="asada-preview-list" data-asada-modal-list></div>
                </div>
                <div class="asada-security-actions">
                    <button type="button" class="btn secondary" data-asada-new hidden>Crear otro registro</button>
                    <button type="button" class="btn secondary" data-asada-close>Cancelar</button>
                    <button type="button" class="btn primary" data-asada-confirm>Confirmar y guardar</button>
                </div>
            </div>
        `;

        document.body.append(modal);

        modal.querySelector("[data-asada-close]").addEventListener("click", hideModal);
        modal.querySelector("[data-asada-confirm]").addEventListener("click", confirmModalAction);
        modal.querySelector("[data-asada-new]").addEventListener("click", startAnotherRecord);

        modal.addEventListener("click", event => {
            if (event.target === modal) {
                hideModal();
            }
        });

        return modal;
    }

    function startAnotherRecord() {
        const modal = document.getElementById("asadaSecurityModal");
        const kind = modal?.dataset.asadaPreviewKind || "";
        const pages = {
            mantenimiento: "mantenimiento.html",
            accidente: "crear-accidente.html",
            factibilidad: "crear-factibilidad.html"
        };
        const page = pages[kind];

        if (!page) {
            hideModal();
            return;
        }

        window.location.href = page;
    }

    function hideModal() {
        const modal = document.getElementById("asadaSecurityModal");
        const afterClose = modal?.dataset.asadaAfterClose || "";
        const kind = modal?.dataset.asadaPreviewKind || "";

        if (modal) {
            modal.classList.add("hidden");
            modal.dataset.asadaAfterClose = "";
        }

        document.body.classList.remove("modal-open");

        if (afterClose === "list") {
            window.location.href = getListPageForKind(kind);
        } else if (afterClose === "reset") {
            window.location.reload();
        }
    }

    function hideExistingSaveModals() {
        [
            "saveConfirmation",
            "accidentSaveConfirmation"
        ].forEach(id => {
            document.getElementById(id)?.classList.add("hidden");
        });

        document.body.classList.remove("modal-open");
    }

    function confirmPendingSubmission() {
        const pending = state.pendingSubmission;

        if (!pending || !pending.form.isConnected) {
            hideModal();
            return;
        }

        pending.form.dataset.asadaSubmitBypass = "1";
        hideModal();

        if (typeof pending.form.requestSubmit === "function") {
            pending.form.requestSubmit();
        } else {
            pending.form.dispatchEvent(new Event("submit", {
                bubbles: true,
                cancelable: true
            }));
        }
    }

    function confirmModalAction() {
        if (state.pendingDeletion) {
            const button = state.pendingDeletion;
            state.pendingDeletion = null;
            hideModal();
            performDeleteFromServer(button);
            return;
        }

        confirmPendingSubmission();
    }

    function showPreSaveConfirmation(form, snapshot) {
        state.pendingSubmission = {
            form,
            kind: snapshot.kind,
            snapshot
        };

        setModalContent("confirm", snapshot, null);
    }

    function showPostSavePreview(kind, savedRecord, fallbackSnapshot) {
        const pending = state.pendingSubmission;
        const snapshot = pending && pending.kind === kind
            ? pending.snapshot
            : fallbackSnapshot;

        if (!snapshot) {
            return;
        }

        state.pendingSubmission = null;
        hideExistingSaveModals();
        setModalContent("preview", snapshot, savedRecord || null);

        deleteLocalDraft(kind);

        if (navigator.onLine) {
            window.callApi("deleteDraft", {
                tipo: kind,
                clienteId: getDraftClientId()
            })
                .catch(error => console.warn("No fue posible eliminar el borrador enviado.", error));
        }
    }

    window.asadaShowPostSavePreview = showPostSavePreview;

    function handleSubmit(event) {
        const form = event.target;
        const kind = getFormKind(form);

        if (!kind) {
            return;
        }

        if (!state.user) {
            event.preventDefault();
            event.stopImmediatePropagation();
            window.alert("Espere a que se valide su cuenta e intente nuevamente.");
            return;
        }

        if (form.dataset.asadaSubmitBypass === "1") {
            delete form.dataset.asadaSubmitBypass;
            return;
        }

        if (!state.user.isAdmin && formHasSubmittedId(form)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            setStatusMessage(
                "Los trabajadores solamente pueden crear registros nuevos.",
                false
            );
            return;
        }

        if (typeof form.reportValidity === "function" && !form.reportValidity()) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        showPreSaveConfirmation(form, snapshotForm(form));
    }

    function installSubmitGuard() {
        document.addEventListener("submit", handleSubmit, true);
    }

    function addDeleteButton(card, action, label, id) {
        if (
            !card ||
            !id ||
            card.querySelector("[data-asada-delete]")
        ) {
            return;
        }

        const actions = card.querySelector(".record-card-actions, .fact-card-actions, .detail-actions, .detail-card-actions") || card;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn secondary asada-delete-button";
        button.dataset.asadaDelete = action;
        button.dataset.asadaDeleteId = id;
        button.dataset.asadaDeleteLabel = label;
        button.textContent = "Eliminar";
        actions.append(button);
    }

    function idFromLink(card, pageName) {
        const link = card.querySelector(`a[href*="${pageName}?id="]`);

        if (!link) {
            return "";
        }

        return String(
            new URL(link.href, window.location.href).searchParams.get("id") ||
            ""
        ).trim();
    }

    function idFromCardHeading(card) {
        return String(
            card.querySelector(".record-card-top h2, .fact-record-id")?.textContent ||
            ""
        ).trim();
    }

    function installDeleteButtons() {
        if (!state.user || !state.user.isAdmin) {
            return;
        }

        document.querySelectorAll(".record-card").forEach(card => {
            const hasAccidentButton = Boolean(
                card.querySelector("button[onclick*='AccidentDetail']")
            );
            const accidentId = idFromLink(card, "detalle-accidente.html") ||
                (hasAccidentButton ? idFromCardHeading(card) : "");
            const recordId = idFromLink(card, "detalle.html");

            if (accidentId) {
                addDeleteButton(card, "deleteAccident", "daño o accidente", accidentId);
            } else if (recordId) {
                addDeleteButton(card, "deleteRecord", "revisión", recordId);
            }
        });

        document.querySelectorAll(".fact-record-card").forEach(card => {
            const id = idFromLink(card, "detalle-factibilidad.html");

            if (id) {
                addDeleteButton(card, "deleteFactibilidad", "inspección de factibilidad", id);
            }
        });

        const currentId = getQueryId();

        if (currentId && restrictedPages.includes(currentPage())) {
            const action = currentPage() === "detalle-factibilidad.html"
                ? "deleteFactibilidad"
                : currentPage() === "detalle-accidente.html"
                    ? "deleteAccident"
                    : "deleteRecord";

            addDeleteButton(
                document.querySelector("main"),
                action,
                "registro",
                currentId
            );
        }
    }

    function requestDeleteConfirmation(button) {
        const action = button.dataset.asadaDelete;
        const id = button.dataset.asadaDeleteId;
        const label = button.dataset.asadaDeleteLabel || "registro";
        const kind = getKindForDeleteAction(action);

        if (!action || !id || !state.user || !state.user.isAdmin) {
            return;
        }

        state.pendingDeletion = button;
        state.pendingSubmission = null;
        setModalContent("delete", {
            kind,
            editing: false,
            recordId: id,
            rows: [
                { label: "Tipo de registro", value: label },
                { label: "Identificador", value: id },
                { label: "Aviso", value: "La eliminación será permanente para el listado." }
            ],
            mediaCount: 0
        }, null);
    }

    async function performDeleteFromServer(button) {
        const action = button.dataset.asadaDelete;
        const id = button.dataset.asadaDeleteId;

        if (!action || !id || !state.user || !state.user.isAdmin) {
            return;
        }

        button.disabled = true;
        button.textContent = "Eliminando...";

        try {
            await window.callApi(action, { id });
            const card = button.closest("article, .detail-card, .detail-section");
            const kind = getKindForDeleteAction(action);
            const label = button.dataset.asadaDeleteLabel || "registro";

            if (card && card.tagName.toLowerCase() === "article") {
                card.remove();
            }

            setModalContent("deleted", {
                kind,
                editing: false,
                recordId: id,
                rows: [
                    { label: "Tipo de registro", value: label },
                    { label: "Identificador", value: id }
                ],
                mediaCount: 0
            }, { id });
        } catch (error) {
            button.disabled = false;
            button.textContent = "Eliminar";
            setModalContent("error", {
                editing: false,
                rows: [
                    { label: "Error", value: error.message || "No fue posible eliminar el registro." }
                ],
                mediaCount: 0
            }, null);
        }
    }

    function installDeleteEvents() {
        document.addEventListener("click", event => {
            const button = event.target.closest("[data-asada-delete]");

            if (button) {
                requestDeleteConfirmation(button);
            }
        });
    }

    function initializeAuthenticatedUi() {
        renderSessionControl();

        // La cuenta compartida debe elegir el fontanero en cada carga de
        // página. El valor guardado se usa para separar borradores, pero no
        // debe ocultar el selector cuando vuelven a entrar.
        if (
            isSharedWorker(state.user) &&
            !state.operatorKey &&
            !state.operatorSelectionShown
        ) {
            state.operatorSelectionShown = true;
            hideRestrictedMenuLinks();
            showOperatorPicker(true);
            return false;
        }

        if (!enforcePageAccess()) {
            hideRestrictedMenuLinks();
            return false;
        }

        hideRestrictedMenuLinks();

        hideOperatorPicker();
        installForms();
        installDeleteButtons();

        if (state.observer) {
            return;
        }

        state.observer = new MutationObserver(() => {
            hideRestrictedMenuLinks();
            installForms();
            installDeleteButtons();
        });

        state.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return true;
    }

    async function start() {
        installApiGuard();
        installSubmitGuard();
        installDeleteEvents();
        installRestrictedNavigationGuard();
        hideRestrictedMenuLinks();
        updateOfflineBanner();

        const sessionToken = getSessionToken();

        if (!sessionToken) {
            showEmailLogin(
                navigator.onLine
                    ? "Escriba su correo autorizado para recibir un código temporal."
                    : "Está sin conexión. Para iniciar sesión por primera vez necesita Internet."
            );
            finishAuthReady(null);
            return;
        }

        if (!navigator.onLine) {
            const cachedUser = getCachedUser();

            if (!cachedUser) {
                showEmailLogin("No hay una identidad guardada para trabajar sin conexión. Conéctese a Internet e inicie sesión.");
                finishAuthReady(null);
                return;
            }

            setUserState(cachedUser);
            finishAuthReady(cachedUser);
            initializeAuthenticatedUi();
            return;
        }

        try {
            await getCurrentUser();
        } catch (error) {
            clearSessionToken();
            showEmailLogin("La sesión venció o no pudo validarse. Solicite un nuevo código.");
            finishAuthReady(null);
            return;
        }

        finishAuthReady(state.user);

        if (initializeAuthenticatedUi()) {
            await syncLocalDrafts();
        }
    }

    window.addEventListener("offline", updateOfflineBanner);

    window.addEventListener("online", async () => {
        updateOfflineBanner();

        if (!getSessionToken()) {
            return;
        }

        try {
            state.authPromise = null;
            await getCurrentUser();
            if (initializeAuthenticatedUi()) {
                await syncLocalDrafts();
            }
        } catch (error) {
            clearSessionToken();
            state.user = null;
            hideRestrictedMenuLinks();
            showEmailLogin("La sesión venció. Solicite un nuevo código para continuar.");
        }
    });

    // Se instala antes de DOMContentLoaded para ocultar enlaces desde el
    // primer momento y bloquear navegación directa de trabajadores.
    installApiGuard();
    installRestrictedNavigationGuard();
    hideRestrictedMenuLinks();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
