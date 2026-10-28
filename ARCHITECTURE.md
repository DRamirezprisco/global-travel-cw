# Project Architecture, Guidelines & Rules for AI

This document establishes the architecture, directory structure, conventions, and operational rules for this repository. All AI assistants (including Antigravity and other LLM tools) must strictly adhere to these instructions when reading, modifying, or creating code in this project.

---

## 1. Tech Stack Overview

* **Framework:** [Astro](https://docs.astro.build/en/getting-started/) (Latest)
* **Styling:** Tailwind CSS v4
* **Database:** Cloudflare D1 (Serverless SQLite)
* **Deployment/Adapter:** Cloudflare Adapter (`@astrojs/cloudflare`)
* **Type System:** TypeScript (Strict Mode)

---

## 2. Directory & Architecture Structure

```text
/
├── .ideas/                 # Inspiration/Reference images for sections and designs
├── public/                 # Static assets (fonts, favicons, static images)
├── src/
│   ├── components/         # Section-based & UI components (grouped in folders)
│   ├── constants/          # Application data and static content (.ts files)
│   ├── layouts/            # Base layouts (e.g., Layout.astro)
│   ├── pages/              # Astro pages and routing
│   ├── styles/             # Global styles and Tailwind v4 @theme definitions
│   ├── types/              # Global TypeScript interfaces and types
│   └── utils/              # Reusable utility functions and DB helpers
├── astro.config.mjs        # Astro configuration with Cloudflare adapter
├── wrangler.jsonc          # Cloudflare Workers & D1 database configuration
└── package.json
```

---

## 3. Directory Rules & Conventions

### `src/components/`
* **Organization:** Components **must** be organized inside logical subdirectories corresponding to pages or features (e.g., `src/components/home/Hero.astro`, `src/components/common/Header.astro`).
* **Section-Based Architecture:** High-level pages (`src/pages/*.astro`) should primarily import and assemble section components from this directory rather than declaring complex inline HTML.

### `src/constants/`
* Stores static content, configurations, and mock data.
* **Format:** Written exclusively in `.ts` files with strict typing using interfaces from `src/types/`.
* **Rule:** Do not hardcode static text or datasets directly inside `.astro` or component files; extract them to a constant file inside this directory.

### `src/types/`
* Holds generic interfaces, types, and compound data definitions.
* Export all shared types from dedicated `.ts` files inside this folder (e.g., `index.ts`, `data.ts`).

### `src/utils/`
* Contains pure helper functions, string formatters, API callers, and reusable logic across different parts of the project.
* Keep utilities modular and side-effect-free where possible.

### `.ideas/` (or `/ideas`)
* Contains visual inspiration and image references for layout design and UI sections.
* **AI Rule:** Consult context or references from this folder when designing UI/UX layouts or creating visual components if directed.

---

## 4. Styling & Theme Rules (Tailwind CSS v4)

* **Color Palette System:** Always use semantic custom color tokens in Tailwind utility classes:
  * `primary`: Primary brand/action color — **Royal Blue (Azul Rey)** (e.g., `#1e3a8a` / `#1d4ed8`).
  * `secondary`: Secondary supporting color — **Red (Rojo)** (e.g., `#dc2626` / `#ef4444`).
  * `base`: Main background color (e.g., `#ffffff` / `#f8fafc`).
* **Rule:** Avoid hardcoded arbitrary color values (e.g., `bg-[#123456]`) unless specifically instructed. Rely on `bg-base`, `text-primary`, `border-secondary`, etc.

---

## 5. Deployment, Adapter & Database Configuration

* **Target Platform:** Cloudflare Pages/Workers.
* **Database:** Cloudflare D1 configured via `wrangler.jsonc` (`d1_databases` binding `DB`) and accessed through `Astro.locals.runtime.env.DB`.
* Ensure all server features or SSR route outputs remain compatible with `@astrojs/cloudflare` runtime constraints.

---

## 6. Code Generation Rules for AI

1. **Type Safety:** Always import types explicitly (`import type { MyType } from '@/types'`).
2. **Component Separation:** Keep Astro components clean. Extract business logic or static text to `utils/` or `constants/`.
3. **Paths:** Use alias pathways (e.g., `@/components/...`, `@/utils/...`) when importing across directories.
4. **Tailwind v4 Standard:** Ensure proper `@theme` block setups in modern Tailwind CSS v4 syntax when adding theme-level variables.