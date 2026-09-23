/* =========================================================
   ASADA OROSI - AJUSTES DE FACTIBILIDAD

   - Fotografía con el mismo diseño de accidentes.
   - Botón Volver al inicio en el listado.
   - Mapa con búsqueda, GPS y marcador manual/arrastrable.

   No modifica style.css ni reemplaza la lógica que guarda
   los datos en factibilidad.js.
   ========================================================= */

(function () {

    "use strict";

    const DEFAULT_POSITION = [9.7965, -83.8538];
    const GPS_MAX_ACCURACY_MOBILE = 75;
    const GPS_MAX_ACCURACY_DESKTOP = 200;
    const GPS_EARLY_ACCURACY_MOBILE = 25;
    const GPS_MAX_WAIT_MS = 25000;

    const mapState = {
        map: null,
        marker: null,
        gpsPoint: null,
        accuracyCircle: null,
        fields: null,
        watchId: null,
        finishTimer: null,
        searchController: null,
        reverseRequestNumber: 0
    };


    function normalizeKey(value) {

        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/gi, "")
            .toLowerCase();
    }


    function escapeHtml(value) {

        return String(value ?? "").replace(
            /[&<>"']/g,
            character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            })[character]
        );
    }


    function findInput(root, aliases, labelPatterns) {

        const normalizedAliases =
            aliases.map(normalizeKey);

        const controls =
            root.querySelectorAll("input, select, textarea");

        for (const control of controls) {

            const keys = [
                normalizeKey(control.id),
                normalizeKey(control.name)
            ];

            if (
                keys.some(
                    key => normalizedAliases.includes(key)
                )
            ) {
                return control;
            }
        }

        for (const label of root.querySelectorAll("label")) {

            const text =
                normalizeKey(label.textContent);

            if (
                labelPatterns.some(pattern => pattern.test(text))
            ) {

                const control =
                    label.querySelector("input, select, textarea");

                if (control) {
                    return control;
                }
            }
        }

        return null;
    }


    function findCoordinateFields(root) {

        return {
            latitude: findInput(
                root,
                [
                    "factLatitude",
                    "factLatitud",
                    "factLatitudY",
                    "factGpsLatitude",
                    "LatitudY",
                    "Latitud"
                ],
                [/latitud/, /coordenaday/]
            ),

            longitude: findInput(
                root,
                [
                    "factLongitude",
                    "factLongitud",
                    "factLongitudX",
                    "factGpsLongitude",
                    "LongitudX",
                    "Longitud"
                ],
                [/longitud/, /coordenadax/]
            ),

            altitude: findInput(
                root,
                [
                    "factAltitude",
                    "factAltitud",
                    "Altitud"
                ],
                [/altitud/]
            ),

            accuracy: findInput(
                root,
                [
                    "factAccuracy",
                    "factGpsAccuracy",
                    "factPrecision",
                    "factPrecisionGPS",
                    "PrecisionGPS"
                ],
                [/precisiongps/, /precision/]
            )
        };
    }


    function fieldWrapper(input) {

        if (!input) {
            return null;
        }

        return (
            input.closest("label") ||
            input.closest(".fact-field") ||
            input.parentElement
        );
    }


    function setFieldValue(input, value) {

        if (!input) {
            return;
        }

        input.value = value;

        input.dispatchEvent(
            new Event("input", { bubbles: true })
        );

        input.dispatchEvent(
            new Event("change", { bubbles: true })
        );
    }


    function prepareCoordinateInput(input) {

        if (!input) {
            return;
        }

        if (input.tagName === "INPUT") {
            input.type = "text";
        }

        input.readOnly = true;
        input.placeholder = "Sin obtener";
    }


    /* =====================================================
       FOTOGRAFÍA
       ===================================================== */

    function improvePhotoUploader(root) {

        const input =
            root.querySelector("#factFrontImage");

        if (
            !input ||
            input.dataset.factUploadEnhanced === "true"
        ) {
            return;
        }

        const oldLabel =
            input.closest("label");

        if (!oldLabel) {
            return;
        }

        const uploadBox =
            document.createElement("label");

        uploadBox.className = "upload-box";

        const uploadTitle =
            document.createElement("span");

        uploadTitle.textContent =
            "Seleccionar fotografía";

        const uploadHelp =
            document.createElement("small");

        uploadHelp.textContent =
            "Puede seleccionar una fotografía del frente de la propiedad.";

        input.dataset.factUploadEnhanced = "true";

        /* Movemos el input original para conservar sus eventos. */
        uploadBox.append(input, uploadTitle, uploadHelp);
        oldLabel.replaceWith(uploadBox);

        const previewBox =
            root.querySelector("#factImagePreviewBox");

        const previewImage =
            root.querySelector("#factImagePreview");

        if (!previewBox || !previewImage) {
            return;
        }

        previewBox.classList.remove("fact-image-preview");
        previewBox.classList.add("photo-grid");

        const showPreview = () => {
            previewBox.hidden = false;
            previewBox.classList.remove("hidden");
        };

        const hidePreview = () => {
            previewBox.hidden = true;
            previewBox.classList.add("hidden");
        };

        if (
            previewImage.complete &&
            previewImage.naturalWidth > 0
        ) {
            showPreview();
        } else {
            hidePreview();
        }

        previewImage.addEventListener("load", showPreview);

        input.addEventListener("change", () => {
            if (!input.files || !input.files.length) {
                hidePreview();
            }
        });
    }


    /* =====================================================
       BOTÓN VOLVER AL INICIO
       ===================================================== */

    function addHomeButton(root) {

        if (
            root.dataset.view !== "list" ||
            root.querySelector("[data-fact-home-navigation]")
        ) {
            return;
        }

        const navigation =
            document.createElement("div");

        navigation.className = "nav-actions";
        navigation.dataset.factHomeNavigation = "true";

        navigation.innerHTML = `
            <a class="btn-back" href="index.html">
                Volver al inicio
            </a>
        `;

        root.prepend(navigation);
    }


    /* =====================================================
       MAPA - INTERFAZ
       ===================================================== */

    function createMapInterface(root) {

        if (
            root.dataset.view !== "form" ||
            root.querySelector("[data-fact-map-interface]")
        ) {
            return;
        }

        const fields =
            findCoordinateFields(root);

        if (!fields.latitude || !fields.longitude) {
            return;
        }

        /*
            Reutilizamos el botón y el estado que ya crea
            factibilidad.js. Así no existen identificadores
            duplicados ni dos capturas GPS diferentes.
        */

        let captureButton =
            root.querySelector("#factGpsButton");

        let captureStatus =
            root.querySelector("#factGpsStatus");

        const originalActionsRow =
            captureButton?.closest(".fact-actions-row") ||
            captureStatus?.closest(".fact-actions-row") ||
            null;

        Object.values(fields).forEach(prepareCoordinateInput);

        const wrappers = [
            fieldWrapper(fields.latitude),
            fieldWrapper(fields.longitude),
            fieldWrapper(fields.altitude),
            fieldWrapper(fields.accuracy)
        ].filter(
            (wrapper, index, collection) =>
                wrapper && collection.indexOf(wrapper) === index
        );

        if (!wrappers.length) {
            return;
        }

        const anchor = wrappers[0];
        const parent = anchor.parentElement;

        if (!parent) {
            return;
        }

        const layout =
            document.createElement("div");

        layout.className =
            "accident-geo-layout fact-map-enhanced";

        layout.dataset.factMapInterface = "true";
        layout.style.gridColumn = "1 / -1";

        layout.innerHTML = `
            <div
                class="accident-geo-coordinates"
                data-fact-coordinate-column>
            </div>

            <div class="accident-geo-map-area">
                <div class="accident-map-search-row">
                    <label class="accident-map-search-label">
                        Buscar lugar, dirección o referencia

                        <input
                            type="search"
                            id="factMapSearch"
                            autocomplete="off"
                            placeholder="Ejemplo: Escuela de Orosi">
                    </label>

                    <button
                        type="button"
                        class="btn secondary"
                        id="factMapSearchButton">
                        Buscar
                    </button>
                </div>

                <div
                    id="factMapSearchResults"
                    class="accident-search-results hidden">
                </div>

                <div data-fact-gps-status-slot></div>

                <div class="accident-map-large">
                    <div
                        id="accidentInteractiveMap"
                        aria-label="Mapa interactivo para seleccionar la ubicación de la inspección">
                    </div>
                </div>

                <p class="note accident-map-help">
                    También puede hacer clic en el mapa y arrastrar el marcador
                    para ajustar manualmente la ubicación.
                </p>
            </div>
        `;

        parent.insertBefore(layout, anchor);

        const searchRow =
            layout.querySelector(".accident-map-search-row");

        if (!captureButton) {
            captureButton = document.createElement("button");
            captureButton.type = "button";
            captureButton.id = "factGpsButton";
            captureButton.dataset.factFallbackGps = "true";
        }

        captureButton.textContent =
            "Capturar ubicación actual";

        captureButton.classList.remove("fact-secondary-button");
        captureButton.classList.add("btn", "secondary");

        searchRow.append(captureButton);

        if (!captureStatus) {
            captureStatus = document.createElement("p");
            captureStatus.id = "factGpsStatus";
            captureStatus.setAttribute("aria-live", "polite");
        }

        captureStatus.classList.remove("fact-inline-status");
        captureStatus.classList.add("note", "gps-status-box");

        if (!captureStatus.textContent.trim()) {
            captureStatus.textContent =
                "Puede buscar una referencia, capturar su ubicación actual " +
                "o seleccionar manualmente un punto en el mapa.";
        }

        layout
            .querySelector("[data-fact-gps-status-slot]")
            .replaceWith(captureStatus);

        if (
            originalActionsRow &&
            originalActionsRow.children.length === 0
        ) {
            originalActionsRow.remove();
        }

        const coordinateColumn =
            layout.querySelector("[data-fact-coordinate-column]");

        wrappers.forEach(
            wrapper => coordinateColumn.append(wrapper)
        );

        mapState.fields = fields;

        installMapEvents();
        initializeMap();
    }


    function leaflet() {

        return window.ASADA_LEAFLET || window.L || null;
    }


    function setGpsStatus(message, type) {

        const status =
            document.getElementById("factGpsStatus");

        if (!status) {
            return;
        }

        status.textContent = message;

        status.classList.remove(
            "gps-searching",
            "gps-ok",
            "gps-warning",
            "gps-error"
        );

        if (type) {
            status.classList.add(type);
        }
    }


    function createMarkerIcon() {

        const Leaflet = leaflet();

        if (!Leaflet) {
            return null;
        }

        const svg = `
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="62"
                viewBox="0 0 48 62">
                <path
                    d="M24 2 C12.4 2 3 11.4 3 23 c0 16.5 21 36 21 36 s21-19.5 21-36 C45 11.4 35.6 2 24 2z"
                    fill="#20cdb0"
                    stroke="#ffffff"
                    stroke-width="3"/>
                <circle
                    cx="24"
                    cy="23"
                    r="8"
                    fill="#123d36"
                    stroke="#ffffff"
                    stroke-width="2"/>
            </svg>
        `;

        return Leaflet.icon({
            iconUrl:
                "data:image/svg+xml;charset=UTF-8," +
                encodeURIComponent(svg),
            iconSize: [48, 62],
            iconAnchor: [24, 59],
            popupAnchor: [0, -52]
        });
    }


    function initializeMap() {

        const Leaflet = leaflet();
        const container =
            document.getElementById("accidentInteractiveMap");

        if (!Leaflet || !container || mapState.map) {

            if (!Leaflet && container) {
                setGpsStatus(
                    "No fue posible cargar el mapa. Revise la conexión y vuelva a abrir la página.",
                    "gps-error"
                );
            }

            return;
        }

        mapState.map =
            Leaflet.map(container, {
                zoomControl: true,
                attributionControl: true
            }).setView(DEFAULT_POSITION, 14);

        Leaflet.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution: "&copy; OpenStreetMap"
            }
        ).addTo(mapState.map);

        mapState.map.on("click", event => {

            clearAccuracyCircle();

            setMapPoint(
                event.latlng.lat,
                event.latlng.lng,
                {
                    altitude: "",
                    accuracy: "",
                    centerMap: false,
                    reverse: true
                }
            );

            setGpsStatus(
                "Ubicación seleccionada manualmente en el mapa.",
                "gps-ok"
            );
        });

        refreshExistingPointOnMap();

        window.setTimeout(
            () => mapState.map?.invalidateSize(),
            200
        );
    }


    function refreshExistingPointOnMap() {

        const fields = mapState.fields;
        const existingLatitude = Number(fields?.latitude?.value);
        const existingLongitude = Number(fields?.longitude?.value);

        if (
            !Number.isFinite(existingLatitude) ||
            !Number.isFinite(existingLongitude) ||
            existingLatitude === 0 ||
            existingLongitude === 0
        ) {
            return false;
        }

        return setMapPoint(
            existingLatitude,
            existingLongitude,
            {
                altitude: fields.altitude?.value || "",
                accuracy: fields.accuracy?.value || "",
                centerMap: true,
                zoom: 17
            }
        );
    }

    window.ASADA_FACTIBILIDAD_MAP_REFRESH = refreshExistingPointOnMap;


    function clearAccuracyCircle() {

        if (mapState.accuracyCircle && mapState.map) {
            mapState.map.removeLayer(mapState.accuracyCircle);
        }

        mapState.accuracyCircle = null;
    }


    function drawAccuracyCircle(latitude, longitude, accuracy) {

        const Leaflet = leaflet();

        clearAccuracyCircle();

        const value = Number(accuracy);

        if (
            !Leaflet ||
            !mapState.map ||
            !Number.isFinite(value) ||
            value <= 0
        ) {
            return;
        }

        mapState.accuracyCircle =
            Leaflet.circle(
                [Number(latitude), Number(longitude)],
                {
                    radius: value,
                    weight: 2,
                    opacity: 0.65,
                    fillOpacity: 0.10
                }
            ).addTo(mapState.map);

        mapState.accuracyCircle.bringToBack?.();
    }


    function drawGpsPoint(latitude, longitude, accepted) {

        const Leaflet = leaflet();

        if (!Leaflet || !mapState.map) {
            return;
        }

        const point = [Number(latitude), Number(longitude)];
        const fillColor = accepted ? "#20cdb0" : "#f59e0b";

        if (!point.every(Number.isFinite)) {
            return;
        }

        if (mapState.gpsPoint) {
            mapState.gpsPoint
                .setLatLng(point)
                .setStyle({
                    color: "#ffffff",
                    fillColor: fillColor,
                    fillOpacity: 1,
                    opacity: 1,
                    weight: 3
                });
        } else {
            mapState.gpsPoint =
                Leaflet.circleMarker(point, {
                    radius: 10,
                    color: "#ffffff",
                    weight: 3,
                    fillColor: fillColor,
                    fillOpacity: 1
                }).addTo(mapState.map);
        }

        mapState.gpsPoint.bindTooltip(
            accepted ? "Ubicación aceptada" : "Ubicación aproximada",
            { direction: "top" }
        );

        mapState.gpsPoint.bringToFront?.();
    }


    function drawMarker(latitude, longitude) {

        const Leaflet = leaflet();

        if (!Leaflet || !mapState.map) {
            return;
        }

        const point = [Number(latitude), Number(longitude)];

        if (mapState.marker) {
            mapState.marker.setLatLng(point);
            return;
        }

        const options = {
            draggable: true,
            keyboard: true,
            title: "Ubicación de la inspección de factibilidad"
        };

        const icon = createMarkerIcon();

        if (icon) {
            options.icon = icon;
        }

        mapState.marker =
            Leaflet.marker(point, options).addTo(mapState.map);

        mapState.marker.bindPopup(
            "<strong>Ubicación de la inspección</strong><br>Puede arrastrar el marcador para ajustarla."
        );

        mapState.marker.on("dragend", () => {

            const position =
                mapState.marker.getLatLng();

            clearAccuracyCircle();

            setMapPoint(position.lat, position.lng, {
                altitude: "",
                accuracy: "",
                centerMap: false,
                reverse: true
            });

            setGpsStatus(
                "Ubicación ajustada manualmente.",
                "gps-ok"
            );
        });
    }


    function setMapPoint(latitude, longitude, options = {}) {

        const lat = Number(latitude);
        const lng = Number(longitude);

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lng) ||
            !mapState.fields
        ) {
            return false;
        }

        setFieldValue(
            mapState.fields.latitude,
            lat.toFixed(7)
        );

        setFieldValue(
            mapState.fields.longitude,
            lng.toFixed(7)
        );

        if (options.altitude !== undefined) {
            setFieldValue(
                mapState.fields.altitude,
                options.altitude === null || options.altitude === ""
                    ? ""
                    : String(options.altitude)
            );
        }

        if (options.accuracy !== undefined) {
            setFieldValue(
                mapState.fields.accuracy,
                options.accuracy === null || options.accuracy === ""
                    ? ""
                    : String(options.accuracy)
            );
        }

        drawGpsPoint(lat, lng, true);
        drawMarker(lat, lng);

        if (mapState.map && options.centerMap !== false) {
            mapState.map.setView(
                [lat, lng],
                options.zoom || 17
            );
        }

        if (options.reverse) {
            reverseGeocode(lat, lng);
        }

        return true;
    }


    /* =====================================================
       MAPA - BÚSQUEDA Y DIRECCIÓN
       ===================================================== */

    async function reverseGeocode(latitude, longitude) {

        const requestNumber =
            ++mapState.reverseRequestNumber;

        try {
            const url =
                "https://nominatim.openstreetmap.org/reverse" +
                "?format=jsonv2" +
                "&lat=" + encodeURIComponent(latitude) +
                "&lon=" + encodeURIComponent(longitude) +
                "&accept-language=es";

            const response = await fetch(url);

            if (!response.ok) {
                return;
            }

            const data = await response.json();

            if (
                requestNumber === mapState.reverseRequestNumber &&
                data?.display_name
            ) {
                const input =
                    document.getElementById("factMapSearch");

                if (input) {
                    input.value = data.display_name;
                }
            }
        } catch (error) {
            console.warn(
                "No fue posible obtener la referencia de la ubicación.",
                error
            );
        }
    }


    async function searchLocation() {

        const input =
            document.getElementById("factMapSearch");

        const resultsBox =
            document.getElementById("factMapSearchResults");

        const query = input?.value.trim() || "";

        if (!query) {
            alert("Escriba un lugar o dirección para buscar.");
            return;
        }

        resultsBox.classList.remove("hidden");
        resultsBox.innerHTML =
            '<div class="note">Buscando ubicación...</div>';

        mapState.searchController?.abort();
        mapState.searchController = new AbortController();

        try {
            const url =
                "https://nominatim.openstreetmap.org/search" +
                "?format=jsonv2" +
                "&limit=5" +
                "&countrycodes=cr" +
                "&accept-language=es" +
                "&q=" + encodeURIComponent(query);

            const response = await fetch(url, {
                signal: mapState.searchController.signal
            });

            if (!response.ok) {
                throw new Error("No fue posible buscar la ubicación.");
            }

            const results = await response.json();

            if (!Array.isArray(results) || !results.length) {
                resultsBox.innerHTML =
                    '<div class="accident-search-empty">No se encontraron resultados.</div>';
                return;
            }

            resultsBox.innerHTML = results.map(
                (result, index) => `
                    <button
                        type="button"
                        class="accident-search-result"
                        data-fact-result-index="${index}">
                        ${escapeHtml(result.display_name)}
                    </button>
                `
            ).join("");

            resultsBox
                .querySelectorAll("[data-fact-result-index]")
                .forEach(button => {

                    button.addEventListener("click", () => {

                        const result =
                            results[
                                Number(button.dataset.factResultIndex)
                            ];

                        if (!result) {
                            return;
                        }

                        input.value = result.display_name || query;

                        clearAccuracyCircle();

                        setMapPoint(result.lat, result.lon, {
                            altitude: "",
                            accuracy: "",
                            centerMap: true,
                            zoom: 17
                        });

                        setGpsStatus(
                            "Ubicación seleccionada mediante búsqueda.",
                            "gps-ok"
                        );

                        resultsBox.classList.add("hidden");
                    });
                });
        } catch (error) {

            if (error.name === "AbortError") {
                return;
            }

            console.error("Error buscando ubicación.", error);

            resultsBox.innerHTML =
                '<div class="accident-search-empty">No fue posible realizar la búsqueda.</div>';
        }
    }


    /* =====================================================
       MAPA - GPS
       ===================================================== */

    function isMobileGpsDevice() {

        if (
            navigator.userAgentData &&
            typeof navigator.userAgentData.mobile === "boolean"
        ) {
            return navigator.userAgentData.mobile;
        }

        return /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i
            .test(String(navigator.userAgent || ""));
    }


    function formatAccuracy(value) {

        const accuracy = Number(value);

        if (!Number.isFinite(accuracy)) {
            return "desconocida";
        }

        if (accuracy >= 1000) {
            return (accuracy / 1000).toFixed(1) + " km";
        }

        return Math.round(accuracy) + " m";
    }


    function stopGpsWatch() {

        if (
            mapState.watchId !== null &&
            navigator.geolocation
        ) {
            navigator.geolocation.clearWatch(mapState.watchId);
        }

        mapState.watchId = null;

        if (mapState.finishTimer) {
            window.clearTimeout(mapState.finishTimer);
        }

        mapState.finishTimer = null;
    }


    function showGpsPreview(position) {

        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);
        const accuracy = Number(position?.coords?.accuracy);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            return;
        }

        drawGpsPoint(latitude, longitude, false);
        drawAccuracyCircle(latitude, longitude, accuracy);

        let zoom = 17;

        if (accuracy > 1000) {
            zoom = 13;
        } else if (accuracy > 500) {
            zoom = 14;
        } else if (accuracy > 200) {
            zoom = 15;
        } else if (accuracy > 75) {
            zoom = 16;
        }

        mapState.map?.setView([latitude, longitude], zoom);
    }


    function getMyLocation() {

        if (!navigator.geolocation) {
            setGpsStatus(
                "Este dispositivo no permite obtener ubicación.",
                "gps-error"
            );
            return;
        }

        stopGpsWatch();

        const isMobile = isMobileGpsDevice();
        const maximumAllowed = isMobile
            ? GPS_MAX_ACCURACY_MOBILE
            : GPS_MAX_ACCURACY_DESKTOP;
        const earlyLimit = isMobile
            ? GPS_EARLY_ACCURACY_MOBILE
            : GPS_MAX_ACCURACY_DESKTOP;
        const deviceLabel = isMobile
            ? "celular"
            : "computadora";

        setGpsStatus(
            "Buscando su ubicación desde la " +
            deviceLabel + "...",
            "gps-searching"
        );

        let bestPosition = null;
        let finished = false;

        const finishSearch = () => {

            if (finished) {
                return;
            }

            finished = true;
            stopGpsWatch();

            if (!bestPosition?.coords) {
                setGpsStatus(
                    "No fue posible obtener su ubicación.",
                    "gps-error"
                );
                return;
            }

            const accuracy =
                Number(bestPosition.coords.accuracy);

            if (
                !Number.isFinite(accuracy) ||
                accuracy > maximumAllowed
            ) {
                showGpsPreview(bestPosition);

                setGpsStatus(
                    "La ubicación obtenida tiene una precisión de " +
                    formatAccuracy(accuracy) +
                    ". El máximo permitido en este dispositivo es de " +
                    maximumAllowed +
                    " m. Puede volver a intentar o colocar el marcador manualmente.",
                    "gps-warning"
                );
                return;
            }

            const latitude =
                Number(bestPosition.coords.latitude);
            const longitude =
                Number(bestPosition.coords.longitude);
            const altitude =
                Number.isFinite(bestPosition.coords.altitude)
                    ? Number(bestPosition.coords.altitude).toFixed(1)
                    : "No disponible";

            setMapPoint(latitude, longitude, {
                altitude: altitude,
                accuracy: accuracy.toFixed(1),
                centerMap: true,
                zoom:
                    accuracy <= 25
                        ? 18
                        : accuracy <= 75
                            ? 17
                            : 16,
                reverse: true
            });

            drawAccuracyCircle(latitude, longitude, accuracy);

            setGpsStatus(
                "Ubicación aceptada correctamente. Precisión aproximada: " +
                formatAccuracy(accuracy) + ".",
                "gps-ok"
            );
        };

        mapState.watchId =
            navigator.geolocation.watchPosition(
                position => {

                    if (finished) {
                        return;
                    }

                    const accuracy =
                        Number(position.coords.accuracy);

                    showGpsPreview(position);

                    if (
                        !bestPosition ||
                        accuracy < Number(bestPosition.coords.accuracy)
                    ) {
                        bestPosition = position;
                    }

                    setGpsStatus(
                        "Lectura actual: " +
                        formatAccuracy(accuracy) +
                        ". Máximo permitido en " +
                        deviceLabel + ": " +
                        maximumAllowed + " m.",
                        "gps-searching"
                    );

                    if (
                        Number.isFinite(accuracy) &&
                        accuracy <= earlyLimit
                    ) {
                        bestPosition = position;
                        finishSearch();
                    }
                },
                error => {

                    if (finished) {
                        return;
                    }

                    finished = true;
                    stopGpsWatch();

                    const messages = {
                        1: "El navegador no tiene permiso para utilizar su ubicación.",
                        2: "El dispositivo no pudo determinar una ubicación.",
                        3: "La búsqueda de ubicación tardó demasiado."
                    };

                    setGpsStatus(
                        messages[error?.code] ||
                        "No fue posible obtener la ubicación.",
                        "gps-error"
                    );
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 30000
                }
            );

        mapState.finishTimer =
            window.setTimeout(finishSearch, GPS_MAX_WAIT_MS);
    }


    function installMapEvents() {

        const captureButton =
            document.getElementById("factGpsButton");

        document
            .getElementById("factMapSearchButton")
            ?.addEventListener("click", searchLocation);

        if (
            captureButton?.dataset.factFallbackGps === "true"
        ) {
            captureButton.addEventListener("click", getMyLocation);
        }

        document
            .getElementById("factMapSearch")
            ?.addEventListener("keydown", event => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    searchLocation();
                }
            });
    }


    function showCapturedLocationOnMap(event) {

        const detail =
            event.detail || {};

        const latitude =
            Number(detail.latitude);

        const longitude =
            Number(detail.longitude);

        const accuracy =
            Number(detail.accuracy);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            return;
        }

        setMapPoint(latitude, longitude, {
            altitude:
                Number.isFinite(Number(detail.altitude))
                    ? Number(detail.altitude)
                    : "",
            accuracy:
                Number.isFinite(accuracy)
                    ? accuracy.toFixed(2)
                    : "",
            centerMap: true,
            zoom:
                Number.isFinite(accuracy) && accuracy <= 25
                    ? 18
                    : Number.isFinite(accuracy) && accuracy <= 75
                        ? 17
                        : 16,
            reverse: true
        });

        if (Number.isFinite(accuracy)) {
            drawAccuracyCircle(latitude, longitude, accuracy);
        }

        setGpsStatus(
            Number.isFinite(accuracy)
                ? "Ubicación aceptada correctamente. Precisión aproximada: " +
                    Math.round(accuracy) + " m."
                : "Ubicación capturada correctamente.",
            "gps-ok"
        );
    }


    function resetDetachedMap() {

        if (
            !mapState.map ||
            document.body.contains(
                mapState.map.getContainer()
            )
        ) {
            return;
        }

        stopGpsWatch();

        try {
            mapState.map.remove();
        } catch (error) {
            console.warn(
                "No fue posible liberar el mapa anterior.",
                error
            );
        }

        mapState.map = null;
        mapState.marker = null;
        mapState.gpsPoint = null;
        mapState.accuracyCircle = null;
        mapState.fields = null;
    }


    /* =====================================================
       INICIO
       ===================================================== */

    function applyAdjustments() {

        const root =
            document.getElementById("factibilidadApp");

        if (!root) {
            return;
        }

        resetDetachedMap();
        improvePhotoUploader(root);
        addHomeButton(root);
        createMapInterface(root);
    }


    function startAdjustments() {

        const root =
            document.getElementById("factibilidadApp");

        if (!root) {
            return;
        }

        applyAdjustments();

        const observer =
            new MutationObserver(applyAdjustments);

        observer.observe(root, {
            childList: true,
            subtree: true
        });

        document.addEventListener(
            "factibilidad:gps-captured",
            showCapturedLocationOnMap
        );

        window.addEventListener(
            "beforeunload",
            stopGpsWatch,
            { once: true }
        );
    }


    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            startAdjustments,
            { once: true }
        );
    } else {
        startAdjustments();
    }

})();

/* =========================================================
   ASADA OROSI
   CORRECCIÓN DE BOTÓN GPS DE FACTIBILIDAD

   OBJETIVO:

   - Dejar UN SOLO botón de ubicación.
   - Conservar el botón original factGpsButton.
   - Moverlo al lado de Buscar.
   - Cambiar el texto a:
     "Capturar ubicación actual".
   - Eliminar botones duplicados como:
     "Mi ubicación".
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       NORMALIZAR TEXTO
       ===================================================== */

    function normalizarTextoBoton(
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
                /\s+/g,
                " "
            )
            .trim()
            .toLowerCase();

    }



    /* =====================================================
       SABER SI ES UN BOTÓN DE UBICACIÓN
       ===================================================== */

    function esBotonUbicacion(
        button
    ) {

        if (
            !button
        ) {

            return false;

        }


        const text =
            normalizarTextoBoton(
                button.textContent
            );


        const id =
            String(
                button.id ||
                ""
            )
                .trim()
                .toLowerCase();


        /*
            IDs conocidos.
        */

        if (
            id === "factgpsbutton" ||
            id === "factmapgpsbutton" ||
            id === "factlocationbutton" ||
            id === "factcurrentlocationbutton"
        ) {

            return true;

        }


        /*
            Textos conocidos.
        */

        return (

            text ===
            "mi ubicacion" ||

            text ===
            "capturar ubicacion actual" ||

            text ===
            "obtener ubicacion actual" ||

            text ===
            "actualizar ubicacion"

        );

    }



    /* =====================================================
       CORREGIR BOTONES
       ===================================================== */

    function corregirBotonUbicacion() {

        const root =
            document.getElementById(
                "factibilidadApp"
            );


        if (
            !root
        ) {

            return;

        }


        /*
            Buscamos la fila que contiene:

            campo de búsqueda
            Buscar
            botón GPS
        */

        const searchRow =
            root.querySelector(
                ".accident-map-search-row"
            );


        if (
            !searchRow
        ) {

            return;

        }



        /* =================================================
           BOTÓN ORIGINAL
           ================================================= */

        let mainButton =
            root.querySelector(
                "#factGpsButton"
            );


        /*
            Si por alguna versión anterior no encontramos
            el ID, buscamos el botón por su texto.
        */

        if (
            !mainButton
        ) {

            const buttons =
                Array.from(
                    root.querySelectorAll(
                        "button"
                    )
                );


            mainButton =
                buttons.find(
                    esBotonUbicacion
                ) ||
                null;

        }


        if (
            !mainButton
        ) {

            return;

        }



        /* =================================================
           TEXTO CORRECTO
           ================================================= */

        mainButton.id =
            "factGpsButton";


        mainButton.type =
            "button";


        mainButton.textContent =
            "Capturar ubicación actual";


        /*
            Usamos las mismas clases de los botones
            que están al lado del buscador.
        */

        mainButton.classList.remove(
            "fact-secondary-button"
        );


        mainButton.classList.add(
            "btn",
            "secondary"
        );



        /* =================================================
           MOVER AL LADO DE BUSCAR
           ================================================= */

        /*
            Solo lo movemos si todavía no está
            en la posición correcta.

            Así evitamos un ciclo infinito con
            MutationObserver.
        */

        if (
            mainButton.parentElement !==
            searchRow ||

            mainButton !==
            searchRow.lastElementChild
        ) {

            searchRow.appendChild(
                mainButton
            );

        }



        /* =================================================
           ELIMINAR DUPLICADOS
           ================================================= */

        const allButtons =
            Array.from(
                root.querySelectorAll(
                    "button"
                )
            );


        allButtons.forEach(
            function (
                button
            ) {

                if (
                    button ===
                    mainButton
                ) {

                    return;

                }


                if (
                    esBotonUbicacion(
                        button
                    )
                ) {

                    button.remove();

                }

            }
        );



        /* =================================================
           QUITAR FILA VIEJA VACÍA
           ================================================= */

        const oldActionRows =
            root.querySelectorAll(
                ".fact-actions-row"
            );


        oldActionRows.forEach(
            function (
                row
            ) {

                /*
                    NO eliminamos las filas que contienen
                    botones normales del formulario,
                    como Guardar o Cancelar.
                */

                if (
                    row.contains(
                        mainButton
                    )
                ) {

                    return;

                }


                const hasButton =
                    row.querySelector(
                        "button, a"
                    );


                const visibleText =
                    String(
                        row.textContent ||
                        ""
                    ).trim();


                /*
                    Si quedó la antigua fila del GPS
                    totalmente vacía, desaparece.
                */

                if (
                    !hasButton &&
                    !visibleText
                ) {

                    row.remove();

                }

            }
        );

    }



    /* =====================================================
       EJECUTAR CUANDO CAMBIA LA PÁGINA
       ===================================================== */

    let correctionTimer =
        null;


    function programarCorreccion() {

        if (
            correctionTimer
        ) {

            window.clearTimeout(
                correctionTimer
            );

        }


        correctionTimer =
            window.setTimeout(
                function () {

                    correctionTimer =
                        null;


                    corregirBotonUbicacion();

                },
                20
            );

    }



    /* =====================================================
       INICIAR
       ===================================================== */

    function iniciarCorreccionUbicacion() {

        const root =
            document.getElementById(
                "factibilidadApp"
            );


        if (
            !root
        ) {

            return;

        }


        /*
            Primera corrección.
        */

        programarCorreccion();



        /*
            Factibilidad se dibuja dinámicamente.

            Por eso observamos cambios para aplicar
            nuevamente la corrección cuando el formulario
            termine de construirse.
        */

        const observer =
            new MutationObserver(
                programarCorreccion
            );


        observer.observe(
            root,
            {

                childList:
                    true,

                subtree:
                    true

            }
        );

    }



    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(

            "DOMContentLoaded",

            iniciarCorreccionUbicacion,

            {
                once:
                    true
            }

        );


    } else {

        iniciarCorreccionUbicacion();

    }


})();
