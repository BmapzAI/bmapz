// Behaviour test, kept in the repo so a reviewer can re-run the evidence. Run all: node backend/tests/run.mjs
//
// Covers lib/aiCredits.js: the price table, tiers and plan gates, the live-catalog substitution of retired model ids,
// the Anthropic sampling-parameter rule, and prompt-cache-aware billing.
import * as ac from '../src/lib/aiCredits.js';

let fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : `| got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};
const mk = (id, provider) => ({ id, provider, tier: ac.inferModelTier(id), credit_multiplier: ac.inferModelMultiplier(id) });

// ── price table: multiplier = ((2*in + out)/3) / 0.30, recomputed from the vendors' price pages
t('baseline model is 1x', ac.inferModelMultiplier('gpt-4o-mini'), 1);
t('claude-fable-5-1 ($10/$50) is 78x, not the old 30x', ac.inferModelMultiplier('claude-fable-5-1'), 78);
t('claude-sonnet-5-5 ($2/$10) is 16x', ac.inferModelMultiplier('claude-sonnet-5-5'), 16);
t('claude-haiku-4-5 ($1/$5) is 8x', ac.inferModelMultiplier('claude-haiku-4-5'), 8);
t('dated and alias haiku price the same', ac.inferModelMultiplier('claude-haiku-4-5-20251001'), ac.inferModelMultiplier('claude-haiku-4-5'));
t('gpt-5-mini is 3x, not the old 1x', ac.inferModelMultiplier('gpt-5-mini'), 3);
t('unknown future opus is priced on the high side', ac.inferModelMultiplier('claude-opus-9'), 39);
t('unknown future fable is priced as fable', ac.inferModelMultiplier('claude-fable-9'), 78);
t('o4-mini (unknown) is NOT billed as a cheap "mini"', ac.inferModelMultiplier('o4-mini'), 7);
t('o3-mini is 7x', ac.inferModelMultiplier('o3-mini'), 7);
t('unknown gpt-5.x mini is 3x', ac.inferModelMultiplier('gpt-5.6-mini'), 3);
t('unknown gpt-5.x is 14x', ac.inferModelMultiplier('gpt-5.6'), 14);
t('a completely unknown id is assumed mid-tier, not free', ac.inferModelMultiplier('mystery-model'), 17);
t('every priced model is above zero', Object.values(ac.MODEL_COST_MULTIPLIER).every((v) => v > 0), true);
t('no retired model is still in the price table',
  Object.keys(ac.MODEL_COST_MULTIPLIER).filter((k) => /^(claude-3-|gpt-4-turbo|gpt-3\.5|dall-e|gpt-image-1$)/.test(k)), []);

// ── the static fallback list (MODEL_TIER keys) offers nothing that shuts down within weeks
t('o1 and gpt-4.1-nano (shut down 2026-10-23) are not offered statically', Object.keys(ac.MODEL_TIER).filter((k) => /^(o1|gpt-4.1-nano)$/.test(k)), []);
t('they are still priced if an old setting names them', [ac.inferModelMultiplier('o1'), ac.inferModelMultiplier('gpt-4.1-nano')], [100, 0.7]);

// ── tiers and plan gates
t('fable is smartest', ac.inferModelTier('claude-fable-5-1'), 'smartest');
t('Growth cannot use the most expensive Claude model', ac.isModelAllowedForPlan('claude-fable-5-1', 'growth'), false);
t('Scale can', ac.isModelAllowedForPlan('claude-fable-5-1', 'scale'), true);
t('Growth can use Sonnet', ac.isModelAllowedForPlan('claude-sonnet-5-5', 'growth'), true);
t('Starter cannot use Sonnet', ac.isModelAllowedForPlan('claude-sonnet-5-5', 'starter'), false);
t('Starter can use haiku', ac.isModelAllowedForPlan('claude-haiku-4-5', 'starter'), true);
t('an unknown opus keeps the smartest tier (price alone put it one point under the cutoff)', ac.inferModelTier('claude-opus-9'), 'smartest');
t('an unknown sonnet is smarter', ac.inferModelTier('claude-sonnet-9'), 'smarter');
t('an unknown haiku is smart', ac.inferModelTier('claude-haiku-9'), 'smart');
t('same tokens cost 78/8 times more on fable than on haiku',
  ac.computeCreditCost({ model: 'claude-fable-5-1', promptTokens: 6000, completionTokens: 0 }) / ac.computeCreditCost({ model: 'claude-haiku-4-5', promptTokens: 6000, completionTokens: 0 }), 9.75);

// ── Anthropic sampling parameters
for (const id of ['claude-opus-4-7', 'claude-opus-4-8', 'claude-opus-4-10', 'claude-opus-5', 'claude-opus-5-5', 'claude-sonnet-5', 'claude-sonnet-5-5', 'claude-fable-5-1', 'claude-mythos-1']) {
  t(`${id} rejects temperature`, ac.anthropicRejectsSampling(id), true);
}
for (const id of ['claude-opus-4-5', 'claude-opus-4-6', 'claude-opus-4-20250514', 'claude-opus-4-1-20250805', 'claude-sonnet-4-5', 'claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-haiku-4-5-20251001', 'gpt-5', undefined, '']) {
  t(`${id} still accepts temperature`, ac.anthropicRejectsSampling(id), false);
}

// ── billing on prompt-cache usage: input_tokens EXCLUDES cache reads/writes
t('plain usage is unchanged', ac.weightedPromptTokens({ input_tokens: 500 }), 500);
t('cache write is 1.25x and read is 0.1x', ac.weightedPromptTokens({ input_tokens: 10, cache_creation_input_tokens: 1000, cache_read_input_tokens: 10000 }), 10 + 1250 + 1000);
t('a fully cached prompt is no longer billed as ~0', ac.weightedPromptTokens({ input_tokens: 4, cache_read_input_tokens: 40000 }) > 3000, true);
t('missing usage is 0, not NaN', ac.weightedPromptTokens(undefined), 0);

// ── live catalog: a model id the provider has RETIRED is replaced by a live model of the same tier
t('no catalog -> a retired id passes through (nothing to compare with)', ac.liveModelFor('claude-3-5-sonnet-20241022'), 'claude-3-5-sonnet-20241022');
t('defaults are current models', ac.defaultModelFor('anthropic'), 'claude-haiku-4-5-20251001');
t('the mid and cheap constants are not retired ids', [ac.ANTHROPIC_CHEAP_MODEL, ac.ANTHROPIC_MID_MODEL].some((m) => /^claude-3-/.test(m)), false);

const bigCatalog = () => ['claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'].map((id) => mk(id, 'anthropic'));
ac.setLiveCatalog('anthropic', bigCatalog());
t('model still live -> unchanged', ac.liveModelFor('claude-sonnet-5'), 'claude-sonnet-5');
t('retired Sonnet -> a live SONNET-class model', ac.liveModelFor('claude-3-5-sonnet-20241022'), 'claude-sonnet-5');
t('retired Haiku -> the live HAIKU, not a pricey model', ac.liveModelFor('claude-3-5-haiku-20241022'), 'claude-haiku-4-5-20251001');
t('retired Opus -> a live smartest-tier model', ['claude-opus-5-5', 'claude-fable-5-1'].includes(ac.liveModelFor('claude-3-opus-20240229')), true);
t('an alias of a live dated snapshot is the same model, not "retired"', ac.liveModelFor('claude-haiku-4-5'), 'claude-haiku-4-5');
ac.setLiveCatalog('anthropic', ['claude-haiku-4-5', 'claude-sonnet-5'].map((id) => mk(id, 'anthropic')));
t('the dated id of a live alias likewise', ac.liveModelFor('claude-haiku-4-5-20251001'), 'claude-haiku-4-5-20251001');
ac.setLiveCatalog('anthropic', bigCatalog());
t('default model for anthropic is a live one', ac.defaultModelFor('anthropic'), 'claude-haiku-4-5-20251001');
t('plan downgrade lands on a live model', ac.resolveModelForPlan('claude-opus-5-5', 'growth', 'anthropic'), ac.liveModelFor(ac.ANTHROPIC_MID_MODEL, 'anthropic'));
t('forced-cheap action lands on live haiku', ac.resolveActionModel('brand_scan', undefined, 'starter', 'anthropic'), 'claude-haiku-4-5-20251001');
t('a saved preference naming a retired model is corrected', ac.resolveModelForPlan('claude-3-5-sonnet-20241022', 'growth', 'anthropic'), 'claude-sonnet-5');

t('openai with no catalog -> unchanged', ac.liveModelFor('gpt-4o-mini', 'openai'), 'gpt-4o-mini');
ac.setLiveCatalog('openai', ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'o3'].map((id) => mk(id, 'openai')));
t('openai retired mini -> the nearest-PRICED live model of its tier (nano, 0.6x vs 1x), never a flagship', ac.liveModelFor('gpt-4o-mini', 'openai'), 'gpt-5-nano');
t('openai model still live -> unchanged', ac.liveModelFor('gpt-5', 'openai'), 'gpt-5');

ac.setLiveCatalog('anthropic', []);
t('an EMPTY refresh keeps the last good catalog (a failed fetch must not mark everything retired)', ac.liveModelFor('claude-3-5-sonnet-20241022'), 'claude-sonnet-5');
t('undefined model is left alone', ac.liveModelFor(undefined), undefined);
t('credit cost follows the substituted model family', ac.inferModelMultiplier(ac.liveModelFor('claude-3-5-sonnet-20241022')), 16);

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
// Flush stdout first: on Windows the process can exit before its piped output is written, and run.mjs then sees an empty file (a one-off
// "0 passed" failure of a file that had passed).
await new Promise((resolve) => process.stdout.write('', resolve));
process.exit(fail ? 1 : 0);
