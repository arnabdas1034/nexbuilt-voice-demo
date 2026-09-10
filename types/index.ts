export type Booking = {
  reference: string;
  name: string;
  service: string;
  /** ISO instant of the appointment. */
  appointmentAt: string;
  durationMinutes: number;
  priceInr: number;
  dentist: string;
};

export type MicState = "idle" | "connecting" | "listening" | "speaking";
