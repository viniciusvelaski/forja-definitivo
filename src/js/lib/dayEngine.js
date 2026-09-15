// Bridges the pure heat rules to daily goal state: day rollover, live score,
// and the weekly series used by Progress.
import { nextHeatScore, dailyDelta, clampHeat, HEAT_START } from "./heatEngine.js";
import { scheduledGoals, isGoalComplete, dayCompletionRatio, isActiveDay, hasAnyProgress } from "./goals.js";
import { emptyDayLog } from "../state/store.js";
import { todayKey, nextDateKey, previousDateKeys } from "./dateKey.js";

export { nextDateKey, previousDateKeys };

// Only goals that score Forge Heat.
export function scoredGoalsFor(goals, dateKey) {
  return scheduledGoals(goals.filter((goal) => goal.isPrimary !== false), dateKey);
}

export function completedScoredCount(goals, log, dateKey) {
  return scoredGoalsFor(goals, dateKey).filter((goal) => isGoalComplete(goal, log)).length;
}

// Each heatHistory entry is the BASELINE score for its date (before that day's
// goals are applied). Rolling forward finalizes every day between the last known
// baseline and today, so gaps and missed check-ins are deterministic and history
// is never deleted.
export function rolloverIfNeeded(state) {
  const key = todayKey();
  const history = [...state.heatHistory];
  const lastDate = history[history.length - 1]?.date;
  const logs = { ...state.dailyLogs };

  if (lastDate === key) {
    if (!logs[key]) {
      return { ...state, dailyLogs: { ...logs, [key]: emptyDayLog() } };
    }
    return state;
  }

  let baseline = history[history.length - 1]?.score ?? HEAT_START;
  let cursor = lastDate ?? key;

  while (cursor < key) {
    const log = logs[cursor] ?? emptyDayLog();
    const scheduled = scoredGoalsFor(state.goals, cursor);
    const completed = scheduled.filter((goal) => isGoalComplete(goal, log)).length;
    baseline = clampHeat(baseline + dailyDelta(completed, scheduled.length));
    cursor = nextDateKey(cursor);
    history.push({ date: cursor, score: baseline });
  }

  if (!logs[key]) logs[key] = emptyDayLog();
  return { ...state, dailyLogs: logs, heatHistory: history };
}

export function baselineScore(state) {
  return state.heatHistory[state.heatHistory.length - 1]?.score ?? HEAT_START;
}

// Live score = today's baseline plus today's in-progress gain.
// The missed-day penalty is applied only when a day actually ends (rollover);
// showing it on an untouched fresh day would punish before the user can act.
export function displayedHeatScore(state) {
  const key = todayKey();
  const base = baselineScore(state);
  const log = state.dailyLogs[key];
  if (!log || !state.goals.length) return base;
  const scheduled = scoredGoalsFor(state.goals, key);
  const completed = scheduled.filter((goal) => isGoalComplete(goal, log)).length;
  if (completed === 0) return base;
  return nextHeatScore(base, completed, scheduled.length);
}

export function weeklySeries(state, endDate = new Date()) {
  const keys = previousDateKeys(7, endDate);
  const today = todayKey(endDate);
  return keys.map((dateKey) => {
    const log = state.dailyLogs[dateKey];
    const scheduled = scheduledGoals(state.goals, dateKey);
    return {
      dateKey,
      date: new Date(`${dateKey}T00:00:00`),
      isToday: dateKey === today,
      scheduledCount: scheduled.length,
      ratio: dayCompletionRatio(state.goals, log, dateKey),
      active: isActiveDay(state.goals, log, dateKey),
      hasLog: Boolean(log),
    };
  });
}

export function weeklyTimestamps(state, endDate = new Date()) {
  const stamps = [];
  for (const dateKey of previousDateKeys(7, endDate)) {
    const log = state.dailyLogs[dateKey];
    if (log?.timestamps) stamps.push(...Object.values(log.timestamps).filter(Boolean));
  }
  return stamps;
}

export function goalWeeklyCompletion(state, goal, endDate = new Date()) {
  const keys = previousDateKeys(7, endDate).filter((dateKey) => scheduledGoals([goal], dateKey).length > 0);
  if (keys.length === 0) return null;
  const done = keys.filter((dateKey) => isGoalComplete(goal, state.dailyLogs[dateKey])).length;
  return done / keys.length;
}

export { hasAnyProgress };
