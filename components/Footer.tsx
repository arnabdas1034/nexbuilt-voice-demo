import { clinic } from "@/lib/clinic";

export default function Footer() {
  return (
    <footer className="mt-16 border-t brand-divider px-5 py-10 md:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-8 md:grid-cols-[1.2fr_1.1fr_.8fr_1.1fr]">
        <div>
          <p className="wordmark text-[18px]">NexBuilt</p>
          <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-muted">
            Websites, AI agents and automation for small businesses in Delhi.
          </p>
        </div>
        <div className="text-[14px]">
          <p className="mb-2 text-muted">This demo</p>
          <p className="text-ink">{clinic.name}</p>
          <p className="text-muted">{clinic.location}</p>
        </div>
        <div className="text-[14px]">
          <p className="mb-2 text-muted">Hours</p>
          <p className="text-ink">Mon–Sat, {clinic.hours.open}–{clinic.hours.close}</p>
          <p className="text-muted">Closed Sunday</p>
        </div>
        <div className="text-[14px]">
          <p className="mb-2 text-muted">More</p>
          <a href="https://nexbuilt.in" className="text-ink underline underline-offset-4">
            nexbuilt.in
          </a>
        </div>
      </div>
      <p className="mx-auto mt-8 w-full max-w-6xl text-[11px] text-muted">
        © {new Date().getFullYear()} NexBuilt. {clinic.name} is a fictional business used for
        demonstration. Bookings made here are not real appointments.
      </p>
    </footer>
  );
}
