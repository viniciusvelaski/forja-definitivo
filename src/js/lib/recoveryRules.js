// Recovery Support rules: multiple private goals, milestone schedule, badges.
// Nothing here publishes or shares anything — sharing is always an explicit
// user action handled in the screen layer.

export const RECOVERY_CATEGORY_IDS = ["screen", "lateNights", "spending", "procrastination", "custom"];

export const MILESTONE_OPTIONS = [
  { id: "3d", days: 3 },
  { id: "7d", days: 7 },
  { id: "14d", days: 14 },
  { id: "30d", days: 30 },
];

// Badges unlock at cumulative day thresholds, independent of the chosen interval.
export const BADGE_THRESHOLDS = [
  { id: "3d", days: 3 },
  { id: "7d", days: 7 },
  { id: "14d", days: 14 },
  { id: "30d", days: 30 },
];

let counter = 0;
export function newRecoveryId() {
  counter += 1;
  return `r_${Date.now().toString(36)}_${counter}`;
}

export function createRecoveryGoal({
  category = "screen",
  customLabel = "",
  positiveGoal = "",
  milestoneScheduleId = "7d",
  now = new Date(),
} = {}) {
  return {
    id: newRecoveryId(),
    category,
    customLabel: customLabel.trim(),
    positiveGoal: positiveGoal.trim(),
    milestoneScheduleId,
    startDate: now.toISOString(),
    milestonesReached: [],
    badges: [],
    archived: false,
  };
}

export function validateRecoveryGoal(goal) {
  const errors = {};
  if (!String(goal.positiveGoal ?? "").trim()) errors.positiveGoal = "goalRequired";
  if (goal.category === "custom" && !String(goal.customLabel ?? "").trim()) errors.customLabel = "labelRequired";
  return { ok: Object.keys(errors).length === 0, errors };
}

export function intervalDaysFor(goal) {
  return MILESTONE_OPTIONS.find((option) => option.id === goal.milestoneScheduleId)?.days ?? 7;
}

export function elapsedDays(goal, now = new Date()) {
  const start = new Date(goal.startDate);
  const diff = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

export function milestoneStatus(goal, now = new Date()) {
  const interval = intervalDaysFor(goal);
  const elapsed = elapsedDays(goal, now);
  const reachedCount = goal.milestonesReached?.length ?? 0;
  const nextMilestoneDay = (reachedCount + 1) * interval;
  const daysToNext = Math.max(0, nextMilestoneDay - elapsed);
  return {
    elapsed,
    interval,
    reachedCount,
    nextMilestoneDay,
    daysToNext,
    ready: elapsed >= nextMilestoneDay,
  };
}

export function badgesFor(elapsed) {
  return BADGE_THRESHOLDS.filter((badge) => elapsed >= badge.days).map((badge) => badge.id);
}

export function claimMilestone(goal, now = new Date()) {
  const status = milestoneStatus(goal, now);
  if (!status.ready) return goal;
  const badges = Array.from(new Set([...(goal.badges ?? []), ...badgesFor(status.elapsed)]));
  return {
    ...goal,
    milestonesReached: [...(goal.milestonesReached ?? []), { index: status.reachedCount + 1, day: status.nextMilestoneDay, at: now.toISOString() }],
    badges,
  };
}

export function activeGoals(goals) {
  return (goals ?? []).filter((goal) => !goal.archived);
}

export function archivedGoals(goals) {
  return (goals ?? []).filter((goal) => goal.archived);
}
