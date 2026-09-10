"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AgentProvider,
  useAgentClientTool,
  useAgentControls,
  useAgentConversation,
  useAgentMicrophone,
  useAgentMode,
  useAgentPlayer,
  useAgentState,
} from "@deepgram/react";
import { buildAgentConfig } from "@/lib/agentConfig";
import { clinic } from "@/lib/clinic";
import type { Booking, MicState } from "@/types";
import BookingsPanel from "./BookingsPanel";
import MicButton from "./MicButton";
import Transcript from "./Transcript";

/** An abandoned tab should not hold a session open and burn credits. */
const IDLE_TIMEOUT_MS = 3 * 60 * 1000;

export default function VoiceAgent() {
  const config = useMemo(() => buildAgentConfig(), []);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [latestReference, setLatestReference] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((d) => setBookings(d.bookings ?? []))
      .catch(() => setBookings([]));
  }, []);

  const addBooking = useCallback((booking: Booking) => {
    setBookings((prev) => [booking, ...prev.filter((b) => b.reference !== booking.reference)]);
    setLatestReference(booking.reference);
  }, []);

  return (
    <AgentProvider
      config={config}
      playerSampleRate={24000}
      autoStart={false}
      microphoneOptions={{ vad: true }}
    >
      <Session
        bookings={bookings}
        latestReference={latestReference}
        onBooking={addBooking}
      />
    </AgentProvider>
  );
}

type SessionProps = {
  bookings: Booking[];
  latestReference: string | null;
  onBooking: (booking: Booking) => void;
};

function Session({ bookings, latestReference, onBooking }: SessionProps) {
  const { state, isConnected, start, stop } = useAgentState();
  const { mode } = useAgentMode();
  const { conversation, sendUserMessage } = useAgentConversation();
  const { micMuted, setMicMuted, getInputVolume } = useAgentMicrophone();
  const { outputMuted, setOutputMuted, getOutputVolume } = useAgentPlayer();
  const { interrupt } = useAgentControlsSafe();

  const [notice, setNotice] = useState<string | null>(null);

  // --- Function calling -----------------------------------------------------
  // Handlers must return a string; returning an object silently breaks the turn.

  useAgentClientTool("check_availability", async (fn) => {
    try {
      const args = JSON.parse(fn.arguments ?? "{}");
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      return JSON.stringify(await res.json());
    } catch {
      return JSON.stringify({ available: false, reason: null, alternatives: [] });
    }
  });

  useAgentClientTool("book_appointment", async (fn) => {
    try {
      const args = JSON.parse(fn.arguments ?? "{}");
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();

      // Push straight into state so the panel animates now, not after a refetch.
      if (data.success && data.booking) onBooking(data.booking as Booking);

      const { booking: _ignored, ...forModel } = data;
      return JSON.stringify(forModel);
    } catch {
      return JSON.stringify({
        success: false,
        error: "Something went wrong saving that booking.",
      });
    }
  });

  // --- Idle timeout ---------------------------------------------------------

  const lastActivity = useRef(Date.now());
  useEffect(() => {
    lastActivity.current = Date.now();
  }, [conversation, mode]);

  useEffect(() => {
    if (!isConnected) return;
    const timer = setInterval(() => {
      if (Date.now() - lastActivity.current > IDLE_TIMEOUT_MS) {
        stop();
        setNotice("Session ended — tap to start again.");
      }
    }, 5_000);
    return () => clearInterval(timer);
  }, [isConnected, stop]);

  // --- Controls -------------------------------------------------------------

  // iOS Safari only grants the microphone inside a real user gesture, so start()
  // is called synchronously here — never after an await.
  function handleStart() {
    setNotice(null);
    lastActivity.current = Date.now();
    start().catch((err: unknown) => {
      const name = (err as { name?: string })?.name;
      setNotice(
        name === "NotAllowedError"
          ? "Microphone blocked. Allow mic access in your browser settings, then tap again."
          : "Could not start the call. Check your connection and try again.",
      );
    });
  }

  function handleStop() {
    stop();
    setNotice(null);
  }

  function handlePrompt(text: string) {
    if (isConnected) {
      sendUserMessage(text);
      return;
    }
    // Not connected yet: start the call, then send once the socket is up.
    setNotice(null);
    start()
      .then(() => sendUserMessage(text))
      .catch(() =>
        setNotice("Could not start the call. Check your connection and try again."),
      );
  }

  const micState: MicState =
    state === "connecting" || state === "reconnecting"
      ? "connecting"
      : isConnected
        ? mode === "speaking"
          ? "speaking"
          : "listening"
        : "idle";

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 px-5 pb-32 md:px-8 lg:grid-cols-[300px_1fr_340px] lg:pb-8">
      <div className="order-2 flex flex-col gap-5 lg:order-1">
        <div className="rounded-card border border-line bg-surface px-5 py-7 max-lg:hidden">
          <MicButton
            state={micState}
            onStart={handleStart}
            onStop={handleStop}
            getInputVolume={getInputVolume}
            getOutputVolume={getOutputVolume}
          />
          <Controls
            active={micState !== "idle"}
            micMuted={micMuted}
            outputMuted={outputMuted}
            onToggleMic={() => setMicMuted(!micMuted)}
            onToggleOutput={() => setOutputMuted(!outputMuted)}
            onInterrupt={interrupt}
            speaking={micState === "speaking"}
          />
        </div>

        {notice && (
          <p className="rounded-chip border border-accent bg-surface px-4 py-3 text-[13px] leading-relaxed text-surface-ink">
            {notice}
          </p>
        )}

        <p className="text-[12px] leading-relaxed text-muted max-lg:hidden">
          Calls end automatically after three minutes of silence.
        </p>
      </div>

      <div className="order-1 lg:order-2 lg:h-[min(70vh,640px)]">
        <Transcript
          conversation={conversation}
          connected={isConnected}
          onPickPrompt={handlePrompt}
        />
      </div>

      <div className="order-3 lg:h-[min(70vh,640px)]">
        <BookingsPanel bookings={bookings} latestReference={latestReference} />
      </div>

      {/* Mobile: the control stays reachable at the bottom of the screen. */}
      <div className="brand-hairline fixed inset-x-0 bottom-0 z-30 border-t bg-header px-5 py-3 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink">
              {micState === "idle" ? `Call ${clinic.name}` : LABEL_SHORT[micState]}
            </p>
            <p className="truncate text-[12px] text-muted">
              {micState === "idle" ? "Tap to talk to Priya" : "Tap the square to end"}
            </p>
          </div>
          <MobileButton
            state={micState}
            onStart={handleStart}
            onStop={handleStop}
            getInputVolume={getInputVolume}
            getOutputVolume={getOutputVolume}
          />
        </div>
      </div>
    </div>
  );
}

const LABEL_SHORT: Record<MicState, string> = {
  idle: "Tap to talk",
  connecting: "Connecting…",
  listening: "Listening",
  speaking: "Priya is speaking",
};

function MobileButton(props: React.ComponentProps<typeof MicButton>) {
  return (
    <div className="scale-[0.42] origin-right -my-14">
      <MicButton {...props} />
    </div>
  );
}

function Controls({
  active,
  micMuted,
  outputMuted,
  onToggleMic,
  onToggleOutput,
  onInterrupt,
  speaking,
}: {
  active: boolean;
  micMuted: boolean;
  outputMuted: boolean;
  onToggleMic: () => void;
  onToggleOutput: () => void;
  onInterrupt?: () => void;
  speaking: boolean;
}) {
  if (!active) return null;
  const cls =
    "rounded-pill border border-line px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  return (
    <div className="mt-6 flex flex-wrap justify-center gap-2">
      <button type="button" onClick={onToggleMic} className={cls}>
        {micMuted ? "Unmute mic" : "Mute mic"}
      </button>
      <button type="button" onClick={onToggleOutput} className={cls}>
        {outputMuted ? "Unmute speaker" : "Mute speaker"}
      </button>
      {speaking && onInterrupt && (
        <button type="button" onClick={onInterrupt} className={cls}>
          Interrupt
        </button>
      )}
    </div>
  );
}

/** useAgentControls exposes extras; tolerate it not having interrupt. */
function useAgentControlsSafe(): { interrupt?: () => void } {
  const controls = useAgentControls() as unknown as { interrupt?: () => void };
  return { interrupt: controls.interrupt };
}
