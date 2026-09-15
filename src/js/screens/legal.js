// Draft Terms of Service and Privacy Policy screens.
// The content is clearly labeled as a draft that needs legal review before
// release; in production these are replaced by approved documents at stable
// public HTTPS URLs used by the app, Play Console, and App Store Connect.
import { registerRoute, navigate } from "../router.js";
import { el, renderTopBar } from "../components/widgets.js";
import { t, tList, fmtDateShort } from "../i18n/index.js";

const SOURCE_ROUTES = {
  paywall: "/paywall",
  profile: "/profile",
};

function renderLegal({ doc = "terms", from = "profile" }) {
  const isPrivacy = doc === "privacy";
  const screen = el("div", { class: "screen" });

  screen.appendChild(renderTopBar({
    title: t(isPrivacy ? "legal.privacyTitle" : "legal.termsTitle"),
    onBack: () => navigate(SOURCE_ROUTES[from] ?? "/profile"),
  }));

  screen.appendChild(el("div", { class: "notice notice-warn", text: t("legal.draftNotice") }));
  screen.appendChild(el("p", {
    class: "text-micro text-tertiary mono",
    style: "margin-top:var(--space-3)",
    text: t("legal.lastUpdated", { date: fmtDateShort(new Date()) }),
  }));

  const sections = tList(isPrivacy ? "legal.privacy" : "legal.terms");
  const body = el("div", { style: "margin-top:var(--space-6)" });
  sections.forEach((section, index) => {
    body.appendChild(el("h2", {
      style: `font-size:15px;${index > 0 ? "margin-top:var(--space-6)" : ""}`,
      text: section.h,
    }));
    body.appendChild(el("p", { class: "lede text-small", style: "margin-top:var(--space-2)", text: section.p }));
  });
  screen.appendChild(body);

  screen.appendChild(el("div", { class: "actions" }, [
    el("button", {
      class: "btn btn-secondary",
      type: "button",
      text: t("common.back"),
      onClick: () => navigate(SOURCE_ROUTES[from] ?? "/profile"),
    }),
  ]));

  return screen;
}

export function registerLegalRoutes() {
  registerRoute("/legal", renderLegal);
}
