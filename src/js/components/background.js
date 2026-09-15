// Ambient forge background, sparks, and the forge-strike moment.
// Everything mounts INSIDE #app-frame so no effect ever renders outside the
// real mobile viewport. Pure CSS/DOM — no canvas, no video, no particle library.
import { haptic } from "../platform/native.js";

const PARTICLE_COUNT = 9; // within the 6-12 range from the design spec
const MAX_LIVE_SPARKS = 24; // hard cap so rapid taps cannot flood the layer

let bgEl = null;
let sparkLayer = null;
let liveSparks = 0;

export function prefersReducedMotion() {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.getAttribute("data-reduced-motion") === "true"
  );
}

export function mountForgeBackground(frameEl) {
  if (bgEl) return bgEl;

  bgEl = document.createElement("div");
  bgEl.className = "forge-bg";
  bgEl.id = "forge-bg";
  bgEl.setAttribute("aria-hidden", "true");
  frameEl.prepend(bgEl);

  sparkLayer = document.createElement("div");
  sparkLayer.className = "spark-layer";
  sparkLayer.setAttribute("aria-hidden", "true");
  frameEl.appendChild(sparkLayer);

  buildParticles();

  document.addEventListener("visibilitychange", () => {
    const playState = document.hidden ? "paused" : "running";
    bgEl.querySelectorAll(".ember-particle").forEach((particle) => {
      particle.style.animationPlayState = playState;
    });
  });

  return bgEl;
}

function buildParticles() {
  if (!bgEl) return;
  bgEl.querySelectorAll(".ember-particle").forEach((particle) => particle.remove());
  if (prefersReducedMotion()) return;

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const particle = document.createElement("div");
    particle.className = "ember-particle";
    particle.style.left = `${10 + Math.random() * 80}%`;
    particle.style.setProperty("--drift", `${(Math.random() - 0.5) * 36}px`);
    particle.style.animationDuration = `${6 + Math.random() * 5}s`;
    particle.style.animationDelay = `${Math.random() * 7}s`;
    bgEl.appendChild(particle);
  }
}

// Called when the reduced-motion preference changes at runtime.
export function refreshBackgroundMotion() {
  buildParticles();
}

// The heated area grows with the Heat Score. In reduced motion this is the only
// heat feedback, so it must keep working there too.
export function updateBackgroundHeat(score) {
  if (!bgEl) return;
  const intensity = Math.max(0.05, Math.min(0.24, 0.05 + (score / 100) * 0.19));
  const spread = 95 + (score / 100) * 45;
  bgEl.style.background = `radial-gradient(${spread}% 80% at 50% 14%, rgba(255, 90, 31, ${intensity}), transparent 58%), var(--bg-obsidian)`;
}

// Heat wave travelling toward the ring after a completion.
export function triggerHeatPulse({ strong = false } = {}) {
  if (!bgEl) return;
  if (prefersReducedMotion()) {
    // Static brightness step instead of motion.
    bgEl.classList.add("static-flash");
    setTimeout(() => bgEl.classList.remove("static-flash"), 260);
    return;
  }
  bgEl.classList.remove("heatwave");
  void bgEl.offsetWidth;
  bgEl.classList.add("heatwave");
  setTimeout(() => bgEl.classList.remove("heatwave"), strong ? 800 : 520);
}

// 3-6 short-lived sparks near the control that was completed.
export function emitSparks(originEl, { count = 5 } = {}) {
  if (!sparkLayer || !originEl || prefersReducedMotion()) return;
  const frame = sparkLayer.getBoundingClientRect();
  const rect = originEl.getBoundingClientRect();
  const originX = rect.left - frame.left + rect.width / 2;
  const originY = rect.top - frame.top + rect.height / 2;
  const total = Math.min(6, Math.max(3, count));

  for (let i = 0; i < total; i += 1) {
    if (liveSparks >= MAX_LIVE_SPARKS) return;
    liveSparks += 1;
    const spark = document.createElement("div");
    spark.className = "spark";
    spark.style.left = `${originX}px`;
    spark.style.top = `${originY}px`;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const distance = 18 + Math.random() * 26;
    spark.style.setProperty("--sx", `${Math.cos(angle) * distance}px`);
    spark.style.setProperty("--sy", `${Math.sin(angle) * distance}px`);
    spark.style.animationDelay = `${Math.random() * 60}ms`;
    sparkLayer.appendChild(spark);
    setTimeout(() => {
      spark.remove();
      liveSparks -= 1;
    }, 560);
  }
}

// One restrained forge-strike when the final scheduled goal of the day is done.
export function forgeStrike(targetEl) {
  if (!sparkLayer) return;
  if (prefersReducedMotion()) {
    triggerHeatPulse({ strong: true });
    haptic("medium");
    return;
  }

  const frame = sparkLayer.getBoundingClientRect();
  const rect = targetEl?.getBoundingClientRect();
  const centerX = rect ? rect.left - frame.left + rect.width / 2 : frame.width / 2;
  const centerY = rect ? rect.top - frame.top + rect.height / 2 : frame.height / 3;

  const strike = document.createElement("div");
  strike.className = "forge-strike";
  strike.style.left = `${centerX - 110}px`;
  strike.style.top = `${centerY - 110}px`;
  strike.style.width = "220px";
  strike.style.height = "220px";
  strike.style.inset = "auto";
  strike.innerHTML = `
    <div class="strike-flash"></div>
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <path d="M74 20 L100 46 L86 60 L60 34 Z" fill="rgba(244,241,234,0.16)" stroke="rgba(255,193,87,0.65)" stroke-width="1.5"/>
      <rect x="30" y="52" width="34" height="9" rx="2" transform="rotate(45 30 52)" fill="rgba(244,241,234,0.10)" stroke="rgba(255,193,87,0.45)" stroke-width="1.2"/>
    </svg>
  `;
  sparkLayer.appendChild(strike);
  triggerHeatPulse({ strong: true });
  haptic("success");
  setTimeout(() => strike.remove(), 700);
}
