// Goal rules: creation, validation, scheduling by weekday, and completion.
// Pure functions — no DOM, no storage — so they stay unit-testable.
import { toBase, fromBase, suggestedUnitForCategory, unitOf } from "./units.js";
import { todayKey } from "./dateKey.js";

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const GOAL_CATEGORIES = ["routine", "study", "gym", "water", "meditation", "sleep", "other"];
export const TITLE_MAX_LENGTH = 60;

// JS getDay(): 0 = Sunday.
const DAY_INDEX_TO_ID = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function weekdayIdFromDateKey(dateKey) {
  return DAY_INDEX_TO_ID[new Date(`${dateKey}T00:00:00`).getDay()];
}

export function weekdayIdFromDate(date) {
  return DAY_INDEX_TO_ID[date.getDay()];
}

let idCounter = 0;
export function newGoalId() {
  idCounter += 1;
  return `g_${Date.now().toString(36)}_${idCounter}`;
}

export function createGoal({
  id,
  title = "",
  // Seeded goals keep the i18n path they came from so they follow the interface
  // language. It is cleared the moment the user renames the goal, because from
  // then on the title is the user's own text and must never be overwritten.
  titleKey = null,
  category = "routine",
  type = "binary",
  targetDisplay = 1,
  unit,
  activeDays = [...WEEKDAYS],
  reminderTime = null,
  paused = false,
  order = 0,
  isPrimary = true,
} = {}) {
  const resolvedUnit = unit ?? suggestedUnitForCategory(category);
  return {
    id: id ?? newGoalId(),
    title,
    titleKey,
    category,
    type,
    unit: resolvedUnit,
    targetBase: type === "quantitative" ? toBase(targetDisplay, resolvedUnit) : 1,
    activeDays: [...activeDays],
    reminderTime,
    paused,
    order,
    isPrimary,
    // Local start date: a goal is never counted on days before it existed, so
    // adding a goal today cannot retroactively mark last week as incomplete.
    startDate: todayKey(),
    createdAt: new Date().toISOString(),
  };
}

export function validateGoal(goal) {
  const errors = {};
  const title = (goal.title ?? "").trim();
  if (!title) errors.title = "titleRequired";
  else if (title.length > TITLE_MAX_LENGTH) errors.title = "titleTooLong";

  if (!Array.isArray(goal.activeDays) || goal.activeDays.length === 0) {
    errors.activeDays = "daysRequired";
  }

  if (goal.type === "quantitative" && !(Number(goal.targetBase) > 0)) {
    errors.target = "targetPositive";
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

export function targetDisplay(goal) {
  return fromBase(goal.targetBase, goal.unit);
}

// A goal counts for a given day when it existed by then, is not paused, and
// that weekday is active.
export function isScheduledOn(goal, dateKey) {
  if (goal.paused) return false;
  if (goal.startDate && dateKey < goal.startDate) return false;
  return (goal.activeDays ?? []).includes(weekdayIdFromDateKey(dateKey));
}

export function scheduledGoals(goals, dateKey) {
  return goals.filter((goal) => isScheduledOn(goal, dateKey));
}

export function progressBase(log, goalId) {
  const value = log?.progress?.[goalId];
  if (value === true) return 1;
  if (value === false || value == null) return 0;
  return Number(value) || 0;
}

export function isGoalComplete(goal, log) {
  const value = progressBase(log, goal.id);
  if (goal.type === "binary") return value >= 1;
  return goal.targetBase > 0 && value >= goal.targetBase;
}

// 0 = untouched, 1 = complete, anything between = partial.
export function completionRatio(goal, log) {
  const value = progressBase(log, goal.id);
  if (goal.type === "binary") return value >= 1 ? 1 : 0;
  if (!(goal.targetBase > 0)) return 0;
  return Math.max(0, Math.min(1, value / goal.targetBase));
}

export function hasAnyProgress(goal, log) {
  return progressBase(log, goal.id) > 0;
}

// Weekly "active day": at least one scheduled goal completed or partially completed.
export function isActiveDay(goals, log, dateKey) {
  if (!log) return false;
  return scheduledGoals(goals, dateKey).some((goal) => hasAnyProgress(goal, log));
}

// Day completion ratio used by the weekly chart: average of each scheduled
// goal's ratio, so a half-done target reads as partial rather than zero.
export function dayCompletionRatio(goals, log, dateKey) {
  const scheduled = scheduledGoals(goals, dateKey);
  if (scheduled.length === 0) return null; // nothing scheduled -> no bar value
  if (!log) return 0;
  const total = scheduled.reduce((sum, goal) => sum + completionRatio(goal, log), 0);
  return total / scheduled.length;
}

export function scheduleSummaryIds(goal) {
  const days = goal.activeDays ?? [];
  if (days.length === WEEKDAYS.length) return "all";
  return days;
}

export function sortGoals(goals) {
  return [...goals].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt?.localeCompare(b.createdAt ?? "") || 0);
}

export function describeUnitBase(unitId) {
  return unitOf(unitId).base;
}
