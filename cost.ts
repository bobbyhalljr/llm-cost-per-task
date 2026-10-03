// LLM cost per task. Companion code for "Cost per Task, Not Cost per Token: Build an LLM Cost Calculator in TypeScript".
// Prices are list prices checked by hand on Sep 30, 2026 (sources in PRICES). They will go stale.
// EXAMPLE INPUTS: every token count, retry and latency constant below is made up, not a measurement.
// No API key. No network. Run with: npx tsx cost.ts

type Price = {
  input: number; // $ per 1M uncached input tokens
  cachedInput: number; // $ per 1M cache-hit input tokens
  cacheWrite: number | null; // $ per 1M tokens written to cache (null = not listed)
  output: number; // $ per 1M output tokens
  source: string;
  checked: string;
};

// Standard tier, short context. Checked by hand on Sep 30, 2026.
const PRICES: Record<string, Price> = {
  "claude-sonnet-5-5": {
    input: 2, cachedInput: 0.2, cacheWrite: 2.5, output: 10,
    source: "https://platform.claude.com/docs/en/about-claude/pricing",
    checked: "2026-09-30",
  },
  "claude-opus-5-5": {
    input: 4, cachedInput: 0.2, cacheWrite: 5, output: 20,
    source: "https://platform.claude.com/docs/en/about-claude/pricing",
    checked: "2026-09-30",
  },
  "gpt-6.1-sol": {
    input: 2, cachedInput: 0.1, cacheWrite: 2.5, output: 10,
    source: "https://developers.openai.com/api/docs/pricing",
    checked: "2026-09-30",
  },
  "grok-4.7": {
    input: 2, cachedInput: 0.5, cacheWrite: null, output: 6,
    source: "https://docs.x.ai/docs/models/grok-4.7",
    checked: "2026-09-30",
  },
};
type Turn = {
  freshInput: number; // input tokens billed at the full rate
  cacheWrite: number; // input tokens stored in the cache this turn
  cacheRead: number; // input tokens served from the cache
  output: number; // output tokens, including reasoning tokens
  latencyMs: number;
  retry: boolean;
};

function turnCost(t: Turn, p: Price): number {
  const writeRate = p.cacheWrite ?? p.input;

  return (
    t.freshInput * p.input +
    t.cacheWrite * writeRate +
    t.cacheRead * p.cachedInput +
    t.output * p.output
  ) / 1_000_000;
}

const taskCost = (turns: Turn[], p: Price) =>
  turns.reduce((sum, t) => sum + turnCost(t, p), 0);
// EXAMPLE INPUTS. Not measurements of any model.
type TaskShape = {
  systemTokens: number;
  taskTokens: number;
  toolTurns: number; // model calls a tool, gets a result back
  toolResultTokens: number;
  outputPerTurn: number;
  retryTurns: number[]; // turn indexes that failed and ran again
  cachePrefix: boolean; // is the start of the prompt stable?
  firstTokenMs: number;
  msPerOutputToken: number;
  toolMs: number;
};

function simulateTask(s: TaskShape): Turn[] {
  const turns: Turn[] = [];
  let context = s.systemTokens + s.taskTokens;
  let cached = 0;

  for (let i = 0; i <= s.toolTurns; i++) {
    const attempts = s.retryTurns.includes(i) ? 2 : 1;

    for (let a = 0; a < attempts; a++) {
      const read = s.cachePrefix ? cached : 0;
      const write = s.cachePrefix ? context - cached : 0;
      const isTool = i < s.toolTurns;

      turns.push({
        freshInput: s.cachePrefix ? 0 : context,
        cacheWrite: write,
        cacheRead: read,
        output: s.outputPerTurn,
        latencyMs:
          s.firstTokenMs +
          s.outputPerTurn * s.msPerOutputToken +
          (isTool ? s.toolMs : 0),
        retry: a > 0,
      });

      if (s.cachePrefix) cached = context;
    }

    context += s.outputPerTurn + s.toolResultTokens;
  }

  return turns;
}
function cacheHitRate(turns: Turn[]): number {
  let read = 0;
  let total = 0;

  for (const t of turns) {
    read += t.cacheRead;
    total += t.freshInput + t.cacheWrite + t.cacheRead;
  }

  return total === 0 ? 0 : read / total;
}

const timeToDoneMs = (turns: Turn[]) =>
  turns.reduce((sum, t) => sum + t.latencyMs, 0);

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
const exampleTask: TaskShape = {
  systemTokens: 6_000,
  taskTokens: 1_500,
  toolTurns: 6,
  toolResultTokens: 2_500,
  outputPerTurn: 800,
  retryTurns: [3],
  cachePrefix: true,
  firstTokenMs: 900,
  msPerOutputToken: 12,
  toolMs: 1_500,
};

const usd = (n: number) => `$${n.toFixed(4)}`;
const turns = simulateTask(exampleTask);

console.log("Step 5: same example task, every model");
console.log(`  turns: ${turns.length} (${turns.filter((t) => t.retry).length} retry)`);
console.log(`  cache hit rate: ${(cacheHitRate(turns) * 100).toFixed(1)}%`);

for (const [model, price] of Object.entries(PRICES)) {
  console.log(`  ${model.padEnd(18)} ${usd(taskCost(turns, price))} per task`);
}
// How many times the baseline's tokens can `rival` spend
// on this task and still cost the same?
function breakEven(baseline: Price, rival: Price, turns: Turn[]) {
  return taskCost(turns, baseline) / taskCost(turns, rival);
}

console.log("\nStep 6: break-even token ratio vs claude-sonnet-5-5");

for (const [model, price] of Object.entries(PRICES)) {
  const ratio = breakEven(PRICES["claude-sonnet-5-5"], price, turns);
  console.log(`  ${model.padEnd(18)} ${ratio.toFixed(2)}x the tokens`);
}
const noCache = simulateTask({ ...exampleTask, cachePrefix: false });
const sonnet = PRICES["claude-sonnet-5-5"];

console.log("\nStep 7: prompt layout vs model choice (claude-sonnet-5-5)");
console.log(`  stable prefix:   ${usd(taskCost(turns, sonnet))}`);
console.log(`  changing prefix: ${usd(taskCost(noCache, sonnet))}`);
console.log(`  changing prefix on grok-4.7: ${usd(taskCost(noCache, PRICES["grok-4.7"]))}`);
// EXAMPLE INPUTS: ten runs of the same task, varying only
// how many tool turns and retries each run needed.
const runs: [number, number[]][] = [
  [3, []], [4, []], [4, []], [5, []], [5, [2]],
  [6, []], [6, [3]], [7, []], [9, [4, 7]], [14, [5, 9, 12]],
];

console.log("\nStep 8: ten example runs on gpt-6.1-sol");

const costs: number[] = [];
const times: number[] = [];

for (const [toolTurns, retryTurns] of runs) {
  const t = simulateTask({ ...exampleTask, toolTurns, retryTurns });
  costs.push(taskCost(t, PRICES["gpt-6.1-sol"]));
  times.push(timeToDoneMs(t) / 1000);
}

console.log(`  cost  p50 ${usd(percentile(costs, 50))}  p95 ${usd(percentile(costs, 95))}`);
console.log(`  time  p50 ${percentile(times, 50).toFixed(1)}s   p95 ${percentile(times, 95).toFixed(1)}s`);
