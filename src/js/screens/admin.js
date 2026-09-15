// Protected admin area — reachable only at #/admin, never linked from the
// consumer navigation. The guard here is a prototype simulation; production
// requires server-enforced authorization.
import { getState, setState } from "../state/store.js";
import { navigate, registerRoute, refresh } from "../router.js";
import { RESOURCE_CATEGORY_IDS, RESOURCE_SOURCE_IDS, ADMIN_MOCK_STATS, ADMIN_MOCK_SUBSCRIPTIONS } from "../lib/mockData.js";
import { planById } from "../lib/subscription.js";
import { el, renderSelect, renderToggle } from "../components/widgets.js";
import { openConfirmDialog, showToast } from "../components/overlay.js";
import { t, LOCALES, fmtInt } from "../i18n/index.js";

const ADMIN_PASSWORD = "forja-admin";
const SESSION_KEY = "forja_admin_session";

let tab = "overview";
let search = "";
let filterCategory = "all";
let filterStatus = "all";
let editingId = null;

function isSignedIn() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function setSignedIn(value) {
  try {
    if (value) sessionStorage.setItem(SESSION_KEY, "1");
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // sessionStorage unavailable — the guard simply stays closed
  }
}

function renderAdmin() {
  const shell = el("div", { class: "admin-shell" });
  if (!isSignedIn()) return renderLogin(shell);

  shell.appendChild(el("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:var(--space-3)" }, [
    el("h1", { text: t("admin.title") }),
    el("button", {
      class: "btn-ghost", type: "button", text: t("admin.signOut"),
      onClick: () => { setSignedIn(false); refresh(); },
    }),
  ]));

  const tabs = el("div", { class: "admin-tabs", role: "tablist" });
  for (const id of ["overview", "resources", "subscriptions"]) {
    tabs.appendChild(el("button", {
      class: `pill${tab === id ? " pill-active" : ""}`,
      type: "button",
      role: "tab",
      "aria-selected": String(tab === id),
      text: t(`admin.tabs.${id}`),
      onClick: () => { tab = id; editingId = null; refresh(); },
    }));
  }
  shell.appendChild(tabs);

  if (tab === "overview") shell.appendChild(renderOverview());
  else if (tab === "resources") shell.appendChild(renderResourcesAdmin());
  else shell.appendChild(renderSubscriptionsAdmin());

  shell.appendChild(el("button", {
    class: "btn btn-quiet",
    type: "button",
    style: "margin-top:var(--space-8)",
    text: t("nav.today"),
    onClick: () => navigate("/today"),
  }));

  return shell;
}

function renderLogin(shell) {
  shell.appendChild(el("h1", { text: t("admin.loginTitle") }));
  shell.appendChild(el("p", { class: "lede text-small", style: "margin-top:var(--space-3)", text: t("admin.loginSub") }));

  const input = el("input", { class: "input", type: "password", id: "admin-password", "data-field": "admin-password" });
  const error = el("div", { class: "field-error", style: "display:none" });

  function submit() {
    if (input.value === ADMIN_PASSWORD) {
      setSignedIn(true);
      refresh();
    } else {
      error.textContent = t("admin.wrongPassword");
      error.style.display = "block";
      input.classList.add("invalid");
    }
  }
  input.addEventListener("keydown", (event) => { if (event.key === "Enter") submit(); });

  shell.appendChild(el("div", { class: "field", style: "margin-top:var(--space-6)" }, [
    el("label", { class: "field-label", for: "admin-password", text: t("admin.password") }),
    input,
    el("div", { class: "field-hint", text: t("admin.passwordHint") }),
    error,
  ]));
  shell.appendChild(el("button", { class: "btn btn-primary", type: "button", text: t("admin.signIn"), onClick: submit }));
  return shell;
}

function renderOverview() {
  const state = getState();
  const wrap = el("div");
  wrap.appendChild(el("div", { class: "notice notice-warn", text: t("admin.mockNotice") }));

  const stats = [
    ["totalUsers", ADMIN_MOCK_STATS.totalUsers],
    ["trialUsers", ADMIN_MOCK_STATS.trialUsers],
    ["activeSubs", ADMIN_MOCK_STATS.activeSubs],
    ["canceledSubs", ADMIN_MOCK_STATS.canceledSubs],
    ["expiredSubs", ADMIN_MOCK_STATS.expiredSubs],
    ["resourceCount", (state.resources ?? []).length],
  ];

  const grid = el("div", { class: "stat-grid", style: "margin-top:var(--space-4)" });
  for (const [key, value] of stats) {
    grid.appendChild(el("div", { class: "stat-card" }, [
      el("div", { class: "stat-label", text: t(`admin.overview.${key}`) }),
      el("div", { class: "stat-value", text: fmtInt(value) }),
    ]));
  }
  wrap.appendChild(grid);
  return wrap;
}

// ---------------- Resources CRUD ----------------
function renderResourcesAdmin() {
  const state = getState();
  const wrap = el("div");

  if (editingId !== null) return renderResourceForm(editingId);

  wrap.appendChild(el("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:var(--space-3)" }, [
    el("h2", { style: "font-size:16px", text: t("admin.resources.title") }),
    el("button", { class: "btn-ghost", type: "button", text: t("admin.resources.new"), onClick: () => { editingId = "new"; refresh(); } }),
  ]));

  const searchInput = el("input", {
    class: "input", type: "search", id: "admin-search", "data-field": "admin-search",
    placeholder: t("admin.resources.search"), value: search,
  });
  searchInput.addEventListener("input", () => {
    search = searchInput.value;
    drawList();
  });
  wrap.appendChild(el("div", { class: "field", style: "margin-top:var(--space-4)" }, [searchInput]));

  wrap.appendChild(el("div", { class: "field-row" }, [
    el("div", { class: "field" }, [
      el("span", { class: "field-label", text: t("admin.resources.filterCategory") }),
      renderSelect({
        value: filterCategory,
        title: t("admin.resources.filterCategory"),
        options: [{ value: "all", label: t("common.all") }, ...RESOURCE_CATEGORY_IDS.map((id) => ({ value: id, label: t(`resources.categories.${id}`) }))],
        onChange: (value) => { filterCategory = value; refresh(); },
      }),
    ]),
    el("div", { class: "field" }, [
      el("span", { class: "field-label", text: t("admin.resources.filterStatus") }),
      renderSelect({
        value: filterStatus,
        title: t("admin.resources.filterStatus"),
        options: [
          { value: "all", label: t("common.all") },
          { value: "active", label: t("admin.resources.active") },
          { value: "inactive", label: t("admin.resources.inactive") },
        ],
        onChange: (value) => { filterStatus = value; refresh(); },
      }),
    ]),
  ]));

  const list = el("div", { class: "panel", style: "margin-top:var(--space-4)" });
  wrap.appendChild(list);

  function drawList() {
    const resources = [...(getState().resources ?? [])]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .filter((resource) => {
        const haystack = `${resource.title["pt-BR"]} ${resource.title["en-US"]} ${resource.url}`.toLowerCase();
        if (search && !haystack.includes(search.toLowerCase())) return false;
        if (filterCategory !== "all" && resource.category !== filterCategory) return false;
        if (filterStatus === "active" && !resource.active) return false;
        if (filterStatus === "inactive" && resource.active) return false;
        return true;
      });

    list.innerHTML = "";
    if (!resources.length) {
      list.appendChild(el("div", { class: "empty-state", text: t("admin.resources.empty") }));
      return;
    }

    for (const resource of resources) {
      list.appendChild(el("div", { style: "padding:var(--space-3) 0" }, [
        el("div", { style: "display:flex;justify-content:space-between;gap:var(--space-3)" }, [
          el("div", { style: "min-width:0" }, [
            el("div", { class: "text-small", text: resource.title["pt-BR"] }),
            el("div", { class: "text-micro text-tertiary mono", style: "word-break:break-all", text: resource.url }),
            el("div", { class: "text-micro text-tertiary", text: `${t(`resources.categories.${resource.category}`)} · ${resource.language} · #${resource.order}` }),
          ]),
          el("span", {
            class: `pill pill-static${resource.active ? " pill-active" : ""}`,
            text: resource.active ? t("admin.resources.active") : t("admin.resources.inactive"),
          }),
        ]),
        el("div", { class: "admin-row-actions", style: "margin-top:var(--space-2)" }, [
          el("button", { class: "btn-ghost", type: "button", text: t("common.edit"), onClick: () => { editingId = resource.id; refresh(); } }),
          el("button", { class: "btn-ghost", type: "button", text: t("admin.resources.openLink"), onClick: () => window.open(resource.url, "_blank", "noopener,noreferrer") }),
          el("button", { class: "btn-ghost", type: "button", text: t("admin.resources.moveUp"), onClick: () => move(resource.id, -1) }),
          el("button", { class: "btn-ghost", type: "button", text: t("admin.resources.moveDown"), onClick: () => move(resource.id, 1) }),
          el("button", {
            class: "btn-ghost", type: "button", style: "color:var(--rust-error)", text: t("common.delete"),
            onClick: () => openConfirmDialog({
              title: t("admin.resources.deleteConfirmTitle"),
              body: t("admin.resources.deleteConfirmBody"),
              confirmLabel: t("common.delete"),
              danger: true,
              onConfirm: () => {
                setState((s) => ({ ...s, resources: s.resources.filter((item) => item.id !== resource.id) }));
                showToast(t("toast.deleted"));
                refresh();
              },
            }),
          }),
        ]),
      ]));
    }
  }
  drawList();
  return wrap;
}

function move(id, delta) {
  setState((state) => {
    const sorted = [...state.resources].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const index = sorted.findIndex((resource) => resource.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= sorted.length) return state;
    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    return { ...state, resources: sorted.map((resource, position) => ({ ...resource, order: position + 1 })) };
  });
  refresh();
}

function renderResourceForm(id) {
  const state = getState();
  const isNew = id === "new";
  const existing = isNew ? null : state.resources.find((resource) => resource.id === id);
  const draft = existing
    ? { ...existing, title: { ...existing.title } }
    : {
        id: `r_${Date.now()}`,
        title: { "pt-BR": "", "en-US": "" },
        category: "study",
        source: "article",
        durationMin: 5,
        language: "pt-BR",
        url: "https://",
        order: (state.resources?.length ?? 0) + 1,
        active: true,
      };

  const wrap = el("div");
  wrap.appendChild(el("h2", { style: "font-size:16px", text: isNew ? t("admin.resources.new") : t("admin.resources.edit") }));

  const titlePt = textField("res-title-pt", t("admin.resources.fieldTitlePt"), draft.title["pt-BR"], (value) => { draft.title["pt-BR"] = value; });
  const titleEn = textField("res-title-en", t("admin.resources.fieldTitleEn"), draft.title["en-US"], (value) => { draft.title["en-US"] = value; });
  const url = textField("res-url", t("admin.resources.fieldUrl"), draft.url, (value) => { draft.url = value; });
  const duration = textField("res-duration", t("admin.resources.fieldDuration"), String(draft.durationMin), (value) => { draft.durationMin = Number(value) || 0; }, "number");
  const order = textField("res-order", t("admin.resources.fieldOrder"), String(draft.order), (value) => { draft.order = Number(value) || 1; }, "number");

  wrap.appendChild(titlePt.field);
  wrap.appendChild(titleEn.field);
  wrap.appendChild(url.field);

  wrap.appendChild(el("div", { class: "field-grid" }, [
    el("div", { class: "field" }, [
      el("span", { class: "field-label", text: t("admin.resources.fieldCategory") }),
      renderSelect({
        value: draft.category,
        title: t("admin.resources.fieldCategory"),
        options: RESOURCE_CATEGORY_IDS.map((category) => ({ value: category, label: t(`resources.categories.${category}`) })),
        onChange: (value) => { draft.category = value; },
      }),
    ]),
    el("div", { class: "field" }, [
      el("span", { class: "field-label", text: t("admin.resources.fieldSource") }),
      renderSelect({
        value: draft.source,
        title: t("admin.resources.fieldSource"),
        options: RESOURCE_SOURCE_IDS.map((source) => ({ value: source, label: t(`resources.sources.${source}`) })),
        onChange: (value) => { draft.source = value; },
      }),
    ]),
    el("div", { class: "field" }, [
      el("span", { class: "field-label", text: t("admin.resources.fieldLanguage") }),
      renderSelect({
        value: draft.language,
        title: t("admin.resources.fieldLanguage"),
        options: LOCALES.map((locale) => ({ value: locale, label: locale })),
        onChange: (value) => { draft.language = value; },
      }),
    ]),
    duration.field,
    order.field,
  ]));

  wrap.appendChild(el("div", { class: "panel" }, [
    el("div", { class: "settings-row" }, [
      el("div", { class: "settings-row-main" }, [el("div", { class: "settings-row-label", text: t("admin.resources.fieldActive") })]),
      renderToggle(draft.active, (value) => { draft.active = value; }, { label: t("admin.resources.fieldActive") }),
    ]),
  ]));

  const formError = el("div", { class: "field-error", style: "display:none" });
  wrap.appendChild(formError);

  wrap.appendChild(el("div", { class: "actions" }, [
    el("button", {
      class: "btn btn-primary",
      type: "button",
      text: t("common.save"),
      onClick: () => {
        if (!draft.title["pt-BR"].trim()) {
          formError.textContent = t("admin.resources.titleRequired");
          formError.style.display = "block";
          return;
        }
        if (!isValidUrl(draft.url)) {
          formError.textContent = t("admin.resources.invalidUrl");
          formError.style.display = "block";
          return;
        }
        setState((s) => {
          const resources = existing
            ? s.resources.map((resource) => (resource.id === draft.id ? draft : resource))
            : [...s.resources, draft];
          return { ...s, resources };
        });
        editingId = null;
        showToast(t("admin.resources.saved"));
        refresh();
      },
    }),
    el("button", { class: "btn btn-quiet", type: "button", text: t("common.cancel"), onClick: () => { editingId = null; refresh(); } }),
  ]));

  return wrap;
}

function textField(id, label, value, onInput, type = "text") {
  const input = el("input", { class: type === "number" ? "input mono" : "input", type, id, "data-field": id, value });
  input.addEventListener("input", () => onInput(input.value));
  return {
    input,
    field: el("div", { class: "field" }, [el("label", { class: "field-label", for: id, text: label }), input]),
  };
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function renderSubscriptionsAdmin() {
  const wrap = el("div");
  wrap.appendChild(el("h2", { style: "font-size:16px", text: t("admin.subscriptions.title") }));
  wrap.appendChild(el("div", { class: "notice notice-warn", style: "margin-top:var(--space-3)", text: t("admin.subscriptions.notice") }));

  const table = el("table", { class: "admin-table" });
  table.innerHTML = `
    <thead><tr>
      <th>${t("admin.subscriptions.user")}</th>
      <th>${t("admin.subscriptions.plan")}</th>
      <th>${t("admin.subscriptions.status")}</th>
      <th>${t("admin.subscriptions.renews")}</th>
    </tr></thead>
  `;
  const tbody = el("tbody");
  for (const row of ADMIN_MOCK_SUBSCRIPTIONS) {
    tbody.appendChild(el("tr", {}, [
      el("td", { class: "mono", text: row.user }),
      el("td", { text: t(`subscriptionPlans.${planById(row.planId).id}`) }),
      el("td", { text: t(`admin.subscriptions.statuses.${row.status}`) }),
      el("td", { class: "mono", text: row.renews }),
    ]));
  }
  table.appendChild(tbody);
  wrap.appendChild(el("div", { class: "table-scroll", style: "margin-top:var(--space-4)" }, [table]));
  return wrap;
}

export function registerAdminRoutes() {
  registerRoute("/admin", renderAdmin);
}
