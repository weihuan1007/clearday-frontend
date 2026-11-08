(function () {
  "use strict";

  const path = "/transactions";
  const previewKey = "clearday-money-preview-v1";
  const auth = window.ClearDayAuth;
  const api = window.ClearDayAPI;

  function create() {
    if (auth.enabled) return cloudRepository();
    if (["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) return previewRepository();
    return null;
  }

  function cloudRepository() {
    return {
      mode: "cloud",
      async list() {
        try {
          const records = await api.request(path, { cache: "no-store" });
          if (!Array.isArray(records)) throw new Error("The Money API returned an invalid response.");
          return records;
        } catch (error) {
          if (error.status === 404) throw new Error("The Money API is unavailable. Check the backend deployment and money table setting.");
          throw error;
        }
      },
      create: (record) => api.request(path, { method: "POST", body: JSON.stringify(record) }),
      update: (record) => api.request(path + "/" + encodeURIComponent(record.id), {
        method: "PUT",
        body: JSON.stringify(record),
      }),
      remove: (id) => api.request(path + "/" + encodeURIComponent(id), { method: "DELETE" }),
    };
  }

  // Preview records use their own localhost storage. A cloud error is always
  // surfaced so a failed upload cannot look like a successful local save.
  function previewRepository() {
    const list = () => JSON.parse(localStorage.getItem(previewKey) || "[]");
    const write = (records) => localStorage.setItem(previewKey, JSON.stringify(records));
    return {
      mode: "preview",
      list,
      create(record) {
        const records = list();
        const existing = records.find((item) => item.id === record.id);
        if (existing) {
          if (Object.keys(record).every((key) => record[key] === existing[key])) {
            return { created: false, transaction: existing };
          }
          const error = new Error("A transaction already uses this ID.");
          error.status = 409;
          throw error;
        }
        write([...records, record]);
        return { created: true, transaction: record };
      },
      update(record) {
        const records = list();
        const index = records.findIndex((item) => item.id === record.id);
        if (index < 0) throw new Error("Transaction not found.");
        records[index] = record;
        write(records);
        return record;
      },
      remove(id) {
        write(list().filter((record) => record.id !== id));
      },
    };
  }

  window.ClearDayMoneyRepository = { create };
})();
