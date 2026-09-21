# Browser review, pass 1

Reviewer: orchestrator. Date: 2026-09-22. Build: P0-04 shell, commit-free working tree.
Method: Vite dev server at 1440x900 and 375x812, keyboard tab-through, accessibility tree read,
computed-style inspection, and WCAG contrast computed from the token hex values.

Scope note: the shell is deliberately unfinished. Data wiring is P0-05 and every page is a
placeholder by design. Findings below separate **defects that will persist** from **emptiness that
is expected at this stage**. Only the former are actionable now.

## Verdict

The shell is structurally sound: real landmarks, working focus rings, a collapsing rail, no
horizontal overflow at 375px, and honest placeholder text that does not fake data. But as a product
it currently reads as unfinished and generic, for six specific and fixable reasons. The most
damaging is that the first thing anyone sees is a loading skeleton that never resolves.

## Blocking defects

### B1. The context bar is a permanent fake loading state

`frontend/src/app/AppShell.tsx:93` passes `context={null} identity={null} loading={false}`.
`ContextBar` guards with `if (loading || !context)` at `frontend/src/app/ContextBar.tsx:103`, so it
renders `ContextBarSkeleton` forever, complete with `animate-pulse`.

The header therefore advertises work that is not happening. The banner's accessible name is
permanently `"Content is loading"` (`ContextBar.tsx:79`), so a screen-reader user is told the page
is loading every time they land on the banner. Confirmed in the DOM: `role=banner` has
`aria-label="Content is loading"`, and the animation runs indefinitely.

This single defect is most of the "unfinished" feeling. A pulsing grey skeleton is the universal
signal for "broken or still loading", and it is the first element on the page.

**Fix.** Treat "no context yet" as its own honest state, not as loading. `loading` renders the
skeleton; `!loading && !context` renders a static bar that says the workspace context is not
connected yet. Remove the permanent `aria-label` and label the banner for what it is.

### B2. Four token colours fail WCAG contrast, which is why the UI looks washed out

Computed against the token hex values:

| Token, usage | Ratio | Required | Result |
|---|---|---|---|
| `--color-neutral-7` `#7A7570` body and nav text on paper | 4.37 | 4.5 | fail |
| `--color-neutral-7` on the panel background `#F5F3F0` | 4.12 | 4.5 | fail |
| `--color-neutral-6` `#9A9590` inactive nav icons | 2.85 | 4.5 | fail |
| `--color-neutral-3` `#E2DFDB` panel borders | 1.27 | 3.0 | fail |
| `--color-neutral-4` `#D1CDC8` chip borders | 1.52 | 3.0 | fail |

`docs/07-design-brief.md` section 5 promises 4.5 to 1 for text and 3 to 1 for UI borders. The
implementation does not meet its own brief. The border failures are why the placeholder panel
barely reads as a container and why the whole screen looks like a faded scan.

**Fix.** Darken the two text steps and the two border steps until they pass, keeping the warm hue.

### B3. The document contains no headings at all

`document.querySelectorAll('h1,h2,h3,h4,h5,h6')` returns an empty list. There is no `h1`, no page
title in the interface, and `main` has no heading. The product name appears only in the browser tab.

A governance tool where the user must always know which asset and which workspace they are looking
at cannot ship without a heading structure. It also breaks heading navigation for screen readers.

**Fix.** Give every route a page header region with an `h1`, and put the product name in the
interface, not only in `<title>`.

### B4. The declared typefaces are never loaded

`frontend/src/design/tokens.css:80-81` declares Inter and JetBrains Mono. Nothing loads them: no
`@font-face`, no stylesheet link, no preconnect, and neither font is a dependency. `index.html` has
no font tags. The app silently falls back to `ui-sans-serif, system-ui`, which on this machine
renders as Segoe UI.

So the typographic identity described in the brief does not exist in the product, and the
difference between the UI face and the "identifier" mono face, which the brief relies on to make
fully qualified names and privilege codes legible, is not there either.

**Fix.** Either load the fonts properly or stop claiming them. For an enterprise tool that may run
in a restricted network, a deliberately chosen system stack is the better engineering answer than a
runtime dependency on Google Fonts. Pick one, make the stack honest, and keep a genuine monospace
face for identifiers.

## Defects that make it read as machine-generated

### G1. The interface talks about its own implementation tasks

Every placeholder is written for the developer, not the user
(`frontend/src/lib/strings.ts:94-109`):

> "The Data Assets browser will be implemented in a later task. This placeholder confirms the route
> is working."

"A later task" and "confirms the route is working" are ticket language. A user has no concept of
tasks or routes. This is the clearest tell in the product that it was assembled by an agent working
through a backlog.

**Fix.** Say what the section will do and what the person can do now, in their words. Drop all
references to tasks, routes, and placeholders.

### G2. The centred rounded card floating in empty space

`frontend/src/app/routes.tsx:17-28` centres a `max-w-md` rounded, bordered, soft-background card in
a `min-h-[50vh]` flex container, with centre-aligned text. At 1440px this is one small box adrift in
about 90 percent empty screen; at 375px it is a centred paragraph with a long tail of blank page.

Content chopped into an identical rounded card with one radius and a soft border, centred in a
void, is the default generated layout. A dense administrative tool should open left-aligned, with
its structure visible even when a section has nothing in it yet.

**Fix.** Replace with a page header plus a left-aligned content region. Keep the honest "not built
yet" message, but set it as body text under the heading rather than inside a floating card.

### G3. Error and empty copy is passive, apologetic, and offers no next step

From `frontend/src/lib/strings.ts:80-91`:

- `"An unexpected error occurred."` Passive, and tells the reader nothing to do.
- `"The requested resource was not found."` Passive, and "resource" is system vocabulary. It also
  contradicts the backend, which correctly says "Not found or not visible to the application".
- `"Your session has expired. Please sign in again."`, `"Too many requests. Please wait a moment
  and try again."`, `"An upstream service is unavailable. Please try again later."` Three
  "please"s. Interface errors should not plead.
- `"Nothing to display."` An empty state should invite an action, not announce a void.

**Fix.** Active voice, second person, no "please", and every error names the next step. Align the
not-found wording with the backend's careful phrasing about visibility.

### G4. The product has no visible identity

There is no wordmark, no product name, and no owner anywhere on screen. Combined with the default
icon set, the shell could belong to any admin tool. The five rail icons are also the most
predictable possible mapping: database, shield, book, activity, gear.

**Fix.** Put the product name in the rail header. Revisit the icon for Policies, where a book is a
weak metaphor for attribute-based access rules.

## Minor

- `frontend/src/lib/strings.ts:35-39` re-declares the three mode labels that already exist as the
  `ModeLabel` union in `shared/contracts/types.ts`. Two sources of truth for a contract literal.
  Import the type instead.
- `frontend/index.html` has no `<meta name="theme-color">` and no `color-scheme` declaration.
- `frontend/src/app/ContextBar.tsx:66` puts the environment label in a `title` attribute, which is
  invisible to touch users and to keyboard users.

## Checked and correct, no action

- Landmarks are real: skip link first, `banner`, `navigation` with an accessible name, `main` with
  a matching id.
- Focus is visible on every interactive element, using `:focus-visible` with a 2px teal ring and a
  2px offset, verified by tabbing.
- The rail collapses to icons below 1024px and keeps an `sr-only` label for each item. I initially
  suspected a duplicated announcement, and verified it is not: the second span computes to
  `display: none` at desktop and the link's accessible name is exactly "Data Assets".
- `aria-current="page"` marks the active item, and the active state is carried by both colour and
  background, not colour alone.
- `prefers-reduced-motion` is honoured globally in `tokens.css:98-113`.
- No horizontal overflow at 375px.
- Placeholders do not fabricate data, which is the behaviour the specification demands.

## Expected at this stage, not defects

Empty pages, absent search, absent tables, and the unwired context bar data are all P0-05 and
later. They are not counted against the review.
