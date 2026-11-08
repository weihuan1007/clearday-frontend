(function () {
  "use strict";

  // These choices come from the standalone Money Flow app.
  const categories = {
    expense: ["Food", "Transport", "Bills", "Shopping", "Health", "Family", "Entertainment", "Other"],
    income: ["Salary", "Freelance", "Refund", "Gift", "Investment", "Other"],
    transfer: ["Top Up", "Bank Move", "Card Payment", "Savings", "Other"],
  };
  const accounts = ["Touch 'n Go", "Apple Pay", "Bank", "Debit Card", "Credit Card", "GrabPay", "Cash"];
  const labels = { expense: "Expense", income: "Income", transfer: "Transfer" };
  const currency = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" });
  const monthFormatter = new Intl.DateTimeFormat("en-MY", { year: "numeric", month: "long", timeZone: "UTC" });

  // Split the amount as text to avoid rounding a floating-point product.
  function parseAmount(value) {
    const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(String(value).trim());
    if (!match) throw new Error("Enter an RM amount with up to two decimal places.");
    const sen = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
    if (!sen) throw new Error("Enter an amount greater than zero.");
    return sen;
  }

  function normalize(record) {
    const { id, type, amountSen, date } = record;
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,120}$/.test(id)) throw new Error("Invalid transaction ID.");
    if (!Object.hasOwn(categories, type)) throw new Error("Choose a transaction type.");
    if (!Number.isSafeInteger(amountSen) || amountSen < 1 || amountSen > 99_999_999_999) {
      throw new Error("Invalid MYR amount.");
    }
    if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choose a valid transaction date.");
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new Error("Choose a valid transaction date.");
    }
    const category = String(record.category ?? "").trim();
    const account = String(record.account ?? "").trim();
    const note = String(record.note ?? "").trim();
    const source = String(record.source ?? "").trim() || "manual";
    if (!category || !account || [...category].length > 120 || [...account].length > 120) {
      throw new Error("Choose an account and category of up to 120 characters.");
    }
    if ([...note].length > 80 || [...source].length > 40) throw new Error("The note or source is too long.");
    return { id, type, amountSen, date, category, account, note, source };
  }

  function readExport(text) {
    const data = JSON.parse(text.replace(/^\uFEFF/, ""));
    const rows = Array.isArray(data) ? data : data?.records;
    if (!Array.isArray(rows)) throw new Error("Choose a Money Flow or ClearDay JSON export.");

    const records = [];
    let invalid = 0;
    for (const row of rows) {
      try {
        // Money Flow exports RM as amount. ClearDay backups keep exact sen.
        records.push(normalize({ ...row, amountSen: row.amountSen ?? parseAmount(row.amount) }));
      } catch {
        invalid += 1;
      }
    }
    return { records, invalid };
  }

  function totals(records) {
    let income = 0;
    let expense = 0;
    for (const record of records) {
      if (record.type === "income") income += record.amountSen;
      if (record.type === "expense") expense += record.amountSen;
    }
    return { income, expense, net: income - expense };
  }

  window.ClearDayMoneyModel = {
    accounts, categories, labels, normalize, parseAmount, readExport, totals,
    formatAmount: (sen) => currency.format(sen / 100),
    formatMonth: (month) => monthFormatter.format(new Date(month + "-01")),
  };
})();
