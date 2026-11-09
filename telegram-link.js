(function () {
  "use strict";

  const endpoint = "/integrations/telegram/pair";
  const panel = document.getElementById("moneyTelegram");
  const connect = document.getElementById("moneyTelegramConnect");
  const check = document.getElementById("moneyTelegramCheck");
  const open = document.getElementById("moneyTelegramOpen");
  const status = document.getElementById("moneyTelegramStatus");
  let busy = false;
  let awaitingStart = false;
  let supportsStatus = true;

  async function load() {
    if (!window.ClearDayAuth.enabled || busy) return;
    panel.hidden = false;
    setBusy(true);
    if (!awaitingStart) status.textContent = "Checking your Telegram connection…";
    try {
      const result = await window.ClearDayAPI.request(endpoint, { cache: "no-store" });
      if (result?.connected === true) {
        showLink(result.url, false);
        awaitingStart = false;
        connect.textContent = "Link another chat";
        connect.hidden = false;
        check.hidden = true;
        status.textContent = "Connected to Telegram. You can send transactions directly to your bot.";
      } else if (result?.connected === false) {
        if (awaitingStart) {
          status.textContent = "Open Telegram and press Start within 10 minutes. The bot will confirm the connection.";
        } else {
          showSetup();
        }
      } else {
        throw new Error("Unexpected Telegram connection status.");
      }
    } catch (error) {
      if (error.status === 405) {
        // Keep one-time setup available during a staggered backend rollout.
        supportsStatus = false;
        showSetup();
      } else if (error.status === 403) {
        check.hidden = true;
        status.textContent = "Telegram is unavailable for this account.";
      } else {
        check.hidden = false;
        status.textContent = error.status === 404
          ? "Telegram setup is still pending on the server."
          : "Could not check your Telegram connection. Try again.";
      }
    } finally {
      setBusy(false);
    }
  }

  function showSetup() {
    connect.hidden = false;
    check.hidden = true;
    status.textContent = "Connect once to record transactions from your Telegram chat.";
  }

  async function createSetupLink() {
    setBusy(true);
    status.textContent = "Creating a one-time link…";
    try {
      const result = await window.ClearDayAPI.request(endpoint, { method: "POST" });
      showLink(result.url, true);
      awaitingStart = supportsStatus;
      check.hidden = !supportsStatus;
      connect.textContent = "New setup link";
      status.textContent = "Open Telegram and press Start within 10 minutes. The bot will confirm the connection.";
    } catch (error) {
      if (error.status === 404) status.textContent = "Telegram setup is still pending on EC2.";
      else if (error.status === 503) status.textContent = "Telegram is temporarily unavailable. Try again.";
      else status.textContent = error.message;
    } finally {
      setBusy(false);
    }
  }

  function showLink(value, setup) {
    const url = new URL(value);
    if (url.origin !== "https://t.me" || url.username || url.password ||
        !/^\/[A-Za-z0-9_]{5,32}$/.test(url.pathname) ||
        (setup ? !url.searchParams.get("start") : url.search)) {
      throw new Error("ClearDay received an invalid Telegram link.");
    }
    open.href = url.href;
    open.hidden = false;
  }

  function setBusy(value) {
    busy = value;
    connect.disabled = value;
    check.disabled = value;
  }

  connect.addEventListener("click", createSetupLink);
  check.addEventListener("click", load);
  document.addEventListener("visibilitychange", () => {
    if (awaitingStart && !document.hidden) void load();
  });

  window.ClearDayTelegramLink = { load };
})();
