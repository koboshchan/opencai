const MAX_BUBBLE_LENGTH = 280;
const SENTENCE_GROUP_LENGTH = 200;

function stripThinkingTags(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function splitLongChunk(text: string): string[] {
  if (text.length <= MAX_BUBBLE_LENGTH) {
    return [text];
  }

  const sentences = text.match(/[^.!?]+[.!?]*(\s+|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
    } else if (current.length + sentence.length + 1 < SENTENCE_GROUP_LENGTH) {
      current += " " + sentence;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

/** Splits a reply into natural texting-style bubbles: explicit blank-line breaks first, falling back to sentence grouping for any chunk that's still long. */
export function splitIntoBubbles(text: string): string[] {
  const cleaned = stripThinkingTags(text);

  if (!cleaned) {
    return [];
  }

  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return [];
  }

  return paragraphs.flatMap(splitLongChunk);
}

const MIN_TYPING_DELAY_MS = 350;
const MAX_TYPING_DELAY_MS = 1800;
const MS_PER_CHAR = 18;

/** Roughly how long a human would take to type and send a bubble of this length. */
export function typingDelayMs(bubble: string): number {
  return Math.min(MAX_TYPING_DELAY_MS, Math.max(MIN_TYPING_DELAY_MS, bubble.length * MS_PER_CHAR));
}
