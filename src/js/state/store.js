import { HEAT_START } from "../lib/heatEngine.js";
import { EMPTY_SUBSCRIPTION } from "../lib/subscription.js";
import { SEED_RESOURCES } from "../lib/mockData.js";
import { DEFAULT_LOCALE, detectLocale } from "../i18n/index.js";

const STORAGE_KEY = "forja_state_v2";
const LEGACY_KEY = "forja_state_v1";
const LEGACY_BACKUP_KEY = "forja_state_v1_backup";

export { todayKey } from "../lib/dateKey.js";
import { todayKey } from "../lib/dateKey.js";

export function emptyDayLog() {
  return { progress: {}, timestamps: {} };
}

export function defaultState() {
  return {
    version: 2,
    locale: DEFAULT_LOCALE,
    localeChosen: false,
    onboarding: { currentIndex: 0, answers: {}, completed: false },
    profile: {
      displayName: "",
      photo: null,
      reminderFrequency: "morning_evening",
      reminderTone: "direct",
      faithOptIn: false,
      reducedMotion: false,
      preferredResourceCategory: "study",
    },
    plan: { selectedPlan: null, scores: null, tieBreakUsed: false },
    goals: [],
    nutritionGoals: null,
    subscription: { ...EMPTY_SUBSCRIPTION },
    dailyLogs: {},
    heatHistory: [{ date: todayKey(), score: HEAT_START }],
    meals: {},
    customFoods: [],
    recoveryGoals: [],
    resources: SEED_RESOURCES.map((resource) => ({ ...resource, title: { ...resource.title } })),
    resourcesOpened: [],
    analyticsEvents: [],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed, profile: { ...defaultState().profile, ...(parsed.profile ?? {}) } };
    }
    // The v1 prototype used an incompatible goal/answer schema. Keep the old
    // payload for inspection instead of half-migrating it into a broken state.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      localStorage.setItem(LEGACY_BACKUP_KEY, legacy);
      localStorage.removeItem(LEGACY_KEY);
    }
    const fresh = defaultState();
    fresh.locale = detectLocale();
    return fresh;
  } catch {
    return defaultState();
  }
}

let state = load();
const listeners = new Set();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode / quota) — the prototype keeps running in memory.
  }
}

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(updater, { silent = false } = {}) {
  state = typeof updater === "function" ? updater(state) : { ...state, ...updater };
  persist();
  if (!silent) {
    for (const fn of listeners) fn(state);
  }
}

export function updateProfile(patch) {
  setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
}

export function todayLog(s = state) {
  return s.dailyLogs[todayKey()] ?? emptyDayLog();
}

export function logEvent(name, data = {}) {
  setState((s) => ({
    ...s,
    analyticsEvents: [...s.analyticsEvents.slice(-199), { name, data, at: new Date().toISOString() }],
  }), { silent: true });
}

export function resetAll() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  state = defaultState();
  for (const fn of listeners) fn(state);
}
