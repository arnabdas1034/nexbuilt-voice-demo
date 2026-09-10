"use client";

import { clinic } from "@/lib/clinic";
import type { Booking } from "@/types";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: clinic.timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export default function BookingsPanel({
  bookings,
  latestReference,
}: {
  bookings: Booking[];
  latestReference: string | null;
}) {
  return (
    <section className="flex flex-col rounded-card border border-line bg-surface lg:h-full">
      <header className="flex items-center justify-between border-b brand-divider px-5 py-3.5">
        <h2 className="text-[15px] font-semibold text-surface-ink">Appointments booked</h2>
        {bookings.length > 0 && (
          <span className="rounded-pill border border-line px-2.5 py-0.5 text-[12px] text-muted">
            {bookings.length}
          </span>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {bookings.length === 0 ? (
          <p className="py-6 text-[14px] leading-relaxed text-muted">
            Bookings will appear here as they are made.
          </p>
        ) : (
          bookings.map((booking) => (
            <article
              key={booking.reference}
              className={`rounded-chip border border-line bg-page p-4 ${
                booking.reference === latestReference ? "booking-enter" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold text-ink">{booking.name}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{booking.service}</p>
                </div>
                <span className="shrink-0 font-serif text-[13px] italic text-accent">
                  {booking.reference}
                </span>
              </div>

              <dl className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px]">
                <div className="flex gap-1.5">
                  <dt className="text-muted">When</dt>
                  <dd className="text-ink">{formatWhen(booking.appointmentAt)}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-muted">With</dt>
                  <dd className="text-ink">{booking.dentist}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-muted">Fee</dt>
                  <dd className="text-ink">₹{booking.priceInr.toLocaleString("en-IN")}</dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
