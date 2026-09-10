/**
 * Single source of truth for the demo business.
 *
 * To rebrand this demo for a different client, edit ONLY this file. The agent
 * prompt, the greeting, the function definitions and the UI copy are all
 * derived from the values below.
 */

export type Service = {
  name: string;
  priceInr: number;
  durationMinutes: number;
};

export const clinic = {
  name: "Sunrise Dental Clinic",
  location: "Green Park, New Delhi",
  receptionist: "Priya",
  timezone: "Asia/Kolkata",

  /** Opening hours, 24h. Applies Monday to Saturday; Sunday is closed. */
  hours: { open: "10:00", close: "20:00" },
  /** No appointments start or overlap this window. */
  lunch: { start: "13:00", end: "14:00" },
  /** 0 = Sunday, matching Date.prototype.getDay(). */
  closedWeekdays: [0],

  dentists: [
    { name: "Dr Sharma", speciality: "general dentistry" },
    { name: "Dr Mehta", speciality: "orthodontics" },
  ],

  services: [
    { name: "Consultation", priceInr: 500, durationMinutes: 30 },
    { name: "Cleaning", priceInr: 1500, durationMinutes: 45 },
    { name: "Filling", priceInr: 2000, durationMinutes: 45 },
    { name: "Root Canal", priceInr: 8000, durationMinutes: 90 },
    { name: "Teeth Whitening", priceInr: 12000, durationMinutes: 60 },
    { name: "Braces consult", priceInr: 800, durationMinutes: 30 },
  ] satisfies Service[],
} as const;

export const serviceNames = clinic.services.map((s) => s.name);

export function findService(name: string): Service | undefined {
  const wanted = name.trim().toLowerCase();
  return clinic.services.find((s) => s.name.toLowerCase() === wanted);
}

/** Orthodontic work goes to Dr Mehta; everything else to Dr Sharma. */
export function dentistFor(serviceName: string): string {
  return /braces|ortho/i.test(serviceName)
    ? clinic.dentists[1].name
    : clinic.dentists[0].name;
}
