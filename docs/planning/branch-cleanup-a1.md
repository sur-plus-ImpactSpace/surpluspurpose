# Branch-Cleanup — Vorbereitung für A1 (Flo-Freigabe)

Stand: 2026-07-19 · Bezug: `abstimmung-flo-2026-07-19.md` Punkt **A1** · Status: **wartet auf Flos OK, NICHTS ausgeführt**

> **Analyse-Basis:** `git branch -r --merged origin/main`. „Sicher löschbar" = vollständig
> in `main` enthalten, keine eigenen unveröffentlichten Commits. Ausführung erst nach Freigabe.

## Zusammenfassung

| Kategorie | Anzahl | Aktion |
|---|---|---|
| Remote-Branches gesamt | 45 | — |
| **Sicher löschbar (in main gemergt)** | **38** | löschen nach A1-Freigabe |
| Dependabot (nicht gemergt) | 4 | → **A2**: einzeln per PR mergen/schließen |
| Behalten | 3 | `main`, `develop`, `feature/anforderungskatalog` |

---

## A) Sicher löschbar — 38 Branches (alle in `main` gemergt)

### `codex/*` — 32 Branches (Alt-Automation, alle gemergt)
```
codex/e0-repo-stack-ci                     codex/e4-idempotency-rpc
codex/e1-data-repository-seam              codex/e4-persistent-idempotency
codex/e10-service-chat-api                 codex/e4-production-mvp-architecture
codex/e11-service-chat-realtime            codex/e5-agent-action-api
codex/e12-supabase-auth-boundary           codex/e5-agent-live-review-boundary
codex/e13-ssr-session-hydration            codex/e5-agent-run-api-boundary
codex/e14-session-refresh-provisioning     codex/e6-access-flow-polish
codex/e15-invitation-provisioning          codex/e6-dashboard-ux-foundation
codex/e16-invite-email-admin               codex/e6-role-based-dashboard
codex/e17-dashboard-invite-create          codex/e7-production-route-runtime
codex/e18-invitation-revoke-controls       codex/e8-persistent-agent-loop
codex/e19-invitation-resend-rotation       codex/e9-dashboard-action-controls
codex/e2-supabase-auth-persistence         codex/e3-entitlement-enforcement
codex/e20-invitation-delivery-observability codex/e3-invitation-api-boundary
codex/e3-loop-engineering                  codex/e3-seat-invitation-enforcement
codex/e4-api-idempotency-guard             codex/e4-api-rate-limit-guard
```

### `feat/*` + `refactor/*` — 5 Branches (gemergt)
```
feat/c1-transition-rpc
feat/c2-create-rpcs
feat/customer-loop-match-confirm
feat/demo-login-split
refactor/dashboard-split
```

### `staging` — 1 Branch
- `main` ist **69 Commits voraus**, `staging` **0** → vollständig in main enthalten.
- Ersetzt durch `develop`. **Sicher löschbar.**

---

## B) Dependabot — 4 Branches → NICHT hier löschen (gehört zu A2)

Diese sind **nicht** in main gemergt (sie tragen die Dependency-Bumps):
```
dependabot/github_actions/actions/checkout-7
dependabot/github_actions/actions/setup-node-6
dependabot/github_actions/pnpm/action-setup-6
dependabot/npm_and_yarn/app-dependencies-64422c8fc6
```
→ **A2-Beschluss abwarten:** einzeln per PR mergen (grüner CI) oder schließen. Erst danach entfernt Dependabot sie selbst.

---

## C) Behalten
```
main                        (Production)
develop                     (Integration)
feature/anforderungskatalog (aktuelle Arbeit — Meeting-Docs)
```

---

## Ausführung — ERST nach A1-Freigabe (hier nur dokumentiert)

**Trockenlauf (zeigt nur an, löscht nichts):**
```bash
git branch -r --merged origin/main \
  | grep -vE 'origin/(main|develop|HEAD)' | grep -v 'dependabot'
```

**Löschen (nach Flos OK) — codex/feat/refactor + staging:**
```bash
git branch -r --merged origin/main \
  | grep -vE 'origin/(main|develop|HEAD)' | grep -v 'dependabot' \
  | sed 's#origin/##' \
  | xargs -I{} git push origin --delete {}
```
> Sicherheit: `--merged origin/main` schließt aus, dass ungemergte Arbeit (inkl. der 4 Dependabot-
> und `feature/anforderungskatalog`) getroffen wird. Vorher lokal `git fetch --prune` + Trockenlauf sichten.
