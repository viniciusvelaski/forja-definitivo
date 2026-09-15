import { getState, setState, updateProfile, resetAll, logEvent } from "../state/store.js";
import { navigate, registerRoute, refresh } from "../router.js";
import { planById, cancelSubscription } from "../lib/subscription.js";
import { REMINDER_TONES, REMINDER_FREQUENCIES } from "../lib/onboardingQuestions.js";
import { activeGoals } from "../lib/recoveryRules.js";
import { el, withBottomNav, renderToggle, renderSelect, renderAvatar, renderNotificationPreview, sectionHeading, ICONS } from "../components/widgets.js";
import { openConfirmDialog, showToast } from "../components/overlay.js";
import { refreshBackgroundMotion, updateBackgroundHeat } from "../components/background.js";
import { displayedHeatScore } from "../lib/dayEngine.js";
import { t, tPlural, LOCALES, setLocale, getLocale, fmtDateShort, fmtClock, fmtInt } from "../i18n/index.js";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const PHOTO_SIZE = 256;

function settingsRow(label, description, control) {
  return el("div", { class: "settings-row" }, [
    el("div", { class: "settings-row-main" }, [
      el("div", { class: "settings-row-label", text: label }),
      description ? el("div", { class: "settings-row-desc", text: description }) : null,
    ]),
    control,
  ]);
}

function rowLink(label, value, onClick) {
  return el("button", { class: "row-button", type: "button", onClick }, [
    el("span", { style: "min-width:0" }, [
      el("span", { style: "display:block", text: label }),
      value ? el("span", { class: "settings-row-desc", text: value }) : null,
    ]),
    el("span", { class: "row-chevron", html: ICONS.chevronRight }),
  ]);
}

function renderProfile() {
  const state = getState();
  updateBackgroundHeat(displayedHeatScore(state));
  const content = el("div", { class: "screen" });

  content.appendChild(el("h1", { class: "display", text: t("profile.title") }));

  // ---- Identity ----
  const photoInput = el("input", { type: "file", accept: "image/*", class: "sr-only", id: "photo-input" });
  photoInput.addEventListener("change", () => handlePhoto(photoInput.files?.[0]));

  const identity = el("div", { style: "margin-top:var(--space-5)" }, [
    el("div", { style: "display:flex;gap:var(--space-4);align-items:center" }, [
      renderAvatar(state.profile.photo, { size: "lg", onClick: () => photoInput.click(), label: t("profile.choosePhoto") }),
      el("div", { class: "field", style: "flex:1;min-width:0;margin-bottom:0" }, [
        el("label", { class: "field-label", for: "display-name", text: t("profile.displayName") }),
        (() => {
          const input = el("input", {
            class: "input",
            type: "text",
            id: "display-name",
            "data-field": "display-name",
            placeholder: t("profile.displayNamePlaceholder"),
            value: state.profile.displayName,
          });
          // Persists as you type; no re-render is needed because the field
          // already shows the value and nothing else on screen depends on it.
          input.addEventListener("input", () => updateProfile({ displayName: input.value }));
          return input;
        })(),
      ]),
    ]),
    el("div", { class: "btn-row", style: "margin-top:var(--space-4)" }, [
      el("button", {
        class: "btn btn-quiet",
        type: "button",
        text: state.profile.photo ? t("profile.replacePhoto") : t("profile.choosePhoto"),
        onClick: () => photoInput.click(),
      }),
      state.profile.photo
        ? el("button", {
            class: "btn btn-quiet",
            type: "button",
            text: t("profile.removePhoto"),
            onClick: () => { updateProfile({ photo: null }); showToast(t("toast.saved")); refresh(); },
          })
        : null,
    ]),
  ]);
  content.appendChild(identity);
  content.appendChild(photoInput);
  content.appendChild(el("p", { class: "field-hint", style: "margin-top:var(--space-2)", text: t("profile.photoHint") }));

  // ---- Language ----
  content.appendChild(sectionHeading(t("profile.language")));
  content.appendChild(el("div", { class: "panel" }, [
    settingsRow(t("profile.language"), t("profile.languageDesc"), renderSelect({
      value: getLocale(),
      compact: true,
      title: t("profile.language"),
      options: LOCALES.map((locale) => ({ value: locale, label: locale === "pt-BR" ? "Português (Brasil)" : "English (US)" })),
      onChange: (locale) => {
        setLocale(locale);
        setState((s) => ({ ...s, locale, localeChosen: true }));
        refresh();
      },
    })),
  ]));

  // ---- Notifications ----
  content.appendChild(sectionHeading(t("profile.notifications")));
  const notifications = el("div", { class: "panel" }, [
    settingsRow(t("profile.tone"), null, renderSelect({
      value: state.profile.reminderTone,
      compact: true,
      title: t("profile.tone"),
      options: REMINDER_TONES.map((tone) => ({ value: tone, label: t(`profile.tones.${tone}`) })),
      onChange: (tone) => { updateProfile({ reminderTone: tone }); refresh(); },
    })),
    settingsRow(t("profile.frequency"), null, renderSelect({
      value: state.profile.reminderFrequency,
      compact: true,
      title: t("profile.frequency"),
      options: REMINDER_FREQUENCIES.map((frequency) => ({ value: frequency, label: t(`profile.frequencies.${frequency}`) })),
      onChange: (frequency) => { updateProfile({ reminderFrequency: frequency }); refresh(); },
    })),
    settingsRow(t("profile.faith"), t("profile.faithDesc"), renderToggle(state.profile.faithOptIn, (value) => {
      updateProfile({ faithOptIn: value });
      logEvent("faith_pref_changed", { enabled: value });
      refresh();
    }, { label: t("profile.faith") })),
  ]);
  content.appendChild(notifications);

  // Preview reflects tone + faith opt-in immediately. With faith off, no
  // faith-based message can appear here or anywhere else in the app.
  content.appendChild(sectionHeading(t("profile.previewLabel")));
  const library = state.profile.faithOptIn
    ? t("notifications.faith")
    : (t(`notifications.${state.profile.reminderTone}`) ?? t("notifications.direct"));
  content.appendChild(renderNotificationPreview({ text: library[0], time: fmtClock() }));

  // ---- Accessibility ----
  content.appendChild(sectionHeading(t("profile.accessibility")));
  content.appendChild(el("div", { class: "panel" }, [
    settingsRow(t("profile.reducedMotion"), t("profile.reducedMotionDesc"), renderToggle(state.profile.reducedMotion, (value) => {
      updateProfile({ reducedMotion: value });
      document.documentElement.setAttribute("data-reduced-motion", String(value));
      refreshBackgroundMotion();
    }, { label: t("profile.reducedMotion") })),
  ]));

  // ---- Linked areas ----
  content.appendChild(sectionHeading(t("profile.nutrition")));
  const goals = state.nutritionGoals;
  content.appendChild(el("div", { class: "panel" }, [
    rowLink(
      t("profile.nutrition"),
      goals?.calories
        ? t("profile.nutritionSet", { calories: fmtInt(goals.calories), protein: fmtInt(goals.protein), carbs: fmtInt(goals.carbs), fat: fmtInt(goals.fat) })
        : t("profile.nutritionEmpty"),
      () => navigate("/nutrition-goals")
    ),
  ]));

  const recoveryCount = activeGoals(state.recoveryGoals).length;
  content.appendChild(sectionHeading(t("profile.recovery")));
  content.appendChild(el("div", { class: "panel" }, [
    rowLink(
      t("profile.recovery"),
      recoveryCount ? tPlural("profile.recoveryCount", recoveryCount) : t("profile.recoveryEmpty"),
      () => navigate("/recovery")
    ),
  ]));

  // ---- Subscription ----
  content.appendChild(sectionHeading(t("profile.subscription")));
  content.appendChild(renderSubscription(state));

  // ---- Legal ----
  content.appendChild(sectionHeading(t("profile.legal")));
  content.appendChild(el("div", { class: "panel" }, [
    rowLink(t("profile.terms"), null, () => navigate("/legal?doc=terms&from=profile")),
    rowLink(t("profile.privacy"), null, () => navigate("/legal?doc=privacy&from=profile")),
  ]));

  content.appendChild(el("div", { class: "actions" }, [
    el("button", {
      class: "btn btn-danger",
      type: "button",
      text: t("profile.signOut"),
      onClick: () => openConfirmDialog({
        title: t("profile.signOutConfirmTitle"),
        body: t("profile.signOutConfirmBody"),
        confirmLabel: t("profile.signOut"),
        danger: true,
        onConfirm: () => {
          resetAll();
          navigate("/welcome");
        },
      }),
    }),
  ]));

  return withBottomNav(content, "profile", navigate);
}

function renderSubscription(state) {
  const subscription = state.subscription;
  const card = el("div", { class: "card" });

  if (subscription.status === "none") {
    card.appendChild(el("div", { class: "text-small text-secondary", text: t("profile.subNone") }));
    card.appendChild(el("button", {
      class: "btn btn-secondary",
      type: "button",
      style: "margin-top:var(--space-3)",
      text: t("profile.resubscribe"),
      onClick: () => navigate("/paywall"),
    }));
    return card;
  }

  const plan = planById(subscription.planId);
  const statusLabel = {
    trial: t("profile.subTrial"),
    active: t("profile.subActive"),
    canceled: t("profile.subCanceled"),
  }[subscription.status] ?? subscription.status;

  card.appendChild(el("div", { style: "font-size:14px", text: `${t(`subscriptionPlans.${plan.id}`)} — ${statusLabel}` }));

  if (subscription.status !== "canceled" && subscription.nextBillingDate) {
    card.appendChild(el("div", {
      class: "text-micro text-tertiary mono",
      style: "margin-top:4px",
      text: t("profile.nextBilling", { date: fmtDateShort(new Date(subscription.nextBillingDate)) }),
    }));
  }

  if (subscription.status === "canceled") {
    card.appendChild(el("div", { class: "text-micro text-tertiary", style: "margin-top:4px", text: t("profile.accessUntil") }));
    if (subscription.accessUntil) {
      card.appendChild(el("div", {
        class: "text-micro text-tertiary mono",
        text: fmtDateShort(new Date(subscription.accessUntil)),
      }));
    }
    card.appendChild(el("button", {
      class: "btn btn-secondary",
      type: "button",
      style: "margin-top:var(--space-3)",
      text: t("profile.resubscribe"),
      onClick: () => navigate("/paywall"),
    }));
  } else {
    card.appendChild(el("button", {
      class: "btn btn-quiet",
      type: "button",
      style: "margin-top:var(--space-3)",
      text: t("profile.cancelSub"),
      onClick: () => openConfirmDialog({
        title: t("profile.cancelConfirmTitle"),
        body: t("profile.cancelConfirmBody"),
        confirmLabel: t("profile.cancelSub"),
        danger: true,
        onConfirm: () => {
          setState((s) => ({ ...s, subscription: cancelSubscription(s.subscription) }));
          logEvent("subscription_canceled", { planId: plan.id });
          showToast(t("toast.subCanceled"));
          refresh();
        },
      }),
    }));
  }

  return card;
}

// Downscaled to 256px and stored as a data URL: small enough for localStorage,
// and it never leaves the device in the prototype.
function handlePhoto(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast(t("profile.photoInvalid"));
    return;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    showToast(t("profile.photoTooLarge"));
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = PHOTO_SIZE;
      canvas.height = PHOTO_SIZE;
      const ctx = canvas.getContext("2d");
      const side = Math.min(image.width, image.height);
      ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
      updateProfile({ photo: canvas.toDataURL("image/jpeg", 0.82) });
      showToast(t("toast.saved"));
      refresh();
    };
    image.onerror = () => showToast(t("profile.photoInvalid"));
    image.src = reader.result;
  };
  reader.onerror = () => showToast(t("profile.photoInvalid"));
  reader.readAsDataURL(file);
}

export function registerProfileRoutes() {
  registerRoute("/profile", renderProfile);
}
