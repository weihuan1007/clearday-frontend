const DAYS_IN_VIEW = 42;
const UPCOMING_DAYS = 30;
const {
  addDays,
  addMonths,
  daysBetween,
  endOfMonth,
  formatLongDate,
  formatShortDate,
  parseISO,
  pluralize,
  startOfDay,
  startOfMonth,
  toISO,
} = window.ClearDayDates;
const { loadReminders: loadLocalReminders, saveReminders: saveLocalReminders } = window.ClearDayStorage;
const api = window.ClearDayAPI;

const categoryLabels = {
  subscription: "Subscription",
  event: "Event",
  payment: "Payment",
  personal: "Personal",
};

const elements = {
  monthTitle: document.querySelector("#monthTitle"),
  monthSummary: document.querySelector("#monthSummary"),
  syncStatus: document.querySelector("#syncStatus"),
  calendarGrid: document.querySelector("#calendarGrid"),
  selectedTitle: document.querySelector("#selectedTitle"),
  selectedCount: document.querySelector("#selectedCount"),
  selectedList: document.querySelector("#selectedList"),
  upcomingList: document.querySelector("#upcomingList"),
  form: document.querySelector("#reminderForm"),
  reminderId: document.querySelector("#reminderId"),
  title: document.querySelector("#title"),
  category: document.querySelector("#category"),
  date: document.querySelector("#date"),
  notes: document.querySelector("#notes"),
  formTitle: document.querySelector("#formTitle"),
  saveButton: document.querySelector("#saveButton"),
  cancelEdit: document.querySelector("#cancelEdit"),
  formError: document.querySelector("#formError"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  todayButton: document.querySelector("#todayButton"),
  emptyTemplate: document.querySelector("#emptyTemplate"),
};

const state = {
  viewDate: startOfMonth(new Date()),
  selectedDate: toISO(new Date()),
  reminders: [],
  storageMode: "loading",
  isLoading: true,
  syncError: "",
};

bindEvents();
init();

async function init() {
  render();

  try {
    state.reminders = await loadReminders();
  } finally {
    state.isLoading = false;
    render();
  }
}

function bindEvents() {
  elements.prevMonth.addEventListener("click", () => {
    state.viewDate = addMonths(state.viewDate, -1);
    render();
  });

  elements.nextMonth.addEventListener("click", () => {
    state.viewDate = addMonths(state.viewDate, 1);
    render();
  });

  elements.todayButton.addEventListener("click", () => {
    state.viewDate = startOfMonth(new Date());
    state.selectedDate = toISO(new Date());
    resetFormDate();
    render();
  });

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const today = new Date();
      const preset = button.dataset.preset;
      const date =
        preset === "tomorrow"
          ? addDays(today, 1)
          : preset === "month"
            ? addMonths(today, 1)
            : addMonths(today, 12);

      elements.date.value = toISO(date);
      clearMessage();
    });
  });

  elements.calendarGrid.addEventListener("click", (event) => {
    const dayButton = event.target.closest(".day-cell");
    if (!dayButton) return;

    state.selectedDate = dayButton.dataset.date;
    elements.date.value = state.selectedDate;
    render();
  });

  elements.form.addEventListener("submit", saveForm);
  elements.cancelEdit.addEventListener("click", () => {
    clearForm({ keepDate: true });
    render();
  });

  elements.selectedList.addEventListener("click", handleReminderAction);
  elements.upcomingList.addEventListener("click", handleReminderAction);
}

async function saveForm(event) {
  event.preventDefault();

  const input = {
    title: elements.title.value.trim(),
    category: elements.category.value,
    date: elements.date.value,
    notes: elements.notes.value.trim(),
    isDone: false,
  };
  const id = elements.reminderId.value;

  if (!input.title) {
    showMessage("Add a short title first.", "error");
    elements.title.focus();
    return;
  }

  if (!input.date) {
    showMessage("Choose the date you want to remember.", "error");
    elements.date.focus();
    return;
  }

  elements.saveButton.disabled = true;

  try {
    if (id) {
      const current = state.reminders.find((reminder) => reminder.id === id);
      input.isDone = current ? current.isDone : false;
      const updated = await saveReminder(id, input);
      state.reminders = state.reminders.map((reminder) => (reminder.id === id ? updated : reminder));
      showMessage("Reminder updated.", "success");
    } else {
      const created = await saveReminder("", input);
      state.reminders = [...state.reminders, created];
      showMessage("Reminder saved.", "success");
    }

    state.selectedDate = input.date;
    state.viewDate = startOfMonth(parseISO(input.date));
    clearForm({ keepDate: true });
    render();
  } catch (error) {
    showMessage(error.message || "Could not save reminder.", "error");
  } finally {
    elements.saveButton.disabled = false;
  }
}

async function handleReminderAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const reminder = state.reminders.find((item) => item.id === id);
  if (!reminder) return;

  button.disabled = true;

  try {
    if (button.dataset.action === "toggle") {
      const updated = await saveReminder(id, {
        title: reminder.title,
        category: reminder.category,
        date: reminder.date,
        notes: reminder.notes || "",
        isDone: !reminder.isDone,
      });
      state.reminders = state.reminders.map((item) => (item.id === id ? updated : item));
      render();
      return;
    }

    if (button.dataset.action === "delete") {
      await deleteReminder(id);
      state.reminders = state.reminders.filter((item) => item.id !== id);
      if (elements.reminderId.value === id) {
        clearForm({ keepDate: true });
      }
      render();
      return;
    }

    if (button.dataset.action === "edit") {
      elements.reminderId.value = reminder.id;
      elements.title.value = reminder.title;
      elements.category.value = reminder.category;
      elements.date.value = reminder.date;
      elements.notes.value = reminder.notes || "";
      elements.formTitle.textContent = "Edit reminder";
      elements.saveButton.textContent = "Update reminder";
      elements.cancelEdit.hidden = false;
      state.selectedDate = reminder.date;
      state.viewDate = startOfMonth(parseISO(reminder.date));
      clearMessage();
      render();
      elements.title.focus();
    }
  } catch (error) {
    showMessage(error.message || "Could not update reminder.", "error");
    render();
  } finally {
    button.disabled = false;
  }
}

function render() {
  renderCalendar();
  renderSelectedDay();
  renderUpcoming();
  renderSyncStatus();

  if (!elements.date.value) {
    resetFormDate();
  }
}

function renderCalendar() {
  const monthName = state.viewDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const monthStart = startOfMonth(state.viewDate);
  const monthEnd = endOfMonth(state.viewDate);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const remindersInMonth = state.reminders.filter((reminder) => {
    const reminderDate = parseISO(reminder.date);
    return reminderDate >= monthStart && reminderDate <= monthEnd;
  });
  const scheduledDays = new Set(remindersInMonth.map((reminder) => reminder.date)).size;
  const freeDays = monthEnd.getDate() - scheduledDays;

  elements.monthTitle.textContent = monthName;
  elements.monthSummary.textContent = state.isLoading
    ? "Loading reminders"
    : `${scheduledDays} scheduled ${pluralize(scheduledDays, "day")}, ${freeDays} free ${pluralize(
        freeDays,
        "day",
      )} this month`;
  elements.calendarGrid.innerHTML = "";

  for (let index = 0; index < DAYS_IN_VIEW; index += 1) {
    const date = addDays(gridStart, index);
    const iso = toISO(date);
    const items = getRemindersForDate(iso);
    const cell = document.createElement("button");
    const isCurrentMonth = date.getMonth() === state.viewDate.getMonth();
    const isToday = iso === toISO(new Date());
    const isSelected = iso === state.selectedDate;

    cell.type = "button";
    cell.className = [
      "day-cell",
      isCurrentMonth ? "" : "is-muted",
      isToday ? "is-today" : "",
      isSelected ? "is-selected" : "",
    ]
      .filter(Boolean)
      .join(" ");
    cell.dataset.date = iso;
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-selected", String(isSelected));
    cell.setAttribute(
      "aria-label",
      `${formatLongDate(iso)}: ${items.length || "no"} ${pluralize(items.length, "reminder")}`,
    );

    const topLine = document.createElement("span");
    topLine.className = "day-topline";

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = String(date.getDate());
    topLine.append(number);

    if (!items.length && isCurrentMonth && !state.isLoading) {
      const free = document.createElement("span");
      free.className = "free-label";
      free.textContent = "Free";
      topLine.append(free);
    }

    const itemWrap = document.createElement("span");
    itemWrap.className = "day-items";

    items.slice(0, 3).forEach((reminder) => {
      const chip = document.createElement("span");
      chip.className = `calendar-chip ${reminder.category}`;
      chip.textContent = reminder.title;
      itemWrap.append(chip);
    });

    if (items.length > 3) {
      const more = document.createElement("span");
      more.className = "more-chip";
      more.textContent = `+${items.length - 3} more`;
      itemWrap.append(more);
    }

    cell.append(topLine, itemWrap);
    elements.calendarGrid.append(cell);
  }
}

function renderSelectedDay() {
  const items = getRemindersForDate(state.selectedDate);
  elements.selectedTitle.textContent = formatShortDate(state.selectedDate);
  elements.selectedCount.textContent = `${items.length} ${pluralize(items.length, "item")}`;
  elements.selectedList.innerHTML = "";

  if (state.isLoading) {
    elements.selectedList.append(createEmptyState("Loading reminders", "Your calendar will appear shortly."));
    return;
  }

  if (!items.length) {
    elements.selectedList.append(createEmptyState("No reminders here", "This day is free."));
    return;
  }

  items.forEach((reminder) => {
    elements.selectedList.append(createReminderCard(reminder));
  });
}

function renderUpcoming() {
  const today = startOfDay(new Date());
  const windowEnd = addDays(today, UPCOMING_DAYS);
  const upcoming = state.reminders
    .filter((reminder) => {
      const date = parseISO(reminder.date);
      return !reminder.isDone && date >= today && date <= windowEnd;
    })
    .sort(sortByDateThenTitle);

  elements.upcomingList.innerHTML = "";

  if (state.isLoading) {
    elements.upcomingList.append(createEmptyState("Loading", "Checking your next reminders."));
    return;
  }

  if (!upcoming.length) {
    elements.upcomingList.append(createEmptyState("Nothing due soon", "The next 30 days are clear."));
    return;
  }

  upcoming.slice(0, 6).forEach((reminder) => {
    elements.upcomingList.append(createReminderCard(reminder, { compact: true }));
  });
}

function renderSyncStatus() {
  if (!elements.syncStatus) return;

  const labels = {
    loading: "Connecting",
    api: "AWS API",
    local: "Local browser",
    fallback: "Local fallback",
  };

  elements.syncStatus.textContent = labels[state.storageMode] || "Local browser";
  elements.syncStatus.dataset.mode = state.storageMode;
  elements.syncStatus.title = state.syncError || "";
}

function createReminderCard(reminder, options = {}) {
  const card = document.createElement("article");
  card.className = `reminder-card ${reminder.category}${reminder.isDone ? " is-done" : ""}`;

  const titleRow = document.createElement("div");
  titleRow.className = "reminder-title-row";

  const title = document.createElement("strong");
  title.textContent = reminder.title;

  const status = document.createElement("span");
  const statusInfo = getStatus(reminder);
  status.className = `status-pill ${statusInfo.kind}`;
  status.textContent = statusInfo.label;

  titleRow.append(title, status);

  const meta = document.createElement("p");
  meta.className = "reminder-meta";
  meta.textContent = `${categoryLabels[reminder.category]} - ${formatLongDate(reminder.date)}`;

  card.append(titleRow, meta);

  if (reminder.notes && !options.compact) {
    const notes = document.createElement("p");
    notes.className = "reminder-notes";
    notes.textContent = reminder.notes;
    card.append(notes);
  }

  const actions = document.createElement("div");
  actions.className = "reminder-actions";
  actions.append(
    createActionButton(reminder, "toggle", reminder.isDone ? "Undo" : "Done", "subtle-button"),
    createActionButton(reminder, "edit", "Edit", "subtle-button"),
    createActionButton(reminder, "delete", "Delete", "danger-button"),
  );
  card.append(actions);

  return card;
}

function createActionButton(reminder, action, label, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.dataset.action = action;
  button.dataset.id = reminder.id;
  button.textContent = label;
  return button;
}

function createEmptyState(title, text) {
  const fragment = elements.emptyTemplate.content.cloneNode(true);
  fragment.querySelector("strong").textContent = title;
  fragment.querySelector("span").textContent = text;
  return fragment;
}

async function loadReminders() {
  if (!api.apiBase) {
    state.storageMode = "local";
    return loadLocalReminders();
  }

  try {
    const items = await api.request("/reminders");
    state.storageMode = "api";
    state.syncError = "";
    return Array.isArray(items) ? items : [];
  } catch (error) {
    state.storageMode = "fallback";
    state.syncError = error.message;
    return loadLocalReminders();
  }
}

async function saveReminder(id, input) {
  if (state.storageMode === "api") {
    return api.request(id ? `/reminders/${encodeURIComponent(id)}` : "/reminders", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(input),
    });
  }

  const now = new Date().toISOString();
  if (id) {
    const updated = {
      ...state.reminders.find((reminder) => reminder.id === id),
      ...input,
      updatedAt: now,
    };
    saveLocalReminders(state.reminders.map((reminder) => (reminder.id === id ? updated : reminder)));
    return updated;
  }

  const created = {
    id: createId(),
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  saveLocalReminders([...state.reminders, created]);
  return created;
}

async function deleteReminder(id) {
  if (state.storageMode === "api") {
    await api.request(`/reminders/${encodeURIComponent(id)}`, { method: "DELETE" });
    return;
  }

  saveLocalReminders(state.reminders.filter((reminder) => reminder.id !== id));
}

function getRemindersForDate(iso) {
  return state.reminders.filter((reminder) => reminder.date === iso).sort(sortByDateThenTitle);
}

function getStatus(reminder) {
  if (reminder.isDone) {
    return { label: "Done", kind: "" };
  }

  const days = daysBetween(startOfDay(new Date()), parseISO(reminder.date));

  if (days < 0) {
    return { label: "Overdue", kind: "due" };
  }

  if (days === 0) {
    return { label: "Today", kind: "due" };
  }

  if (days <= 7) {
    return { label: `${days}d`, kind: "soon" };
  }

  return { label: `${days}d`, kind: "" };
}

function clearForm(options = {}) {
  const keepDate = options.keepDate;
  elements.reminderId.value = "";
  elements.title.value = "";
  elements.category.value = "subscription";
  elements.notes.value = "";
  elements.formTitle.textContent = "Add reminder";
  elements.saveButton.textContent = "Save reminder";
  elements.cancelEdit.hidden = true;

  if (keepDate) {
    elements.date.value = state.selectedDate;
  } else {
    resetFormDate();
  }
}

function resetFormDate() {
  elements.date.value = state.selectedDate || toISO(new Date());
}

function showMessage(message, type) {
  elements.formError.textContent = message;
  elements.formError.classList.toggle("success", type === "success");
}

function clearMessage() {
  elements.formError.textContent = "";
  elements.formError.classList.remove("success");
}

function sortByDateThenTitle(a, b) {
  return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
