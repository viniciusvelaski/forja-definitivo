// Nutrition math and validation.
// Targets are always user-defined: this module never invents a personalized
// recommendation, and `null` targets mean "the user has not set goals yet".

export const GRAMS_MIN = 1;
export const GRAMS_MAX = 5000;
export const NUTRITION_LIMITS = {
  calories: { min: 1, max: 20000 },
  protein: { min: 0, max: 2000 },
  carbs: { min: 0, max: 2000 },
  fat: { min: 0, max: 2000 },
  per100g: { min: 0, max: 1000 },
  caloriesPer100g: { min: 0, max: 1000 },
};

export function nutrientConsumed(nutrientPer100g, enteredGrams) {
  if (enteredGrams < 0) throw new Error("enteredGrams cannot be negative");
  return (Number(nutrientPer100g) * Number(enteredGrams)) / 100;
}

export function calcMealEntry(foodItem, grams) {
  return {
    calories: nutrientConsumed(foodItem.caloriesPer100g ?? 0, grams),
    protein: nutrientConsumed(foodItem.proteinPer100g ?? 0, grams),
    carbs: nutrientConsumed(foodItem.carbsPer100g ?? 0, grams),
    fat: nutrientConsumed(foodItem.fatPer100g ?? 0, grams),
  };
}

export function sumMealEntries(entries) {
  return entries.reduce(
    (totals, entry) => ({
      calories: totals.calories + (entry.calories ?? 0),
      protein: totals.protein + (entry.protein ?? 0),
      carbs: totals.carbs + (entry.carbs ?? 0),
      fat: totals.fat + (entry.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function remainingCalories(dailyTarget, consumedCalories) {
  if (dailyTarget == null) return null;
  return Math.max(0, dailyTarget - consumedCalories);
}

export function macroRatio(consumed, target) {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(1, consumed / target));
}

export function hasNutritionGoals(goals) {
  return Boolean(goals && goals.calories > 0);
}

function checkRange(value, { min, max }, { allowEmpty = false } = {}) {
  if (value === "" || value === null || value === undefined) return allowEmpty ? null : "required";
  const num = Number(value);
  if (Number.isNaN(num) || num < min) return "positive";
  if (num > max) return "tooLarge";
  return null;
}

export function validateNutritionGoals(goals) {
  const errors = {};
  const calories = checkRange(goals.calories, NUTRITION_LIMITS.calories);
  if (calories) errors.calories = calories;
  for (const macro of ["protein", "carbs", "fat"]) {
    const err = checkRange(goals[macro], NUTRITION_LIMITS[macro]);
    if (err) errors[macro] = err;
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

export function validateGrams(grams) {
  const num = Number(grams);
  if (grams === "" || grams === null || Number.isNaN(num)) return "required";
  if (num < GRAMS_MIN || num > GRAMS_MAX) return "gramsRange";
  return null;
}

export function validateCustomFood(food) {
  const errors = {};
  if (!String(food.name ?? "").trim()) errors.name = "nameRequired";
  const gramsError = validateGrams(food.grams);
  if (gramsError) errors.grams = gramsError;
  const calError = checkRange(food.caloriesPer100g, NUTRITION_LIMITS.caloriesPer100g);
  if (calError) errors.caloriesPer100g = calError;
  for (const macro of ["proteinPer100g", "carbsPer100g", "fatPer100g"]) {
    const err = checkRange(food[macro], NUTRITION_LIMITS.per100g, { allowEmpty: true });
    if (err) errors[macro] = err;
  }
  return { ok: Object.keys(errors).length === 0, errors };
}
