// Bridge between the app and the device.
//
// When FORJA runs inside the native shell, Capacitor exposes its plugins on
// window.Capacitor.Plugins. Reading them from that global (instead of importing
// packages) means the exact same source file runs unchanged in the browser, in
// the installed PWA and in the native app — only the capability level differs.
//
// Every function degrades instead of throwing: the web build keeps working.

import { t } from "../i18n/index.js";
import { WEEKDAYS } from "../lib/goals.js";

function capacitor() {
  return typeof window !== "undefined" ? window.Capacitor : undefined;
}

function plugin(name) {
  return capacitor()?.Plugins?.[name];
}

export function isNative() {
  return Boolean(capacitor()?.isNativePlatform?.());
}

export function platformName() {
  return capacitor()?.getPlatform?.() ?? "web";
}

// True once the app is running as an installed app rather than a browser tab.
export function isStandalone() {
  if (isNative()) return true;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

// ---------------------------------------------------------------- sharing ----

// Returns the method actually used so the caller can tell the user what happened.
export async function share({ title, text }) {
  const Share = plugin("Share");
  if (Share) {
    try {
      await Share.share({ title, text, dialogTitle: title });
      return "native";
    } catch (error) {
      if (String(error?.message ?? "").toLowerCase().includes("cancel")) return "canceled";
    }
  }

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text });
      return "native";
    } catch {
      return "canceled";
    }
  }

  return "unsupported";
}

export function canShareNatively() {
  return Boolean(plugin("Share")) || typeof navigator.share === "function";
}

// --------------------------------------------------------------- haptics ----

// style: "light" | "medium" | "success"
export async function haptic(style = "light") {
  const Haptics = plugin("Haptics");
  if (Haptics) {
    try {
      if (style === "success") {
        await Haptics.notification({ type: "SUCCESS" });
      } else {
        await Haptics.impact({ style: style === "medium" ? "MEDIUM" : "LIGHT" });
      }
      return;
    } catch {
      // fall through to the web vibration API
    }
  }

  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(style === "success" ? [14, 40, 22] : style === "medium" ? 18 : 10);
  }
}

// --------------------------------------------------------- external links ----

export async function openExternal(url) {
  const Browser = plugin("Browser");
  if (Browser) {
    try {
      await Browser.open({ url });
      return;
    } catch {
      // fall through
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

// ----------------------------------------------------------- app lifecycle ----

// Status bar, splash screen and the Android hardware back button.
export async function initAppShell({ onBack } = {}) {
  const StatusBar = plugin("StatusBar");
  if (StatusBar) {
    try {
      await StatusBar.setStyle({ style: "DARK" });
      await StatusBar.setBackgroundColor({ color: "#0A0A0C" });
      await StatusBar.setOverlaysWebView({ overlay: false });
    } catch {
      // not fatal
    }
  }

  const SplashScreen = plugin("SplashScreen");
  if (SplashScreen) {
    try {
      await SplashScreen.hide();
    } catch {
      // not fatal
    }
  }

  const App = plugin("App");
  if (App && onBack) {
    // Android's hardware back must navigate, not kill the app.
    App.addListener("backButton", ({ canGoBack }) => {
      const handled = onBack();
      if (!handled && !canGoBack) App.exitApp();
    });
  }
}

// ---------------------------------------------------------- notifications ----

const LOCAL_NOTIFICATIONS = "LocalNotifications";

export function notificationsSupported() {
  return Boolean(plugin(LOCAL_NOTIFICATIONS));
}

export async function ensureNotificationPermission() {
  const LocalNotifications = plugin(LOCAL_NOTIFICATIONS);
  if (!LocalNotifications) return "unsupported";
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return "granted";
    const requested = await LocalNotifications.requestPermissions();
    return requested.display;
  } catch {
    return "denied";
  }
}

// Capacitor weekdays are 1 = Sunday .. 7 = Saturday.
const WEEKDAY_TO_CAPACITOR = { sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7 };

// Stable positive 32-bit id per goal + weekday, so rescheduling replaces
// the previous notification instead of stacking duplicates.
function notificationId(goalId, weekday) {
  const seed = `${goalId}:${weekday}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2147483000;
}

function reminderBody(profile) {
  const library = profile.faithOptIn
    ? t("notifications.faith")
    : (t(`notifications.${profile.reminderTone}`) ?? t("notifications.direct"));
  return library[Math.floor(Math.random() * library.length)];
}

/**
 * Rebuilds every scheduled reminder from the current goals and preferences.
 * Safe to call after any change — it always clears before scheduling.
 * Returns { scheduled, reason } so the UI can report honestly.
 */
export async function syncGoalReminders(goals, profile) {
  const LocalNotifications = plugin(LOCAL_NOTIFICATIONS);
  if (!LocalNotifications) return { scheduled: 0, reason: "unsupported" };

  try {
    const pending = await LocalNotifications.getPending();
    if (pending?.notifications?.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  } catch {
    // continue; scheduling below still replaces by id
  }

  if (profile.reminderFrequency === "none") return { scheduled: 0, reason: "disabled" };

  const permission = await ensureNotificationPermission();
  if (permission !== "granted") return { scheduled: 0, reason: "denied" };

  const notifications = [];
  for (const goal of goals) {
    if (goal.paused || !goal.reminderTime) continue;
    // "Only essential goals" maps to the scoring goals.
    if (profile.reminderFrequency === "essential" && goal.isPrimary === false) continue;

    const [hour, minute] = goal.reminderTime.split(":").map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) continue;

    for (const weekday of goal.activeDays ?? WEEKDAYS) {
      const on = WEEKDAY_TO_CAPACITOR[weekday];
      if (!on) continue;
      notifications.push({
        id: notificationId(goal.id, weekday),
        title: t("notifications.title"),
        body: `${goal.title} — ${reminderBody(profile)}`,
        schedule: { on: { weekday: on, hour, minute }, allowWhileIdle: true },
        smallIcon: "ic_stat_icon_config_sample",
      });
    }
  }

  if (notifications.length === 0) return { scheduled: 0, reason: "no-reminders" };

  try {
    await LocalNotifications.schedule({ notifications });
    return { scheduled: notifications.length, reason: "ok" };
  } catch {
    return { scheduled: 0, reason: "error" };
  }
}

export async function cancelAllReminders() {
  const LocalNotifications = plugin(LOCAL_NOTIFICATIONS);
  if (!LocalNotifications) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending?.notifications?.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  } catch {
    // nothing to do
  }
}
