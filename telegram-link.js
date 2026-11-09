(function () {
  "use strict";

  if (!window.ClearDayAuth.enabled) return;
  const panel = document.getElementById("moneyTelegram");
  const connect = document.getElementById("moneyTelegramConnect");
  const open = document.getElementById("moneyTelegramOpen");
  const status = document.getElementById("moneyTelegramStatus");

  panel.hidden = false;
  connect.addEventListener("click", async () => {
    connect.disabled = true;
    open.hidden = true;
    open.removeAttribute("href");
    status.textContent = "Creating a one-time link…";
    try {
      const response = await window.ClearDayAPI.request("/integrations/telegram/pair", { method: "POST" });
      const url = new URL(response.url);
      if (url.origin !== "https://t.me" || !url.searchParams.has("start")) {
        throw new Error("ClearDay received an invalid Telegram link.");
      }
      open.href = url.href;
      open.hidden = false;
      status.textContent = "Open Telegram and press Start within 10 minutes. The bot will confirm the connection.";
    } catch (error) {
      if (error.status === 404) status.textContent = "Telegram setup is still pending on EC2.";
      else if (error.status === 503) status.textContent = "Telegram is temporarily unavailable. Try again.";
      else status.textContent = error.message;
    } finally {
      connect.disabled = false;
    }
  });
})();
