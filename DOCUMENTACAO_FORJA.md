# FORJA — Technical Documentation

Handover document for a developer taking over the project. It describes **what exists in the repository today**, not what was planned in conversation.

- **Audited and updated on:** 2026-09-14
- **Project root:** `C:\FORJA PROTOTIPO`
- **Audit method:** every file in the tree was read or inspected; the test suite, the web application and the Android build were executed. Statements that could not be verified from the files are marked **[UNVERIFIED]**. Reasoned conclusions not stated anywhere in the code are marked **[INFERENCE]**.

---

## Table of contents

1. [Overview](#1-overview)
2. [Technologies and architecture](#2-technologies-and-architecture)
3. [Code structure](#3-code-structure)
4. [Features and flows](#4-features-and-flows)
5. [Database and integrations](#5-database-and-integrations)
6. [Running the project locally](#6-running-the-project-locally)
7. [Tests and quality](#7-tests-and-quality)
8. [Deploy and publishing](#8-deploy-and-publishing)
9. [Maintenance and continuity](#9-maintenance-and-continuity)
10. [Open questions requiring a human decision](#10-open-questions-requiring-a-human-decision)

---

## 1. Overview

### 1.1 What FORJA is

FORJA is a self-improvement and consistency **mobile application** for people aged 17–28. It helps the user close the gap between intention and daily action through a small configured routine, visible progress, and recovery after missed days without losing accumulated effort.

The product deliberately avoids generative AI. The plan is chosen by a deterministic rule from five onboarding answers, not by a model.

**Audience:** young adults who want more discipline, prefer direct language, and use mobile devices in short daily sessions.

| Area | What it does |
|---|---|
| Onboarding | 25 single-choice questions; questions 21–25 pick plan A, B or C deterministically |
| Forge Heat | 0–100 recoverable score, never an all-or-nothing streak |
| Daily goals | Binary and quantitative goals, weekday scheduling, reminder time, pause/delete |
| Reminders | Local notifications scheduled on the device from each goal's time and active days |
| Weekly progress | Seven-day chart, active days, completion per goal, rule-based recommendation |
| Meals | Food catalogue, custom foods, per-100 g maths, user-defined nutrition targets |
| Resources | Curated external study links with category filter |
| Recovery Support | Multiple private goals, milestones, badges, sharing via the device share sheet |
| Subscription | Simulated store purchase sheet; three real price options |
| Admin | Separate protected route to manage the resource list |
| Localisation | Full pt-BR and en-US |

### 1.2 Current development state

**This is a working prototype delivered as a real Android application.**

The UI is built with web technology and runs inside a native shell (Capacitor). The repository produces three artefacts from one codebase:

| Artefact | What it is | Status |
|---|---|---|
| **Android app** | `FORJA-debug.apk`, installable on any Android 6+ device | Built and verified structurally |
| **Installable web app (PWA)** | The same UI with a manifest and service worker; installs to the home screen and works offline | Working |
| **Single-file build** | `forja-arquivo-unico.html`, the whole prototype in one file for quick sharing | Working |

An iOS project has **not** been created: it requires macOS and Xcode, which are not available on the development machine. Capacitor generates it with one command when a Mac is available.

There is still **no backend, no user accounts and no database**. All data lives on the device.

### 1.3 Feature status

**Implemented and working**

- 25-question onboarding with back navigation, progress indicator and resume after interruption
- Deterministic A/B/C plan selection with the question-25 tie-break
- Plan preview before the paywall; paywall with three real durations (R$ 25 / R$ 80 / R$ 100), effective monthly price and honest savings
- Simulated store purchase sheet with success, cancellation, trial-ineligible, pending and error outcomes; entitlement is granted only after explicit confirmation
- Today dashboard, Forge Ring with animated interpolation, sparks and a forge-strike moment
- Full goal CRUD: create, edit, pause, delete, weekday scheduling, unit conversion, `+/-` stepper, slider, numeric entry, reminder time
- **Local notifications** rebuilt from goals and preferences on every change, honouring tone, faith opt-in and the "no reminders" option
- Weekly progress with partial-completion distinction and active-day counting
- Meal logging with validation; user-defined nutrition targets
- Resource list, category filter, opened through the in-app browser
- Recovery Support with multiple goals, milestones, badges, archive/delete and a share preview that uses the device share sheet
- Profile: display name, photo, language, reminder tone and frequency, faith opt-in, reduced motion, subscription management, legal screens, data reset
- Admin area: password gate, mock dashboard, resource CRUD with reordering and URL validation
- pt-BR / en-US localisation with automated key-parity checking
- Accessibility: WCAG AA contrast, ≥44 px touch targets, keyboard-operable sheets, reduced-motion support
- App shell: launcher icon, splash screen, status bar colour, Android hardware back button, offline support

**Partially implemented**

| Item | What works | What is missing |
|---|---|---|
| Subscription | Full UI, entitlement rules, cancellation with access until period end | Real billing. No Play Billing or StoreKit. Nothing charges anyone |
| Admin authorisation | Client-side password gate, session flag | No server, therefore no real authorisation. Anyone reading the source sees the password |
| Analytics | 23 event types recorded to a local array, capped at 200 | No transmission, no destination, no pipeline |
| Legal documents | Draft Terms and Privacy screens, labelled as drafts | Not reviewed by a lawyer; no public HTTPS URLs |
| iOS | The code is platform-agnostic and Capacitor supports it | The `ios/` project does not exist; needs a Mac |

**Not implemented at all**

- Any backend, API or server-side logic
- User accounts, authentication, password recovery
- A database of any kind
- Real payments or store integration
- Push notifications (only *local* notifications exist)
- Analytics delivery
- File storage or CDN
- CI/CD pipeline
- Version control (see §9.3)

---

## 2. Technologies and architecture

### 2.1 Stack

| Layer | Technology | Version (verified) |
|---|---|---|
| UI language | JavaScript (ES modules) | No transpiler; runs natively |
| Styles | CSS with custom properties | No preprocessor |
| UI framework | **None** | Intentional |
| Native shell | **Capacitor** | 7.x (`@capacitor/core`, `@capacitor/android`) |
| Native plugins | App, Browser, Haptics, LocalNotifications, Share, SplashScreen, StatusBar | 7.x |
| Package manager | npm | 11.17.0 |
| Node.js | Required for the Capacitor CLI only | v24.19.0 |
| Android build | Gradle + Android Gradle Plugin | Gradle 8.11.1, AGP 8.7.2 |
| Java | **JDK 21** required by AGP 8.7.2 | Microsoft OpenJDK 21.0.12 |
| Android SDK | compileSdk 35, targetSdk 35, minSdk 23 | Platform 37 + build-tools 36 installed |
| Dev server (web) | PowerShell `HttpListener` | `serve.ps1`, Windows only |
| Fonts | Google Fonts: Oswald, JetBrains Mono, Source Sans 3 | Loaded by URL |
| Persistence | Browser `localStorage` inside the WebView | — |
| Tests | Custom in-browser runner | `tests/testRunner.js` |

The application code itself has **no third-party JavaScript dependencies**. Everything in `node_modules` exists to build the native app, not to run the UI.

> ⚠ **JDK version matters.** Android Studio ships a Java 25 runtime, which Gradle 8.11.1 rejects with `Unsupported class file major version 69`. Builds must use JDK 17 or 21. See §6.6.

### 2.2 How the application is organised

```
┌───────────────── Android device ──────────────────┐
│                                                   │
│  ┌────────── Native shell (Capacitor) ─────────┐  │
│  │  MainActivity · plugins · launcher icon      │  │
│  │  splash · status bar · notifications         │  │
│  │                                              │  │
│  │   ┌────────── WebView (the app UI) ───────┐  │  │
│  │   │  www/index.html                        │  │  │
│  │   │      ▼                                 │  │  │
│  │   │  main.js → router → screens            │  │  │
│  │   │      │ read            │ write         │  │  │
│  │   │      ▼                 ▼               │  │  │
│  │   │  lib/ (pure rules)  goalActions        │  │  │
│  │   │      ▲                 │               │  │  │
│  │   │      └──── state/store.js ─────────────┤  │  │
│  │   │                  │                     │  │  │
│  │   │                  ▼  localStorage        │  │  │
│  │   │          platform/native.js  ───────────┼──┘  │
│  │   └────────────────────────────────────────┘     │
│  └──────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
        │                              │
        ▼                              ▼
  fonts.googleapis.com        example.com study links
  (styling, first load)       (in-app browser)
```

`src/js/platform/native.js` is the only file that talks to the device. Everything above it is platform-agnostic, which is why the same code runs as an Android app, an installable web app and a plain website.

**Data flow:** a screen reads from `store.getState()`, renders DOM, and any change goes through an action that calls `store.setState()`, which persists the whole state object to `localStorage`; the screen then calls `router.refresh()` to re-render in place. Separately, `main.js` subscribes to the store and rebuilds the device's scheduled notifications whenever goals or preferences change.

### 2.3 Key technical decisions

| Decision | Reason |
|---|---|
| **Capacitor rather than a native rewrite** | The prototype's UI, flows and business rules already existed and were validated. Capacitor turns them into a store-publishable app without discarding that work, while still giving real access to notifications, haptics, the share sheet and the status bar |
| Native capabilities read from `window.Capacitor` instead of imported packages | The same source file runs unchanged in a browser, in the PWA and in the app. Only the capability level differs, and every function degrades instead of throwing |
| No UI framework, no bundler | The UI has no dependencies to install, audit or upgrade. `www/` is assembled by copying files |
| Business rules isolated in `src/js/lib/` as pure functions | Unit-testable without a DOM and portable to any future platform, including a native rewrite |
| `localStorage` as a single JSON blob | Simplest persistence for a prototype with no backend |
| Hash router with in-place `refresh()` | Preserves scroll position and keyboard focus when re-rendering |
| Quantitative goals stored in canonical base units | Changing the display unit converts exactly and never corrupts the stored target |
| Date keys built from local calendar parts, never `toISOString()` | UTC conversion files a day's data under the wrong date for negative UTC offsets, which includes all of Brazil |
| Every visible string in `src/js/i18n/` | A test fails if a key exists in one dictionary and not the other |
| Purchase handled by a simulated store sheet | The product must never collect card data; in production the platform sheet owns payment entirely |

---

## 3. Code structure

### 3.1 Commented tree

```
C:\FORJA PROTOTIPO\
├── index.html                    Web entry point. Loads CSS + main.js, declares the manifest
├── manifest.webmanifest          PWA identity: name, icons, standalone display, portrait
├── sw.js                         Service worker: installability and offline support
├── capacitor.config.json         Native app config: appId, appName, webDir, plugin settings
├── package.json                  npm scripts and Capacitor dependencies
├── .gitignore                    Excludes node_modules, www, build output, generated bundles
├── serve.ps1                     Local web dev server (Windows). NOT for production
├── build-single-file.ps1         Bundles all sources into one shareable HTML file
├── README.md                     Short run instructions
├── DOCUMENTACAO_FORJA.md         This file
│
├── tools/
│   ├── build-www.ps1             Assembles www/ — the payload for both Capacitor and web hosting
│   └── make-icons.ps1            Generates every app icon (web, PWA, Android launcher)
│
├── src/
│   ├── assets/icons/             Generated app icons (192, 512, maskable, apple-touch, 1024)
│   ├── js/
│   │   ├── main.js               BOOT: locale, route guard, app shell, back button,
│   │   │                         service worker, notification scheduling
│   │   ├── router.js             Hash router: registerRoute, navigate, refresh, goBack, setGuard
│   │   │
│   │   ├── platform/
│   │   │   └── native.js         THE DEVICE BRIDGE. share, haptics, in-app browser, status bar,
│   │   │                         splash, Android back button, local notification scheduling.
│   │   │                         Everything degrades gracefully on the web
│   │   │
│   │   ├── i18n/                 t(), formatters, and the pt-BR / en-US dictionaries
│   │   ├── lib/                  PURE BUSINESS RULES — no DOM, no storage, unit-tested
│   │   ├── state/                store.js (persistence) and goalActions.js (all goal mutations)
│   │   ├── components/           Forge Ring, background/sparks, overlays, UI kit
│   │   └── screens/              One module per area, each registering its routes
│   │
│   └── styles/                   tokens.css, base.css, components.css
│
├── tests/
│   ├── index.html                Open this in a browser to run the suite
│   ├── testRunner.js             Minimal runner
│   └── businessRules.test.js     54 test cases
│
├── android/                      ⚙ NATIVE PROJECT — committed, because its manifest,
│   │                              icons and resources are edited by hand
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml   Permissions merge in from the plugins at build time
│   │   ├── res/mipmap-*/         Launcher icons (generated by tools/make-icons.ps1)
│   │   └── res/values/           app_name = FORJA, adaptive-icon background colour
│   ├── variables.gradle          compileSdk 35 / targetSdk 35 / minSdk 23
│   └── local.properties          ⚠ machine-specific SDK path, gitignored
│
├── www/                          ⚠ GENERATED. Rebuild: npm run build:www
├── node_modules/                 ⚠ GENERATED. Rebuild: npm install
├── forja-arquivo-unico.html      ⚠ GENERATED. Rebuild: npm run bundle
└── FORJA-debug.apk               ⚠ GENERATED. Rebuild: npm run android:apk
```

### 3.2 Entry points

| Entry point | Path | Purpose |
|---|---|---|
| Android app | `android/app/src/main/.../MainActivity` → loads `www/index.html` | The app |
| Web / PWA | `index.html` → `src/js/main.js` | Same UI in a browser |
| Test suite | `tests/index.html` | Business-rule tests |
| Admin | any entry, then `#/admin` | Unlinked route |

### 3.3 Navigation

`src/js/router.js` implements a hash router. Screens register themselves with `registerRoute("/today", renderToday)`. Key functions: `navigate(path)`, `refresh()` (re-render keeping scroll and focus), `goBack(fallback)` and `setGuard(fn)`.

The guard lives in `main.js`: onboarding must be complete for internal routes, and an active entitlement is required for everything except welcome, onboarding, plan preview, paywall, legal, admin and profile.

On Android, the hardware back button is intercepted in `main.js`: it closes an open overlay, otherwise navigates back, and only exits the app from the root screen.

### 3.4 State management

`src/js/state/store.js` holds one object persisted to `localStorage` under `forja_state_v2` on every write. Key fields: `onboarding`, `profile`, `plan`, `goals[]`, `nutritionGoals`, `subscription`, `dailyLogs{}`, `heatHistory[]`, `meals{}`, `recoveryGoals[]`, `resources[]`, `analyticsEvents[]`.

`defaultState()` at `src/js/state/store.js:17` is the closest thing to a schema and the file to read first when modelling a real database.

Other storage keys: `forja_state_v1_backup` (previous schema, untouched) and `forja_admin_session` in `sessionStorage`.

### 3.5 Where to change things

| To change… | Edit |
|---|---|
| Any visible text | `src/js/i18n/pt-BR.js` **and** `src/js/i18n/en-US.js` (a test fails if they diverge) |
| A screen's layout or behaviour | The matching file in `src/js/screens/` |
| Colours, type, spacing, motion | `src/styles/tokens.css` first |
| A business rule | `src/js/lib/`, then update `tests/businessRules.test.js` |
| Anything that writes a goal | `src/js/state/goalActions.js` — never write to the store from a screen |
| Device capabilities | `src/js/platform/native.js` — the only file that knows about Capacitor |
| App name, id, splash, plugin config | `capacitor.config.json`, then `npm run sync` |
| App icon | `tools/make-icons.ps1`, then `npm run icons && npm run sync` |
| Android permissions, manifest | `android/app/src/main/AndroidManifest.xml` |
| Prices and entitlement | `src/js/lib/subscription.js` |
| Seed content (foods, resources, plan templates) | `src/js/lib/mockData.js` |

---

## 4. Features and flows

### 4.1 Main user journey

```
Welcome → 25 questions → plan transition → plan preview → paywall
   → simulated store sheet → confirmation → Today
        ├─ complete goals (ring animates, sparks, haptics, forge strike on the last one)
        ├─ add / edit / pause / delete goals  → reminders reschedule automatically
        ├─ Progress · Meals · Resources · Recovery · Profile
```

### 4.2 Routes

All routes are hash fragments of a single page. **There are no HTTP endpoints and no API contracts** — the app makes no network requests except loading fonts and opening external links.

| Route | Access |
|---|---|
| `/welcome`, `/onboarding`, `/plan-generating`, `/plan-preview`, `/paywall`, `/legal` | Open |
| `/today`, `/goal`, `/progress`, `/meals`, `/add-food`, `/nutrition-goals`, `/resources`, `/recovery`, `/recovery-goal`, `/recovery-edit` | Onboarding + entitlement |
| `/profile` | Onboarding only |
| `/admin` | Password gate |

### 4.3 Business rules worth knowing

- **Plan selection** — only questions 21–25 score. Highest wins; on a tie the question-25 answer decides. Verified deterministic across all 243 combinations.
- **Forge Heat** — starts at 30. Up to three goals score 3 points each; +1 when every goal scheduled that day is complete; maximum +10/day. A day with goals scheduled and none done costs 5 points, once. A day with nothing scheduled is neutral. Clamped 0–100; history is never deleted.
- **Active day** — at least one scheduled goal completed fully or partially.
- **Goal start date** — a goal never counts on days before it was created.
- **Nutrition** — `nutrient × grams / 100`. Targets are `null` until the user sets them.
- **Entitlement** — a cancelled subscription keeps access until the end of the paid period.

### 4.4 Notifications

`syncGoalReminders()` in `src/js/platform/native.js` cancels every pending notification and rebuilds the schedule from current state. It is called on boot and, debounced, on every store change.

- One weekly repeating notification per goal per active weekday, at the goal's reminder time
- Skipped for paused goals and goals with no reminder time
- `reminderFrequency: "none"` cancels everything; `"essential"` limits to scoring goals
- The body combines the goal title with a line from the tone library, respecting the faith opt-in
- Permission is requested on first schedule; if denied, the function returns `{ scheduled: 0, reason: "denied" }` and the app continues normally
- **On the web there are no scheduled notifications** — the plugin is absent and the function returns `unsupported`

### 4.5 Authentication and permissions

**There is no user authentication.** No accounts, no login, no roles. Any person opening the app gets a fresh local profile.

The admin gate is at `src/js/screens/admin.js:12`:

```js
const ADMIN_PASSWORD = "forja-admin";
```

> ⚠ **This is a demonstration, not security.** The password ships in client-side source, readable by anyone who unpacks the APK. It must be replaced by server-enforced authorisation before any public release.

**Android permissions** (merged in from the plugins, verified in the built APK): `INTERNET`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`.

### 4.6 Validation, errors and known limitations

Validation covers goals (title ≤60 chars, ≥1 active day, target > 0), nutrition targets and food entries (bounds and required fields), recovery goals, and admin resource URLs.

Error handling is local and defensive: storage access is wrapped in `try/catch` so the app keeps running in memory if it fails; a corrupt payload falls back to a fresh state; clipboard access falls back to a hidden textarea; every native call degrades. There is **no global error boundary and no error reporting**.

Limitations: no backend, so nothing syncs between devices and uninstalling loses everything; payments are simulated; the admin gate is not security; `dailyLogs` and `meals` grow without bound; the profile photo is a data URL inside the same storage quota; study links are `example.com` placeholders; iOS does not exist yet.

---

## 5. Database and integrations

**There is no database.** No SQL, no NoSQL, no ORM, no schema file, no migrations, no seed scripts. Persistence is one JSON document in `localStorage`, defined by `defaultState()`.

**Schema migration that exists:** on load, an old `forja_state_v1` key is copied to `forja_state_v1_backup` and removed. There is no field-level migration.

**Conceptual entity relationships, for a future backend**

```
User (implicit — one per device)
 ├── onboarding answers        1:1
 ├── plan                      1:1
 ├── goals                     1:N ──< dailyLogs.progress[goalId]   (N:M over dates)
 ├── nutritionGoals            1:1 (nullable)
 ├── meals                     1:N, grouped by date and meal group
 ├── recoveryGoals             1:N ──< milestones, badges
 ├── subscription              1:1
 └── resources                 1:N (seeded, admin-editable)
```

**External services**

| Service | Purpose | Configuration | Status |
|---|---|---|---|
| Google Fonts | Three typefaces | Plain stylesheet URL | Active |
| `example.com` links | Placeholder study resources | None | Placeholder |

No analytics, error tracking, payment provider, email, push service, storage bucket, CDN or authentication provider is configured anywhere.

**File storage:** none. The profile photo is downscaled to 256 px and kept as a data URL on the device.

---

## 6. Running the project locally

### 6.1 Prerequisites

| Requirement | Version | Needed for |
|---|---|---|
| A modern browser | Chrome/Edge 105+ **[INFERENCE]** | Web development and tests |
| Windows + PowerShell 5.1 | Ships with Windows | `serve.ps1` and the build scripts |
| Node.js | 20+ (verified on 24.19.0) | Capacitor CLI only |
| **JDK 21** | Microsoft OpenJDK 21 or Temurin 21 | Android builds (**not** Android Studio's Java 25) |
| Android Studio + SDK | Platform 35+, build-tools | Android builds, emulator |
| macOS + Xcode | — | iOS only. Not available on this machine |

### 6.2 Install

```powershell
npm install
```

Installs the Capacitor CLI and plugins. The UI itself has no dependencies.

### 6.3 Environment configuration

**The application requires no environment variables.** There is no `.env` and no `.env.example`, because nothing in the app reads configuration at runtime. Everything configurable is a constant in source:

| Setting | Location | Value |
|---|---|---|
| App id / name | `capacitor.config.json` | `br.com.forja.app` / FORJA |
| Dev server port | `serve.ps1`, `.claude/launch.json` | 5180 |
| Admin password | `src/js/screens/admin.js:12` | `forja-admin` (prototype only) |
| Prices, trial length | `src/js/lib/subscription.js` | 25 / 80 / 100 BRL, 7 days |
| SDK path | `android/local.properties` | machine-specific, gitignored, created by Android Studio or by hand |

**Variables a production version will need** — none exist yet; this is planning input:

| Variable | Purpose | Required | Fictional example |
|---|---|---|---|
| `API_BASE_URL` | Backend address | Yes, in production | `https://api.example.org` |
| `DATABASE_URL` | Database connection | Yes, with a backend | `postgres://user:password@host:5432/forja` |
| `GOOGLE_PLAY_PACKAGE_NAME` | Purchase validation | Yes, for Android billing | `br.com.forja.app` |
| `APPLE_SHARED_SECRET` | Receipt validation | Yes, for iOS billing | `0000000000000000000000000000` |
| `SENTRY_DSN` | Error reporting | Optional | `https://examplekey@o0.ingest.example.io/0` |

> Never place real secrets in this repository. Values belong in the hosting platform's secret manager. See §9.4.

### 6.4 Database preparation

Not applicable — there is no database.

### 6.5 Commands

**Web / PWA**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
```

Then `http://localhost:5180` (app), `http://localhost:5180/tests/` (tests), `#/admin` for the admin area (password `forja-admin`). For the intended layout press `F12` then `Ctrl+Shift+M` and set the width to ~390 px.

**Android**

```powershell
# One-off per machine: point Gradle at the SDK and use JDK 21
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

npm run sync          # rebuild www/ and copy it into the native project
npm run android:apk   # produces android/app/build/outputs/apk/debug/app-debug.apk
npm run android       # or: open the project in Android Studio to run on a device
```

Install the APK by copying it to the phone and opening it (allow installation from unknown sources), or with `adb install -r FORJA-debug.apk`.

**Other**

```powershell
npm run build:www     # assemble www/ only
npm run icons         # regenerate every icon, web and Android
npm run bundle        # regenerate the single-file build
```

**iOS** — on a Mac: `npx cap add ios`, then `npm run ios`. Not possible on Windows.

### 6.6 Common problems

| Symptom | Cause | Fix |
|---|---|---|
| `Unsupported class file major version 69` | Gradle received Android Studio's Java 25 | Set `JAVA_HOME` to JDK 21 before building |
| `SDK location not found` | `android/local.properties` missing | Create it with `sdk.dir=C:\\Users\\<user>\\AppData\\Local\\Android\\Sdk` |
| `Could not bind port 5180` | Windows reserved the port range | `netsh interface ipv4 show excludedportrange protocol=tcp`, then `.\serve.ps1 -Port 5181` and update `.claude/launch.json`. This happened once with 5173 |
| Web changes do not appear in the app | `www/` is stale | `npm run sync` |
| Blank page, module error | Opened as `file://` | Serve over HTTP |
| Stale app state | Corrupt `localStorage` | Profile → "Sair (limpar dados do protótipo)" |
| Notifications never arrive | Permission denied, or running on the web | Check Android notification settings; the web has no scheduling |

---

## 7. Tests and quality

### 7.1 What exists

One suite: `tests/businessRules.test.js`, **54 test cases**, covering the pure modules in `src/js/lib/` plus the i18n layer — plan selection and tie-break (an exhaustive sweep of all 243 answer combinations), Forge Heat scoring and boundaries, goal validation and scheduling, unit conversion, nutrition maths and validators, weekly recommendation, subscription pricing and entitlement, recovery milestones and badges, i18n key parity and formatting, default state and a persistence round-trip.

**Run:** start the server and open `http://localhost:5180/tests/`. Results also land on `window.__FORJA_TEST_RESULTS__`. There is no terminal runner and no exit code, so **this cannot gate CI as it stands**.

### 7.2 Lint, types, build

No ESLint, no Prettier, no TypeScript. `npm run build:www` and the Gradle build are the only build steps.

### 7.3 What was executed for this audit, and the results

| Check | Result |
|---|---|
| Test suite | **54/54 pass** |
| Web app boot + route sweep | No console errors; every route renders |
| Service worker | Registered; **47 assets cached** — the app opens offline |
| Manifest | Valid: standalone, portrait, 3 icons |
| `www/` payload | Boots correctly with relative paths |
| **Android build** | **BUILD SUCCESSFUL in 3m 1s**, 274 tasks |
| APK inspection | `br.com.forja.app`, label FORJA, minSdk 23, targetSdk 35, 4.1 MB, permissions INTERNET + POST_NOTIFICATIONS + RECEIVE_BOOT_COMPLETED + WAKE_LOCK |

**A failure found and fixed during this work:** three goal-scheduling tests were time-dependent — they created goals with `createGoal()`, which defaults `startDate` to the current date, then asserted scheduling on fixed past dates. The application logic was correct; the fixtures had aged into failure. They now pin `startDate` to a constant. No application file was changed for this.

### 7.4 Coverage gaps

The suite covers business rules well and **UI code not at all**. No DOM, component or end-to-end testing exists.

**[UNVERIFIED] — the APK was never executed.** It was built and its manifest inspected, but no emulator or physical device was available on the build machine. The web payload it contains was verified in a browser. **Running it on a real Android device is the first thing to do.** Specifically unverified on-device: notification delivery and permission prompt, haptics, the share sheet, the in-app browser, splash screen, status bar, hardware back button, and WebView rendering.

Also unverified: iOS entirely, and Safari/Firefox on the web.

---

## 8. Deploy and publishing

### 8.1 Two distinct products

| Target | Artefact | Effort |
|---|---|---|
| **Web / PWA** | Upload `www/` to any static host | Ready now |
| **Google Play** | Signed AAB from the `android/` project | Blocked, see §8.4 |
| **App Store** | Requires a Mac | Not started |

### 8.2 Web deploy

Run `npm run build:www` and publish the `www/` folder. No build command, no environment variables, no database.

**Recommendation: Cloudflare Pages or Netlify** — free HTTPS, custom domain, immutable deploys with one-click rollback. Publish directory `www`, build command `npm run build:www` if the host runs Node, otherwise upload the folder.

> ⚠ `serve.ps1` is a development convenience only. Single-threaded, no TLS, no logging, and it returns HTTP 500 for `HEAD` requests. Never use it for production traffic.

### 8.3 Android: from debug APK to Play Store

What exists today is a **debug APK** — installable directly on a phone, perfect for review, and not publishable.

To publish you additionally need:

1. **A Google Play developer account** — one-off fee, identity verification, and for individual accounts a 14-tester closed test before production is allowed.
2. **An upload keystore** — `keytool -genkey -v -keystore forja-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias forja`. **Back it up securely; losing it means losing the ability to update the app.** Never commit it.
3. **Signing config** in `android/app/build.gradle` reading credentials from `gradle.properties` or environment variables, never from source.
4. **A release bundle**: `cd android && gradlew.bat bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`.
5. **A version bump per upload** — `versionCode` and `versionName` in `android/app/build.gradle`.
6. **Store listing**: icon 512×512, feature graphic 1024×500, at least 2 phone screenshots, short and full description, category, contact e-mail.
7. **A publicly hosted privacy policy URL** — the draft screens in the app do not satisfy this.
8. **Data safety form** declaring what is collected. Today the honest answer is "nothing leaves the device".
9. **Subscription products** configured in the Play Console, plus Play Billing in the app, if the paywall is to become real.

### 8.4 Current blockers

| # | Blocker | Blocks |
|---|---|---|
| 1 | No backend, accounts or database | Any real launch; data is per-device |
| 2 | Payments entirely simulated | Charging anyone |
| 3 | No signing keystore or release config | Play Store upload |
| 4 | Legal documents are unreviewed drafts without public URLs | Store submission |
| 5 | Admin password in client-side source | Any public release |
| 6 | Study links are `example.com` placeholders | Public launch |
| 7 | No version control | Safe iteration and rollback |
| 8 | **APK never executed on a device** | Confidence in the current build |
| 9 | No iOS project (needs a Mac) | App Store |

Items 3, 5, 6, 7 and 8 are cheap. Items 1 and 2 are the real project.

### 8.5 Verifying and rolling back

**Android:** install the APK, complete onboarding, set a goal reminder a few minutes ahead and confirm the notification arrives, complete a goal and confirm the haptic and the ring animation, share a recovery card, open a study link, press the hardware back button from an inner screen. Rollback means distributing the previous APK, or halting the staged rollout in the Play Console.

**Web:** open the deployed URL, check the console is clean, complete onboarding, run `/tests/` if published, and check a ~390 px viewport for horizontal overflow. Roll back by promoting the previous deploy in the hosting dashboard.

---

## 9. Maintenance and continuity

### 9.1 Logs, monitoring, backups

| Concern | Current state | Needed |
|---|---|---|
| Application logs | None | Error reporting once there is a public release |
| Monitoring | None | Uptime check for the web build; Play Console vitals for Android |
| Analytics | 23 event types collected locally, never sent | A destination and a matching privacy disclosure |
| Backups | **None.** Data exists only on the device | A backend is the real answer; an export/import of the JSON state would protect testers in the meantime |

### 9.2 Updating dependencies

The UI has no dependencies. The build chain does: `npm outdated` then `npm update`, and after any Capacitor upgrade run `npm run sync` and rebuild. Capacitor major upgrades usually require matching AGP, Gradle and JDK versions — check its migration guide rather than bumping blindly.

### 9.3 Technical debt, risks and known bugs

| # | Item | Impact | Action |
|---|---|---|---|
| 1 | **No version control** | Critical — a bad edit is unrecoverable | `git init`, commit, push to a private remote. `.gitignore` is already written |
| 2 | APK never run on a device | High — unknown unknowns | Install and exercise it |
| 3 | Admin password hardcoded | High if released | Server-side authorisation |
| 4 | No backend or accounts | High — defines the product ceiling | Architectural decision, §10 |
| 5 | Time-dependent test fixtures | Medium — three already failed this way | Pattern fixed; audit new tests for the same shape |
| 6 | Unbounded growth of `dailyLogs` and `meals`; photo in the same quota | Medium long-term | Prune or archive; move the photo out of the main blob |
| 7 | No UI test automation | Medium | End-to-end coverage of critical flows |
| 8 | No lint or formatter | Low | Add ESLint + Prettier |
| 9 | `serve.ps1` returns 500 on `HEAD` | Very low, dev only | Handle `HEAD`, or drop it for a real host |
| 10 | No iOS project | Blocks half the market | Needs a Mac |

No functional defects were found in the application itself.

### 9.4 Accounts and access the owner will need

None exist yet. Planned, with **no credentials recorded anywhere in this repository**:

- Git hosting account owning the private repository
- Static hosting account for the web build
- Domain registrar, if a custom domain is wanted
- **Google Play developer account**, plus secure custody of the upload keystore
- Apple Developer Program and a Mac, for iOS
- Later: database hosting, error reporting, analytics

Secrets belong in the platform's secret manager, shared person-to-person through a password manager — never by e-mail or chat, never in the repository.

---

## 10. Open questions requiring a human decision

1. **Backend and accounts** — required for multi-device use, backups and real subscriptions. What stack, and who builds it?
2. **Payments** — Play/App Store billing (mandatory for in-app digital subscriptions, 15–30% commission) or a web checkout outside the app?
3. **iOS** — is it in scope? It needs a Mac and an Apple Developer account.
4. **Legal documents** — who reviews the drafts and where will they be hosted?
5. **Real study content** — the `example.com` links need a curated replacement with licensing checked.
6. **Data retention** — how long is a user's history kept, and what does the privacy policy promise?
7. **Six-month plan** — the original brief questioned whether it should exist alongside the annual plan. It is currently offered.

---

*End of document. Audited against the repository on 2026-09-14; the test suite, the web application and the Android build were executed as described in §7.3.*
