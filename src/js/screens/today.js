import { getState, setState, todayKey, emptyDayLog } from "../state/store.js";
import { navigate, registerRoute, refresh } from "../router.js";
import { rolloverIfNeeded, displayedHeatScore } from "../lib/dayEngine.js";
import { scheduledGoals, isScheduledOn, completionRatio, isGoalComplete, sortGoals, WEEKDAYS } from "../lib/goals.js";
import { stepBase } from "../lib/units.js";
import { toggleGoalDone, bumpGoalProgress } from "../state/goalActions.js";
import { renderForgeRing } from "../components/forgeRing.js";
import { updateBackgroundHeat, triggerHeatPulse, emitSparks, forgeStrike } from "../components/background.js";
import { el, withBottomNav, renderGoalRow, renderAvatar, sectionHeading, ICONS, formatUnitValue } from "../components/widgets.js";
import { t, fmtDateLong, fmtTime } from "../i18n/index.js";
import { haptic } from "../platform/native.js";

let lastRenderedScore = null;

function ensureFreshDay() {
  const state = getState();
  const rolled = rolloverIfNeeded(state);
  if (rolled !== state) setState(rolled);
  return getState();
}

function goalMeta(goal, log) {
  const chunks = [];
  if (goal.type === "quantitative") {
    chunks.push({
      text: t("goal.progressValue", {
        current: formatUnitValue(log.progress?.[goal.id] ?? 0, goal.unit),
        target: formatUnitValue(goal.targetBase, goal.unit),
        unit: t(`goal.unitsShort.${goal.unit}`),
      }),
    });
  }
  if (goal.reminderTime) chunks.push({ text: fmtTime(goal.reminderTime) });
  if (goal.activeDays.length < WEEKDAYS.length) {
    chunks.push({ text: goal.activeDays.map((day) => t(`goal.weekdays.${day}`)).join(" ") });
  }
  if (goal.paused) chunks.push({ text: t("common.paused"), tone: "paused" });
  return chunks;
}

function renderToday() {
  const state = ensureFreshDay();
  const key = todayKey();
  const log = state.dailyLogs[key] ?? emptyDayLog();
  const score = displayedHeatScore(state);
  updateBackgroundHeat(score);

  const content = el("div", { class: "screen" });

  if (!state.goals.length) {
    content.appendChild(el("div", { class: "empty-state", text: t("today.emptyPlan") }));
    content.appendChild(el("button", {
      class: "btn btn-primary", type: "button", text: t("today.startOnboarding"),
      onClick: () => navigate("/welcome"),
    }));
    return withBottomNav(content, "today", navigate);
  }

  // Header: date, greeting, profile avatar.
  const now = new Date();
  const greetingKey = now.getHours() < 12 ? "greetingMorning" : now.getHours() < 18 ? "greetingAfternoon" : "greetingEvening";
  const greeting = state.profile.displayName
    ? `${t(`today.${greetingKey}`)}, ${state.profile.displayName}`
    : t(`today.${greetingKey}`);

  content.appendChild(el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)" }, [
    el("div", { style: "min-width:0" }, [
      el("div", { class: "text-micro text-tertiary mono", text: fmtDateLong(now) }),
      el("h1", { style: "margin-top:2px", text: greeting }),
    ]),
    renderAvatar(state.profile.photo, { onClick: () => navigate("/profile") }),
  ]));

  // Forge Ring
  const ringHolder = el("div", { style: "display:flex;justify-content:center;margin:var(--space-6) 0 var(--space-8)" });
  const ring = renderForgeRing(score, {
    animateFrom: lastRenderedScore !== null && lastRenderedScore !== score ? lastRenderedScore : null,
  });
  ringHolder.appendChild(ring);
  content.appendChild(ringHolder);
  lastRenderedScore = score;

  const scheduledToday = scheduledGoals(state.goals, key);
  const primary = sortGoals(scheduledToday.filter((goal) => goal.isPrimary !== false));
  const secondary = sortGoals(scheduledToday.filter((goal) => goal.isPrimary === false));
  const others = sortGoals(state.goals.filter((goal) => !isScheduledOn(goal, key)));

  const addButton = el("button", {
    class: "btn-ghost",
    type: "button",
    style: "display:inline-flex;align-items:center;gap:6px",
    onClick: () => navigate("/goal?mode=new"),
  }, [el("span", { html: ICONS.plus }), el("span", { text: t("today.addGoal") })]);

  content.appendChild(sectionHeading(t("today.goals"), addButton));

  if (primary.length === 0 && secondary.length === 0) {
    content.appendChild(el("div", { class: "empty-state", text: t("today.noScheduled") }));
  } else {
    content.appendChild(buildGoalPanel(primary, log, ring));
  }

  if (secondary.length) {
    content.appendChild(sectionHeading(t("today.partialGoals")));
    content.appendChild(buildGoalPanel(secondary, log, ring));
  }

  // One direct message, tone-aware, celebrating completion without theatrics.
  const allDone = scheduledToday.length > 0 && scheduledToday.every((goal) => isGoalComplete(goal, log));
  const messages = t(`notifications.${state.profile.faithOptIn ? "faith" : state.profile.reminderTone}`) ?? t("notifications.direct");
  const message = allDone ? t("today.allDone") : messages[new Date().getDate() % messages.length];
  content.appendChild(el("div", { class: "card card-accent", style: "margin-top:var(--space-6)" }, [
    el("p", { class: "text-small", text: message }),
  ]));

  if (others.length) {
    content.appendChild(sectionHeading(t("today.otherGoals")));
    content.appendChild(buildGoalPanel(others, log, ring, { readOnly: true }));
  }

  // Shortcuts
  content.appendChild(sectionHeading(t("today.shortcuts")));
  const shortcuts = el("div", { class: "pill-row" });
  for (const [labelKey, path] of [["nav.meals", "/meals"], ["nav.resources", "/resources"], ["progress.title", "/progress"], ["recovery.title", "/recovery"]]) {
    shortcuts.appendChild(el("button", { class: "pill", type: "button", text: t(labelKey), onClick: () => navigate(path) }));
  }
  content.appendChild(shortcuts);

  return withBottomNav(content, "today", navigate);
}

function buildGoalPanel(goals, log, ring, { readOnly = false } = {}) {
  const panel = el("div", { class: "panel" });
  for (const goal of goals) {
    panel.appendChild(renderGoalRow({
      goal,
      display: {
        done: isGoalComplete(goal, log),
        ratio: completionRatio(goal, log),
        meta: goalMeta(goal, log),
      },
      onOpen: (target) => navigate(`/goal?id=${target.id}`),
      onToggle: readOnly ? null : (target, checkEl) => handleToggle(target, checkEl, ring),
      onQuickAdd: readOnly ? null : (target, buttonEl) => handleQuickAdd(target, buttonEl, ring),
    }));
  }
  return panel;
}

// Completion feedback: sparks at the control, heat wave toward the ring, the
// ring interpolates to the new score, and the day's final goal gets one strike.
function handleToggle(goal, checkEl, ring) {
  const result = toggleGoalDone(goal.id);
  if (result.completed) {
    emitSparks(checkEl);
    triggerHeatPulse({ strong: result.dayComplete });
    // The day-complete strike plays its own stronger haptic.
    if (!result.dayComplete) haptic("light");
  }
  finishInteraction(result, ring);
}

function handleQuickAdd(goal, buttonEl, ring) {
  const result = bumpGoalProgress(goal.id, stepBase(goal.unit));
  emitSparks(buttonEl, { count: result.completed ? 6 : 3 });
  if (result.completed) triggerHeatPulse({ strong: result.dayComplete });
  finishInteraction(result, ring);
}

function finishInteraction(result, ring) {
  refresh();
  if (result.dayComplete) {
    const target = document.querySelector(".forge-ring-wrap") ?? ring;
    setTimeout(() => forgeStrike(target), 220);
  }
}

export function registerTodayRoutes() {
  registerRoute("/today", renderToday);
}

export function resetRingAnimationBaseline() {
  lastRenderedScore = null;
}
