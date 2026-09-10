# NexBuilt — Live AI Voice Receptionist Demo

A public demo page that proves the voice agent works. A stranger opens the URL
on their phone, taps one button, talks to an AI receptionist, books an
appointment, and watches the booking appear on screen. No signup, no login.

The demo business is **Sunrise Dental Clinic**, Green Park, New Delhi — a
fictional clinic. Every booking made here is fake.

**Live:** https://demo.nexbuilt.in

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript |
| Styling | Tailwind CSS v4, design tokens lifted from nexbuilt.in |
| Voice | `@deepgram/react` — Deepgram Voice Agent |
| Speech-to-text | `nova-3` |
| Text-to-speech | `flux-priya-en` (Flux v2, Indian English, female) |
| LLM | `gpt-4o-mini` via Deepgram's managed OpenAI |
| Database | Supabase (Postgres only, no auth) |
| Hosting | Vercel |

---

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

### Environment variables

All server-side. **None may carry a `NEXT_PUBLIC_` prefix** — that would ship
the value to the browser.

| Variable | Where to get it |
|---|---|
| `DEEPGRAM_API_KEY` | console.deepgram.com → API Keys. Must be **Member scope or higher**, or `/v1/auth/grant` returns `FORBIDDEN`. |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API Keys → **Secret keys** (`sb_secret_…`). Not the publishable key. |
| `VERCEL_TOKEN` | Deploy only, never read at runtime. vercel.com → Account Settings → Tokens |

There is deliberately **no `OPENAI_API_KEY`**. Deepgram supplies a managed
OpenAI LLM when `agent.think` has no `endpoint`. Bringing your own key would
mean putting it in the agent config, which is built in the browser — so the key
would ship to every visitor. See "Design decisions" below.

### Database

Run this once in the Supabase SQL Editor:

```sql
create table bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  name text not null,
  phone text not null,
  service text not null,
  appointment_at timestamptz not null,
  duration_minutes int not null,
  created_at timestamptz not null default now()
);

create index on bookings (appointment_at);

-- All access is server-side via the secret key, which bypasses RLS.
-- RLS on with zero policies means anon/publishable keys can read nothing.
alter table bookings enable row level security;
```

---

## Checks

```bash
npm test              # slot logic: opening hours, lunch, overlaps, past dates
npm run build         # production build + TypeScript
npm run verify:secrets # fails if any secret appears in the client bundle
npm run verify:agent   # sends the real Settings to Deepgram, expects SettingsApplied
```

`verify:agent` is the useful one when changing the voice, prompt or function
definitions: it validates the whole payload against Deepgram without needing a
microphone. It opens a socket for about a second, so the cost is negligible.

---

## Swapping in a different business

Edit **`lib/clinic.ts`** and nothing else. It is the single source of truth for
the name, location, opening hours, lunch break, staff, services, prices and
durations. The system prompt, the greeting, the function parameter
descriptions, the speech-recognition keyterms and the UI copy are all derived
from it.

```ts
export const clinic = {
  name: "Sunrise Dental Clinic",
  location: "Green Park, New Delhi",
  receptionist: "Priya",
  hours: { open: "10:00", close: "20:00" },
  lunch: { start: "13:00", end: "14:00" },
  closedWeekdays: [0],          // 0 = Sunday
  dentists: [...],
  services: [{ name, priceInr, durationMinutes }, ...],
};
```

Two things to check after a swap:

1. `dentistFor()` in the same file routes services to staff by a regex. Adjust
   it if the new business splits work differently.
2. The greeting and prompt are generated, but read them once aloud. Prices are
   spoken as words, so a service named oddly may sound wrong.

To change the voice, edit `agent.speak.provider.model` in `lib/agentConfig.ts`.
Flux voices are `flux-{voice}-{language}`; the Indian-accent ones are
`flux-priya-en`, `flux-meena-en` and `flux-naveen-en`.

---

## How it works

```
browser ── POST /api/deepgram-token ──► Deepgram /v1/auth/grant
   │                                     (300s token, plain text)
   ▼
Deepgram Voice Agent  ◄── mic audio ──┐
   │  nova-3 → gpt-4o-mini → flux-priya-en
   │                                   │
   └── FunctionCallRequest ────────────┘
          │
          ▼  handled in the browser (no `endpoint` on the definition)
     POST /api/availability   → slot logic + Supabase
     POST /api/bookings       → validate, re-check, insert
          │
          └─► React state updates, the panel animates immediately
```

Both functions are client-side on purpose: the handler runs in the browser, so
it can push a new booking straight into React state and the panel animates the
instant the booking lands. A server-side function would need polling or a
realtime subscription to get the same effect.

The handlers only ever call our own API routes. The browser never touches
Supabase.

### Trust boundaries

The model is never trusted. `/api/bookings` independently validates the phone
number against `/^[6-9]\d{9}$/`, confirms the service exists in `clinic.ts`,
and **re-runs the availability check server-side** before inserting. A failure
returns `{ success: false, error }` so the agent can recover in conversation
rather than crashing.

---

## Design decisions

**No OpenAI key.** The agent config is built in the browser. Bringing your own
LLM key means putting it in `think.endpoint.headers`, which would ship it to
every visitor. Deepgram's managed OpenAI costs marginally more per minute and
leaks nothing.

**Client-side functions.** Chosen for the instant panel animation, as above.

**Rate limiting.** `/api/deepgram-token` allows 5 sessions per IP per hour, held
in an in-memory `Map`. It resets on cold start, which is the right trade for a
demo — it stops casual abuse without needing Redis.

**Idle timeout.** Sessions disconnect after 3 minutes without activity. An
abandoned tab otherwise holds a socket open and bills for it.

**`autoStart` is false.** Auto-connecting would burn credits on every page load,
including crawlers.

**Dates.** The model produces relative dates like "tomorrow". The prompt gives
it today's date in IST, and every date it returns is validated server-side.
India has one fixed UTC offset and no daylight saving, so `lib/availability.ts`
uses a +05:30 constant rather than a timezone library.

**Theme.** Dark by default, matching nexbuilt.in, with the same header toggle
and the same blocking inline script to prevent a flash. All colours come from
CSS custom properties in `app/globals.css`, taken from the live site. No
component hardcodes a colour.

---

## Deviations from the original build spec

Each of these was verified against the installed SDK's type definitions or the
live API, not guessed.

| # | Spec said | Reality |
|---|---|---|
| 1 | `OPENAI_API_KEY` for the think provider | Omitted. Deepgram's managed OpenAI needs no key, and a BYO key cannot reach the browser safely. |
| 2 | Next.js 15 | Next.js 16 — current release from `create-next-app`. |
| 3 | Tokens wired into `tailwind.config.ts` | Tailwind v4 is CSS-first; tokens live in `@theme inline` in `globals.css`. |
| 4 | Handler receives `fn.input` | The type is `fn.arguments`, a JSON string. |
| 5 | `agent.language` | Deprecated; language moved to `listen.provider.language`. |
| 6 | Flux `speed` range 0.5–1.5 in 0.05 steps | Flux accepts only 0.85/0.9/0.95/1.0/1.05/1.1/1.15. We use 1.0. |
| 7 | `audio.output.container: "none"` | The session config is camelCase (`sampleRate`) and has no `container` field; the SDK owns it. |
