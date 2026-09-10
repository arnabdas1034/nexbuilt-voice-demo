import { NextResponse } from "next/server";
import { checkAvailability } from "@/lib/availability";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bookings that could overlap anything on or around the requested day. */
async function bookingsNear(date: string) {
  const from = new Date(`${date}T00:00:00+05:30`);
  const to = new Date(from);
  // The alternatives search reaches a week either side, so load that much.
  from.setUTCDate(from.getUTCDate() - 8);
  to.setUTCDate(to.getUTCDate() + 9);

  const { data, error } = await supabase
    .from("bookings")
    .select("appointment_at, duration_minutes")
    .gte("appointment_at", from.toISOString())
    .lte("appointment_at", to.toISOString());

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function POST(req: Request) {
  try {
    const { date, time, service } = (await req.json()) as {
      date?: string;
      time?: string;
      service?: string;
    };

    if (!date || !time || !service) {
      return NextResponse.json(
        { available: false, reason: "outside_hours", alternatives: [] },
        { status: 400 },
      );
    }

    const existing = await bookingsNear(date);
    return NextResponse.json(checkAvailability(date, time, service, existing));
  } catch (err) {
    console.error("availability check failed", err);
    return NextResponse.json(
      { available: false, reason: null, alternatives: [], error: "lookup_failed" },
      { status: 500 },
    );
  }
}
