(function () {
  "use strict";

  const { daysBetween, formatLongDate, parseISO, startOfDay } = window.ClearDayDates;

  function normalizeAll(items) {
    return Array.isArray(items) ? items.map(normalize) : [];
  }

  function normalize(reminder) {
    if (!reminder || typeof reminder !== "object") return {};

    const time = firstValue(
      reminder.time,
      reminder.Time,
      reminder.startTime,
      reminder.StartTime,
      reminder.start_time,
      reminder.start,
    );
    const endTime = firstValue(reminder.endTime, reminder.EndTime, reminder.end_time, reminder.end);

    return {
      ...reminder,
      time,
      startTime: time,
      endTime,
      end: endTime,
    };
  }

  function firstValue(...values) {
    return values.find((value) => typeof value === "string" && value.trim()) || "";
  }

  function validate(input) {
    if (!input.title) return { field: "title", message: "Add a short title first." };
    if (!input.date) return { field: "date", message: "Choose the date you want to remember." };
    if (input.endTime && !input.time) {
      return { field: "time", message: "Add a start time before the end time." };
    }
    if (input.time && input.endTime && input.endTime <= input.time) {
      return { field: "endTime", message: "End time must be after the start time." };
    }
    return null;
  }

  function assertSavedTimeRange(input, saved) {
    if (input.time && saved.time !== input.time) {
      throw new Error("The backend did not save the selected start time. Deploy the updated backend and try again.");
    }
    if (input.endTime && saved.endTime !== input.endTime) {
      throw new Error("The backend did not save the selected end time. Deploy the updated backend and try again.");
    }
  }

  function getStatus(reminder) {
    if (reminder.isDone) return { label: "Done", kind: "done" };

    const days = daysBetween(startOfDay(new Date()), parseISO(reminder.date));
    if (days < 0) return { label: "Overdue", kind: "due" };
    if (days === 0) return { label: "Today", kind: "due" };
    if (days <= 7) return { label: `${days}d`, kind: "soon" };
    return { label: `${days}d`, kind: "" };
  }

  function formatTime(value) {
    if (!value) return "";
    const [hour, minute] = value.split(":").map(Number);
    const date = new Date(2000, 0, 1, hour, minute);
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function formatTimeRange(reminder) {
    if (!reminder.time) return "All day";
    const start = formatTime(reminder.time);
    return reminder.endTime ? `${start} - ${formatTime(reminder.endTime)}` : start;
  }

  function formatDateTime(reminder) {
    const date = formatLongDate(reminder.date);
    return reminder.time ? `${date} at ${formatTimeRange(reminder)}` : `${date} - All day`;
  }

  function minutesFromTime(value) {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  }

  function timeFromMinutes(value) {
    const safe = Math.max(0, Math.min(1439, value));
    const hours = String(Math.floor(safe / 60)).padStart(2, "0");
    const minutes = String(safe % 60).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  function defaultEndTime(startTime) {
    return startTime ? timeFromMinutes(Math.min(minutesFromTime(startTime) + 60, 1439)) : "";
  }

  function sort(left, right) {
    return (
      left.date.localeCompare(right.date) ||
      (left.time || "00:00").localeCompare(right.time || "00:00") ||
      (left.endTime || left.time || "00:00").localeCompare(right.endTime || right.time || "00:00") ||
      left.title.localeCompare(right.title)
    );
  }

  function forDate(reminders, iso) {
    return reminders.filter((reminder) => reminder.date === iso).slice().sort(sort);
  }

  function groupByDate(reminders) {
    const groups = new Map();
    reminders.slice().sort(sort).forEach((reminder) => {
      if (!groups.has(reminder.date)) groups.set(reminder.date, []);
      groups.get(reminder.date).push(reminder);
    });
    return Array.from(groups, ([date, items]) => ({ date, items }));
  }

  function createId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  window.ClearDayReminderModel = {
    assertSavedTimeRange,
    createId,
    defaultEndTime,
    forDate,
    formatDateTime,
    formatTime,
    formatTimeRange,
    getStatus,
    groupByDate,
    minutesFromTime,
    normalize,
    normalizeAll,
    sort,
    timeFromMinutes,
    validate,
  };
})();
