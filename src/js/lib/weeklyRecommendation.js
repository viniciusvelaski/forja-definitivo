// Weekly review rules. These return KEYS, never sentences — the localization
// layer owns the copy so the same rule works in pt-BR and en-US.

export function weeklyRecommendationKey(completionRate) {
  if (completionRate >= 0.8) return "high";
  if (completionRate >= 0.5) return "mid";
  return "low";
}

// dayRatios: array of numbers 0..1, or null for days with nothing scheduled.
// Days with nothing scheduled are excluded so a planned rest day never drags
// the week down.
export function weeklyCompletionRate(dayRatios) {
  const scored = dayRatios.filter((ratio) => ratio !== null && ratio !== undefined);
  if (scored.length === 0) return 0;
  const total = scored.reduce((sum, ratio) => sum + ratio, 0);
  return total / scored.length;
}

export function countActiveDays(activeFlags) {
  return activeFlags.filter(Boolean).length;
}

export function bestSupportedWindow(completedTimestamps) {
  const buckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const ts of completedTimestamps) {
    const hour = new Date(ts).getHours();
    if (hour >= 5 && hour < 12) buckets.morning += 1;
    else if (hour >= 12 && hour < 18) buckets.afternoon += 1;
    else if (hour >= 18 && hour < 23) buckets.evening += 1;
    else buckets.night += 1;
  }
  let best = null;
  let bestCount = 0;
  for (const [window, count] of Object.entries(buckets)) {
    if (count > bestCount) {
      best = window;
      bestCount = count;
    }
  }
  return best;
}
