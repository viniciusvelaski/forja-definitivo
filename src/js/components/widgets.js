// Shared UI kit. Every control here is keyboard accessible, has a >=44px touch
// target, and updates its own visual state immediately on interaction.
import { t, fmtNumber, fmtInt } from "../i18n/index.js";
import { openSelectSheet } from "./overlay.js";
import { unitOf } from "../lib/units.js";

export const ICONS = {
  check: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  chevronRight: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  chevronLeft: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  chevronDown: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  person: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>`,
  plus: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  external: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
};

const NAV_ITEMS = [
  { id: "today", icon: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>` },
  { id: "progress", icon: `<path d="M4 19V9"/><path d="M12 19V5"/><path d="M20 19v-7"/>` },
  { id: "meals", icon: `<path d="M6 3v7a3 3 0 0 0 6 0V3"/><path d="M9 10v11"/><path d="M18 3c-1.5 2-2 4-2 7h4c0-3-.5-5-2-7z"/><path d="M18 10v11"/>` },
  { id: "resources", icon: `<path d="M4 5a2 2 0 0 1 2-2h11l3 3v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 8h7M8 12h7M8 16h5"/>` },
  { id: "profile", icon: `<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/>` },
];

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    if (key === "class") node.className = value;
    else if (key === "html") node.innerHTML = value;
    else if (key === "text") node.textContent = value;
    else if (key === "style") node.setAttribute("style", value);
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function sectionHeading(label, action) {
  return el("div", { class: "section-heading" }, [el("span", { text: label }), action ?? null]);
}

export function renderTopBar({ title, onBack, right }) {
  const bar = el("div", { class: "top-bar" });
  if (onBack) {
    bar.appendChild(el("button", {
      class: "icon-btn",
      type: "button",
      "aria-label": t("common.back"),
      html: ICONS.chevronLeft,
      onClick: onBack,
    }));
  } else {
    bar.appendChild(el("span", { style: "width:44px" }));
  }
  bar.appendChild(el("h1", { text: title }));
  bar.appendChild(right ?? el("span", { style: "width:44px" }));
  return bar;
}

export function renderBottomNav(activeId, onNavigate) {
  const nav = el("nav", { class: "bottom-nav", "aria-label": t("nav.today") });
  for (const item of NAV_ITEMS) {
    const isActive = item.id === activeId;
    const button = el("button", {
      class: `nav-item${isActive ? " active" : ""}`,
      type: "button",
      "aria-current": isActive ? "page" : null,
      onClick: () => onNavigate(`/${item.id}`),
    }, [
      el("span", { html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>` }),
      el("span", { text: t(`nav.${item.id}`) }),
    ]);
    nav.appendChild(button);
  }
  return nav;
}

export function withBottomNav(content, activeId, onNavigate) {
  const wrap = el("div", { style: "display:contents" });
  wrap.appendChild(content);
  wrap.appendChild(renderBottomNav(activeId, onNavigate));
  return wrap;
}

// Flips its own visual state instantly, then persists — no waiting for a reload.
export function renderToggle(isOn, onChange, { label } = {}) {
  const toggle = el("div", {
    class: `toggle${isOn ? " on" : ""}`,
    role: "switch",
    tabindex: "0",
    "aria-checked": String(isOn),
    "aria-label": label,
  }, [el("div", { class: "toggle-knob" })]);

  let state = isOn;
  function flip() {
    state = !state;
    toggle.classList.toggle("on", state);
    toggle.setAttribute("aria-checked", String(state));
    onChange(state);
  }
  toggle.addEventListener("click", flip);
  toggle.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      flip();
    }
  });
  return toggle;
}

// Styled select: opens the in-frame sheet instead of a native dropdown that
// would break the visual system and can render outside the viewport.
export function renderSelect({ value, options, onChange, title, compact = false, id }) {
  const current = options.find((option) => option.value === value);
  const trigger = el("button", {
    class: `select-trigger${compact ? " select-compact" : ""}`,
    type: "button",
    id,
    "aria-haspopup": "listbox",
  }, [
    el("span", { class: "select-value", text: current?.label ?? t("common.select") }),
    el("span", { class: "select-caret", html: ICONS.chevronDown }),
  ]);

  trigger.addEventListener("click", () => {
    openSelectSheet({
      title: title ?? t("common.select"),
      options,
      value,
      onSelect: (next) => onChange(next),
    });
  });
  return trigger;
}

// Minus / numeric field / plus, plus an optional slider — all bound to the same
// value so they can never drift apart.
export function renderStepper({ value, min = 0, max = 100, step = 1, decimals = 0, unitLabel = "", onChange, labelId }) {
  let current = value;

  const minusBtn = el("button", { class: "stepper-btn", type: "button", "aria-label": t("goal.decrease"), text: "−" });
  const plusBtn = el("button", { class: "stepper-btn", type: "button", "aria-label": t("goal.increase"), text: "+" });
  const input = el("input", {
    class: "input stepper-input",
    type: "number",
    inputmode: "decimal",
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(value),
    "aria-labelledby": labelId,
  });

  const slider = el("input", {
    class: "slider",
    type: "range",
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(value),
    "aria-labelledby": labelId,
  });

  const readout = el("div", { class: "text-micro text-tertiary mono", style: "text-align:center;margin-top:4px" });

  function clamp(next) {
    const bounded = Math.max(min, Math.min(max, next));
    const factor = 10 ** decimals;
    return Math.round(bounded * factor) / factor;
  }

  function apply(next, { fromInput = false } = {}) {
    current = clamp(next);
    if (!fromInput) input.value = String(current);
    slider.value = String(current);
    slider.style.setProperty("--fill", `${max > min ? ((current - min) / (max - min)) * 100 : 0}%`);
    minusBtn.disabled = current <= min;
    plusBtn.disabled = current >= max;
    readout.textContent = `${fmtNumber(current, { maximumFractionDigits: decimals })} / ${fmtNumber(max, { maximumFractionDigits: decimals })} ${unitLabel}`.trim();
    onChange(current);
  }

  minusBtn.addEventListener("click", () => apply(current - step));
  plusBtn.addEventListener("click", () => apply(current + step));
  slider.addEventListener("input", () => apply(Number(slider.value)));
  input.addEventListener("input", () => {
    if (input.value === "") return;
    apply(Number(input.value), { fromInput: true });
  });
  input.addEventListener("blur", () => apply(Number(input.value) || min));

  const row = el("div", { class: "stepper" }, [minusBtn, el("div", { class: "stepper-value" }, [input]), plusBtn]);
  const wrap = el("div", {}, [row, el("div", { style: "margin-top:var(--space-3)" }, [slider]), readout]);
  apply(value);
  wrap.setValue = (next) => apply(next);
  return wrap;
}

// goal row used on Today. `display` carries the already-localized strings.
export function renderGoalRow({ goal, display, onToggle, onOpen, onQuickAdd }) {
  const row = el("div", { class: "goal-row" });
  const label = goalTitle(goal);

  if (goal.type === "binary") {
    const check = el("button", {
      class: `goal-check${display.done ? " done" : ""}`,
      type: "button",
      role: "checkbox",
      "aria-checked": String(display.done),
      "aria-label": label,
      html: display.done ? ICONS.check : "",
    });
    check.addEventListener("click", (event) => {
      event.stopPropagation();
      onToggle?.(goal, check);
    });
    row.appendChild(check);
  }

  const info = el("div", { class: "goal-info" }, [
    el("div", { class: `goal-title${display.done ? " done" : ""}`, text: label }),
    el("div", { class: "goal-meta" }, display.meta.map((chunk) =>
      el("span", { class: chunk.tone === "paused" ? "paused-tag" : "", text: chunk.text })
    )),
  ]);

  if (goal.type === "quantitative") {
    const bar = el("div", { class: "goal-bar" }, [
      el("div", {
        class: `goal-bar-fill${display.done ? " complete" : ""}`,
        style: `width:${Math.round(display.ratio * 100)}%`,
      }),
    ]);
    info.appendChild(bar);
  }

  const hit = el("button", {
    class: "goal-hit",
    type: "button",
    "aria-label": `${label} — ${t("common.edit")}`,
    onClick: () => onOpen?.(goal),
  }, [info, el("span", { class: "row-chevron", html: ICONS.chevronRight })]);
  row.appendChild(hit);

  if (goal.type === "quantitative" && onQuickAdd) {
    const quick = el("button", {
      class: "stepper-btn",
      type: "button",
      "aria-label": `${t("goal.increase")} — ${label}`,
      text: "+",
    });
    quick.addEventListener("click", (event) => {
      event.stopPropagation();
      onQuickAdd(goal, quick);
    });
    row.appendChild(quick);
  }

  return row;
}

export function renderWeeklyChart(days) {
  const chart = el("div", { class: "weekly-chart", role: "img", "aria-label": t("progress.thisWeek") });
  for (const day of days) {
    const height = day.ratio == null ? 3 : Math.max(4, day.ratio * 100);
    let fillClass = "empty";
    if (day.ratio != null && day.ratio >= 1) fillClass = "full";
    else if (day.ratio != null && day.ratio > 0) fillClass = "partial";

    const column = el("div", { class: "chart-col", title: day.ariaLabel }, [
      el("div", { class: "chart-value", text: day.valueLabel }),
      el("div", { class: "chart-bar-track" }, [
        el("div", {
          class: `chart-bar-fill ${fillClass}${day.isToday ? " today" : ""}`,
          style: `height:${day.ratio == null ? 4 : height}%`,
        }),
      ]),
      el("div", { class: `chart-label${day.isToday ? " today" : ""}`, text: day.label }),
    ]);
    column.appendChild(el("span", { class: "sr-only", text: day.ariaLabel }));
    chart.appendChild(column);
  }
  return chart;
}

export function renderChartLegend() {
  const legend = el("div", { class: "chart-legend" });
  const items = [
    { className: "full", label: t("progress.complete") },
    { className: "partial", label: t("progress.partial") },
    { className: "empty", label: t("progress.empty") },
  ];
  for (const item of items) {
    legend.appendChild(el("span", { class: "legend-item" }, [
      el("span", { class: `legend-swatch chart-bar-fill ${item.className}`, style: "height:8px" }),
      el("span", { text: item.label }),
    ]));
  }
  return legend;
}

export function renderNotificationPreview({ text, time }) {
  return el("div", { class: "card card-elevated", style: "display:flex;gap:var(--space-3);align-items:flex-start" }, [
    el("div", {
      style: "width:30px;height:30px;border-radius:8px;background:var(--ember-orange);color:var(--text-on-ember);display:flex;align-items:center;justify-content:center;font-family:var(--font-heading);font-size:13px;flex:none",
      text: "F",
    }),
    el("div", { style: "flex:1;min-width:0" }, [
      el("div", { style: "font-family:var(--font-heading);font-size:13px", text: t("notifications.title") }),
      el("div", { class: "text-small text-secondary", style: "margin-top:2px", text }),
    ]),
    el("div", { class: "mono text-micro text-tertiary", style: "flex:none", text: time }),
  ]);
}

export function renderAvatar(photo, { size = "sm", onClick, label } = {}) {
  const avatar = el("button", {
    class: `avatar${size === "lg" ? " avatar-lg" : ""}`,
    type: "button",
    "aria-label": label ?? t("today.profileAlt"),
  });
  if (photo) {
    avatar.appendChild(el("img", { src: photo, alt: t("today.avatarAlt") }));
  } else {
    avatar.innerHTML = ICONS.person;
  }
  if (onClick) avatar.addEventListener("click", onClick);
  else avatar.disabled = true;
  return avatar;
}

// Seeded goals follow the interface language; renamed goals keep the user's text.
export function goalTitle(goal) {
  return goal.titleKey ? t(goal.titleKey) : goal.title;
}

export function formatUnitValue(baseValue, unitId) {
  const unit = unitOf(unitId);
  const display = baseValue / unit.factor;
  return unit.decimals === 0 ? fmtInt(display) : fmtNumber(display, { maximumFractionDigits: unit.decimals });
}
