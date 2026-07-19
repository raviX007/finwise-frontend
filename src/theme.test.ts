// Regression tests for RAJ-6: primary theme is royal blue, no green leftovers.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = dirname(fileURLToPath(import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(tsx|ts|css)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [p]
      : [];
  });
}

describe("royal blue theme (RAJ-6)", () => {
  it("defines the primary palette anchored at royal blue #4169E1", () => {
    const css = readFileSync(join(SRC, "index.css"), "utf8");
    expect(css).toMatch(/--color-primary-600:\s*#4169e1/i);
    // Interactive states have derived shades.
    expect(css).toMatch(/--color-primary-500:/);
    expect(css).toMatch(/--color-primary-700:/);
  });

  it("provides a prose-primary modifier so chat markdown links use the theme", () => {
    const css = readFileSync(join(SRC, "index.css"), "utf8");
    expect(css).toMatch(
      /@utility prose-primary\s*{[^}]*--tw-prose-links:\s*var\(--color-primary-600\)/
    );
  });

  it("leaves no green (emerald) theme classes in source", () => {
    const offenders = walk(SRC)
      .map((f) => ({ f, s: readFileSync(f, "utf8") }))
      .filter(({ s }) => /emerald|prose-emerald/.test(s))
      .map(({ f }) => f);
    expect(offenders).toEqual([]);
  });
});
