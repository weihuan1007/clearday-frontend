(function () {
  "use strict";

  const refreshInterval = 3000;

  // Refresh only while Money is visible. Returning from Telegram triggers an
  // immediate check, and a single timer prevents overlapping polling loops.
  function create(refresh) {
    let enabled = false;
    let timer;

    function schedule(delay = refreshInterval) {
      window.clearTimeout(timer);
      if (!enabled || document.hidden) return;
      timer = window.setTimeout(async () => {
        try {
          await refresh();
        } finally {
          schedule();
        }
      }, delay);
    }

    function start() {
      if (enabled) return;
      enabled = true;
      schedule();
    }

    function stop() {
      enabled = false;
      window.clearTimeout(timer);
    }

    document.addEventListener("visibilitychange", () => schedule(0));
    window.addEventListener("focus", () => schedule(0));
    window.addEventListener("online", () => schedule(0));
    window.addEventListener("hashchange", () => schedule(0));
    window.addEventListener("clearday:auth-required", stop);
    window.addEventListener("pagehide", stop);
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) start();
    });

    return { start, stop };
  }

  window.ClearDayMoneyLiveSync = { create };
})();
