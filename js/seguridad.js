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
        pendingBulkDeletion: null,
        operatorKey: "",
        operatorSelectionShown: false,
        restoringDraft: false,
        formStates: new WeakMap(),
        observer: null,
        observerRefreshQueued: false,
        localDraftDbPromise: null,
        onlineSyncPromise: null,
        offlineBannerTimer: null,
        workerRedirectTimer: null
    };

    const ADMIN_FRONTEND_PROFILES = {
        "ronald.rojas@asadaorosi.com": {
            name: "Ronald Rojas",
            role: "Ingeniero de Salud Ocupacional"
        },
        "maria.barrantes@asadaorosi.com": {
            name: "María Barrantes",
            role: "Asistente administrativa"
        },
        "chinchillap086@gmail.com": {
            name: "Paola Chinchilla",
            role: "Administradora del sistema"
        }
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
        "detalle-factibilidad.html",
        "cloros.html",
        "detalle-cloro.html",
        "aforos.html",
        "detalle-aforo.html"
    ];

    const restrictedActions = new Set([
        "getAllRecords",
        "getRecordsByVehicle",
        "getRecordById",
        "getAllAccidents",
        "getAccidentsByVehicle",
        "getAccidentById",
        "getAccidentPdfData",
        "getAllFactibilidades",
        "getFactibilidadById",
        "saveFactibilidadPdf",
        "getFactibilidadImageData",
        "getFactibilidadMapData",
        "getAllCloros",
        "getCloroById",
        "getAllAforos",
        "getAforoById",
        "exportRecords",
        "exportAccidents",
        "exportFactibilidades",
        "deleteCloro",
        "deleteAforo",
        "deleteRecordsBatch"
    ]);

    const draftTypes = [
        "mantenimiento",
        "accidente",
        "factibilidad",
        "cloro",
        "aforo"
    ];

    const SESSION_STORAGE_KEY =
        "ASADA_SESSION_TOKEN";

    const OFFLINE_SESSION_STORAGE_KEY =
        "ASADA_OFFLINE_SESSION";

    const SESSION_LOCAL_TTL_MS =
        24 * 60 * 60 * 1000;

    const OFFLINE_BANNER_DURATION_MS =
        60 * 1000;

    const OFFLINE_BANNER_SHOWN_STORAGE_KEY =
        "ASADA_OFFLINE_BANNER_SHOWN";

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
        "asadaorosi4@gmail.com";

    const SHARED_OPERATOR_OPTIONS = [
        { key: "fontanero_1", label: "Rodolfo" },
        { key: "fontanero_2", label: "Guillermo" },
        { key: "fontanero_3", label: "Paul" },
        { key: "fontanero_4", label: "Roberto" }
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

        if (form.id === "cloroForm") {
            return "cloro";
        }

        if (form.id === "aforoForm") {
            return "aforo";
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

        const retryButton = isError
            ? `
                <button type="button" class="btn primary" onclick="window.location.reload()">
                    Intentar nuevamente
                </button>
            `
            : "";

        root.innerHTML = `
            <section class="asada-access-denied" role="alert">
                <span class="asada-access-label">ACCESO AL SISTEMA</span>
                <h1>${escapeHtml(isError ? "No fue posible validar su cuenta" : "Acceso restringido")}</h1>
                <p>${escapeHtml(message)}</p>
                ${retryButton}
            </section>
        `;
    }

    function isAdminUser(user) {
        const email = String(user?.email || "")
            .trim()
            .toLowerCase();

        return Boolean(
            user?.isAdmin ||
            Object.prototype.hasOwnProperty.call(ADMIN_FRONTEND_PROFILES, email)
        );
    }

    function redirectWorkerToMenu(message) {
        setStatusMessage(message, false);

        if (state.workerRedirectTimer) {
            window.clearTimeout(state.workerRedirectTimer);
        }

        state.workerRedirectTimer = window.setTimeout(() => {
            window.location.href = "index.html";
        }, 1500);
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
                            Perfil de fontanero (después del código)
                            <select id="asadaLoginOperator" autocomplete="off">
                                <option value="">Seleccione su perfil</option>
                                ${SHARED_OPERATOR_OPTIONS.map(option => `
                                    <option value="${escapeHtml(option.key)}">
                                        ${escapeHtml(option.label)}
                                    </option>
                                `).join("")}
                            </select>
                        </label>
                        <p class="note">Después de verificar el código deberá elegir Rodolfo, Guillermo, Paul o Roberto antes de entrar al sistema.</p>
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
                // La elección del fontanero ocurre después de validar el código,
                // mediante el selector obligatorio previo al menú principal.
                profileStep.hidden = true;
            }

            if (operatorSelect) {
                operatorSelect.required = false;
                operatorSelect.value = isShared ? state.operatorKey : "";
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
            requestButton.disabled = true;
            requestButton.textContent = "Enviando...";
            loginRequestId = typeof createRequestId === "function"
                ? createRequestId()
                : "login_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);

            try {
                await callUnauthenticatedApi("requestLoginCode", {
                    email,
                    loginRequestId,
                    // El perfil se elige obligatoriamente después de validar el código.
                    perfil: ""
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

                if (email === SHARED_WORKER_EMAIL) {
                    // No reutilizar accidentalmente el fontanero de una sesión anterior.
                    // Al recargar aparecerá el selector obligatorio antes del menú.
                    try {
                        localStorage.removeItem(OPERATOR_STORAGE_KEY);
                    } catch (storageError) {
                        // El selector posterior sigue bloqueando el acceso si no se puede limpiar.
                    }
                    state.operatorKey = "";
                    state.operatorSelectionShown = false;
                }

                /*
                    verifyAsadaLoginCode ya devuelve el usuario validado.
                    Lo guardamos de inmediato para que, después de recargar,
                    la barra de identidad aparezca sin esperar otra consulta.
                */
                if (response.user && response.user.email) {
                    setUserState(response.user);
                    renderSessionControl();
                }

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
        const email = String(user?.email || "").trim().toLowerCase();
        const adminProfile = ADMIN_FRONTEND_PROFILES[email];

        state.user = user
            ? adminProfile
                ? {
                    ...user,
                    email,
                    name: adminProfile.name,
                    role: "admin",
                    isAdmin: true
                }
                : user
            : null;

        user = state.user;

        if (!user) {
            window.ASADA_USER = null;
            state.operatorKey = "";
            delete document.documentElement.dataset.asadaRole;
            return;
        }

        window.ASADA_USER = user;
        document.documentElement.dataset.asadaRole = user.role || "worker";
        /*
            El perfil seleccionado pertenece a la sesión del navegador, no a
            una página individual. Así Rodolfo, Guillermo, Paul o Roberto se
            conserva al navegar entre Inicio, creación, listados y borradores.
            Después de una nueva verificación de código se limpia
            OPERATOR_STORAGE_KEY y el selector vuelve a ser obligatorio.
        */
        state.operatorKey = isSharedWorker(user)
            ? state.operatorKey || getStoredOperatorKey()
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

    function getDraftProfileLabel(user = state.user) {
        if (isSharedWorker(user)) {
            return getOperatorLabel(state.operatorKey) || "Perfil pendiente";
        }

        const profile = getSessionProfile(user);
        const name = String(profile?.name || user?.name || "Usuario")
            .replace(/\s+/g, " ")
            .trim();

        return name.split(" ")[0] || "Usuario";
    }

    function updateDraftsCardStatus() {
        const status = document.querySelector("[data-asada-drafts-status]");

        if (!status || !state.user) {
            return;
        }

        Promise.all(draftTypes.map(kind => getLocalDraft(kind)))
            .then(drafts => {
                const count = drafts.filter(
                    draft => draft && draft.datos
                ).length;

                status.textContent = count
                    ? count === 1
                        ? "Tiene 1 borrador pendiente."
                        : "Tiene " + count + " borradores pendientes."
                    : "No hay borradores pendientes.";
            })
            .catch(() => {
                status.textContent = "Consulte sus borradores guardados.";
            });
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
            ...ADMIN_FRONTEND_PROFILES,
            "ronald.rojas@asadaorosi.com": {
                name: "Ronald Rojas",
                role: "Ingeniero de Salud Ocupacional"
            },
            "maria.barrantes@asadaorosi.com": {
                name: "María Barrantes",
                role: "Asistente administrativa"
            },
            "chinchillap086@gmail.com": {
                name: "Paola Chinchilla",
                role: "Administradora del sistema"
            }
        };

        if (knownProfiles[email]) {
            return knownProfiles[email];
        }

        if (isSharedWorker(user)) {
            return {
                name: getOperatorLabel(state.operatorKey) || "Seleccione perfil",
                role: ""
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
                </div>
                <div class="asada-session-actions">
                    <button type="button" class="btn secondary asada-logout-button" data-asada-logout>
                        Cerrar sesión
                    </button>
                </div>
            `;

            topbar.append(control);

            control
                .querySelector("[data-asada-logout]")
                ?.addEventListener("click", logoutSession);
        }

        const profile = getSessionProfile(state.user);
        control.querySelector("[data-asada-session-name]").textContent =
            profile.name;

        ensureWorkerMenuLinks();
        updateDraftsCardStatus();
    }

    function ensureWorkerMenuLinks() {
        const menu = document.getElementById("sideMenu");

        if (!menu) {
            return;
        }

        const worker = isSharedWorker(state.user);
        const canViewDrafts = Boolean(state.user);
        const existingProfileLink = menu.querySelector("[data-asada-change-profile]");
        const existingDraftsLink = menu.querySelector("[data-asada-drafts-link]");

        if (!worker) {
            existingProfileLink?.remove();
        }

        if (worker) {
            let profileLink = existingProfileLink;
            if (!profileLink) {
                profileLink = document.createElement("a");
                profileLink.href = "#";
                profileLink.dataset.asadaChangeProfile = "true";
                profileLink.textContent = "Cambiar perfil";
                profileLink.addEventListener("click", event => {
                    event.preventDefault();
                    showOperatorPicker(true);
                });
                menu.append(profileLink);
            }
        }

        if (!canViewDrafts) {
            existingDraftsLink?.remove();
            return;
        }

        if (!existingDraftsLink) {
            const draftsLink = document.createElement("a");
            draftsLink.href = "borradores.html";
            draftsLink.dataset.asadaDraftsLink = "true";
            draftsLink.textContent = "Ver borradores";
            menu.append(draftsLink);
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
        state.operatorKey = "";
        try {
            localStorage.removeItem(OPERATOR_STORAGE_KEY);
        } catch (error) {
            // El cierre de sesión continúa aunque el navegador no permita borrar el perfil local.
        }
        clearSessionToken();
        setUserState(null);
        hideOperatorPicker();
        document.body.classList.remove("modal-open");
        hideRestrictedMenuLinks();
        window.location.href = "index.html";
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

    function renderCachedSessionImmediately() {
        if (!getSessionToken()) {
            return;
        }

        const cachedUser = getCachedUser();

        if (!cachedUser) {
            return;
        }

        /*
            Se muestra únicamente la identidad ya validada y guardada en
            este navegador. Los permisos siguen dependiendo de la validación
            posterior con Apps Script; esto solo evita que la barra aparezca
            tarde o desaparezca al cambiar de página.
        */
        setUserState(cachedUser);
        renderSessionControl();

        if (
            isSharedWorker(state.user) &&
            !state.operatorKey &&
            !state.operatorSelectionShown
        ) {
            state.operatorSelectionShown = true;
            showOperatorPicker(true);
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
            if (state.offlineBannerTimer) {
                window.clearTimeout(state.offlineBannerTimer);
                state.offlineBannerTimer = null;
            }

            try {
                sessionStorage.removeItem(OFFLINE_BANNER_SHOWN_STORAGE_KEY);
            } catch (error) {
                // El aviso continúa funcionando aunque el almacenamiento no esté disponible.
            }

            banner.hidden = true;
            banner.textContent = "";
        } else {
            let alreadyShown = false;

            try {
                alreadyShown = sessionStorage.getItem(
                    OFFLINE_BANNER_SHOWN_STORAGE_KEY
                ) === "1";
            } catch (error) {
                alreadyShown = false;
            }

            if (alreadyShown) {
                if (state.offlineBannerTimer) {
                    window.clearTimeout(state.offlineBannerTimer);
                    state.offlineBannerTimer = null;
                }

                banner.hidden = true;
                banner.textContent = "";
                return;
            }

            banner.hidden = false;
            banner.textContent =
                "Sin conexión: el borrador se guardará en este dispositivo.";

            try {
                sessionStorage.setItem(
                    OFFLINE_BANNER_SHOWN_STORAGE_KEY,
                    "1"
                );
            } catch (error) {
                // Si no existe sessionStorage, se conserva el comportamiento anterior.
            }

            if (state.offlineBannerTimer) {
                window.clearTimeout(state.offlineBannerTimer);
            }

            state.offlineBannerTimer = window.setTimeout(() => {
                banner.hidden = true;
                state.offlineBannerTimer = null;
            }, OFFLINE_BANNER_DURATION_MS);
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
                return state.user;
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
            const restrictedAction = restrictedActions.has(String(action || ""));

            if (restrictedAction) {
                let authenticatedUser = state.user;

                /*
                    Las páginas de listados pueden iniciar su consulta en
                    DOMContentLoaded antes de que termine getCurrentUser().
                    Esperamos la autenticación para no confundir por unos
                    milisegundos a un administrador con un trabajador.
                */
                if (
                    window.ASADA_AUTH_READY &&
                    typeof window.ASADA_AUTH_READY.then === "function"
                ) {
                    authenticatedUser = await window.ASADA_AUTH_READY;
                }

                if (!isAdminUser(authenticatedUser)) {
                    throw new Error(
                        "Los trabajadores no tienen permiso para consultar listados, detalles, reportes ni Excel."
                    );
                }
            }

            try {
                const requestValues = {
                    ...(values || {}),
                    sessionToken: getSessionToken()
                };
                const result = await state.originalCallApi(action, requestValues);

                if (
                    ["saveRecord", "saveAccident", "saveFactibilidad", "saveCloro", "saveAforo"].includes(action) &&
                    state.pendingSubmission
                ) {
                    const pending = state.pendingSubmission;
                    state.pendingSubmission = null;

                    window.setTimeout(() => {
                        showPostSavePreview(
                            pending.kind,
                            getResponseData(result).record ||
                            getResponseData(result).accident ||
                            getResponseData(result).factibilidad ||
                            getResponseData(result).cloro ||
                            getResponseData(result).aforo ||
                            null,
                            pending.snapshot
                        );
                    }, 0);
                }

                return result;
            } catch (error) {
                if (["saveRecord", "saveAccident", "saveFactibilidad", "saveCloro", "saveAforo"].includes(action)) {
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
                const canView = isAdminUser(state.user);

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

                if (isAdminUser(state.user)) {
                    return;
                }

                event.preventDefault();
                event.stopImmediatePropagation();

                if (state.user) {
                    redirectWorkerToMenu(
                        "Esta sección es solo para administradores. Volviendo al menú principal..."
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
            !isAdminUser(state.user) &&
            (
                restrictedPages.includes(page) ||
                queryId
            )
        ) {
            redirectWorkerToMenu(
                "Esta sección es solo para administradores. Volviendo al menú principal..."
            );
            return false;
        }

        return true;
    }

    function getControlKey(control) {
        return String(control.name || control.id || "").trim();
    }

    function capitalizePreviewText(value, fallback) {
        const text = String(value || "")
            .replace(/\s+/g, " ")
            .trim();

        if (!text) {
            return fallback || "Campo";
        }

        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    function normalizePreviewLabel(value) {
        const text = String(value || "")
            .replace(/\s+/g, " ")
            .trim();
        const normalized = text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        const aliases = {
            responsable: "Responsable",
            "responsable de la inspeccion": "Responsable",
            motivo: "Motivo",
            usuario: "Usuario",
            seleccion: "Selección",
            "tipo de registro": "Tipo de registro",
            identificador: "Identificador"
        };

        return aliases[normalized] || capitalizePreviewText(text, "Campo");
    }

    function getChoicePreviewLabel(item) {
        const group = String(item.dataset.group || "").trim();
        const value = String(item.dataset.value || item.textContent || "")
            .replace(/\s+/g, " ")
            .trim();
        const normalizedValue = value
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        if (
            item.classList.contains("condition") ||
            ["limpio", "regular", "sucio"].includes(normalizedValue)
        ) {
            return "Condición del vehículo";
        }

        if (
            item.classList.contains("multi-choice") ||
            [
                "agua",
                "aceite",
                "llantas",
                "equipo de seguridad vigente",
                "espejos y escobillas",
                "cinturon en buen estado",
                "rtv y marchamo"
            ].includes(normalizedValue)
        ) {
            return "Puntos revisados";
        }

        return normalizePreviewLabel(group || "Selección");
    }

    function getControlLabel(control) {
        const label = control.closest("label");

        if (label) {
            const clone = label.cloneNode(true);
            clone.querySelectorAll("input, select, textarea, button").forEach(item => item.remove());
            const text = clone.textContent.replace(/\s+/g, " ").trim();

            if (text) {
                return normalizePreviewLabel(text);
            }
        }

        return normalizePreviewLabel(getControlKey(control) || "Campo");
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
                    label: getChoicePreviewLabel(item),
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
            const label = choice.label || normalizePreviewLabel(choice.group || "Selección");
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
        const parent = form && form.parentElement;

        if (!parent) {
            return null;
        }

        const existing = parent.querySelector(":scope > [data-asada-draft-note]");

        if (existing) {
            return existing;
        }

        const note = document.createElement("p");
        note.className = "note asada-draft-note";
        note.dataset.asadaDraftNote = "true";
        note.textContent = "Los cambios se guardan como borrador y se sincronizan con su correo autorizado.";
        parent.insertBefore(note, form);
        return note;
    }

    function setDraftNoteState(form, message, type) {
        const note = showDraftNote(form);

        if (!note) {
            return;
        }

        note.classList.remove("is-local", "is-syncing", "is-error", "is-success");

        if (type === "is-error") {
            note.textContent = message;
            note.classList.add(type);
        } else {
            note.textContent = "Los cambios se guardan como borrador y se sincronizan con su correo autorizado.";
        }
    }

    function ensureOfflineDraftModal() {
        let modal = document.getElementById("asadaOfflineDraftModal");

        if (modal) {
            return modal;
        }

        modal = document.createElement("div");
        modal.id = "asadaOfflineDraftModal";
        modal.className = "asada-offline-draft-modal hidden";
        modal.innerHTML = `
            <div class="asada-offline-draft-dialog" role="dialog" aria-modal="true" aria-labelledby="asadaOfflineDraftTitle">
                <div class="asada-offline-draft-icon" aria-hidden="true">✓</div>
                <span class="asada-access-label">BORRADOR GUARDADO</span>
                <h2 id="asadaOfflineDraftTitle">Se guardará cuando vuelva Internet</h2>
                <p data-asada-offline-draft-message>
                    El formulario quedó guardado en este dispositivo como borrador. Podrá continuar y enviarlo cuando tenga conexión.
                </p>
                <button type="button" class="btn primary" data-asada-offline-draft-close>Aceptar</button>
            </div>
        `;

        document.body.append(modal);
        modal.querySelector("[data-asada-offline-draft-close]")
            ?.addEventListener("click", hideOfflineDraftModal);
        modal.addEventListener("click", event => {
            if (event.target === modal) {
                hideOfflineDraftModal();
            }
        });

        return modal;
    }

    function hideOfflineDraftModal() {
        const modal = document.getElementById("asadaOfflineDraftModal");

        if (!modal) {
            return;
        }

        if (modal._asadaTimer) {
            window.clearTimeout(modal._asadaTimer);
            modal._asadaTimer = null;
        }

        modal.classList.add("hidden");
        document.body.classList.remove("modal-open");
    }

    function showOfflineDraftConfirmation(kind) {
        const modal = ensureOfflineDraftModal();
        const label = getRecordTypeLabel(kind);
        const message = modal.querySelector("[data-asada-offline-draft-message]");

        if (message) {
            message.textContent =
                "Su " + label.toLowerCase() + " quedó guardado como borrador en este dispositivo. " +
                "Cuando vuelva Internet podrá continuar y enviarlo.";
        }

        modal.classList.remove("hidden");
        document.body.classList.add("modal-open");
        modal.querySelector("[data-asada-offline-draft-close]")?.focus();
        modal._asadaTimer = window.setTimeout(hideOfflineDraftModal, 4500);
    }

    window.showOfflineDraftConfirmation = showOfflineDraftConfirmation;

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
            operador: getDraftProfileLabel()
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

        // Aplicar primero la copia local para que el formulario aparezca
        // rápido. La consulta del servidor queda como reconciliación posterior.
        if (localDraft && localDraft.datos) {
            applyDraftValues(form, localDraft);
            showDraftNote(form);
        }

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

        if (draft !== localDraft) {
            applyDraftValues(form, draft);
            showDraftNote(form);
        }

        if (draft === localDraft && draftTimestamp(localDraft) > draftTimestamp(serverDraft)) {
            syncDraftToServer(form, localDraft);
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
        showDraftNote(form);

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
        document.querySelectorAll("#maintenanceForm, #accidentForm, #factibilidadForm, #cloroForm, #aforoForm")
            .forEach(installDraftForForm);
    }

    function getRecordTypeLabel(kind) {
        const labels = {
            mantenimiento: "Revisión de vehículo",
            accidente: "Daño o accidente",
            factibilidad: "Inspección de factibilidad de agua",
            cloro: "Control de cloro residual",
            aforo: "Registro de aforo"
        };

        return labels[kind] || "registro";
    }

    function getListPageForKind(kind) {
        const pages = {
            mantenimiento: "registros.html",
            accidente: "accidentes.html",
            factibilidad: "factibilidades.html",
            cloro: "cloros.html",
            aforo: "aforos.html"
        };

        return pages[kind] || "index.html";
    }

    function getDraftPageForKind(kind) {
        const pages = {
            mantenimiento: "mantenimiento.html",
            accidente: "crear-accidente.html",
            factibilidad: "crear-factibilidad.html",
            cloro: "crear-cloro.html",
            aforo: "crear-aforo.html"
        };

        return pages[kind] || "index.html";
    }

    function formatDraftDate(value) {
        const date = new Date(value || 0);

        if (!Number.isFinite(date.getTime())) {
            return "Fecha no disponible";
        }

        return new Intl.DateTimeFormat("es-CR", {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(date);
    }

    function getDraftSummary(draft, kind) {
        const values = draft?.datos?.values || {};
        const candidates = {
            mantenimiento: ["vehiculo", "usuario", "condicion"],
            accidente: ["vehicle", "accidentVehicle", "chofer", "responsable"],
            factibilidad: ["nombreSolicitante", "direccion", "ruta"],
            cloro: ["zona", "fechaMuestreo"],
            aforo: ["zona", "fecha"]
        }[kind] || [];

        const summary = candidates
            .map(key => String(values[key] || "").trim())
            .filter(Boolean);

        return summary.length
            ? summary.slice(0, 2).join(" · ")
            : "Formulario parcialmente completado";
    }

    async function initializeDraftsPage() {
        const root = document.getElementById("asadaDraftsPage");

        if (!root || !state.user) {
            return;
        }

        const profileLabel = getDraftProfileLabel();

        root.innerHTML = `
            <section class="asada-drafts-hero">
                <span class="asada-access-label">PERFIL: ${escapeHtml(profileLabel.toUpperCase())}</span>
                <h1>Borradores guardados</h1>
                <p>Continúe un formulario pendiente y envíelo cuando esté completo y tenga conexión.</p>
            </section>
            <div class="asada-drafts-list" data-asada-drafts-list>
                <p class="note">Cargando borradores...</p>
            </div>
        `;

        const list = root.querySelector("[data-asada-drafts-list]");
        const localEntries = await Promise.all(draftTypes.map(async kind => ({
            kind,
            draft: await getLocalDraft(kind)
        })));

        const renderEntries = (entries, final) => {
            const available = entries.filter(
                entry => entry.draft && entry.draft.datos
            );

            if (!available.length) {
                list.innerHTML = final
                    ? `
                        <section class="asada-drafts-empty">
                            <div class="asada-drafts-empty-icon" aria-hidden="true">✓</div>
                            <h2>No hay borradores pendientes</h2>
                            <p>Cuando empiece un formulario sin enviarlo, aparecerá aquí para continuar después.</p>
                        </section>
                    `
                    : `<p class="note">Buscando borradores guardados...</p>`;
                return;
            }

            list.innerHTML = available.map(({ kind, draft }) => `
                <article class="asada-draft-card">
                    <div class="asada-draft-card-heading">
                        <div>
                            ${isAdminUser(state.user)
                                ? `
                                    <label class="asada-bulk-selector" title="Seleccionar para eliminación múltiple">
                                        <input type="checkbox"
                                            data-asada-bulk-selector
                                            data-asada-bulk-id="${escapeHtml(kind.toUpperCase())}"
                                            data-asada-bulk-type="borrador"
                                            data-asada-bulk-label="Borrador de ${escapeHtml(getRecordTypeLabel(kind))}"
                                            data-asada-bulk-draft-type="${escapeHtml(kind)}"
                                            data-asada-bulk-client-id="${escapeHtml(getDraftClientId())}">
                                        <span>Seleccionar</span>
                                    </label>
                                `
                                : ""}
                            <span class="asada-access-label">${escapeHtml(getRecordTypeLabel(kind))}</span>
                            <h2>${escapeHtml(getDraftSummary(draft, kind))}</h2>
                        </div>
                        <span class="asada-draft-status">Pendiente</span>
                    </div>
                    <p class="asada-draft-date">Último cambio: ${escapeHtml(formatDraftDate(draft.fechaActualizacion))}</p>
                    <div class="asada-draft-card-actions">
                        <a class="btn primary" href="${getDraftPageForKind(kind)}?draft=1">Continuar borrador</a>
                    </div>
                </article>
            `).join("");
        };

        renderEntries(localEntries, false);

        if (!navigator.onLine) {
            renderEntries(localEntries, true);
            return;
        }

        const serverEntries = await Promise.all(draftTypes.map(async kind => {
            let draft = null;

            try {
                const response = await window.callApi("getDraft", {
                    tipo: kind,
                    clienteId: getDraftClientId()
                });
                draft = response && response.draft;
            } catch (error) {
                draft = null;
            }

            return { kind, draft };
        }));

        const mergedEntries = localEntries.map(localEntry => {
            const remoteEntry = serverEntries.find(
                entry => entry.kind === localEntry.kind
            );
            const localDraft = localEntry.draft;
            const serverDraft = remoteEntry?.draft || null;
            const chosen = draftTimestamp(serverDraft) > draftTimestamp(localDraft)
                ? serverDraft
                : localDraft || serverDraft;

            if (
                serverDraft &&
                draftTimestamp(serverDraft) > draftTimestamp(localDraft)
            ) {
                saveLocalDraft({
                    ...serverDraft,
                    tipo: localEntry.kind,
                    correo: state.user.email,
                    operador: getDraftProfileLabel()
                });
            }

            return {
                kind: localEntry.kind,
                draft: chosen
            };
        });

        renderEntries(mergedEntries, true);
    }

    window.ASADA_INIT_DRAFTS_PAGE = initializeDraftsPage;

    function getKindForDeleteAction(action) {
        const kinds = {
            deleteRecord: "mantenimiento",
            deleteAccident: "accidente",
            deleteFactibilidad: "factibilidad",
            deleteCloro: "cloro",
            deleteAforo: "aforo"
        };

        return kinds[action] || "";
    }

    function getDeleteTypeLabel(action) {
        const labels = {
            deleteRecord: "Revisión de vehículo",
            deleteAccident: "Daño o accidente",
            deleteFactibilidad: "Inspección de factibilidad de agua",
            deleteCloro: "Control de cloro residual",
            deleteAforo: "Registro de aforo"
        };

        return labels[action] || "Registro";
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
        const bulkItems = Array.isArray(snapshot.bulkItems)
            ? snapshot.bulkItems
            : [];

        confirmButton.classList.remove("asada-danger-button");
        newButton.hidden = true;
        modal.dataset.asadaPreviewKind = kind;
        modal.dataset.asadaModalMode = mode;
        modal.dataset.asadaAfterClose = "";
        modal.dataset.asadaNewTarget = "";

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
        } else if (mode === "bulk-delete") {
            title.textContent = "Eliminar registros seleccionados";
            message.textContent = "Estos registros se eliminarán permanentemente y dejarán de aparecer en la base de datos y en los listados.";
            confirmButton.hidden = false;
            confirmButton.textContent = "Eliminar seleccionados";
            confirmButton.classList.add("asada-danger-button");
            closeButton.textContent = "Cancelar";
        } else if (mode === "delete") {
            title.textContent = "Eliminar " + recordType;
            message.textContent = "¿Está segura de eliminar este " + recordType + " con ID " + recordId + "? Esta acción no se puede deshacer.";
            confirmButton.hidden = false;
            confirmButton.textContent = "Eliminar definitivamente";
            confirmButton.classList.add("asada-danger-button");
            closeButton.textContent = "Cancelar";
        } else if (mode === "deleted") {
            title.textContent = "Registro de " + recordType + " eliminado correctamente";
            message.textContent = recordId
                ? "El registro con ID " + recordId + " se eliminó correctamente y ya no aparece en el listado."
                : "El registro se eliminó correctamente y ya no aparece en el listado.";
            confirmButton.hidden = true;
            closeButton.textContent = "Volver al listado";
            modal.dataset.asadaAfterClose = "list";
        } else if (mode === "bulk-deleted") {
            title.textContent = "Registros eliminados correctamente";
            message.textContent = "Los registros seleccionados se eliminaron correctamente y ya no aparecen en la base de datos ni en los listados.";
            confirmButton.hidden = true;
            closeButton.textContent = "Volver al listado";
            modal.dataset.asadaAfterClose = "reload";
        } else if (mode === "error") {
            title.textContent = "No fue posible completar la acción";
            message.textContent = "Revise el mensaje siguiente y vuelva a intentarlo si es necesario.";
            confirmButton.hidden = true;
            closeButton.textContent = "Cerrar";
        } else {
            title.textContent = snapshot.editing
                ? "Registro de " + recordType + " actualizado correctamente"
                : "Registro de " + recordType + " creado correctamente";
            message.textContent = snapshot.editing
                ? "El registro se actualizó correctamente."
                : "Se ha creado el registro correctamente.";
            confirmButton.hidden = true;
            closeButton.textContent = "Cerrar";
            newButton.hidden = false;
            newButton.textContent = snapshot.editing
                ? "Actualizar otro registro"
                : "Crear otro registro";
            modal.dataset.asadaNewTarget = snapshot.editing
                ? getListPageForKind(kind)
                : ({
                mantenimiento: "mantenimiento.html",
                accidente: "crear-accidente.html",
                factibilidad: "crear-factibilidad.html",
                cloro: "crear-cloro.html",
                aforo: "crear-aforo.html"
                }[kind] || "index.html");
            modal.dataset.asadaAfterClose = "menu";
        }

        const rows = snapshot.rows.slice();

        if (recordId && !rows.some(row =>
            String(row.label || "").trim().toLowerCase() === "identificador"
        )) {
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
        const configuredTarget = modal?.dataset.asadaNewTarget || "";
        const pages = {
            mantenimiento: "mantenimiento.html",
            accidente: "crear-accidente.html",
            factibilidad: "crear-factibilidad.html",
            cloro: "crear-cloro.html",
            aforo: "crear-aforo.html"
        };
        const page = configuredTarget || pages[kind];

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
        const modalMode = modal?.dataset.asadaModalMode || "";

        if (modalMode === "delete" || modalMode === "bulk-delete") {
            state.pendingDeletion = null;
            state.pendingBulkDeletion = null;
        }

        if (modal) {
            modal.classList.add("hidden");
            modal.dataset.asadaAfterClose = "";
        }

        document.body.classList.remove("modal-open");

        if (afterClose === "list") {
            window.location.href = getListPageForKind(kind);
        } else if (afterClose === "menu") {
            window.location.href = "index.html";
        } else if (afterClose === "reload") {
            window.location.reload();
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
        if (state.pendingBulkDeletion) {
            const items = state.pendingBulkDeletion;
            state.pendingBulkDeletion = null;
            hideModal();
            performBulkDeleteFromServer(items);
            return;
        }

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

        if (!isAdminUser(state.user) && formHasSubmittedId(form)) {
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

    function bulkTypeForAction(action) {
        return {
            deleteRecord: "revision",
            deleteAccident: "accidente",
            deleteFactibilidad: "factibilidad",
            deleteCloro: "cloro",
            deleteAforo: "aforo"
        }[action] || "";
    }

    function addBulkSelector(card, action, label, id) {
        if (!card || !id || card.querySelector("[data-asada-bulk-selector]")) {
            return;
        }

        const type = bulkTypeForAction(action);
        if (!type) {
            return;
        }

        const wrapper = document.createElement("label");
        wrapper.className = "asada-bulk-selector";
        wrapper.title = "Seleccionar para eliminación múltiple";
        wrapper.innerHTML = `
            <input type="checkbox" data-asada-bulk-selector
                data-asada-bulk-id="${escapeHtml(id)}"
                data-asada-bulk-type="${escapeHtml(type)}"
                data-asada-bulk-label="${escapeHtml(label || getDeleteTypeLabel(action))}">
            <span>Seleccionar</span>
        `;

        const target = card.querySelector(
            ".record-card-top, .fact-record-card-header"
        ) || card.firstElementChild || card;
        target.insertBefore(wrapper, target.firstChild);
        wrapper.querySelector("input").addEventListener(
            "change",
            updateBulkToolbar
        );
    }

    function installBulkDeleteToolbar() {
        if (!state.user || !isAdminUser(state.user)) {
            return;
        }

        const checkboxes = Array.from(
            document.querySelectorAll("[data-asada-bulk-selector]")
        );
        const host = document.querySelector(
            ".records-list, .fact-record-list, .module-list, .asada-drafts-list"
        );

        if (!host) {
            return;
        }

        let toolbar = document.querySelector("[data-asada-bulk-toolbar]");
        if (!toolbar) {
            toolbar = document.createElement("section");
            toolbar.className = "asada-bulk-toolbar";
            toolbar.dataset.asadaBulkToolbar = "1";
            toolbar.innerHTML = `
                <div>
                    <strong>Eliminación múltiple</strong>
                    <span data-asada-bulk-count>0 seleccionados</span>
                </div>
                <button type="button" class="btn secondary asada-danger-button" data-asada-bulk-delete disabled>
                    Eliminar seleccionados
                </button>
            `;
            host.parentNode.insertBefore(toolbar, host);
            toolbar.querySelector("[data-asada-bulk-delete]").addEventListener(
                "click",
                requestBulkDeleteConfirmation
            );
        }

        toolbar.hidden = checkboxes.length === 0;
        updateBulkToolbar();
    }

    function updateBulkToolbar() {
        const toolbar = document.querySelector("[data-asada-bulk-toolbar]");
        if (!toolbar) {
            return;
        }

        const selected = document.querySelectorAll(
            "[data-asada-bulk-selector]:checked"
        );
        const button = toolbar.querySelector("[data-asada-bulk-delete]");
        const count = toolbar.querySelector("[data-asada-bulk-count]");

        if (count) {
            count.textContent = selected.length + (
                selected.length === 1
                    ? " seleccionado"
                    : " seleccionados"
            );
        }

        if (button) {
            button.disabled = selected.length === 0;
        }
    }

    function requestBulkDeleteConfirmation() {
        if (!state.user || !isAdminUser(state.user)) {
            return;
        }

        const selected = Array.from(
            document.querySelectorAll("[data-asada-bulk-selector]:checked")
        )
            .map(input => ({
                id: String(input.dataset.asadaBulkId || "")
                    .trim()
                    .toUpperCase(),
                type: String(input.dataset.asadaBulkType || "")
                    .trim()
                    .toLowerCase(),
                label: String(input.dataset.asadaBulkLabel || "Registro")
                    .trim(),
                draftType: String(input.dataset.asadaBulkDraftType || "")
                    .trim()
                    .toLowerCase(),
                clientId: String(input.dataset.asadaBulkClientId || "")
                    .trim()
            }))
            .filter(item => item.id && item.type);

        if (!selected.length) {
            alert("Seleccione al menos un registro para eliminar.");
            return;
        }

        state.pendingDeletion = null;
        state.pendingBulkDeletion = selected;
        setModalContent("bulk-delete", {
            kind: selected[0].type,
            editing: false,
            rows: selected
                .map(item => ({ label: item.label, value: item.id }))
                .concat([
                    {
                        label: "Aviso",
                        value: "La eliminación será permanente."
                    }
                ]),
            bulkItems: selected,
            mediaCount: 0
        }, null);
    }

    async function performBulkDeleteFromServer(items) {
        try {
            const result = await window.callApi(
                "deleteRecordsBatch",
                {
                    items: items.map(item => ({
                        id: item.id,
                        type: item.type,
                        draftType: item.draftType,
                        clientId: item.clientId
                    }))
                }
            );
            const deleted = Array.isArray(result && result.deleted)
                ? result.deleted
                : [];
            const failed = Array.isArray(result && result.failed)
                ? result.failed
                : [];

            deleted.forEach(item => {
                document
                    .querySelectorAll("[data-asada-bulk-selector]")
                    .forEach(input => {
                        if (
                            String(input.dataset.asadaBulkId || "")
                                .toUpperCase() ===
                            String(item.id || "").toUpperCase()
                        ) {
                            input.closest("article")?.remove();
                        }
                    });
            });

            if (failed.length) {
                setModalContent("error", {
                    kind: items[0]?.type || "",
                    rows: deleted
                        .map(item => ({
                            label: item.type,
                            value: item.id + " · Eliminado correctamente"
                        }))
                        .concat(
                            failed.map(item => ({
                                label: item.type,
                                value: item.id + " · " + item.error
                            }))
                        ),
                    mediaCount: 0
                }, null);
                return;
            }

            setModalContent("bulk-deleted", {
                kind: items[0]?.type || "",
                rows: deleted
                    .map(item => ({ label: item.type, value: item.id }))
                    .concat([
                        {
                            label: "Resultado",
                            value: "Todos fueron eliminados correctamente."
                        }
                    ]),
                bulkItems: deleted,
                mediaCount: 0
            }, null);
        } catch (error) {
            setModalContent("error", {
                kind: items[0]?.type || "",
                rows: [
                    {
                        label: "Error",
                        value: error.message ||
                            "No fue posible eliminar los registros."
                    }
                ],
                mediaCount: 0
            }, null);
        }
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
        if (!state.user || !isAdminUser(state.user)) {
            return;
        }

        document.querySelectorAll(".record-card").forEach(card => {
            const existingDelete = card.querySelector("[data-asada-delete]");
            if (existingDelete) {
                addBulkSelector(
                    card,
                    existingDelete.dataset.asadaDelete,
                    getDeleteTypeLabel(existingDelete.dataset.asadaDelete),
                    existingDelete.dataset.asadaDeleteId
                );
                return;
            }

            const hasAccidentButton = Boolean(
                card.querySelector("button[onclick*='AccidentDetail']")
            );
            const accidentId = idFromLink(card, "detalle-accidente.html") ||
                (hasAccidentButton ? idFromCardHeading(card) : "");
            const recordId = idFromLink(card, "detalle.html");

            if (accidentId) {
                addBulkSelector(
                    card,
                    "deleteAccident",
                    "Daño o accidente",
                    accidentId
                );
                addDeleteButton(card, "deleteAccident", "daño o accidente", accidentId);
            } else if (recordId) {
                addBulkSelector(
                    card,
                    "deleteRecord",
                    "Revisión de vehículo",
                    recordId
                );
                addDeleteButton(card, "deleteRecord", "revisión", recordId);
            }
        });

        document.querySelectorAll(".fact-record-card").forEach(card => {
            const id = idFromLink(card, "detalle-factibilidad.html");

            if (id) {
                addBulkSelector(
                    card,
                    "deleteFactibilidad",
                    "Inspección de factibilidad de agua",
                    id
                );
                addDeleteButton(card, "deleteFactibilidad", "inspección de factibilidad", id);
            }
        });

        document.querySelectorAll(".module-card").forEach(card => {
            const cloroId = idFromLink(card, "detalle-cloro.html");
            const aforoId = idFromLink(card, "detalle-aforo.html");

            if (cloroId) {
                addBulkSelector(
                    card,
                    "deleteCloro",
                    "Control de cloro residual",
                    cloroId
                );
                addDeleteButton(
                    card,
                    "deleteCloro",
                    "control de cloro residual",
                    cloroId
                );
            } else if (aforoId) {
                addBulkSelector(
                    card,
                    "deleteAforo",
                    "Registro de aforo",
                    aforoId
                );
                addDeleteButton(
                    card,
                    "deleteAforo",
                    "registro de aforo",
                    aforoId
                );
            }
        });

        installBulkDeleteToolbar();

        const currentId = getQueryId();

        if (currentId && restrictedPages.includes(currentPage())) {
            const action = currentPage() === "detalle-factibilidad.html"
                ? "deleteFactibilidad"
                : currentPage() === "detalle-accidente.html"
                    ? "deleteAccident"
                    : currentPage() === "detalle-cloro.html"
                        ? "deleteCloro"
                        : currentPage() === "detalle-aforo.html"
                            ? "deleteAforo"
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
        const label = getDeleteTypeLabel(action);
        const kind = getKindForDeleteAction(action);

        if (!action || !id || !state.user || !isAdminUser(state.user)) {
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
                { label: "Aviso", value: "La eliminación será permanente para el listado." }
            ],
            mediaCount: 0
        }, null);
    }

    async function performDeleteFromServer(button) {
        const action = button.dataset.asadaDelete;
        const id = button.dataset.asadaDeleteId;

        if (!action || !id || !state.user || !isAdminUser(state.user)) {
            return;
        }

        button.disabled = true;
        button.textContent = "Eliminando...";

        try {
            await window.callApi(action, { id });
            const card = button.closest("article, .detail-card, .detail-section");
            const kind = getKindForDeleteAction(action);
            const label = getDeleteTypeLabel(action);

            if (card && card.tagName.toLowerCase() === "article") {
                card.remove();
            }

            setModalContent("deleted", {
                kind,
                editing: false,
                recordId: id,
                rows: [
                    { label: "Tipo de registro", value: label }
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

        // La cuenta compartida debe elegir el fontanero una sola vez después
        // de verificar el código. El perfil se conserva mientras la sesión
        // continúe y se puede cambiar desde el menú lateral.
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

        state.observer = new MutationObserver(mutations => {
            if (
                state.observerRefreshQueued ||
                !mutations.some(mutation => mutation.type === "childList" && mutation.addedNodes.length)
            ) {
                return;
            }

            state.observerRefreshQueued = true;
            state.observer.disconnect();
            window.requestAnimationFrame(() => {
                hideRestrictedMenuLinks();
                installForms();
                installDeleteButtons();
                state.observerRefreshQueued = false;
                state.observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            });
        });

        state.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        if (currentPage() === "borradores.html") {
            initializeDraftsPage();
        }

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

        renderCachedSessionImmediately();

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
            finishAuthReady(state.user);
            initializeAuthenticatedUi();
            return;
        }

        try {
            await getCurrentUser();
        } catch (error) {
            clearSessionToken();
            setUserState(null);
            renderSessionControl();
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
            setUserState(null);
            renderSessionControl();
            hideRestrictedMenuLinks();
            showEmailLogin("La sesión venció. Solicite un nuevo código para continuar.");
        }
    });

    // Se instala antes de DOMContentLoaded para ocultar enlaces desde el
    // primer momento y bloquear navegación directa de trabajadores.
    installApiGuard();
    installRestrictedNavigationGuard();
    hideRestrictedMenuLinks();
    renderCachedSessionImmediately();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
