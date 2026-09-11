/* =========================================================
   CONFIGURACIÓN DEL CACHE
   ========================================================= */

const CACHE_NAME =
    "asada-static-v24";

const STATIC_FILES = [

    "./",

    "./index.html",

    "./registros.html",

    "./crear-accidente.html",

    "./accidentes.html",

    "./detalle-accidente.html",

    "./mantenimiento.html",

    "./detalle.html",

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

        /*
            Solamente manejamos solicitudes GET.
        */

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


        /*
            No almacenamos recursos externos.
        */

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
                    /*
                        Evita que el navegador entregue
                        una versión antigua desde su
                        propia caché HTTP.
                    */

                    cache:
                        "no-store"
                }
            )

                .then(
                    response => {

                        /*
                            Solo almacenamos respuestas
                            correctas.
                        */

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

                        /*
                            Intentamos encontrar el recurso
                            almacenado.

                            ignoreSearch también permite
                            recuperar archivos aunque en
                            algún momento utilicemos
                            parámetros de versión.
                        */

                        const cached =
                            await caches.match(
                                event.request,
                                {
                                    ignoreSearch:
                                        true
                                }
                            );


                        if (
                            cached
                        ) {

                            return cached;
                        }


                        /*
                            Si no hay Internet y se intentó
                            abrir una página, mostramos
                            el inicio almacenado.
                        */

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