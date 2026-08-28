(function () {
  "use strict";

  const api = window.ClearDayAPI;
  const local = window.ClearDayStorage;
  const model = window.ClearDayReminderModel;

  function create() {
    let mode = "local";
    let syncError = "";

    async function load() {
      if (!api.apiBase) {
        mode = "local";
        return model.normalizeAll(local.loadReminders());
      }

      try {
        const reminders = await api.request("/reminders");
        mode = "api";
        syncError = "";
        return model.normalizeAll(reminders);
      } catch (error) {
        mode = "fallback";
        syncError = error.message;
        return model.normalizeAll(local.loadReminders());
      }
    }

    async function save(id, input, currentReminders) {
      if (mode === "api") {
        const path = id ? `/reminders/${encodeURIComponent(id)}` : "/reminders";
        const saved = await api.request(path, {
          method: "POST",
          body: JSON.stringify(input),
        });
        const normalized = model.normalize(saved);
        model.assertSavedTimeRange(input, normalized);
        return normalized;
      }

      const now = new Date().toISOString();
      const reminder = id
        ? { ...currentReminders.find((item) => item.id === id), ...input, updatedAt: now }
        : { id: model.createId(), ...input, createdAt: now, updatedAt: now };
      const next = id
        ? currentReminders.map((item) => (item.id === id ? reminder : item))
        : [...currentReminders, reminder];
      local.saveReminders(next);
      return model.normalize(reminder);
    }

    async function remove(id, currentReminders) {
      if (mode === "api") {
        await api.request(`/reminders/${encodeURIComponent(id)}`, { method: "DELETE" });
        return;
      }
      local.saveReminders(currentReminders.filter((item) => item.id !== id));
    }

    return {
      load,
      remove,
      save,
      getMode: () => mode,
      getSyncError: () => syncError,
    };
  }

  window.ClearDayRepository = { create };
})();
