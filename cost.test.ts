// Run with: npx tsx cost.test.ts
// Checks cost.ts output against an independent hand calculation.
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const out = execFileSync("npx", ["tsx", "cost.ts"], { encoding: "utf8" });

// Independent closed-form model of the same example task.
function handCost(input: number, read: number, write: number, output: number, cache: boolean) {
  let ctx = 7_500, cached = 0, total = 0;
  for (let i = 0; i <= 6; i++) {
    const attempts = i === 3 ? 2 : 1;
    for (let a = 0; a < attempts; a++) {
      total += cache
        ? (ctx - cached) * write + cached * read + 800 * output
        : ctx * input + 800 * output;
      if (cache) cached = ctx;
    }
    ctx += 800 + 2_500;
  }
  return total / 1_000_000;
}

const cases: [string, number][] = [
  ["claude-sonnet-5-5  $", handCost(2, 0.2, 2.5, 10, true)],
  ["claude-opus-5-5    $", handCost(4, 0.2, 5, 20, true)],
  ["gpt-6.1-sol        $", handCost(2, 0.1, 2.5, 10, true)],
  ["grok-4.7           $", handCost(2, 0.5, 2, 6, true)],
  ["changing prefix: $", handCost(2, 0.2, 2.5, 10, false)],
];

let passed = 0;
for (const [label, expected] of cases) {
  assert.ok(out.includes(`${label}${expected.toFixed(4)}`), `${label} expected ${expected.toFixed(4)}`);
  passed++;
}
assert.ok(out.includes("turns: 8 (1 retry)"));
passed++;
assert.ok(!/[\u2013\u2014]/.test(out), "no en or em dashes in output");
passed++;

console.log(`ok: ${passed} checks passed`);
