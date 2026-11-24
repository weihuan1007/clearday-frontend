(function () {
  "use strict";

  const minimumDate = "0001-01-01";
  const maximumDate = "9999-12-31";
  const calendar = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const monthLabel = new Intl.DateTimeFormat("en-MY", { month: "long", year: "numeric", timeZone: "UTC" });
  const shortDate = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", timeZone: "UTC" });
  const shortMonth = new Intl.DateTimeFormat("en-MY", { month: "short", timeZone: "UTC" });
  const weekday = new Intl.DateTimeFormat("en-MY", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  function today(now = new Date()) {
    const parts = Object.fromEntries(calendar.formatToParts(now).map((part) => [part.type, part.value]));
    return parts.year + "-" + parts.month + "-" + parts.day;
  }

  // Transaction dates are calendar dates. UTC arithmetic avoids browser time
  // zones and daylight-saving shifts when finding weeks, months, and years.
  function date(iso) {
    return new Date(iso + "T00:00:00Z");
  }

  function iso(value) {
    if (value.getUTCFullYear() < 1) return minimumDate;
    if (value.getUTCFullYear() > 9999) return maximumDate;
    return value.toISOString().slice(0, 10);
  }

  function addDays(value, count) {
    const next = date(value);
    next.setUTCDate(next.getUTCDate() + count);
    return iso(next);
  }

  function range(kind, anchor) {
    if (kind === "all") return { kind, start: minimumDate, end: maximumDate, label: "All time" };
    const first = date(anchor);
    if (Number.isNaN(first.getTime()) || iso(first) !== anchor || anchor < minimumDate || anchor > maximumDate) {
      throw new Error("Choose a valid period date.");
    }
    let end;
    switch (kind) {
      case "week":
        first.setUTCDate(first.getUTCDate() - (first.getUTCDay() + 6) % 7);
        end = addDays(iso(first), 6);
        break;
      case "month":
        first.setUTCDate(1);
        end = new Date(first);
        end.setUTCMonth(end.getUTCMonth() + 1, 0);
        end = iso(end);
        break;
      case "year":
        first.setUTCMonth(0, 1);
        end = first.getUTCFullYear().toString().padStart(4, "0") + "-12-31";
        break;
      default:
        throw new Error("Choose week, month, year, or all time.");
    }
    const start = iso(first);
    let label = monthLabel.format(first);
    if (kind === "week") {
      label = shortDate.format(first) + " – " + shortDate.format(date(end)) + " " + end.slice(0, 4);
      if (start.slice(0, 4) !== end.slice(0, 4)) {
        label = shortDate.format(first) + " " + start.slice(0, 4) + " – " + shortDate.format(date(end)) + " " + end.slice(0, 4);
      }
    }
    if (kind === "year") label = start.slice(0, 4);
    return { kind, start, end, label };
  }

  function shift(kind, anchor, amount) {
    if (kind === "all") return anchor;
    const current = range(kind, anchor);
    const next = date(current.start);
    if (kind === "week") next.setUTCDate(next.getUTCDate() + amount * 7);
    if (kind === "month") next.setUTCMonth(next.getUTCMonth() + amount);
    if (kind === "year") next.setUTCFullYear(next.getUTCFullYear() + amount);
    return iso(next);
  }

  function inRange(record, period) {
    return record.date >= period.start && record.date <= period.end;
  }

  function buckets(period, expenses) {
    const result = [];
    if (period.kind === "all") {
      const years = [...new Set(expenses.map((record) => record.date.slice(0, 4)))].sort();
      return years.map((year) => ({ start: year + "-01-01", end: year + "-12-31", label: year, amountSen: 0 }));
    }
    if (period.kind === "year") {
      for (let month = 1; month <= 12; month += 1) {
        const start = period.start.slice(0, 4) + "-" + String(month).padStart(2, "0") + "-01";
        const monthRange = range("month", start);
        result.push({ start, end: monthRange.end, label: shortMonth.format(date(start)), amountSen: 0 });
      }
      return result;
    }
    for (let start = period.start; start <= period.end;) {
      const step = period.kind === "week" ? 1 : 7 - (date(start).getUTCDay() + 6) % 7;
      const end = [addDays(start, step - 1), period.end].sort()[0];
      let label = shortDate.format(date(start));
      if (period.kind === "week") label = weekday.format(date(start));
      else if (start !== end) label += " – " + shortDate.format(date(end));
      result.push({ start, end, label, amountSen: 0 });
      if (end === period.end) break;
      start = addDays(end, 1);
    }
    return result;
  }

  function summarize(records, period) {
    const expenses = records.filter((record) => record.type === "expense" && inRange(record, period));
    const categories = new Map();
    const trend = buckets(period, expenses);
    let totalSen = 0;
    for (const record of expenses) {
      totalSen += record.amountSen;
      const category = categories.get(record.category) || { name: record.category, amountSen: 0, count: 0 };
      category.amountSen += record.amountSen;
      category.count += 1;
      categories.set(record.category, category);
      const bucket = trend.find((item) => record.date >= item.start && record.date <= item.end);
      if (bucket) bucket.amountSen += record.amountSen;
    }
    const ranked = [...categories.values()].sort((left, right) => right.amountSen - left.amountSen || left.name.localeCompare(right.name));
    for (const category of ranked) category.share = totalSen ? category.amountSen / totalSen : 0;
    const peak = trend.reduce((highest, bucket) => bucket.amountSen > (highest?.amountSen || 0) ? bucket : highest, null);
    return { categories: ranked, trend, totalSen, count: expenses.length, peak };
  }

  window.ClearDayMoneyAnalysis = { today, range, shift, inRange, summarize };
})();
