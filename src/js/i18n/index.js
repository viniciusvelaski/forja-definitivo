// Centralized localization layer. Every visible string in the app comes from
// here — no hardcoded copy in components or screens.
import { ptBR } from "./pt-BR.js";
import { enUS } from "./en-US.js";

export const LOCALES = ["pt-BR", "en-US"];
export const DEFAULT_LOCALE = "pt-BR";

const DICTS = { "pt-BR": ptBR, "en-US": enUS };

let currentLocale = DEFAULT_LOCALE;
const localeListeners = new Set();

export function getLocale() {
  return currentLocale;
}

export function setLocale(locale) {
  currentLocale = LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  document.documentElement.lang = currentLocale;
  for (const fn of localeListeners) fn(currentLocale);
}

export function onLocaleChange(fn) {
  localeListeners.add(fn);
  return () => localeListeners.delete(fn);
}

// Picks the device locale only when it is one we actually ship; otherwise pt-BR.
export function detectLocale() {
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const candidate of candidates ?? []) {
    if (!candidate) continue;
    const exact = LOCALES.find((l) => l.toLowerCase() === candidate.toLowerCase());
    if (exact) return exact;
    const base = candidate.split("-")[0].toLowerCase();
    const partial = LOCALES.find((l) => l.split("-")[0].toLowerCase() === base);
    if (partial) return partial;
  }
  return DEFAULT_LOCALE;
}

function lookup(dict, path) {
  return path.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

// t("goal.validation.titleRequired") / t("onboarding.progress", { current: 3, total: 25 })
// Falls back to pt-BR when a key is missing in the active locale, then to the
// key itself, so a missing translation can never render as "undefined".
export function t(path, vars) {
  let value = lookup(DICTS[currentLocale], path);
  if (value === undefined && currentLocale !== DEFAULT_LOCALE) {
    value = lookup(DICTS[DEFAULT_LOCALE], path);
  }
  if (value === undefined) return path;
  if (typeof value !== "string") return value;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, key) => (vars[key] !== undefined ? String(vars[key]) : match));
}

// Array-returning helper for lists (features, legal sections, message libraries).
export function tList(path) {
  const value = t(path);
  return Array.isArray(value) ? value : [];
}

// ---------- Formatters (locale-aware: separators, order, 24h vs 12h) ----------

export function fmtNumber(value, { maximumFractionDigits = 1, minimumFractionDigits = 0 } = {}) {
  return new Intl.NumberFormat(currentLocale, { maximumFractionDigits, minimumFractionDigits }).format(value);
}

export function fmtInt(value) {
  return new Intl.NumberFormat(currentLocale, { maximumFractionDigits: 0 }).format(Math.round(value));
}

// Prices are always in BRL regardless of interface language.
export function fmtCurrency(value) {
  const hasCents = Math.abs(value % 1) > 0.001;
  return new Intl.NumberFormat(currentLocale, {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function fmtDateLong(date) {
  return new Intl.DateTimeFormat(currentLocale, { weekday: "long", day: "numeric", month: "short" }).format(date);
}

export function fmtDateShort(date) {
  return new Intl.DateTimeFormat(currentLocale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function fmtWeekdayNarrow(date) {
  return new Intl.DateTimeFormat(currentLocale, { weekday: "short" }).format(date).replace(".", "").slice(0, 3);
}

// hhmm is stored as "HH:mm" (24h) and rendered per locale: 24h in pt-BR, 12h in en-US.
export function fmtTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat(currentLocale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: currentLocale !== "pt-BR",
  }).format(date);
}

export function fmtClock(date = new Date()) {
  return new Intl.DateTimeFormat(currentLocale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: currentLocale !== "pt-BR",
  }).format(date);
}

export function fmtPercent(ratio) {
  return new Intl.NumberFormat(currentLocale, { style: "percent", maximumFractionDigits: 0 }).format(ratio);
}

// Simple count-based pluralization: t path resolves to { one, other }.
export function tPlural(path, count) {
  const forms = t(path);
  if (typeof forms === "string") return forms;
  const form = count === 1 ? forms.one : forms.other;
  return (form ?? "").replace(/\{count\}/g, fmtInt(count));
}
