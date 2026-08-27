(function () {
  "use strict";

  const API_TOKEN_KEY = "clearday.apiToken";
  const configuredAPIBase = window.CLEARDAY_CONFIG && window.CLEARDAY_CONFIG.apiBase;
  const apiBase = configuredAPIBase || (window.location.protocol === "file:" ? "" : "/api");

  async function request(path, options = {}, allowTokenPrompt = true) {
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");

    const token = localStorage.getItem(API_TOKEN_KEY);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && allowTokenPrompt) {
      const nextToken = window.prompt("Enter your ClearDay API token");
      if (nextToken) {
        localStorage.setItem(API_TOKEN_KEY, nextToken.trim());
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

  window.ClearDayAPI = {
    apiBase,
    request,
  };
})();
