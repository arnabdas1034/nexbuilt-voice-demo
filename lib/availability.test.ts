/**
 * Run with:  npm test
 * Node strips the TypeScript types natively, so there is no build step.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { checkAvailability, istToInstant, parseTime, istParts } from "./availability.ts";

// A fixed "now": Thursday 10 September 2026, 09:00 IST.
const NOW = istToInstant("2026-09-10", parseTime("09:00")!)!;
const none: never[] = [];

test("Sunday is closed", () => {
  // 2026-09-13 is a Sunday.
  const r = checkAvailability("2026-09-13", "11:00", "Cleaning", none, NOW);
  assert.equal(r.available, false);
  assert.equal(r.reason, "closed");
  assert.equal(r.alternatives.length, 2);
});

test("before opening is outside hours", () => {
  const r = checkAvailability("2026-09-11", "09:00", "Cleaning", none, NOW);
  assert.equal(r.reason, "outside_hours");
});

test("after closing is outside hours", () => {
  const r = checkAvailability("2026-09-11", "20:30", "Cleaning", none, NOW);
  assert.equal(r.reason, "outside_hours");
});

test("a slot that would run past closing is rejected", () => {
  // Root Canal is 90 minutes; 19:00 + 90 = 20:30, past the 20:00 close.
  const r = checkAvailability("2026-09-11", "19:00", "Root Canal", none, NOW);
  assert.equal(r.reason, "outside_hours");
  // 18:30 start ends exactly at 20:00 and is allowed.
  assert.equal(checkAvailability("2026-09-11", "18:30", "Root Canal", none, NOW).available, true);
});

test("lunch is blocked, including appointments that spill into it", () => {
  assert.equal(checkAvailability("2026-09-11", "13:30", "Cleaning", none, NOW).reason, "lunch");
  // 12:30 + 45min runs to 13:15, which overlaps the 13:00 lunch start.
  assert.equal(checkAvailability("2026-09-11", "12:30", "Cleaning", none, NOW).reason, "lunch");
  // 12:00 + 45min ends at 12:45, clear of lunch.
  assert.equal(checkAvailability("2026-09-11", "12:00", "Cleaning", none, NOW).available, true);
});

test("a date in the past is rejected", () => {
  const r = checkAvailability("2026-09-09", "11:00", "Cleaning", none, NOW);
  assert.equal(r.reason, "past");
});

test("earlier today is past, later today is not", () => {
  // Same day, but "now" has moved to 15:00 IST.
  const afternoon = istToInstant("2026-09-10", parseTime("15:00")!)!;
  assert.equal(checkAvailability("2026-09-10", "11:00", "Cleaning", none, afternoon).reason, "past");
  assert.equal(checkAvailability("2026-09-10", "16:00", "Cleaning", none, afternoon).available, true);
});

test("an overlapping booking blocks the slot", () => {
  const existing = [
    { appointment_at: istToInstant("2026-09-11", parseTime("11:00")!)!.toISOString(), duration_minutes: 45 },
  ];
  // 11:30 starts inside the existing 11:00-11:45 booking.
  const clash = checkAvailability("2026-09-11", "11:30", "Cleaning", existing, NOW);
  assert.equal(clash.available, false);
  assert.equal(clash.reason, "booked");
  // 11:45 begins exactly as the previous one ends, so it is free.
  assert.equal(checkAvailability("2026-09-11", "11:45", "Cleaning", existing, NOW).available, true);
});

test("an unknown service is rejected rather than guessed", () => {
  const r = checkAvailability("2026-09-11", "11:00", "Hair Removal", none, NOW);
  assert.equal(r.reason, "unknown_service");
});

test("alternatives are real bookable slots on 30-minute boundaries", () => {
  const r = checkAvailability("2026-09-13", "11:00", "Cleaning", none, NOW);
  assert.equal(r.alternatives.length, 2);
  for (const alt of r.alternatives) {
    const [date, time] = alt.split("T");
    assert.match(alt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    assert.equal(parseTime(time)! % 30, 0, `${alt} is not on a 30-minute boundary`);
    // Every suggestion must itself be bookable.
    assert.equal(checkAvailability(date, time, "Cleaning", none, NOW).available, true, `${alt} is not bookable`);
  }
  // Sunday's neighbours are Saturday and Monday.
  assert.equal(istParts(istToInstant(r.alternatives[0].split("T")[0], 0)!).weekday, 6);
  assert.equal(istParts(istToInstant(r.alternatives[1].split("T")[0], 0)!).weekday, 1);
});

test("alternatives are never in the past", () => {
  const r = checkAvailability("2026-09-09", "11:00", "Cleaning", none, NOW);
  for (const alt of r.alternatives) {
    const [date, time] = alt.split("T");
    assert.ok(istToInstant(date, parseTime(time)!)!.getTime() >= NOW.getTime(), `${alt} is in the past`);
  }
});

test("a past date still offers two future alternatives", () => {
  const r = checkAvailability("2026-09-01", "11:00", "Cleaning", none, NOW);
  assert.equal(r.reason, "past");
  assert.equal(r.alternatives.length, 2, "a past date must still get two suggestions");
  for (const alt of r.alternatives) {
    const [date, time] = alt.split("T");
    assert.equal(checkAvailability(date, time, "Cleaning", none, NOW).available, true, `${alt} is not bookable`);
  }
});

test("every unavailable reason returns exactly two alternatives", () => {
  const cases: [string, string][] = [
    ["2026-09-13", "11:00"], // Sunday
    ["2026-09-11", "09:00"], // before opening
    ["2026-09-11", "13:30"], // lunch
    ["2026-09-01", "11:00"], // past
  ];
  for (const [date, time] of cases) {
    const r = checkAvailability(date, time, "Cleaning", none, NOW);
    assert.equal(r.available, false);
    assert.equal(r.alternatives.length, 2, `${date} ${time} gave ${r.alternatives.length}`);
  }
});
