// Subscription plans and entitlement rules.
// Prices are the real ones supplied in the brief; savings are computed from the
// monthly price, never invented, and never presented as a permanent discount.

export const TRIAL_DAYS = 7;

export const PLANS = [
  { id: "monthly", months: 1, totalPrice: 25 },
  { id: "semiannual", months: 6, totalPrice: 80 },
  { id: "annual", months: 12, totalPrice: 100 },
];

export const PLAN_LABEL_KEYS = {
  monthly: "subscriptionPlans.monthly",
  semiannual: "subscriptionPlans.semiannual",
  annual: "subscriptionPlans.annual",
};

export const PURCHASE_OUTCOMES = ["success", "canceled", "ineligible", "error"];

export function planById(id) {
  return PLANS.find((plan) => plan.id === id) ?? PLANS[0];
}

export function effectiveMonthly(plan) {
  return plan.totalPrice / plan.months;
}

// Honest saving versus paying the monthly plan for the same number of months.
export function savingsPercentVsMonthly(plan) {
  const monthly = planById("monthly");
  if (plan.id === "monthly") return 0;
  const fullPrice = monthly.totalPrice * plan.months;
  return (fullPrice - plan.totalPrice) / fullPrice;
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function trialEndDate(startDate = new Date()) {
  return addDays(startDate, TRIAL_DAYS);
}

// First billing date: end of trial when a trial applies, otherwise immediately.
export function firstBillingDate(startDate = new Date(), { withTrial = true } = {}) {
  return withTrial ? trialEndDate(startDate) : new Date(startDate);
}

export function createSubscription(planId, { withTrial = true, now = new Date() } = {}) {
  const billing = firstBillingDate(now, { withTrial });
  return {
    status: withTrial ? "trial" : "active",
    planId,
    startedAt: now.toISOString(),
    trialEnd: withTrial ? trialEndDate(now).toISOString() : null,
    nextBillingDate: billing.toISOString(),
    canceledAt: null,
    accessUntil: null,
  };
}

export function cancelSubscription(subscription, { now = new Date() } = {}) {
  const plan = planById(subscription.planId);
  const accessUntil = subscription.status === "trial"
    ? subscription.trialEnd
    : addMonths(new Date(subscription.startedAt ?? now), plan.months).toISOString();
  return { ...subscription, status: "canceled", canceledAt: now.toISOString(), accessUntil };
}

// Entitlement = the app is unlocked. A canceled subscription keeps access until
// the end of the period already paid for.
export function hasEntitlement(subscription, now = new Date()) {
  if (!subscription || subscription.status === "none") return false;
  if (subscription.status === "trial" || subscription.status === "active") return true;
  if (subscription.status === "canceled") {
    return subscription.accessUntil ? new Date(subscription.accessUntil) > now : false;
  }
  return false;
}

export const EMPTY_SUBSCRIPTION = {
  status: "none",
  planId: null,
  startedAt: null,
  trialEnd: null,
  nextBillingDate: null,
  canceledAt: null,
  accessUntil: null,
};
