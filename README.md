# FORJA — Interactive Prototype (revised)

Locally runnable, high-fidelity prototype of the FORJA MVP. No build step, no package manager, no external services, no AI.

## Stack and why

Plain HTML/CSS/JavaScript (ES modules), served by a small PowerShell static file server (`serve.ps1`).

This machine has no Node.js and no Python, and the prototype does not need either: there is no bundler, no transpiler, and no dependency to install. PowerShell ships with Windows, so the only requirement is a browser. ES modules must be served over HTTP (they cannot be loaded from `file://`), which is the sole reason a server exists at all.

## Run it

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
```

Then open **http://localhost:5180**. A mobile viewport (320–430 px wide) shows the intended layout; in Chrome/Edge press `F12` then `Ctrl+Shift+M`.

To stop the server, press `Ctrl+C` in that PowerShell window.

## Run the tests

Open **http://localhost:5180/tests/** — it runs the deterministic business-rule suite in the browser and prints PASS/FAIL per test.

Covered: plan A/B/C selection and tie-break, Forge Heat scoring and 0–100 boundaries, goal state (scheduling, partial completion, active days, start date), unit conversion and progress steps, nutrition calculations and validation, weekly recommendation rules, subscription pricing/entitlement, recovery milestones and badges, localization key parity and fallback, and state persistence.

## Admin area

Not linked from the app navigation. Open **http://localhost:5180/#/admin** and sign in with the prototype password `forja-admin`. Resource changes made there appear immediately in the app's Resources tab — which is the reason the admin exists: study links change without shipping a new build.

In production this guard must be replaced by server-enforced authorization.

## Language

Primary language is Brazilian Portuguese (`pt-BR`); English (`en-US`) is the secondary locale. First launch follows the device language when it is one of those two, otherwise `pt-BR`. It can be changed in Profile → Idioma, and on the Welcome screen.

Goals created by the plan follow the interface language. As soon as you rename a goal, the title becomes your own text and stops being translated.

## Reset prototype data

Profile → "Sair (limpar dados do protótipo)", or clear `localStorage` for `localhost:5180`.

Note: this revision uses a new state schema (`forja_state_v2`). Data from the previous prototype build is not migrated; it is preserved untouched under the `forja_state_v1_backup` key in case you want to inspect it.

## What is simulated

- **Payments and subscription**: the confirmation sheet imitates the native Google Play / App Store purchase sheet. No card form exists anywhere in the app and no payment data is stored. A trial only starts after explicit confirmation, and the sheet can simulate success, cancellation, trial-ineligible, pending and error outcomes.
- **Notifications**: shown as an in-app preview card only. No OS or push notifications are sent.
- **Learning resources**: real external links (sample `example.com` URLs), opened in a new tab and clearly labeled as leaving the app.
- **Recovery sharing**: uses the Web Share API when the device provides it, with copy-to-clipboard and PNG download as fallbacks.
- **Admin metrics**: the dashboard counts are fixed mock numbers, labeled as such. The resource list is real and persisted.
- **All data**: `localStorage` on this device only. Nothing is sent to a server.

## Project structure

```
src/js/i18n/         pt-BR + en-US dictionaries and the t()/format layer
src/js/lib/          deterministic business rules (pure, unit-tested)
src/js/state/        store, persistence, and shared goal actions
src/js/components/   Forge Ring, ambient background/sparks, overlays, UI kit
src/js/screens/      one module per screen area, each registering its routes
src/js/router.js     hash router with in-place refresh and route guard
src/styles/          design tokens, base styles, component styles
tests/               in-browser test runner + business rule suite
```
