/*
 * Reemplazo completo para js/cloro_aforo.js.
 * Conserva los formularios y sus destinos, y guarda el PDF de Cloro/Aforos
 * en Drive al guardar el registro. No requiere cambios en los archivos HTML.
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
            let savedId = "";
            let savedRecord = null;
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
                savedRecord = saved;
                savedId = clean(saved?.id);
                if (!savedId) {
                    throw new Error("Apps Script no devolvió el ID guardado. No se confirmó el registro en Sheets.");
                }

                savedSuccessfully = true;
                setMessage(status, `Control guardado en Sheets. Guardando el reporte PDF en Drive (ID: ${savedId})...`, "loading");
                const pdfResult = await downloadCloroPdf(saved, { downloadLocal: false });
                if (!clean(pdfResult?.reportePDFURL)) {
                    throw new Error("Sheets guardó el control, pero no confirmó el enlace del reporte PDF.");
                }
                setMessage(status, `Control y reporte PDF guardados. ID: ${savedId}.`, "success");

                if (confirmedBySharedDialog && typeof window.asadaShowPostSavePreview === "function") {
                    window.asadaShowPostSavePreview("cloro", saved);
                } else {
                    window.alert(`El control de cloro y su reporte PDF se guardaron correctamente. ID: ${savedId}.`);
                }
            } catch (error) {
                console.error("Error guardando el control de cloro o su reporte:", error);
                const message = savedSuccessfully
                    ? `El control sí quedó guardado en Sheets (ID: ${savedId}), pero no se pudo guardar el PDF en Drive. Abra el registro y use «Descargar PDF» para reintentarlo. Detalle: ${error?.message || "error desconocido"}`
                    : error?.message || "No fue posible guardar el control de cloro.";
                setMessage(status, message, "error");
                if (savedSuccessfully && confirmedBySharedDialog && typeof window.asadaShowPostSavePreview === "function") {
                    window.asadaShowPostSavePreview("cloro", savedRecord);
                    window.alert(message);
                }
            } finally {
                delete form.dataset.asadaSaving;
                if (submitButton) {
                    if (savedSuccessfully) {
                        // The row already exists; prevent a duplicate create if Drive needs a retry.
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
            let savedId = "";
            let savedRecord = null;
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
                savedRecord = saved;
                savedId = clean(saved?.id);
                if (!savedId) {
                    throw new Error("Apps Script no devolvió el ID guardado. No se confirmó el aforo en Sheets.");
                }

                savedSuccessfully = true;
                setMessage(status, `Aforo guardado en Sheets. Guardando el reporte PDF en Drive (ID: ${savedId})...`, "loading");
                const pdfResult = await downloadAforoPdf(saved, { downloadLocal: false });
                if (!clean(pdfResult?.reportePDFURL)) {
                    throw new Error("Sheets guardó el aforo, pero no confirmó el enlace del reporte PDF.");
                }
                setMessage(status, `Aforo y reporte PDF guardados. ID: ${savedId}.`, "success");
                if (confirmedBySharedDialog && typeof window.asadaShowPostSavePreview === "function") {
                    window.asadaShowPostSavePreview("aforo", saved);
                } else {
                    window.alert(`El aforo y su reporte PDF se guardaron correctamente. ID: ${savedId}.`);
                }
            } catch (error) {
                console.error("Error guardando el aforo o su reporte:", error);
                const message = savedSuccessfully
                    ? `El aforo sí quedó guardado en Sheets (ID: ${savedId}), pero no se pudo guardar el PDF en Drive. Abra el registro y use «Descargar PDF» para reintentarlo. Detalle: ${error?.message || "error desconocido"}`
                    : error?.message || "No fue posible guardar el aforo.";
                setMessage(status, message, "error");
                if (savedSuccessfully && confirmedBySharedDialog && typeof window.asadaShowPostSavePreview === "function") {
                    window.asadaShowPostSavePreview("aforo", savedRecord);
                    window.alert(message);
                }
            } finally {
                delete form.dataset.asadaSaving;
                if (submitButton) {
                    if (savedSuccessfully) {
                        // The row already exists; prevent a duplicate create if Drive needs a retry.
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

    function bindReportPdfButton(root, selector, moduleName, downloadReport) {
        const button = root.querySelector(selector);
        if (!button) {
            return;
        }

        button.addEventListener("click", async () => {
            if (button.dataset.asadaSavingPdf === "1") {
                return;
            }

            let status = root.querySelector("[data-report-pdf-status]");
            if (!status) {
                status = document.createElement("p");
                status.setAttribute("data-report-pdf-status", "");
                status.setAttribute("role", "status");
                button.insertAdjacentElement("afterend", status);
            }

            button.dataset.asadaSavingPdf = "1";
            button.disabled = true;
            button.textContent = "Guardando PDF en Drive...";
            setMessage(status, `Guardando el reporte de ${moduleName} en Drive...`, "loading");

            try {
                const result = await downloadReport();
                const reportUrl = clean(result?.reportePDFURL || result?.reportePdfUrl);
                if (!reportUrl) {
                    throw new Error("Apps Script no devolvió el enlace guardado en ReportePDFURL.");
                }
                button.textContent = "PDF guardado";
                setMessage(status, "PDF guardado en la carpeta del registro y enlace actualizado en ReportePDFURL.", "success");
            } catch (error) {
                console.error(`Error guardando el PDF de ${moduleName}:`, error);
                button.textContent = "Reintentar guardado del PDF";
                setMessage(status, error?.message || `No se pudo guardar el PDF de ${moduleName} en Drive.`, "error");
            } finally {
                delete button.dataset.asadaSavingPdf;
                button.disabled = false;
            }
        });
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
        bindReportPdfButton(root, "[data-download-cloro]", "cloro", () => downloadCloroPdf(record));
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
        bindReportPdfButton(root, "[data-download-aforo]", "aforo", () => downloadAforoPdf(record));
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

    async function saveModulePdfToDrive(doc, filename, moduleName, recordId) {
        const rawPdfData = doc.output("datauristring");
        const data = String(rawPdfData || "").replace(
            /^data:application\/pdf;[^,]*;base64,/i,
            "data:application/pdf;base64,"
        );

        if (!data.startsWith("data:application/pdf;base64,")) {
            throw new Error("No se pudo preparar el archivo PDF para guardarlo en Drive.");
        }

        const response = await api("saveCloroAforoPdf", {
            module: moduleName,
            id: recordId,
            archivo: {
                name: filename,
                type: "application/pdf",
                data
            }
        });
        const saved = responseData(response);
        const reportUrl = clean(saved?.reportePDFURL || saved?.reportePdfUrl);

        if (!reportUrl) {
            throw new Error("Apps Script no confirmó el enlace del PDF en Google Sheets.");
        }

        return { ...saved, reportePDFURL: reportUrl };
    }

    let pdfLibrariesPromise = null;

    function loadPdfScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error("No se pudo descargar una biblioteca necesaria para generar el reporte PDF."));
            document.head.appendChild(script);
        });
    }

    async function ensurePdfLibraries() {
        if (!pdfLibrariesPromise) {
            pdfLibrariesPromise = (async () => {
                if (!window.jspdf?.jsPDF) {
                    await loadPdfScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js");
                }
                if (!window.jspdf?.jsPDF) {
                    throw new Error("No se pudo cargar el generador de PDF.");
                }
                const probe = new window.jspdf.jsPDF({ unit: "mm", format: "letter" });
                if (typeof probe.autoTable !== "function") {
                    await loadPdfScript("https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js");
                }
                const verified = new window.jspdf.jsPDF({ unit: "mm", format: "letter" });
                if (typeof verified.autoTable !== "function") {
                    throw new Error("No se pudo cargar el complemento de tablas del reporte PDF.");
                }
            })().catch(error => {
                pdfLibrariesPromise = null;
                throw error;
            });
        }
        return pdfLibrariesPromise;
    }

    async function createPdf(title, subtitle, rows, tableHeaders, filename, coordinateRows, options = {}) {
        await ensurePdfLibraries();
        const orientation = options.orientation || "portrait";
        const doc = new window.jspdf.jsPDF({ orientation, unit: "mm", format: "letter", compress: true });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const membrete = await imageData("img/membrete-asada.png");
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

        let savedReport = null;
        if (options.driveModule && options.recordId) {
            savedReport = await saveModulePdfToDrive(
                doc,
                filename,
                options.driveModule,
                options.recordId
            );
        }

        if (options.downloadLocal !== false) {
            doc.save(filename);
        }
        return savedReport;
    }

    async function downloadCloroPdf(record, settings = {}) {
        const rows = (record.muestras || []).map(row => [row.lugar, row.turbiedad, row.cloro, row.ph, row.olor, row.temperatura, row.hora, formatSampleCoordinates(row)]);
        return await createPdf(
            "Control operativo de cloro residual",
            `${record.zona} · ${formatDate(record.fechaMuestreo)} · ID ${record.id}`,
            rows,
            ["Lugar", "Turbiedad", "Cloro", "PH", "Olor", "Temperatura", "Hora", "Coordenadas"],
            `Reporte_Cloro_${record.id}.pdf`,
            [["Latitud general", record.latitud], ["Longitud general", record.longitud], ["Altitud general", record.altitud], ["Precisión GPS general", record.precisionGps]],
            {
                orientation: "landscape",
                compact: true,
                driveModule: "Cloro",
                recordId: record.id,
                downloadLocal: settings.downloadLocal,
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

    async function downloadAforoPdf(record, settings = {}) {
        const rows = (record.mediciones || []).map(row => [row.lugar, row.caudalAforado, row.litrosSegundo, formatSampleCoordinates(row)]);
        return await createPdf(
            "Hoja de registro de aforos",
            `${record.zona} · ${formatDate(record.fecha)} · ID ${record.id}`,
            rows,
            ["Punto", "Caudal aforado", "Litros por segundo", "Coordenadas"],
            `Reporte_Aforo_${record.id}.pdf`,
            [["Condición del clima", record.condicionClima], ["Perfil", record.perfil], ["Responsable de campo", record.responsableCampo]],
            {
                orientation: "landscape",
                driveModule: "Aforos",
                recordId: record.id,
                downloadLocal: settings.downloadLocal,
                membreteFormat: "PNG",
                membreteWidth: 210,
                membreteAspectRatio: 699 / 115,
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
