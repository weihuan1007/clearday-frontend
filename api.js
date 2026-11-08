(function () {
  "use strict";

  const runtimeConfig = window.CLEARDAY_CONFIG || {};
  const auth = window.ClearDayAuth;
  const configuredAPIBase = runtimeConfig.apiBase;
  const configuredAPIToken = typeof runtimeConfig.apiToken === "string" ? runtimeConfig.apiToken.trim() : "";
  const apiBase = configuredAPIBase || (window.location.protocol === "file:" ? "" : "/api");

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");

    const token = auth.enabled ? await auth.getAccessToken() : configuredAPIToken;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    let response;
    try {
      response = await fetch(`${apiBase}${path}`, {
        ...options,
        headers,
      });
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error("Could not reach the ClearDay backend. Check the API deployment and try again.");
      }
      throw error;
    }

    if (response.status === 401 && auth.enabled) {
      auth.clearSession();
      window.dispatchEvent(new CustomEvent("clearday:auth-required"));
      throw new auth.AuthenticationRequiredError("Your session ended. Please sign in again.");
    }
    if (response.status === 401) {
      throw new Error("The configured API token was rejected.");
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

  window.ClearDayAPI = {
    apiBase,
    request,
  };
})();
