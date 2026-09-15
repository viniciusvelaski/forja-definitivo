// Forge Heat scoring: 0-100, deterministic, recoverable (never resets history).
export const HEAT_MIN = 0;
export const HEAT_MAX = 100;
export const HEAT_START = 30;
export const POINTS_PER_GOAL = 3;
export const ALL_GOALS_BONUS = 1;
export const MISSED_DAY_PENALTY = 5;
export const MAX_DAILY_GAIN = 10;
export const SCORED_GOAL_CAP = 3;

export function heatState(score) {
  if (score < 25) return "cold-iron";
  if (score < 50) return "ember";
  if (score < 75) return "hot-metal";
  if (score < 90) return "forged";
  return "blazing";
}

export const HEAT_STATES = ["cold-iron", "ember", "hot-metal", "forged", "blazing"];

// Points a single day contributes.
// - Up to three goals are scored at 3 points each (the model stays 0-10/day even
//   when the user adds more goals than the three the plan starts with).
// - The +1 bonus lands when every goal scheduled for that day is complete.
// - A day with goals scheduled but nothing done costs 5 points, once.
// - A day with nothing scheduled (e.g. a rest day in the goal's active days)
//   is neutral: it neither rewards nor punishes.
export function dailyDelta(completedCount, scheduledCount = SCORED_GOAL_CAP) {
  if (completedCount < 0) throw new Error("completedCount cannot be negative");
  if (scheduledCount <= 0) return 0;
  if (completedCount === 0) return -MISSED_DAY_PENALTY;
  const scored = Math.min(SCORED_GOAL_CAP, completedCount);
  let delta = scored * POINTS_PER_GOAL;
  if (completedCount >= scheduledCount) delta += ALL_GOALS_BONUS;
  return Math.min(MAX_DAILY_GAIN, delta);
}

export function clampHeat(score) {
  return Math.min(HEAT_MAX, Math.max(HEAT_MIN, score));
}

export function nextHeatScore(currentScore, completedCount, scheduledCount = SCORED_GOAL_CAP) {
  return clampHeat(currentScore + dailyDelta(completedCount, scheduledCount));
}
