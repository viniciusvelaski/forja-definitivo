import { test, assertEqual, assertTrue } from "./testRunner.js";
import { selectPlan } from "../src/js/lib/onboardingScoring.js";
import { nextHeatScore, dailyDelta, heatState, clampHeat, HEAT_START } from "../src/js/lib/heatEngine.js";
import { calcMealEntry, sumMealEntries, remainingCalories, validateNutritionGoals, validateGrams, validateCustomFood, hasNutritionGoals } from "../src/js/lib/nutrition.js";
import { weeklyRecommendationKey, weeklyCompletionRate, bestSupportedWindow, countActiveDays } from "../src/js/lib/weeklyRecommendation.js";
import { toBase, fromBase, convertDisplayValue, stepBase, suggestedUnitForCategory } from "../src/js/lib/units.js";
import { createGoal, validateGoal, isScheduledOn, completionRatio, isGoalComplete, isActiveDay, dayCompletionRatio, targetDisplay, weekdayIdFromDateKey } from "../src/js/lib/goals.js";
import { PLANS, planById, effectiveMonthly, savingsPercentVsMonthly, createSubscription, cancelSubscription, hasEntitlement, trialEndDate } from "../src/js/lib/subscription.js";
import { createRecoveryGoal, milestoneStatus, claimMilestone, validateRecoveryGoal, badgesFor } from "../src/js/lib/recoveryRules.js";
import { derivePreferences, planAnswersFrom, isComplete } from "../src/js/lib/onboardingQuestions.js";
import { t, setLocale, getLocale, fmtTime, fmtCurrency, DEFAULT_LOCALE } from "../src/js/i18n/index.js";
import { ptBR } from "../src/js/i18n/pt-BR.js";
import { enUS } from "../src/js/i18n/en-US.js";
import { defaultState, todayKey } from "../src/js/state/store.js";

// ============ Onboarding plan selection ============
test("selectPlan: clear winner, no tie-break", () => {
  const { selectedPlan, scores, tieBreakUsed } = selectPlan(["A", "A", "A", "B", "C"]);
  assertEqual(selectedPlan, "A");
  assertEqual(scores, { A: 3, B: 1, C: 1 });
  assertEqual(tieBreakUsed, false);
});

test("selectPlan: tie broken by question 25 when Q25 is a leader", () => {
  const { selectedPlan, tieBreakUsed } = selectPlan(["C", "A", "A", "B", "B"]);
  assertEqual(selectedPlan, "B");
  assertEqual(tieBreakUsed, true);
});

test("selectPlan: tie broken by question 25 even when Q25 is not a leader", () => {
  const { selectedPlan, tieBreakUsed } = selectPlan(["A", "A", "B", "B", "C"]);
  assertEqual(selectedPlan, "C");
  assertEqual(tieBreakUsed, true);
});

test("selectPlan: always deterministic across every 3^5 answer combination", () => {
  const letters = ["A", "B", "C"];
  let count = 0;
  for (const a of letters) for (const b of letters) for (const c of letters) for (const d of letters) for (const e of letters) {
    const first = selectPlan([a, b, c, d, e]).selectedPlan;
    const second = selectPlan([a, b, c, d, e]).selectedPlan;
    assertEqual(first, second);
    assertTrue(letters.includes(first), "plan must be A, B or C");
    count += 1;
  }
  assertEqual(count, 243);
});

test("selectPlan: rejects a wrong answer count", () => {
  let threw = false;
  try { selectPlan(["A", "B"]); } catch { threw = true; }
  assertEqual(threw, true);
});

test("derivePreferences: maps questions 17-20 to stable values", () => {
  const prefs = derivePreferences({ 17: 1, 18: 0, 19: 2, 20: 1 });
  assertEqual(prefs.reminderFrequency, "morning_evening");
  assertEqual(prefs.reminderTone, "direct");
  assertEqual(prefs.faithOptIn, false);
  assertEqual(prefs.preferredResourceCategory, "study");
});

test("derivePreferences: faith opt-in only when the user chose a faith answer", () => {
  assertEqual(derivePreferences({ 19: 0 }).faithOptIn, true);
  assertEqual(derivePreferences({ 19: 1 }).faithOptIn, true);
  assertEqual(derivePreferences({ 19: 2 }).faithOptIn, false);
  assertEqual(derivePreferences({}).faithOptIn, false);
});

test("planAnswersFrom / isComplete: only 21-25 feed the plan score", () => {
  const answers = {};
  for (let id = 1; id <= 20; id += 1) answers[id] = 0;
  assertEqual(isComplete(answers), false);
  answers[21] = "A"; answers[22] = "B"; answers[23] = "C"; answers[24] = "A"; answers[25] = "B";
  assertEqual(planAnswersFrom(answers), ["A", "B", "C", "A", "B"]);
  assertEqual(isComplete(answers), true);
});

// ============ Forge Heat ============
test("heatEngine: new users start at 30 (ember)", () => {
  assertEqual(HEAT_START, 30);
  assertEqual(heatState(30), "ember");
});

test("heatEngine: three of three goals gives the 10-point maximum", () => {
  assertEqual(dailyDelta(3, 3), 10);
  assertEqual(nextHeatScore(30, 3), 40);
});

test("heatEngine: one goal of three adds 3 points, no bonus", () => {
  assertEqual(dailyDelta(1, 3), 3);
  assertEqual(nextHeatScore(30, 1), 33);
});

test("heatEngine: bonus follows the day's own schedule, not a fixed three", () => {
  assertEqual(dailyDelta(2, 2), 7);
  assertEqual(dailyDelta(1, 1), 4);
});

test("heatEngine: more than three goals still caps the daily gain at 10", () => {
  assertEqual(dailyDelta(5, 5), 10);
  assertEqual(dailyDelta(4, 6), 9);
});

test("heatEngine: a day with nothing done costs 5 points, once", () => {
  assertEqual(dailyDelta(0, 3), -5);
  assertEqual(nextHeatScore(30, 0), 25);
});

test("heatEngine: a day with nothing scheduled is neutral", () => {
  assertEqual(dailyDelta(0, 0), 0);
  assertEqual(nextHeatScore(42, 0, 0), 42);
});

test("heatEngine: never goes below 0 or above 100", () => {
  assertEqual(nextHeatScore(2, 0), 0);
  assertEqual(nextHeatScore(95, 3), 100);
  assertEqual(clampHeat(-40), 0);
  assertEqual(clampHeat(180), 100);
});

test("heatEngine: state boundaries", () => {
  assertEqual(heatState(0), "cold-iron");
  assertEqual(heatState(24), "cold-iron");
  assertEqual(heatState(25), "ember");
  assertEqual(heatState(49), "ember");
  assertEqual(heatState(50), "hot-metal");
  assertEqual(heatState(74), "hot-metal");
  assertEqual(heatState(75), "forged");
  assertEqual(heatState(89), "forged");
  assertEqual(heatState(90), "blazing");
  assertEqual(heatState(100), "blazing");
});

// ============ Units ============
test("units: base conversion round-trips", () => {
  assertEqual(toBase(15, "minutes"), 900);
  assertEqual(fromBase(900, "minutes"), 15);
  assertEqual(toBase(2, "l"), 2000);
  assertEqual(fromBase(2000, "ml"), 2000);
});

test("units: converting inside the same measure keeps the real amount", () => {
  assertEqual(convertDisplayValue(60, "minutes", "hours"), { value: 1, converted: true });
  assertEqual(convertDisplayValue(1500, "ml", "l"), { value: 1.5, converted: true });
});

test("units: converting across measures keeps the typed number and flags it", () => {
  assertEqual(convertDisplayValue(30, "minutes", "reps"), { value: 30, converted: false });
});

test("units: step is expressed in base units for the +/- controls", () => {
  assertEqual(stepBase("minutes"), 300);
  assertEqual(stepBase("ml"), 50);
  assertEqual(suggestedUnitForCategory("water"), "ml");
});

// ============ Goals ============
test("goals: a quantitative goal stores its target in base units", () => {
  const goal = createGoal({ title: "Foco", type: "quantitative", unit: "minutes", targetDisplay: 25 });
  assertEqual(goal.targetBase, 1500);
  assertEqual(targetDisplay(goal), 25);
});

test("goals: validation covers title, days and target", () => {
  assertEqual(validateGoal({ title: "", activeDays: ["mon"], type: "binary" }).errors.title, "titleRequired");
  assertEqual(validateGoal({ title: "x".repeat(61), activeDays: ["mon"], type: "binary" }).errors.title, "titleTooLong");
  assertEqual(validateGoal({ title: "ok", activeDays: [], type: "binary" }).errors.activeDays, "daysRequired");
  assertEqual(validateGoal({ title: "ok", activeDays: ["mon"], type: "quantitative", targetBase: 0 }).errors.target, "targetPositive");
  assertEqual(validateGoal({ title: "ok", activeDays: ["mon"], type: "binary" }).ok, true);
});

// Fixtures pin startDate: createGoal() defaults it to the real current date, so
// leaving it out makes any assertion about a fixed past date fail once the
// calendar passes that date.
const FIXTURE_START = "2026-01-01";

test("goals: scheduling follows the selected weekdays", () => {
  const goal = { ...createGoal({ title: "Treino", activeDays: ["mon", "wed"] }), startDate: FIXTURE_START };
  // 2026-09-07 is a Monday, 2026-09-08 a Tuesday.
  assertEqual(weekdayIdFromDateKey("2026-09-07"), "mon");
  assertEqual(isScheduledOn(goal, "2026-09-07"), true);
  assertEqual(isScheduledOn(goal, "2026-09-08"), false);
});

test("goals: a goal is not scheduled on days before it existed", () => {
  const goal = { ...createGoal({ title: "Novo", activeDays: ["mon", "tue", "wed"] }), startDate: "2026-09-02" };
  assertEqual(isScheduledOn(goal, "2026-09-01"), false);
  assertEqual(isScheduledOn(goal, "2026-09-02"), true);
  // A goal saved before this rule existed has no startDate and still counts.
  const legacy = { ...goal, startDate: undefined };
  assertEqual(isScheduledOn(legacy, "2026-09-01"), true);
});

test("goals: a paused goal is never scheduled", () => {
  const goal = createGoal({ title: "Treino", activeDays: ["mon"], paused: true });
  assertEqual(isScheduledOn(goal, "2026-09-07"), false);
});

test("goals: partial progress is distinct from zero and from complete", () => {
  const goal = createGoal({ id: "g1", title: "Água", type: "quantitative", unit: "ml", targetDisplay: 2000 });
  const log = { progress: { g1: 500 }, timestamps: {} };
  assertEqual(completionRatio(goal, log), 0.25);
  assertEqual(isGoalComplete(goal, log), false);
  assertEqual(isGoalComplete(goal, { progress: { g1: 2000 } }), true);
});

test("goals: an active day needs at least one partially completed scheduled goal", () => {
  const goals = [{ ...createGoal({ id: "g1", title: "Água", type: "quantitative", unit: "ml", targetDisplay: 2000, activeDays: ["mon"] }), startDate: FIXTURE_START }];
  assertEqual(isActiveDay(goals, { progress: {} }, "2026-09-07"), false);
  assertEqual(isActiveDay(goals, { progress: { g1: 100 } }, "2026-09-07"), true);
  // Tuesday is not scheduled, so progress there does not make the day active.
  assertEqual(isActiveDay(goals, { progress: { g1: 100 } }, "2026-09-08"), false);
});

test("goals: a day with nothing scheduled has no completion ratio", () => {
  const goals = [{ ...createGoal({ id: "g1", title: "Treino", activeDays: ["mon"] }), startDate: FIXTURE_START }];
  assertEqual(dayCompletionRatio(goals, { progress: {} }, "2026-09-08"), null);
  assertEqual(dayCompletionRatio(goals, { progress: { g1: true } }, "2026-09-07"), 1);
});

// ============ Nutrition ============
test("nutrition: values scale from the per-100g reference", () => {
  const entry = calcMealEntry({ caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6 }, 150);
  assertEqual(entry.calories, 247.5);
  assertEqual(entry.protein, 46.5);
  assertEqual(entry.fat, 5.4);
});

test("nutrition: entries sum and remaining calories never go negative", () => {
  const totals = sumMealEntries([
    { calories: 100, protein: 10, carbs: 5, fat: 2 },
    { calories: 200, protein: 5, carbs: 30, fat: 8 },
  ]);
  assertEqual(totals, { calories: 300, protein: 15, carbs: 35, fat: 10 });
  assertEqual(remainingCalories(2000, 2500), 0);
  assertEqual(remainingCalories(2000, 1200), 800);
});

test("nutrition: with no user target there is no remaining value to show", () => {
  assertEqual(remainingCalories(null, 500), null);
  assertEqual(hasNutritionGoals(null), false);
  assertEqual(hasNutritionGoals({ calories: 2200 }), true);
});

test("nutrition: goal validation rejects empty, negative and absurd values", () => {
  assertEqual(validateNutritionGoals({ calories: "", protein: 1, carbs: 1, fat: 1 }).errors.calories, "required");
  assertEqual(validateNutritionGoals({ calories: -5, protein: 1, carbs: 1, fat: 1 }).errors.calories, "positive");
  assertEqual(validateNutritionGoals({ calories: 99999, protein: 1, carbs: 1, fat: 1 }).errors.calories, "tooLarge");
  assertEqual(validateNutritionGoals({ calories: 2200, protein: 140, carbs: 250, fat: 70 }).ok, true);
});

test("nutrition: grams and custom food validation", () => {
  assertEqual(validateGrams(0), "gramsRange");
  assertEqual(validateGrams(6000), "gramsRange");
  assertEqual(validateGrams(150), null);
  const bad = validateCustomFood({ name: "", grams: 0, caloriesPer100g: "" });
  assertEqual(bad.ok, false);
  assertEqual(bad.errors.name, "nameRequired");
  const good = validateCustomFood({ name: "Pão", grams: 60, caloriesPer100g: 250, proteinPer100g: 8, carbsPer100g: 40, fatPer100g: 3 });
  assertEqual(good.ok, true);
});

// ============ Weekly review ============
test("weeklyRecommendation: thresholds map to keys, not sentences", () => {
  assertEqual(weeklyRecommendationKey(0.8), "high");
  assertEqual(weeklyRecommendationKey(0.79), "mid");
  assertEqual(weeklyRecommendationKey(0.5), "mid");
  assertEqual(weeklyRecommendationKey(0.49), "low");
  assertEqual(weeklyRecommendationKey(0), "low");
});

test("weeklyCompletionRate: days with nothing scheduled are excluded", () => {
  assertEqual(weeklyCompletionRate([1, 0.5, null, null]), 0.75);
  assertEqual(weeklyCompletionRate([null, null]), 0);
});

test("countActiveDays / bestSupportedWindow", () => {
  assertEqual(countActiveDays([true, false, true, true]), 3);
  assertEqual(bestSupportedWindow(["2026-01-01T07:00:00", "2026-01-01T07:30:00", "2026-01-01T20:00:00"]), "morning");
  assertEqual(bestSupportedWindow([]), null);
});

// ============ Subscription ============
test("subscription: the three real durations are offered", () => {
  assertEqual(PLANS.map((plan) => plan.id), ["monthly", "semiannual", "annual"]);
  assertEqual(planById("semiannual").totalPrice, 80);
  assertEqual(planById("annual").totalPrice, 100);
});

test("subscription: monthly equivalents and honest savings", () => {
  assertEqual(Math.round(effectiveMonthly(planById("semiannual")) * 100) / 100, 13.33);
  assertEqual(Math.round(effectiveMonthly(planById("annual")) * 100) / 100, 8.33);
  assertEqual(Math.round(savingsPercentVsMonthly(planById("semiannual")) * 1000) / 10, 46.7);
  assertEqual(Math.round(savingsPercentVsMonthly(planById("annual")) * 1000) / 10, 66.7);
  assertEqual(savingsPercentVsMonthly(planById("monthly")), 0);
});

test("subscription: a trial only exists after it is created, and grants access", () => {
  const now = new Date("2026-09-02T10:00:00");
  const subscription = createSubscription("annual", { now });
  assertEqual(subscription.status, "trial");
  assertEqual(new Date(subscription.trialEnd).getDate(), trialEndDate(now).getDate());
  assertEqual(hasEntitlement(subscription, now), true);
  assertEqual(hasEntitlement({ status: "none" }, now), false);
});

test("subscription: canceling keeps access until the paid period ends", () => {
  const now = new Date("2026-09-02T10:00:00");
  const active = { ...createSubscription("monthly", { withTrial: false, now }), status: "active" };
  const canceled = cancelSubscription(active, { now });
  assertEqual(canceled.status, "canceled");
  assertEqual(hasEntitlement(canceled, now), true);
  assertEqual(hasEntitlement(canceled, new Date("2026-11-02T10:00:00")), false);
});

// ============ Recovery ============
test("recovery: milestone status counts from the chosen interval", () => {
  const goal = createRecoveryGoal({ positiveGoal: "Ler 10 páginas", milestoneScheduleId: "7d", now: new Date("2026-09-01T10:00:00") });
  const status = milestoneStatus(goal, new Date("2026-09-05T10:00:00"));
  assertEqual(status.elapsed, 4);
  assertEqual(status.nextMilestoneDay, 7);
  assertEqual(status.daysToNext, 3);
  assertEqual(status.ready, false);
});

test("recovery: claiming a milestone unlocks the cumulative badges", () => {
  const goal = createRecoveryGoal({ positiveGoal: "Ler", milestoneScheduleId: "7d", now: new Date("2026-09-01T10:00:00") });
  const claimed = claimMilestone(goal, new Date("2026-09-09T10:00:00"));
  assertEqual(claimed.milestonesReached.length, 1);
  assertEqual(claimed.badges, ["3d", "7d"]);
  assertEqual(badgesFor(30), ["3d", "7d", "14d", "30d"]);
});

test("recovery: a milestone cannot be claimed before it is reached", () => {
  const goal = createRecoveryGoal({ positiveGoal: "Ler", milestoneScheduleId: "7d", now: new Date("2026-09-01T10:00:00") });
  const same = claimMilestone(goal, new Date("2026-09-03T10:00:00"));
  assertEqual(same.milestonesReached.length, 0);
});

test("recovery: validation requires the positive goal and a custom label", () => {
  assertEqual(validateRecoveryGoal({ positiveGoal: "", category: "screen" }).errors.positiveGoal, "goalRequired");
  assertEqual(validateRecoveryGoal({ positiveGoal: "Ler", category: "custom", customLabel: "" }).errors.customLabel, "labelRequired");
  assertEqual(validateRecoveryGoal({ positiveGoal: "Ler", category: "custom", customLabel: "Rolagem" }).ok, true);
});

// ============ Localization ============
function collectKeys(node, prefix = "", out = []) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) collectKeys(value, path, out);
    else out.push(path);
  }
  return out;
}

test("i18n: pt-BR and en-US expose exactly the same keys", () => {
  const ptKeys = collectKeys(ptBR).sort();
  const enKeys = collectKeys(enUS).sort();
  const missingInEn = ptKeys.filter((key) => !enKeys.includes(key));
  const missingInPt = enKeys.filter((key) => !ptKeys.includes(key));
  assertEqual(missingInEn, []);
  assertEqual(missingInPt, []);
});

test("i18n: default locale is pt-BR and translation follows the active locale", () => {
  assertEqual(DEFAULT_LOCALE, "pt-BR");
  setLocale("pt-BR");
  assertEqual(t("nav.meals"), "Refeições");
  setLocale("en-US");
  assertEqual(t("nav.meals"), "Meals");
  setLocale("pt-BR");
});

test("i18n: a missing key falls back to the key itself, never to undefined", () => {
  assertEqual(t("this.key.does.not.exist"), "this.key.does.not.exist");
  assertTrue(t("nav.today") !== undefined, "known key must resolve");
});

test("i18n: interpolation fills named variables", () => {
  setLocale("pt-BR");
  assertEqual(t("onboarding.progress", { current: 3, total: 25 }), "3 de 25");
  setLocale("en-US");
  assertEqual(t("onboarding.progress", { current: 3, total: 25 }), "3 of 25");
  setLocale("pt-BR");
});

test("i18n: pt-BR uses 24-hour time and BRL currency", () => {
  setLocale("pt-BR");
  assertEqual(fmtTime("21:30"), "21:30");
  assertTrue(fmtCurrency(25).includes("25"), "currency shows the amount");
  assertTrue(fmtCurrency(25).includes("R$"), "currency shows R$");
  setLocale("en-US");
  assertTrue(fmtTime("21:30").toLowerCase().includes("pm"), "en-US uses 12-hour time");
  setLocale("pt-BR");
});

test("i18n: no visible string mixes the two languages in the shared keys", () => {
  setLocale("pt-BR");
  const mixed = ["gordura/fat", "protein/proteína", "Meals/Refeições"];
  const flat = JSON.stringify(ptBR).toLowerCase();
  for (const term of mixed) assertTrue(!flat.includes(term.toLowerCase()), `dictionary must not contain "${term}"`);
});

// ============ State shape and persistence ============
test("state: default state starts unsubscribed, un-onboarded and with no invented targets", () => {
  const state = defaultState();
  assertEqual(state.version, 2);
  assertEqual(state.subscription.status, "none");
  assertEqual(state.onboarding.completed, false);
  assertEqual(state.nutritionGoals, null);
  assertEqual(state.goals, []);
  assertEqual(state.recoveryGoals, []);
  assertEqual(state.heatHistory[0].score, HEAT_START);
});

test("state: todayKey uses the local calendar date, not UTC", () => {
  // 23:30 local on the 2nd must stay the 2nd even where UTC is already the 3rd.
  const lateEvening = new Date(2026, 8, 2, 23, 30, 0);
  assertEqual(todayKey(lateEvening), "2026-09-02");
  const earlyMorning = new Date(2026, 8, 2, 0, 15, 0);
  assertEqual(todayKey(earlyMorning), "2026-09-02");
});

test("persistence: state survives a JSON round-trip through localStorage", () => {
  const key = "forja_test_roundtrip";
  const original = defaultState();
  original.goals = [createGoal({ id: "g1", title: "Beber água", type: "quantitative", unit: "ml", targetDisplay: 2000 })];
  original.dailyLogs = { "2026-09-02": { progress: { g1: 750 }, timestamps: {} } };
  original.nutritionGoals = { calories: 2200, protein: 140, carbs: 250, fat: 70 };

  localStorage.setItem(key, JSON.stringify(original));
  const restored = JSON.parse(localStorage.getItem(key));
  localStorage.removeItem(key);

  assertEqual(restored.goals[0].targetBase, 2000);
  assertEqual(restored.goals[0].title, "Beber água");
  assertEqual(restored.dailyLogs["2026-09-02"].progress.g1, 750);
  assertEqual(restored.nutritionGoals.calories, 2200);
  assertEqual(completionRatio(restored.goals[0], restored.dailyLogs["2026-09-02"]), 0.375);
});
