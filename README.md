<div align="center">

<img src="public/logo-mark.svg" width="116" alt="Gapwise deer mark" />

# Gapwise

### Free and open-source multi-university timetable, campus navigation, and student planning platform.

[![Open Gapwise](https://img.shields.io/badge/Open_Gapwise-gapwise.ca-0A84FF?style=for-the-badge&logo=vercel&logoColor=white)](https://gapwise.ca)
[![CI](https://img.shields.io/github/actions/workflow/status/GapwiseHQ/gapwise/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/GapwiseHQ/gapwise/actions/workflows/ci.yml)
[![OpenAPI 3.1](https://img.shields.io/badge/OpenAPI-3.1-6BA539?style=for-the-badge&logo=openapiinitiative&logoColor=white)](https://api.gapwise.ca/openapi.json)
[![MIT](https://img.shields.io/badge/License-MIT-111111?style=for-the-badge)](LICENSE)

<sub>React · TypeScript · TanStack · MapLibre · Supabase · Bun · Vercel · Cloudflare · Resend · OpenAPI · MCP</sub>

<br />

**[App](https://gapwise.ca)** · **[API](https://api.gapwise.ca/v1)** · **[Android](https://github.com/GapwiseHQ/android)** · **[iOS](https://github.com/GapwiseHQ/ios)** · **[AI](https://ai.gapwise.ca)** · **[Data](https://data.gapwise.ca)** · **[Docs](https://docs.gapwise.ca)** · **[Status](https://status.gapwise.ca)** · **[OpenAPI](https://api.gapwise.ca/openapi.json)**

</div>

---

## What Gapwise is

Gapwise began with a common student challenge: a university timetable shows **when** classes meet, but offers no guidance on what to do with the time between them, how long walking routes take across campus, or when to leave to arrive on time.

Gapwise turns university timetable schedules into an intelligent, campus-aware model of a student's day:

- **What is next?** Contextual class schedules with real-time countdowns.
- **Where do I need to go?** Source-backed building identities, footprints, and entrance locations.
- **When should I leave?** Deterministic leave-by and arrival calculations accounting for route duration and setup buffers.
- **How much usable time do I have?** Automatic detection of gaps between classes, minus travel and transition buffers.
- **Can I go there?** Feasibility checks evaluating whether a student can visit a campus destination and return before the next class starts.

All timetable parsing happens locally in the browser with zero account requirement. Guest mode is first-class, and optional cloud sync uses browser-side encryption.

The project originated at the University of Toronto and has expanded into a unified multi-university platform serving institutions across Canada.

---

## Supported universities

Gapwise is one application serving dedicated university editions via host-based routing:

| University | Campus Scope | Timetable Source | Edition URL |
| :--- | :--- | :--- | :--- |
| **University of Toronto** | Mississauga, St. George, and Scarborough | ACORN (`.ics` calendar export) | [gapwise.ca](https://gapwise.ca) |
| **Carleton University** | Main Campus | Carleton Central (text paste or `.ics`) | [carleton.gapwise.ca](https://carleton.gapwise.ca) |
| **Toronto Metropolitan University** | Downtown Campus | MyServiceHub (text paste or Google Calendar `.ics`) | [tmu.gapwise.ca](https://tmu.gapwise.ca) |
| **Queen's University** | Kingston Main Campus | SOLUS Student Center (text paste or `.ics`) | [queens.gapwise.ca](https://queens.gapwise.ca) |
| **Wilfrid Laurier University** | Waterloo Campus | LORIS (text paste or `.ics`) | [laurier.gapwise.ca](https://laurier.gapwise.ca) |
| **York University** | Keele Campus | York Courses Timetable (text paste or `.ics`) | [york.gapwise.ca](https://york.gapwise.ca) |
| **McMaster University** | Hamilton Main Campus | Mosaic Student Center (text paste or `.ics`) | [mcmaster.gapwise.ca](https://mcmaster.gapwise.ca) |
| **Western University** | London Campus | Student Center (text paste or `.ics`) | [western.gapwise.ca](https://western.gapwise.ca) |
| **University of Guelph** | Guelph Campus | WebAdvisor (text paste or `.ics`) | [guelph.gapwise.ca](https://guelph.gapwise.ca) |
| **University of Ottawa** | Downtown Campus | uoCampus (text paste or `.ics`) | [uottawa.gapwise.ca](https://uottawa.gapwise.ca) |
| **Brock University** | St. Catharines Campus | BrockDB / Student Portal (text paste or `.ics`) | [brock.gapwise.ca](https://brock.gapwise.ca) |

---

## Core capabilities

### Timetable & import adapters

- **Local-first browser parsing:** University calendar files (`.ics`) and pasted schedule text are parsed on-device. No schedule data is uploaded simply to render a timetable.
- **University adapters:** Dedicated parsing logic handles university-specific timetable layouts, course code conventions, section types, and room notations.
- **First-class guest mode:** Full functionality is available without creating an account or signing in.
- **Realistic demo timetables:** Every university edition includes an authentic demo timetable allowing students to explore features before importing their own schedule.

### Today & leave-by timing

- Real-time countdowns to the next class or active gap.
- Deterministic walking-time estimates between campus buildings.
- Protected transition buffers and pack-up times prevent late arrivals.
- Safe fallbacks for online, TBA, approximate, or unmapped locations.

### Gap planner

- Automatically calculates free windows between classes across the week.
- Evaluates usable time by subtracting walking duration, buffer times, and transit overhead.
- Categorizes gap opportunities for focused study, quick resets, meals, or library visits.
- "Can I go there?" evaluates whether a round trip to a specific campus spot fits within an available gap.

### Campus map & pedestrian routing

- Building registries with verified polygon footprints, native codes, and aliases.
- Mapped exterior entrances and pedestrian routing networks derived from OpenStreetMap snapshots.
- Step-free routing fails closed when verified accessibility evidence is unavailable, preventing misleading navigation advice.

### Day Replay

- Interactive in-browser timeline scrubber allowing students to simulate any campus day from morning to evening.
- Visualizes class progression, walking transitions, gap windows, and leave-by states.

---

## How the multi-university architecture works

Gapwise avoids fragmented forks by implementing a clean four-tier architecture:

```text
┌─────────────────────────────────────────────────────────────┐
│                    ONE GAPWISE APPLICATION                  │
│       Shared React / TanStack Core · UI · Routing Engine    │
└──────────────────────────────┬──────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  Host-Based  │       │  Timetable   │       │  Canonical   │
│   Editions   │       │   Adapters   │       │ Campus Data  │
│ universities.│       │ src/         │       │ GapwiseHQ/   │
│     json     │       │ universities/│       │     data     │
└──────────────┘       └──────────────┘       └──────────────┘
```

1. **Hostname resolution:** The production hostname (e.g., `carleton.gapwise.ca`) resolves the active university configuration in `universities.json`. For local development, `?university=<id>` selects the active edition.
2. **Timetable adapters:** Each university implements an adapter that normalizes native schedule formats into the shared `Meeting` contract.
3. **Campus data snapshots:** Validated building footprints, entrance nodes, and pedestrian path graphs are pinned from [`GapwiseHQ/data`](https://github.com/GapwiseHQ/data) at build time, ensuring offline reliability and zero runtime coupling.
4. **Isolated SEO & social previews:** Each university edition generates its own `sitemap.xml`, `robots.txt`, schema.org metadata, and dedicated 1200×630 Open Graph preview image with zero cross-university leakage.

---

## Campus data & provenance

Campus facts, geometry, and routing evidence are maintained in [`GapwiseHQ/data`](https://github.com/GapwiseHQ/data) and explored at [data.gapwise.ca](https://data.gapwise.ca).

- **Source-backed:** Building geometries and path networks are extracted from OpenStreetMap under the Open Database License (ODbL 1.0) and cross-verified against official university campus directories.
- **Uncertainty is preserved:** Missing, inferred, or unverified access points are explicitly tagged rather than masked as confident routing paths.
- **Auditable distribution:** Pinned dataset releases include SHA-256 integrity checksums and machine-readable manifests.

---

## Privacy & trust model

Gapwise is built around strict data minimization and defense in depth:

- **Local-first schedule processing:** Timetable parsing and schedule arithmetic run client-side in WebAssembly/JavaScript.
- **No account required:** Complete timetable, gap planning, and campus routing features work out of the box in guest mode.
- **Browser-encrypted cloud sync:** Optional multi-device sync encrypts timetable state client-side using **AES-256-GCM** before sending payloads to Supabase.
- **Foreground-only location:** Live location is strictly opt-in and foreground-only; location coordinates are never logged or stored.
- **Scoped AI delegation:** The Model Context Protocol (MCP) service at [ai.gapwise.ca](https://ai.gapwise.ca) provides assistant integrations through explicit, revocable OAuth delegation. AI clients cannot modify academic schedules.
- **No advertising or data sales:** Zero trackers, zero third-party advertising, and zero monetization of student schedule data.

Read [`PRIVACY.md`](PRIVACY.md), [`SECURITY.md`](SECURITY.md), and [`docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md`](docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md) for full architectural audits.

---

## Ecosystem repositories

| Repository | Role | Primary Surface |
| :--- | :--- | :--- |
| **[`gapwise`](https://github.com/GapwiseHQ/gapwise)** | Canonical multi-university web application, core semantics, public API, and SDKs | [gapwise.ca](https://gapwise.ca) / [api.gapwise.ca](https://api.gapwise.ca/v1) |
| **[`data`](https://github.com/GapwiseHQ/data)** | Canonical multi-university campus navigation datasets, schemas, and contribution studio | [data.gapwise.ca](https://data.gapwise.ca) |
| **[`docs`](https://github.com/GapwiseHQ/docs)** | Platform developer documentation, API/SDK references, and integration guides | [docs.gapwise.ca](https://docs.gapwise.ca) |
| **[`ai`](https://github.com/GapwiseHQ/ai)** | Remote Model Context Protocol (MCP) server for public campus tools and delegated context | [ai.gapwise.ca](https://ai.gapwise.ca) |
| **[`status`](https://github.com/GapwiseHQ/status)** | Independent operational status monitoring and incident reporting | [status.gapwise.ca](https://status.gapwise.ca) |
| **[`android`](https://github.com/GapwiseHQ/android)** | Native Kotlin + Jetpack Compose Android client | Android app |
| **[`ios`](https://github.com/GapwiseHQ/ios)** | Native Swift + SwiftUI iOS client | iOS app |
| **[`cli`](https://github.com/GapwiseHQ/cli)** | Command-line integration tooling for university scaffolding and data extraction | CLI tool |
| **[`.github`](https://github.com/GapwiseHQ/.github)** | Organization profile, community health files, and governance defaults | GitHub profile |

---

## Development

### Prerequisites

- [Bun](https://bun.sh) 1.3.x
- [Node.js](https://nodejs.org) 24.x (for Node-compatible tooling)

### Quick start

```bash
# Clone the repository
git clone https://github.com/GapwiseHQ/gapwise.git
cd gapwise

# Install dependencies
bun install --frozen-lockfile

# Start development server
bun run dev
```

Visit `http://localhost:5173` to test the default edition, or use `http://localhost:5173/?university=<id>` (e.g., `?university=carleton`, `?university=york`) to preview a specific university edition.

### Verification gates

```bash
bun run typecheck        # TypeScript compilation verification
bun run lint             # ESLint and code style checks
bun test                 # Full unit and integration test suite
bun run build            # Production Vite build, SEO generation, and asset checks
bunx prettier --check .  # Code formatting check
```

---

## Creator & maintainer

Gapwise is created and engineered by **Andrew Muratov**, leading platform architecture, full-stack development, campus data pipelines, cryptography, and systems design across the ecosystem.

---

## License

Original code and documentation are released under the [MIT License](LICENSE). Third-party libraries, map data (OpenStreetMap under ODbL 1.0), fonts, and services remain subject to their respective licenses. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

<div align="center">

**Built for the spaces between classes.**

[Open Gapwise →](https://gapwise.ca)

</div>
