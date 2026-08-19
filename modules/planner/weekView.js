import { BASE_DATE, DAY_NAMES } from "./domain.js";

export function addDays(date, count) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getWeekStart(weekOffset = 0) {
  return addDays(BASE_DATE, weekOffset * 7);
}

export function getWeekDates(weekOffset = 0) {
  const start = getWeekStart(weekOffset);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function getWeekDays(weekOffset = 0) {
  return getWeekDates(weekOffset).map((date, index) => ({
    dayName: DAY_NAMES[index],
    date,
    dateKey: toDateKey(date),
    isWeekend: index < 2,
  }));
}

export function formatWeekRange(weekOffset = 0) {
  const dates = getWeekDates(weekOffset);
  return `${toDateKey(dates[0])} — ${toDateKey(dates[6])}`;
}
