# When a dev/prod database mismatch hid behind a "table not found" error

**Date:** May 11, 2026
**Time to diagnose:** ~45 minutes
**Time to fix:** ~5 minutes (once we understood the actual problem)

## The setup

I'd just built a public alumni signup form for the AMTA CRM and pushed the database migration up. The form was meant to write submissions to a new `alumni_claims` table. I was testing locally on `localhost:5173` and the submission was failing.

The error message looked clear enough:

> `PGRST205: Could not find the table 'public.alumni_claims' in the schema cache. Perhaps you meant the table 'public.active_contacts'`

So: PostgREST didn't know about the new table. The fix should have been simple — reload the PostgREST schema cache. I'd already done that.

## The first wrong path

Claude (my AI coding partner) and I went through the standard PostgREST cache invalidation playbook:

```sql
notify pgrst, 'reload schema';
notify pgrst, 'reload config';
```

We verified the table existed:

```sql
select count(*) from public.alumni_claims;  -- returned 0, table exists
select policyname, roles, cmd from pg_policies
  where tablename = 'alumni_claims';        -- returned all 3 policies
```

Everything looked right server-side. But the form kept failing with the same error.

We tried more aggressive cache reloads. We tried pausing/resuming the Supabase project. We waited 30 seconds between attempts.

Nothing fixed it. The submit kept failing with the same `PGRST205`.

## The second wrong path

Eventually one of us noticed something in the error message. The browser was POSTing to:

```
https://wdxgbtwshcmvmiedqjyh.supabase.co/rest/v1/alumni_claims
```

But our Supabase project ID was `ifnadlzcdtydbkqnyeif`. Two different project IDs.

That should have been the moment of clarity. Instead, Claude went *deeper* into hypothesizing — could Vercel have the wrong env var? Could there be two Supabase projects with overlapping configs? Was there a stale service worker? We confirmed the Vercel `VITE_SUPABASE_URL` matched the prod project. We checked the Supabase dashboard. Two projects existed in the account — one named `AMTA-CRM` (dev), one named `amta-crm-prod` (prod). We started questioning which one had been used for various past migrations. We started worrying about whether the prior week's cascade soft-delete migration had also gone to the wrong place.

This was all a tangent. We were piling on hypotheses about Vercel and project naming when the actual answer was simpler.

## The breakthrough

I'd been staring at the screenshot of the failing request and had a thought I almost didn't say out loud because I figured I was being naive:

> "Can you think about my hypothesis again? That we're in localhost and that we set up the dev environment earlier today? Totally get if I'm off but that's the only connection in my mind."

That was the moment. We'd added localhost to Supabase Auth redirect URLs earlier that day — separate from .env, but it was *the recent change*, and my gut connected it to "something about my local config." That nudge was enough to pull Claude out of the Vercel rabbit hole.

The answer was sitting in plain sight in every screenshot: the URL bar said `localhost:5173`. The request was going from local dev. Local dev reads `.env`. We had never checked `.env`.

```bash
$ cat .env
VITE_SUPABASE_URL=https://wdxgbtwshcmvmiedqjyh.supabase.co
```

There it was. My local environment was pointing at the dev Supabase project. The migration we ran was in prod. Local dev was hitting the dev project and (correctly) reporting that `alumni_claims` didn't exist there.

## The actual fix

Two lines in `.env`:

```bash
VITE_SUPABASE_URL=https://ifnadlzcdtydbkqnyeif.supabase.co
VITE_SUPABASE_ANON_KEY=<prod anon key>
```

And a dev server restart (Vite caches env vars at startup):

```bash
# Ctrl+C the running dev server
npm run dev
```

Form worked immediately.

Well — almost immediately. The first attempt after the .env swap, the page showed "Couldn't load the program list" — turned out I'd updated the anon key but missed the URL. The URL was still the dev one. The anon key for prod wouldn't validate against the dev URL, so we got an Invalid API key error. Same root cause, just the partial fix exposing the same problem from a different angle. One more `.env` edit and the form worked end-to-end.

## What I learned

**The URL bar in screenshots is data, and we ignored it.** Every screenshot showed `localhost:5173`. Both of us were so focused on the *error message* and what server it was coming from that we missed where the *request* was coming from. The browser doesn't care where servers live — it cares what URL the JavaScript tells it to hit, and that URL comes from local config when running locally.

**Claude wasn't wrong, just over-rotated.** The Vercel / two-project hypothesis is a real failure mode worth checking. But there's a hierarchy of "where do you look first" and "your local dev environment" should outrank "what does Vercel think" when the error is coming from `localhost:5173`. The simpler answer should have been our first check, not our fifth.

**Trust your instincts when they're grounded.** I'd been quiet about my hypothesis because Claude was clearly already deep into a confident-sounding investigation, and I didn't want to interrupt with what sounded like a naive guess. But the guess was *specific* — it connected a recent change (localhost setup) to the current symptom. That kind of "what changed recently?" thinking is the most reliable debugging heuristic there is, and I should have voiced it sooner.

**Dev vs. prod separation is a real cost.** This bug only existed because I had two Supabase projects. The "isolation" wasn't actually protecting anything (I'm the only user; both projects were equally throwaway). It just created opportunities for the two environments to drift apart. After fixing the bug, I switched local dev to point at the same database as prod and made plans to retire the dev project entirely. Sometimes the right architecture is the simpler one.

## Postscript

After fixing it, I noticed something genuinely valuable: this debugging session is *itself* an artifact worth keeping. Most of the actual diagnostic work happened in collaboration — Claude wrote the queries, I read the screenshots, we both proposed theories, we both eliminated some. But the *key insight* came from me, and it came from grounded intuition about my own recent activity, not from technical depth in Supabase. That's a real strength to lean into. I'm not a professional engineer, but I am the person who knows my system best.
