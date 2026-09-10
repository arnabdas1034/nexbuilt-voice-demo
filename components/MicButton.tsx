"use client";

import { useEffect, useRef } from "react";
import type { MicState } from "@/types";

const LABEL: Record<MicState, string> = {
  idle: "Tap to talk",
  connecting: "Connecting",
  listening: "Listening",
  speaking: "Priya is speaking",
};

const CAPTION: Record<MicState, string> = {
  idle: "Tap the button and start speaking",
  connecting: "Setting up the call…",
  listening: "Go ahead — she can hear you",
  speaking: "Interrupt any time, she will stop",
};

type Props = {
  state: MicState;
  onStart: () => void;
  onStop: () => void;
  getInputVolume: () => number;
  getOutputVolume: () => number;
  /** Compact renders just the button and its ring, for the mobile bar. */
  compact?: boolean;
};

export default function MicButton({
  state,
  onStart,
  onStop,
  getInputVolume,
  getOutputVolume,
  compact = false,
}: Props) {
  const ringRef = useRef<HTMLSpanElement>(null);
  const frame = useRef<number>(0);

  // Volume readings do not trigger re-renders, so drive the ring straight from
  // the animation frame rather than through React state.
  useEffect(() => {
    if (state !== "listening" && state !== "speaking") {
      if (ringRef.current) ringRef.current.style.transform = "scale(1)";
      return;
    }

    const read = state === "listening" ? getInputVolume : getOutputVolume;

    const tick = () => {
      const volume = Math.min(1, Math.max(0, read()));
      if (ringRef.current) {
        ringRef.current.style.transform = `scale(${1 + volume * 0.45})`;
        ringRef.current.style.opacity = String(0.25 + volume * 0.75);
      }
      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [state, getInputVolume, getOutputVolume]);

  const active = state !== "idle";
  // Listening rings in muted grey-green; Priya speaking rings in the accent.
  const ringColor = state === "speaking" ? "var(--accent)" : "var(--panel-muted)";

  if (compact) {
    return (
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        <span
          ref={ringRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full border-2"
          style={{ borderColor: ringColor, opacity: active ? 0.5 : 0 }}
        />
        <button
          type="button"
          onClick={active ? onStop : onStart}
          aria-label={active ? "End the call" : "Start talking to Priya"}
          className={`flex h-[54px] w-[54px] items-center justify-center rounded-full bg-ink text-page transition-transform duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-95 ${
            state === "connecting" ? "pulse" : ""
          }`}
        >
          {active ? <EndIcon /> : <MicIcon />}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex h-[168px] w-[168px] items-center justify-center">
        <span
          ref={ringRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full border-2 transition-[border-color] duration-300"
          style={{ borderColor: ringColor, opacity: active ? 0.5 : 0 }}
        />
        <button
          type="button"
          onClick={active ? onStop : onStart}
          aria-label={active ? "End the call" : "Start talking to Priya"}
          className={`relative flex h-[132px] w-[132px] flex-col items-center justify-center gap-1.5 rounded-full bg-ink text-page transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent active:scale-95 ${
            state === "connecting" ? "pulse" : ""
          }`}
        >
          {active ? <EndIcon /> : <MicIcon />}
          <span className="px-2 text-center text-[12px] font-semibold leading-tight">
            {active ? "End call" : "Tap to talk"}
          </span>
        </button>
      </div>

      <div className="text-center">
        <p className="text-[15px] font-semibold text-ink">{LABEL[state]}</p>
        <p className="mt-1 text-[13px] text-muted">{CAPTION[state]}</p>
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-7 w-7">
      <path
        d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EndIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-7 w-7">
      <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
    </svg>
  );
}
