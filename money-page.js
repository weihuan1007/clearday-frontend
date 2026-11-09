(function () {
  "use strict";

  const dates = window.ClearDayDates;
  const model = window.ClearDayMoneyModel;
  const element = (name) => document.getElementById("money" + name);

  function create() {
    const repository = window.ClearDayMoneyRepository.create();
    const personal = repository?.mode === "personal";
    const unlockForm = element("UnlockForm");
    const accessKeyInput = element("AccessKey");
    const lockButton = element("Lock");
    const ledgerPanels = document.querySelectorAll("[data-money-content]");
    const form = element("Form");
    const fields = form.elements;
    const dialog = element("Dialog");
    const monthSelect = element("Month");
    const list = element("List");
    const search = element("Search");
    const typeFilter = element("TypeFilter");
    const status = element("Status");
    const thisMonth = dates.toISO(new Date()).slice(0, 7);
    const state = { records: [], month: thisMonth, editing: null, draftID: "", loaded: false, busy: false };

    if (personal) {
      unlockForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (state.busy) return;
        repository.setKey(accessKeyInput.value.trim());
        accessKeyInput.value = "";
        void load();
      });
      lockButton.addEventListener("click", () => {
        lock();
        accessKeyInput.focus();
      });
      render();
    }

    element("Add").addEventListener("click", () => openForm());
    element("Cancel").addEventListener("click", () => dialog.close());
    dialog.addEventListener("cancel", (event) => {
      if (state.busy) event.preventDefault();
    });
    form.addEventListener("submit", save);
    fields.type.addEventListener("change", () => fillSelect(fields.category, model.categories[fields.type.value]));
    monthSelect.addEventListener("change", () => {
      state.month = monthSelect.value;
      render();
    });
    search.addEventListener("input", render);
    typeFilter.addEventListener("change", render);
    list.addEventListener("click", handleRowAction);
    element("Import").addEventListener("click", () => element("File").click());
    element("File").addEventListener("change", importFile);
    element("Export").addEventListener("click", exportFile);
    element("Refresh").addEventListener("click", load);

    function render() {
      if (personal) {
        unlockForm.hidden = state.loaded;
        lockButton.hidden = !state.loaded;
        element("Add").hidden = !state.loaded;
        ledgerPanels.forEach((panel) => { panel.hidden = !state.loaded; });
      }
      const months = new Set([thisMonth, ...state.records.map((record) => record.date.slice(0, 7))]);
      if (state.month) months.add(state.month);
      const options = [...months].sort().reverse().map((month) => new Option(model.formatMonth(month), month));
      monthSelect.replaceChildren(...options, new Option("All months", ""));
      monthSelect.value = state.month;

      const period = state.records.filter((record) => !state.month || record.date.startsWith(state.month));
      const totals = model.totals(period);
      for (const [id, sen] of Object.entries({ Income: totals.income, Expense: totals.expense, Net: totals.net })) {
        element(id).textContent = state.loaded ? model.formatAmount(sen) : "—";
      }

      const query = search.value.trim().toLowerCase();
      const visible = period.filter((record) =>
        (!typeFilter.value || record.type === typeFilter.value) &&
        [record.note, record.category, record.account].some((text) => text.toLowerCase().includes(query))
      );
      visible.sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
      list.replaceChildren(...visible.map(createRow));
      element("Count").textContent = state.loaded
        ? `${visible.length} ${dates.pluralize(visible.length, "transaction")}`
        : "";
      const empty = element("Empty");
      empty.hidden = !state.loaded || visible.length > 0;
      empty.textContent = state.records.length ? "No transactions match these filters." : "Add a transaction to start your ledger.";
      element("Export").disabled = state.busy || !state.loaded || !state.records.length;
    }

    function createRow(record) {
      const row = element("Row").content.firstElementChild.cloneNode(true);
      const title = record.note || record.category;
      row.dataset.id = record.id;
      row.dataset.type = record.type;
      row.querySelector("[data-note]").textContent = title;
      row.querySelector("[data-details]").textContent =
        [record.date, model.labels[record.type], record.category, record.account].join(" · ");
      const amount = row.querySelector("[data-amount]");
      amount.dataset.type = record.type;
      const sign = { income: "+", expense: "−", transfer: "" }[record.type];
      amount.textContent = sign + model.formatAmount(record.amountSen);
      row.querySelector("[data-record-mark]").textContent = sign || "↔";
      row.querySelector("[data-source]").hidden = record.source !== "telegram";
      row.querySelector('[data-money-action="edit"]').setAttribute("aria-label", "Edit " + title);
      row.querySelector('[data-money-action="delete"]').setAttribute("aria-label", "Delete " + title);
      return row;
    }

    function setBusy(busy) {
      state.busy = busy;
      element("Add").disabled = busy || !state.loaded;
      element("Import").disabled = busy || !state.loaded;
      element("Export").disabled = busy || !state.loaded || !state.records.length;
      element("Refresh").disabled = busy;
      element("Save").disabled = busy;
      element("Cancel").disabled = busy;
      element("Unlock").disabled = busy;
      lockButton.disabled = busy;
    }

    function lock(message = "Enter your private Money key to open the ledger.") {
      repository.setKey("");
      state.records = [];
      state.loaded = false;
      state.editing = null;
      state.draftID = "";
      state.month = thisMonth;
      search.value = "";
      typeFilter.value = "";
      form.reset();
      if (dialog.open) dialog.close();
      status.textContent = message;
      setBusy(state.busy);
      render();
    }

    function lockIfKeyRejected(error) {
      if (!personal || error.status !== 401) return false;
      lock("The Money key was rejected. Check it and try again.");
      accessKeyInput.focus();
      return true;
    }

    async function load() {
      if (!repository) {
        status.textContent = "Open ClearDay over HTTPS to use Money.";
        return;
      }
      if (state.busy) return;
      if (personal && !repository.hasKey()) {
        lock();
        return;
      }
      setBusy(true);
      status.textContent = "Loading transactions…";
      try {
        state.records = await repository.list();
        state.loaded = true;
        status.textContent = repository.mode === "preview"
          ? "Local preview · records are saved only in this browser."
          : "Transactions are synced to your account.";
      } catch (error) {
        if (!lockIfKeyRejected(error)) {
          state.loaded = false;
          state.records = [];
          status.textContent = error.message;
        }
      } finally {
        setBusy(false);
        render();
      }
    }

    function openForm(record = null) {
      if (state.busy || !state.loaded) return;
      state.editing = record;
      state.draftID = record?.id || crypto.randomUUID();
      fields.type.value = record?.type || "expense";
      fields.amount.value = record ? (record.amountSen / 100).toFixed(2) : "";
      fields.date.value = record?.date || dates.toISO(new Date());
      fields.note.value = record?.note || "";
      fillSelect(fields.category, model.categories[fields.type.value], record?.category);
      fillSelect(fields.account, model.accounts, record?.account);
      element("FormTitle").textContent = record ? "Edit transaction" : "Add transaction";
      element("FormError").textContent = "";
      dialog.showModal();
      fields.amount.focus();
    }

    async function save(event) {
      event.preventDefault();
      if (state.busy) return;
      const errorMessage = element("FormError");
      errorMessage.textContent = "";
      setBusy(true);
      try {
        const record = model.normalize({
          id: state.draftID,
          type: fields.type.value,
          amountSen: model.parseAmount(fields.amount.value),
          date: fields.date.value,
          category: fields.category.value,
          account: fields.account.value,
          note: fields.note.value,
          source: state.editing?.source || "manual",
        });
        const saved = state.editing ? await repository.update(record) : (await repository.create(record)).transaction;
        state.records = state.records.filter((item) => item.id !== saved.id);
        state.records.push(saved);
        if (state.month) state.month = saved.date.slice(0, 7);
        search.value = "";
        typeFilter.value = "";
        dialog.close();
        status.textContent = state.editing ? "Transaction updated." : "Transaction saved.";
      } catch (error) {
        if (!lockIfKeyRejected(error)) errorMessage.textContent = error.message;
      } finally {
        setBusy(false);
        render();
      }
    }

    async function handleRowAction(event) {
      const button = event.target.closest("[data-money-action]");
      if (!button || state.busy || !state.loaded) return;
      const record = state.records.find((item) => item.id === button.closest("[data-id]").dataset.id);
      if (!record) return;
      if (button.dataset.moneyAction === "edit") {
        openForm(record);
        return;
      }
      if (!window.confirm("Delete this transaction?")) return;

      setBusy(true);
      try {
        await repository.remove(record.id);
        state.records = state.records.filter((item) => item.id !== record.id);
        status.textContent = "Transaction deleted.";
      } catch (error) {
        if (!lockIfKeyRejected(error)) status.textContent = error.message;
      } finally {
        setBusy(false);
        render();
      }
    }

    async function importFile(event) {
      const file = event.target.files[0];
      event.target.value = "";
      if (!file || state.busy || !state.loaded) return;
      let added = 0;
      let skipped = 0;
      setBusy(true);
      try {
        if (file.size > 10 * 1024 * 1024) throw new Error("Choose a JSON export smaller than 10 MB.");
        const { records, invalid } = model.readExport(await file.text());
        if (!records.length) throw new Error("The file contains no valid transactions.");
        if (!window.confirm("Import " + records.length + " valid transactions into this ledger?")) return;

        status.textContent = "Importing transactions…";
        const knownIDs = new Set(state.records.map((record) => record.id));
        // Each successful row is saved independently. Reimporting the same file
        // skips IDs already present, including rows saved before an interruption.
        for (const record of records) {
          if (knownIDs.has(record.id)) {
            skipped += 1;
            continue;
          }
          try {
            const result = await repository.create(record);
            knownIDs.add(record.id);
            state.records.push(result.transaction);
            if (result.created) added += 1;
            else skipped += 1;
          } catch (error) {
            if (error.status !== 409) throw error;
            skipped += 1;
          }
        }
        state.month = "";
        search.value = "";
        typeFilter.value = "";
        status.textContent = "Imported " + added + " · already present " + skipped + " · invalid " + invalid + ".";
      } catch (error) {
        if (!lockIfKeyRejected(error)) {
          status.textContent = added ? "Imported " + added + " before stopping. Retry with the same file. " + error.message : error.message;
        }
      } finally {
        setBusy(false);
        render();
      }
    }

    function exportFile() {
      const backup = { exportedAt: new Date().toISOString(), currency: "MYR", records: state.records };
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "clearday-money-" + dates.toISO(new Date()) + ".json";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return { load };
  }

  // Keep custom categories and accounts present in imported records editable.
  function fillSelect(select, choices, selected = choices[0]) {
    const values = choices.includes(selected) ? choices : [...choices, selected];
    select.replaceChildren(...values.map((value) => new Option(value, value)));
    select.value = selected;
  }

  window.ClearDayMoneyPage = { create };
})();
