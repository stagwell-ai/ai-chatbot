# Moving this project to another GitHub account and Vercel project

Written 2026-09-24, from the project as it stands. Everything here was checked
against the live Vercel project rather than remembered.

## What does and does not travel

The repo is self-contained: **no dependencies, no build step**. Framework
preset in Vercel is **Other**, build command empty, output directory empty.
`vercel.json` carries every route, so the URL structure moves with the code.

Three things are gitignored and will NOT come with you:

    .vercel/     the link to the old Vercel project — you want a new one
    .env*        the variables below, which have to be re-entered by hand
    .claude/     local tool settings, not needed

The repository is large: ~630 MB packed, almost all of it video under
`assets/`. The largest single file is 36 MB, so it is under GitHub's 100 MB
limit and does NOT need LFS — the first push is just slow.

## 1. Push

    git remote add new https://github.com/OWNER/REPO.git
    git push new main

Keeping the history is worth it: a lot of why-it-is-this-way lives in the
commit messages, and the next person reading this repo may be an AI.

## 2. Import into Vercel

New Project → the repo → **Framework Preset: Other**. Leave build and output
empty. Deploy.

## 3. Environment variables

Seventeen in production. These you must fetch from their source:

| Variable | Where it comes from |
|---|---|
| `HUBSPOT_ACCESS_TOKEN` | HubSpot → Development → Keys → Service keys |
| `OPENAI_API_KEY` | OpenAI dashboard |
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | the Kimi gateway |
| `CALLBACK_WEBHOOK_URL` | the Make.com scenario (a write endpoint — server only) |
| `KIMI_HEALTH_TOKEN` | arbitrary; generate a new one |

These are not secret and are recorded here so the move is not blocked on
finding them:

    HUBSPOT_PORTAL_ID=24060959
    HUBSPOT_OWNER_ID=29286122
    HUBSPOT_LIFECYCLE_STAGE=marketingqualifiedlead
    HUBSPOT_FORM_GUID=be36ba60-e0ba-4fb4-ac43-6fbcdb91e6c4
    HUBSPOT_FORM_FIELD_MAP=email:work_email,lastname:,phone:,company:
    HUBSPOT_FORM_PRODUCT_ALIASES=Machine OS:The Machine
    KIMI_PRIMARY_MODEL=kimi/kimi-for-coding-highspeed
    KIMI_SECONDARY_MODEL=openai/gpt-4o-mini
    VOICE_MODEL=gpt-realtime
    VOICE_NAME=marin

And two that are NOT set today but should be on the new project, because the
code otherwise falls back to hard-coded defaults naming the old domain:

    SITE_ORIGIN=https://<the new domain>
    SITE_HOSTS=<every hostname the site answers on, comma separated>

`.env.example` documents what each one does. The site runs without any of
them — no HubSpot token means lead capture runs in mock mode and logs what it
would have sent.

## 4. The new domain has to be registered in three places

This is the step that fails silently, and it cost a day when it was missed.

1. **HubSpot → Settings → Tracking & Analytics → Tracking Code → Domains.**
   A form submission from a domain HubSpot does not know is answered `200`
   and then quarantined as "Unregistered Site Domain" in Marketing → Forms →
   Spam Submissions. No contact, no workflow, no error anywhere.
2. **`SITE_HOSTS`** on the Vercel project, as above.
3. **Contentsquare**, so its tag accepts the new domain.

## 5. Verify, do not assume

    GET  /                  rewrites to next/home-c.html
    GET  /api/lead          405 with an `allow: POST` header
    GET  /hubspot-setup     the admin page loads
    POST the Book a demo form with a real address, then check the contact in
         HubSpot AND that a form submission was recorded, not quarantined

## Known, still outstanding

- **46 files carry a hard-coded host**, mostly `<link rel="canonical">`
  pointing at `stagwell.vercel.app` — already the wrong domain today. Worth
  fixing as part of the move, since domains are being touched anyway.
- The Mixpanel token in `next/mixpanel.js` and the Contentsquare tag id in
  `next/consent.js` are client-side and travel with the code; check they point
  at the right accounts.
- A visitor's consent choice is stored per-domain, so moving resets everyone
  to "not asked".
