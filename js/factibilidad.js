(function () {
    "use strict";

    /* =========================================================
       FACTIBILIDAD DE AGUA POTABLE
       ========================================================= */

    const FACT_DENIAL_REASONS = [

        "Existe incongruencia en la información registral aportada.",

        "No existe infraestructura de distribución o conducción frente a la propiedad.",

        "La elevación topográfica supera la elevación disponible para el abastecimiento.",

        "La propiedad se encuentra fuera del área de cobertura de la ASADA.",

        "El desarrollo está pendiente de aprobación, inspección o recepción por parte del AyA.",

        "La solicitud corresponde a obras que no requieren disponibilidad de agua ante CFIA o APC.",

        "La propiedad pertenece a un fraccionamiento autorizado sin disponibilidad previa.",

        "El proyecto no cumple con las regulaciones urbanísticas vigentes.",

        "No existe capacidad de agua.",

        "No existe capacidad hidráulica ni capacidad de agua.",

        "La zona fue declarada inhabitable por las instituciones competentes.",

        "No existe capacidad hidráulica."

    ];

    const FACT_METER_LOCATIONS = [

        "En vía pública, en el límite de la propiedad.",

        "En servidumbre inscrita a favor de la ASADA.",

        "En vía pública, frente al ingreso de una servidumbre de un tercero.",

        "En vía pública, frente al ingreso de una servidumbre de hecho."

    ];

    const FACT_PROPERTY_TYPES = [

        [
            "tipoCasa",
            "Casa"
        ],

        [
            "tipoBodega",
            "Bodega"
        ],

        [
            "tipoComercio",
            "Comercio"
        ],

        [
            "tipoCabana",
            "Cabaña"
        ],

        [
            "tipoPlantacion",
            "Plantación"
        ],

        [
            "tipoLote",
            "Lote"
        ],

        [
            "tipoOtro",
            "Otro"
        ]

    ];

    const factibilidadState = {

        currentRecord:
            null,

        records:
            [],

        newImage:
            null,

        existingImageSource:
            "",

        existingImageRemoved:
            false

    };


    window.ASADA_FACTIBILIDAD_DRAFT_IMAGE =
        null;


    window.ASADA_APPLY_FACTIBILIDAD_DRAFT_IMAGE =
        function (image) {

            if (
                image &&
                image.data
            ) {

                factibilidadState.newImage =
                    image;

                window.ASADA_FACTIBILIDAD_DRAFT_IMAGE =
                    image;

                factibilidadShowImage(
                    image.data,
                    true
                );

            } else {

                factibilidadClearNewImage();
            }
        };


    /* =========================================================
       INICIO
       ========================================================= */

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            const root =
                document.getElementById(
                    "factibilidadApp"
                );


            if (
                !root
            ) {

                return;
            }


            const view =
                root.dataset.view;


            if (
                view ===
                "form"
            ) {

                initFactibilidadForm(
                    root
                );

            } else if (
                view ===
                "list"
            ) {

                initFactibilidadList(
                    root
                );

            } else if (
                view ===
                "detail"
            ) {

                initFactibilidadDetail(
                    root
                );
            }
        }
    );


    /* =========================================================
       COMUNICACIÓN CON APPS SCRIPT
       ========================================================= */

    async function factibilidadCall(
        action,
        values
    ) {

        const response =
            await callApi(
                action,
                values ||
                {}
            );


        if (
            response &&
            (
                response.success === false ||
                response.ok === false
            )
        ) {

            throw new Error(
                response.message ||
                response.error ||
                "No fue posible completar la solicitud."
            );
        }


        if (
            response &&
            Object.prototype.hasOwnProperty.call(
                response,
                "data"
            )
        ) {

            return response.data;
        }


        if (
            response &&
            Object.prototype.hasOwnProperty.call(
                response,
                "result"
            )
        ) {

            return response.result;
        }


        return response;
    }


    async function factibilidadGetAll() {

        const result =
            await factibilidadCall(
                "getAllFactibilidades"
            );


        if (
            Array.isArray(
                result
            )
        ) {

            return result;
        }


        return result &&
            Array.isArray(
                result.factibilidades
            )
            ? result.factibilidades
            : [];
    }


    async function factibilidadGetById(
        id
    ) {

        const result =
            await factibilidadCall(
                "getFactibilidadById",
                {
                    id:
                        id
                }
            );


        return result &&
            result.factibilidad
            ? result.factibilidad
            : result;
    }

    async function factibilidadSave(record) {
        const result = await factibilidadCall(
            "saveFactibilidad",
            {
                factibilidad: record
            }
        );

        return result && result.factibilidad
            ? result.factibilidad
            : result;
    }

    /* =========================================================
       FORMULARIO
       ========================================================= */

    async function initFactibilidadForm(
        root
    ) {

        root.innerHTML =
            factibilidadFormTemplate();


        const form =
            document.getElementById(
                "factibilidadForm"
            );

        factibilidadState.newImage = null;
        factibilidadState.existingImageSource = "";
        factibilidadState.existingImageRemoved = false;
        window.ASADA_FACTIBILIDAD_DRAFT_IMAGE = null;

        factibilidadBindForm(
            form
        );


        const id =
            factibilidadQuery(
                "id"
            );


        if (
            id
        ) {

            factibilidadSetStatus(
                "Cargando inspección...",
                "loading"
            );


            try {

                const record =
                    await factibilidadGetById(
                        id
                    );


                if (
                    !record
                ) {

                    throw new Error(
                        "No se encontró la inspección solicitada."
                    );
                }


                factibilidadState.currentRecord =
                    record;

                factibilidadFillForm(
                    form,
                    record
                );

                window.setTimeout(() => {
                    window.ASADA_FACTIBILIDAD_MAP_REFRESH?.();
                }, 0);

                void factibilidadLoadEditImagePreview(record);

                document.getElementById(
                    "factFormTitle"
                ).textContent =
                    "Editar inspección de factibilidad";

                document.getElementById(
                    "factSubmitButton"
                ).textContent =
                    "Guardar cambios";

                const cancel =
                    document.getElementById(
                        "factCancelLink"
                    );

                cancel.href =
                    "detalle-factibilidad.html?id=" +
                    encodeURIComponent(
                        record.id
                    );

                factibilidadSetStatus(
                    "",
                    ""
                );

            } catch (
            error
            ) {

                factibilidadSetStatus(
                    error.message,
                    "error"
                );
            }

        } else {

            document.getElementById(
                "fechaHoraInspeccion"
            ).value =
                factibilidadNowInput();
        }
    }


    function factibilidadFormTemplate() {

        const propertyTypes =
            FACT_PROPERTY_TYPES

                .map(
                    function (
                        option
                    ) {

                        return `
                        <label class="fact-choice">
                            <input
                                type="checkbox"
                                name="${option[0]}">

                            <span>
                                ${factibilidadEscape(option[1])}
                            </span>
                        </label>
                    `;
                    }
                )

                .join(
                    ""
                );

        const denialReasons =
            FACT_DENIAL_REASONS

                .map(
                    function (
                        reason,
                        index
                    ) {

                        return `
                        <label class="fact-check">
                            <input
                                type="checkbox"
                                name="motivosNegacion"
                                value="${factibilidadEscape(reason)}">

                            <span>
                                ${index + 1}. ${factibilidadEscape(reason)}
                            </span>
                        </label>
                    `;
                    }
                )

                .join(
                    ""
                );

        const meterLocations =
            FACT_METER_LOCATIONS

                .map(
                    function (
                        location
                    ) {

                        return `
                        <option value="${factibilidadEscape(location)}">
                            ${factibilidadEscape(location)}
                        </option>
                    `;
                    }
                )

                .join(
                    ""
                );


        return `
        <header class="fact-hero">

            <span class="fact-eyebrow">
                ASADA OROSI
            </span>

            <h1 id="factFormTitle">
                Inspección de factibilidad de agua potable
            </h1>

            <p>
                Complete la información técnica de la inspección.
                Los campos marcados son obligatorios.
            </p>

            <a
                class="fact-secondary-button"
                href="factibilidades.html">

                Ver inspecciones

            </a>

        </header>


        <form
            id="factibilidadForm"
            class="fact-form"
            novalidate>

            <input
                type="hidden"
                name="id">


            <section class="fact-panel">

                <div class="fact-section-heading">

                    <div>
                        <h2>Información del solicitante</h2>
                        <p>Identificación y ubicación de la propiedad.</p>
                    </div>

                </div>


                <div class="fact-grid">

                    <label class="fact-field fact-span-2">

                        <span>
                            Nombre del solicitante *
                        </span>

                        <input
                            type="text"
                            name="nombreSolicitante"
                            maxlength="180"
                            required>

                    </label>


                    <label class="fact-field fact-span-2">

                        <span>
                            Dirección *
                        </span>

                        <textarea
                            name="direccion"
                            rows="3"
                            maxlength="1000"
                            required></textarea>

                    </label>


                    <label class="fact-field fact-span-2">

                        <span>
                            Ruta *
                        </span>

                        <input
                            type="text"
                            name="ruta"
                            maxlength="300"
                            required>

                    </label>

                </div>

            </section>


            <section class="fact-panel">

                <div class="fact-section-heading">

                    <div>
                        <h2>Información de la propiedad</h2>
                        <p>Servicio existente y uso de la propiedad.</p>
                    </div>

                </div>


                <fieldset class="fact-fieldset">

                    <legend>
                        ¿Existe una paja abasteciendo la propiedad? *
                    </legend>

                    <div class="fact-inline-options">

                        <label class="fact-choice">
                            <input
                                type="radio"
                                name="existePaja"
                                value="Si"
                                required>

                            <span>Sí</span>
                        </label>

                        <label class="fact-choice">
                            <input
                                type="radio"
                                name="existePaja"
                                value="No"
                                required>

                            <span>No</span>
                        </label>

                    </div>

                </fieldset>


                <div
                    id="factPajaBlock"
                    class="fact-conditional"
                    hidden>

                    <label class="fact-field">

                        <span>
                            Número de paja *
                        </span>

                        <input
                            type="text"
                            name="numeroPaja"
                            maxlength="80">

                    </label>

                </div>


                <fieldset class="fact-fieldset">

                    <legend>
                        Tipo de propiedad *
                    </legend>

                    <div class="fact-choice-grid">
                        ${propertyTypes}
                    </div>

                </fieldset>


                <div
                    id="factOtherTypeBlock"
                    class="fact-conditional"
                    hidden>

                    <label class="fact-field">

                        <span>
                            Descripción del otro tipo *
                        </span>

                        <input
                            type="text"
                            name="tipoOtroDescripcion"
                            maxlength="200">

                    </label>

                </div>

            </section>


            <section class="fact-panel">

                <div class="fact-section-heading">

                    <div>
                        <h2>Condiciones hidráulicas</h2>
                        <p>Presión, caudal, tubería y disponibilidad.</p>
                    </div>

                </div>


                <div class="fact-grid fact-grid-3">

                    <label class="fact-field">

                        <span>
                            Presión mínima (PSI) *
                        </span>

                        <input
                            type="number"
                            name="presionMinimaPSI"
                            min="0"
                            step="0.01"
                            required>

                    </label>


                    <label class="fact-field">

                        <span>
                            Presión máxima (PSI) *
                        </span>

                        <input
                            type="number"
                            name="presionMaximaPSI"
                            min="0"
                            step="0.01"
                            required>

                    </label>


                    <label class="fact-field">

                        <span>
                            Caudal reservado (m³/día) *
                        </span>

                        <input
                            type="number"
                            name="caudalReservado"
                            min="0"
                            step="0.001"
                            required>

                    </label>

                </div>


                <fieldset class="fact-fieldset">

                    <legend>
                        ¿Existe tubería de distribución frente a la propiedad? *
                    </legend>

                    <div class="fact-inline-options">

                        <label class="fact-choice">
                            <input
                                type="radio"
                                name="existeTuberiaFrente"
                                value="Si"
                                required>

                            <span>Sí</span>
                        </label>

                        <label class="fact-choice">
                            <input
                                type="radio"
                                name="existeTuberiaFrente"
                                value="No"
                                required>

                            <span>No</span>
                        </label>

                    </div>

                </fieldset>


                <div
                    id="factPipeBlock"
                    class="fact-conditional"
                    hidden>

                    <label class="fact-field">

                        <span>
                            Diámetro de la tubería *
                        </span>

                        <input
                            type="text"
                            name="diametroTuberia"
                            maxlength="100"
                            placeholder="Ejemplo: 50 mm">

                    </label>

                </div>


                <fieldset class="fact-fieldset">

                    <legend>
                        ¿Existe disponibilidad de agua? *
                    </legend>

                    <div class="fact-inline-options">

                        <label class="fact-choice">
                            <input
                                type="radio"
                                name="existeDisponibilidadAgua"
                                value="Si"
                                required>

                            <span>Sí</span>
                        </label>

                        <label class="fact-choice">
                            <input
                                type="radio"
                                name="existeDisponibilidadAgua"
                                value="No"
                                required>

                            <span>No</span>
                        </label>

                    </div>

                </fieldset>


                <div
                    id="factDenialBlock"
                    class="fact-conditional"
                    hidden>

                    <fieldset class="fact-fieldset">

                        <legend>
                            Motivos de negación *
                        </legend>

                        <div class="fact-check-list">
                            ${denialReasons}
                        </div>

                    </fieldset>

                </div>


                <div
                    id="factMeterLocationBlock"
                    class="fact-conditional"
                    hidden>

                    <label class="fact-field">

                        <span>
                            Ubicación prevista para el medidor *
                        </span>

                        <select
                            name="ubicacionMedidor">

                            <option value="">
                                Seleccione una opción
                            </option>

                            ${meterLocations}

                        </select>

                    </label>

                </div>

            </section>


            <section class="fact-panel">

                <div class="fact-section-heading">

                    <div>
                        <h2>Ubicación geográfica</h2>
                        <p>Puede capturar el GPS, buscar una dirección o seleccionar el punto en el mapa.</p>
                    </div>

                </div>


                <div class="fact-actions-row">

                    <button
                        id="factGpsButton"
                        type="button"
                        class="fact-secondary-button">

                        Capturar ubicación actual

                    </button>

                    <span
                        id="factGpsStatus"
                        class="fact-inline-status"
                        aria-live="polite">
                    </span>

                </div>


                <div class="fact-grid fact-grid-4">

                    <label class="fact-field">

                        <span>Longitud X *</span>

                        <input
                            type="number"
                            name="longitudX"
                            step="any"
                            min="-180"
                            max="180"
                            required>

                    </label>


                    <label class="fact-field">

                        <span>Latitud Y *</span>

                        <input
                            type="number"
                            name="latitudY"
                            step="any"
                            min="-90"
                            max="90"
                            required>

                    </label>


                    <label class="fact-field">

                        <span>Altitud (m)</span>

                        <input
                            type="number"
                            name="altitud"
                            step="any">

                    </label>


                    <label class="fact-field">

                        <span>Precisión GPS (m)</span>

                        <input
                            type="number"
                            name="precisionGPS"
                            step="any"
                            min="0">

                    </label>

                </div>

            </section>


            <section class="fact-panel">

                <div class="fact-section-heading">

                    <div>
                        <h2>Red y dispositivo de medición</h2>
                        <p>Condiciones de acceso y recomendación técnica.</p>
                    </div>

                </div>


                <fieldset class="fact-fieldset">

                    <legend>
                        ¿La propiedad cuenta con prevista a la red? *
                    </legend>

                    <div class="fact-inline-options">

                        <label class="fact-choice">
                            <input
                                type="radio"
                                name="existePrevistaRed"
                                value="Si"
                                required>

                            <span>Sí</span>
                        </label>

                        <label class="fact-choice">
                            <input
                                type="radio"
                                name="existePrevistaRed"
                                value="No"
                                required>

                            <span>No</span>
                        </label>

                    </div>

                </fieldset>


                <div class="fact-grid fact-grid-3">

                    <label class="fact-field">

                        <span>
                            Material de la calle *
                        </span>

                        <select
                            name="materialCalle"
                            required>

                            <option value="">
                                Seleccione
                            </option>

                            <option value="Asfalto o concreto">
                                Asfalto o concreto
                            </option>

                            <option value="Lastre">
                                Lastre
                            </option>

                            <option value="Tierra">
                                Tierra
                            </option>

                            <option value="No aplica">
                                No aplica
                            </option>

                        </select>

                    </label>


                    <label class="fact-field">

                        <span>
                            Modalidad de medición recomendada *
                        </span>

                        <select
                            name="modalidadMedicion"
                            required>

                            <option value="">
                                Seleccione
                            </option>

                            <option value="Macromedidor">
                                Macromedidor
                            </option>

                            <option value="Medidor de 1/2">
                                Medidor de 1/2
                            </option>

                            <option value="Medidor de 3/4">
                                Medidor de 3/4
                            </option>

                            <option value="Medidor ultrasónico">
                                Medidor ultrasónico
                            </option>

                            <option value="Ninguno">
                                Ninguno
                            </option>

                        </select>

                    </label>


                    <label class="fact-field">

                        <span>
                            Diámetro del dispositivo *
                        </span>

                        <select
                            name="diametroDispositivo"
                            required>

                            <option value="">
                                Seleccione
                            </option>

                            <option value="12.5 mm">12.5 mm</option>
                            <option value="19 mm">19 mm</option>
                            <option value="25 mm">25 mm</option>
                            <option value="38 mm">38 mm</option>
                            <option value="50 mm">50 mm</option>
                            <option value="75 mm">75 mm</option>
                            <option value="100 mm">100 mm</option>
                            <option value="150 mm">150 mm</option>

                            <option value="No aplica">No aplica</option>

                        </select>

                    </label>

                </div>

            </section>


            <section class="fact-panel">

                <div class="fact-section-heading">

                    <div>
                        <h2>Fotografía y cierre</h2>
                        <p>Evidencia, observaciones y responsable.</p>
                    </div>

                </div>


                <label class="fact-field">

                    <span>
                        Fotografía del frente de la propiedad *
                    </span>

                    <input
                        id="factFrontImage"
                        type="file"
                        name="imagenFrente"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment">

                    <small>
                        La imagen se comprime antes de enviarse. Máximo original: 10 MB.
                    </small>

                </label>


                <div
                    id="factImagePreviewBox"
                    class="fact-image-preview"
                    hidden>

                    <img
                        id="factImagePreview"
                        alt="Vista previa del frente de la propiedad">

                    <button
                        id="factRemoveImageButton"
                        type="button"
                        class="btn secondary fact-remove-image-button"
                        onclick="factibilidadRemoveImage()"
                        hidden>
                        Quitar fotografía para cambiarla
                    </button>

                </div>


                <label class="fact-field">

                    <span>
                        Observaciones del inspector
                    </span>

                    <textarea
                        name="observaciones"
                        rows="5"
                        maxlength="2500"></textarea>

                </label>


                <div class="fact-grid">

                    <label class="fact-field">

                        <span>
                            Inspección realizada por *
                        </span>

                        <input
                            type="text"
                            name="inspeccionRealizadaPor"
                            maxlength="180"
                            required>

                    </label>


                    <label class="fact-field">

                        <span>
                            Fecha y hora de inspección *
                        </span>

                        <input
                            id="fechaHoraInspeccion"
                            type="datetime-local"
                            name="fechaHoraInspeccion"
                            required>

                    </label>

                </div>

            </section>


            <div class="fact-submit-panel">

                <div
                    id="factFormStatus"
                    class="fact-status"
                    aria-live="polite">
                </div>

                <div class="fact-actions-row">

                    <a
                        id="factCancelLink"
                        class="fact-secondary-button"
                        href="factibilidades.html">

                        Cancelar

                    </a>

                    <button
                        id="factSubmitButton"
                        type="submit"
                        class="fact-primary-button">

                        Guardar inspección

                    </button>

                </div>

            </div>

        </form>
    `;

    }


    function factibilidadBindForm(
        form
    ) {

        form.addEventListener(
            "change",
            factibilidadSyncConditions
        );

        document
            .getElementById(
                "factGpsButton"
            )
            .addEventListener(
                "click",
                function () {

                    factibilidadCaptureGps(
                        form
                    );
                }
            );

        document
            .getElementById(
                "factFrontImage"
            )
            .addEventListener(
                "change",
                async function (
                    event
                ) {

                    const file =
                        event.target.files[0];


                    if (
                        !file
                    ) {

                        return;
                    }


                    try {

                        factibilidadSetStatus(
                            "Preparando fotografía...",
                            "loading"
                        );

                        factibilidadState.newImage =
                            await factibilidadCompressImage(
                                file
                            );

                        factibilidadState.existingImageRemoved =
                            Boolean(factibilidadState.existingImageSource);

                        window.ASADA_FACTIBILIDAD_DRAFT_IMAGE =
                            factibilidadState.newImage;

                        factibilidadShowImage(
                            factibilidadState.newImage.data,
                            true
                        );

                        factibilidadSetStatus(
                            "",
                            ""
                        );

                    } catch (
                    error
                    ) {

                        event.target.value =
                            "";

                        factibilidadState.newImage =
                            null;

                        window.ASADA_FACTIBILIDAD_DRAFT_IMAGE =
                            null;

                        factibilidadSetStatus(
                            error.message,
                            "error"
                        );
                    }
                }
            );

        form.addEventListener(
            "submit",
            async function (
                event
            ) {

                event.preventDefault();


                if (
                    !factibilidadValidateForm(
                        form
                    )
                ) {

                    return;
                }


                const submit =
                    document.getElementById(
                        "factSubmitButton"
                    );


                submit.disabled =
                    true;

                factibilidadSetStatus(
                    "Guardando inspección...",
                    "loading"
                );


                try {

                    const record =
                        factibilidadCollectForm(
                            form
                        );

                    const saved =
                        await factibilidadSave(
                            record
                        );


                    if (
                        !saved ||
                        !saved.id
                    ) {

                        throw new Error(
                            "El servidor no devolvió el identificador del registro."
                        );
                    }


                    if (
                        typeof window.asadaShowPostSavePreview ===
                        "function"
                    ) {

                        submit.disabled =
                            false;

                        factibilidadSetStatus(
                            "Inspección enviada correctamente.",
                            "success"
                        );

                        window.asadaShowPostSavePreview(
                            "factibilidad",
                            saved
                        );

                        return;
                    }


                    window.location.href =
                        "detalle-factibilidad.html?id=" +
                        encodeURIComponent(
                            saved.id
                        );

                } catch (
                error
                ) {

                    submit.disabled =
                        false;

                    factibilidadSetStatus(
                        error.message,
                        "error"
                    );
                }
            }
        );

        factibilidadSyncConditions();
    }


    function factibilidadSyncConditions() {

        const form =
            document.getElementById(
                "factibilidadForm"
            );


        if (
            !form
        ) {

            return;
        }


        const paja =
            factibilidadRadioValue(
                form,
                "existePaja"
            ) ===
            "Si";

        const pipe =
            factibilidadRadioValue(
                form,
                "existeTuberiaFrente"
            ) ===
            "Si";

        const availability =
            factibilidadRadioValue(
                form,
                "existeDisponibilidadAgua"
            );

        const network =
            factibilidadRadioValue(
                form,
                "existePrevistaRed"
            );

        const other =
            form.elements.tipoOtro.checked;


        factibilidadToggleBlock(
            "factPajaBlock",
            paja
        );

        factibilidadToggleBlock(
            "factPipeBlock",
            pipe
        );

        factibilidadToggleBlock(
            "factOtherTypeBlock",
            other
        );

        factibilidadToggleBlock(
            "factDenialBlock",
            availability ===
            "No"
        );

        factibilidadToggleBlock(
            "factMeterLocationBlock",
            availability ===
            "Si"
        );

        const networkDefaults = {
            materialCalle: "No aplica",
            modalidadMedicion: "Ninguno",
            diametroDispositivo: "No aplica"
        };

        Object.keys(networkDefaults).forEach(
            function (name) {

                const control =
                    form.elements[name];

                if (!control) {
                    return;
                }

                const isNoNetwork =
                    network === "No";

                if (isNoNetwork) {
                    control.value =
                        networkDefaults[name];
                    control.disabled = true;
                    control.required = false;
                    return;
                }

                control.disabled = false;
                control.required = true;

                if (
                    network === "Si" &&
                    control.value === networkDefaults[name]
                ) {
                    control.value = "";
                }
            }
        );
    }


    function factibilidadToggleBlock(
        id,
        visible
    ) {

        const block =
            document.getElementById(
                id
            );


        if (
            !block
        ) {

            return;
        }


        block.hidden =
            !visible;

        block
            .querySelectorAll(
                "input, select, textarea"
            )
            .forEach(
                function (
                    input
                ) {

                    input.disabled =
                        !visible;
                }
            );
    }


    function factibilidadFillForm(
        form,
        record
    ) {

        const simpleFields = [

            "id",
            "nombreSolicitante",
            "direccion",
            "ruta",
            "numeroPaja",
            "tipoOtroDescripcion",
            "presionMinimaPSI",
            "presionMaximaPSI",
            "caudalReservado",
            "diametroTuberia",
            "ubicacionMedidor",
            "longitudX",
            "latitudY",
            "altitud",
            "precisionGPS",
            "materialCalle",
            "modalidadMedicion",
            "diametroDispositivo",
            "observaciones",
            "inspeccionRealizadaPor"

        ];


        simpleFields.forEach(
            function (
                name
            ) {

                if (
                    form.elements[
                    name
                    ]
                ) {

                    form.elements[
                        name
                    ].value =
                        record[
                        name
                        ] ??
                        "";
                }
            }
        );


        form.elements.fechaHoraInspeccion.value =
            factibilidadInputDate(
                record.fechaHoraInspeccion
            );


        factibilidadSetRadio(
            form,
            "existePaja",
            record.existePaja
        );

        factibilidadSetRadio(
            form,
            "existeTuberiaFrente",
            record.existeTuberiaFrente
        );

        factibilidadSetRadio(
            form,
            "existeDisponibilidadAgua",
            record.existeDisponibilidadAgua
        );

        factibilidadSetRadio(
            form,
            "existePrevistaRed",
            record.existePrevistaRed
        );


        FACT_PROPERTY_TYPES.forEach(
            function (
                option
            ) {

                form.elements[
                    option[0]
                ].checked =
                    Boolean(
                        record[
                        option[0]
                        ]
                    );
            }
        );


        const selectedReasons =
            Array.isArray(
                record.motivosNegacion
            )
                ? record.motivosNegacion
                : [];

        form
            .querySelectorAll(
                'input[name="motivosNegacion"]'
            )
            .forEach(
                function (
                    checkbox
                ) {

                    checkbox.checked =
                        selectedReasons.includes(
                            checkbox.value
                        );
                }
            );


        factibilidadState.existingImageRemoved = false;

        const existingImageSource = String(
            record.imagenFrenteURL ||
            record.imagenFrenteJSON?.url ||
            ""
        ).trim();

        factibilidadState.existingImageSource =
            existingImageSource;

        if (existingImageSource) {

            factibilidadShowImage(
                existingImageSource,
                false
            );
        }


        factibilidadSyncConditions();
    }


    function factibilidadValidateForm(
        form
    ) {

        if (form.elements.altitud) {
            form.elements.altitud.required = false;
        }

        if (form.elements.precisionGPS) {
            form.elements.precisionGPS.required = false;
        }

        factibilidadSyncConditions();

        if (
            !form.reportValidity()
        ) {

            factibilidadSetStatus(
                "Revise los campos obligatorios.",
                "error"
            );

            return false;
        }


        const hasType =
            FACT_PROPERTY_TYPES.some(
                function (
                    option
                ) {

                    return form.elements[
                        option[0]
                    ].checked;
                }
            );


        if (
            !hasType
        ) {

            factibilidadSetStatus(
                "Seleccione al menos un tipo de propiedad.",
                "error"
            );

            return false;
        }


        if (
            form.elements.tipoOtro.checked &&
            !form.elements.tipoOtroDescripcion.value.trim()
        ) {

            factibilidadSetStatus(
                "Describa el otro tipo de propiedad.",
                "error"
            );

            form.elements.tipoOtroDescripcion.focus();

            return false;
        }


        const minimum =
            Number(
                form.elements.presionMinimaPSI.value
            );

        const maximum =
            Number(
                form.elements.presionMaximaPSI.value
            );


        if (
            maximum <
            minimum
        ) {

            factibilidadSetStatus(
                "La presión máxima no puede ser menor que la mínima.",
                "error"
            );

            form.elements.presionMaximaPSI.focus();

            return false;
        }


        const availability =
            factibilidadRadioValue(
                form,
                "existeDisponibilidadAgua"
            );


        if (
            availability ===
            "No" &&
            !form.querySelector(
                'input[name="motivosNegacion"]:checked'
            )
        ) {

            factibilidadSetStatus(
                "Seleccione al menos un motivo de negación.",
                "error"
            );

            return false;
        }


        const existingImage =
            factibilidadState.existingImageSource &&
            !factibilidadState.existingImageRemoved;


        if (
            !factibilidadState.newImage &&
            !existingImage
        ) {

            factibilidadSetStatus(
                "Adjunte la fotografía del frente de la propiedad.",
                "error"
            );

            return false;
        }


        return true;
    }


    function factibilidadCollectForm(
        form
    ) {

        const reasons =
            Array.from(
                form.querySelectorAll(
                    'input[name="motivosNegacion"]:checked'
                )
            )
                .map(
                    function (
                        checkbox
                    ) {

                        return checkbox.value;
                    }
                );


        const value =
            function (
                name
            ) {

                return form.elements[
                    name
                ]
                    ? form.elements[
                        name
                    ].value.trim()
                    : "";
            };


        const record = {

            id:
                value(
                    "id"
                ),

            nombreSolicitante:
                value(
                    "nombreSolicitante"
                ),

            direccion:
                value(
                    "direccion"
                ),

            ruta:
                value(
                    "ruta"
                ),

            existePaja:
                factibilidadRadioValue(
                    form,
                    "existePaja"
                ),

            numeroPaja:
                value(
                    "numeroPaja"
                ),

            tipoCasa:
                form.elements.tipoCasa.checked,

            tipoBodega:
                form.elements.tipoBodega.checked,

            tipoComercio:
                form.elements.tipoComercio.checked,

            tipoCabana:
                form.elements.tipoCabana.checked,

            tipoPlantacion:
                form.elements.tipoPlantacion.checked,

            tipoLote:
                form.elements.tipoLote.checked,

            tipoOtro:
                form.elements.tipoOtro.checked,

            tipoOtroDescripcion:
                value(
                    "tipoOtroDescripcion"
                ),

            presionMinimaPSI:
                value(
                    "presionMinimaPSI"
                ),

            presionMaximaPSI:
                value(
                    "presionMaximaPSI"
                ),

            caudalReservado:
                value(
                    "caudalReservado"
                ),

            existeTuberiaFrente:
                factibilidadRadioValue(
                    form,
                    "existeTuberiaFrente"
                ),

            diametroTuberia:
                value(
                    "diametroTuberia"
                ),

            existeDisponibilidadAgua:
                factibilidadRadioValue(
                    form,
                    "existeDisponibilidadAgua"
                ),

            motivosNegacion:
                reasons,

            ubicacionMedidor:
                value(
                    "ubicacionMedidor"
                ),

            longitudX:
                value(
                    "longitudX"
                ),

            latitudY:
                value(
                    "latitudY"
                ),

            altitud:
                value(
                    "altitud"
                ),

            precisionGPS:
                value(
                    "precisionGPS"
                ),

            existePrevistaRed:
                factibilidadRadioValue(
                    form,
                    "existePrevistaRed"
                ),

            materialCalle:
                value(
                    "materialCalle"
                ),

            modalidadMedicion:
                value(
                    "modalidadMedicion"
                ),

            diametroDispositivo:
                value(
                    "diametroDispositivo"
                ),

            observaciones:
                value(
                    "observaciones"
                ),

            inspeccionRealizadaPor:
                value(
                    "inspeccionRealizadaPor"
                ),

            fechaHoraInspeccion:
                value(
                    "fechaHoraInspeccion"
                ),

            imagenFrenteArchivo:
                factibilidadState.newImage

        };


        return record;
    }


    /* =========================================================
       GPS E IMAGEN
       ========================================================= */

    function factibilidadCaptureGps(
        form
    ) {

        const status =
            document.getElementById(
                "factGpsStatus"
            );


        if (
            !navigator.geolocation
        ) {

            status.textContent =
                "El dispositivo no permite capturar GPS.";

            return;
        }


        status.textContent =
            "Obteniendo ubicación...";


        navigator.geolocation.getCurrentPosition(

            function (
                position
            ) {

                form.elements.longitudX.value =
                    position.coords.longitude.toFixed(
                        7
                    );

                form.elements.latitudY.value =
                    position.coords.latitude.toFixed(
                        7
                    );

                form.elements.precisionGPS.value =
                    position.coords.accuracy
                        ? position.coords.accuracy.toFixed(
                            2
                        )
                        : "";

                form.elements.altitud.value =
                    position.coords.altitude !==
                        null
                        ? position.coords.altitude.toFixed(
                            2
                        )
                        : "";

                const capturedAccuracy =
                    Number(
                        position.coords.accuracy
                    );


                status.textContent =

                    Number.isFinite(
                        capturedAccuracy
                    )

                        ? "Ubicación aceptada correctamente. Precisión aproximada: " +
                        Math.round(
                            capturedAccuracy
                        ) +
                        " m."

                        : "Ubicación capturada correctamente.";


                /*
                    El mapa escucha este evento para colocar el
                    marcador en la ubicación recién capturada.
                */

                document.dispatchEvent(
                    new CustomEvent(
                        "factibilidad:gps-captured",
                        {
                            detail: {
                                longitude:
                                    form.elements.longitudX.value,

                                latitude:
                                    form.elements.latitudY.value,

                                altitude:
                                    form.elements.altitud.value,

                                accuracy:
                                    form.elements.precisionGPS.value
                            }
                        }
                    )
                );

            },

            function (
                error
            ) {

                const messages = {

                    1:
                        "Debe permitir el acceso a la ubicación.",

                    2:
                        "No fue posible determinar la ubicación.",

                    3:
                        "La captura de ubicación tardó demasiado."

                };


                status.textContent =
                    messages[
                    error.code
                    ] ||
                    "No fue posible capturar la ubicación.";
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


    function factibilidadCompressImage(
        file
    ) {

        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            return Promise.reject(
                new Error(
                    "Seleccione una imagen válida."
                )
            );
        }


        if (
            file.size >
            10 * 1024 * 1024
        ) {

            return Promise.reject(
                new Error(
                    "La imagen original no puede superar 10 MB."
                )
            );
        }


        return new Promise(
            function (
                resolve,
                reject
            ) {

                const reader =
                    new FileReader();


                reader.onerror =
                    function () {

                        reject(
                            new Error(
                                "No fue posible leer la fotografía."
                            )
                        );
                    };


                reader.onload =
                    function () {

                        const image =
                            new Image();


                        image.onerror =
                            function () {

                                reject(
                                    new Error(
                                        "La fotografía seleccionada no es válida."
                                    )
                                );
                            };


                        image.onload =
                            function () {

                                const maximum =
                                    1600;

                                const scale =
                                    Math.min(
                                        1,
                                        maximum /
                                        Math.max(
                                            image.width,
                                            image.height
                                        )
                                    );

                                const width =
                                    Math.round(
                                        image.width *
                                        scale
                                    );

                                const height =
                                    Math.round(
                                        image.height *
                                        scale
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

                                context.fillStyle =
                                    "#ffffff";

                                context.fillRect(
                                    0,
                                    0,
                                    width,
                                    height
                                );

                                context.drawImage(
                                    image,
                                    0,
                                    0,
                                    width,
                                    height
                                );

                                const data =
                                    canvas.toDataURL(
                                        "image/jpeg",
                                        0.82
                                    );

                                resolve({

                                    name:
                                        file.name.replace(
                                            /\.[^.]+$/,
                                            ""
                                        ) +
                                        ".jpg",

                                    type:
                                        "image/jpeg",

                                    data:
                                        data,

                                    size:
                                        Math.round(
                                            (
                                                data.length -
                                                data.indexOf(
                                                    ","
                                                ) -
                                                1
                                            ) *
                                            0.75
                                        )

                                });
                            };


                        image.src =
                            reader.result;
                    };


                reader.readAsDataURL(
                    file
                );
            }
        );
    }


    function factibilidadShowImage(
        source,
        isNew
    ) {

        const box =
            document.getElementById(
                "factImagePreviewBox"
            );

        const image =
            document.getElementById(
                "factImagePreview"
            );


        if (
            !box ||
            !image
        ) {

            return;
        }


        image.src =
            source;

        box.hidden =
            false;

        const removeButton =
            document.getElementById(
                "factRemoveImageButton"
            );

        if (removeButton) {
            removeButton.hidden = false;
            removeButton.textContent = isNew
                ? "Quitar fotografía"
                : "Quitar fotografía existente";
        }
    }


    function factibilidadClearNewImage() {
        factibilidadState.newImage = null;
        window.ASADA_FACTIBILIDAD_DRAFT_IMAGE = null;

        const input = document.getElementById("factFrontImage");

        if (input) {
            input.value = "";
        }

        const existingSource = factibilidadState.existingImageSource;

        if (existingSource && !factibilidadState.existingImageRemoved) {
            factibilidadShowImage(existingSource, false);
            return;
        }

        const box = document.getElementById("factImagePreviewBox");
        const image = document.getElementById("factImagePreview");

        if (image) {
            image.removeAttribute("src");
        }

        if (box) {
            box.hidden = true;
        }
    }


    function factibilidadRemoveImage() {
        if (factibilidadState.newImage) {
            factibilidadClearNewImage();
            return;
        }

        if (factibilidadState.existingImageSource) {
            factibilidadState.existingImageRemoved = true;
            factibilidadClearNewImage();
            factibilidadSetStatus(
                "Fotografía quitada. Seleccione una nueva para reemplazarla.",
                ""
            );
        }
    }


    async function factibilidadLoadEditImagePreview(record) {
        if (!record || !record.id || factibilidadState.newImage) {
            return;
        }

        try {
            const response = await factibilidadCall(
                "getFactibilidadImageData",
                { id: record.id }
            );
            const data = typeof response === "string"
                ? response
                : response && response.data
                    ? response.data
                    : response && response.image
                        ? response.image.data || ""
                        : "";

            if (data && !factibilidadState.newImage && !factibilidadState.existingImageRemoved) {
                factibilidadState.existingImageSource = data;
                factibilidadShowImage(data, false);
            }
        } catch (error) {
            // Si Drive no devuelve la imagen, se conserva la URL existente como respaldo.
        }
    }


    window.factibilidadClearNewImage = factibilidadClearNewImage;
    window.factibilidadRemoveImage = factibilidadRemoveImage;


    /* =========================================================
       LISTADO
       ========================================================= */

    async function initFactibilidadList(
        root
    ) {

        root.innerHTML = `
        <header class="fact-hero">

            <span class="fact-eyebrow">
                ASADA OROSI
            </span>

            <h1>
                Inspecciones de factibilidad
            </h1>

            <p>
                Consulte, edite y genere el reporte de cada inspección.
            </p>

            <a
                class="fact-primary-button"
                href="crear-factibilidad.html">

                Crear inspección

            </a>

        </header>


        <section class="fact-filter-panel">

            <label class="fact-field">

                <span>
                    Buscar
                </span>

                <input
                    id="factSearch"
                    type="search"
                    placeholder="Nombre, ID, dirección o ruta">

            </label>


            <label class="fact-field">

                <span>
                    Disponibilidad de agua
                </span>

                <select id="factAvailabilityFilter">

                    <option value="">
                        Todas
                    </option>

                    <option value="Si">
                        Disponible
                    </option>

                    <option value="No">
                        No disponible
                    </option>

                </select>

            </label>

        </section>


        <div
            id="factListStatus"
            class="fact-status">
            Cargando inspecciones...
        </div>

        <section
            id="factRecordsList"
            class="fact-record-list">
        </section>
    `;


        document
            .getElementById(
                "factSearch"
            )
            .addEventListener(
                "input",
                factibilidadFilterList
            );

        document
            .getElementById(
                "factAvailabilityFilter"
            )
            .addEventListener(
                "change",
                factibilidadFilterList
            );


        try {

            factibilidadState.records =
                await factibilidadGetAll();

            factibilidadFilterList();

        } catch (
        error
        ) {

            document.getElementById(
                "factListStatus"
            ).textContent =
                error.message;
        }
    }


    function factibilidadFilterList() {

        const search =
            factibilidadNormalizeSearch(
                document
                    .getElementById(
                        "factSearch"
                    )
                    .value
            );

        const availability =
            document
                .getElementById(
                    "factAvailabilityFilter"
                )
                .value;

        const records =
            factibilidadState.records.filter(
                function (
                    record
                ) {

                    const searchable =
                        factibilidadNormalizeSearch(
                            [
                                record.id,
                                record.nombreSolicitante,
                                record.direccion,
                                record.ruta,
                                record.inspeccionRealizadaPor
                            ]
                                .join(
                                    " "
                                )
                        );

                    const matchesText =
                        !search ||
                        searchable.includes(
                            search
                        );

                    const matchesAvailability =
                        !availability ||
                        (
                            availability ===
                                "Si"
                                ? record.existeDisponibilidadAgua
                                : !record.existeDisponibilidadAgua
                        );


                    return (
                        matchesText &&
                        matchesAvailability
                    );
                }
            );


        factibilidadRenderList(
            records
        );
    }


    function factibilidadRenderList(
        records
    ) {

        const status =
            document.getElementById(
                "factListStatus"
            );

        const list =
            document.getElementById(
                "factRecordsList"
            );


        if (
            !records.length
        ) {

            status.textContent =
                "No se encontraron inspecciones.";

            list.innerHTML =
                "";

            return;
        }


        status.textContent =
            records.length ===
                1
                ? "1 inspección encontrada."
                : records.length +
                " inspecciones encontradas.";


        list.innerHTML =
            records

                .map(
                    function (
                        record
                    ) {

                        const available =
                            record.existeDisponibilidadAgua;

                        return `
                        <article class="fact-record-card">

                            <div class="fact-record-header">

                                <div>

                                    <span class="fact-record-id">
                                        ${factibilidadEscape(record.id)}
                                    </span>

                                    <h2>
                                        ${factibilidadEscape(record.nombreSolicitante)}
                                    </h2>

                                </div>

                                <span class="fact-badge ${available
                                ? "is-approved"
                                : "is-denied"}">

                                    ${available
                                ? "Agua disponible"
                                : "Sin disponibilidad"}

                                </span>

                            </div>


                            <dl class="fact-record-data">

                                <div>
                                    <dt>Fecha</dt>
                                    <dd>${factibilidadEscape(
                                    factibilidadDisplayDate(
                                        record.fechaHoraInspeccion
                                    )
                                )}</dd>
                                </div>

                                <div>
                                    <dt>Ruta</dt>
                                    <dd>${factibilidadEscape(record.ruta || "No indicada")}</dd>
                                </div>

                                <div>
                                    <dt>Inspector</dt>
                                    <dd>${factibilidadEscape(
                                    record.inspeccionRealizadaPor ||
                                    "No indicado"
                                )}</dd>
                                </div>

                            </dl>


                            <div class="fact-card-actions">

                                <a
                                    class="fact-primary-button"
                                    href="detalle-factibilidad.html?id=${encodeURIComponent(record.id)}">

                                    Ver detalle

                                </a>

                                <a
                                    class="fact-secondary-button"
                                    href="crear-factibilidad.html?id=${encodeURIComponent(record.id)}">

                                    Editar

                                </a>

                            </div>

                        </article>
                    `;
                    }
                )

                .join(
                    ""
                );
    }


    /* =========================================================
       DETALLE
       ========================================================= */

    async function initFactibilidadDetail(
        root
    ) {

        const id =
            factibilidadQuery(
                "id"
            );


        if (
            !id
        ) {

            root.innerHTML =
                factibilidadErrorTemplate(
                    "No se indicó el ID de la inspección."
                );

            return;
        }


        root.innerHTML = `
        <div class="fact-status">
            Cargando inspección...
        </div>
    `;


        try {

            const record =
                await factibilidadGetById(
                    id
                );


            if (
                !record
            ) {

                throw new Error(
                    "No se encontró la inspección solicitada."
                );
            }


            factibilidadState.currentRecord =
                record;

            factibilidadRenderDetail(
                root,
                record
            );

        } catch (
        error
        ) {

            root.innerHTML =
                factibilidadErrorTemplate(
                    error.message
                );
        }
    }


    function factibilidadRenderDetail(
        root,
        record
    ) {

        const types =
            factibilidadPropertyTypes(
                record
            );

        const hasImage = Boolean(
            record.imagenFrenteURL ||
            record.imagenFrenteJSON?.id ||
            record.imagenFrenteJSON?.fileId
        );

        const reportUrl =
            factibilidadSafeUrl(
                record.reportePDFURL
            );


        root.innerHTML = `
        <header class="fact-hero">

            <span class="fact-eyebrow">
                INSPECCIÓN ${factibilidadEscape(record.id)}
            </span>

            <h1>
                ${factibilidadEscape(record.nombreSolicitante)}
            </h1>

            <p>
                Inspección de factibilidad de agua potable.
            </p>

            <div class="fact-actions-row">

                <a
                    class="fact-secondary-button"
                    href="factibilidades.html">

                    Volver al listado

                </a>

                <a
                    class="fact-secondary-button"
                    href="crear-factibilidad.html?id=${encodeURIComponent(record.id)}">

                    Editar

                </a>

                <button
                    id="factPdfButton"
                    type="button"
                    class="fact-primary-button">

                    Generar PDF

                </button>

            </div>

            <div
                id="factPdfStatus"
                class="fact-status"
                aria-live="polite">
            </div>

            ${reportUrl
                ? `
                    <a
                        class="fact-report-link"
                        href="${factibilidadEscape(reportUrl)}"
                        target="_blank"
                        rel="noopener">

                        Abrir último PDF guardado

                    </a>
                `
                : ""}

        </header>


        ${factibilidadDetailSection(
                    "Información del solicitante",
                    [
                        [
                            "ID",
                            record.id
                        ],
                        [
                            "Nombre del solicitante",
                            record.nombreSolicitante
                        ],
                        [
                            "Dirección",
                            record.direccion
                        ],
                        [
                            "Ruta",
                            record.ruta
                        ],
                        [
                            "Fecha y hora",
                            factibilidadDisplayDate(
                                record.fechaHoraInspeccion
                            )
                        ]
                    ]
                )}


        ${factibilidadDetailSection(
                    "Información de la propiedad",
                    [
                        [
                            "Existe paja",
                            factibilidadYesNo(
                                record.existePaja
                            )
                        ],
                        [
                            "Número de paja",
                            record.existePaja
                                ? record.numeroPaja
                                : "No aplica"
                        ],
                        [
                            "Tipo de propiedad",
                            types
                        ]
                    ]
                )}


        ${factibilidadDetailSection(
                    "Condiciones hidráulicas",
                    [
                        [
                            "Presión mínima",
                            record.presionMinimaPSI +
                            " PSI"
                        ],
                        [
                            "Presión máxima",
                            record.presionMaximaPSI +
                            " PSI"
                        ],
                        [
                            "Caudal reservado",
                            record.caudalReservado +
                            " m³/día"
                        ],
                        [
                            "Tubería frente a la propiedad",
                            factibilidadYesNo(
                                record.existeTuberiaFrente
                            )
                        ],
                        [
                            "Diámetro de tubería",
                            record.existeTuberiaFrente
                                ? record.diametroTuberia
                                : "No aplica"
                        ],
                        [
                            "Disponibilidad de agua",
                            factibilidadYesNo(
                                record.existeDisponibilidadAgua
                            )
                        ],
                        [
                            "Motivos de negación",
                            record.existeDisponibilidadAgua
                                ? "No aplica"
                                : (Array.isArray(record.motivosNegacion) && record.motivosNegacion.length
                                    ? record.motivosNegacion
                                    : "No indicado")
                        ],
                        [
                            "Ubicación del medidor",
                            record.existeDisponibilidadAgua
                                ? record.ubicacionMedidor
                                : "No aplica"
                        ]
                    ]
                )}

        <section class="fact-panel fact-location-panel">
            <div class="fact-section-heading">
                <span>4</span>
                <div>
                    <h2>Ubicación geográfica</h2>
                    <p>Lugar, dirección o referencia y punto registrado.</p>
                </div>
            </div>

            <div class="fact-location-reference">
                <span>LUGAR, DIRECCIÓN O REFERENCIA</span>
                <strong>${factibilidadEscape(record.direccion || "No indicada")}</strong>
            </div>

            <div class="fact-location-coordinates">
                <div>
                    <span>COORDENADA Y - LATITUD</span>
                    <strong>${factibilidadEscape(record.latitudY)}</strong>
                </div>
                <div>
                    <span>COORDENADA X - LONGITUD</span>
                    <strong>${factibilidadEscape(record.longitudX)}</strong>
                </div>
                <div>
                    <span>ALTITUD (M)</span>
                    <strong>${factibilidadEscape(record.altitud !== "" ? record.altitud : "No disponible")}</strong>
                </div>
                <div>
                    <span>PRECISIÓN (M)</span>
                    <strong>${factibilidadEscape(record.precisionGPS !== "" ? record.precisionGPS : "No disponible")}</strong>
                </div>
            </div>

            <div class="fact-detail-map-wrapper">
                <h3>Mapa de la ubicación registrada</h3>
                <div
                    id="factDetailMap"
                    class="fact-detail-map"
                    data-latitude="${factibilidadEscape(record.latitudY)}"
                    data-longitude="${factibilidadEscape(record.longitudX)}">
                </div>
            </div>
        </section>


        ${factibilidadDetailSection(
                    "Red y dispositivo de medición",
                    [
                        [
                            "Existe prevista a la red",
                            factibilidadYesNo(
                                record.existePrevistaRed
                            )
                        ],
                        [
                            "Material de la calle",
                            record.materialCalle || "No indicado"
                        ],
                        [
                            "Modalidad de medición",
                            record.modalidadMedicion || "No indicado"
                        ],
                        [
                            "Diámetro del dispositivo",
                            record.diametroDispositivo || "No indicado"
                        ]
                    ]
                )}


        <section class="fact-panel">

            <div class="fact-section-heading">

                <span>6</span>

                <div>
                    <h2>Fotografía del frente</h2>
                    <p>Evidencia registrada durante la inspección.</p>
                </div>

            </div>

            ${hasImage
                ? `
                    <figure class="fact-detail-image">

                        <img
                            id="factDetailImage"
                            src=""
                            alt="Frente de la propiedad">

                    </figure>
                `
                : `
                    <p class="fact-empty">
                        No hay fotografía disponible.
                    </p>
                `}

        </section>


        ${factibilidadDetailSection(
                    "Observaciones y responsable",
                    [
                        [
                            "Observaciones",
                            record.observaciones ||
                            "Sin observaciones"
                        ],
                        [
                            "Inspección realizada por",
                            record.inspeccionRealizadaPor
                        ],
                        [
                            "Fecha de creación",
                            factibilidadDisplayDate(
                                record.fechaCreacion
                            )
                        ],
                        [
                            "Última actualización",
                            factibilidadDisplayDate(
                                record.fechaActualizacion
                            )
                        ]
                    ]
                )}
    `;


        window.setTimeout(
            function () {
                initializeFactibilidadDetailMap();
                loadPrivateFactibilidadImage(record.id);
            },
            0
        );

        document
            .getElementById(
                "factPdfButton"
            )
            .addEventListener(
                "click",
                async function () {

                    const button =
                        this;

                    const status =
                        document.getElementById(
                            "factPdfStatus"
                        );


                    button.disabled =
                        true;

                    status.textContent =
                        "Generando y guardando reporte...";

                    status.className =
                        "fact-status is-loading";


                    try {

                        const result =
                            await factibilidadGeneratePdf(
                                record
                            );


                        if (
                            result &&
                            result.reportePDFURL
                        ) {

                            record.reportePDFURL =
                                result.reportePDFURL;
                        }


                        status.textContent =
                            "El PDF fue generado, descargado y guardado en Drive.";

                        status.className =
                            "fact-status is-success";


                        setTimeout(
                            function () {

                                factibilidadRenderDetail(
                                    root,
                                    record
                                );
                            },
                            900
                        );

                    } catch (
                    error
                    ) {

                        status.textContent =
                            error.message;

                        status.className =
                            "fact-status is-error";

                        button.disabled =
                            false;
                    }
                }
            );
    }


    async function loadPrivateFactibilidadImage(
        id
    ) {

        const image =
            document.getElementById(
                "factDetailImage"
            );

        if (
            !image
        ) {

            return;
        }

        try {

            const response =
                await factibilidadCall(
                    "getFactibilidadImageData",
                    {
                        id:
                            id
                    }
                );

            const data =
                typeof response ===
                    "string"
                    ? response
                    : response &&
                        response.data
                        ? response.data
                        : "";

            if (
                data
            ) {

                image.src =
                    data;

            } else {

                image.alt =
                    "No fue posible cargar la fotografía";
            }

        } catch (
        error
        ) {

            image.alt =
                "No fue posible cargar la fotografía";

            console.warn(
                "No fue posible cargar la fotografía privada de factibilidad.",
                error
            );
        }
    }

    function initializeFactibilidadDetailMap() {
        const container =
            document.getElementById("factDetailMap");

        const Leaflet =
            window.ASADA_LEAFLET || window.L;

        if (!container || !Leaflet) {
            if (container) {
                container.innerHTML =
                    "<p class=\"fact-map-unavailable\">No fue posible cargar el mapa.</p>";
            }
            return;
        }

        const latitude =
            Number(container.dataset.latitude);

        const longitude =
            Number(container.dataset.longitude);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            container.innerHTML =
                "<p class=\"fact-map-unavailable\">No hay coordenadas disponibles.</p>";
            return;
        }

        const map =
            Leaflet.map(container, {
                zoomControl: true,
                attributionControl: true
            }).setView(
                [latitude, longitude],
                17
            );

        Leaflet.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution: "&copy; OpenStreetMap"
            }
        ).addTo(map);

        Leaflet.marker([
            latitude,
            longitude
        ])
            .addTo(map)
            .bindPopup("Ubicación de la inspección")
            .openPopup();

        window.setTimeout(
            function () {
                map.invalidateSize();
            },
            200
        );
    }


    function factibilidadDetailSection(
        title,
        values
    ) {

        return `
        <section class="fact-panel">

            <div class="fact-section-heading">

                <span></span>

                <div>
                    <h2>${factibilidadEscape(title)}</h2>
                </div>

            </div>

            <dl class="fact-detail-grid">

                ${values
                .map(
                    function (
                        pair
                    ) {

                        return `
                                <div>
                                    <dt>
                                        ${factibilidadEscape(pair[0])}
                                    </dt>

                                    <dd>
                                        ${factibilidadRenderValue(pair[1])}
                                    </dd>
                                </div>
                            `;
                    }
                )
                .join(
                    ""
                )}

            </dl>

        </section>
    `;
    }

    /* =========================================================
       PDF
       ========================================================= */

    async function factibilidadGeneratePdf(record) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            throw new Error("No se pudo cargar el generador de PDF.");
        }

        const jsPDF = window.jspdf.jsPDF;
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "letter",
            compress: true
        });

        if (typeof doc.autoTable !== "function") {
            throw new Error("No se pudo cargar el complemento de tablas del PDF.");
        }

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const left = 19;
        const right = 19;
        const tableWidth = pageWidth - left - right;

        doc.setProperties({
            title: "Reporte oficial de inspección de factibilidad de agua potable",
            subject: "Inspección de factibilidad de agua potable",
            author: "ASADA Orosi",
            creator: "Sistema de control de ASADA Orosi"
        });

        const logo = await factibilidadUrlToData("img/asada.png")
            .catch(() => "");

        const imageResponse = await factibilidadCall(
            "getFactibilidadImageData",
            { id: record.id }
        ).catch(() => null);

        // factibilidadCall puede devolver directamente la cadena data:image/...
        // porque el objeto recibido desde Apps Script también contiene una
        // propiedad llamada data. Se aceptan ambos formatos.
        const frontImage = typeof imageResponse === "string"
            ? imageResponse
            : imageResponse && imageResponse.data
                ? imageResponse.data
                : imageResponse && imageResponse.image
                    ? imageResponse.image.data || ""
                    : "";

        const mapResponse = await factibilidadCall(
            "getFactibilidadMapData",
            { id: record.id }
        ).catch(() => null);

        const reportMapImage = mapResponse
            ? typeof mapResponse === "string"
                ? mapResponse
                : mapResponse.data || mapResponse.map?.data || ""
            : "";

        if (!reportMapImage) {
            throw new Error(
                "No se pudo obtener el mapa. Verifique getFactibilidadMapData y publique una nueva versión de Apps Script."
            );
        }

        const isYes = value => {
            if (value === true || value === 1) {
                return true;
            }

            const text = String(value ?? "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .trim()
                .toLowerCase();

            return ["si", "true", "1", "yes", "y"].includes(text);
        };

        const yesNo = value => isYes(value) ? "Sí" : "No";
        const available = isYes(record.existeDisponibilidadAgua);
        const hasPaja = isYes(record.existePaja);
        const hasPipe = isYes(record.existeTuberiaFrente);
        const hasNetwork = isYes(record.existePrevistaRed);

        const formatLongDate = value => {
            if (!value) {
                return "No indicada";
            }

            const text = String(value).trim();
            const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
            const date = match
                ? new Date(
                    Number(match[1]),
                    Number(match[2]) - 1,
                    Number(match[3])
                )
                : new Date(text);

            if (Number.isNaN(date.getTime())) {
                return factibilidadDisplayDate(value);
            }

            const result = new Intl.DateTimeFormat("es-CR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }).format(date);

            return result.charAt(0).toLowerCase() + result.slice(1);
        };

        const textValue = value => {
            if (value === null || value === undefined || value === "") {
                return "No indicada";
            }

            return String(value);
        };

        const coordinate = value => textValue(value);

        const propertyTypes = factibilidadPropertyTypes(record);

        const addFirstPageHeader = () => {
            if (logo) {
                const logoFormat = /^data:image\/png/i.test(logo)
                    ? "PNG"
                    : "JPEG";

                doc.addImage(logo, logoFormat, 20, 17, 27, 27);
            }

            doc.setTextColor(0, 0, 0);
            doc.setFont("times", "bold");
            doc.setFontSize(15);
            doc.text("ASADA OROSI", pageWidth / 2, 31, { align: "center" });

            doc.setFontSize(12.5);
            doc.text(
                "REPORTE OFICIAL DE INSPECCIÓN DE",
                pageWidth / 2,
                39,
                { align: "center" }
            );
            doc.text(
                "FACTIBILIDAD DE AGUA POTABLE",
                pageWidth / 2,
                46,
                { align: "center" }
            );

            doc.setFontSize(11);
            doc.text(
                "Registro N.° " + textValue(record.id),
                pageWidth / 2,
                54,
                { align: "center" }
            );

            doc.setFont("times", "normal");
            doc.setFontSize(10.5);
            doc.text(
                formatLongDate(record.fechaHoraInspeccion || record.fechaCreacion),
                pageWidth / 2,
                61,
                { align: "center" }
            );

            doc.setDrawColor(100, 100, 100);
            doc.setLineWidth(0.25);
            doc.line(left, 69, pageWidth - right, 69);
        };

        addFirstPageHeader();

        let cursorY = 80;

        const addHeading = (number, title) => {
            doc.setFont("times", "bold");
            doc.setFontSize(10.8);
            doc.setTextColor(0, 0, 0);
            doc.text(
                number ? number + ". " + title : title,
                left,
                cursorY
            );
            cursorY += 5;
        };

        const ensureSpace = minimum => {
            if (cursorY + minimum > pageHeight - 31) {
                doc.addPage();
                cursorY = 25;
            }
        };

        const addTable = rows => {
            const body = rows.map(row => [
                String(row[0]),
                factibilidadPdfValue(row[1])
            ]);

            doc.autoTable({
                startY: cursorY,
                body,
                theme: "grid",
                margin: {
                    left,
                    right,
                    top: 18,
                    bottom: 39
                },
                tableWidth,
                styles: {
                    font: "times",
                    fontSize: 9.2,
                    cellPadding: 2.4,
                    lineColor: [0, 0, 0],
                    lineWidth: 0.25,
                    textColor: [0, 0, 0],
                    overflow: "linebreak",
                    valign: "top"
                },
                columnStyles: {
                    0: {
                        cellWidth: tableWidth * 0.49,
                        fontStyle: "bold",
                        fillColor: [239, 243, 243]
                    },
                    1: {
                        cellWidth: tableWidth * 0.51
                    }
                }
            });

            cursorY = doc.lastAutoTable.finalY + 9;
        };

        const addSection = (number, title, rows, minimumSpace = 35) => {
            ensureSpace(minimumSpace);
            addHeading(number, title);
            addTable(rows);
        };

        addSection(1, "Información general", [
            ["ID del registro", record.id],
            ["Fecha y hora", factibilidadDisplayDate(record.fechaHoraInspeccion)],
            ["Nombre del solicitante", record.nombreSolicitante],
            ["Dirección", record.direccion],
            ["Ruta", record.ruta]
        ]);

        addSection(2, "Información de la propiedad", [
            ["¿Existe una paja abasteciendo la propiedad?", yesNo(hasPaja)],
            ["Número de paja", hasPaja ? record.numeroPaja : "No aplica"],
            ["Tipo de propiedad", propertyTypes]
        ]);

        addSection(3, "Condiciones hidráulicas y de medición", [
            ["Presión mínima", textValue(record.presionMinimaPSI) + " PSI"],
            ["Presión máxima", textValue(record.presionMaximaPSI) + " PSI"],
            ["Caudal reservado", textValue(record.caudalReservado) + " m3/día"],
            ["¿Existe tubería frente a la propiedad?", yesNo(hasPipe)],
            ["Diámetro de la tubería", hasPipe ? record.diametroTuberia : "No aplica"],
            ["¿Existe disponibilidad de agua?", yesNo(available)],
            [
                "Motivos de negación",
                available
                    ? "No aplica"
                    : (Array.isArray(record.motivosNegacion) && record.motivosNegacion.length
                        ? record.motivosNegacion
                        : "No indicado")
            ],
            [
                "Ubicación prevista para el medidor",
                available ? record.ubicacionMedidor : "No aplica"
            ],
            ["¿Existe prevista a la red?", yesNo(hasNetwork)],
            ["Material de la calle", record.materialCalle || "No indicado"],
            ["Modalidad de medición", record.modalidadMedicion || "No indicado"],
            ["Diámetro del dispositivo", record.diametroDispositivo || "No indicado"]
        ], 45);

        addSection(4, "Ubicación geográfica", [
            ["Lugar, dirección o referencia", record.direccion || "No indicada"],
            ["Coordenada Y - Latitud", coordinate(record.latitudY)],
            ["Coordenada X - Longitud", coordinate(record.longitudX)],
            ["Altitud (m)", record.altitud !== "" ? record.altitud : "No disponible"],
            [
                "Precisión (m)",
                record.precisionGPS !== "" ? record.precisionGPS : "No disponible"
            ]
        ], 45);

        // El mapa continúa después de la tabla geográfica. Si ya no hay
        // espacio suficiente, pasa automáticamente a la página siguiente.
        ensureSpace(105);
        addHeading("", "Mapa de la ubicación registrada");

        const mapWidth = 126;
        const mapHeight = 74;
        const mapX = (pageWidth - mapWidth) / 2;

        doc.addImage(
            reportMapImage,
            "PNG",
            mapX,
            cursorY + 4,
            mapWidth,
            mapHeight
        );

        cursorY += mapHeight + 16;

        ensureSpace(60);
        addHeading(5, "Evidencia fotográfica");
        cursorY += 3;

        if (frontImage) {
            doc.setFont("times", "bold");
            doc.setFontSize(10);
            doc.text("Fotografía 1", left, cursorY);
            cursorY += 5;

            const properties = doc.getImageProperties(frontImage);
            const maxWidth = 106;
            const maxHeight = 98;
            let imageWidth = maxWidth;
            let imageHeight = imageWidth * properties.height / properties.width;

            if (imageHeight > maxHeight) {
                imageHeight = maxHeight;
                imageWidth = imageHeight * properties.width / properties.height;
            }

            if (cursorY + imageHeight > pageHeight - 36) {
                doc.addPage();
                cursorY = 25;
                addHeading(5, "Evidencia fotográfica");
                cursorY += 8;
            }

            const imageX = (pageWidth - imageWidth) / 2;
            const imageFormat = /^data:image\/png/i.test(frontImage)
                ? "PNG"
                : "JPEG";

            doc.addImage(
                frontImage,
                imageFormat,
                imageX,
                cursorY,
                imageWidth,
                imageHeight
            );

            cursorY += imageHeight + 12;
        } else {
            doc.setFont("times", "italic");
            doc.setFontSize(9.5);
            doc.text("No hay fotografía disponible.", left, cursorY + 8);
            cursorY += 22;
        }

        addSection(6, "Observaciones y responsable", [
            ["Observaciones", record.observaciones || "Sin observaciones"],
            ["Inspección realizada por", record.inspeccionRealizadaPor]
        ], 45);

        const pageCount = doc.internal.getNumberOfPages();
        const lastPage = pageCount;

        // El cierre institucional se coloca únicamente en la última página,
        // igual que en el documento de referencia.
        doc.setPage(lastPage);
        const footerY = pageHeight - 29;

        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.25);
        doc.line(left, footerY - 5, pageWidth - right, footerY - 5);

        doc.setFont("times", "normal");
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8.7);

        const footerText = doc.splitTextToSize(
            "Este documento corresponde al registro oficial de inspección de factibilidad de agua potable almacenado en el sistema de ASADA Orosi.",
            tableWidth
        );

        doc.text(footerText, left, footerY + 2);

        doc.setFont("times", "italic");
        doc.setFontSize(9);
        doc.text(
            "Documento generado electrónicamente por ASADA Orosi.",
            pageWidth / 2,
            pageHeight - 12,
            { align: "center" }
        );

        const filename = "Reporte_Factibilidad_" + record.id + ".pdf";

        const rawPdfData =
            doc.output("datauristring");

        // jsPDF puede devolver ;filename=... antes de ;base64.
        // Se normaliza para que Apps Script reciba un Data URL válido.
        const data = rawPdfData.replace(
            /^data:application\/pdf;[^,]*;base64,/i,
            "data:application/pdf;base64,"
        );

        const saved = await factibilidadCall(
            "saveFactibilidadPdf",
            {
                id: record.id,
                archivo: {
                    name: filename,
                    type: "application/pdf",
                    data
                }
            }
        );

        // Se descarga solamente después de guardar correctamente en Drive.
        doc.save(filename);

        return saved;
    }


    /* =========================================================
       UTILIDADES DE INTERFAZ
       ========================================================= */

    function factibilidadPropertyTypes(
        record
    ) {

        const values =
            FACT_PROPERTY_TYPES

                .filter(
                    function (
                        option
                    ) {

                        return Boolean(
                            record[
                            option[0]
                            ]
                        );
                    }
                )

                .map(
                    function (
                        option
                    ) {

                        if (
                            option[0] ===
                            "tipoOtro"
                        ) {

                            return record.tipoOtroDescripcion
                                ? "Otro: " +
                                record.tipoOtroDescripcion
                                : "Otro";
                        }


                        return option[1];
                    }
                );


        return values.length
            ? values.join(
                ", "
            )
            : "No indicado";
    }


    function factibilidadRenderValue(
        value
    ) {

        if (
            Array.isArray(
                value
            )
        ) {

            if (
                !value.length
            ) {

                return `
                <span class="fact-muted">
                    No aplica
                </span>
            `;
            }


            return `
            <ul class="fact-value-list">

                ${value
                    .map(
                        function (
                            item
                        ) {

                            return `
                                <li>
                                    ${factibilidadEscape(item)}
                                </li>
                            `;
                        }
                    )
                    .join(
                        ""
                    )}

            </ul>
        `;
        }


        if (
            value &&
            typeof value ===
            "object" &&
            value.url
        ) {

            return `
            <a
                href="${factibilidadEscape(
                factibilidadSafeUrl(
                    value.url
                )
            )}"
                target="_blank"
                rel="noopener">

                ${factibilidadEscape(value.text)}

            </a>
        `;
        }


        const text =
            value === null ||
                value === undefined ||
                value === ""
                ? "No indicado"
                : String(
                    value
                );


        return factibilidadEscape(
            text
        );
    }


    function factibilidadPdfValue(
        value
    ) {

        if (
            Array.isArray(
                value
            )
        ) {

            return value.length
                ? value
                    .map(
                        function (
                            item,
                            index
                        ) {

                            return (
                                index + 1
                            ) +
                                ". " +
                                item;
                        }
                    )
                    .join(
                        "\n"
                    )
                : "No aplica";
        }


        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return "No indicado";
        }


        return String(
            value
        );
    }


    function factibilidadSetRadio(
        form,
        name,
        booleanValue
    ) {

        form
            .querySelectorAll(
                'input[name="' +
                name +
                '"]'
            )
            .forEach(
                function (
                    radio
                ) {

                    radio.checked =
                        radio.value ===
                        (
                            booleanValue
                                ? "Si"
                                : "No"
                        );
                }
            );
    }


    function factibilidadRadioValue(
        form,
        name
    ) {

        const selected =
            form.querySelector(
                'input[name="' +
                name +
                '"]:checked'
            );


        return selected
            ? selected.value
            : "";
    }


    function factibilidadSetStatus(
        message,
        type
    ) {

        const status =
            document.getElementById(
                "factFormStatus"
            );


        if (
            !status
        ) {

            return;
        }


        status.textContent =
            message;

        status.className =
            "fact-status" +
            (
                type
                    ? " is-" +
                    type
                    : ""
            );
    }


    function factibilidadYesNo(
        value
    ) {

        return value
            ? "Sí"
            : "No";
    }


    function factibilidadDisplayDate(
        value
    ) {

        if (
            !value
        ) {

            return "No indicada";
        }


        return String(
            value
        )
            .replace(
                "T",
                " "
            )
            .replace(
                /(\d{2}:\d{2}):\d{2}$/,
                "$1"
            );
    }


    function factibilidadInputDate(
        value
    ) {

        if (
            !value
        ) {

            return "";
        }


        return String(
            value
        )
            .replace(
                " ",
                "T"
            )
            .slice(
                0,
                16
            );
    }


    function factibilidadNowInput() {

        const now =
            new Date();

        const offset =
            now.getTimezoneOffset();

        const local =
            new Date(
                now.getTime() -
                offset *
                60000
            );


        return local
            .toISOString()
            .slice(
                0,
                16
            );
    }


    function factibilidadQuery(
        name
    ) {

        return new URLSearchParams(
            window.location.search
        )
            .get(
                name
            ) ||
            "";
    }


    function factibilidadNormalizeSearch(
        value
    ) {

        return String(
            value ||
            ""
        )
            .normalize(
                "NFD"
            )
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .toLowerCase()
            .trim();
    }


    function factibilidadSafeUrl(
        value
    ) {

        const text =
            String(
                value ||
                ""
            )
                .trim();


        return /^https?:\/\//i.test(
            text
        )
            ? text
            : "";
    }


    function factibilidadEscape(
        value
    ) {

        return String(
            value === null ||
                value === undefined
                ? ""
                : value
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }


    function factibilidadUrlToData(
        url
    ) {

        return fetch(
            url
        )
            .then(
                function (
                    response
                ) {

                    if (
                        !response.ok
                    ) {

                        throw new Error(
                            "No se pudo cargar la imagen."
                        );
                    }


                    return response.blob();
                }
            )
            .then(
                function (
                    blob
                ) {

                    return new Promise(
                        function (
                            resolve,
                            reject
                        ) {

                            const reader =
                                new FileReader();

                            reader.onload =
                                function () {

                                    resolve(
                                        reader.result
                                    );
                                };

                            reader.onerror =
                                reject;

                            reader.readAsDataURL(
                                blob
                            );
                        }
                    );
                }
            );
    }


    function factibilidadErrorTemplate(
        message
    ) {

        return `
        <section class="fact-panel fact-error-panel">

            <h1>
                No fue posible mostrar la inspección
            </h1>

            <p>
                ${factibilidadEscape(message)}
            </p>

            <a
                class="fact-primary-button"
                href="factibilidades.html">

                Volver al listado

            </a>

        </section>
    `;
    }

    /* =========================================================
       ADAPTAR FACTIBILIDAD AL DISEÑO GENERAL
       ========================================================= */

    (function installFactibilidadStyleAdapter() {

        function addClasses(
            root,
            selector,
            classes
        ) {

            root
                .querySelectorAll(
                    selector
                )
                .forEach(
                    function (
                        element
                    ) {

                        classes.forEach(
                            function (
                                className
                            ) {

                                element.classList.add(
                                    className
                                );
                            }
                        );
                    }
                );
        }


        function syncChoices(
            root
        ) {

            root
                .querySelectorAll(
                    ".choice, .multi-choice"
                )
                .forEach(
                    function (
                        choice
                    ) {

                        const input =
                            choice.querySelector(
                                'input[type="radio"], input[type="checkbox"]'
                            );

                        choice.classList.toggle(
                            "selected",
                            Boolean(
                                input &&
                                input.checked
                            )
                        );
                    }
                );
        }


        function applyStyles(
            root
        ) {

            root.classList.add(
                "factibility-module"
            );


            /* ---------------------------------------------
               CLASES COMPARTIDAS
               --------------------------------------------- */

            addClasses(
                root,
                ".fact-hero",
                [
                    "page-head"
                ]
            );

            addClasses(
                root,
                ".fact-eyebrow",
                [
                    "eyebrow"
                ]
            );

            addClasses(
                root,
                ".fact-primary-button",
                [
                    "btn",
                    "primary"
                ]
            );

            addClasses(
                root,
                ".fact-secondary-button",
                [
                    "btn",
                    "secondary"
                ]
            );

            addClasses(
                root,
                ".fact-status, .fact-inline-status, .fact-muted, .fact-empty",
                [
                    "note"
                ]
            );

            addClasses(
                root,
                ".fact-error-panel",
                [
                    "empty-state"
                ]
            );

            addClasses(
                root,
                ".fact-hero .fact-actions-row",
                [
                    "nav-actions"
                ]
            );


            /* ---------------------------------------------
               FORMULARIO
               --------------------------------------------- */

            if (
                root.dataset.view ===
                "form"
            ) {

                addClasses(
                    root,
                    ".fact-form",
                    [
                        "form-shell"
                    ]
                );

                addClasses(
                    root,
                    ".fact-panel",
                    [
                        "form-section"
                    ]
                );

                addClasses(
                    root,
                    ".fact-grid",
                    [
                        "form-grid"
                    ]
                );

                addClasses(
                    root,
                    ".fact-inline-options",
                    [
                        "choice-row"
                    ]
                );

                addClasses(
                    root,
                    ".fact-choice-grid, .fact-check-list",
                    [
                        "multi-grid"
                    ]
                );

                addClasses(
                    root,
                    ".fact-conditional",
                    [
                        "detail-field"
                    ]
                );

                addClasses(
                    root,
                    ".fact-image-preview",
                    [
                        "photo-grid"
                    ]
                );

                addClasses(
                    root,
                    ".fact-submit-panel",
                    [
                        "form-actions"
                    ]
                );

                addClasses(
                    root,
                    ".fact-section-heading p, .fact-field small",
                    [
                        "note"
                    ]
                );


                root
                    .querySelectorAll(
                        ".fact-choice"
                    )
                    .forEach(
                        function (
                            choice
                        ) {

                            const radio =
                                choice.querySelector(
                                    'input[type="radio"]'
                                );


                            choice.classList.add(
                                radio
                                    ? "choice"
                                    : "multi-choice"
                            );
                        }
                    );


                addClasses(
                    root,
                    ".fact-check",
                    [
                        "multi-choice"
                    ]
                );
            }


            /* ---------------------------------------------
               LISTADO
               --------------------------------------------- */

            if (
                root.dataset.view ===
                "list"
            ) {

                addClasses(
                    root,
                    ".fact-filter-panel",
                    [
                        "record-filters",
                        "record-filter-grid"
                    ]
                );

                addClasses(
                    root,
                    ".fact-record-list",
                    [
                        "records-list"
                    ]
                );

                addClasses(
                    root,
                    ".fact-record-card",
                    [
                        "record-card"
                    ]
                );

                addClasses(
                    root,
                    ".fact-record-header",
                    [
                        "record-card-top"
                    ]
                );

                addClasses(
                    root,
                    ".fact-record-id",
                    [
                        "record-label"
                    ]
                );

                addClasses(
                    root,
                    ".fact-record-data",
                    [
                        "record-data-grid"
                    ]
                );

                addClasses(
                    root,
                    ".fact-record-data > div",
                    [
                        "record-data"
                    ]
                );

                addClasses(
                    root,
                    ".fact-card-actions",
                    [
                        "record-card-actions"
                    ]
                );

                addClasses(
                    root,
                    ".fact-badge",
                    [
                        "tag"
                    ]
                );
            }


            /* ---------------------------------------------
               DETALLE
               --------------------------------------------- */

            if (
                root.dataset.view ===
                "detail"
            ) {

                addClasses(
                    root,
                    ".fact-panel",
                    [
                        "detail-card"
                    ]
                );

                addClasses(
                    root,
                    ".fact-section-heading",
                    [
                        "detail-card-header"
                    ]
                );

                addClasses(
                    root,
                    ".fact-detail-grid",
                    [
                        "detail-grid"
                    ]
                );

                addClasses(
                    root,
                    ".fact-detail-grid > div",
                    [
                        "detail-field"
                    ]
                );

                addClasses(
                    root,
                    ".fact-detail-grid dt",
                    [
                        "detail-label"
                    ]
                );

                addClasses(
                    root,
                    ".fact-detail-grid dd",
                    [
                        "detail-field-value"
                    ]
                );

                addClasses(
                    root,
                    ".fact-detail-image",
                    [
                        "detail-photo"
                    ]
                );

                addClasses(
                    root,
                    ".fact-report-link",
                    [
                        "btn",
                        "secondary"
                    ]
                );
            }


            syncChoices(
                root
            );
        }


        function start() {

            const root =
                document.getElementById(
                    "factibilidadApp"
                );


            if (
                !root
            ) {

                return;
            }


            applyStyles(
                root
            );


            root.addEventListener(
                "change",
                function () {

                    syncChoices(
                        root
                    );
                }
            );


            const observer =
                new MutationObserver(
                    function () {

                        applyStyles(
                            root
                        );
                    }
                );


            observer.observe(
                root,
                {
                    childList:
                        true,

                    subtree:
                        true,

                    attributes:
                        true,

                    attributeFilter: [
                        "hidden"
                    ]
                }
            );
        }


        if (
            document.readyState ===
            "loading"
        ) {

            document.addEventListener(
                "DOMContentLoaded",
                start
            );

        } else {

            start();
        }

    })();

})();
