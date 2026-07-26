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

/**
 * The ranges must cover Miscellaneous Technical (U+2300–23FF) — that is where
 * ⏸ lives, and the off-duty toggle message uses it on every single toggle.
 * An earlier version of this regex omitted that block and left the glyph on
 * screen. Geometric Shapes is deliberately NOT included: `●` is used as a
 * text bullet in places and is not decoration.
 */
const GLYPHS =
  /[\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{1F000}-\u{1FAFF}]/gu;

export function stripStatusGlyphs(msg: string): string {
  return msg.replace(GLYPHS, "").trim();
}
