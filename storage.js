(function () {
  "use strict";

  const LOCAL_STORAGE_KEY = "clearday.reminders.v1";
  const { addMonths, endOfMonth, toISO } = window.ClearDayDates;

  function loadReminders() {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);

    if (!stored) {
      const starters = createStarterReminders();
      saveReminders(starters);
      return starters;
    }

    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveReminders(reminders) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reminders));
  }

  function createStarterReminders() {
    const today = new Date();
    const weddingDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const lastDay = endOfMonth(today).getDate();
    weddingDay.setDate(Math.min(today.getDate() + 10, lastDay));
    const timestamp = new Date().toISOString();

    return [
      {
        id: createId(),
        title: "Relative wedding",
        category: "event",
        date: toISO(weddingDay),
        time: "14:30",
        startTime: "14:30",
        endTime: "18:00",
        end: "18:00",
        notes: "Add venue, outfit, and gift notes here.",
        isDone: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: createId(),
        title: "Spotify cancel check",
        category: "subscription",
        date: toISO(addMonths(today, 12)),
        time: "09:00",
        startTime: "09:00",
        endTime: "09:30",
        end: "09:30",
        notes: "Review before the plan renews.",
        isDone: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: createId(),
        title: "YouTube Premium review",
        category: "subscription",
        date: toISO(addMonths(today, 12)),
        time: "17:30",
        startTime: "17:30",
        endTime: "18:00",
        end: "18:00",
        notes: "Decide whether to keep or cancel.",
        isDone: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: createId(),
        title: "Credit card annual fee",
        category: "payment",
        date: toISO(addMonths(today, 11)),
        time: "",
        startTime: "",
        endTime: "",
        end: "",
        notes: "Call before the yearly fee posts.",
        isDone: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ];
  }

  function createId() {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  window.ClearDayStorage = {
    loadReminders,
    saveReminders,
  };
})();
