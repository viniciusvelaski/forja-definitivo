// Unit system for quantitative goals.
// Every goal stores its target and daily progress in a CANONICAL BASE value
// (seconds for time, items for count, millilitres for volume) and renders it in
// the unit the user picked. That keeps conversions internally consistent and
// stops a unit change from silently reinterpreting a stored number.

export const UNITS = {
  seconds: { id: "seconds", base: "time", factor: 1, step: 30, decimals: 0 },
  minutes: { id: "minutes", base: "time", factor: 60, step: 5, decimals: 0 },
  // Two decimals so a conversion like 15 min -> 0.25 h stays exact.
  hours: { id: "hours", base: "time", factor: 3600, step: 0.5, decimals: 2 },
  days: { id: "days", base: "time", factor: 86400, step: 1, decimals: 0 },
  reps: { id: "reps", base: "count", factor: 1, step: 1, decimals: 0 },
  count: { id: "count", base: "count", factor: 1, step: 1, decimals: 0 },
  ml: { id: "ml", base: "volume", factor: 1, step: 50, decimals: 0 },
  l: { id: "l", base: "volume", factor: 1000, step: 0.25, decimals: 2 },
};

export const UNIT_IDS = Object.keys(UNITS);

export function unitOf(unitId) {
  return UNITS[unitId] ?? UNITS.count;
}

export function toBase(value, unitId) {
  return Number(value) * unitOf(unitId).factor;
}

export function fromBase(baseValue, unitId) {
  const unit = unitOf(unitId);
  const raw = Number(baseValue) / unit.factor;
  const factor = 10 ** unit.decimals;
  return Math.round(raw * factor) / factor;
}

// Step expressed in base units, so +/- controls move by one sensible increment.
export function stepBase(unitId) {
  const unit = unitOf(unitId);
  return unit.step * unit.factor;
}

export function stepDisplay(unitId) {
  return unitOf(unitId).step;
}

// Converts a displayed value between units.
// Same measurement base -> real conversion (60 min => 1 h).
// Different base -> the number is kept exactly as typed and `converted` is
// false, so the UI can tell the user instead of corrupting the value.
export function convertDisplayValue(value, fromUnitId, toUnitId) {
  const from = unitOf(fromUnitId);
  const to = unitOf(toUnitId);
  if (from.base !== to.base) {
    return { value: Number(value), converted: false };
  }
  const factor = 10 ** to.decimals;
  return { value: Math.round((toBase(value, fromUnitId) / to.factor) * factor) / factor, converted: true };
}

export function suggestedUnitForCategory(category) {
  switch (category) {
    case "water":
      return "ml";
    case "study":
    case "meditation":
      return "minutes";
    case "gym":
      return "minutes";
    case "sleep":
      return "hours";
    default:
      return "count";
  }
}

export function clampBase(valueBase, targetBase) {
  return Math.max(0, Math.min(targetBase, valueBase));
}
