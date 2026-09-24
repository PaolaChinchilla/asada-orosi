/* =========================================================
   ASADA OROSI - CLORO Y AFOROS
   Formularios, listados, detalles y descarga PDF.
   ========================================================= */

(function () {
    "use strict";

    const CLORO_SITES = {
        "Orosi": [
            "Escuela Jucó- Jalisco", "Murray", "Orokay", "Bodega Murray",
            "Koreanos", "Chía Coto", "Cementerio", "Apart. Banco", "Ñajo"
        ],
        "Alto de Araya": [
            "Casa Martín Gómez", "Tanque Azul", "Tanque Lelo", "Pulpería Alto de Araya"
        ]
    };

    const AFORO_SITES = {
        "Orosi": [
            "Conejera #1", "Conejera #2", "Abraham", "Truchas", "Ceci Murray",
            "Alto Loaiza (Ismael Arroyo)", "Alto Loaiza (Rosquilla)", "La Laja #1", "La Laja #2"
        ],
        "Alto de Araya": ["F6 La Roca", "F5", "Evelio Araya", "La Joya"]
    };

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

    function setMessage(root, text, type) {
        if (!root) {
            return;
        }
        root.textContent = text || "";
        root.className = "module-status" + (type ? " is-" + type : "");
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
        form.addEventListener("input", () => syncCloroHidden(form));
        form.querySelector("[data-get-gps]")?.addEventListener("click", () => fillCoordinates(form));
        buildCloroRows(form);
        if (!form.querySelector("[name=fechaMuestreo]").value) {
            form.querySelector("[name=fechaMuestreo]").value = dateInputValue();
        }
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
                perfil: currentProfile(),
                latitud: valueFromForm(form, "[name=latitud]"),
                longitud: valueFromForm(form, "[name=longitud]"),
                altitud: valueFromForm(form, "[name=altitud]"),
                precisionGps: valueFromForm(form, "[name=precisionGps]"),
                muestras: syncCloroHidden(form),
                responsableCampo: valueFromForm(form, "[name=responsableCampo]"),
                ingresadoPor: currentProfile()
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
            form.querySelector("[name=muestrasJson]").value = JSON.stringify(record.muestras || []);
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
        form.addEventListener("input", () => syncAforoHidden(form));
        buildAforoRows(form);
        if (!form.querySelector("[name=fecha]").value) {
            form.querySelector("[name=fecha]").value = dateInputValue();
        }
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
                perfil: currentProfile(),
                mediciones: syncAforoHidden(form),
                responsableCampo: valueFromForm(form, "[name=responsableCampo]"),
                ingresadoPor: currentProfile()
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

    function createMap(record) {
        const mapRoot = document.getElementById("cloroMap");
        if (!mapRoot || !window.L) {
            return;
        }
        const lat = Number(record.latitud);
        const lng = Number(record.longitud);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            mapRoot.innerHTML = "<p class=\"note\">No hay coordenadas válidas para mostrar el mapa.</p>";
            return;
        }
        const map = window.L.map(mapRoot).setView([lat, lng], 16);
        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "© OpenStreetMap"
        }).addTo(map);
        window.L.marker([lat, lng]).addTo(map).bindPopup("Punto del muestreo").openPopup();
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
            <section class="detail-card module-detail-card"><h2>Ubicación</h2><div id="cloroMap" class="module-map"></div></section>
            <div class="detail-actions module-actions"><button type="button" class="btn primary" data-download-cloro>Descargar PDF</button><a class="btn secondary" href="crear-cloro.html?id=${encodeURIComponent(record.id)}">Editar</a><a class="btn secondary" href="cloros.html">Volver al listado</a></div>`;
        createMap(record);
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
            <section class="detail-card module-detail-card"><h2>Puntos aforados</h2>${detailTable(measurements.map(row => [row.lugar, row.caudalAforado, row.litrosSegundo]), ["Punto", "Caudal aforado", "Litros por segundo"])}</section>
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

    async function createPdf(title, subtitle, rows, tableHeaders, filename, coordinateRows) {
        if (!window.jspdf?.jsPDF) {
            throw new Error("No se pudo cargar el generador de PDF.");
        }
        const doc = new window.jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "letter", compress: true });
        const membrete = await imageData("img/membrete-asada.png");
        if (membrete) {
            doc.addImage(membrete, "PNG", 16, 8, 178, 32.7);
        } else {
            const logo = await imageData("img/asada.png");
            if (logo) {
                doc.addImage(logo, "PNG", 18, 12, 18, 18);
            }
            doc.setTextColor(19, 128, 112);
            doc.setFontSize(10);
            doc.setFont(undefined, "bold");
            doc.text("ASADA OROSI", 42, 18);
        }
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
            [["Condición del clima", record.condicionClima], ["Perfil", record.perfil], ["Responsable de campo", record.responsableCampo]]
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
