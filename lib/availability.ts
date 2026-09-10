/**
 * Slot logic. Pure functions — no database, no network, no clock reads except
 * the `now` you pass in, so this stays testable.
 *
 * India has a single fixed UTC offset (+05:30) and no daylight saving, so a
 * plain offset is safe here and avoids pulling in a timezone library.
 */

import { clinic, findService } from "./clinic.ts";

const IST_OFFSET_MINUTES = 5 * 60 + 30;
const SLOT_STEP_MINUTES = 30;
const MAX_ALTERNATIVE_DAYS = 7;

export type UnavailableReason =
  | "closed"
  | "outside_hours"
  | "lunch"
  | "past"
  | "booked"
  | "unknown_service";

export type ExistingBooking = {
  /** ISO 8601 instant, as stored in Postgres `timestamptz`. */
  appointment_at: string;
  duration_minutes: number;
};

export type AvailabilityResult = {
  available: boolean;
  reason: UnavailableReason | null;
  /** Exactly two suggestions when unavailable: nearest earlier, nearest later. */
  alternatives: string[];
};

/** Minutes since midnight, from "HH:MM". */
export function parseTime(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatTime(minutesSinceMidnight: number): string {
  const h = Math.floor(minutesSinceMidnight / 60);
  const m = minutesSinceMidnight % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" + minutes-since-midnight in IST -> the matching UTC instant. */
export function istToInstant(date: string, minutesSinceMidnight: number): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!m) return null;
  const utcMidnight = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const instant = new Date(utcMidnight + (minutesSinceMidnight - IST_OFFSET_MINUTES) * 60_000);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/** The civil date and weekday in IST for a given instant. */
export function istParts(instant: Date): { date: string; minutes: number; weekday: number } {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MINUTES * 60_000);
  return {
    date: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

export function addDays(date: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const openMinutes = parseTime(clinic.hours.open)!;
const closeMinutes = parseTime(clinic.hours.close)!;
const lunchStart = parseTime(clinic.lunch.start)!;
const lunchEnd = parseTime(clinic.lunch.end)!;

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Why this slot cannot be booked, ignoring existing bookings.
 * Returns null when the slot is structurally fine.
 */
function scheduleProblem(
  date: string,
  minutes: number,
  durationMinutes: number,
  now: Date,
): UnavailableReason | null {
  const start = istToInstant(date, minutes);
  if (!start) return "outside_hours";

  const { weekday } = istParts(start);
  if ((clinic.closedWeekdays as readonly number[]).includes(weekday)) return "closed";

  if (start.getTime() < now.getTime()) return "past";

  const end = minutes + durationMinutes;
  if (minutes < openMinutes || minutes >= closeMinutes) return "outside_hours";
  if (end > closeMinutes) return "outside_hours";
  if (overlaps(minutes, end, lunchStart, lunchEnd)) return "lunch";

  return null;
}

function isFree(
  date: string,
  minutes: number,
  durationMinutes: number,
  existing: ExistingBooking[],
): boolean {
  const start = istToInstant(date, minutes);
  if (!start) return false;
  const startMs = start.getTime();
  const endMs = startMs + durationMinutes * 60_000;

  return !existing.some((booking) => {
    const bStart = new Date(booking.appointment_at).getTime();
    if (Number.isNaN(bStart)) return false;
    const bEnd = bStart + booking.duration_minutes * 60_000;
    return startMs < bEnd && bStart < endMs;
  });
}

/**
 * Every bookable start time on `date`, snapped to 30-minute boundaries.
 */
function validSlotsOn(
  date: string,
  durationMinutes: number,
  existing: ExistingBooking[],
  now: Date,
): number[] {
  const slots: number[] = [];
  const firstSlot = Math.ceil(openMinutes / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;
  for (let m = firstSlot; m < closeMinutes; m += SLOT_STEP_MINUTES) {
    if (scheduleProblem(date, m, durationMinutes, now)) continue;
    if (!isFree(date, m, durationMinutes, existing)) continue;
    slots.push(m);
  }
  return slots;
}

/**
 * Nearest free slot before the request and nearest free slot after it.
 * Searches the requested day first, then outward a week either side.
 */
export function findAlternatives(
  date: string,
  minutes: number,
  durationMinutes: number,
  existing: ExistingBooking[],
  now: Date = new Date(),
): string[] {
  const requested = istToInstant(date, minutes);
  const target = requested?.getTime() ?? now.getTime();

  // A request for a past date has no future slots near it, so search forward
  // from today instead of around the date the caller named.
  const anchor = requested && requested.getTime() >= now.getTime() ? date : istParts(now).date;

  const candidates: { at: number; label: string }[] = [];
  for (let offset = -MAX_ALTERNATIVE_DAYS; offset <= MAX_ALTERNATIVE_DAYS; offset += 1) {
    const day = addDays(anchor, offset);
    for (const slot of validSlotsOn(day, durationMinutes, existing, now)) {
      candidates.push({ at: istToInstant(day, slot)!.getTime(), label: `${day}T${formatTime(slot)}` });
    }
  }
  candidates.sort((a, b) => a.at - b.at);

  const earlier = [...candidates].reverse().find((c) => c.at < target);
  const later = candidates.find((c) => c.at > target);

  const picked = [earlier?.label, later?.label].filter((x): x is string => Boolean(x));

  // Always offer two options: top up with the soonest remaining slots.
  for (const c of candidates) {
    if (picked.length >= 2) break;
    if (!picked.includes(c.label)) picked.push(c.label);
  }

  return picked.slice(0, 2).sort();
}

export function checkAvailability(
  date: string,
  time: string,
  serviceName: string,
  existing: ExistingBooking[],
  now: Date = new Date(),
): AvailabilityResult {
  const service = findService(serviceName);
  if (!service) return { available: false, reason: "unknown_service", alternatives: [] };

  const minutes = parseTime(time);
  if (minutes === null || !istToInstant(date, minutes)) {
    return { available: false, reason: "outside_hours", alternatives: [] };
  }

  const problem = scheduleProblem(date, minutes, service.durationMinutes, now);
  if (problem) {
    return {
      available: false,
      reason: problem,
      alternatives: findAlternatives(date, minutes, service.durationMinutes, existing, now),
    };
  }

  if (!isFree(date, minutes, service.durationMinutes, existing)) {
    return {
      available: false,
      reason: "booked",
      alternatives: findAlternatives(date, minutes, service.durationMinutes, existing, now),
    };
  }

  return { available: true, reason: null, alternatives: [] };
}
