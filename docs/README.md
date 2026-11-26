# FinalFolio documentation

Last consolidated: 2026-11-26

This folder is intentionally small. Keep the current contract and the decisions
that still guide development; move one-off reports and dated work logs to git
history instead of keeping them here.

| Document | Owns |
| --- | --- |
| `product.md` | Product surfaces, flow, architecture, integrations, privacy |
| `design-system.md` | Tokens, components, layout system and approved layout roadmap |
| `reader-and-mobile.md` | Turn.js reader model, shadows, mobile chrome, reader tests |
| `known-issues.md` | Current limitations, residual risks and regression invariants |
| `development.md` | Commands, test data, environment, deploy and release checks |

## Snapshot

- React 19 + TypeScript + Vite SPA; Express API; JSON file store.
- Surfaces: homepage, auth/legal, editor, account console, admin console, public
  reader.
- Media: local uploads with optional S3-compatible object-storage mirroring;
  UnAlbum import; URL import.
- AI arrangement: optional, admin-governed, experimental, badged in the UI.
- Deployment: Docker Compose behind Caddy; `/data` holds all persistent state.

## Documentation rules

- Write what the system does now, not what an old report hoped it would do.
- Keep durable decisions (reader shadows, font roles, delete icon rule, layout
  widths) in the five documents above.
- Put reproducible checks next to the rule they protect (`tests/e2e/...`,
  `scripts/validate-mvp.mjs`).
- Delete a dated report once its conclusions are represented here.
