(function () {
  "use strict";

  const DAYS_IN_VIEW = 42;
  const HOUR_HEIGHT = 64;
  const MINUTES_IN_DAY = 1440;
  const categoryLabels = {
    subscription: "Subscription",
    event: "Event",
    payment: "Payment",
    personal: "Personal",
  };
  const dates = window.ClearDayDates;
  const model = window.ClearDayReminderModel;

  function renderMonth(state) {
    const title = document.querySelector("#monthTitle");
    const summary = document.querySelector("#monthSummary");
    const grid = document.querySelector("#calendarGrid");
    const monthStart = dates.startOfMonth(state.viewDate);
    const monthEnd = dates.endOfMonth(state.viewDate);
    const gridStart = dates.addDays(monthStart, -monthStart.getDay());
    const inMonth = state.reminders.filter((reminder) => {
      const date = dates.parseISO(reminder.date);
      return date >= monthStart && date <= monthEnd;
    });
    const scheduledDays = new Set(inMonth.map((reminder) => reminder.date)).size;
    const freeDays = monthEnd.getDate() - scheduledDays;

    title.textContent = state.viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    summary.textContent = state.isLoading
      ? "Loading reminders"
      : `${scheduledDays} scheduled ${dates.pluralize(scheduledDays, "day")}, ${freeDays} free ${dates.pluralize(freeDays, "day")}`;
    grid.replaceChildren();

    for (let index = 0; index < DAYS_IN_VIEW; index += 1) {
      const date = dates.addDays(gridStart, index);
      grid.append(createDayCell(state, date));
    }
  }

  function createDayCell(state, date) {
    const iso = dates.toISO(date);
    const items = model.forDate(state.reminders, iso);
    const isCurrentMonth = date.getMonth() === state.viewDate.getMonth();
    const isToday = iso === dates.toISO(new Date());
    const isSelected = iso === state.selectedDate;
    const cell = document.createElement("button");

    cell.type = "button";
    cell.className = classNames("day-cell", !isCurrentMonth && "is-muted", isToday && "is-today", isSelected && "is-selected");
    cell.dataset.date = iso;
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-selected", String(isSelected));
    cell.setAttribute("aria-label", `${dates.formatLongDate(iso)}: ${items.length || "no"} ${dates.pluralize(items.length, "reminder")}`);

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
    items.slice(0, 3).forEach((reminder) => itemWrap.append(createMonthChip(reminder)));

    if (items.length > 3) {
      const more = document.createElement("span");
      more.className = "more-chip";
      more.textContent = `+${items.length - 3} more`;
      itemWrap.append(more);
    }

    cell.append(topLine, itemWrap);
    return cell;
  }

  function createMonthChip(reminder) {
    const chip = document.createElement("span");
    chip.className = `calendar-chip ${reminder.category || "personal"}`;
    if (reminder.time) {
      const time = document.createElement("span");
      time.className = "chip-time";
      time.textContent = model.formatTime(reminder.time);
      chip.append(time);
    }
    const title = document.createElement("span");
    title.className = "chip-title";
    title.textContent = reminder.title;
    chip.append(title);
    return chip;
  }

  function renderDay(state) {
    const items = model.forDate(state.reminders, state.selectedDate);
    document.querySelector("#selectedTitle").textContent = dates.formatShortDate(state.selectedDate);
    document.querySelector("#selectedCount").textContent = `${items.length} ${dates.pluralize(items.length, "reminder")}`;

    const root = document.querySelector("#selectedList");
    root.replaceChildren();
    if (state.isLoading) {
      root.append(createEmptyState("Loading reminders", "Your schedule will appear shortly."));
      return;
    }
    root.append(createTimeline(state.selectedDate, items));
  }

  function createTimeline(selectedDate, items) {
    const wrapper = document.createDocumentFragment();
    const allDayItems = items.filter((reminder) => !reminder.time);
    const timedItems = items.filter((reminder) => reminder.time).sort(model.sort);

    if (allDayItems.length) {
      const allDay = document.createElement("section");
      allDay.className = "all-day-band";
      const label = document.createElement("span");
      label.className = "all-day-label";
      label.textContent = "All day";
      const list = document.createElement("div");
      list.className = "all-day-events";
      allDayItems.forEach((reminder) => list.append(createAllDayEvent(reminder)));
      allDay.append(label, list);
      wrapper.append(allDay);
    }

    const scroll = document.createElement("div");
    scroll.className = "timeline-scroll";
    scroll.tabIndex = 0;
    scroll.setAttribute("aria-label", `${dates.formatShortDate(selectedDate)} hour schedule`);

    const grid = document.createElement("div");
    grid.className = "timeline-grid";
    grid.style.height = `${24 * HOUR_HEIGHT}px`;
    const hours = document.createElement("div");
    hours.className = "timeline-hours";
    for (let hour = 0; hour < 24; hour += 1) hours.append(createHourSlot(hour));

    const events = document.createElement("div");
    events.className = "timeline-events";
    timedItems.forEach((reminder) => events.append(createTimelineEvent(reminder)));
    if (!items.length) events.append(createFreeDayNote());

    grid.append(hours, events);
    scroll.append(grid);
    wrapper.append(scroll);

    requestAnimationFrame(() => {
      const today = dates.toISO(new Date());
      const currentHour = selectedDate === today ? new Date().getHours() : 8;
      const firstHour = timedItems.length ? Math.floor(model.minutesFromTime(timedItems[0].time) / 60) : currentHour;
      scroll.scrollTop = Math.max(0, (firstHour - 1) * HOUR_HEIGHT);
    });

    return wrapper;
  }

  function createHourSlot(hour) {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "timeline-hour";
    slot.dataset.addTime = `${String(hour).padStart(2, "0")}:00`;
    slot.setAttribute("aria-label", `Add reminder at ${model.formatTime(slot.dataset.addTime)}`);

    const label = document.createElement("span");
    label.className = "timeline-hour-label";
    label.textContent = model.formatTime(slot.dataset.addTime);
    const line = document.createElement("span");
    line.className = "timeline-hour-line";
    slot.append(label, line);
    return slot;
  }

  function createTimelineEvent(reminder) {
    const start = model.minutesFromTime(reminder.time);
    const rawEnd = reminder.endTime ? model.minutesFromTime(reminder.endTime) : Math.min(start + 60, MINUTES_IN_DAY);
    const duration = rawEnd > start ? rawEnd - start : 60;
    const event = document.createElement("article");
    event.className = classNames("timeline-event", reminder.category || "personal", reminder.isDone && "is-done");
    event.style.top = `${(start / 60) * HOUR_HEIGHT}px`;
    event.style.height = `${Math.max(54, (duration / 60) * HOUR_HEIGHT - 4)}px`;
    event.setAttribute("aria-label", `${reminder.title}, ${model.formatTimeRange(reminder)}`);

    const content = document.createElement("button");
    content.type = "button";
    content.className = "timeline-event-content";
    content.dataset.action = "edit";
    content.dataset.id = reminder.id;
    const title = document.createElement("strong");
    title.textContent = reminder.title;
    const time = document.createElement("span");
    time.className = "timeline-event-time";
    time.textContent = model.formatTimeRange(reminder);
    content.append(title, time);

    const actions = createActions(reminder, true);
    event.append(content, actions);
    return event;
  }

  function createAllDayEvent(reminder) {
    const event = document.createElement("article");
    event.className = classNames("all-day-event", reminder.category || "personal", reminder.isDone && "is-done");
    const content = document.createElement("button");
    content.type = "button";
    content.className = "all-day-content";
    content.dataset.action = "edit";
    content.dataset.id = reminder.id;
    content.textContent = reminder.title;
    event.append(content, createActions(reminder, true));
    return event;
  }

  function renderEvents(state) {
    const groups = model.groupByDate(state.reminders);
    const total = state.reminders.length;
    document.querySelector("#eventsSummary").textContent = state.isLoading
      ? "Loading events"
      : `${total} ${dates.pluralize(total, "reminder")} across ${groups.length} ${dates.pluralize(groups.length, "date")}`;

    const root = document.querySelector("#eventsByDate");
    root.replaceChildren();
    if (state.isLoading) {
      root.append(createEmptyState("Loading events", "Your saved reminders will appear shortly."));
      return;
    }
    if (!groups.length) {
      root.append(createEmptyState("No events yet", "Your calendar is clear."));
      return;
    }

    groups.forEach((group, index) => root.append(createDateGroup(group, index)));
  }

  function createDateGroup(group, index) {
    const section = document.createElement("section");
    const headingId = `event-date-${index}`;
    section.className = "event-date-group";
    section.setAttribute("aria-labelledby", headingId);
    const heading = document.createElement("div");
    heading.className = "event-date-heading";
    const title = document.createElement("h3");
    title.id = headingId;
    title.textContent = dates.formatShortDate(group.date);
    const count = document.createElement("span");
    count.className = "count-pill";
    count.textContent = `${group.items.length} ${dates.pluralize(group.items.length, "item")}`;
    heading.append(title, count);
    const items = document.createElement("div");
    items.className = "event-date-items";
    group.items.forEach((reminder) => items.append(createReminderCard(reminder)));
    section.append(heading, items);
    return section;
  }

  function createReminderCard(reminder) {
    const card = document.createElement("article");
    const status = model.getStatus(reminder);
    card.className = classNames("reminder-card", reminder.category || "personal", reminder.isDone && "is-done");
    const titleRow = document.createElement("div");
    titleRow.className = "reminder-title-row";
    const title = document.createElement("strong");
    title.textContent = reminder.title;
    const pill = document.createElement("span");
    pill.className = classNames("status-pill", status.kind);
    pill.textContent = status.label;
    titleRow.append(title, pill);
    const meta = document.createElement("p");
    meta.className = "reminder-meta";
    meta.textContent = `${categoryLabels[reminder.category] || "Reminder"} - ${model.formatDateTime(reminder)}`;
    card.append(titleRow, meta);
    if (reminder.notes) {
      const notes = document.createElement("p");
      notes.className = "reminder-notes";
      notes.textContent = reminder.notes;
      card.append(notes);
    }
    card.append(createActions(reminder));
    return card;
  }

  function createActions(reminder, compact = false) {
    const actions = document.createElement("div");
    actions.className = compact ? "event-quick-actions" : "reminder-actions";
    if (!compact) actions.append(createActionButton(reminder, "toggle", reminder.isDone ? "Undo" : "Done", "subtle-button"));
    if (!compact) actions.append(createActionButton(reminder, "edit", "Edit", "subtle-button"));
    actions.append(createActionButton(reminder, "delete", "Delete", compact ? "icon-danger-button" : "danger-button"));
    return actions;
  }

  function createActionButton(reminder, action, label, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.dataset.action = action;
    button.dataset.id = reminder.id;
    button.textContent = className === "icon-danger-button" ? "x" : label;
    button.setAttribute("aria-label", `${label} ${reminder.title}`);
    if (className === "icon-danger-button") button.title = `Delete ${reminder.title}`;
    return button;
  }

  function createFreeDayNote() {
    const note = document.createElement("div");
    note.className = "timeline-empty-note";
    note.style.top = `${8 * HOUR_HEIGHT}px`;
    note.textContent = "This day is free. Select an hour to add something.";
    return note;
  }

  function createEmptyState(title, text) {
    const fragment = document.querySelector("#emptyTemplate").content.cloneNode(true);
    fragment.querySelector("strong").textContent = title;
    fragment.querySelector("span").textContent = text;
    return fragment;
  }

  function renderSyncStatus(mode, error) {
    const status = document.querySelector("#syncStatus");
    const labels = { loading: "Connecting", api: "AWS API", local: "Local browser", fallback: "Local fallback" };
    status.textContent = labels[mode] || labels.local;
    status.dataset.mode = mode;
    status.title = error || "";
  }

  function classNames(...values) {
    return values.filter(Boolean).join(" ");
  }

  window.ClearDayCalendarView = { renderDay, renderEvents, renderMonth, renderSyncStatus };
})();
