DESIGN REVIEW REJECTION for task P0-04. The shell was reviewed in a real browser at 1440x900 and
375x812, with the accessibility tree, keyboard tabbing, and computed contrast. Findings are in
`docs/browser-review.md`. Read that file first; it explains the why. This prompt gives the what.

**Never invoke a tool that runs a shell command.** No `ls`, `npx`, `tsc`, `eslint`, or
file-existence check. Every attempt is auto-denied and ends your turn with nothing written. Read and
write files by exact path. The orchestrator runs all verification.

FILES THAT EXIST, so you never need to explore:

```
frontend/index.html
frontend/eslint.config.js
frontend/src/main.tsx
frontend/src/index.css
frontend/src/design/tokens.css
frontend/src/app/AppShell.tsx
frontend/src/app/ContextBar.tsx
frontend/src/app/providers.tsx
frontend/src/app/routes.tsx
frontend/src/lib/cn.ts
frontend/src/lib/fqn.ts
frontend/src/lib/strings.ts
frontend/src/vite-env.d.ts
```

Installed and importable: react 19.3.0, react-dom, react-router 8.4.0, tailwindcss 4.3.3,
lucide-react 1.47.0, clsx, tailwind-merge. **Do not add a dependency, and do not import a font from
the network.**

---

## FIX 1. The context bar must stop faking a loading state

`AppShell.tsx:93` passes `context={null} identity={null} loading={false}`, and
`ContextBar.tsx:103` guards `if (loading || !context)`, so the skeleton with `animate-pulse` runs
forever. The banner is also permanently named "Content is loading" (`ContextBar.tsx:79`). The first
thing every user sees is therefore a page that looks broken.

Change `ContextBar` to distinguish three states, not two:

1. `loading === true` renders the pulsing skeleton, and only then may the banner carry a loading
   name.
2. `loading === false && context === null` renders a real, static bar at the same height that says
   the workspace context is not connected yet. No pulse, no grey pills. Use plain text from
   `strings.ts`, for example "Workspace context not connected". Keep the bar's borders and height so
   the layout does not shift when data arrives.
3. `context !== null` renders the full bar as it already does.

Give the banner a stable accessible name that describes what it is, such as "Workspace and identity
context", and apply the loading name only in state 1. Keep `role="banner"`.

Do not change the props signature. `AppShell` keeps passing `loading={false}` until P0-05 wires
data.

## FIX 2. Contrast. Introduce semantic colour tokens and stop using ramp steps for text

The 11-step ramp is fine as a ramp. The bug is which steps are used for text and borders. Measured
against the token values: `--color-neutral-7` on paper is 4.37 to 1 and on the panel 4.12 to 1,
`--color-neutral-6` is 2.85 to 1, and the borders are 1.27 and 1.52 to 1. The brief promises 4.5 for
text and 3.0 for UI borders.

In `tokens.css`, keep every existing `--color-neutral-*` value unchanged, and **add** these semantic
tokens to both `:root` and the `@theme` block. The hex values are computed to pass; use them exactly:

```
--color-text-primary:   #1B1A17;   /* 16.7:1 on paper */
--color-text-secondary: #5C5854;   /*  6.8:1 on paper */
--color-text-muted:     #6D6964;   /*  5.2:1 on paper, 4.9:1 on panel */
--color-icon-muted:     #6D6964;   /*  5.2:1, legible as an icon or as text */
--color-border-subtle:  #E2DFDB;   /* decorative hairlines only, never the sole boundary */
--color-border-strong:  #898784;   /*  3.4:1, for real structural and interactive boundaries */
```

Then change every usage:

- Any text currently on `--color-neutral-7` or `--color-neutral-6` moves to `--color-text-muted`,
  or to `--color-text-secondary` where it is primary reading matter.
- Inactive nav icons move to `--color-icon-muted`.
- The border of any element that is the only thing defining a container or control, including the
  nav rail edge, the context bar bottom edge, and any panel, moves to `--color-border-strong`.
- Purely decorative separators such as the rail divider may keep `--color-border-subtle`.

Add a short comment above the semantic block stating that raw `--color-neutral-*` steps must not be
used for text, and that these semantic tokens exist so contrast cannot regress.

## FIX 3. Every page needs a heading, and the product needs a name on screen

The document currently contains zero headings. `document.querySelectorAll('h1,...,h6')` returns an
empty list, and the product name appears only in the browser tab.

Create `frontend/src/app/PageHeader.tsx`, a small presentational component taking
`{ title: string; description?: string; children?: React.ReactNode }`. It renders an `<h1>` for the
title at `--text-xl`, weight 600, colour `--color-text-primary`, with `text-wrap: balance`, and an
optional description paragraph at `--text-base` in `--color-text-secondary` constrained to about 70
characters of line length. `children` is a slot on the right for future actions. Bottom border uses
`--color-border-subtle`.

Every route in `routes.tsx` renders a `PageHeader` with a real title: Data Assets, Asset, Access
Management, Policies, Activity, Platform, and for the not-found route "Page not found".

In `AppShell.tsx`, put the product name at the top of the nav rail as a `<span>`, not a heading, so
it does not compete with the page `h1`. Show the full name at `lg` and up; below `lg`, where the
rail is icon-only, show nothing rather than a cramped abbreviation. Take the name from
`strings.app.title`.

## FIX 4. Make the font stack honest

`tokens.css:80-81` declares Inter and JetBrains Mono. Neither is loaded anywhere: there is no
`@font-face`, no stylesheet link, and neither is a dependency, so the app silently falls back to
the system UI face and the intended typography does not exist.

This application may run inside a restricted network, so a runtime dependency on a font CDN is the
wrong answer. Replace the two stacks with deliberate system-first stacks that are honest about what
will actually render:

```
--font-ui:   ui-sans-serif, -apple-system, "Segoe UI Variable Text", "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;
--font-mono: ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
```

Add a comment saying the stacks are intentionally system-resident because the app must work without
external font requests, and that the monospace face is reserved for identifiers such as fully
qualified names and privilege codes.

## FIX 5. Replace the floating centred card with a real page layout

`routes.tsx:17-28` centres a `max-w-md` rounded bordered card inside a `min-h-[50vh]` flex
container with centre-aligned text. At 1440px that is one small box in an otherwise empty screen.

Rewrite `PlaceholderPanel` as a left-aligned section that sits under the `PageHeader`:

- No card, no centring, no `min-h-[50vh]`, no `text-center`.
- A content region with padding from the space tokens, left aligned, body text constrained to about
  70 characters, colour `--color-text-secondary`.
- Keep it honest that the section is not built yet, but say it in the user's terms, per FIX 6.

## FIX 6. Rewrite the copy so it is written for a user, not for a backlog

In `strings.ts`:

**Placeholders.** Remove every mention of tasks, routes, placeholders, and implementation. A user
has no concept of these. Each one names what the section will do and what the person can do now.
For example, for Data Assets: "Browse catalogs, schemas, and tables to see who can access them.
Asset search is not available yet." Write the same shape for Asset, Access Management, Policies,
Activity, and Platform. For not found: "That page does not exist. Use the navigation to get back to
a section you can open."

**Errors.** Active voice, second person, no "please", and every message names the next step.
Specifically:
- `generic`: say what failed and what to do next, and mention that the correlation ID identifies
  this exact failure for support.
- `notFound`: match the backend's careful wording. It is either missing or not visible to the
  application, and the interface must not claim to know which.
- `unauthorized`, `rateLimit`, `upstream`: drop "please"; state the condition and the next action.
- `forbidden`: say whose permission is missing and what the person can do, for example ask an
  access administrator.

**States.** `empty` becomes an invitation to act rather than "Nothing to display."

Keep `emptyGrants` exactly as it is. Its wording is required by the specification.

**Mode labels.** Delete `strings.context.modes`. Those three literals already exist as the
`ModeLabel` union in `shared/contracts/types.ts`, and duplicating a contract literal creates a
second source of truth. Import the type where the labels are needed.

## FIX 7. Small items

- `ContextBar.tsx:66` puts the environment label in a `title` attribute, invisible to touch and
  keyboard users. Render the label as visible text and drop the `title`.
- `index.html`: add `<meta name="theme-color" content="#FBFAF8">` and set `color-scheme: light` on
  `:root` in `tokens.css`.
- Reconsider the Policies rail icon. A book is a weak metaphor for attribute-based access rules.
  Choose something from lucide that reads as a rule or a filter. Do not change the other icons.

---

## What must not change

- The contract in `shared/contracts/` is frozen. Import types from `@contracts/types`.
- Do not add or edit any dependency, `package.json`, `package-lock.json`, `tsconfig.json`, or
  `vite.config.ts`.
- Keep the skip link, the landmarks, `aria-current="page"`, the `:focus-visible` ring, the
  `prefers-reduced-motion` block, the icon-only rail below 1024px with its `sr-only` labels, and the
  absence of horizontal overflow at 375px. All of those were reviewed and are correct.
- Do not invent data. Placeholders stay honest about being unbuilt.
- No user-visible English string outside `strings.ts`.

## Verify by reading your files back

Confirm: no `--color-neutral-6` or `--color-neutral-7` remains as a text or icon colour; an `<h1>`
exists on every route through `PageHeader`; `strings.ts` contains no occurrence of "task", "route",
"placeholder", or "please"; no font name that is not system-resident appears in `tokens.css`.

## Report

List every file changed, the states `ContextBar` now handles, and anything you disagreed with.
Then append one line to `tasks/STATUS.md` and update your row in `tasks/TASK-BOARD.md`.
