import { getState, setState, logEvent } from "../state/store.js";
import { navigate, registerRoute } from "../router.js";
import { TOTAL_QUESTIONS, questionAt, derivePreferences, planAnswersFrom } from "../lib/onboardingQuestions.js";
import { selectPlan } from "../lib/onboardingScoring.js";
import { PLANS, savingsPercentVsMonthly, effectiveMonthly, trialEndDate, TRIAL_DAYS } from "../lib/subscription.js";
import { seedGoalsFromPlan } from "../state/goalActions.js";
import { renderForgeRing } from "../components/forgeRing.js";
import { el, renderTopBar, renderSelect, ICONS } from "../components/widgets.js";
import { openPurchaseSheet } from "./purchase.js";
import { t, tList, fmtCurrency, fmtDateShort, LOCALES, setLocale, getLocale } from "../i18n/index.js";

// ---------------- Welcome ----------------
function renderWelcome() {
  const screen = el("div", { class: "screen screen--centered" });

  const header = el("div", { style: "text-align:center;display:flex;flex-direction:column;align-items:center;gap:var(--space-6)" }, [
    el("div", { class: "wordmark", text: t("welcome.eyebrow") }),
    el("h1", { class: "display", style: "max-width:320px", text: t("welcome.headline") }),
    el("p", { class: "lede", style: "max-width:310px", text: t("welcome.sub") }),
  ]);
  screen.appendChild(header);

  const actions = el("div", { class: "actions", style: "margin-top:var(--space-10)" });
  actions.appendChild(el("button", {
    class: "btn btn-primary",
    type: "button",
    text: t("welcome.start"),
    onClick: () => {
      logEvent("onboarding_started");
      navigate("/onboarding");
    },
  }));

  const languageRow = el("div", { class: "settings-row", style: "justify-content:center;gap:var(--space-3);border:none" }, [
    el("span", { class: "text-small text-tertiary", text: t("welcome.language") }),
    renderSelect({
      value: getLocale(),
      title: t("welcome.language"),
      compact: true,
      options: LOCALES.map((locale) => ({ value: locale, label: localeName(locale) })),
      onChange: (locale) => {
        setLocale(locale);
        setState((state) => ({ ...state, locale, localeChosen: true }));
      },
    }),
  ]);
  actions.appendChild(languageRow);
  screen.appendChild(actions);
  return screen;
}

function localeName(locale) {
  return locale === "pt-BR" ? "Português (Brasil)" : "English (US)";
}

// ---------------- Onboarding questions ----------------
function renderOnboardingStep() {
  const state = getState();
  const index = Math.min(state.onboarding.currentIndex, TOTAL_QUESTIONS - 1);
  const { kind, question } = questionAt(index);
  const savedAnswer = state.onboarding.answers[question.id];

  const screen = el("div", { class: "screen" });
  screen.appendChild(renderTopBar({
    title: t("onboarding.progress", { current: index + 1, total: TOTAL_QUESTIONS }),
    onBack: index > 0 ? () => stepTo(index - 1) : null,
  }));

  screen.appendChild(el("div", {
    class: "progress-track",
    role: "progressbar",
    "aria-valuenow": String(index + 1),
    "aria-valuemin": "1",
    "aria-valuemax": String(TOTAL_QUESTIONS),
    style: "margin-bottom:var(--space-8)",
  }, [el("div", { class: "progress-fill", style: `width:${((index + 1) / TOTAL_QUESTIONS) * 100}%` })]));

  screen.appendChild(el("h2", { style: "font-size:22px;line-height:1.3", text: t(`onboarding.q${question.id}.text`) }));

  const optionLabels = t(`onboarding.q${question.id}.o`);
  const list = el("div", { class: "choice-list", style: "margin-top:var(--space-8)" });

  optionLabels.forEach((label, optionIndex) => {
    const value = kind === "plan" ? question.plans[optionIndex] : optionIndex;
    const selected = savedAnswer === value;
    const button = el("button", {
      class: `choice${selected ? " selected" : ""}`,
      type: "button",
      "aria-pressed": String(selected),
      text: label,
    });
    button.addEventListener("click", () => {
      setState((s) => ({
        ...s,
        onboarding: { ...s.onboarding, answers: { ...s.onboarding.answers, [question.id]: value } },
      }));
      setTimeout(() => stepTo(index + 1), 120);
    });
    list.appendChild(button);
  });

  screen.appendChild(list);
  return screen;
}

function stepTo(index) {
  if (index >= TOTAL_QUESTIONS) {
    completeOnboarding();
    return;
  }
  setState((state) => ({ ...state, onboarding: { ...state.onboarding, currentIndex: index } }));
  navigate("/onboarding");
}

function completeOnboarding() {
  const state = getState();
  const { selectedPlan, scores, tieBreakUsed } = selectPlan(planAnswersFrom(state.onboarding.answers));
  const preferences = derivePreferences(state.onboarding.answers);

  setState((s) => ({
    ...s,
    onboarding: { ...s.onboarding, completed: true },
    plan: { selectedPlan, scores, tieBreakUsed },
    goals: seedGoalsFromPlan(selectedPlan),
    profile: { ...s.profile, ...preferences },
  }));

  logEvent("onboarding_completed", { selectedPlan, scores, tieBreakUsed });
  navigate("/plan-generating");
}

// ---------------- Plan configuration transition ----------------
function renderPlanGenerating() {
  const screen = el("div", { class: "screen screen--centered", style: "align-items:center;text-align:center;gap:var(--space-5)" });
  screen.appendChild(renderForgeRing(14, { size: "sm", showMessage: false, animateFrom: 0 }));
  screen.appendChild(el("h2", { style: "margin-top:var(--space-4)", text: t("planGen.title") }));
  screen.appendChild(el("p", { class: "lede", text: t("planGen.sub") }));

  setTimeout(() => {
    logEvent("plan_preview_viewed", { plan: getState().plan.selectedPlan });
    navigate("/plan-preview");
  }, 1100);

  return screen;
}

// ---------------- Plan preview ----------------
function renderPlanPreview() {
  const state = getState();
  const code = state.plan.selectedPlan ?? "A";
  const screen = el("div", { class: "screen" });

  screen.appendChild(el("div", { class: "eyebrow", text: t("planPreview.eyebrow") }));
  screen.appendChild(el("h1", { class: "display", style: "margin-top:var(--space-2)", text: t(`plans.${code}.name`) }));
  screen.appendChild(el("p", { class: "lede", style: "margin-top:var(--space-3)", text: t("planPreview.sub") }));

  screen.appendChild(el("div", { style: "display:flex;justify-content:center;margin:var(--space-6) 0" }, [
    renderForgeRing(30, { size: "sm" }),
  ]));

  screen.appendChild(el("div", { class: "section-heading", text: t("planPreview.sampleHabits") }));
  const habits = el("div", { class: "panel" });
  tList(`plans.${code}.goals`).forEach((title) => {
    habits.appendChild(el("div", { style: "padding:var(--space-3) 0" }, [
      el("div", { text: title }),
    ]));
  });
  screen.appendChild(habits);

  screen.appendChild(el("div", { class: "section-heading", text: t("planPreview.routineStyle") }));
  screen.appendChild(el("span", { class: "pill pill-active pill-static", text: t(`plans.${code}.style`) }));

  screen.appendChild(el("p", { class: "text-small text-tertiary", style: "margin-top:var(--space-6)", text: `${t(`plans.${code}.tagline`)} ${t("planPreview.editNote")}` }));

  screen.appendChild(el("div", { class: "actions" }, [
    el("button", { class: "btn btn-primary", type: "button", text: t("common.continue"), onClick: () => navigate("/paywall") }),
  ]));
  return screen;
}

// ---------------- Paywall ----------------
let selectedPlanId = "annual";

function renderPaywall() {
  const screen = el("div", { class: "screen" });

  screen.appendChild(el("h1", { class: "display", text: t("paywall.title") }));
  screen.appendChild(el("p", { class: "lede", style: "margin-top:var(--space-3)", text: t("paywall.sub") }));

  const features = el("div", { class: "panel", style: "margin-top:var(--space-6)" });
  tList("paywall.features").forEach((feature) => {
    features.appendChild(el("div", { style: "display:flex;gap:var(--space-3);padding:var(--space-3) 0;align-items:center" }, [
      el("span", { class: "text-ember", html: ICONS.check }),
      el("span", { class: "text-small", text: feature }),
    ]));
  });
  screen.appendChild(features);

  screen.appendChild(el("div", { class: "section-heading", text: t("paywall.choosePlan") }));
  const planList = el("div", { class: "choice-list", role: "radiogroup", "aria-label": t("paywall.choosePlan") });

  function drawPlans() {
    planList.innerHTML = "";
    for (const plan of PLANS) {
      const isSelected = plan.id === selectedPlanId;
      const saving = savingsPercentVsMonthly(plan);
      const card = el("button", {
        class: `plan-card${isSelected ? " selected" : ""}`,
        type: "button",
        role: "radio",
        "aria-checked": String(isSelected),
      }, [
        el("div", { class: "plan-card-top" }, [
          el("span", { class: "plan-name", text: t(`subscriptionPlans.${plan.id}`) }),
          el("span", { class: "plan-price mono", text: fmtCurrency(plan.totalPrice) }),
        ]),
        el("span", { class: "plan-sub", text: t("paywall.perMonth", { value: fmtCurrency(effectiveMonthly(plan)) }) }),
        saving > 0
          ? el("span", { class: "plan-saving", text: t("paywall.saveVsMonthly", { percent: `${Math.round(saving * 100)}%` }) })
          : null,
      ]);
      card.addEventListener("click", () => {
        selectedPlanId = plan.id;
        drawPlans();
      });
      planList.appendChild(card);
    }
  }
  drawPlans();
  screen.appendChild(planList);

  // Billing disclosure, shown before any confirmation step.
  const trialEnd = trialEndDate(new Date());
  const disclosure = el("div", { class: "card", style: "margin-top:var(--space-6)" }, [
    el("div", { class: "eyebrow", style: "margin-bottom:var(--space-2)", text: t("paywall.billingTitle") }),
    el("p", { class: "text-small text-secondary", text: t("paywall.billingTrial") }),
    el("p", { class: "text-small text-secondary mono", style: "margin-top:4px", text: t("paywall.billingFirstDate", { date: fmtDateShort(trialEnd) }) }),
    el("p", { class: "text-small text-secondary", style: "margin-top:4px", text: t("paywall.billingRenew") }),
    el("p", { class: "text-small text-secondary", style: "margin-top:4px", text: t("paywall.billingCancel") }),
    el("div", { class: "btn-row", style: "margin-top:var(--space-4)" }, [
      el("button", { class: "btn btn-quiet", type: "button", text: t("paywall.terms"), onClick: () => navigate("/legal?doc=terms&from=paywall") }),
      el("button", { class: "btn btn-quiet", type: "button", text: t("paywall.privacy"), onClick: () => navigate("/legal?doc=privacy&from=paywall") }),
    ]),
  ]);
  screen.appendChild(disclosure);

  screen.appendChild(el("div", { class: "actions" }, [
    el("button", {
      class: "btn btn-primary",
      type: "button",
      text: t("paywall.trialCta"),
      // A tap on a plan card never starts the trial: confirmation happens in
      // the simulated store sheet, and only a successful purchase entitles.
      onClick: () => openPurchaseSheet({ planId: selectedPlanId, onSuccess: () => navigate("/today") }),
    }),
    el("button", {
      class: "btn btn-ghost",
      type: "button",
      style: "width:100%",
      text: t("paywall.restore"),
      onClick: () => {
        logEvent("restore_purchase_tapped");
        openPurchaseSheet({ planId: selectedPlanId, restore: true, onSuccess: () => navigate("/today") });
      },
    }),
  ]));

  screen.appendChild(el("p", { class: "text-micro text-tertiary", style: "margin-top:var(--space-4);text-align:center", text: `${TRIAL_DAYS} ${t("common.days")} · ${t("common.simulation")}` }));
  return screen;
}

export function registerOnboardingRoutes() {
  registerRoute("/welcome", renderWelcome);
  registerRoute("/onboarding", renderOnboardingStep);
  registerRoute("/plan-generating", renderPlanGenerating);
  registerRoute("/plan-preview", renderPlanPreview);
  registerRoute("/paywall", renderPaywall);
}
