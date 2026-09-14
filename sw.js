/* =========================================================
   CONFIGURACIÓN DEL CACHE
   ========================================================= */

const CACHE_NAME =
    "asada-static-v57";

const STATIC_FILES = [

    "./",

    "./index.html",

    "./registros.html",

    "./crear-accidente.html",

    "./accidentes.html",

    "./detalle-accidente.html",

    "./mantenimiento.html",

    "./detalle.html",

    "./crear-factibilidad.html",

    "./factibilidades.html",

    "./detalle-factibilidad.html",

    "./css/factibilidad.css",

    "./css/factibilidad-ajustes.css",

    "./js/factibilidad.js",

    "./js/factibilidad-ajustes.js",

    "./excel.html",

    "./css/style.css",

    "./js/app.js",

    "./manifest.json",

    "./img/asadalogo.png"

];

/* =========================================================
   INSTALACIÓN
   ========================================================= */

self.addEventListener(
    "install",
    event => {

        event.waitUntil(

            caches
                .open(
                    CACHE_NAME
                )
                .then(
                    cache => {

                        return cache.addAll(
                            STATIC_FILES
                        );
                    }
                )

        );


        self.skipWaiting();
    }
);


/* =========================================================
   ACTIVACIÓN
   ========================================================= */

self.addEventListener(
    "activate",
    event => {

        event.waitUntil(

            caches
                .keys()
                .then(
                    names => {

                        return Promise.all(

                            names

                                .filter(
                                    name =>
                                        name !==
                                        CACHE_NAME
                                )

                                .map(
                                    name =>
                                        caches.delete(
                                            name
                                        )
                                )

                        );
                    }
                )
        );


        self.clients.claim();
    }
);


/* =========================================================
   SOLICITUDES
   ========================================================= */

self.addEventListener(
    "fetch",
    event => {

        if (
            event.request.method !==
            "GET"
        ) {

            return;
        }


        const url =
            new URL(
                event.request.url
            );


        if (
            url.origin !==
            self.location.origin
        ) {

            return;
        }


        event.respondWith(

            fetch(
                event.request,
                {
                    cache:
                        "no-store"
                }
            )

                .then(
                    response => {

                        if (
                            response &&
                            response.ok
                        ) {

                            const copy =
                                response.clone();


                            caches
                                .open(
                                    CACHE_NAME
                                )
                                .then(
                                    cache => {

                                        cache.put(
                                            event.request,
                                            copy
                                        );
                                    }
                                );
                        }


                        return response;
                    }
                )

                .catch(
                    async () => {

                        const cached =
                            await caches.match(
                                event.request,
                                {
                                    ignoreSearch:
                                        true
                                }
                            );


                        if (cached) {
                            return cached;
                        }


                        if (
                            event.request.mode ===
                            "navigate"
                        ) {

                            return caches.match(
                                "./index.html"
                            );
                        }


                        throw new Error(
                            "Recurso no disponible."
                        );
                    }
                )

        );
    }
);
