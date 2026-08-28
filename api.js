(function () {
  "use strict";

  const API_TOKEN_KEY = "clearday.apiToken";
  const runtimeConfig = window.CLEARDAY_CONFIG || {};
  const configuredAPIBase = runtimeConfig.apiBase;
  const configuredAPIToken = typeof runtimeConfig.apiToken === "string" ? runtimeConfig.apiToken.trim() : "";
  const apiBase = configuredAPIBase || (window.location.protocol === "file:" ? "" : "/api");

  if (configuredAPIToken) {
    rememberToken(configuredAPIToken);
  }

  async function request(path, options = {}, allowTokenPrompt = true) {
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");

    const token = getToken();
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

    if (response.status === 401 && configuredAPIToken) {
      throw new Error("The configured API token was rejected.");
    }

    if (response.status === 401 && allowTokenPrompt) {
      const nextToken = window.prompt("Enter your ClearDay API token");
      if (nextToken) {
        rememberToken(nextToken.trim());
        return request(path, options, false);
      }
    }

    if (response.status === 204) {
      return null;
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error((data && data.error) || "Cloud sync failed.");
    }

    return data;
  }

  function getToken() {
    if (configuredAPIToken) {
      return configuredAPIToken;
    }

    try {
      return localStorage.getItem(API_TOKEN_KEY) || "";
    } catch {
      return "";
    }
  }

  function rememberToken(token) {
    if (!token) return;

    try {
      localStorage.setItem(API_TOKEN_KEY, token);
    } catch {
      // Private browsing or blocked storage should not break the app.
    }
  }

  window.ClearDayAPI = {
    apiBase,
    request,
  };
})();
