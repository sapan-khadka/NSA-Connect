# RSVP legacy data cleanup

Before deploying the RSVP default-state fix, review existing `event_rsvps` rows that may count members as **Going** without an intentional response.

## What changed

- **No response** = no row in `event_rsvps` for that member/event pair.
- **Going / Maybe / Not going** = a row exists with that `status`, set only when the member clicks an RSVP option (or legacy `POST /rsvp`, which explicitly sets Going).

## Why automatic cleanup is not safe

We **cannot reliably tell** which existing `going` rows are false positives:

| Source | What happened |
|--------|----------------|
| Legacy RSVP (pre–three-state) | Any `POST /rsvp` created a row; that meant “going” with no Maybe/Not going option |
| Migration `h1a2b3c4d5e6` | `UPDATE event_rsvps SET status = 'going' WHERE status IS NULL` backfilled all existing rows |
| Explicit Going (new UI) | First `PUT /rsvp` with `status: "going"` also sets `created_at == updated_at` |

Because `created_at = updated_at` matches both migrated defaults and a member’s first explicit Going click, **do not run bulk deletes based on timestamps alone**.

## Review queries (run against your database)

Rows that *might* be legacy defaults (manual review only):

```sql
SELECT
  er.id,
  er.event_id,
  e.title AS event_name,
  e.starts_at,
  er.member_id,
  m.full_name,
  er.status,
  er.created_at,
  er.updated_at
FROM event_rsvps er
JOIN events e ON e.id = er.event_id
JOIN members m ON m.id = er.member_id
WHERE er.status = 'going'
ORDER BY e.starts_at DESC, m.full_name;
```

Upcoming events where inflated Going counts matter most:

```sql
SELECT
  e.id,
  e.title,
  e.starts_at,
  COUNT(*) FILTER (WHERE er.status = 'going') AS going_count,
  COUNT(*) AS total_rsvp_rows
FROM events e
LEFT JOIN event_rsvps er ON er.event_id = e.id
WHERE e.starts_at > NOW()
GROUP BY e.id, e.title, e.starts_at
ORDER BY e.starts_at;
```

## If you need to reset false positives

Only after manual review (e.g. confirm with members or board):

```sql
-- Example: remove a specific member’s RSVP for one event
-- DELETE FROM event_rsvps
-- WHERE event_id = :event_id AND member_id = :member_id;
```

Removing a row sets that member back to **no response** in the app.

## After deploy

- Board attendee view shows **Not yet responded** separately from Going.
- Members with no row see no selected RSVP pill and a “You haven’t RSVP’d yet” prompt on upcoming events.
