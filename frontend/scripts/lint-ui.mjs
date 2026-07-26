#!/usr/bin/env node
/**
 * UI regression gate.
 *
 * Three previous restyling passes were undone by the next feature landing new
 * inline styles and hex literals. This makes that mechanically impossible on
 * files that have already been converted.
 *
 * Scope is an explicit allowlist (ui-lint.config.json) rather than a glob, so
 * the gate is enforceable from the first converted file instead of only after
 * the whole codebase is clean.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const RULES = [
  { id: "inline-style", re: /style=\{\{/g },
  { id: "hex-literal", re: /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b/g },
  // Ranges must cover Miscellaneous Technical (U+2300–23FF) — that is where
  // ⏸ lives, and the off-duty toggle message uses it on every single toggle.
  // An earlier version of this rule omitted that block and let the glyph
  // through. Geometric Shapes (U+25A0–25FF) is deliberately NOT included:
  // `●` is used as a text bullet in places and is not decoration.
  { id: "emoji", re: /[\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{1F000}-\u{1FAFF}]/gu },
  { id: "gradient", re: /linear-gradient\(/g },
];

const IGNORE = /\/\/\s*ui-lint-ignore-next-line\s+\S+/;

export function lintFile(source) {
  const lines = source.split("\n");
  const out = [];
  lines.forEach((line, i) => {
    if (i > 0 && IGNORE.test(lines[i - 1])) return;
    for (const { id, re } of RULES) {
      re.lastIndex = 0;
      if (re.test(line)) out.push({ line: i + 1, rule: id, text: line.trim() });
    }
  });
  return out;
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const { files } = JSON.parse(readFileSync(join(root, "ui-lint.config.json"), "utf8"));
  let failed = 0;

  for (const rel of files) {
    const abs = join(root, rel);
    let src;
    try {
      src = readFileSync(abs, "utf8");
    } catch {
      console.error(`ui-lint: listed file is missing: ${rel}`);
      failed++;
      continue;
    }
    for (const v of lintFile(src)) {
      console.error(`${relative(root, abs)}:${v.line}  ${v.rule}  ${v.text.slice(0, 90)}`);
      failed++;
    }
  }

  if (failed) {
    console.error(`\nui-lint: ${failed} violation(s) across ${files.length} converted file(s).`);
    process.exit(1);
  }
  console.log(`ui-lint: clean across ${files.length} converted file(s).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
