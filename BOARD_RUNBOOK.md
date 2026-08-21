# Board runbook — NSA Connect (SEMO chapter pilot)

Short ops guide for the chapter board. Tech on-call should keep [PRODUCTION.md](PRODUCTION.md) and [BACKUPS.md](BACKUPS.md) nearby.

## Roles

| Who | Does what |
|-----|-----------|
| **Org owner** (allowlisted Gmail in `ORG_OWNER_EMAILS`) | Approves pending members, appoints president/board/treasurer. Shown as **Owner** — not President. |
| **President** | Day-to-day chapter control: events, tasks, role promotions after appointment |
| **Treasurer** | Finance entries, receipts, dues follow-ups |
| **Board** | Approvals, events, tasks, announcements |
| **General members** | RSVP, tasks assigned to them, profile, discussions |

## First-week setup

1. If the database still has demo/fake members, wipe locally:
   `python -m scripts.reset_chapter_data --yes`
2. Owner registers with the allowlisted Gmail (or an admin runs `python -m scripts.seed_chapter_owner` from `backend/` with `ORG_OWNER_EMAIL` / `ORG_OWNER_PASSWORD` set).
3. Board candidates register with `@semo.edu` + student ID, then **verify their email** via the link Resend sends (status stays **pending** until verified + approved). Unverified fakes never appear in Pending.
4. Owner opens **Members → Pending**, approves each verified person.
5. Owner sets one approved member to **President** (and others to board/treasurer).
6. Create one event, RSVP as a member, add one prep task, log one finance entry — smoke path below.

## Smoke checklist (after deploy or semester start)

- [ ] Owner can sign in
- [ ] SEMO student registers → verifies email → pending → approve → can sign in
- [ ] Fake / unreachable `@semo.edu` cannot verify and never shows in Pending
- [ ] Promote one member to board
- [ ] Create event → RSVP → optional check-in
- [ ] Assign / complete a prep task
- [ ] Treasurer logs a finance entry with receipt (Cloudinary URL)
- [ ] Password reset email arrives for a test account
- [ ] Announcement or welcome email path works (provider not in override mode)

## Approving members

1. Sign in as board or owner.
2. Open pending approvals (only email-verified signups appear).
3. Approve or reject. Approved members get a welcome email when email is enabled.

## Email verification (SEMO)

1. After register, the student opens the link in their `@semo.edu` inbox (`/verify-email?token=…`).
2. Until they verify, they cannot sign in and board cannot approve them.
3. Tech: set `RESEND_API_KEY` (and `FRONTEND_URL`). Without Resend, the API logs the verify URL for local debugging only.

## Password reset

1. Member uses **Forgot password** on the guest shell with their account email.
2. They must receive mail from Resend. If nothing arrives:
   - Confirm `EMAIL_ENABLED=true` and provider keys on the API + worker.
   - Confirm `EMAIL_TEST_OVERRIDE_RECIPIENT` is empty in production.
   - Check Celery worker is running (reset email is async where configured).
   - Ask tech to inspect provider dashboards / API logs — do not invent temporary passwords in chat.

## When email fails

- Tell members to retry later; do not share password hashes or disable auth.
- Tech: verify provider keys, from-address domain auth, Celery, and that override recipient is unset.
- Approvals and in-app work still function; only outbound mail is blocked.

## Ownership recovery

If the chapter has no org owner:

```bash
cd backend
python -m scripts.ensure_org_owner --email you@example.com
# transfer only if needed:
python -m scripts.ensure_org_owner --email you@example.com --force
```

Prefer promoting the allowlisted Gmail account.

## Monitoring expectations

- Someone watches `/health` uptime.
- Failed backups should page tech (see BACKUPS.md alerts).
- Product bugs: capture URL, role, and approximate time; avoid sharing other members’ PII in public channels.
