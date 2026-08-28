(function () {
  "use strict";

  const VALID_PAGES = new Set(["calendar", "events"]);
  const dates = window.ClearDayDates;
  const model = window.ClearDayReminderModel;
  const repository = window.ClearDayRepository.create();
  const view = window.ClearDayCalendarView;

  const elements = {
    pages: Array.from(document.querySelectorAll("[data-page]")),
    pageLinks: Array.from(document.querySelectorAll("[data-page-link]")),
    monthView: document.querySelector("#monthView"),
    dayView: document.querySelector("#dayView"),
    monthActions: document.querySelector("[data-month-actions]"),
    calendarGrid: document.querySelector("#calendarGrid"),
    selectedList: document.querySelector("#selectedList"),
    eventsByDate: document.querySelector("#eventsByDate"),
    prevMonth: document.querySelector("#prevMonth"),
    nextMonth: document.querySelector("#nextMonth"),
    today: document.querySelector("#todayButton"),
    backToMonth: document.querySelector("#backToMonth"),
    prevDay: document.querySelector("#prevDay"),
    nextDay: document.querySelector("#nextDay"),
    dayToday: document.querySelector("#dayTodayButton"),
    addReminder: document.querySelector("#addReminder"),
    addDayReminder: document.querySelector("#addDayReminder"),
    addFromEvents: document.querySelector("#addFromEvents"),
    deleteDialog: document.querySelector("#deleteDialog"),
    deleteText: document.querySelector("#deleteDialogText"),
    deleteError: document.querySelector("#deleteDialogError"),
    confirmDelete: document.querySelector("#confirmDelete"),
    cancelDelete: document.querySelector("#cancelDelete"),
  };

  const today = dates.startOfDay(new Date());
  const state = {
    reminders: [],
    selectedDate: dates.toISO(today),
    viewDate: dates.startOfMonth(today),
    activePage: getPageFromLocation(),
    calendarMode: "month",
    isLoading: true,
    pendingDeleteId: "",
  };

  const reminderForm = window.ClearDayReminderForm.create(saveReminderFromForm);

  bindEvents();
  render();
  void loadReminders();

  function bindEvents() {
    window.addEventListener("hashchange", () => {
      state.activePage = getPageFromLocation();
      render();
    });

    elements.prevMonth.addEventListener("click", () => changeMonth(-1));
    elements.nextMonth.addEventListener("click", () => changeMonth(1));
    elements.today.addEventListener("click", showCurrentMonth);
    elements.calendarGrid.addEventListener("click", handleCalendarClick);

    elements.backToMonth.addEventListener("click", showMonth);
    elements.prevDay.addEventListener("click", () => changeDay(-1));
    elements.nextDay.addEventListener("click", () => changeDay(1));
    elements.dayToday.addEventListener("click", () => openDay(dates.toISO(new Date())));

    elements.addReminder.addEventListener("click", () => openNewReminder());
    elements.addDayReminder.addEventListener("click", () => openNewReminder());
    elements.addFromEvents.addEventListener("click", () => openNewReminder(dates.toISO(new Date())));

    elements.selectedList.addEventListener("click", handleScheduleClick);
    elements.eventsByDate.addEventListener("click", handleReminderAction);

    elements.confirmDelete.addEventListener("click", confirmDelete);
    elements.cancelDelete.addEventListener("click", closeDeleteDialog);
    elements.deleteDialog.addEventListener("cancel", (event) => {
      if (elements.confirmDelete.disabled) event.preventDefault();
    });
    elements.deleteDialog.addEventListener("click", (event) => {
      if (event.target === elements.deleteDialog && !elements.confirmDelete.disabled) closeDeleteDialog();
    });
  }

  async function loadReminders() {
    state.reminders = await repository.load();
    state.isLoading = false;
    render();
  }

  function changeMonth(amount) {
    state.viewDate = dates.startOfMonth(dates.addMonths(state.viewDate, amount));
    render();
  }

  function showCurrentMonth() {
    const now = new Date();
    state.selectedDate = dates.toISO(now);
    state.viewDate = dates.startOfMonth(now);
    render();
  }

  function handleCalendarClick(event) {
    const cell = event.target.closest("[data-date]");
    if (!cell) return;
    openDay(cell.dataset.date);
  }

  function openDay(iso) {
    state.selectedDate = iso;
    state.viewDate = dates.startOfMonth(dates.parseISO(iso));
    state.calendarMode = "day";
    state.activePage = "calendar";
    setHash("calendar");
    render();
  }

  function showMonth() {
    state.calendarMode = "month";
    render();
    requestAnimationFrame(() => {
      const selectedCell = elements.calendarGrid.querySelector(`[data-date="${state.selectedDate}"]`);
      if (selectedCell) selectedCell.focus();
    });
  }

  function changeDay(amount) {
    openDay(dates.toISO(dates.addDays(dates.parseISO(state.selectedDate), amount)));
  }

  function openNewReminder(date = state.selectedDate, time = "") {
    reminderForm.open({ date, time });
  }

  function handleScheduleClick(event) {
    const timeSlot = event.target.closest("[data-add-time]");
    if (timeSlot) {
      openNewReminder(state.selectedDate, timeSlot.dataset.addTime);
      return;
    }
    void handleReminderAction(event);
  }

  async function handleReminderAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const reminder = state.reminders.find((item) => item.id === button.dataset.id);
    if (!reminder) return;

    if (button.dataset.action === "edit") {
      reminderForm.open({ reminder });
      return;
    }
    if (button.dataset.action === "delete") {
      requestDelete(reminder);
      return;
    }
    if (button.dataset.action !== "toggle") return;

    button.disabled = true;
    try {
      const input = reminderInput(reminder, !reminder.isDone);
      const updated = await repository.save(reminder.id, input, state.reminders);
      replaceReminder(updated);
      showToast(updated.isDone ? "Reminder marked done." : "Reminder reopened.");
    } catch (error) {
      showToast(error.message || "Could not update reminder.", "error");
    } finally {
      button.disabled = false;
    }
  }

  async function saveReminderFromForm(id, input) {
    if (id) {
      const current = state.reminders.find((reminder) => reminder.id === id);
      input.isDone = current ? current.isDone : false;
    }

    const saved = await repository.save(id, input, state.reminders);
    if (id) replaceReminder(saved, false);
    else state.reminders.push(saved);

    state.selectedDate = input.date;
    state.viewDate = dates.startOfMonth(dates.parseISO(input.date));
    state.calendarMode = "day";
    state.activePage = "calendar";
    setHash("calendar");
    render();
    showToast(id ? "Reminder updated." : "Reminder saved.");
  }

  function replaceReminder(updated, shouldRender = true) {
    state.reminders = state.reminders.map((reminder) => (reminder.id === updated.id ? updated : reminder));
    if (shouldRender) render();
  }

  function reminderInput(reminder, isDone) {
    return {
      title: reminder.title,
      category: reminder.category,
      date: reminder.date,
      time: reminder.time || "",
      startTime: reminder.time || "",
      start: reminder.time || "",
      endTime: reminder.endTime || "",
      end: reminder.endTime || "",
      notes: reminder.notes || "",
      isDone,
    };
  }

  function requestDelete(reminder) {
    state.pendingDeleteId = reminder.id;
    elements.deleteText.textContent = `"${reminder.title}" on ${model.formatDateTime(reminder)} will be removed.`;
    elements.deleteError.textContent = "";
    elements.deleteDialog.showModal();
    elements.cancelDelete.focus();
  }

  async function confirmDelete() {
    const id = state.pendingDeleteId;
    if (!id) return closeDeleteDialog();

    elements.confirmDelete.disabled = true;
    elements.cancelDelete.disabled = true;
    try {
      await repository.remove(id, state.reminders);
      state.reminders = state.reminders.filter((reminder) => reminder.id !== id);
      closeDeleteDialog();
      render();
      showToast("Reminder deleted.");
    } catch (error) {
      elements.deleteError.textContent = error.message || "Could not delete reminder.";
    } finally {
      elements.confirmDelete.disabled = false;
      elements.cancelDelete.disabled = false;
    }
  }

  function closeDeleteDialog() {
    if (elements.deleteDialog.open) elements.deleteDialog.close();
    state.pendingDeleteId = "";
    elements.deleteError.textContent = "";
  }

  function render() {
    elements.pages.forEach((page) => {
      const active = page.dataset.page === state.activePage;
      page.hidden = !active;
      page.classList.toggle("is-active", active);
    });
    elements.pageLinks.forEach((link) => {
      const active = link.dataset.pageLink === state.activePage;
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    const dayMode = state.activePage === "calendar" && state.calendarMode === "day";
    elements.monthView.hidden = dayMode;
    elements.dayView.hidden = !dayMode;
    elements.monthActions.hidden = state.activePage !== "calendar" || dayMode;

    view.renderMonth(state);
    view.renderDay(state);
    view.renderEvents(state);
    view.renderSyncStatus(state.isLoading ? "loading" : repository.getMode(), repository.getSyncError());
  }

  function showToast(message, kind = "success") {
    let toast = document.querySelector("#appToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "appToast";
      toast.className = "toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.dataset.kind = kind;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function getPageFromLocation() {
    const page = window.location.hash.replace("#", "").trim();
    return VALID_PAGES.has(page) ? page : "calendar";
  }

  function setHash(page) {
    if (window.location.hash !== `#${page}`) window.location.hash = page;
  }
})();
