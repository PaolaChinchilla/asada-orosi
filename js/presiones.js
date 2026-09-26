/* =========================================================
   ASADA OROSI - REGISTRO DE PRESIONES
   Formulario, listado, detalle y reporte PDF.
   ========================================================= */

(function () {
    "use strict";

    const PRESSURE_POINTS = [
        { ruta: "1", lugar: "BODEGA S. CLARA" },
        { ruta: "1", lugar: "BODEGA JALISCO" },
        { ruta: "2", lugar: "FRENTE CNP" },
        { ruta: "2", lugar: "IGLESIA EVAN PALOMO" },
        { ruta: "3", lugar: "CASA CHOKES" },
        { ruta: "4", lugar: "ECOVIVIENDA" },
        { ruta: "5", lugar: "FUENTE MURRAY" },
        { ruta: "5", lugar: "BODEGA MURRAY" },
        { ruta: "6", lugar: "CAPILLA DIVINO NIÑO" },
        { ruta: "7", lugar: "OROKAY 2" },
        { ruta: "7", lugar: "OROKAY 1" },
        { ruta: "8", lugar: "CHACA" },
        { ruta: "8", lugar: "OFICINA ASADA" },
        { ruta: "9", lugar: "ÑAJO" },
        { ruta: "9", lugar: "APARTAMENTOS BANCO" },
        { ruta: "10", lugar: "CHIA COTO" },
        { ruta: "10", lugar: "CEMENTERIO" },
        { ruta: "10", lugar: "CASA DE BONILLA" },
        { ruta: "11", lugar: "CASA MARTIN" },
        { ruta: "11", lugar: "CASA BERNARDO GUILLEN" },
        { ruta: "11", lugar: "CASA LEIDY" },
        { ruta: "11", lugar: "PULPERIA ALTO ARAYA" }
    ];

    const MCA_FACTOR = 1.42;
    let pdfLibrariesPromise = null;
    let pendingSavedRecord = null;

    function clean(value) {
        return String(value === undefined || value === null ? "" : value).trim();
    }

    function escapeHtml(value) {
        return clean(value).replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[character]));
    }

    function parseJson(value, fallback) {
        try {
            const parsed = typeof value === "string" ? JSON.parse(value || "") : value;
            return parsed === null || parsed === undefined ? fallback : parsed;
        } catch (error) {
            return fallback;
        }
    }

    function responseData(response) {
        return response && response.data ? response.data : (response || {});
    }

    function api(action, values) {
        if (typeof window.callApi !== "function") {
            return Promise.reject(new Error("No se encontró la conexión con el sistema."));
        }
        return window.callApi(action, values || {});
    }

    function waitForAuth() {
        return window.ASADA_AUTH_READY && typeof window.ASADA_AUTH_READY.then === "function"
            ? window.ASADA_AUTH_READY
            : Promise.resolve(window.ASADA_USER || null);
    }

    function localDateTimeValue(value) {
        const date = value ? new Date(value) : new Date();
        if (!Number.isFinite(date.getTime())) return "";
        const pad = number => String(number).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function formatDate(value) {
        const date = new Date(value || 0);
        return Number.isFinite(date.getTime())
            ? new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short" }).format(date)
            : "Sin fecha";
    }

    function currentUserName() {
        const user = window.ASADA_USER || {};
        return clean(user.name) || clean(user.email) || "Usuario";
    }

    function setMessage(node, message, type) {
        if (!node) return;
        node.textContent = message || "";
        node.className = "module-status" + (type ? ` is-${type}` : "");
    }

    function getQueryId() {
        return clean(new URLSearchParams(window.location.search).get("id")).toUpperCase();
    }

    function timeNow() {
        const date = new Date();
        return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    }

    function numberText(value, digits) {
        const number = value === "" || value === null || value === undefined ? NaN : Number(value);
        return Number.isFinite(number) ? number.toFixed(digits) : "";
    }

    function formatCoordinates(row) {
        const lat = numberText(row?.latitud, 7);
        const lng = numberText(row?.longitud, 7);
        if (!lat || !lng) return "Sin coordenadas";
        const alt = numberText(row?.altitud, 2);
        const accuracy = numberText(row?.precisionGps, 2);
        return `Latitud: ${lat} · Longitud: ${lng} · Altitud: ${alt || "No disponible"} m · Precisión: ${accuracy || "No disponible"} m`;
    }

    function buildRows(form, existingRows) {
        const tbody = form.querySelector("[data-presion-rows]");
        if (!tbody) return;
        const saved = Array.isArray(existingRows)
            ? existingRows
            : parseJson(form.querySelector('[name="medicionesJson"]')?.value, []);
        const savedByPlace = new Map(saved.map(row => [clean(row.lugar).toLocaleLowerCase("es-CR"), row]));

        tbody.innerHTML = PRESSURE_POINTS.map((point, index) => {
            const row = savedByPlace.get(point.lugar.toLocaleLowerCase("es-CR")) || {};
            const psi = clean(row.presionPsi);
            const mca = psi === "" || !Number.isFinite(Number(psi)) ? "" : Number((Number(psi) * MCA_FACTOR).toFixed(2)).toFixed(2);
            return `
                <tr>
                    <th scope="row">Ruta ${escapeHtml(point.ruta)}</th>
                    <td>${escapeHtml(point.lugar)}</td>
                    <td><input type="number" min="0" max="500" step="0.01" inputmode="decimal" name="psi_${index}" aria-label="Presión PSI de ${escapeHtml(point.lugar)}" required value="${escapeHtml(psi)}"></td>
                    <td><output class="pressure-mca-output" data-pressure-mca="${index}">${escapeHtml(mca || "—")}</output></td>
                    <td><input type="time" name="hora_${index}" aria-label="Hora de ${escapeHtml(point.lugar)}" required value="${escapeHtml(clean(row.hora) || timeNow())}"></td>
                    <td class="sample-coordinate-cell pressure-coordinate-cell">
                        <input type="hidden" name="latitud_${index}" value="${escapeHtml(clean(row.latitud))}">
                        <input type="hidden" name="longitud_${index}" value="${escapeHtml(clean(row.longitud))}">
                        <input type="hidden" name="altitud_${index}" value="${escapeHtml(clean(row.altitud))}">
                        <input type="hidden" name="precisionGps_${index}" value="${escapeHtml(clean(row.precisionGps))}">
                        <div class="sample-coordinate-actions">
                            <button type="button" class="btn secondary sample-coordinate-button" data-presion-gps-index="${index}">Mi ubicación</button>
                        </div>
                        <span class="pressure-coordinate-summary" data-presion-coordinate-index="${index}">${escapeHtml(formatCoordinates(row))}</span>
                        <span class="sample-coordinate-status" data-presion-gps-status="${index}" aria-live="polite"></span>
                    </td>
                </tr>`;
        }).join("");

        form.querySelectorAll('[name^="psi_"]').forEach(input => updateMca(form, Number(input.name.slice(4))));
        syncRows(form);
    }

    function updateMca(form, index) {
        const input = form.querySelector(`[name="psi_${index}"]`);
        const output = form.querySelector(`[data-pressure-mca="${index}"]`);
        if (!input || !output) return;
        const psi = input.value === "" ? NaN : Number(input.value);
        output.textContent = Number.isFinite(psi) ? (psi * MCA_FACTOR).toFixed(2) : "—";
    }

    function syncRows(form) {
        const rows = PRESSURE_POINTS.map((point, index) => {
            const get = key => clean(form.querySelector(`[name="${key}_${index}"]`)?.value);
            const psi = get("psi");
            const psiNumber = psi === "" ? NaN : Number(psi);
            return {
                ruta: point.ruta,
                lugar: point.lugar,
                presionPsi: psi,
                presionMca: Number.isFinite(psiNumber) ? Number((psiNumber * MCA_FACTOR).toFixed(2)) : "",
                hora: get("hora"),
                latitud: get("latitud"),
                longitud: get("longitud"),
                altitud: get("altitud"),
                precisionGps: get("precisionGps")
            };
        });
        const hidden = form.querySelector('[name="medicionesJson"]');
        if (hidden) hidden.value = JSON.stringify(rows);
        return rows;
    }

    function setPointCoordinates(form, index, coordinates) {
        const fields = {
            latitud: numberText(coordinates.latitude, 7),
            longitud: numberText(coordinates.longitude, 7),
            altitud: numberText(coordinates.altitude, 2),
            precisionGps: numberText(coordinates.accuracy, 2)
        };
        Object.entries(fields).forEach(([key, value]) => {
            const input = form.querySelector(`[name="${key}_${index}"]`);
            if (input) input.value = value;
        });
        const summary = form.querySelector(`[data-presion-coordinate-index="${index}"]`);
        if (summary) summary.textContent = formatCoordinates(fields);
        syncRows(form);
    }

    function captureCoordinates(form, index, button) {
        const status = form.querySelector(`[data-presion-gps-status="${index}"]`);
        if (!navigator.geolocation) {
            setMessage(status, "Este dispositivo no permite obtener coordenadas.", "error");
            return;
        }
        const oldText = button.textContent;
        button.disabled = true;
        button.textContent = "Obteniendo ubicación…";
        setMessage(status, "Obteniendo coordenadas…", "loading");

        navigator.geolocation.getCurrentPosition(position => {
            const coords = position.coords || {};
            setPointCoordinates(form, index, {
                latitude: coords.latitude,
                longitude: coords.longitude,
                altitude: coords.altitude,
                accuracy: coords.accuracy
            });
            setMessage(status, "Coordenadas capturadas.", "success");
            button.disabled = false;
            button.textContent = oldText;
        }, error => {
            const messages = {
                1: "Se denegó el permiso de ubicación. Autorice el acceso y vuelva a intentarlo.",
                2: "No se pudo determinar la ubicación. Inténtelo de nuevo.",
                3: "La ubicación tardó demasiado. Vuelva a intentarlo."
            };
            setMessage(status, messages[error?.code] || "No se pudieron obtener las coordenadas.", "error");
            button.disabled = false;
            button.textContent = oldText;
        }, { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 });
    }

    function missingCoordinates(rows) {
        return rows.find(row => {
            const lat = row.latitud === "" ? NaN : Number(row.latitud);
            const lng = row.longitud === "" ? NaN : Number(row.longitud);
            return !Number.isFinite(lat) || !Number.isFinite(lng);
        });
    }

    function formatApiError(error, fallback) {
        return error?.message || fallback;
    }

    async function loadPdfLibraries() {
        if (!pdfLibrariesPromise) {
            pdfLibrariesPromise = (async () => {
                const load = src => new Promise((resolve, reject) => {
                    const script = document.createElement("script");
                    script.src = src;
                    script.async = true;
                    script.onload = resolve;
                    script.onerror = () => reject(new Error("No se pudo cargar el generador del reporte PDF."));
                    document.head.appendChild(script);
                });
                if (!window.jspdf?.jsPDF) {
                    await load("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js");
                }
                if (!window.jspdf?.jsPDF) throw new Error("No se pudo cargar el generador del reporte PDF.");
                const probe = new window.jspdf.jsPDF({ unit: "mm", format: "letter" });
                if (typeof probe.autoTable !== "function") {
                    await load("https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js");
                }
                const check = new window.jspdf.jsPDF({ unit: "mm", format: "letter" });
                if (typeof check.autoTable !== "function") throw new Error("No se pudo cargar la tabla del reporte PDF.");
            })().catch(error => {
                pdfLibrariesPromise = null;
                throw error;
            });
        }
        return pdfLibrariesPromise;
    }

    async function imageData(path) {
        const response = await fetch(path, { cache: "no-cache" });
        if (!response.ok) throw new Error("No se encontró el membrete de ASADA para el reporte.");
        const blob = await response.blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("No se pudo preparar el membrete para el reporte."));
            reader.readAsDataURL(blob);
        });
    }

    function reportRows(record) {
        return (Array.isArray(record.mediciones) ? record.mediciones : []).map(row => [
            row.ruta,
            row.lugar,
            clean(row.presionPsi),
            clean(row.presionMca),
            clean(row.hora),
            numberText(row.latitud, 7),
            numberText(row.longitud, 7),
            numberText(row.altitud, 2) || "No disponible",
            numberText(row.precisionGps, 2) || "No disponible"
        ]);
    }

    async function createPressurePdf(record) {
        await loadPdfLibraries();
        const doc = new window.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "letter", compress: true });
        const width = doc.internal.pageSize.getWidth();
        const height = doc.internal.pageSize.getHeight();
        const letterhead = await imageData("img/membrete-asada.png");
        const logoWidth = 210;
        const logoHeight = logoWidth / (699 / 115);
        doc.addImage(letterhead, "PNG", (width - logoWidth) / 2, 7, logoWidth, logoHeight);

        doc.setTextColor(30, 32, 36);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("Hoja de registro de presiones", width / 2, 48, { align: "center" });
        doc.setFont("times", "normal");
        doc.setFontSize(11);
        doc.text(`${formatDate(record.fecha)} · ID ${record.id}`, width / 2, 55, { align: "center" });
        doc.setDrawColor(19, 128, 112);
        doc.line(12, 61, width - 12, 61);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("Responsable:", 14, 70);
        doc.setFont("helvetica", "normal");
        doc.text(String(record.responsable || "No indicado"), 39, 70);
        doc.setFont("helvetica", "bold");
        doc.text("Ingresado por:", 130, 70);
        doc.setFont("helvetica", "normal");
        doc.text(String(record.ingresadoPor || "No indicado"), 158, 70);

        doc.autoTable({
            startY: 77,
            head: [["Ruta", "Lugar de medición", "Presión PSI", "Presión MCA", "Hora", "Latitud", "Longitud", "Altitud (m)", "Precisión GPS (m)"]],
            body: reportRows(record),
            theme: "grid",
            styles: {
                font: "helvetica",
                fontSize: 8.2,
                cellPadding: 2.3,
                overflow: "linebreak",
                valign: "middle"
            },
            headStyles: {
                fillColor: [19, 128, 112],
                textColor: 255,
                fontStyle: "bold",
                fontSize: 8.5
            },
            alternateRowStyles: { fillColor: [244, 248, 247] },
            margin: { left: 12, right: 12, bottom: 16 },
            columnStyles: {
                0: { cellWidth: 13, halign: "center" },
                1: { cellWidth: 48 },
                2: { cellWidth: 24, halign: "center" },
                3: { cellWidth: 25, halign: "center" },
                4: { cellWidth: 19, halign: "center" },
                5: { cellWidth: 32 },
                6: { cellWidth: 32 },
                7: { cellWidth: 26, halign: "center" },
                8: { cellWidth: 34, halign: "center" }
            },
            didDrawPage: () => {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(90, 95, 100);
                doc.text("Reporte generado por el sistema de ASADA Orosi", 14, height - 8);
            }
        });
        return doc;
    }

    async function savePressurePdf(record, options) {
        const settings = options || {};
        const doc = await createPressurePdf(record);
        const rawData = String(doc.output("datauristring") || "");
        const data = rawData.replace(/^data:application\/pdf;[^,]*;base64,/i, "data:application/pdf;base64,");
        if (!data.startsWith("data:application/pdf;base64,")) {
            throw new Error("No se pudo preparar el PDF para guardarlo en Drive.");
        }
        const response = await api("saveCloroAforoPdf", {
            module: "Presiones",
            id: record.id,
            archivo: { name: `Reporte_Presion_${record.id}.pdf`, type: "application/pdf", data }
        });
        const saved = responseData(response);
        const url = clean(saved.reportePDFURL || saved.reportePdfUrl);
        if (!url) throw new Error("Apps Script no confirmó el enlace del PDF en Google Sheets.");
        if (settings.downloadLocal !== false) doc.save(`Reporte_Presion_${record.id}.pdf`);
        return { ...saved, reportePDFURL: url };
    }

    function listCard(record) {
        const routes = [...new Set((record.mediciones || []).map(row => row.ruta))].join(", ");
        return `<article class="record-card module-card">
            <div class="record-card-top"><div><span class="eyebrow">CONTROL DE PRESIONES</span><h2>${escapeHtml(record.id)}</h2></div></div>
            <div class="pressure-card-meta">
                <div><span>Responsable</span><strong>${escapeHtml(record.responsable || "No indicado")}</strong></div>
                <div><span>Fecha y hora</span><strong>${escapeHtml(formatDate(record.fecha))}</strong></div>
                <div><span>Puntos registrados</span><strong>${escapeHtml(String(record.mediciones?.length || 0))} · Rutas ${escapeHtml(routes || "—")}</strong></div>
            </div>
            <div class="record-card-actions">
                <a class="btn primary" href="detalle-presion.html?id=${encodeURIComponent(record.id)}">Consultar registro</a>
                <a class="btn secondary" href="crear-presion.html?id=${encodeURIComponent(record.id)}">Editar</a>
            </div>
        </article>`;
    }

    function renderList(records, filter) {
        const root = document.getElementById("presionesPage");
        if (!root) return;
        const query = clean(filter).toLocaleLowerCase("es-CR");
        const selected = (records || []).filter(record => {
            const search = `${record.id} ${record.responsable} ${formatDate(record.fecha)}`.toLocaleLowerCase("es-CR");
            return !query || search.includes(query);
        });
        if (!selected.length) {
            root.innerHTML = `<div class="empty-state"><p>${records.length ? "No se encontraron controles que coincidan con la búsqueda." : "Todavía no hay controles de presiones registrados."}</p></div>`;
            return;
        }
        root.innerHTML = `<div class="module-list">${selected.map(listCard).join("")}</div>`;
    }

    function detailTable(record) {
        const rows = (record.mediciones || []).map(row => [
            `Ruta ${row.ruta}`,
            row.lugar,
            row.presionPsi,
            row.presionMca,
            row.hora,
            numberText(row.latitud, 7),
            numberText(row.longitud, 7),
            numberText(row.altitud, 2) || "No disponible",
            numberText(row.precisionGps, 2) || "No disponible"
        ]);
        const headers = ["Ruta", "Lugar de medición", "Presión PSI", "Presión MCA", "Hora", "Latitud", "Longitud", "Altitud (m)", "Precisión GPS (m)"];
        return `<div class="module-table-wrap"><table class="module-table pressure-table"><thead><tr>${headers.map(value => `<th>${escapeHtml(value)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    }

    function renderDetail(record) {
        const root = document.getElementById("presionDetail");
        if (!root) return;
        const reportLink = clean(record.reportePdfUrl)
            ? `<a class="pressure-report-link" href="${escapeHtml(record.reportePdfUrl)}" target="_blank" rel="noopener">Abrir reporte guardado en Drive</a>`
            : "";
        root.innerHTML = `
            <div class="module-detail-head"><span class="eyebrow">CONTROL DE PRESIONES</span><h1>${escapeHtml(record.responsable || "Registro de presiones")}</h1><p>Registro ${escapeHtml(record.id)} · ${escapeHtml(formatDate(record.fecha))}</p></div>
            <section class="detail-card module-detail-card"><h2>Información del registro</h2><dl class="module-detail-grid">
                <div><dt>Responsable</dt><dd>${escapeHtml(record.responsable || "No indicado")}</dd></div>
                <div><dt>Ingresado por</dt><dd>${escapeHtml(record.ingresadoPor || "No indicado")}</dd></div>
                <div><dt>Fecha y hora</dt><dd>${escapeHtml(formatDate(record.fecha))}</dd></div>
                <div><dt>Puntos de medición</dt><dd>${escapeHtml(String(record.mediciones?.length || 0))}</dd></div>
            </dl></section>
            <section class="detail-card module-detail-card"><h2>Lecturas de presión</h2>${detailTable(record)}</section>
            ${reportLink}
            <div class="detail-actions module-actions"><button type="button" class="btn primary" data-download-presion>Generar y guardar PDF</button><a class="btn secondary" href="crear-presion.html?id=${encodeURIComponent(record.id)}">Editar</a><a class="btn secondary" href="presiones.html">Volver al listado</a></div>
            <p class="module-status" data-report-pdf-status aria-live="polite"></p>`;

        const button = root.querySelector("[data-download-presion]");
        const status = root.querySelector("[data-report-pdf-status]");
        button.addEventListener("click", async () => {
            const original = button.textContent;
            button.disabled = true;
            button.textContent = "Guardando PDF…";
            setMessage(status, "Generando el reporte y guardándolo en Datos ASADA / Presiones…", "loading");
            try {
                const result = await savePressurePdf(record, { downloadLocal: true });
                setMessage(status, "El reporte se guardó en la carpeta del registro y también se descargó.", "success");
                let link = root.querySelector(".pressure-report-link");
                if (!link) {
                    link = document.createElement("a");
                    link.className = "pressure-report-link";
                    link.target = "_blank";
                    link.rel = "noopener";
                    link.textContent = "Abrir reporte guardado en Drive";
                    status.insertAdjacentElement("beforebegin", link);
                }
                link.href = result.reportePDFURL;
                button.textContent = "PDF guardado";
            } catch (error) {
                setMessage(status, formatApiError(error, "No fue posible guardar el reporte PDF."), "error");
                button.textContent = "Reintentar guardado del PDF";
            } finally {
                button.disabled = false;
                if (!status.classList.contains("is-success")) button.textContent = original;
            }
        });
    }

    async function bindForm() {
        const form = document.getElementById("presionForm");
        if (!form) return;
        const dateInput = form.querySelector('[name="fecha"]');
        const id = getQueryId();
        if (!id && dateInput) dateInput.value = localDateTimeValue();
        await waitForAuth();
        buildRows(form);

        if (id) {
            try {
                const data = responseData(await api("getPresionById", { id }));
                const record = data.presion;
                if (!record) throw new Error("No se encontró el control de presiones solicitado.");
                form.querySelector('[name="id"]').value = record.id;
                form.querySelector('[name="fecha"]').value = localDateTimeValue(record.fecha);
                form.querySelector('[name="responsable"]').value = record.responsable || "";
                buildRows(form, record.mediciones || []);
                const title = document.querySelector(".page-head h1");
                if (title) title.textContent = "Editar control de presiones";
                const button = form.querySelector('button[type="submit"]');
                if (button) button.textContent = "Guardar cambios";
            } catch (error) {
                setMessage(form.querySelector("[data-module-status]"), formatApiError(error, "No fue posible cargar el registro."), "error");
            }
        }

        form.addEventListener("input", event => {
            const input = event.target.closest('[name^="psi_"]');
            if (input) updateMca(form, Number(input.name.slice(4)));
            syncRows(form);
        });

        form.addEventListener("click", event => {
            const button = event.target.closest("[data-presion-gps-index]");
            if (!button) return;
            event.preventDefault();
            captureCoordinates(form, Number(button.dataset.presionGpsIndex), button);
        });

        const retryButton = form.querySelector("[data-presion-retry-pdf]");
        retryButton?.addEventListener("click", async () => {
            if (!pendingSavedRecord) return;
            retryButton.disabled = true;
            setMessage(form.querySelector("[data-module-status]"), "Reintentando guardar el PDF en Drive…", "loading");
            try {
                const result = await savePressurePdf(pendingSavedRecord, { downloadLocal: false });
                setMessage(form.querySelector("[data-module-status]"), `El registro ${pendingSavedRecord.id} y su reporte PDF quedaron guardados.`, "success");
                retryButton.hidden = true;
                if (window.ASADA_USER?.isAdmin) window.location.href = `detalle-presion.html?id=${encodeURIComponent(pendingSavedRecord.id)}`;
            } catch (error) {
                setMessage(form.querySelector("[data-module-status]"), `El registro ${pendingSavedRecord.id} sí quedó en Sheets; no se pudo guardar el PDF. ${formatApiError(error, "")}`, "error");
            } finally {
                retryButton.disabled = false;
            }
        });

        form.addEventListener("submit", async event => {
            event.preventDefault();
            if (form.dataset.asadaSaving === "1" || form.dataset.asadaSaved === "1") return;
            if (!form.reportValidity()) return;

            const rows = syncRows(form);
            const missing = missingCoordinates(rows);
            if (missing) {
                const pointIndex = PRESSURE_POINTS.findIndex(point => point.lugar === missing.lugar);
                const status = form.querySelector(`[data-presion-gps-status="${pointIndex}"]`);
                setMessage(status, "Capture las coordenadas de este punto antes de guardar.", "error");
                form.querySelector(`[data-presion-gps-index="${pointIndex}"]`)?.focus();
                setMessage(form.querySelector("[data-module-status]"), `Faltan las coordenadas de ${missing.lugar}.`, "error");
                return;
            }

            const confirmed = form.dataset.asadaSubmitBypass === "1"
                ? true
                : window.confirm("¿Confirma guardar el control de presiones y su reporte?");
            delete form.dataset.asadaSubmitBypass;
            if (!confirmed) return;

            const submitButton = form.querySelector('button[type="submit"]');
            const status = form.querySelector("[data-module-status]");
            const originalText = submitButton?.textContent || "Guardar control de presiones";
            form.dataset.asadaSaving = "1";
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Guardando control…";
            }
            setMessage(status, "Guardando el control de presiones en Google Sheets…", "loading");

            let sheetSaved = false;
            try {
                const user = await waitForAuth();
                if (!user || !clean(user.email)) throw new Error("La sesión no está lista. Inicie sesión nuevamente e intente guardar.");
                const record = {
                    id: clean(form.querySelector('[name="id"]').value),
                    mode: clean(form.querySelector('[name="id"]').value) ? "update" : "create",
                    fecha: form.querySelector('[name="fecha"]').value,
                    responsable: form.querySelector('[name="responsable"]').value,
                    ingresadoPor: currentUserName(),
                    mediciones: rows
                };
                const data = responseData(await api("savePresion", { presion: record }));
                const saved = data.presion;
                if (!saved?.id || saved.mediciones?.length !== 22) {
                    throw new Error("Google Sheets no confirmó las 22 mediciones del control.");
                }
                pendingSavedRecord = saved;
                sheetSaved = true;
                setMessage(status, `Control ${saved.id} guardado en Google Sheets. Guardando el reporte PDF en Drive…`, "loading");
                const pdf = await savePressurePdf(saved, { downloadLocal: false });
                if (!pdf.reportePDFURL) throw new Error("Google Sheets no confirmó el enlace del reporte PDF.");
                form.dataset.asadaSaved = "1";
                setMessage(status, `Control ${saved.id} y reporte guardados en Datos ASADA / Presiones.`, "success");
                if (submitButton) {
                    submitButton.textContent = "Control guardado";
                    submitButton.disabled = true;
                }
                if (window.ASADA_USER?.isAdmin) {
                    window.setTimeout(() => { window.location.href = `detalle-presion.html?id=${encodeURIComponent(saved.id)}`; }, 700);
                } else {
                    window.alert(`El control de presiones y su reporte PDF se guardaron correctamente. ID: ${saved.id}.`);
                }
            } catch (error) {
                console.error("Error guardando el control de presiones:", error);
                if (sheetSaved) {
                    if (retryButton) retryButton.hidden = false;
                    form.dataset.asadaSaved = "1";
                    if (submitButton) {
                        submitButton.disabled = true;
                        submitButton.textContent = "Control guardado en Sheets";
                    }
                    setMessage(status, `El control ${pendingSavedRecord.id} sí quedó guardado en Sheets, pero no se pudo guardar el PDF. Puede reintentar con el botón siguiente. ${formatApiError(error, "")}`, "error");
                } else {
                    setMessage(status, formatApiError(error, "No fue posible guardar el control de presiones."), "error");
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = originalText;
                    }
                }
            } finally {
                delete form.dataset.asadaSaving;
            }
        });
    }

    async function bindList() {
        const root = document.getElementById("presionesPage");
        if (!root) return;
        const search = document.getElementById("pressureSearch");
        try {
            await waitForAuth();
            const data = responseData(await api("getAllPresiones"));
            const records = Array.isArray(data.presiones) ? data.presiones : [];
            renderList(records, search?.value);
            search?.addEventListener("input", () => renderList(records, search.value));
        } catch (error) {
            root.innerHTML = `<div class="empty-state is-error"><p>${escapeHtml(formatApiError(error, "No fue posible cargar los controles de presiones."))}</p></div>`;
        }
    }

    async function bindDetail() {
        const root = document.getElementById("presionDetail");
        if (!root) return;
        try {
            await waitForAuth();
            const id = getQueryId();
            if (!id) throw new Error("El ID del control de presiones no está indicado.");
            const data = responseData(await api("getPresionById", { id }));
            if (!data.presion) throw new Error("No se encontró el control de presiones solicitado.");
            renderDetail(data.presion);
        } catch (error) {
            root.innerHTML = `<div class="empty-state is-error"><p>${escapeHtml(formatApiError(error, "No fue posible cargar el control de presiones."))}</p></div>`;
        }
    }

    function init() {
        bindForm();
        bindList();
        bindDetail();
    }

    document.addEventListener("DOMContentLoaded", init, { once: true });
})();
