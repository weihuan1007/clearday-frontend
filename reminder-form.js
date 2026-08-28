(function () {
  "use strict";

  const { addDays, addMonths, parseISO, toISO } = window.ClearDayDates;
  const model = window.ClearDayReminderModel;

  function create(onSubmit) {
    const elements = {
      dialog: document.querySelector("#reminderDialog"),
      form: document.querySelector("#reminderForm"),
      id: document.querySelector("#reminderId"),
      title: document.querySelector("#title"),
      category: document.querySelector("#category"),
      date: document.querySelector("#date"),
      time: document.querySelector("#time"),
      endTime: document.querySelector("#endTime"),
      notes: document.querySelector("#notes"),
      heading: document.querySelector("#formTitle"),
      error: document.querySelector("#formError"),
      save: document.querySelector("#saveButton"),
      cancel: document.querySelector("#cancelReminder"),
      close: document.querySelector("#closeReminderDialog"),
    };

    elements.form.addEventListener("submit", handleSubmit);
    elements.cancel.addEventListener("click", close);
    elements.close.addEventListener("click", close);
    elements.dialog.addEventListener("cancel", (event) => {
      if (elements.save.disabled) event.preventDefault();
    });
    elements.form.querySelectorAll("[data-preset]").forEach((button) => {
      button.addEventListener("click", () => applyPreset(button.dataset.preset));
    });

    function open(options = {}) {
      const reminder = options.reminder;
      const selectedDate = options.date || toISO(new Date());
      const startTime = options.time || "";

      elements.id.value = reminder ? reminder.id : "";
      elements.title.value = reminder ? reminder.title : "";
      elements.category.value = reminder ? reminder.category : "subscription";
      elements.date.value = reminder ? reminder.date : selectedDate;
      elements.time.value = reminder ? reminder.time || "" : startTime;
      elements.endTime.value = reminder ? reminder.endTime || "" : model.defaultEndTime(startTime);
      elements.notes.value = reminder ? reminder.notes || "" : "";
      elements.heading.textContent = reminder ? "Edit reminder" : "Add reminder";
      elements.save.textContent = reminder ? "Update reminder" : "Save reminder";
      clearMessage();

      if (!elements.dialog.open) elements.dialog.showModal();
      requestAnimationFrame(() => elements.title.focus());
    }

    function close() {
      if (elements.save.disabled) return;
      if (elements.dialog.open) elements.dialog.close();
      elements.form.reset();
      elements.id.value = "";
      clearMessage();
    }

    async function handleSubmit(event) {
      event.preventDefault();
      const input = collect();
      const issue = model.validate(input);
      if (issue) {
        showMessage(issue.message);
        elements[issue.field].focus();
        return;
      }

      setSaving(true);
      clearMessage();
      try {
        await onSubmit(elements.id.value, input);
        closeAfterSave();
      } catch (error) {
        showMessage(error.message || "Could not save reminder.");
      } finally {
        setSaving(false);
      }
    }

    function collect() {
      const time = elements.time.value.trim();
      const endTime = elements.endTime.value.trim();
      return {
        title: elements.title.value.trim(),
        category: elements.category.value,
        date: elements.date.value,
        time,
        startTime: time,
        start: time,
        endTime,
        end: endTime,
        notes: elements.notes.value.trim(),
        isDone: false,
      };
    }

    function applyPreset(preset) {
      const base = elements.date.value ? parseISO(elements.date.value) : new Date();
      if (preset === "tomorrow") elements.date.value = toISO(addDays(base, 1));
      if (preset === "month") elements.date.value = toISO(addMonths(base, 1));
      if (preset === "year") elements.date.value = toISO(addMonths(base, 12));
    }

    function setSaving(isSaving) {
      elements.save.disabled = isSaving;
      elements.cancel.disabled = isSaving;
      elements.close.disabled = isSaving;
      elements.save.textContent = isSaving ? "Saving..." : elements.id.value ? "Update reminder" : "Save reminder";
    }

    function showMessage(message) {
      elements.error.textContent = message;
    }

    function clearMessage() {
      elements.error.textContent = "";
    }

    function closeAfterSave() {
      elements.save.disabled = false;
      elements.cancel.disabled = false;
      elements.close.disabled = false;
      close();
    }

    return { open, close };
  }

  window.ClearDayReminderForm = { create };
})();
