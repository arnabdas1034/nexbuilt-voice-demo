import Footer from "@/components/Footer";
import Header from "@/components/Header";
import VoiceAgent from "@/components/VoiceAgent";
import { clinic } from "@/lib/clinic";

export default function Page() {
  return (
    <>
      <Header />

      <main>
        <section className="mx-auto w-full max-w-6xl px-5 pb-8 pt-10 md:px-8 md:pt-14">
          <h1 className="max-w-3xl text-[30px] leading-[1.15] tracking-tight md:text-[44px]">
            Live AI voice receptionist
            <span className="font-serif italic text-accent"> that answers the phone</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-muted md:text-[18px]">
            A working demo for {clinic.name}, {clinic.location}. Tap the button, talk to Priya, and
            watch your appointment appear as she books it.
          </p>
          <p className="mt-3 text-[13px] text-muted">
            This is a demo clinic. Bookings are not real.
          </p>
        </section>

        <VoiceAgent />
      </main>

      <Footer />
    </>
  );
}
