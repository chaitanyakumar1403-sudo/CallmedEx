import { test } from "node:test";
import assert from "node:assert/strict";
import { lintFile } from "./lint-ui.mjs";

test("flags an inline style object", () => {
  const v = lintFile(`const a = <div style={{ color: "red" }} />;`);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "inline-style");
  assert.equal(v[0].line, 1);
});

test("flags a six-digit hex literal", () => {
  const v = lintFile(`const navy = "#1a2b4a";`);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "hex-literal");
});

test("flags a three-digit hex literal", () => {
  assert.equal(lintFile(`const w = "#fff";`)[0].rule, "hex-literal");
});

test("flags an emoji", () => {
  assert.equal(lintFile(`<span>Go On Duty 🟢</span>`)[0].rule, "emoji");
});

test("flags a gradient", () => {
  assert.equal(lintFile(`background: linear-gradient(135deg, a, b)`)[0].rule, "gradient");
});

test("passes clean converted source", () => {
  const clean = [
    `import { Button } from "@/components/ui";`,
    `export const A = () => <Button variant="primary">Go On Duty</Button>;`,
  ].join("\n");
  assert.deepEqual(lintFile(clean), []);
});

test("honours an ignore comment on the following line only", () => {
  const src = [
    `// ui-lint-ignore-next-line third-party widget needs a literal`,
    `const a = "#1a2b4a";`,
    `const b = "#1a2b4a";`,
  ].join("\n");
  const v = lintFile(src);
  assert.equal(v.length, 1);
  assert.equal(v[0].line, 3);
});

test("an ignore comment with no reason does not suppress", () => {
  const src = [`// ui-lint-ignore-next-line`, `const a = "#1a2b4a";`].join("\n");
  assert.equal(lintFile(src).length, 1);
});

test("reports every violation on a line, not just the first", () => {
  const v = lintFile(`<div style={{ color: "#fff" }} />`);
  assert.deepEqual(v.map((x) => x.rule).sort(), ["hex-literal", "inline-style"]);
});
