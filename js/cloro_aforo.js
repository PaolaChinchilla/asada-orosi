/* =========================================================
   ASADA OROSI - CLORO Y AFOROS
   Formularios, listados, detalles y descarga PDF.
   ========================================================= */

(function () {
    "use strict";

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

        const profileField = form.querySelector("[name=perfil]");
        const enteredByField = form.querySelector("[name=ingresadoPor]");
        if (profileField) {
            profileField.value = currentProfile();
        }
        if (enteredByField) {
            enteredByField.value = currentUserName();
        }
    }

    function setMessage(root, text, type) {
        if (!root) {
            return;
        }
        root.textContent = text || "";
        const baseClass = root.hasAttribute("data-gps-status")
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
            </tr>
        `).join("");

        const hidden = form.querySelector("[name=muestrasJson]");
        const saved = hidden ? parseJson(hidden.value, []) : [];
        saved.forEach((row, index) => {
            ["turbiedad", "cloro", "ph", "olor", "temperatura", "hora"].forEach(key => {
                const input = form.querySelector(`[name="${key}_${index}"]`);
                if (input) {
                    input.value = clean(row[key]);
                }
            });
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
            hora: valueFromForm(form, `[name="hora_${index}"]`)
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
            </tr>
        `).join("");

        const hidden = form.querySelector("[name=medicionesJson]");
        const saved = hidden ? parseJson(hidden.value, []) : [];
        saved.forEach((row, index) => {
            ["caudalAforado", "litrosSegundo"].forEach(key => {
                const input = form.querySelector(`[name="${key}_${index}"]`);
                if (input) {
                    input.value = clean(row[key]);
                }
            });
        });
        syncAforoHidden(form);
    }

    function syncAforoHidden(form) {
        const zone = valueFromForm(form, "[name=zona]");
        const sites = AFORO_SITES[zone] || [];
        const rows = sites.map((lugar, index) => ({
            lugar,
            caudalAforado: valueFromForm(form, `[name="caudalAforado_${index}"]`),
            litrosSegundo: valueFromForm(form, `[name="litrosSegundo_${index}"]`)
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

            Leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                maxZoom: 19,
                attribution: "© OpenStreetMap"
            }).addTo(map);

            let tileErrors = 0;
            map.on("tileerror", () => {
                tileErrors += 1;
                if (tileErrors >= 3 && form) {
                    setMessage(form.querySelector("[data-gps-status]"), "El mapa base no respondió. La selección manual y las coordenadas siguen disponibles; revise la conexión e intente nuevamente.", "error");
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

    function fillCoordinates(form) {
        const status = form.querySelector("[data-gps-status]");
        if (!navigator.geolocation) {
            setMessage(status, "Este dispositivo no permite obtener coordenadas.", "error");
            return;
        }
        setMessage(status, "Obteniendo coordenadas actuales...", "loading");
        navigator.geolocation.getCurrentPosition(position => {
            form.querySelector("[name=latitud]").value = position.coords.latitude.toFixed(7);
            form.querySelector("[name=longitud]").value = position.coords.longitude.toFixed(7);
            form.querySelector("[name=altitud]").value = Number.isFinite(position.coords.altitude)
                ? position.coords.altitude.toFixed(2)
                : "";
            form.querySelector("[name=precisionGps]").value = Number.isFinite(position.coords.accuracy)
                ? position.coords.accuracy.toFixed(2)
                : "";
            updateFormMap(form);
            setMessage(status, "Coordenadas obtenidas correctamente.", "success");
        }, error => {
            setMessage(status, "No se pudieron obtener las coordenadas. Permita el acceso a la ubicación e intente de nuevo.", "error");
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
        form.addEventListener("input", event => {
            syncCloroHidden(form);
            if (event.target.matches("[name=latitud], [name=longitud]")) {
                updateFormMap(form);
            }
        });
        form.querySelector("[data-get-gps]")?.addEventListener("click", () => fillCoordinates(form));
        bindMapTools(form);
        buildCloroRows(form);
        setAutomaticFields(form);
        updateFormMap(form);
        waitForAuth().then(() => setAutomaticFields(form));
        form.addEventListener("submit", async event => {
            if (form.dataset.asadaSubmitBypass !== "1") {
                return;
            }
            event.preventDefault();
            delete form.dataset.asadaSubmitBypass;
            const status = form.querySelector("[data-module-status]");
            const record = {
                id: valueFromForm(form, "[name=id]"),
                mode: valueFromForm(form, "[name=id]") ? "update" : "create",
                zona: valueFromForm(form, "[name=zona]"),
                fechaMuestreo: valueFromForm(form, "[name=fechaMuestreo]"),
                perfil: valueFromForm(form, "[name=perfil]") || currentProfile(),
                latitud: valueFromForm(form, "[name=latitud]"),
                longitud: valueFromForm(form, "[name=longitud]"),
                altitud: valueFromForm(form, "[name=altitud]"),
                precisionGps: valueFromForm(form, "[name=precisionGps]"),
                muestras: syncCloroHidden(form),
                responsableCampo: valueFromForm(form, "[name=responsableCampo]"),
                ingresadoPor: valueFromForm(form, "[name=ingresadoPor]") || currentUserName()
            };
            setMessage(status, "Guardando registro...", "loading");
            try {
                await api("saveCloro", { cloro: record });
                setMessage(status, "Registro guardado correctamente.", "success");
            } catch (error) {
                setMessage(status, error.message || "No fue posible guardar el registro.", "error");
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
            form.querySelector("[name=latitud]").value = record.latitud ?? "";
            form.querySelector("[name=longitud]").value = record.longitud ?? "";
            form.querySelector("[name=altitud]").value = record.altitud ?? "";
            form.querySelector("[name=precisionGps]").value = record.precisionGps ?? "";
            form.querySelector("[name=perfil]").value = record.perfil || currentProfile();
            form.querySelector("[name=ingresadoPor]").value = record.ingresadoPor || currentUserName();
            form.querySelector("[name=muestrasJson]").value = JSON.stringify(record.muestras || []);
            buildCloroRows(form);
            updateFormMap(form);
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
        form.addEventListener("input", event => {
            syncAforoHidden(form);
            if (event.target.matches("[name=latitud], [name=longitud]")) {
                updateFormMap(form);
            }
        });
        form.querySelector("[data-get-gps]")?.addEventListener("click", () => fillCoordinates(form));
        bindMapTools(form);
        buildAforoRows(form);
        setAutomaticFields(form);
        updateFormMap(form);
        waitForAuth().then(() => setAutomaticFields(form));
        form.addEventListener("submit", async event => {
            if (form.dataset.asadaSubmitBypass !== "1") {
                return;
            }
            event.preventDefault();
            delete form.dataset.asadaSubmitBypass;
            const status = form.querySelector("[data-module-status]");
            const id = valueFromForm(form, "[name=id]");
            const record = {
                id,
                mode: id ? "update" : "create",
                zona: valueFromForm(form, "[name=zona]"),
                fecha: valueFromForm(form, "[name=fecha]"),
                condicionClima: valueFromForm(form, "[name=condicionClima]"),
                perfil: valueFromForm(form, "[name=perfil]") || currentProfile(),
                mediciones: syncAforoHidden(form),
                responsableCampo: valueFromForm(form, "[name=responsableCampo]"),
                ingresadoPor: valueFromForm(form, "[name=ingresadoPor]") || currentUserName(),
                latitud: valueFromForm(form, "[name=latitud]"),
                longitud: valueFromForm(form, "[name=longitud]"),
                altitud: valueFromForm(form, "[name=altitud]"),
                precisionGps: valueFromForm(form, "[name=precisionGps]")
            };
            setMessage(status, "Guardando registro...", "loading");
            try {
                await api("saveAforo", { aforo: record });
                setMessage(status, "Registro guardado correctamente.", "success");
            } catch (error) {
                setMessage(status, error.message || "No fue posible guardar el registro.", "error");
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
            form.querySelector("[name=perfil]").value = record.perfil || currentProfile();
            form.querySelector("[name=ingresadoPor]").value = record.ingresadoPor || currentUserName();
            form.querySelector("[name=latitud]").value = record.latitud ?? "";
            form.querySelector("[name=longitud]").value = record.longitud ?? "";
            form.querySelector("[name=altitud]").value = record.altitud ?? "";
            form.querySelector("[name=precisionGps]").value = record.precisionGps ?? "";
            form.querySelector("[name=medicionesJson]").value = JSON.stringify(record.mediciones || []);
            buildAforoRows(form);
            updateFormMap(form);
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
        const samples = Array.isArray(record.muestras) ? record.muestras : [];
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
            <section class="detail-card module-detail-card"><h2>Puntos de muestreo</h2>${detailTable(samples.map(row => [row.lugar, row.turbiedad, row.cloro, row.ph, row.olor, row.temperatura, row.hora]), ["Lugar", "Turbiedad", "Cloro", "PH", "Olor", "Temperatura", "Hora"])}</section>
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
                <div><dt>Latitud</dt><dd>${escapeHtml(record.latitud || "No disponible")}</dd></div>
                <div><dt>Longitud</dt><dd>${escapeHtml(record.longitud || "No disponible")}</dd></div>
                <div><dt>Altitud</dt><dd>${escapeHtml(record.altitud || "No disponible")}</dd></div>
                <div><dt>Precisión GPS</dt><dd>${escapeHtml(record.precisionGps || "No disponible")}</dd></div>
            </dl></section>
            <section class="detail-card module-detail-card"><h2>Puntos aforados</h2>${detailTable(measurements.map(row => [row.lugar, row.caudalAforado, row.litrosSegundo]), ["Punto", "Caudal aforado", "Litros por segundo"])}</section>
            <section class="detail-card module-detail-card"><h2>Ubicación</h2><div id="aforoMap" class="module-map"></div><p class="module-map-coordinates" data-map-coordinates>Punto aún no definido.</p></section>
            <div class="detail-actions module-actions"><button type="button" class="btn primary" data-download-aforo>Descargar PDF</button><a class="btn secondary" href="crear-aforo.html?id=${encodeURIComponent(record.id)}">Editar</a><a class="btn secondary" href="aforos.html">Volver al listado</a></div>`;
        createMap(record, "aforoMap", "Punto del aforo");
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

    async function createPdf(title, subtitle, rows, tableHeaders, filename, coordinateRows) {
        if (!window.jspdf?.jsPDF) {
            throw new Error("No se pudo cargar el generador de PDF.");
        }
        const doc = new window.jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "letter", compress: true });
        const membrete = await imageData("img/membrete-asada.png");
        if (!membrete) {
            throw new Error("No se encontró img/membrete-asada.png para generar el reporte.");
        }
        doc.addImage(membrete, "PNG", 16, 7, 178, 29.3);
        doc.setTextColor(30, 32, 36);
        doc.setFontSize(16);
        doc.text(title, 18, 52);
        doc.setFont(undefined, "normal");
        doc.setFontSize(10);
        doc.text(subtitle, 18, 59);
        doc.setDrawColor(19, 128, 112);
        doc.line(18, 64, 198, 64);
        let y = 74;
        coordinateRows.forEach(pair => {
            doc.setFont(undefined, "bold");
            doc.text(`${pair[0]}:`, 18, y);
            doc.setFont(undefined, "normal");
            doc.text(String(pair[1] || "No indicado"), 62, y);
            y += 6;
        });
        if (typeof doc.autoTable !== "function") {
            throw new Error("No se pudo cargar el complemento de tablas del PDF.");
        }
        doc.autoTable({
            startY: y + 4,
            head: [tableHeaders],
            body: rows,
            theme: "grid",
            styles: { fontSize: 8, cellPadding: 2.2 },
            headStyles: { fillColor: [19, 128, 112], textColor: 255 },
            margin: { left: 18, right: 18 }
        });
        doc.setFontSize(8);
        doc.setTextColor(90, 95, 100);
        doc.text("Reporte generado por el sistema de ASADA Orosi", 18, 285);
        doc.save(filename);
    }

    async function downloadCloroPdf(record) {
        const rows = (record.muestras || []).map(row => [row.lugar, row.turbiedad, row.cloro, row.ph, row.olor, row.temperatura, row.hora]);
        await createPdf(
            "Control operativo de cloro residual",
            `${record.zona} · ${formatDate(record.fechaMuestreo)} · ID ${record.id}`,
            rows,
            ["Lugar", "Turbiedad", "Cloro", "PH", "Olor", "Temperatura", "Hora"],
            `Reporte_Cloro_${record.id}.pdf`,
            [["Latitud", record.latitud], ["Longitud", record.longitud], ["Altitud", record.altitud], ["Precisión GPS", record.precisionGps]]
        );
    }

    async function downloadAforoPdf(record) {
        const rows = (record.mediciones || []).map(row => [row.lugar, row.caudalAforado, row.litrosSegundo]);
        await createPdf(
            "Hoja de registro de aforos",
            `${record.zona} · ${formatDate(record.fecha)} · ID ${record.id}`,
            rows,
            ["Punto", "Caudal aforado", "Litros por segundo"],
            `Reporte_Aforo_${record.id}.pdf`,
            [["Condición del clima", record.condicionClima], ["Perfil", record.perfil], ["Responsable de campo", record.responsableCampo], ["Latitud", record.latitud], ["Longitud", record.longitud], ["Altitud", record.altitud], ["Precisión GPS", record.precisionGps]]
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
