/*
 * Reemplazo completo para el archivo js/cloro_aforo.js.
 * Corrige únicamente el envío de aforos; conserva intacto el guardado de cloro.
 * No requiere cambiar crear-aforo.html, crear-cloro.html ni sus campos.
 */

/*
 * Reemplazo completo para el archivo js/cloro_aforo.js.
 * No requiere cambiar crear-cloro.html ni sus campos.
 * Este archivo conserva los módulos existentes y corrige el envío de cloro:
 * nunca deja que el navegador recargue y borre el formulario sin guardar.
 */

/* =========================================================
   ASADA OROSI - CLORO Y AFOROS
   Formularios, listados, detalles y descarga PDF.
   ========================================================= */

(function () {
    "use strict";

    // Membrete de aforos extraído del Word de referencia, sin depender de otro archivo.
    const AFORO_LETTERHEAD_DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCABpAq8DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKACiiigAooqK4LiFzGA0m07QTgE9qTdlcCh4k8Q2fhXRLzVtQkMdnaxmSRlGTj0A7knArhfDPxrsviFoWvSeGbO4k1jT7dpY7K8UKZDg7cEEggkY61V+HE/jjxZLr+n+PtGt00mRdkaNGoD5JBUYPzLjua7Lwd8OfD/gJLhdD05LM3BBlfcWZsdASecD0rwo1cXjJwq0HyUmmpKSanfVJr80c6c5tOOkfPc8l+BnxJ8feK/GF1Za9as+mrGzSyva+T5Dj7oB75PGPxrO8N/FP4lX3xYTSbvTWSyN0Y5rP7NhYosn5t/sOc55/Gvoe/vrfTLOa6u5ktraFS8ksrYVFHUk9hU0bLKiupDKwBBHQisI5TiY0qcHipvlk23p7391+X+foZqlKyj7R3Wp5tq37QPhfRvGv/CNTm6Nyswge5SMGFJDj5Sc57gE44r0sHIrkr/4UeFdS8UJ4hudIhl1VWD+cc4LDoxXOCRgc1zml618RZPizc2V3pkKeEAX2XAUYCbflYNnJYnAI9zXTCvisNNrF+8pStHki9F/e/zNFKcH7+t3pb9T1Kikpa9w6AooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKQ9KWkNAHG+Ffilo3ifxBq+hrOttqunXMlubeRsGVVON6ev07Vo+I9L12/wBV0ebSdYTTrOCbfewPAHNxH/dBPT/69fD/AMQZprP4keIpYpHhnj1KdldGIZT5h5BFd54K/ae8T+GxHb6qE16yXAzMds6j/fHX8R+NfmeH4roynPDY9ONpP3o+Tdr21W2tt+x5McbG7hU013PsQAUua8w8F/tE+EfF7RwNdNpF62B5F9hAT6B/un9K1/i98TrL4W+CrrWZysty37qztyf9dMR8o+g6k+gr9FwNalmTisHJTvpo/wCrfM7KmKo0qUq85LlirtnjP7ZHxXSw0iPwTp8wN3eAS6gVP+rh6qh92POPQe9dV+yn8Vx438GLoeoTE63oyLGd5+aaDoj+5H3T9Ae9fEWu63e+JNYvNU1Gdrm+u5TLLK38TH+naum+Hvi/UPBet2fiPSmzfaaf38OeLiA8Mp/Dj8j2r9brZDTWWrDR+Na3/vf5Pb7j8Yw/E1WWcPGS/hv3eX+7/mvi+9H6V5zVPV7e7utLu4bG4FneSRMsNwyBxG5HDYPXB7Vn+CvFun+OvDNhrmly+baXce9c9UP8Sn0IOQfpWzLMkMbSSMqIoyzMcAD1Jr8rqU3FypzVnqmftkJwqwU4u6avfyM7wxaalp+hWdvrF8upalGmJ7pIxGJG9QB0rUr44/ai/bk0nwvp934b+H96mq66Tsn1W3bNvagH5gjD77nGMjgZ6npX1f4O1xfE3hPRtXRgy31nDcZXp8yAn+dYUpQ/hwd7fP8AE48P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";

    const CLORO_SITES = {
        "Orosi": [
            "Escuela Jucó- Jalisco", "Murray", "Orokay", "Bodega Murray",
            "Koreanos", "Chía  Coto", "Cementerio", "Apart. Banco", "Ñajo"
        ],
        "Alto de Araya": [
            "Casa Martín Gómez", "Tanque Azul", "Tanque Lelo", "Pulpería Alto de Araya"
        ]
    };

    const AFORO_SITES = {
        "Orosi": [
            "Conejera #1", "Conejera #2", "Abraham", "Truchas", "Ceci Murray",
            "Alto Loaiza(Ismael Arroyo)", "Alto Loaiza(Rosquilla)", "La Laja #1", "La Laja #2"
        ],
        "Alto de Araya": ["F6 La Roca", "F5", "Evelio Araya", "La joya"]
    };

    const DEFAULT_MAP_POSITION = [9.7965, -83.8538];
    let leafletLoadPromise = null;

    const OPERATOR_LABELS = {
        fontanero_1: "Rodolfo",
        fontanero_2: "Guillermo",
        fontanero_3: "Paul",
        fontanero_4: "Roberto"
    };

    function escapeHtml(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/[&<>"']/g, character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            }[character]));
    }

    function clean(value) {
        return String(value === null || value === undefined ? "" : value).trim();
    }

    function currentProfile() {
        const user = window.ASADA_USER || {};
        if (clean(user.email).toLowerCase() === "asadaorosi4@gmail.com") {
            return OPERATOR_LABELS[localStorage.getItem("ASADA_SHARED_OPERATOR")] || "Perfil pendiente";
        }
        return clean(user.name) || "Usuario";
    }

    function api(action, values) {
        if (typeof window.callApi !== "function") {
            return Promise.reject(new Error("No se encontró la conexión con el sistema."));
        }
        return window.callApi(action, values || {});
    }

    function responseData(response) {
        return response && response.data ? response.data : (response || {});
    }

    function waitForAuth() {
        return window.ASADA_AUTH_READY && typeof window.ASADA_AUTH_READY.then === "function"
            ? window.ASADA_AUTH_READY
            : Promise.resolve(window.ASADA_USER || null);
    }

    function formatDate(value) {
        const date = new Date(value || 0);
        return Number.isFinite(date.getTime())
            ? new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short" }).format(date)
            : "Sin fecha";
    }

    function dateInputValue(value) {
        const date = value ? new Date(value) : new Date();
        if (!Number.isFinite(date.getTime())) {
            return "";
        }
        const pad = number => String(number).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function currentUserName() {
        const user = window.ASADA_USER || {};
        return clean(user.name) || currentProfile();
    }

    function setAutomaticFields(form) {
        if (!form) {
            return;
        }

        const dateField = form.querySelector("[name=fechaMuestreo], [name=fecha]");
        if (dateField && !queryId()) {
            dateField.value = dateInputValue();
            dateField.readOnly = true;
        }

    }

    function setMessage(root, text, type) {
        if (!root) {
            return;
        }
        root.textContent = text || "";
        const baseClass = root.hasAttribute("data-sample-gps-status") || root.hasAttribute("data-sample-gps-status-index") || root.hasAttribute("data-aforo-gps-status-index")
            ? "sample-coordinate-status"
            : root.hasAttribute("data-aforo-gps-status")
                ? "module-status coordinate-capture-status"
                : root.hasAttribute("data-gps-status")
                    ? "module-status gps-status-box"
                    : "module-status";
        root.className = baseClass + (type ? " is-" + type : "");
    }

    function leaflet() {
        return window.ASADA_LEAFLET || window.L || null;
    }

    function waitForLeaflet() {
        const available = leaflet();
        if (available) {
            return Promise.resolve(available);
        }

        if (leafletLoadPromise) {
            return leafletLoadPromise;
        }

        leafletLoadPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector("script[data-asada-leaflet-loader]");
            const script = existing || document.createElement("script");

            const finish = () => {
                const loaded = leaflet();
                if (loaded) {
                    resolve(loaded);
                } else {
                    reject(new Error("Leaflet no está disponible."));
                }
            };

            script.addEventListener("load", finish, { once: true });
            script.addEventListener("error", () => reject(new Error("No se pudo cargar el mapa.")), { once: true });

            if (!existing) {
                script.dataset.asadaLeafletLoader = "true";
                script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
                document.head.appendChild(script);
            }

            window.setTimeout(() => {
                if (leaflet()) {
                    resolve(leaflet());
                }
            }, 1200);
        }).catch(error => {
            leafletLoadPromise = null;
            throw error;
        });

        return leafletLoadPromise;
    }

    function createModuleMarkerIcon() {
        const Leaflet = leaflet();
        if (!Leaflet) {
            return null;
        }

        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="62" viewBox="0 0 48 62">
                <path d="M24 2 C12.4 2 3 11.4 3 23 c0 16.5 21 36 21 36 s21-19.5 21-36 C45 11.4 35.6 2 24 2z"
                    fill="#20cdb0" stroke="#ffffff" stroke-width="3"/>
                <circle cx="24" cy="23" r="8" fill="#123d36" stroke="#ffffff" stroke-width="2"/>
            </svg>`;

        return Leaflet.icon({
            iconUrl: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
            iconSize: [48, 62],
            iconAnchor: [24, 59],
            popupAnchor: [0, -52]
        });
    }

    function queryId() {
        return clean(new URLSearchParams(window.location.search).get("id"));
    }

    function valueFromForm(form, selector) {
        return clean(form.querySelector(selector)?.value);
    }

    function formatSampleCoordinates(sample) {
        const values = [];
        const longitude = clean(sample?.longitud);
        const latitude = clean(sample?.latitud);
        const altitude = clean(sample?.altitud);
        const accuracy = clean(sample?.precisionGps);

        if (longitude) values.push(`X/Longitud: ${longitude}`);
        if (latitude) values.push(`Y/Latitud: ${latitude}`);
        if (altitude) values.push(`Altitud: ${altitude} m`);
        if (accuracy) values.push(`Precisión: ${accuracy} m`);

        return values.length ? values.join(" · ") : "Sin coordenadas";
    }

    function sampleHasCoordinates(sample) {
        const latitudeText = clean(sample?.latitud);
        const longitudeText = clean(sample?.longitud);
        const latitude = Number(latitudeText);
        const longitude = Number(longitudeText);
        return latitudeText !== "" && longitudeText !== "" && Number.isFinite(latitude) && Number.isFinite(longitude);
    }

    function updateSampleCoordinateLabel(form, index, sample) {
        const label = form.querySelector(`[data-sample-coordinates-index="${index}"]`);
        if (label) {
            label.textContent = formatSampleCoordinates(sample);
        }
    }

    function setSampleCoordinates(form, index, coordinates) {
        const numericText = (value, decimals) => {
            const text = clean(value);
            const number = text === "" ? NaN : Number(text);
            return Number.isFinite(number) ? number.toFixed(decimals) : "";
        };
        const values = {
            latitud: numericText(coordinates?.latitud, 7),
            longitud: numericText(coordinates?.longitud, 7),
            altitud: numericText(coordinates?.altitud, 2),
            precisionGps: numericText(coordinates?.precisionGps, 2)
        };

        Object.entries(values).forEach(([key, value]) => {
            const input = form.querySelector(`[name="${key}_${index}"]`);
            if (input) input.value = value;
        });

        updateSampleCoordinateLabel(form, index, values);
        syncCloroHidden(form);
    }

    function updateAforoCoordinateLabel(form, index, row) {
        const label = form.querySelector(`[data-aforo-coordinates-index="${index}"]`);
        if (label) {
            label.textContent = formatSampleCoordinates(row);
        }
    }

    function setAforoCoordinates(form, index, coordinates) {
        const numericText = (value, decimals) => {
            const text = clean(value);
            const number = text === "" ? NaN : Number(text);
            return Number.isFinite(number) ? number.toFixed(decimals) : "";
        };
        const values = {
            latitud: numericText(coordinates?.latitud, 7),
            longitud: numericText(coordinates?.longitud, 7),
            altitud: numericText(coordinates?.altitud, 2),
            precisionGps: numericText(coordinates?.precisionGps, 2)
        };

        [["latitud", "latitudAforo"], ["longitud", "longitudAforo"], ["altitud", "altitudAforo"], ["precisionGps", "precisionGpsAforo"]].forEach(([key, name]) => {
            const input = form.querySelector(`[name="${name}_${index}"]`);
            if (input) input.value = values[key];
        });
        updateAforoCoordinateLabel(form, index, values);
        syncAforoHidden(form);
    }

    function buildCloroRows(form) {
        const zone = valueFromForm(form, "[name=zona]");
        const sites = CLORO_SITES[zone] || [];
        const tbody = form.querySelector("[data-cloro-rows]");
        if (!tbody) {
            return;
        }

        tbody.innerHTML = sites.map((site, index) => `
            <tr>
                <th scope="row">${escapeHtml(site)}</th>
                <td><input name="turbiedad_${index}" inputmode="decimal" aria-label="Turbiedad de ${escapeHtml(site)}"></td>
                <td><input name="cloro_${index}" inputmode="decimal" aria-label="Cloro de ${escapeHtml(site)}"></td>
                <td><input name="ph_${index}" inputmode="decimal" aria-label="PH de ${escapeHtml(site)}"></td>
                <td><input name="olor_${index}" aria-label="Olor de ${escapeHtml(site)}"></td>
                <td><input name="temperatura_${index}" inputmode="decimal" aria-label="Temperatura de ${escapeHtml(site)}"></td>
                <td><input name="hora_${index}" type="time" aria-label="Hora de ${escapeHtml(site)}"></td>
                <td class="sample-coordinate-cell">
                    <input type="hidden" name="latitud_${index}">
                    <input type="hidden" name="longitud_${index}">
                    <input type="hidden" name="altitud_${index}">
                    <input type="hidden" name="precisionGps_${index}">
                    <div class="sample-coordinate-actions">
                        <button type="button" class="btn secondary sample-coordinate-button" data-sample-gps-index="${index}">Mi ubicación</button>
                    </div>
                    <span class="sample-coordinate-summary" data-sample-coordinates-index="${index}">Sin coordenadas</span>
                    <span class="sample-coordinate-status" data-sample-gps-status data-sample-gps-status-index="${index}" aria-live="polite"></span>
                </td>
            </tr>
        `).join("");

        const hidden = form.querySelector("[name=muestrasJson]");
        const saved = hidden ? parseJson(hidden.value, []) : [];
        sites.forEach((site, index) => {
            const row = saved.find(savedRow => clean(savedRow?.lugar) === clean(site));
            if (!row) {
                return;
            }
            ["turbiedad", "cloro", "ph", "olor", "temperatura", "hora", "latitud", "longitud", "altitud", "precisionGps"].forEach(key => {
                const input = form.querySelector(`[name="${key}_${index}"]`);
                if (input) {
                    input.value = clean(row[key]);
                }
            });
            updateSampleCoordinateLabel(form, index, row);
        });
        syncCloroHidden(form);
    }

    function syncCloroHidden(form) {
        const zone = valueFromForm(form, "[name=zona]");
        const sites = CLORO_SITES[zone] || [];
        const rows = sites.map((lugar, index) => ({
            lugar,
            turbiedad: valueFromForm(form, `[name="turbiedad_${index}"]`),
            cloro: valueFromForm(form, `[name="cloro_${index}"]`),
            ph: valueFromForm(form, `[name="ph_${index}"]`),
            olor: valueFromForm(form, `[name="olor_${index}"]`),
            temperatura: valueFromForm(form, `[name="temperatura_${index}"]`),
            hora: valueFromForm(form, `[name="hora_${index}"]`),
            latitud: valueFromForm(form, `[name="latitud_${index}"]`),
            longitud: valueFromForm(form, `[name="longitud_${index}"]`),
            altitud: valueFromForm(form, `[name="altitud_${index}"]`),
            precisionGps: valueFromForm(form, `[name="precisionGps_${index}"]`)
        }));
        const hidden = form.querySelector("[name=muestrasJson]");
        if (hidden) {
            hidden.value = JSON.stringify(rows);
        }
        return rows;
    }

    function buildAforoRows(form) {
        const zone = valueFromForm(form, "[name=zona]");
        const sites = AFORO_SITES[zone] || [];
        const tbody = form.querySelector("[data-aforo-rows]");
        if (!tbody) {
            return;
        }

        tbody.innerHTML = sites.map((site, index) => `
            <tr>
                <th scope="row">${escapeHtml(site)}</th>
                <td><input name="caudalAforado_${index}" aria-label="Caudal aforado de ${escapeHtml(site)}"></td>
                <td><input name="litrosSegundo_${index}" inputmode="decimal" aria-label="Litros por segundo de ${escapeHtml(site)}"></td>
                <td class="sample-coordinate-cell">
                    <input type="hidden" name="latitudAforo_${index}">
                    <input type="hidden" name="longitudAforo_${index}">
                    <input type="hidden" name="altitudAforo_${index}">
                    <input type="hidden" name="precisionGpsAforo_${index}">
                    <div class="sample-coordinate-actions">
                        <button type="button" class="btn secondary sample-coordinate-button" data-aforo-gps-index="${index}">Mi ubicación</button>
                    </div>
                    <span class="sample-coordinate-summary" data-aforo-coordinates-index="${index}">Sin coordenadas</span>
                    <span class="sample-coordinate-status" data-aforo-gps-status data-aforo-gps-status-index="${index}" aria-live="polite"></span>
                </td>
            </tr>
        `).join("");

        const hidden = form.querySelector("[name=medicionesJson]");
        const saved = hidden ? parseJson(hidden.value, []) : [];
        sites.forEach((site, index) => {
            const row = saved.find(savedRow => clean(savedRow?.lugar) === clean(site));
            if (!row) {
                return;
            }
            ["caudalAforado", "litrosSegundo"].forEach(key => {
                const input = form.querySelector(`[name="${key}_${index}"]`);
                if (input) {
                    input.value = clean(row[key]);
                }
            });
            [["latitud", "latitudAforo"], ["longitud", "longitudAforo"], ["altitud", "altitudAforo"], ["precisionGps", "precisionGpsAforo"]].forEach(([key, name]) => {
                const input = form.querySelector(`[name="${name}_${index}"]`);
                if (input) input.value = clean(row[key]);
            });
            updateAforoCoordinateLabel(form, index, row);
        });
        syncAforoHidden(form);
    }

    function syncAforoHidden(form) {
        const zone = valueFromForm(form, "[name=zona]");
        const sites = AFORO_SITES[zone] || [];
        const rows = sites.map((lugar, index) => ({
            lugar,
            caudalAforado: valueFromForm(form, `[name="caudalAforado_${index}"]`),
            litrosSegundo: valueFromForm(form, `[name="litrosSegundo_${index}"]`),
            latitud: valueFromForm(form, `[name="latitudAforo_${index}"]`),
            longitud: valueFromForm(form, `[name="longitudAforo_${index}"]`),
            altitud: valueFromForm(form, `[name="altitudAforo_${index}"]`),
            precisionGps: valueFromForm(form, `[name="precisionGpsAforo_${index}"]`)
        }));
        const hidden = form.querySelector("[name=medicionesJson]");
        if (hidden) {
            hidden.value = JSON.stringify(rows);
        }
        return rows;
    }

    function parseJson(value, fallback) {
        try {
            const parsed = JSON.parse(value || "");
            return parsed === null || parsed === undefined ? fallback : parsed;
        } catch (error) {
            return fallback;
        }
    }

    function coordinatesFromForm(form) {
        const readCoordinate = selector => {
            const value = valueFromForm(form, selector);
            return value === "" ? NaN : Number(value);
        };
        return {
            latitud: readCoordinate("[name=latitud]"),
            longitud: readCoordinate("[name=longitud]")
        };
    }

    function renderModuleMap(mapRoot, latitude, longitude, label) {
        if (!mapRoot) {
            return;
        }

        const Leaflet = leaflet();
        const form = mapRoot.closest("form");
        const coordinateCaption = mapRoot.closest(".accident-geo-layout")?.querySelector(
            "[data-map-coordinates]"
        ) || mapRoot.parentElement?.querySelector("[data-map-coordinates]");
        const hasPoint = Number.isFinite(latitude) && Number.isFinite(longitude);

        if (!Leaflet) {
            if (!mapRoot.dataset.leafletWaiting) {
                mapRoot.dataset.leafletWaiting = "true";
                mapRoot.innerHTML = '<p class="module-map-note">Cargando mapa...</p>';
                waitForLeaflet()
                    .then(() => {
                        delete mapRoot.dataset.leafletWaiting;
                        updateFormMap(form);
                    })
                    .catch(() => {
                        delete mapRoot.dataset.leafletWaiting;
                        mapRoot.innerHTML = '<p class="module-map-note">No se pudo cargar el mapa. Revise la conexión e intente nuevamente.</p>';
                        setMessage(form?.querySelector("[data-gps-status]"), "El mapa no terminó de cargar. Puede volver a intentarlo recargando la página.", "error");
                    });
            }
            return;
        }

        let state = mapRoot.__asadaModuleMapState;
        if (!state || !state.map || !mapRoot.querySelector(".leaflet-container")) {
            mapRoot.innerHTML = "";
            const map = Leaflet.map(mapRoot, {
                zoomControl: true,
                attributionControl: true
            }).setView(
                hasPoint ? [latitude, longitude] : DEFAULT_MAP_POSITION,
                hasPoint ? 17 : 14
            );

            const tileOptions = {
                maxZoom: 19,
                updateWhenIdle: false,
                keepBuffer: 4,
                attribution: "© OpenStreetMap"
            };
            const tileSources = [
                "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
            ];
            let tileSourceIndex = 0;
            let tileErrors = 0;
            let tiles = Leaflet.tileLayer(tileSources[tileSourceIndex], tileOptions).addTo(map);
            map.on("tileerror", () => {
                tileErrors += 1;
                if (tileErrors >= 2 && tileSourceIndex < tileSources.length - 1) {
                    map.removeLayer(tiles);
                    tileSourceIndex += 1;
                    tileErrors = 0;
                    tiles = Leaflet.tileLayer(tileSources[tileSourceIndex], tileOptions).addTo(map);
                } else if (tileErrors >= 3 && form) {
                    setMessage(form.querySelector("[data-gps-status]"), "El mapa base no respondió. Revise la conexión; también puede seleccionar el punto manualmente cuando las teselas estén disponibles.", "error");
                }
            });

            state = { map, marker: null, form, label };
            mapRoot.__asadaModuleMapState = state;

            if (form) {
                map.on("click", event => {
                    setModulePoint(form, event.latlng.lat, event.latlng.lng, "Ubicación seleccionada manualmente en el mapa.");
                });
            }
        }

        const map = state.map;
        if (hasPoint) {
            const point = [latitude, longitude];
            map.setView(point, Math.max(map.getZoom(), 17));
            if (!state.marker) {
                state.marker = Leaflet.marker(point, {
                    draggable: Boolean(form),
                    icon: createModuleMarkerIcon() || undefined,
                    title: label || "Ubicación capturada"
                }).addTo(map);
                state.marker.bindPopup(label || "Ubicación capturada");
                if (form) {
                    state.marker.on("dragend", () => {
                        const position = state.marker.getLatLng();
                        setModulePoint(form, position.lat, position.lng, "Ubicación ajustada manualmente.");
                    });
                }
            } else {
                state.marker.setLatLng(point);
            }
            if (coordinateCaption) {
                coordinateCaption.textContent = `Punto: ${latitude.toFixed(7)}, ${longitude.toFixed(7)}`;
            }
        } else {
            if (state.marker) {
                map.removeLayer(state.marker);
                state.marker = null;
            }
            map.setView(DEFAULT_MAP_POSITION, 14);
            if (coordinateCaption) {
                coordinateCaption.textContent = "Punto aún no definido. Seleccione un punto en el mapa.";
            }
        }

        window.setTimeout(() => map.invalidateSize(), 100);
        window.setTimeout(() => map.invalidateSize(), 500);
    }

    function setModulePoint(form, latitude, longitude, message) {
        const lat = Number(latitude);
        const lng = Number(longitude);
        const latField = form?.querySelector("[name=latitud]");
        const lngField = form?.querySelector("[name=longitud]");
        if (!form || !latField || !lngField || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            return;
        }

        latField.value = lat.toFixed(7);
        lngField.value = lng.toFixed(7);
        const activeSampleIndex = Number(form.dataset.activeSampleIndex);
        if (Number.isInteger(activeSampleIndex) && activeSampleIndex >= 0) {
            setSampleCoordinates(form, activeSampleIndex, {
                latitud: lat,
                longitud: lng
            });
            delete form.dataset.activeSampleIndex;
            message = `${message} Coordenadas asignadas al punto de muestreo.`;
        }
        updateFormMap(form);
        setMessage(form.querySelector("[data-gps-status]"), message, "success");
    }

    function updateFormMap(form) {
        const mapRoot = form?.querySelector("[data-module-map]");
        const { latitud, longitud } = coordinatesFromForm(form);
        renderModuleMap(
            mapRoot,
            latitud,
            longitud,
            mapRoot?.dataset.mapKind === "aforo" ? "Punto del aforo" : "Punto del muestreo"
        );
    }

    async function searchModuleMap(form) {
        const input = form.querySelector("[data-map-search]");
        const resultsBox = form.querySelector("[data-map-search-results]");
        const query = clean(input?.value);
        if (!query) {
            setMessage(form.querySelector("[data-gps-status]"), "Escriba un lugar o dirección para buscar.", "error");
            return;
        }

        resultsBox.classList.remove("hidden");
        resultsBox.innerHTML = '<div class="note">Buscando ubicación...</div>';
        try {
            const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=cr&accept-language=es&q=" + encodeURIComponent(query);
            const response = await fetch(url, { headers: { Accept: "application/json" } });
            if (!response.ok) throw new Error("No fue posible buscar la ubicación.");
            const results = await response.json();
            if (!Array.isArray(results) || !results.length) {
                resultsBox.innerHTML = '<div class="accident-search-empty">No se encontraron resultados.</div>';
                return;
            }
            resultsBox.innerHTML = results.map((result, index) => `
                <button type="button" class="accident-search-result" data-map-result-index="${index}">
                    ${escapeHtml(result.display_name)}
                </button>`).join("");
            resultsBox.querySelectorAll("[data-map-result-index]").forEach(button => {
                button.addEventListener("click", () => {
                    const result = results[Number(button.dataset.mapResultIndex)];
                    if (!result) return;
                    input.value = result.display_name || query;
                    setModulePoint(form, result.lat, result.lon, "Ubicación seleccionada mediante búsqueda.");
                    resultsBox.classList.add("hidden");
                });
            });
        } catch (error) {
            resultsBox.innerHTML = `<div class="accident-search-empty">${escapeHtml(error.message || "No fue posible buscar la ubicación.")}</div>`;
        }
    }

    function bindMapTools(form) {
        const searchButton = form.querySelector("[data-map-search-submit]");
        const searchInput = form.querySelector("[data-map-search]");
        searchButton?.addEventListener("click", () => searchModuleMap(form));
        searchInput?.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                searchModuleMap(form);
            }
        });
    }

    function fillCoordinates(form, sampleIndex) {
        const requestedSampleIndex = sampleIndex === undefined
            ? Number(form.dataset.activeSampleIndex)
            : Number(sampleIndex);
        const targetSampleIndex = Number.isInteger(requestedSampleIndex) && requestedSampleIndex >= 0
            ? requestedSampleIndex
            : null;
        const status = form.querySelector(`[data-sample-gps-status-index="${targetSampleIndex}"]`) || form.querySelector("[data-gps-status]");
        if (targetSampleIndex === null) {
            setMessage(status, "Seleccione un punto y pulse «Mi ubicación».", "error");
            return;
        }
        if (!navigator.geolocation) {
            setMessage(status, "Este dispositivo no permite obtener coordenadas.", "error");
            return;
        }
        setMessage(status, "Obteniendo coordenadas...", "loading");
        navigator.geolocation.getCurrentPosition(position => {
            const coordinates = {
                latitud: position.coords.latitude,
                longitud: position.coords.longitude,
                altitud: Number.isFinite(position.coords.altitude)
                ? position.coords.altitude.toFixed(2)
                : "",
                precisionGps: Number.isFinite(position.coords.accuracy)
                ? position.coords.accuracy.toFixed(2)
                : ""
            };
            setSampleCoordinates(form, targetSampleIndex, coordinates);
            delete form.dataset.activeSampleIndex;
            setMessage(status, "Coordenadas obtenidas.", "success");
        }, error => {
            const detail = error?.code === 1
                ? "Debe permitir el acceso a la ubicación en el navegador."
                : error?.code === 3
                    ? "La ubicación tardó demasiado. Intente nuevamente en un lugar con mejor señal."
                    : "No se pudieron obtener las coordenadas. Intente nuevamente.";
            setMessage(status, detail, "error");
        }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    }

    function fillAforoCoordinates(form, index) {
        const status = form.querySelector(`[data-aforo-gps-status-index="${index}"]`) || form.querySelector("[data-aforo-gps-status]");
        if (!navigator.geolocation) {
            setMessage(status, "Este dispositivo no permite obtener coordenadas.", "error");
            return;
        }
        setMessage(status, "Obteniendo coordenadas...", "loading");
        navigator.geolocation.getCurrentPosition(position => {
            setAforoCoordinates(form, index, {
                latitud: position.coords.latitude,
                longitud: position.coords.longitude,
                altitud: Number.isFinite(position.coords.altitude) ? position.coords.altitude : "",
                precisionGps: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : ""
            });
            setMessage(status, "Coordenadas obtenidas.", "success");
            setMessage(form.querySelector("[data-aforo-gps-status]"), "Coordenadas obtenidas para el punto seleccionado.", "success");
        }, error => {
            const detail = error?.code === 1
                ? "Debe permitir el acceso a la ubicación en el navegador."
                : error?.code === 3
                    ? "La ubicación tardó demasiado. Intente nuevamente."
                    : "No se pudieron obtener las coordenadas. Intente nuevamente.";
            setMessage(status, detail, "error");
        }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    }

    function bindCloroForm() {
        const form = document.getElementById("cloroForm");
        if (!form || form.dataset.moduleBound) {
            return;
        }
        form.dataset.moduleBound = "1";
        const zone = form.querySelector("[name=zona]");
        zone.addEventListener("change", () => buildCloroRows(form));
        form.addEventListener("input", () => syncCloroHidden(form));
        form.addEventListener("click", event => {
            const gpsButton = event.target.closest("[data-sample-gps-index]");
            if (gpsButton) {
                event.preventDefault();
                fillCoordinates(form, Number(gpsButton.dataset.sampleGpsIndex));
                return;
            }

        });
        buildCloroRows(form);
        setAutomaticFields(form);
        waitForAuth().then(() => setAutomaticFields(form));
        form.addEventListener("submit", async event => {
            // Always stop the browser's native form navigation. Without this,
            // a missing/stale confirmation script reloads the page and clears
            // the fields without ever calling Apps Script.
            event.preventDefault();

            const status = form.querySelector("[data-module-status]");
            const submitButton = form.querySelector('button[type="submit"]');
            const originalButtonText = submitButton?.textContent || "Guardar control de cloro";

            if (form.dataset.asadaSaving === "1") {
                return;
            }

            // seguridad.js sets this only after the user approves its shared
            // confirmation dialog. If that script is absent or stale, use a
            // browser confirmation and still submit through this handler.
            const confirmedBySharedDialog = form.dataset.asadaSubmitBypass === "1";
            delete form.dataset.asadaSubmitBypass;

            if (typeof form.reportValidity === "function" && !form.reportValidity()) {
                return;
            }

            if (!confirmedBySharedDialog) {
                const confirmed = window.confirm(
                    "¿Confirma guardar este control de cloro residual?"
                );
                if (!confirmed) {
                    setMessage(status, "No se envió el control de cloro.", "");
                    return;
                }
            }

            form.dataset.asadaSaving = "1";
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Guardando control...";
            }
            setMessage(status, "Guardando el control de cloro en Google Sheets...", "loading");

            let savedSuccessfully = false;
            try {
                const user = await waitForAuth();
                if (!user || !clean(user.email)) {
                    throw new Error("La sesión no está lista. Inicie sesión nuevamente e intente guardar.");
                }

                const samples = syncCloroHidden(form);
                const missingSample = samples.find(sample => !sampleHasCoordinates(sample));
                if (missingSample) {
                    throw new Error(`Capture las coordenadas del punto «${missingSample.lugar}» antes de guardar.`);
                }

                const primaryCoordinates = samples.find(sample => sampleHasCoordinates(sample)) || {};
                const id = valueFromForm(form, "[name=id]");
                const record = {
                    id,
                    mode: id ? "update" : "create",
                    zona: valueFromForm(form, "[name=zona]"),
                    fechaMuestreo: valueFromForm(form, "[name=fechaMuestreo]"),
                    perfil: valueFromForm(form, "[name=perfil]"),
                    latitud: primaryCoordinates.latitud || "",
                    longitud: primaryCoordinates.longitud || "",
                    altitud: primaryCoordinates.altitud || "",
                    precisionGps: primaryCoordinates.precisionGps || "",
                    muestras: samples,
                    responsableCampo: valueFromForm(form, "[name=responsableCampo]"),
                    ingresadoPor: valueFromForm(form, "[name=ingresadoPor]")
                };

                const response = await api("saveCloro", { cloro: record });
                const saved = responseData(response).cloro;
                const savedId = clean(saved?.id);
                if (!savedId) {
                    throw new Error("Apps Script no devolvió el ID guardado. No se confirmó el registro en Sheets.");
                }

                savedSuccessfully = true;
                setMessage(status, `Control de cloro guardado correctamente. ID: ${savedId}.`, "success");

                // The shared security flow shows its detailed success preview.
                // The fallback flow needs its own visible confirmation.
                if (!confirmedBySharedDialog || typeof window.asadaShowPostSavePreview !== "function") {
                    window.alert(`El control de cloro se guardó correctamente. ID: ${savedId}.`);
                }
            } catch (error) {
                console.error("Error guardando el control de cloro:", error);
                setMessage(status, error?.message || "No fue posible guardar el control de cloro.", "error");
            } finally {
                delete form.dataset.asadaSaving;
                if (submitButton) {
                    if (savedSuccessfully && !confirmedBySharedDialog) {
                        // Keep the successful form from being submitted twice.
                        submitButton.disabled = true;
                        submitButton.textContent = "Control guardado";
                    } else {
                        submitButton.disabled = false;
                        submitButton.textContent = originalButtonText;
                    }
                }
            }
        });
        loadCloroEdit(form);
    }

    async function loadCloroEdit(form) {
        const id = queryId();
        if (!id) {
            return;
        }
        await waitForAuth();
        try {
            const data = responseData(await api("getCloroById", { id }));
            const record = data.cloro;
            if (!record) {
                throw new Error("No se encontró el control de cloro solicitado.");
            }
            form.querySelector("[name=id]").value = record.id;
            form.querySelector("[name=zona]").value = record.zona;
            form.querySelector("[name=fechaMuestreo]").value = dateInputValue(record.fechaMuestreo);
            form.querySelector("[name=responsableCampo]").value = record.responsableCampo || "";
            form.querySelector("[name=perfil]").value = record.perfil || "";
            form.querySelector("[name=ingresadoPor]").value = record.ingresadoPor || "";
            const legacySamples = Array.isArray(record.muestras) ? record.muestras : [];
            const samples = legacySamples.map(row => ({
                ...row,
                latitud: clean(row.latitud) || clean(record.latitud),
                longitud: clean(row.longitud) || clean(record.longitud),
                altitud: clean(row.altitud) || clean(record.altitud),
                precisionGps: clean(row.precisionGps) || clean(record.precisionGps)
            }));
            form.querySelector("[name=muestrasJson]").value = JSON.stringify(samples);
            buildCloroRows(form);
            const title = document.querySelector(".page-head h1");
            if (title) title.textContent = "Editar control de cloro residual";
        } catch (error) {
            setMessage(form.querySelector("[data-module-status]"), error.message, "error");
        }
    }

    function bindAforoForm() {
        const form = document.getElementById("aforoForm");
        if (!form || form.dataset.moduleBound) {
            return;
        }
        form.dataset.moduleBound = "1";
        form.querySelector("[name=zona]").addEventListener("change", () => buildAforoRows(form));
        form.addEventListener("input", () => {
            syncAforoHidden(form);
        });
        form.addEventListener("click", event => {
            const gpsButton = event.target.closest("[data-aforo-gps-index]");
            if (!gpsButton) return;
            event.preventDefault();
            fillAforoCoordinates(form, Number(gpsButton.dataset.aforoGpsIndex));
        });
        buildAforoRows(form);
        setAutomaticFields(form);
        waitForAuth().then(() => setAutomaticFields(form));
        form.addEventListener("submit", async event => {
            // Stop the browser's default navigation in every path. If the
            // shared confirmation script is stale or missing, the page must
            // not reload and discard the aforo before sending it to Apps Script.
            event.preventDefault();

            const status = form.querySelector("[data-module-status]");
            const submitButton = form.querySelector('button[type="submit"]');
            const originalButtonText = submitButton?.textContent || "Guardar aforo";

            if (form.dataset.asadaSaving === "1") {
                return;
            }

            const confirmedBySharedDialog = form.dataset.asadaSubmitBypass === "1";
            delete form.dataset.asadaSubmitBypass;

            if (typeof form.reportValidity === "function" && !form.reportValidity()) {
                return;
            }

            if (!confirmedBySharedDialog) {
                const confirmed = window.confirm("¿Confirma guardar este aforo?");
                if (!confirmed) {
                    setMessage(status, "No se envió el aforo.", "");
                    return;
                }
            }

            form.dataset.asadaSaving = "1";
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Guardando aforo...";
            }
            setMessage(status, "Guardando el aforo en Google Sheets...", "loading");

            let savedSuccessfully = false;
            try {
                const user = await waitForAuth();
                if (!user || !clean(user.email)) {
                    throw new Error("La sesión no está lista. Inicie sesión nuevamente e intente guardar.");
                }

                const measurements = syncAforoHidden(form);
                const missingMeasurement = measurements.find(row => !sampleHasCoordinates(row));
                if (missingMeasurement) {
                    throw new Error(`Capture las coordenadas del punto «${missingMeasurement.lugar}» antes de guardar.`);
                }

                const id = valueFromForm(form, "[name=id]");
                const record = {
                    id,
                    mode: id ? "update" : "create",
                    zona: valueFromForm(form, "[name=zona]"),
                    fecha: valueFromForm(form, "[name=fecha]"),
                    condicionClima: valueFromForm(form, "[name=condicionClima]"),
                    perfil: valueFromForm(form, "[name=perfil]"),
                    mediciones: measurements,
                    responsableCampo: valueFromForm(form, "[name=responsableCampo]"),
                    ingresadoPor: valueFromForm(form, "[name=ingresadoPor]")
                };

                const response = await api("saveAforo", { aforo: record });
                const saved = responseData(response).aforo;
                const savedId = clean(saved?.id);
                if (!savedId) {
                    throw new Error("Apps Script no devolvió el ID guardado. No se confirmó el aforo en Sheets.");
                }

                savedSuccessfully = true;
                setMessage(status, `Aforo guardado correctamente. ID: ${savedId}.`, "success");
                if (!confirmedBySharedDialog || typeof window.asadaShowPostSavePreview !== "function") {
                    window.alert(`El aforo se guardó correctamente. ID: ${savedId}.`);
                }
            } catch (error) {
                console.error("Error guardando el aforo:", error);
                setMessage(status, error?.message || "No fue posible guardar el aforo.", "error");
            } finally {
                delete form.dataset.asadaSaving;
                if (submitButton) {
                    if (savedSuccessfully && !confirmedBySharedDialog) {
                        // Prevent a duplicate insert until the user starts a new form.
                        submitButton.disabled = true;
                        submitButton.textContent = "Aforo guardado";
                    } else {
                        submitButton.disabled = false;
                        submitButton.textContent = originalButtonText;
                    }
                }
            }
        });
        loadAforoEdit(form);
    }

    async function loadAforoEdit(form) {
        const id = queryId();
        if (!id) {
            return;
        }
        await waitForAuth();
        try {
            const data = responseData(await api("getAforoById", { id }));
            const record = data.aforo;
            if (!record) {
                throw new Error("No se encontró el aforo solicitado.");
            }
            form.querySelector("[name=id]").value = record.id;
            form.querySelector("[name=zona]").value = record.zona;
            form.querySelector("[name=fecha]").value = dateInputValue(record.fecha);
            form.querySelector("[name=condicionClima]").value = record.condicionClima || "";
            form.querySelector("[name=responsableCampo]").value = record.responsableCampo || "";
            form.querySelector("[name=perfil]").value = record.perfil || "";
            form.querySelector("[name=ingresadoPor]").value = record.ingresadoPor || "";
            form.querySelector("[name=medicionesJson]").value = JSON.stringify(record.mediciones || []);
            buildAforoRows(form);
            const title = document.querySelector(".page-head h1");
            if (title) title.textContent = "Editar registro de aforo";
        } catch (error) {
            setMessage(form.querySelector("[data-module-status]"), error.message, "error");
        }
    }

    function renderCloroList(records) {
        const root = document.getElementById("clorosPage");
        if (!root) {
            return;
        }
        if (!records.length) {
            root.innerHTML = '<div class="empty-state"><p>No hay controles de cloro registrados.</p></div>';
            return;
        }
        root.innerHTML = `<div class="module-list">${records.map(record => `
            <article class="record-card module-card">
                <div class="record-card-top"><span class="eyebrow">CLORO RESIDUAL</span><h2>${escapeHtml(record.id)}</h2></div>
                <p><strong>${escapeHtml(record.zona)}</strong></p>
                <p>Fecha: ${escapeHtml(formatDate(record.fechaMuestreo))}</p>
                <p>Perfil: ${escapeHtml(record.perfil || record.ingresadoPor)}</p>
                <p>${escapeHtml(String(record.muestras?.length || 0))} puntos de muestreo · Coordenadas guardadas</p>
                <div class="record-card-actions">
                    <a class="btn primary" href="detalle-cloro.html?id=${encodeURIComponent(record.id)}">Consultar registro</a>
                    <a class="btn secondary" href="crear-cloro.html?id=${encodeURIComponent(record.id)}">Editar</a>
                    <button type="button" class="btn secondary" data-asada-delete="deleteCloro" data-asada-delete-id="${escapeHtml(record.id)}">Eliminar</button>
                </div>
            </article>`).join("")}</div>`;
    }

    function renderAforoList(records) {
        const root = document.getElementById("aforosPage");
        if (!root) {
            return;
        }
        if (!records.length) {
            root.innerHTML = '<div class="empty-state"><p>No hay aforos registrados.</p></div>';
            return;
        }
        root.innerHTML = `<div class="module-list">${records.map(record => `
            <article class="record-card module-card">
                <div class="record-card-top"><span class="eyebrow">AFORO</span><h2>${escapeHtml(record.id)}</h2></div>
                <p><strong>${escapeHtml(record.zona)}</strong></p>
                <p>Fecha: ${escapeHtml(formatDate(record.fecha))}</p>
                <p>Clima: ${escapeHtml(record.condicionClima || "No indicado")}</p>
                <p>Perfil: ${escapeHtml(record.perfil || record.ingresadoPor)}</p>
                <div class="record-card-actions">
                    <a class="btn primary" href="detalle-aforo.html?id=${encodeURIComponent(record.id)}">Consultar registro</a>
                    <a class="btn secondary" href="crear-aforo.html?id=${encodeURIComponent(record.id)}">Editar</a>
                    <button type="button" class="btn secondary" data-asada-delete="deleteAforo" data-asada-delete-id="${escapeHtml(record.id)}">Eliminar</button>
                </div>
            </article>`).join("")}</div>`;
    }

    async function bindLists() {
        const cloroRoot = document.getElementById("clorosPage");
        const aforoRoot = document.getElementById("aforosPage");
        if (!cloroRoot && !aforoRoot) {
            return;
        }
        await waitForAuth();
        try {
            if (cloroRoot) {
                const data = responseData(await api("getAllCloros"));
                renderCloroList(data.cloros || []);
            }
            if (aforoRoot) {
                const data = responseData(await api("getAllAforos"));
                renderAforoList(data.aforos || []);
            }
        } catch (error) {
            const root = cloroRoot || aforoRoot;
            root.innerHTML = `<div class="empty-state is-error"><p>${escapeHtml(error.message || "No fue posible cargar los registros.")}</p></div>`;
        }
    }

    function detailTable(rows, headers) {
        return `<div class="module-table-wrap"><table class="module-table"><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    }

    function createMap(record, mapId, label) {
        const mapRoot = document.getElementById(mapId);
        if (!mapRoot) {
            return;
        }
        const lat = clean(record.latitud) === "" ? NaN : Number(record.latitud);
        const lng = clean(record.longitud) === "" ? NaN : Number(record.longitud);
        renderModuleMap(mapRoot, lat, lng, label || "Ubicación capturada");
    }

    function renderCloroDetail(record) {
        const root = document.getElementById("cloroDetail");
        if (!root) {
            return;
        }
        const samples = (Array.isArray(record.muestras) ? record.muestras : []).map(row => ({
            ...row,
            latitud: clean(row.latitud) || clean(record.latitud),
            longitud: clean(row.longitud) || clean(record.longitud),
            altitud: clean(row.altitud) || clean(record.altitud),
            precisionGps: clean(row.precisionGps) || clean(record.precisionGps)
        }));
        root.innerHTML = `
            <div class="module-detail-head"><span class="eyebrow">CONTROL DE CLORO RESIDUAL</span><h1>${escapeHtml(record.zona)}</h1><p>Registro ${escapeHtml(record.id)} · ${escapeHtml(formatDate(record.fechaMuestreo))}</p></div>
            <section class="detail-card module-detail-card"><h2>Información del registro</h2><dl class="module-detail-grid">
                <div><dt>Perfil</dt><dd>${escapeHtml(record.perfil || record.ingresadoPor)}</dd></div>
                <div><dt>Responsable de campo</dt><dd>${escapeHtml(record.responsableCampo || "No indicado")}</dd></div>
                <div><dt>Latitud</dt><dd>${escapeHtml(record.latitud)}</dd></div>
                <div><dt>Longitud</dt><dd>${escapeHtml(record.longitud)}</dd></div>
                <div><dt>Altitud</dt><dd>${escapeHtml(record.altitud || "No disponible")}</dd></div>
                <div><dt>Precisión GPS</dt><dd>${escapeHtml(record.precisionGps || "No disponible")}</dd></div>
            </dl></section>
            <section class="detail-card module-detail-card"><h2>Puntos de muestreo</h2>${detailTable(samples.map(row => [row.lugar, row.turbiedad, row.cloro, row.ph, row.olor, row.temperatura, row.hora, formatSampleCoordinates(row)]), ["Lugar", "Turbiedad", "Cloro", "PH", "Olor", "Temperatura", "Hora", "Coordenadas"])}</section>
            <section class="detail-card module-detail-card"><h2>Ubicación</h2><div id="cloroMap" class="module-map"></div><p class="module-map-coordinates" data-map-coordinates>Punto aún no definido.</p></section>
            <div class="detail-actions module-actions"><button type="button" class="btn primary" data-download-cloro>Descargar PDF</button><a class="btn secondary" href="crear-cloro.html?id=${encodeURIComponent(record.id)}">Editar</a><a class="btn secondary" href="cloros.html">Volver al listado</a></div>`;
        createMap(record, "cloroMap", "Punto del muestreo");
        root.querySelector("[data-download-cloro]").addEventListener("click", () => downloadCloroPdf(record));
    }

    function renderAforoDetail(record) {
        const root = document.getElementById("aforoDetail");
        if (!root) {
            return;
        }
        const measurements = Array.isArray(record.mediciones) ? record.mediciones : [];
        root.innerHTML = `
            <div class="module-detail-head"><span class="eyebrow">REGISTRO DE AFORO</span><h1>${escapeHtml(record.zona)}</h1><p>Registro ${escapeHtml(record.id)} · ${escapeHtml(formatDate(record.fecha))}</p></div>
            <section class="detail-card module-detail-card"><h2>Información del registro</h2><dl class="module-detail-grid">
                <div><dt>Perfil</dt><dd>${escapeHtml(record.perfil || record.ingresadoPor)}</dd></div>
                <div><dt>Condición del clima</dt><dd>${escapeHtml(record.condicionClima || "No indicada")}</dd></div>
                <div><dt>Responsable de campo</dt><dd>${escapeHtml(record.responsableCampo || "No indicado")}</dd></div>
            </dl></section>
            <section class="detail-card module-detail-card"><h2>Puntos aforados</h2>${detailTable(measurements.map(row => [row.lugar, row.caudalAforado, row.litrosSegundo, formatSampleCoordinates(row)]), ["Punto", "Caudal aforado", "Litros por segundo", "Coordenadas"])}</section>
            <div class="detail-actions module-actions"><button type="button" class="btn primary" data-download-aforo>Descargar PDF</button><a class="btn secondary" href="crear-aforo.html?id=${encodeURIComponent(record.id)}">Editar</a><a class="btn secondary" href="aforos.html">Volver al listado</a></div>`;
        root.querySelector("[data-download-aforo]").addEventListener("click", () => downloadAforoPdf(record));
    }

    async function bindDetail() {
        const cloroRoot = document.getElementById("cloroDetail");
        const aforoRoot = document.getElementById("aforoDetail");
        if (!cloroRoot && !aforoRoot) {
            return;
        }
        await waitForAuth();
        const id = queryId();
        try {
            if (cloroRoot) {
                const data = responseData(await api("getCloroById", { id }));
                if (!data.cloro) throw new Error("No se encontró el control de cloro solicitado.");
                renderCloroDetail(data.cloro);
            } else {
                const data = responseData(await api("getAforoById", { id }));
                if (!data.aforo) throw new Error("No se encontró el aforo solicitado.");
                renderAforoDetail(data.aforo);
            }
        } catch (error) {
            (cloroRoot || aforoRoot).innerHTML = `<div class="empty-state is-error"><p>${escapeHtml(error.message || "No fue posible cargar el detalle.")}</p></div>`;
        }
    }

    async function imageData(path) {
        try {
            const response = await fetch(path);
            const blob = await response.blob();
            return await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve("");
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            return "";
        }
    }

    async function createPdf(title, subtitle, rows, tableHeaders, filename, coordinateRows, options = {}) {
        if (!window.jspdf?.jsPDF) {
            throw new Error("No se pudo cargar el generador de PDF.");
        }
        const orientation = options.orientation || "portrait";
        const doc = new window.jspdf.jsPDF({ orientation, unit: "mm", format: "letter", compress: true });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const membrete = options.membreteDataUrl || await imageData("img/membrete-asada.png");
        if (!membrete) {
            throw new Error("No se encontró img/membrete-asada.png para generar el reporte.");
        }
        const defaultMembreteWidth = orientation === "landscape" ? Math.min(245, pageWidth - 32) : Math.min(178, pageWidth - 32);
        const membreteWidth = Number(options.membreteWidth) || defaultMembreteWidth;
        const membreteAspectRatio = Number(options.membreteAspectRatio) || (178 / 29.3);
        const membreteHeight = membreteWidth / membreteAspectRatio;
        const membreteFormat = options.membreteFormat || "PNG";
        const membreteTop = Number(options.membreteTop) || 7;
        doc.addImage(membrete, membreteFormat, (pageWidth - membreteWidth) / 2, membreteTop, membreteWidth, membreteHeight);
        doc.setTextColor(30, 32, 36);
        doc.setFontSize(Number(options.titleFontSize) || 16);
        doc.text(title, pageWidth / 2, Number(options.titleY) || 52, { align: "center" });
        doc.setFont(undefined, "normal");
        doc.setFontSize(Number(options.subtitleFontSize) || 10);
        doc.text(subtitle, pageWidth / 2, Number(options.subtitleY) || 59, { align: "center" });
        doc.setDrawColor(19, 128, 112);
        const dividerY = Number(options.dividerY) || 64;
        doc.line(18, dividerY, pageWidth - 18, dividerY);
        doc.setFontSize(Number(options.detailFontSize) || 10);
        let y = Number(options.detailsStartY) || 74;
        const detailSpacing = Number(options.detailSpacing) || 6;
        coordinateRows.forEach(pair => {
            doc.setFont(undefined, "bold");
            doc.text(`${pair[0]}:`, 18, y);
            doc.setFont(undefined, "normal");
            const value = pair[1] === "" || pair[1] === null || pair[1] === undefined
                ? "No indicado"
                : pair[1];
            doc.text(String(value), 62, y);
            y += detailSpacing;
        });
        if (typeof doc.autoTable !== "function") {
            throw new Error("No se pudo cargar el complemento de tablas del PDF.");
        }
        const defaultTableFontSize = options.compact ? 6.5 : 8;
        const tableFontSize = Number(options.tableFontSize) || defaultTableFontSize;
        doc.autoTable({
            startY: y + 4,
            head: [tableHeaders],
            body: rows,
            theme: "grid",
            styles: {
                fontSize: tableFontSize,
                cellPadding: Number(options.cellPadding) || (options.compact ? 1.6 : 2.2),
                overflow: "linebreak"
            },
            headStyles: {
                fillColor: [19, 128, 112],
                textColor: 255,
                fontSize: Number(options.headFontSize) || tableFontSize
            },
            margin: { left: 18, right: 18 },
            columnStyles: options.columnStyles || undefined
        });
        doc.setFontSize(8);
        doc.setTextColor(90, 95, 100);
        doc.text("Reporte generado por el sistema de ASADA Orosi", 18, pageHeight - 12);
        doc.save(filename);
    }

    async function downloadCloroPdf(record) {
        const rows = (record.muestras || []).map(row => [row.lugar, row.turbiedad, row.cloro, row.ph, row.olor, row.temperatura, row.hora, formatSampleCoordinates(row)]);
        await createPdf(
            "Control operativo de cloro residual",
            `${record.zona} · ${formatDate(record.fechaMuestreo)} · ID ${record.id}`,
            rows,
            ["Lugar", "Turbiedad", "Cloro", "PH", "Olor", "Temperatura", "Hora", "Coordenadas"],
            `Reporte_Cloro_${record.id}.pdf`,
            [["Latitud general", record.latitud], ["Longitud general", record.longitud], ["Altitud general", record.altitud], ["Precisión GPS general", record.precisionGps]],
            {
                orientation: "landscape",
                compact: true,
                columnStyles: {
                    0: { cellWidth: 42 },
                    1: { cellWidth: 25 },
                    2: { cellWidth: 24 },
                    3: { cellWidth: 22 },
                    4: { cellWidth: 28 },
                    5: { cellWidth: 27 },
                    6: { cellWidth: 22 },
                    7: { cellWidth: 53 }
                }
            }
        );
    }

    async function downloadAforoPdf(record) {
        const rows = (record.mediciones || []).map(row => [row.lugar, row.caudalAforado, row.litrosSegundo, formatSampleCoordinates(row)]);
        await createPdf(
            "Hoja de registro de aforos",
            `${record.zona} · ${formatDate(record.fecha)} · ID ${record.id}`,
            rows,
            ["Punto", "Caudal aforado", "Litros por segundo", "Coordenadas"],
            `Reporte_Aforo_${record.id}.pdf`,
            [["Condición del clima", record.condicionClima], ["Perfil", record.perfil], ["Responsable de campo", record.responsableCampo]],
            {
                orientation: "landscape",
                membreteDataUrl: AFORO_LETTERHEAD_DATA_URL,
                membreteFormat: "JPEG",
                membreteWidth: 210,
                membreteAspectRatio: 687 / 105,
                titleY: 46,
                subtitleY: 53,
                dividerY: 59,
                detailsStartY: 68,
                titleFontSize: 17,
                subtitleFontSize: 11,
                detailFontSize: 11,
                detailSpacing: 7,
                tableFontSize: 9.5,
                headFontSize: 10,
                cellPadding: 3,
                columnStyles: {
                    0: { cellWidth: 65 },
                    1: { cellWidth: 41 },
                    2: { cellWidth: 43 },
                    3: { cellWidth: 94 }
                }
            }
        );
    }

    function init() {
        bindCloroForm();
        bindAforoForm();
        bindLists();
        bindDetail();
    }

    window.ASADA_APPLY_CLORO_DRAFT = function (draft) {
        const form = document.getElementById("cloroForm");
        if (!form || !draft) return;
        if (draft.zona) form.querySelector("[name=zona]").value = draft.zona;
        if (draft.fechaMuestreo) form.querySelector("[name=fechaMuestreo]").value = dateInputValue(draft.fechaMuestreo);
        if (draft.muestras) form.querySelector("[name=muestrasJson]").value = JSON.stringify(draft.muestras);
        buildCloroRows(form);
    };

    window.ASADA_APPLY_AFORO_DRAFT = function (draft) {
        const form = document.getElementById("aforoForm");
        if (!form || !draft) return;
        if (draft.zona) form.querySelector("[name=zona]").value = draft.zona;
        if (draft.fecha) form.querySelector("[name=fecha]").value = dateInputValue(draft.fecha);
        if (draft.mediciones) form.querySelector("[name=medicionesJson]").value = JSON.stringify(draft.mediciones);
        buildAforoRows(form);
    };

    document.addEventListener("DOMContentLoaded", init, { once: true });
})();


