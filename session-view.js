(function () {
  "use strict";

  const auth = window.ClearDayAuth;

  function create(onAuthenticated) {
    const elements = {
      loginView: document.querySelector("#loginView"),
      loginError: document.querySelector("#loginError"),
      signInButton: document.querySelector("#signInButton"),
      appShell: document.querySelector("#appShell"),
      accountEmail: document.querySelector("#accountEmail"),
      signOutButton: document.querySelector("#signOutButton"),
    };

    function bind() {
      elements.signInButton.addEventListener("click", beginSignIn);
      elements.signOutButton.addEventListener("click", () => {
        elements.signOutButton.disabled = true;
        void auth.signOut();
      });
      window.addEventListener("clearday:auth-required", () => {
        showLogin("Your session ended. Please sign in again.");
      });
    }

    async function initialize() {
      if (!auth.enabled) {
        showApp();
        return;
      }

      showLogin();
      elements.signInButton.disabled = true;
      try {
        if (await auth.initialize()) {
          showApp();
          return;
        }
      } catch (error) {
        elements.loginError.textContent = error.message || "Could not complete sign in.";
      }
      elements.signInButton.disabled = false;
    }

    async function beginSignIn() {
      elements.signInButton.disabled = true;
      elements.loginError.textContent = "";
      try {
        await auth.signIn();
      } catch (error) {
        elements.loginError.textContent = error.message || "Could not start sign in.";
        elements.signInButton.disabled = false;
      }
    }

    function showApp() {
      elements.loginView.hidden = true;
      elements.appShell.hidden = false;
      const user = auth.getUser();
      elements.accountEmail.textContent = user ? user.email : "";
      elements.signOutButton.hidden = !auth.enabled;
      elements.accountEmail.hidden = !auth.enabled;
      onAuthenticated();
    }

    function showLogin(message = "") {
      document.querySelectorAll(".app-dialog[open]").forEach((dialog) => dialog.close());
      elements.appShell.hidden = true;
      elements.loginView.hidden = false;
      elements.loginError.textContent = message;
      elements.signInButton.disabled = false;
    }

    return { bind, initialize, showLogin };
  }

  window.ClearDaySessionView = { create };
})();
