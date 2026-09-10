"use client";

import { useEffect, useRef } from "react";
import type { ConversationEntry } from "@deepgram/react";
import { clinic } from "@/lib/clinic";
import SuggestedPrompts from "./SuggestedPrompts";

type Props = {
  conversation: ConversationEntry[];
  connected: boolean;
  onPickPrompt: (text: string) => void;
};

export default function Transcript({ conversation, connected, onPickPrompt }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  // Follow the conversation, but stop fighting the user if they scroll up.
  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  }

  useEffect(() => {
    if (pinned.current) scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [conversation]);

  return (
    <section className="flex min-h-[320px] flex-col rounded-card border border-line bg-surface lg:h-full">
      <header className="border-b brand-divider px-5 py-3.5">
        <h2 className="text-[15px] font-semibold text-surface-ink">Live transcript</h2>
      </header>

      <div ref={scroller} onScroll={onScroll} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {conversation.length === 0 ? (
          <div className="flex flex-col gap-5 py-2">
            <p className="text-[14px] leading-relaxed text-muted">
              {connected
                ? "Say hello — Priya is listening."
                : `Tap the button to call ${clinic.name}. Priya will pick up.`}
            </p>
            <SuggestedPrompts onPick={onPickPrompt} />
          </div>
        ) : (
          conversation.map((entry) => <Bubble key={entry.id} entry={entry} />)
        )}
      </div>
    </section>
  );
}

function Bubble({ entry }: { entry: ConversationEntry }) {
  const isUser = entry.role === "user";
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <span className="mb-1 px-1 text-[11px] uppercase tracking-wide text-muted">
        {isUser ? "You" : clinic.receptionist}
      </span>
      <p
        className={`max-w-[86%] rounded-chip px-4 py-2.5 text-[14px] leading-relaxed ${
          isUser
            ? "bg-surface-alt text-surface-ink"
            : "border border-line bg-page text-ink"
        }`}
      >
        {entry.content}
      </p>
    </div>
  );
}
