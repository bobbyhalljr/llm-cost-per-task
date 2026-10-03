# llm-cost-per-task

A tiny LLM cost calculator in one TypeScript file.
It prices a whole agent task: every turn, tool result, retry and cached prefix.
List prices, example inputs, and arithmetic you can check. No API key.

## Why it matters

Pricing pages answer one question.
What does a million tokens cost?

The bill is made of tasks.
A task is a few turns, a few tool calls, a retry or two, and a prompt that gets resent every time.

Same token prices can produce a different bill.
On a long agent task, the cache price can matter more than the output price.

## Run it

You need Node.js 18 or newer.

```bash
npm install
npx tsx cost.ts        # the calculator
npx tsx cost.test.ts   # checks cost.ts against an independent hand calculation
```

## Example output

This is real output from `npx tsx cost.ts`:

```text
Step 5: same example task, every model
  turns: 8 (1 retry)
  cache hit rate: 80.4%
  claude-sonnet-5-5  $0.1546 per task
  claude-opus-5-5    $0.2869 per task
  gpt-6.1-sol        $0.1434 per task
  grok-4.7           $0.1489 per task

Step 6: break-even token ratio vs claude-sonnet-5-5
  claude-sonnet-5-5  1.00x the tokens
  claude-opus-5-5    0.54x the tokens
  gpt-6.1-sol        1.08x the tokens
  grok-4.7           1.04x the tokens

Step 7: prompt layout vs model choice (claude-sonnet-5-5)
  stable prefix:   $0.1546
  changing prefix: $0.3424
  changing prefix on grok-4.7: $0.3168

Step 8: ten example runs on gpt-6.1-sol
  cost  p50 $0.1245  p95 $0.3296
  time  p50 82.5s   p95 214.5s
```

And from `npx tsx cost.test.ts`:

```text
ok: 7 checks passed
```

Every dollar figure above comes from example token counts.
They are not measurements of any model.

## How it works

```text
Price table ──→ price one turn ──→ simulate a task ──→ cost per task
                                         │
                       cache hit rate, retries, time to done
```

| File | What it does |
| --- | --- |
| `cost.ts` | The calculator, in the same order as the post |
| `cost.test.ts` | Runs `cost.ts` and checks it against a closed-form hand calculation |
| `output.txt` | Real output of `npx tsx cost.ts` |
| `package.json` | `tsx`, `typescript` and `@types/node` as dev dependencies |
| `tsconfig.json` | Strict settings for `npx tsc --noEmit` |

Inside `cost.ts`:

- `PRICES`: list prices per 1M tokens, each with a source URL and the date I checked it
- `turnCost` and `taskCost`: fresh input, cache writes, cache reads and output
- `simulateTask`: turns an example `TaskShape` into turns, with a growing context and retries
- `cacheHitRate`, `timeToDoneMs` and `percentile`: the numbers that are not on the pricing page
- `breakEven`: how many times the tokens a rival model can spend and still cost the same
- Step 7: the same task with a stable prefix and a changing prefix
- Step 8: ten example runs, then p50 and p95 for cost and time

## Limits

- The token counts are made up. Measure your own task.
- Vendor per-task claims use vendor tasks, not yours.
- Effort settings change output tokens, and output tokens change everything.
- Caching rules differ by provider. Grok 4.7 has no listed cache write price, so the input rate is used.
- Latency is not time to done. Tool time and retries add up.
- Prices change. These were checked on Sep 30, 2026.

## Read more

- Dev.to: [Cost per Task, Not Cost per Token: Build an LLM Cost Calculator in TypeScript](https://dev.to/bobbyhalljr/cost-per-task-not-cost-per-token-build-an-llm-cost-calculator-in-typescript-1pln)
- Substack: [Cost per Task, Not Cost per Token: Build an LLM Cost Calculator in TypeScript](https://bobbyhalljr.substack.com/p/cost-per-task-not-cost-per-token)
- More of my writing: [bhjr.dev](https://bhjr.dev)

## License

MIT. See [LICENSE](LICENSE).
