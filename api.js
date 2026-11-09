(function () {
  "use strict";

  const runtimeConfig = window.CLEARDAY_CONFIG || {};
  const auth = window.ClearDayAuth;
  const configuredAPIBase = runtimeConfig.apiBase;
  const configuredAPIToken = typeof runtimeConfig.apiToken === "string" ? runtimeConfig.apiToken.trim() : "";
  const apiBase = configuredAPIBase || (window.location.protocol === "file:" ? "" : "/api");
  const reminderTokenKey = "clearday.apiToken";

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");

    // The Money repository supplies its own key. It never uses a reminder token.
    const hasOwnAuthorization = headers.has("Authorization");
    if (!hasOwnAuthorization) {
      const token = auth.enabled ? await auth.getAccessToken() : configuredAPIToken || readReminderToken();
      if (token) headers.set("Authorization", "Bearer " + token);
    }

    let response = await send(path, options, headers);

    if (response.status === 401 && !hasOwnAuthorization && auth.enabled) {
      auth.clearSession();
      window.dispatchEvent(new CustomEvent("clearday:auth-required"));
      throw new auth.AuthenticationRequiredError("Your session ended. Please sign in again.");
    }
    if (response.status === 401 && !hasOwnAuthorization && !configuredAPIToken) {
      const token = window.prompt("Enter your ClearDay reminder API token")?.trim();
      if (token) {
        headers.set("Authorization", "Bearer " + token);
        response = await send(path, options, headers);
        if (response.ok) rememberReminderToken(token);
      }
    }

    if (response.status === 204) {
      return null;
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error((data && data.error) || "Cloud sync failed.");
      error.status = response.status;
      throw error;
    }

    return data;
  }

  async function send(path, options, headers) {
    try {
      return await fetch(apiBase + path, { ...options, headers });
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error("Could not reach the ClearDay backend. Check the API deployment and try again.");
      }
      throw error;
    }
  }

  function readReminderToken() {
    try {
      return sessionStorage.getItem(reminderTokenKey) || localStorage.getItem(reminderTokenKey) || "";
    } catch {
      return "";
    }
  }

  function rememberReminderToken(token) {
    try {
      sessionStorage.setItem(reminderTokenKey, token);
    } catch {
      // Reminder requests can still succeed when browser storage is unavailable.
    }
  }

  window.ClearDayAPI = {
    apiBase,
    request,
  };
})();
