/**
 * Mints a short-lived Deepgram token for the browser.
 *
 * Returns PLAIN TEXT, not JSON: the SDK's tokenFactory calls res.text() and
 * hands the result straight to the socket, so a JSON body fails silently.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deepgram's default TTL is 30 seconds, which a slow mobile handshake outlives. */
const TTL_SECONDS = 300;

const SESSIONS_PER_HOUR = 5;
const WINDOW_MS = 60 * 60 * 1000;

// A public page needs some brake on token minting or one visitor can drain the
// account. An in-memory map resets on cold start, which is fine for a demo.
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= SESSIONS_PER_HOUR) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);

  // Opportunistic cleanup so the map cannot grow without bound.
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }
  return false;
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return new NextResponse("Server is missing DEEPGRAM_API_KEY", { status: 500 });
  }

  if (rateLimited(clientIp(req))) {
    return new NextResponse("Too many sessions from this address. Try again later.", {
      status: 429,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl_seconds: TTL_SECONDS }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Deepgram token grant failed", res.status, detail);
    return new NextResponse("Could not start a session right now.", { status: 502 });
  }

  const { access_token } = (await res.json()) as { access_token: string };

  return new NextResponse(access_token, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
