# Synthetic Screenshots

This directory stores end-to-end journey screenshots captured at desktop (1440 px) and mobile (375 px) viewports against synthetic fixture data.

Per `docs/00-spec.md` §12 and §15, fixture mode screenshots are labeled with the `synthetic-` prefix and contain only synthetic, sanitized identities, objects, and tokens.

## Captured Screens

| Screen Name | Viewports | Spec / Journey | Description |
|---|---|---|---|
| `synthetic-browse` | 1440px, 375px | Journey 1 (`grant-privilege.spec.ts`) | Data Assets browse view with catalog tree |
| `synthetic-access-tab` | 1440px, 375px | Journey 1 (`grant-privilege.spec.ts`) | Table access tab with direct and inherited grants |
| `synthetic-grant-preview` | 1440px, 375px | Journey 1 (`grant-privilege.spec.ts`) | PlanFlow preview step showing normalized change, details, unknown impact, executor |
| `synthetic-grant-outcome` | 1440px, 375px | Journey 1 (`grant-privilege.spec.ts`) | In-page Execution Outcome panel with verified badge |
| `synthetic-inherited-grant` | 1440px, 375px | Journey 2 (`inherited-grant-source.spec.ts`) | Access tab showing inherited grant with "View permissions at source" link |
| `synthetic-parent-source` | 1440px, 375px | Journey 2 (`inherited-grant-source.spec.ts`) | Navigated parent schema access view |
| `synthetic-unknown-outcome` | 1440px, 375px | Journey 3 (`unknown-outcome-reconcile.spec.ts`) | Outcome unknown panel with disabled Retry and "Check current state" |
| `synthetic-reconciled-outcome` | 1440px, 375px | Journey 3 (`unknown-outcome-reconcile.spec.ts`) | Reconciled execution outcome replacing unknown state |
