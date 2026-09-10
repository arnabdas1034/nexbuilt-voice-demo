"use client";

const PROMPTS = [
  "I want to book a teeth cleaning",
  "What are your timings on Saturday?",
  "How much does a root canal cost?",
];

export default function SuggestedPrompts({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-muted">Try asking</p>
      {PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onPick(prompt)}
          className="rounded-chip border border-line bg-surface px-4 py-2.5 text-left text-[14px] text-surface-ink transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          “{prompt}”
        </button>
      ))}
    </div>
  );
}
