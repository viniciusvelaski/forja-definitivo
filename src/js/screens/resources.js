import { getState, setState, logEvent } from "../state/store.js";
import { navigate, registerRoute, refresh } from "../router.js";
import { RESOURCE_CATEGORY_IDS } from "../lib/mockData.js";
import { el, withBottomNav, sectionHeading, ICONS } from "../components/widgets.js";
import { updateBackgroundHeat } from "../components/background.js";
import { displayedHeatScore } from "../lib/dayEngine.js";
import { openExternal } from "../platform/native.js";
import { t, getLocale, fmtInt } from "../i18n/index.js";

let activeCategory = "all";

function resourceTitle(resource) {
  return resource.title[getLocale()] ?? resource.title["pt-BR"];
}

function activeResources(state) {
  return (state.resources ?? []).filter((resource) => resource.active).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// No recommendation engine: category match plus simple day-based rotation.
function suggestedResource(state) {
  const preferred = state.profile.preferredResourceCategory ?? "study";
  const pool = activeResources(state).filter((resource) => resource.category === preferred);
  const list = pool.length ? pool : activeResources(state);
  if (!list.length) return null;
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return list[dayOfYear % list.length];
}

function renderResources() {
  const state = getState();
  updateBackgroundHeat(displayedHeatScore(state));

  const content = el("div", { class: "screen" });
  content.appendChild(el("h1", { class: "display", text: t("resources.title") }));

  const suggestion = suggestedResource(state);
  if (suggestion) {
    content.appendChild(el("div", { class: "card card-gold", style: "margin-top:var(--space-5)" }, [
      el("div", { class: "eyebrow text-gold", text: t("resources.suggested") }),
      el("div", { style: "margin-top:var(--space-2);font-size:14px;line-height:1.35", text: resourceTitle(suggestion) }),
      el("button", {
        class: "btn btn-secondary",
        type: "button",
        style: "margin-top:var(--space-3)",
        onClick: () => openResource(suggestion),
      }, [el("span", { text: t("resources.openExternal") }), el("span", { html: ICONS.external })]),
    ]));
  }

  const filters = el("div", { class: "pill-scroll", style: "margin-top:var(--space-6)", role: "group", "aria-label": t("resources.title") });
  const categories = [{ id: "all", label: t("common.all") }, ...RESOURCE_CATEGORY_IDS.map((id) => ({ id, label: t(`resources.categories.${id}`) }))];
  for (const category of categories) {
    const isActive = activeCategory === category.id;
    filters.appendChild(el("button", {
      class: `pill${isActive ? " pill-active" : ""}`,
      type: "button",
      "aria-pressed": String(isActive),
      text: category.label,
      onClick: () => { activeCategory = category.id; refresh(); },
    }));
  }
  content.appendChild(filters);

  const list = activeResources(state).filter((resource) => activeCategory === "all" || resource.category === activeCategory);
  if (!list.length) {
    content.appendChild(el("div", { class: "empty-state", text: t("resources.empty") }));
  } else {
    const panel = el("div", { class: "panel", style: "margin-top:var(--space-4)" });
    for (const resource of list) {
      panel.appendChild(el("div", { class: "resource-item" }, [
        el("div", { class: "resource-title", text: resourceTitle(resource) }),
        el("div", { class: "resource-meta" }, [
          el("span", { text: t(`resources.categories.${resource.category}`) }),
          el("span", { text: t("resources.duration", { minutes: fmtInt(resource.durationMin) }) }),
          el("span", { text: t(`resources.sources.${resource.source}`) }),
        ]),
        el("button", {
          class: "btn btn-quiet",
          type: "button",
          style: "margin-top:var(--space-2)",
          onClick: () => openResource(resource),
        }, [el("span", { text: t("resources.openExternal") }), el("span", { html: ICONS.external })]),
      ]));
    }
    content.appendChild(panel);
  }

  content.appendChild(el("p", { class: "text-micro text-tertiary", style: "margin-top:var(--space-6)", text: t("resources.externalNote") }));

  return withBottomNav(content, "resources", navigate);
}

function openResource(resource) {
  setState((state) => ({
    ...state,
    resourcesOpened: [...state.resourcesOpened.slice(-49), { id: resource.id, at: new Date().toISOString() }],
  }), { silent: true });
  logEvent("resource_opened", { id: resource.id });
  // Native builds open the in-app browser; the web falls back to a new tab.
  openExternal(resource.url);
}

export function registerResourcesRoutes() {
  registerRoute("/resources", renderResources);
}
