/* =========================================================
   ASADA OROSI - AVISOS VISUALES
   Reemplaza los alert nativos por un aviso coherente con el sitio.
   ========================================================= */

(function () {
    "use strict";

    if (window.ASADA_ALERT_READY) {
        return;
    }

    window.ASADA_ALERT_READY = true;

    const pending = [];
    let active = null;
    let lastFocus = null;
    let accessibilityTimer = null;

    function closeActive() {
        if (!active) {
            return;
        }

        const dialog = active;
        active = null;
        dialog.remove();

        if (lastFocus && typeof lastFocus.focus === "function") {
            lastFocus.focus({ preventScroll: true });
        }

        lastFocus = null;
        showNext();
    }

    function showNext() {
        if (active || !pending.length || !document.body) {
            return;
        }

        const message = pending.shift();
        lastFocus = document.activeElement;

        const backdrop = document.createElement("div");
        backdrop.className = "asada-dialog-backdrop";
        backdrop.innerHTML = `
            <section class="asada-dialog" role="alertdialog" aria-modal="true" aria-labelledby="asadaDialogTitle" aria-describedby="asadaDialogMessage">
                <div class="asada-dialog-brand">
                    <span class="asada-dialog-brand-mark" aria-hidden="true">A</span>
                    <span>ASADA OROSI</span>
                </div>
                <div class="asada-dialog-content">
                    <h2 id="asadaDialogTitle">Aviso</h2>
                    <p id="asadaDialogMessage"></p>
                </div>
                <div class="asada-dialog-actions">
                    <button type="button" class="btn primary asada-dialog-close">Aceptar</button>
                </div>
            </section>
        `;

        backdrop.querySelector("#asadaDialogMessage").textContent = message;
        backdrop.querySelector(".asada-dialog-close").addEventListener("click", closeActive);
        backdrop.addEventListener("click", event => {
            if (event.target === backdrop) {
                closeActive();
            }
        });

        document.body.appendChild(backdrop);
        active = backdrop;
        backdrop.querySelector(".asada-dialog-close").focus();
    }

    window.addEventListener("keydown", event => {
        if (event.key === "Escape" && active) {
            event.preventDefault();
            closeActive();
        }
    });

    window.alert = function (message) {
        pending.push(String(message ?? ""));
        showNext();
    };

    function scheduleAccessibilityTuning() {
        if (accessibilityTimer) {
            return;
        }

        accessibilityTimer = window.setTimeout(() => {
            accessibilityTimer = null;
            tuneAccessibilityControl();
        }, 40);
    }

    function tuneAccessibilityControl() {
        const menu = document.getElementById("sideMenu");
        const menuOpen = Boolean(menu?.classList.contains("open"));
        const candidates = document.querySelectorAll("button, [role=button]");

        candidates.forEach(candidate => {
            const signature = [
                candidate.id,
                candidate.className,
                candidate.getAttribute("aria-label"),
                candidate.getAttribute("title")
            ].join(" ").toLowerCase();

            if (!/(sienna|accessib|accesib|\basw\b)/i.test(signature)) {
                return;
            }

            const computed = window.getComputedStyle(candidate);
            if (computed.position !== "fixed" && computed.position !== "absolute") {
                return;
            }

            candidate.classList.add("asada-accessibility-control");
            candidate.style.transform = "scale(.78)";
            candidate.style.transformOrigin = "bottom left";
            candidate.style.bottom = "12px";
            candidate.style.left = menuOpen ? "292px" : "12px";
        });
    }

    const observer = new MutationObserver(scheduleAccessibilityTuning);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("resize", scheduleAccessibilityTuning);
    window.setTimeout(scheduleAccessibilityTuning, 350);
})();
