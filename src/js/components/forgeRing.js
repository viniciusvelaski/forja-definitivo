import { heatState } from "../lib/heatEngine.js";
import { t } from "../i18n/index.js";
import { prefersReducedMotion } from "./background.js";

const STATE_COLORS = {
  "cold-iron": { from: "#5A5A63", to: "#3A3A42", glow: 0 },
  ember: { from: "#B8451A", to: "#FF5A1F", glow: 0.55 },
  "hot-metal": { from: "#FF5A1F", to: "#FF7A3D", glow: 0.8 },
  forged: { from: "#FF6A2A", to: "#FFA24D", glow: 0.95 },
  blazing: { from: "#FF7A3D", to: "#FFC157", glow: 1 },
};

let uid = 0;

// size "lg" (Today) | "sm" (plan preview, compact contexts)
export function renderForgeRing(score, { size = "lg", showMessage = true, animateFrom = null } = {}) {
  const id = `fr${(uid += 1)}`;
  const radius = size === "sm" ? 54 : 78;
  const stroke = size === "sm" ? 8 : 10;
  // Generous padding + overflow:visible is what stops the glow being clipped
  // into a square by the SVG's own render box.
  const glowPad = size === "sm" ? 22 : 30;
  const box = (radius + stroke / 2 + glowPad) * 2;
  const center = box / 2;
  const circumference = 2 * Math.PI * radius;

  const wrap = document.createElement("div");
  wrap.className = `forge-ring-wrap${size === "sm" ? " forge-ring--sm" : ""}`;
  wrap.style.width = `${box}px`;
  wrap.style.height = `${box}px`;

  const ticks = [];
  const tickCount = 12;
  for (let i = 0; i < tickCount; i += 1) {
    const angle = (i / tickCount) * Math.PI * 2 - Math.PI / 2;
    const inner = radius - stroke / 2 - 3;
    const outer = radius - stroke / 2 - 7;
    ticks.push(
      `<line x1="${center + Math.cos(angle) * inner}" y1="${center + Math.sin(angle) * inner}" x2="${center + Math.cos(angle) * outer}" y2="${center + Math.sin(angle) * outer}" stroke="rgba(244,241,234,0.10)" stroke-width="1" />`
    );
  }

  wrap.innerHTML = `
    <svg class="forge-ring-svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" role="img" aria-label="">
      <defs>
        <filter id="${id}-glow" x="-75%" y="-75%" width="250%" height="250%" filterUnits="objectBoundingBox">
          <feGaussianBlur stdDeviation="${size === "sm" ? 5 : 7}" />
        </filter>
        <filter id="${id}-head" x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <linearGradient id="${id}-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#B8451A" />
          <stop offset="100%" stop-color="#FF5A1F" />
        </linearGradient>
      </defs>
      <circle class="forge-ring-groove" cx="${center}" cy="${center}" r="${radius}" stroke-width="${stroke + 4}" />
      <circle class="forge-ring-track" cx="${center}" cy="${center}" r="${radius}" stroke-width="${stroke}" />
      ${ticks.join("")}
      <g transform="rotate(-90 ${center} ${center})">
        <circle class="forge-ring-glow" data-role="glow" cx="${center}" cy="${center}" r="${radius}"
          stroke="url(#${id}-grad)" stroke-width="${stroke + 2}"
          stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}"
          filter="url(#${id}-glow)" />
        <circle class="forge-ring-fill" data-role="fill" cx="${center}" cy="${center}" r="${radius}"
          stroke="url(#${id}-grad)" stroke-width="${stroke}"
          stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" />
      </g>
      <circle data-role="head-glow" cx="${center}" cy="${center - radius}" r="${size === "sm" ? 5 : 7}" fill="#FFC157" filter="url(#${id}-head)" opacity="0" />
      <circle data-role="head" cx="${center}" cy="${center - radius}" r="${size === "sm" ? 2.5 : 3.5}" fill="#FFF1D6" opacity="0" />
    </svg>
    <div class="forge-ring-center">
      <div class="forge-ring-score mono" data-role="score">0</div>
      <div class="forge-ring-state" data-role="state"></div>
      ${showMessage ? '<div class="forge-ring-message" data-role="message"></div>' : ""}
    </div>
  `;

  const svg = wrap.querySelector("svg");
  const glowEl = wrap.querySelector('[data-role="glow"]');
  const fillEl = wrap.querySelector('[data-role="fill"]');
  const headEl = wrap.querySelector('[data-role="head"]');
  const headGlowEl = wrap.querySelector('[data-role="head-glow"]');
  const scoreEl = wrap.querySelector('[data-role="score"]');
  const stateEl = wrap.querySelector('[data-role="state"]');
  const messageEl = wrap.querySelector('[data-role="message"]');
  const gradStops = wrap.querySelectorAll(`#${id}-grad stop`);

  function paint(value) {
    const clamped = Math.max(0, Math.min(100, value));
    const state = heatState(clamped);
    const colors = STATE_COLORS[state];
    const offset = circumference - (clamped / 100) * circumference;

    gradStops[0].setAttribute("stop-color", colors.from);
    gradStops[1].setAttribute("stop-color", colors.to);
    fillEl.setAttribute("stroke-dashoffset", String(offset));
    glowEl.setAttribute("stroke-dashoffset", String(offset));
    glowEl.style.opacity = String(colors.glow * 0.9);

    // Leading ember rides the tip of the filled arc.
    const angle = (clamped / 100) * Math.PI * 2 - Math.PI / 2;
    const hx = center + Math.cos(angle) * radius;
    const hy = center + Math.sin(angle) * radius;
    for (const el of [headEl, headGlowEl]) {
      el.setAttribute("cx", String(hx));
      el.setAttribute("cy", String(hy));
      el.setAttribute("opacity", clamped > 0.5 && colors.glow > 0 ? "1" : "0");
    }

    scoreEl.textContent = String(Math.round(clamped));
    stateEl.textContent = t(`heat.states.${state}`);
    stateEl.style.color = colors.to;
    if (messageEl) messageEl.textContent = t(`heat.messages.${state}`);
    svg.setAttribute("aria-label", t("heat.aria", { score: Math.round(clamped), state: t(`heat.states.${state}`) }));
    svg.classList.toggle("ring-pulse", state === "forged" || state === "blazing");
  }

  const start = animateFrom == null ? score : animateFrom;
  paint(start);

  if (animateFrom != null && animateFrom !== score && !prefersReducedMotion()) {
    animateRing(start, score, paint);
  } else if (animateFrom != null) {
    paint(score);
  }

  wrap.updateScore = (value, { animate = true } = {}) => {
    const from = Number(scoreEl.textContent) || 0;
    if (animate && !prefersReducedMotion()) animateRing(from, value, paint);
    else paint(value);
  };

  return wrap;
}

// 450-700ms interpolation with easing: the fill advances, it never just scales.
function animateRing(from, to, paint) {
  // requestAnimationFrame is frozen while the tab is in the background, which
  // would leave the ring stuck on the old score. Paint the result directly.
  if (document.hidden) {
    paint(to);
    return;
  }

  const duration = 600;
  const startTime = performance.now();
  let settled = false;

  function settle() {
    if (settled) return;
    settled = true;
    paint(to);
  }

  function frame(now) {
    if (settled) return;
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - (1 - progress) ** 3;
    paint(from + (to - from) * eased);
    if (progress < 1) requestAnimationFrame(frame);
    else settle();
  }

  requestAnimationFrame(frame);
  // Safety net for a throttled or interrupted animation frame.
  setTimeout(settle, duration + 150);
}
