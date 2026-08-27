(function () {
  "use strict";

  const DAY_IN_MS = 86400000;

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  function addDays(date, days) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + days);
    return next;
  }

  function addMonths(date, months) {
    const next = new Date(date.getFullYear(), date.getMonth(), 1);
    const day = date.getDate();
    next.setMonth(next.getMonth() + months);
    next.setDate(Math.min(day, endOfMonth(next).getDate()));
    return next;
  }

  function parseISO(iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function toISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatLongDate(iso) {
    return parseISO(iso).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatShortDate(iso) {
    return parseISO(iso).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function daysBetween(start, end) {
    const startTime = parseISO(toISO(start)).getTime();
    const endTime = parseISO(toISO(end)).getTime();
    return Math.round((endTime - startTime) / DAY_IN_MS);
  }

  function pluralize(count, singular) {
    return count === 1 ? singular : `${singular}s`;
  }

  window.ClearDayDates = {
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
  };
})();
