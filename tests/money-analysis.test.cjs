const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");

const browser = { window: {} };
runInNewContext(readFileSync(resolve(__dirname, "../money-analysis.js"), "utf8"), browser);
const analysis = browser.window.ClearDayMoneyAnalysis;

function expense(id, date, category, amountSen) {
  return { id, type: "expense", date, category, amountSen };
}

test("today uses Kuala Lumpur time across a UTC date boundary", () => {
  assert.equal(analysis.today(new Date("2026-11-24T15:59:59Z")), "2026-11-24");
  assert.equal(analysis.today(new Date("2026-11-24T16:00:00Z")), "2026-11-25");
});

test("weeks run Monday to Sunday, including across years", () => {
  const week = analysis.range("week", "2026-11-29");
  assert.equal(week.start, "2026-11-23");
  assert.equal(week.end, "2026-11-29");
  const newYear = analysis.range("week", "2027-01-01");
  assert.equal(newYear.start, "2026-12-28");
  assert.equal(newYear.end, "2027-01-03");
  assert.match(newYear.label, /2026.*2027/);
});

test("month and year ranges handle leap days and the supported date limits", () => {
  assert.equal(analysis.range("month", "2024-02-29").end, "2024-02-29");
  assert.equal(analysis.range("month", "2026-02-10").end, "2026-02-28");
  assert.equal(analysis.range("year", "2024-06-02").start, "2024-01-01");
  assert.equal(analysis.range("year", "2024-06-02").end, "2024-12-31");
  assert.equal(analysis.range("month", "0099-02-10").start, "0099-02-01");
  assert.equal(analysis.range("week", "0001-01-01").start, "0001-01-01");
  assert.equal(analysis.range("week", "9999-12-31").end, "9999-12-31");
  assert.throws(() => analysis.range("month", "2026-02-30"));
  assert.throws(() => analysis.range("month", "0000-01-01"));
});

test("navigation shifts calendar periods without month-end overflow", () => {
  assert.equal(analysis.shift("month", "2026-01-31", 1), "2026-02-01");
  assert.equal(analysis.shift("month", "2026-12-31", 1), "2027-01-01");
  assert.equal(analysis.shift("week", "2027-01-01", -1), "2026-12-21");
  assert.equal(analysis.shift("year", "2024-02-29", 1), "2025-01-01");
  assert.equal(analysis.shift("month", "0001-01-01", -1), "0001-01-01");
  assert.equal(analysis.shift("year", "9999-12-31", 1), "9999-12-31");
});

test("rankings and shares use expenses only and keep exact sen", () => {
  const entries = [
    expense("a", "2026-11-23", "Food", 2000),
    expense("b", "2026-11-29", "Food", 1),
    expense("c", "2026-11-25", "Transport", 999),
    expense("d", "2026-11-22", "Shopping", 50000),
    expense("e", "2026-11-30", "Shopping", 50000),
    { id: "f", type: "income", date: "2026-11-23", category: "Salary", amountSen: 300000 },
    { id: "g", type: "transfer", date: "2026-11-23", category: "Savings", amountSen: 100000 },
  ];
  const result = analysis.summarize(entries, analysis.range("week", "2026-11-24"));
  assert.equal(result.totalSen, 3000);
  assert.equal(result.count, 3);
  assert.equal(result.categories[0].name, "Food");
  assert.equal(result.categories[0].amountSen, 2001);
  assert.equal(result.categories[0].share, 2001 / 3000);
  assert.equal(result.trend.length, 7);
  assert.equal(result.trend.reduce((total, bucket) => total + bucket.amountSen, 0), result.totalSen);
  assert.equal(result.peak.start, "2026-11-23");
});

test("monthly weekly buckets partition every date once in leap and ordinary years", () => {
  for (const year of ["2024", "2026"]) {
    for (let month = 1; month <= 12; month += 1) {
      const prefix = year + "-" + String(month).padStart(2, "0");
      const period = analysis.range("month", prefix + "-15");
      const length = Number(period.end.slice(8));
      const entries = Array.from({ length }, (_, index) =>
        expense(String(index), prefix + "-" + String(index + 1).padStart(2, "0"), "Food", 1));
      const result = analysis.summarize(entries, period);
      assert.equal(result.totalSen, length);
      assert.equal(result.trend.reduce((total, bucket) => total + bucket.amountSen, 0), length);
      assert.ok(result.trend.every((bucket) => bucket.start >= period.start && bucket.end <= period.end));
      for (const entry of entries) {
        assert.equal(result.trend.filter((bucket) => entry.date >= bucket.start && entry.date <= bucket.end).length, 1);
      }
    }
  }
});

test("year and all-time charts include custom categories and show zero months", () => {
  const entries = [
    expense("a", "2025-12-31", "Other", 50),
    expense("b", "2026-01-01", "__proto__", 100),
    expense("c", "2026-12-31", "旅行", 200),
  ];
  const yearly = analysis.summarize(entries, analysis.range("year", "2026-11-24"));
  assert.equal(yearly.totalSen, 300);
  assert.equal(yearly.trend.length, 12);
  assert.equal(yearly.trend[0].amountSen, 100);
  assert.equal(yearly.trend[1].amountSen, 0);
  assert.equal(yearly.trend[11].amountSen, 200);
  const all = analysis.summarize(entries, analysis.range("all", "2026-11-24"));
  assert.equal(all.totalSen, 350);
  assert.equal(all.trend.length, 2);
});

test("charts recalculate after editing or deleting a transaction and handle no expenses", () => {
  const period = analysis.range("month", "2026-11-24");
  const original = expense("a", "2026-11-24", "Food", 2000);
  const updated = { ...original, amountSen: 2550, category: "Transport" };
  assert.equal(analysis.summarize([original], period).categories[0].name, "Food");
  const edited = analysis.summarize([updated], period);
  assert.equal(edited.totalSen, 2550);
  assert.equal(edited.categories[0].name, "Transport");
  const empty = analysis.summarize([], period);
  assert.equal(empty.totalSen, 0);
  assert.equal(empty.categories.length, 0);
  assert.equal(empty.peak, null);
  assert.ok(empty.trend.every((bucket) => bucket.amountSen === 0));
});
