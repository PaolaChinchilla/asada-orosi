/* =========================================================
   CONFIGURACIÓN DEL CACHE
   ========================================================= */

const CACHE_NAME =
    "asada-static-v4";


const STATIC_FILES = [

    "index.html",

    "registros.html",

    "mantenimiento.html",

    "detalle.html",

    "excel.html",

    "css/style.css",

    "js/app.js",

    "manifest.json",

    "img/asadalogo.png"

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
                    cache =>
                        cache.addAll(
                            STATIC_FILES
                        )
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
                    names =>
                        Promise.all(

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

                        )
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
            No intentamos almacenar recursos externos,
            como Google Apps Script o ExcelJS.
        */

        if (
            url.origin !==
            self.location.origin
        ) {

            return;
        }


        event.respondWith(

            fetch(
                event.request
            )

                .then(
                    response => {

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


                        return response;
                    }
                )

                .catch(
                    async () => {

                        const cached =
                            await caches.match(
                                event.request
                            );


                        if (
                            cached
                        ) {

                            return cached;
                        }


                        /*
                            Si la persona está sin conexión
                            y trató de abrir una página,
                            mostramos el inicio almacenado.
                        */

                        if (
                            event.request.mode ===
                            "navigate"
                        ) {

                            return caches.match(
                                "index.html"
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