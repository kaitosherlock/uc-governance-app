# 07 — Product brief, information architecture, and visual direction

Owner: Antigravity (frontend). Consult the `ui-ux-pro-max` and `frontend-design` skills when
building; run `web-design-guidelines` in Phase 6. This brief is the input to the token system in
`frontend/src/design/tokens.css`.

## 1. Product brief

**One sentence:** a calm, precise work tool that lets a non-security-specialist find a Unity
Catalog asset, understand who can see it and why, and change that safely.

**Users and their first question**

| User | First question | Screen that answers it |
|---|---|---|
| Data Steward | "Is this table described, owned, tagged correctly?" | Asset overview |
| Data Engineer | "Why can't my job read `sales.crm.orders`?" | Access tab, source column |
| Access Administrator | "Give team X SELECT here, safely." | PlanFlow |
| Auditor | "Who changed access on this last month?" | Activity (Databricks audit tab) |
| Platform Admin | "Which workspaces can see this catalog?" | Platform → Bindings |

**Non-goals:** dashboards with invented KPIs, "compliance score", charts without data, undo.

## 2. Information architecture

Primary navigation (left rail, collapsible to icons at < 1024 px):

1. **Data Assets** (default route) — browse/search, asset detail with tabs Overview · Access · Tags · Lineage · Quality
2. **Access Management** — grant/revoke/ownership queue, Requests & approvals, Access reviews
3. **Policies** — ABAC policies, Row filters & masks, Governed tags
4. **Activity** — Databricks audit · Application activity · Findings (three clearly separated tabs)
5. **Platform** (separated, below a divider) — Storage & credentials, External locations, Workspace bindings, Connections, Sharing, Metastore (Account API)

Navigation items render only when `/capabilities` reports the domain as anything other than
`not_implemented`; a domain that is `not_configured` renders with a lock icon and explanation, not
hidden, so users learn what is missing.

**Persistent context bar** (top): Mode badge (`Demo — synthetic data` / `Read-only` /
`Editing enabled`) · Environment label chip (e.g. `PROD`, rendered with a striped border **and**
text, never color alone) · Workspace host · Managed scope · Signed-in actor · Executor identity.

**Breadcrumbs:** `Catalog / Schema / Object` always visible on asset routes; each segment is a link;
long names truncate in the middle with full FQN on hover and a copy button.

## 3. Primary task flows

**Flow A — Understand access (read-only)**
Search "orders" → results show FQN, type icon + text, owner → open → Access tab →
table: Principal · Type · Privilege (label + code) · Source (Direct / Inherited from schema
`sales.crm` / Inherited from catalog `sales` / Unknown) · Actions → limitations line under table:
"Showing grants visible to the application. Group membership was not loaded; access through groups
is not shown."

**Flow B — Grant** (3 steps in a right-side panel, not a modal, so the table stays visible)
1. Choose principal (search) and privileges (only valid for this securable; existing direct grants
   pre-marked) + reason (required, ≤ 200 chars).
2. Preview: exact change ("GRANT SELECT ON TABLE sales.crm.orders TO `analysts`"), prerequisites
   note ("`analysts` also needs USE_CATALOG on sales and USE_SCHEMA on sales.crm — not included"),
   inheritance note, executor sentence, impact block with Known / Unknown lists, expires-in timer.
3. Apply → result stays in the panel: "Direct SELECT grant to `analysts` on sales.crm.orders —
   verified by read-back at 09:14:02Z" with per-target rows for batches.

Editing step 1 after preview collapses step 2 with "Preview outdated — regenerate".

**Flow C — Revoke**: action labeled exactly "Revoke SELECT"; disabled for inherited rows with
inline reason and "View permissions at source" link. Success text: "Direct SELECT grant revoked."
plus the standing note about other sources.

**Flow D — Destructive** (delete, unbind, drop filter): full-page confirmation region with
dependency list (or "Dependencies unknown"), consequences per object type, typed-name input.

**Flow E — Unknown outcome**: result panel state "Outcome unknown" with "Check current state"
button (reconcile) and disabled "Retry" until reconcile completes.

## 4. Visual direction

**Character:** ledger-like precision. Think well-set financial statements, not a marketing site.
Restrained, high-contrast, dense but breathable; the data is the interface.

**Typography**
- UI: `Inter` (variable) or `IBM Plex Sans` — one family. Sizes: 12/13/14/16/20/24 px, line-heights 1.4–1.5.
- Identifiers (FQNs, privilege codes, principal names): `JetBrains Mono` or `IBM Plex Mono`, 13 px,
  tabular numerals. Codes always monospace so `SELECT` reads as a code, not a word.
- Weights: 400 body, 500 labels, 600 headings. No 700+.

**Color tokens** (`:root`, plus dark variant later if time permits; light is primary)
- Neutrals: 11-step warm-gray scale (paper `#FBFAF8` → ink `#1B1A17`).
- Accent (interactive): deep teal `#0F6E68` (links, primary buttons). Not purple.
- Status: success green `#1E7B4E`, warning amber `#9A6700`, danger red `#B42318`, info slate
  `#3B5B7A`, unknown violet-gray `#5F5A70` — each **always paired with an icon and text**.
- Source badges: Direct = solid ink outline; Inherited = dashed outline + arrow icon; Unknown = dotted.
- Mode: Demo = amber left border on the context bar + label; Read-only = slate; Editing enabled = teal.
- Environment: PROD chip uses a hatched border pattern in addition to text.

**Spacing/density:** 4 px base; table row 36 px (compact) / 44 px (comfortable) toggle; panels
560 px wide on desktop, full-width sheet below 1024 px.

**Radii:** 4 px controls, 6 px panels. **Elevation:** one level only (panel shadow); everything
else uses borders.

**Focus:** 2 px accent ring with 2 px offset on all interactive elements; never removed.

**Motion:** 120–160 ms opacity/transform only; fully disabled under `prefers-reduced-motion`.

## 5. Accessibility commitments

- Semantic table markup with `<th scope>`; sortable headers announce state.
- Panels/dialogs: focus trapped, returned on close, `aria-labelledby`, `Esc` closes non-destructive panels only.
- Every status badge = icon + text; contrast ≥ 4.5:1 for text, ≥ 3:1 for UI borders.
- Form errors inline, associated via `aria-describedby`, summarized at top for batches.
- Keyboard: `/` focuses search; row actions reachable by Tab; no hover-only content.
- Test at 375 px, 1024 px, 1440 px and 200 % zoom; document remaining manual WCAG 2.2 AA checks.

## 6. Copy rules (English)

- Verbs first: "Revoke SELECT", "Transfer ownership", "Check current state".
- Never "Nobody has access"; use "No grants visible to the application on this object."
- Never "Secure", "Compliant", "PII protected". Use observed facts with timestamps.
- Ephemeral history header: "Activity in this session".
- Executor sentence, always: "You are requesting this change. It will be executed by the
  application's service principal `{name}`."
