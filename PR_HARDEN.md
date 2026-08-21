# Pull request: Harden NSA Connect for production pilot

**Base:** `main`  
**Head:** `harden-production-pass`  
**Compare:** https://github.com/sapan-khadka/NSA-Connect/compare/main...harden-production-pass?expand=1

---

## Title

```
Harden NSA Connect for production pilot
```

---

## Body (paste into GitHub PR description)

## Summary

Production-hardening pass across database, security, backend architecture, ops, and frontend consolidation — without rewriting auth to cookies yet.

- **Database:** Hot-path indexes (inbox, tasks, RSVP), FK `ondelete` rules, money `>= 0` checks, and a Postgres migration CI job
- **Security:** Upload size caps (413 before buffering), server-side logout via `token_version`, tightened CORS, API security headers, nginx CSP for the SPA, production boot guards for default secrets
- **Backend:** Shared `auth_service` for HTTP/refresh/WebSocket; SendGrid removed (Resend-only); dead `/tasks` route and frontend client removed; `/event-tasks` is canonical
- **Ops:** Frontend Docker + nginx (same-origin `/api`, `/ws`, CSP); backend healthcheck; updated `PRODUCTION.md` / runbooks
- **Frontend:** Shared member workspace hook, discussion inbox provider (deduped polling), constitution upload UI, shared Home widget renderer, checklist-task copy, removed legacy dashboard/task pages

## Commits (5)

1. `feat(db): add hot-path indexes and safer FK/check constraints`
2. `feat(security): cap uploads, revoke logout, lock CORS, and add CSP headers`
3. `refactor(api): share auth loading, drop SendGrid and the dead /tasks route`
4. `feat(ops): ship a production frontend image and tighten boot-time env checks`
5. `refactor(frontend): share workspace, inbox, and Home widget rendering`

## Test plan

- [ ] **Backend:** `cd backend && pytest -q`
- [ ] **Postgres CI path:** `pytest tests/test_postgres_migrations.py -q` (needs Postgres + pgvector)
- [ ] **Frontend:** `cd frontend && npm test && npm run build`
- [ ] **Auth:** Login → logout → old access token rejected; refresh still works until logout
- [ ] **Uploads:** Oversized file returns 413 (not 422)
- [ ] **Discussions:** Inbox rail + Discussions page share one poll (no duplicate network spam)
- [ ] **Constitution:** Board can upload PDF from NSA Documents panel; AI can search after ingest
- [ ] **Home:** Briefing layout + Edit dashboard both render widgets; no duplicate fetches on member profile / quick view
- [ ] **Docker smoke:** `docker compose --profile frontend up -d --build` → `/nginx-health` and app load

## Migration note

Run before deploy:

```bash
cd backend && alembic upgrade head
```

Head: `ac3d4e5f6a7b`

## Out of scope (follow-ups)

- httpOnly cookie auth (tokens still in `localStorage`)
- Per-token JTI revocation (logout bumps `token_version` for all sessions)

---

## CLI (optional, after `brew install gh`)

```bash
gh pr create --base main --head harden-production-pass \
  --title "Harden NSA Connect for production pilot" \
  --body-file PR_HARDEN.md
```

Note: strip the title/compare sections from the body file if `gh` includes the whole file — or copy only the **Body** section above.
