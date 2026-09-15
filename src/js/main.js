import { getState, setState, subscribe } from "./state/store.js";
import { startRouter, setGuard, setNotFound, navigate, currentPath, goBack } from "./router.js";
import { setLocale, detectLocale, onLocaleChange, t } from "./i18n/index.js";
import { hasEntitlement } from "./lib/subscription.js";
import { mountForgeBackground } from "./components/background.js";
import { el } from "./components/widgets.js";
import { initAppShell, isNative, isStandalone, syncGoalReminders } from "./platform/native.js";
import { registerOnboardingRoutes } from "./screens/onboardingFlow.js";
import { registerLegalRoutes } from "./screens/legal.js";
import { registerTodayRoutes } from "./screens/today.js";
import { registerGoalEditorRoutes } from "./screens/goalEditor.js";
import { registerProgressRoutes } from "./screens/progress.js";
import { registerMealsRoutes } from "./screens/meals.js";
import { registerResourcesRoutes } from "./screens/resources.js";
import { registerRecoveryRoutes } from "./screens/recovery.js";
import { registerProfileRoutes } from "./screens/profile.js";
import { registerAdminRoutes } from "./screens/admin.js";

const bootState = getState();

// ---- Locale ----
if (!bootState.localeChosen) {
  const detected = detectLocale();
  setLocale(detected);
  setState((s) => ({ ...s, locale: detected }), { silent: true });
} else {
  setLocale(bootState.locale);
}
function applyLocaleChrome() {
  document.title = "FORJA";
  const skipLink = document.querySelector(".skip-link");
  if (skipLink) skipLink.textContent = t("common.skipToContent");
}
onLocaleChange(applyLocaleChrome);
applyLocaleChrome();

// ---- Accessibility preference ----
if (bootState.profile.reducedMotion) {
  document.documentElement.setAttribute("data-reduced-motion", "true");
}

// ---- Mount ----
const frame = document.getElementById("app-frame");
const app = document.getElementById("app");
mountForgeBackground(frame);

registerOnboardingRoutes();
registerLegalRoutes();
registerTodayRoutes();
registerGoalEditorRoutes();
registerProgressRoutes();
registerMealsRoutes();
registerResourcesRoutes();
registerRecoveryRoutes();
registerProfileRoutes();
registerAdminRoutes();

setNotFound(() => el("div", { class: "screen empty-state", text: "404" }));

// Routes that never require an active entitlement. Profile stays reachable on
// purpose: account, language, legal and subscription management must not be
// locked behind the paywall.
const OPEN_ROUTES = new Set(["/welcome", "/onboarding", "/plan-generating", "/plan-preview", "/paywall", "/legal", "/admin", "/profile"]);

setGuard((base) => {
  const current = getState();
  // Onboarding still gates Profile: there is no account to manage before it.
  if (base === "/profile" && !current.onboarding.completed) return "/welcome";
  if (OPEN_ROUTES.has(base)) return null;
  if (!current.onboarding.completed) return "/welcome";
  if (!hasEntitlement(current.subscription)) return "/paywall";
  return null;
});

// ---- Initial route ----
// Shared single-file builds can pin the entry route, because a hash on the
// hosting page's URL never reaches this document inside its sandbox frame.
if (!location.hash && window.__FORJA_START_ROUTE__) {
  location.hash = `#${window.__FORJA_START_ROUTE__}`;
} else if (!location.hash) {
  const current = getState();
  if (hasEntitlement(current.subscription)) location.hash = "#/today";
  else if (current.onboarding.completed) location.hash = "#/paywall";
  else if (current.onboarding.currentIndex > 0) location.hash = "#/onboarding";
  else location.hash = "#/welcome";
}

startRouter(app);

// ---- Offline banner ----
function updateOfflineBanner() {
  const existing = document.getElementById("offline-banner");
  if (!navigator.onLine) {
    if (!existing) {
      frame.appendChild(el("div", {
        id: "offline-banner",
        class: "offline-banner",
        role: "status",
        text: t("offline.banner"),
      }));
    }
  } else {
    existing?.remove();
  }
}
window.addEventListener("online", updateOfflineBanner);
window.addEventListener("offline", updateOfflineBanner);
updateOfflineBanner();

// ---- App shell ----
// Marks the document when running as an installed app so CSS can adapt
// (safe areas, no browser chrome to compensate for).
if (isStandalone()) document.documentElement.setAttribute("data-standalone", "true");
if (isNative()) document.documentElement.setAttribute("data-native", "true");

// Android's hardware back button navigates inside the app instead of closing it.
initAppShell({
  onBack: () => {
    const overlay = document.getElementById("overlay-root");
    if (overlay?.firstChild) {
      overlay.innerHTML = "";
      return true;
    }
    if (currentPath() === "/today" || currentPath() === "/welcome") return false;
    goBack("/today");
    return true;
  },
});

// Service worker: installability and offline. Not used in the native shell,
// where the assets are already on the device.
if ("serviceWorker" in navigator && !isNative()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Registration fails on file:// and other insecure origins; the app still runs.
    });
  });
}

// ---- Reminders ----
// Any change to goals or notification preferences reschedules every local
// notification. Debounced because store writes come in bursts.
let reminderTimer = null;
function scheduleReminderSync() {
  clearTimeout(reminderTimer);
  reminderTimer = setTimeout(() => {
    const current = getState();
    syncGoalReminders(current.goals, current.profile);
  }, 800);
}
subscribe(scheduleReminderSync);
scheduleReminderSync();

// Exposed for the prototype's automated checks.
window.__FORJA__ = { getState, currentPath, navigate };
