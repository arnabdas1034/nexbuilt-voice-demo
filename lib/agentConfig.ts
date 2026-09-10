/**
 * The inline agent configuration handed to <AgentProvider>.
 *
 * Everything the agent knows about the business is derived from lib/clinic.ts,
 * so swapping the demo to a different client is a one-file edit.
 */

import type { AgentSessionConfig } from "@deepgram/agents";
import { clinic, serviceNames } from "./clinic.ts";

const TOKEN_ENDPOINT = "/api/deepgram-token";

/** "four thirty in the evening" reads better than "16:30" over the phone. */
function spokenTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "in the morning" : h < 17 ? "in the afternoon" : "in the evening";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} o'clock ${suffix}` : `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function todayInIst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: clinic.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildPrompt(): string {
  const services = clinic.services
    .map((s) => `- ${s.name}: ${s.priceInr} rupees, takes about ${s.durationMinutes} minutes`)
    .join("\n");

  const dentists = clinic.dentists.map((d) => `- ${d.name}, ${d.speciality}`).join("\n");

  return `You are ${clinic.receptionist}, the receptionist at ${clinic.name} in ${clinic.location}. You are speaking to a caller on the telephone.

HOW YOU SPEAK
Keep every reply to one or two short sentences. This is a phone call, not a chat window, and long answers are the worst thing you can do. Never use bullet points, numbered lists, markdown or emoji, because everything you say is read aloud. Say prices as words, so five hundred rupees rather than Rs 500. Say times naturally, so ${spokenTime("16:30")} rather than 16:30. Speak natural Indian English. Be warm and efficient without being chirpy.

WHAT YOU KNOW
The clinic is open ${clinic.hours.open} to ${clinic.hours.close}, Monday to Saturday, and closed on Sunday. Nobody is seen between ${clinic.lunch.start} and ${clinic.lunch.end} because that is the lunch break.

Our dentists:
${dentists}

Our services and prices:
${services}

That list is everything you know. Never invent a service, a price, a dentist or a policy. If a caller asks about something not on that list, tell them you will have someone call back about it, and take their name and number.

Give no medical or dental advice. If someone describes a symptom, offer brief sympathy and steer them towards booking a consultation. If someone describes severe pain, swelling or bleeding, tell them to come in as a walk-in today or visit the nearest emergency dentist, and then offer to book them in.

TAKING A BOOKING
Collect the details one or two at a time. Never ask for everything at once. You need, in this order: what service they want, the day and time they would like, their name, and their phone number.

Before you promise any slot, call check_availability. If it comes back unavailable, offer the alternatives it gives you. Once you have all four details, read the whole booking back to the caller and wait for them to confirm it. Only after they say yes, call book_appointment, and then tell them the reference number it returns.

Indian mobile numbers are ten digits. Read the number back to the caller digit by digit before you book. If they give you fewer than ten digits, politely ask again.

DURING THE CALL
Today's date is ${todayInIst()}. Work out relative days like "tomorrow" or "next Tuesday" from that, and always pass dates as YYYY-MM-DD and times as 24-hour HH:MM.

If the caller interrupts you, stop talking and listen. Do not repeat what you already said. If you miss something, ask once more; if you miss it a second time, move on gracefully. Never mention that you are an AI unless the caller asks you directly, in which case say yes honestly and carry on helping them. Never mention functions, tools, systems, APIs or databases.`;
}

const serviceEnum = `one of: ${serviceNames.join(", ")}`;

/**
 * Neither function declares an `endpoint`, which is what makes them
 * client-side: Deepgram sends a FunctionCallRequest and waits for the browser
 * to answer, so the handler can update React state directly.
 */
const functions = [
  {
    name: "check_availability",
    description:
      "Check whether a specific date and time is available before offering it to the caller. Always call this before confirming any slot.",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "24h HH:MM" },
        service: { type: "string", description: serviceEnum },
      },
      required: ["date", "time", "service"],
    },
  },
  {
    name: "book_appointment",
    description:
      "Book the appointment. Only call after the caller has confirmed the details back to you and check_availability returned available.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "the caller's full name" },
        phone: { type: "string", description: "10 digit Indian mobile" },
        service: { type: "string", description: serviceEnum },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "24h HH:MM" },
      },
      required: ["name", "phone", "service", "date", "time"],
    },
  },
];

export const greeting = `Thank you for calling ${clinic.name}, this is ${clinic.receptionist}. How may I help you today?`;

export function buildAgentConfig(): AgentSessionConfig {
  return {
    auth: {
      // Called before every connect and every reconnect. The browser never
      // sees DEEPGRAM_API_KEY.
      tokenFactory: async () => {
        const res = await fetch(TOKEN_ENDPOINT, { method: "POST" });
        if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
        return res.text();
      },
    },
    tags: ["nexbuilt", "demo", "dental"],
    audio: {
      // The SDK's session config is camelCase and owns the container field:
      // it emits container "none" for linear16, which is what Flux requires.
      input: { encoding: "linear16", sampleRate: 24000 },
      output: { encoding: "linear16", sampleRate: 24000 },
    },
    agent: {
      listen: {
        provider: {
          type: "deepgram",
          version: "v1",
          model: "nova-3",
          language: "en",
          smart_format: false,
          // Nudges recognition towards the vocabulary this clinic actually uses.
          keyterms: [...serviceNames, ...clinic.dentists.map((d) => d.name), clinic.name],
        },
      },
      think: {
        // No `endpoint`, so Deepgram uses its managed OpenAI. A bring-your-own
        // key would have to travel to the browser, which we will not do.
        provider: { type: "open_ai", model: "gpt-4o-mini", temperature: 0.7 },
        prompt: buildPrompt(),
        functions,
      },
      speak: {
        provider: { type: "deepgram", version: "v2", model: "flux-priya-en", speed: 1.0 },
      },
      greeting,
    },
  };
}
