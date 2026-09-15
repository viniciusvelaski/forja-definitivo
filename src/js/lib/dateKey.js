// Local calendar date keys ("YYYY-MM-DD").
// Never derived from toISOString(): that shifts to UTC and would file a day's
// data under the wrong date for any negative UTC offset, including Brazil.

export function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function nextDateKey(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return todayKey(date);
}

export function previousDateKeys(count, endDate = new Date()) {
  const keys = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const day = new Date(endDate);
    day.setDate(endDate.getDate() - i);
    keys.push(todayKey(day));
  }
  return keys;
}
