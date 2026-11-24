(function () {
  "use strict";

  const model = window.ClearDayMoneyModel;
  const analysis = window.ClearDayMoneyAnalysis;
  const percent = new Intl.NumberFormat("en-MY", { style: "percent", maximumFractionDigits: 1 });
  const element = (name) => document.getElementById("money" + name);

  function create(onCategorySelected) {
    const root = element("CategoryChart");
    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-spend-category]");
      if (button) onCategorySelected(button.dataset.spendCategory);
    });

    function render(records, period, loaded, selectedCategory) {
      const summary = analysis.summarize(records, period);
      element("AnalysisPeriod").textContent = period.label;
      element("AnalysisCaption").textContent = loaded
        ? summary.count + " expense " + (summary.count === 1 ? "transaction" : "transactions") + " · " + model.formatAmount(summary.totalSen)
        : "Your spending charts will appear after transactions load.";
      element("ChartsEmpty").hidden = !loaded || summary.count > 0;
      element("ChartsContent").hidden = !loaded || summary.count === 0;
      element("ChartsEmpty").textContent = "No expenses in this period. Choose another period or add an expense.";
      element("CategoryInsight").textContent = summary.categories.length
        ? summary.categories[0].name + " is your largest category at " + percent.format(summary.categories[0].share) + " of expenses."
        : "";
      const activeCategory = document.activeElement?.closest("[data-spend-category]")?.dataset.spendCategory;
      root.replaceChildren(...summary.categories.map((category) => categoryBar(category, summary.totalSen, selectedCategory)));
      // A Telegram update can reorder categories while someone is using a
      // keyboard. Keep focus on the same category, or the clear-filter button.
      if (activeCategory !== undefined) {
        const button = Array.from(root.children).find((item) => item.dataset.spendCategory === activeCategory);
        (button || element("HistoryTitle")).focus({ preventScroll: true });
      }
      element("TrendTitle").textContent = {
        week: "Spending by day", month: "Spending by week", year: "Spending by month", all: "Spending by year",
      }[period.kind];
      element("TrendInsight").textContent = summary.peak
        ? "Highest spending · " + summary.peak.label + " · " + model.formatAmount(summary.peak.amountSen)
        : "";
      element("TrendExplanation").textContent = period.kind === "month"
        ? "Monday–Sunday weeks, limited to the dates in this month."
        : "All amounts are recorded expenses in MYR.";
      const maximum = Math.max(0, ...summary.trend.map((bucket) => bucket.amountSen));
      element("TrendChart").replaceChildren(...summary.trend.map((bucket) => trendBar(bucket, maximum)));
    }

    return { render };
  }

  function node(tag, className, text) {
    const value = document.createElement(tag);
    value.className = className;
    if (text !== undefined) value.textContent = text;
    return value;
  }

  // Labels and amounts are ordinary text, so charts remain readable to screen
  // readers, touch users, and anyone who cannot distinguish the bar colors.
  function barTrack(amountSen, maximum) {
    const track = node("span", "money-bar-track");
    track.setAttribute("aria-hidden", "true");
    const fill = node("span", "money-bar-fill");
    fill.style.width = (maximum ? amountSen / maximum * 100 : 0) + "%";
    track.append(fill);
    return track;
  }

  function categoryBar(category, maximum, selected) {
    const button = node("button", "money-category-bar");
    button.type = "button";
    button.dataset.spendCategory = category.name;
    button.setAttribute("aria-pressed", String(selected === category.name));
    button.setAttribute("aria-label", category.name + ", " + model.formatAmount(category.amountSen) + ", " +
      percent.format(category.share) + " of expenses. Show these transactions.");
    const heading = node("span", "money-bar-heading");
    heading.append(node("strong", "money-bar-label", category.name), node("span", "money-bar-value", model.formatAmount(category.amountSen)));
    const detail = node("span", "money-bar-detail", percent.format(category.share) + " of expenses · " +
      category.count + " " + (category.count === 1 ? "transaction" : "transactions"));
    button.append(heading, barTrack(category.amountSen, maximum), detail);
    return button;
  }

  function trendBar(bucket, maximum) {
    const row = node("li", "money-trend-bar");
    const heading = node("span", "money-bar-heading");
    heading.append(node("span", "money-bar-label", bucket.label), node("strong", "money-bar-value", model.formatAmount(bucket.amountSen)));
    row.append(heading, barTrack(bucket.amountSen, maximum));
    return row;
  }

  window.ClearDayMoneyCharts = { create };
})();
