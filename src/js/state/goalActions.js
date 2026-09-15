// Every goal mutation in the app funnels through here, so Today, the goal
// editor, Progress, and Forge Heat can never disagree about state.
import { getState, setState, todayKey, emptyDayLog, logEvent } from "./store.js";
import { createGoal, isGoalComplete, progressBase, sortGoals, scheduledGoals } from "../lib/goals.js";
import { scoredGoalsFor } from "../lib/dayEngine.js";
import { PLAN_TEMPLATES, PARTIAL_GOAL_TEMPLATES } from "../lib/mockData.js";
import { t } from "../i18n/index.js";

export function seedGoalsFromPlan(planCode) {
  const template = PLAN_TEMPLATES[planCode] ?? PLAN_TEMPLATES.A;
  const planGoals = template.goals.map((spec, index) =>
    createGoal({
      title: t(`plans.${planCode}.goals`)[spec.titleIndex] ?? "",
      titleKey: `plans.${planCode}.goals.${spec.titleIndex}`,
      category: spec.category,
      type: spec.type,
      unit: spec.unit,
      targetDisplay: spec.targetDisplay ?? 1,
      activeDays: spec.activeDays,
      reminderTime: spec.reminderTime,
      order: index,
      isPrimary: true,
    })
  );

  const partialGoals = PARTIAL_GOAL_TEMPLATES.map((spec, index) =>
    createGoal({
      title: t(spec.titleKey),
      titleKey: spec.titleKey,
      category: spec.category,
      type: spec.type,
      unit: spec.unit,
      targetDisplay: spec.targetDisplay,
      activeDays: spec.activeDays,
      order: planGoals.length + index,
      isPrimary: false,
    })
  );

  return [...planGoals, ...partialGoals];
}

export function addGoal(draft) {
  const goal = createGoal({ ...draft, order: getState().goals.length });
  setState((state) => ({ ...state, goals: [...state.goals, goal] }));
  logEvent("goal_created", { id: goal.id, category: goal.category });
  return goal;
}

export function updateGoal(id, patch) {
  // Renaming a seeded goal makes the title the user's own text, so it stops
  // following the interface language.
  const resolved = patch.title !== undefined ? { ...patch, titleKey: null } : patch;
  setState((state) => ({
    ...state,
    goals: state.goals.map((goal) => (goal.id === id ? { ...goal, ...resolved } : goal)),
  }));
  logEvent("goal_updated", { id });
}

export function deleteGoal(id) {
  setState((state) => ({ ...state, goals: state.goals.filter((goal) => goal.id !== id) }));
  logEvent("goal_deleted", { id });
}

export function setGoalPaused(id, paused) {
  updateGoal(id, { paused });
  logEvent(paused ? "goal_paused" : "goal_resumed", { id });
}

function writeProgress(goalId, value, { markTimestamp }) {
  const key = todayKey();
  setState((state) => {
    const log = state.dailyLogs[key] ?? emptyDayLog();
    const timestamps = { ...log.timestamps };
    if (markTimestamp) timestamps[goalId] = new Date().toISOString();
    else delete timestamps[goalId];
    return {
      ...state,
      dailyLogs: {
        ...state.dailyLogs,
        [key]: { ...log, progress: { ...log.progress, [goalId]: value }, timestamps },
      },
    };
  });
}

// Returns { completed, dayComplete } so the caller can drive the right animation.
export function toggleGoalDone(goalId) {
  const state = getState();
  const key = todayKey();
  const log = state.dailyLogs[key] ?? emptyDayLog();
  const wasDone = progressBase(log, goalId) >= 1;
  const nowDone = !wasDone;

  writeProgress(goalId, nowDone, { markTimestamp: nowDone });
  if (nowDone) logEvent("daily_goal_completed", { goalId });

  return { completed: nowDone, dayComplete: nowDone && isDayComplete() };
}

export function setGoalProgress(goalId, baseValue) {
  const state = getState();
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) return { completed: false, dayComplete: false };

  const clamped = Math.max(0, Math.min(goal.targetBase, baseValue));
  const key = todayKey();
  const wasComplete = isGoalComplete(goal, state.dailyLogs[key]);
  writeProgress(goalId, clamped, { markTimestamp: clamped >= goal.targetBase });

  const nowComplete = clamped >= goal.targetBase;
  if (nowComplete && !wasComplete) logEvent("daily_goal_completed", { goalId });

  return {
    completed: nowComplete && !wasComplete,
    dayComplete: nowComplete && !wasComplete && isDayComplete(),
  };
}

export function bumpGoalProgress(goalId, deltaBase) {
  const state = getState();
  const log = state.dailyLogs[todayKey()] ?? emptyDayLog();
  return setGoalProgress(goalId, progressBase(log, goalId) + deltaBase);
}

// The day is complete when every goal scheduled for today (including secondary
// ones) is done — that is the moment worth a forge strike.
export function isDayComplete() {
  const state = getState();
  const key = todayKey();
  const log = state.dailyLogs[key] ?? emptyDayLog();
  const scheduled = scheduledGoals(state.goals, key);
  return scheduled.length > 0 && scheduled.every((goal) => isGoalComplete(goal, log));
}

export function isScoredDayComplete() {
  const state = getState();
  const key = todayKey();
  const log = state.dailyLogs[key] ?? emptyDayLog();
  const scored = scoredGoalsFor(state.goals, key);
  return scored.length > 0 && scored.every((goal) => isGoalComplete(goal, log));
}

export function orderedGoals(goals) {
  return sortGoals(goals);
}
