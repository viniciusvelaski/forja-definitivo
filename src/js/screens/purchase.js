// Simulated native store purchase sheet.
// FORJA never renders a card form and never stores payment details: in
// production this is replaced by Play Billing / StoreKit, which own the payment
// method entirely. The trial is only granted after an explicit confirmation.
import { setState, logEvent } from "../state/store.js";
import { openSheet } from "../components/overlay.js";
import { el, renderSelect } from "../components/widgets.js";
import { planById, createSubscription, effectiveMonthly, trialEndDate, TRIAL_DAYS, PURCHASE_OUTCOMES } from "../lib/subscription.js";
import { t, fmtCurrency, fmtDateShort } from "../i18n/index.js";

export function openPurchaseSheet({ planId, restore = false, onSuccess }) {
  const plan = planById(planId);
  let outcome = "success";

  openSheet({
    title: t("purchase.sheetTitle"),
    buildBody: (body, close) => {
      const view = el("div");
      body.appendChild(view);

      const withTrial = !restore;

      function renderConfirmState() {
        view.innerHTML = "";
        view.appendChild(el("div", { class: "store-chrome" }, [
          el("span", { text: `▲  ${t("purchase.storeLabel")}` }),
        ]));
        view.appendChild(el("div", { class: "notice notice-warn", text: t("purchase.simBanner") }));

        const lines = el("dl", { style: "margin:var(--space-4) 0 0" });
        const rows = [
          [t("purchase.plan"), t(`subscriptionPlans.${plan.id}`)],
          [t("purchase.price"), fmtCurrency(plan.totalPrice)],
          [t("purchase.monthlyEquivalent"), fmtCurrency(effectiveMonthly(plan))],
          withTrial ? [t("purchase.trial"), `${TRIAL_DAYS} ${t("common.days")}`] : null,
          [t("purchase.firstBilling"), fmtDateShort(withTrial ? trialEndDate(new Date()) : new Date())],
          [t("purchase.autoRenew"), t("purchase.autoRenewValue")],
        ].filter(Boolean);

        for (const [label, value] of rows) {
          lines.appendChild(el("div", { class: "purchase-line" }, [
            el("dt", { text: label }),
            el("dd", { text: value }),
          ]));
        }
        view.appendChild(lines);

        view.appendChild(el("p", { class: "text-micro text-tertiary", style: "margin-top:var(--space-3)", text: t("purchase.noCardNotice") }));

        // Prototype-only control so every store outcome can be reviewed.
        view.appendChild(el("div", { class: "settings-row", style: "margin-top:var(--space-3)" }, [
          el("div", { class: "settings-row-main" }, [
            el("div", { class: "settings-row-label text-small", text: t("purchase.simulateOutcome") }),
            el("div", { class: "settings-row-desc", text: t("common.simulation") }),
          ]),
          renderSelect({
            value: outcome,
            compact: true,
            title: t("purchase.simulateOutcome"),
            options: PURCHASE_OUTCOMES.map((id) => ({ value: id, label: t(`purchase.outcomes.${id}`) })),
            onChange: (next) => {
              outcome = next;
              renderConfirmState();
            },
          }),
        ]));

        view.appendChild(el("div", { class: "actions" }, [
          el("button", {
            class: "btn btn-primary",
            type: "button",
            text: t("purchase.confirm"),
            onClick: () => runPurchase(),
          }),
          el("button", { class: "btn btn-quiet", type: "button", text: t("purchase.cancel"), onClick: close }),
        ]));
      }

      function renderPending() {
        view.innerHTML = "";
        view.appendChild(el("div", { style: "text-align:center;padding:var(--space-8) 0" }, [
          el("h2", { text: t("purchase.pendingTitle") }),
          el("p", { class: "lede text-small", style: "margin-top:var(--space-2)", text: t("purchase.pendingSub") }),
        ]));
      }

      function renderResult(kind) {
        view.innerHTML = "";
        const isSuccess = kind === "success";
        const billing = withTrial ? trialEndDate(new Date()) : new Date();
        const titles = {
          success: t("purchase.successTitle"),
          canceled: t("purchase.canceledTitle"),
          ineligible: t("purchase.ineligibleTitle"),
          error: t("purchase.errorTitle"),
        };
        const subs = {
          success: t("purchase.successSub", { date: fmtDateShort(billing) }),
          canceled: t("purchase.canceledSub"),
          ineligible: t("purchase.ineligibleSub"),
          error: t("purchase.errorSub"),
        };

        view.appendChild(el("div", { style: "padding:var(--space-4) 0" }, [
          el("h2", { class: isSuccess ? "text-ember" : "", text: titles[kind] }),
          el("p", { class: "lede text-small", style: "margin-top:var(--space-2)", text: subs[kind] }),
        ]));

        const actions = el("div", { class: "actions" });
        if (isSuccess) {
          actions.appendChild(el("button", {
            class: "btn btn-primary", type: "button", text: t("purchase.goToApp"),
            onClick: () => { close(); onSuccess?.(); },
          }));
        } else if (kind === "ineligible") {
          actions.appendChild(el("button", {
            class: "btn btn-primary", type: "button", text: t("purchase.ineligibleCta"),
            onClick: () => {
              grantSubscription({ withTrial: false });
              close();
              onSuccess?.();
            },
          }));
          actions.appendChild(el("button", { class: "btn btn-quiet", type: "button", text: t("purchase.cancel"), onClick: close }));
        } else if (kind === "error") {
          actions.appendChild(el("button", { class: "btn btn-secondary", type: "button", text: t("common.retry"), onClick: renderConfirmState }));
          actions.appendChild(el("button", { class: "btn btn-quiet", type: "button", text: t("common.close"), onClick: close }));
        } else {
          actions.appendChild(el("button", { class: "btn btn-secondary", type: "button", text: t("common.retry"), onClick: renderConfirmState }));
          actions.appendChild(el("button", { class: "btn btn-quiet", type: "button", text: t("common.close"), onClick: close }));
        }
        view.appendChild(actions);
      }

      function grantSubscription({ withTrial: trial }) {
        const subscription = createSubscription(plan.id, { withTrial: trial });
        setState((state) => ({ ...state, subscription }));
        logEvent(trial ? "trial_started" : "subscription_purchased", { planId: plan.id, restored: restore });
      }

      function runPurchase() {
        renderPending();
        setTimeout(() => {
          if (outcome === "success") {
            grantSubscription({ withTrial });
            renderResult("success");
          } else {
            logEvent("purchase_outcome", { planId: plan.id, outcome });
            renderResult(outcome);
          }
        }, 850);
      }

      renderConfirmState();
    },
  });
}
