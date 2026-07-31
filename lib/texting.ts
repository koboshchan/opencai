const BUBBLE_DELIMITER = "║";

function stripThinkingTags(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/** Splits a reply into texting-style bubbles wherever the model placed the explicit ║ delimiter. No automatic length- or sentence-based splitting — the model decides where a message ends. */
export function splitIntoBubbles(text: string): string[] {
  const cleaned = stripThinkingTags(text);

  if (!cleaned) {
    return [];
  }

  return cleaned
    .split(BUBBLE_DELIMITER)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

const MIN_TYPING_DELAY_MS = 350;
const MAX_TYPING_DELAY_MS = 1800;
const MS_PER_CHAR = 18;

/** Roughly how long a human would take to type and send a bubble of this length. */
export function typingDelayMs(bubble: string): number {
  return Math.min(MAX_TYPING_DELAY_MS, Math.max(MIN_TYPING_DELAY_MS, bubble.length * MS_PER_CHAR));
}
