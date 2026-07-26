/**
 * The status string is still built with a leading glyph at ~30 call sites in
 * this file. Rather than change all of them here, tone is derived once and the
 * glyph stripped for display. Wave 1 follow-up: make setStatusMsg take
 * { tone, text } so this parsing goes away.
 */
export function statusTone(msg: string): "done" | "urgent" | "active" {
  if (msg.includes("✅")) return "done";
  if (msg.includes("❌")) return "urgent";
  return "active";
}

export function stripStatusGlyphs(msg: string): string {
  return msg.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim();
}
