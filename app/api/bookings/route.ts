import { NextResponse } from "next/server";
import { checkAvailability, istToInstant, parseTime } from "@/lib/availability";
import { clinic, dentistFor, findService } from "@/lib/clinic";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

function reference(): string {
  return `SD-${String(Math.floor(1000 + Math.random() * 9000))}`;
}

/** "Cleaning with Dr Sharma on Friday 12 September at 11 AM" */
function confirmationSentence(service: string, dentist: string, at: Date): string {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: clinic.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(at);
  return `${service} with ${dentist} on ${parts.replace(" at ", " at ")}`;
}

export async function GET() {
  // Demo hygiene: only recent bookings, so the panel stays readable without a
  // cleanup job.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("bookings")
    .select("reference, name, service, appointment_at, duration_minutes")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("booking list failed", error);
    return NextResponse.json({ bookings: [] }, { status: 500 });
  }

  const bookings = (data ?? []).map((row) => ({
    reference: row.reference,
    name: row.name,
    service: row.service,
    appointmentAt: row.appointment_at,
    durationMinutes: row.duration_minutes,
    priceInr: findService(row.service)?.priceInr ?? 0,
    dentist: dentistFor(row.service),
  }));

  return NextResponse.json({ bookings });
}

export async function POST(req: Request) {
  try {
    const { name, phone, service, date, time } = (await req.json()) as Record<string, string>;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: "I still need the caller's name." });
    }

    const digits = (phone ?? "").replace(/\D/g, "").replace(/^(?:0|91)(?=\d{10}$)/, "");
    if (!INDIAN_MOBILE.test(digits)) {
      return NextResponse.json({
        success: false,
        error: "That phone number is not a valid ten digit Indian mobile number.",
      });
    }

    const matched = findService(service ?? "");
    if (!matched) {
      return NextResponse.json({
        success: false,
        error: `We do not offer that. Our services are ${clinic.services.map((s) => s.name).join(", ")}.`,
      });
    }

    const minutes = parseTime(time ?? "");
    const at = minutes === null ? null : istToInstant(date ?? "", minutes);
    if (!at) {
      return NextResponse.json({ success: false, error: "That date or time did not make sense." });
    }

    // Never trust the model that a slot is still free — re-check server-side.
    const { data: nearby, error: lookupError } = await supabase
      .from("bookings")
      .select("appointment_at, duration_minutes")
      .gte("appointment_at", new Date(at.getTime() - 4 * 60 * 60 * 1000).toISOString())
      .lte("appointment_at", new Date(at.getTime() + 4 * 60 * 60 * 1000).toISOString());

    if (lookupError) throw new Error(lookupError.message);

    const check = checkAvailability(date, time, matched.name, nearby ?? []);
    if (!check.available) {
      return NextResponse.json({
        success: false,
        error: "That slot is not available after all.",
        alternatives: check.alternatives,
      });
    }

    const dentist = dentistFor(matched.name);
    const row = {
      reference: reference(),
      name: name.trim(),
      phone: digits,
      service: matched.name,
      appointment_at: at.toISOString(),
      duration_minutes: matched.durationMinutes,
    };

    const { error: insertError } = await supabase.from("bookings").insert(row);
    if (insertError) throw new Error(insertError.message);

    return NextResponse.json({
      success: true,
      reference: row.reference,
      confirmed: confirmationSentence(matched.name, dentist, at),
      booking: {
        reference: row.reference,
        name: row.name,
        service: row.service,
        appointmentAt: row.appointment_at,
        durationMinutes: row.duration_minutes,
        priceInr: matched.priceInr,
        dentist,
      },
    });
  } catch (err) {
    console.error("booking failed", err);
    return NextResponse.json({
      success: false,
      error: "Something went wrong saving that booking.",
    });
  }
}
