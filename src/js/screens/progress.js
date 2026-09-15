import { getState, setState, logEvent } from "../state/store.js";
import { navigate, registerRoute } from "../router.js";
import { rolloverIfNeeded, weeklySeries, weeklyTimestamps, goalWeeklyCompletion, displayedHeatScore, baselineScore } from "../lib/dayEngine.js";
import { weeklyRecommendationKey, weeklyCompletionRate, bestSupportedWindow, countActiveDays } from "../lib/weeklyRecommendation.js";
import { sortGoals } from "../lib/goals.js";
import { el, withBottomNav, renderWeeklyChart, renderChartLegend, sectionHeading, goalTitle } from "../components/widgets.js";
import { updateBackgroundHeat } from "../components/background.js";
import { t, fmtWeekdayNarrow, fmtDateShort, fmtPercent, fmtInt } from "../i18n/index.js";

function renderProgress() {
  const state0 = getState();
  const rolled = rolloverIfNeeded(state0);
  if (rolled !== state0) setState(rolled);
  const state = getState();

  const series = weeklySeries(state);
  const ratios = series.map((day) => day.ratio);
  const rate = weeklyCompletionRate(ratios);
  const activeDays = countActiveDays(series.map((day) => day.active));
  const bestWindow = bestSupportedWindow(weeklyTimestamps(state));
  const heatEnd = displayedHeatScore(state);
  const weekStartEntry = state.heatHistory.find((entry) => entry.date >= series[0].dateKey);
  const heatStart = weekStartEntry?.score ?? baselineScore(state);

  updateBackgroundHeat(heatEnd);
  logEvent("weekly_review_viewed");

  const content = el("div", { class: "screen" });
  content.appendChild(el("h1", { class: "display", text: t("progress.title") }));

  // ---- Weekly chart ----
  content.appendChild(sectionHeading(t("progress.thisWeek")));
  const chartDays = series.map((day) => ({
    label: fmtWeekdayNarrow(day.date),
    ratio: day.ratio,
    isToday: day.isToday,
    valueLabel: day.ratio == null ? "—" : fmtPercent(day.ratio),
    ariaLabel: day.ratio == null
      ? t("progress.barNoSchedule", { weekday: fmtWeekdayNarrow(day.date), date: fmtDateShort(day.date) })
      : t("progress.barLabel", { weekday: fmtWeekdayNarrow(day.date), date: fmtDateShort(day.date), percent: fmtPercent(day.ratio) }),
  }));
  const chartCard = el("div", { class: "card" }, [renderWeeklyChart(chartDays), renderChartLegend()]);
  content.appendChild(chartCard);

  // ---- Stats ----
  const stats = el("div", { style: "display:flex;gap:var(--space-3);margin-top:var(--space-4)" }, [
    statCard(t("progress.activeDays"), `${fmtInt(activeDays)}/7`),
    statCard(t("progress.heatScore"), `${fmtInt(heatStart)} → ${fmtInt(heatEnd)}`),
  ]);
  content.appendChild(stats);
  content.appendChild(el("p", { class: "text-micro text-tertiary", style: "margin-top:var(--space-2)", text: t("progress.activeDaysHelp") }));
  if (bestWindow) {
    content.appendChild(el("p", {
      class: "text-small text-secondary",
      style: "margin-top:var(--space-3)",
      text: t("progress.bestWindow", { window: t(`progress.windows.${bestWindow}`) }),
    }));
  }

  // ---- Completion by goal ----
  content.appendChild(sectionHeading(t("progress.completionByGoal")));
  const goals = sortGoals(state.goals);
  if (!goals.length) {
    content.appendChild(el("div", { class: "empty-state", text: t("progress.noGoalsYet") }));
  } else {
    const panel = el("div", { class: "panel" });
    for (const goal of goals) {
      const completion = goalWeeklyCompletion(state, goal);
      panel.appendChild(el("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);padding:var(--space-3) 0;min-height:52px" }, [
        el("span", { class: "text-small", style: "min-width:0", text: goalTitle(goal) }),
        el("span", {
          class: "mono text-small",
          style: `flex:none;color:${completion == null ? "var(--text-tertiary)" : "var(--ember-orange)"}`,
          text: completion == null ? t("common.noData") : fmtPercent(completion),
        }),
      ]));
    }
    content.appendChild(panel);
  }

  // ---- Rule-based recommendation ----
  content.appendChild(el("div", { class: "card card-accent", style: "margin-top:var(--space-6)" }, [
    el("p", { class: "text-small", text: t(`progress.recommendation.${weeklyRecommendationKey(rate)}`) }),
  ]));

  return withBottomNav(content, "progress", navigate);
}

function statCard(label, value) {
  return el("div", { class: "card", style: "flex:1;padding:var(--space-3) var(--space-4);min-width:0" }, [
    el("div", { class: "stat-label", text: label }),
    el("div", { class: "mono", style: "font-size:17px;margin-top:4px", text: value }),
  ]);
}

export function registerProgressRoutes() {
  registerRoute("/progress", renderProgress);
}
