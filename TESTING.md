# Voice test script

Everything that can be checked without a microphone already passes. What is
left needs a human mouth and ears. Open **https://demo.nexbuilt.in** and work
through these in order.

Allow the microphone when prompted. Each call ends after 3 minutes of silence,
and the token endpoint allows 5 sessions per IP per hour — if the button stops
working, that limit is why.

---

## 1. She answers

Tap the button and say nothing.

- [ ] Priya greets you first, unprompted, out loud
- [ ] Her accent is Indian, female
- [ ] Button turns to the speaking state while she talks
- [ ] Ring moves with her voice

Say "hello" back.

- [ ] She responds within about a second
- [ ] The ring switches to the listening colour once she stops

## 2. Transcript

- [ ] Both sides appear, in order
- [ ] You are right-aligned, Priya left
- [ ] It scrolls to the newest message on its own
- [ ] Scroll up mid-call — it stops auto-scrolling and lets you read

## 3. She only knows what she should

Ask each, and check the answer against `lib/clinic.ts`:

- [ ] "How much is a root canal?" → eight thousand rupees
- [ ] "What time do you open on Saturday?" → 10 to 8
- [ ] "Are you open Sunday?" → closed
- [ ] "Who are your dentists?" → Dr Sharma, Dr Mehta
- [ ] "Do you do teeth whitening?" → yes, twelve thousand
- [ ] **"Do you do dental implants?"** → she must NOT invent a price. She should
      offer a callback and ask for your number. This is the important one.
- [ ] "My tooth has been aching for two days" → sympathy, then steers to a
      consultation. No diagnosis, no medicine.
- [ ] "My face is swollen and bleeding" → tells you to come in today or go to
      an emergency dentist

## 4. Book one

Say: **"I want to book a teeth cleaning."**

- [ ] She asks for one or two things at a time, not all four at once
- [ ] Give a day and time, your name, then a 10-digit number
- [ ] She reads the phone number back digit by digit
- [ ] She reads the whole booking back and waits for you to say yes
- [ ] Only after you confirm does the booking appear
- [ ] **The card slides into the right panel with a highlight** — this is the
      payoff shot
- [ ] She tells you a reference like SD-4821, matching the card
- [ ] Card shows name, service, date and time, dentist, fee

Then check the row exists: Supabase → Table Editor → `bookings`.

## 5. She refuses what she should

- [ ] Ask for **Sunday** → declines, offers two working alternatives
- [ ] Ask for **1:30 PM** → declines (lunch), offers alternatives
- [ ] Ask for **a date last week** → declines, offers future slots
- [ ] Ask for the slot you just booked → declines, offers alternatives
- [ ] Give a **5-digit phone number** → asks again politely

## 6. Interruption

While she is mid-sentence, start talking.

- [ ] She stops immediately
- [ ] She does not repeat the sentence you cut off

## 7. On a real phone, on mobile data

Turn Wi-Fi off. Open the URL on your phone.

- [ ] Mic button is pinned at the bottom and reachable without scrolling
- [ ] Whole booking completes in under 90 seconds
- [ ] Mute mic / mute speaker appear in the bar during a call
- [ ] Nothing scrolls sideways
- [ ] Try iOS Safari and Android Chrome

## 8. The stranger test

Hand your phone to someone who has never seen this. Say nothing except "try it".

- [ ] They work out what to do without being told
- [ ] They complete a booking

---

## If something is wrong

**She rambles.** Prompt problem, not UI. Edit the `HOW YOU SPEAK` section of
`buildPrompt()` in `lib/agentConfig.ts`.

**She invents a price or a service.** Tighten the `WHAT YOU KNOW` section. Do
not fix this in the UI.

**Audio sounds chipmunk or slowed.** Sample rate mismatch — `playerSampleRate`
on `<AgentProvider>` and `audio.output.sampleRate` must both be 24000.

**The button does nothing.** Check the browser console. A 429 from
`/api/deepgram-token` means the 5-per-hour limit; wait or deploy a change to
reset the instance.

**Bookings hang locally but work in production.** Your Wi-Fi is blocking
Cloudflare. Connect the VPN.
