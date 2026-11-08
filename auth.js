(function () {
  "use strict";

  const SESSION_KEY = "clearday.auth.session";
  const REFRESH_TOKEN_KEY = "clearday.auth.refreshToken";
  const TRANSACTION_KEY = "clearday.auth.transaction";
  const EXPIRY_MARGIN_MS = 60 * 1000;
  const runtimeAuth = (window.CLEARDAY_CONFIG || {}).auth || {};
  const config = {
    domain: trimTrailingSlash(runtimeAuth.domain),
    clientId: stringValue(runtimeAuth.clientId),
    redirectUri: stringValue(runtimeAuth.redirectUri),
    logoutUri: stringValue(runtimeAuth.logoutUri),
  };
  const enabled = Object.values(config).every(Boolean);

  class AuthenticationRequiredError extends Error {
    constructor(message = "Please sign in to continue.") {
      super(message);
      this.name = "AuthenticationRequiredError";
    }
  }

  async function initialize() {
    if (!enabled) return true;

    const parameters = new URLSearchParams(window.location.search);
    if (parameters.has("error")) {
      const message = parameters.get("error_description") || "Sign in was not completed.";
      cleanCallbackURL("#calendar");
      throw new Error(message);
    }

    if (parameters.has("code")) {
      await finishSignIn(parameters);
    }

    try {
      await getAccessToken();
      return true;
    } catch (error) {
      if (isAuthenticationError(error)) return false;
      throw error;
    }
  }

  async function signIn() {
    if (!enabled) return;

    const verifier = randomBase64URL(64);
    const challenge = await sha256Base64URL(verifier);
    const state = randomBase64URL(32);
    const returnHash = window.location.hash || "#calendar";
    writeStorage(sessionStorage, TRANSACTION_KEY, JSON.stringify({ verifier, state, returnHash }));

    const parameters = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: "openid email",
      state,
      code_challenge_method: "S256",
      code_challenge: challenge,
    });
    window.location.assign(`${config.domain}/oauth2/authorize?${parameters}`);
  }

  async function finishSignIn(parameters) {
    const transaction = parseJSON(readStorage(sessionStorage, TRANSACTION_KEY));
    removeStorage(sessionStorage, TRANSACTION_KEY);
    if (!transaction || !transaction.verifier || parameters.get("state") !== transaction.state) {
      clearSession();
      throw new Error("The sign-in response could not be verified. Please try again.");
    }

    const tokens = await tokenRequest({
      grant_type: "authorization_code",
      client_id: config.clientId,
      code: parameters.get("code"),
      redirect_uri: config.redirectUri,
      code_verifier: transaction.verifier,
    });
    saveTokens(tokens);
    cleanCallbackURL(transaction.returnHash || "#calendar");
  }

  async function getAccessToken() {
    if (!enabled) return "";

    const session = parseJSON(readStorage(sessionStorage, SESSION_KEY));
    if (session && session.accessToken && session.expiresAt > Date.now() + EXPIRY_MARGIN_MS) {
      return session.accessToken;
    }

    const refreshToken = readStorage(localStorage, REFRESH_TOKEN_KEY);
    if (!refreshToken) throw new AuthenticationRequiredError();

    try {
      const tokens = await tokenRequest({
        grant_type: "refresh_token",
        client_id: config.clientId,
        refresh_token: refreshToken,
      });
      saveTokens(tokens, refreshToken);
      return tokens.access_token;
    } catch (error) {
      clearSession();
      if (error instanceof TypeError) {
        throw new Error("Could not reach the sign-in service. Check your connection and try again.");
      }
      throw new AuthenticationRequiredError("Your session ended. Please sign in again.");
    }
  }

  async function tokenRequest(values) {
    const response = await fetch(`${config.domain}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(values),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.access_token) {
      throw new Error(result.error_description || "The sign-in service rejected the request.");
    }
    return result;
  }

  function saveTokens(tokens, previousRefreshToken = "") {
    const current = parseJSON(readStorage(sessionStorage, SESSION_KEY)) || {};
    const session = {
      accessToken: tokens.access_token,
      idToken: tokens.id_token || current.idToken || "",
      expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000,
    };
    writeStorage(sessionStorage, SESSION_KEY, JSON.stringify(session));

    const refreshToken = tokens.refresh_token || previousRefreshToken;
    if (refreshToken) writeStorage(localStorage, REFRESH_TOKEN_KEY, refreshToken);
  }

  async function signOut() {
    if (!enabled) return;

    const refreshToken = readStorage(localStorage, REFRESH_TOKEN_KEY);
    if (refreshToken) {
      try {
        await fetch(`${config.domain}/oauth2/revoke`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: refreshToken, client_id: config.clientId }),
          keepalive: true,
        });
      } catch {
        // Local session cleanup and Cognito logout still happen when revocation is unreachable.
      }
    }

    clearSession();
    const parameters = new URLSearchParams({
      client_id: config.clientId,
      logout_uri: config.logoutUri,
    });
    window.location.assign(`${config.domain}/logout?${parameters}`);
  }

  function getUser() {
    const session = parseJSON(readStorage(sessionStorage, SESSION_KEY));
    const claims = decodeJWTPayload(session && session.idToken);
    return claims ? { email: claims.email || "Signed in" } : null;
  }

  function clearSession() {
    removeStorage(sessionStorage, SESSION_KEY);
    removeStorage(sessionStorage, TRANSACTION_KEY);
    removeStorage(localStorage, REFRESH_TOKEN_KEY);
  }

  function isAuthenticationError(error) {
    return error instanceof AuthenticationRequiredError || (error && error.name === "AuthenticationRequiredError");
  }

  function decodeJWTPayload(token) {
    if (!token || token.split(".").length !== 3) return null;
    try {
      const value = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=");
      return JSON.parse(decodeURIComponent(Array.from(atob(padded), (character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`).join("")));
    } catch {
      return null;
    }
  }

  function randomBase64URL(byteLength) {
    const values = new Uint8Array(byteLength);
    crypto.getRandomValues(values);
    return bytesToBase64URL(values);
  }

  async function sha256Base64URL(value) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return bytesToBase64URL(new Uint8Array(digest));
  }

  function bytesToBase64URL(values) {
    let binary = "";
    values.forEach((value) => {
      binary += String.fromCharCode(value);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function cleanCallbackURL(hash) {
    window.history.replaceState({}, "", `${window.location.pathname}${hash || ""}`);
  }

  function readStorage(storage, key) {
    try {
      return storage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function writeStorage(storage, key, value) {
    try {
      storage.setItem(key, value);
    } catch {
      // The next authenticated request will ask the user to sign in again.
    }
  }

  function removeStorage(storage, key) {
    try {
      storage.removeItem(key);
    } catch {
      // Storage might be blocked in strict private-browsing modes.
    }
  }

  function parseJSON(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function stringValue(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function trimTrailingSlash(value) {
    return stringValue(value).replace(/\/+$/, "");
  }

  window.ClearDayAuth = {
    AuthenticationRequiredError,
    clearSession,
    enabled,
    getAccessToken,
    getUser,
    initialize,
    isAuthenticationError,
    signIn,
    signOut,
  };
})();
