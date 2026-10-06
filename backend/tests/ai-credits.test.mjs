// Behaviour test, kept in the repo so a reviewer can re-run the evidence. Run all: node backend/tests/run.mjs
//
// liveModelFor(): a chosen model id that the provider has RETIRED must be replaced by a live model of the
// same tier, and in every other situation nothing may change.
import * as ac from '../src/lib/aiCredits.js';

let fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : `| got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};
const mk = (id, provider) => ({ id, provider, tier: ac.inferModelTier(id), credit_multiplier: ac.inferModelMultiplier(id) });

// Before any catalog is loaded, behaviour must be EXACTLY the old behaviour.
t('no catalog -> retired id passes through, as before', ac.liveModelFor('claude-3-5-sonnet-20241022'), 'claude-3-5-sonnet-20241022');
t('no catalog -> defaults unchanged', ac.defaultModelFor('anthropic'), 'claude-3-5-haiku-20241022');

ac.setLiveCatalog('anthropic', ['claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'].map((id) => mk(id, 'anthropic')));
t('model still live -> unchanged', ac.liveModelFor('claude-sonnet-5'), 'claude-sonnet-5');
t('retired Sonnet -> a live SONNET-class model', ac.liveModelFor('claude-3-5-sonnet-20241022'), 'claude-sonnet-5');
t('retired Haiku -> the live HAIKU, not a pricey model', ac.liveModelFor('claude-3-5-haiku-20241022'), 'claude-haiku-4-5-20251001');
t('retired Opus -> the live OPUS', ac.liveModelFor('claude-3-opus-20240229'), 'claude-opus-5-5');
t('default model for anthropic is now a live one', ac.defaultModelFor('anthropic'), 'claude-haiku-4-5-20251001');
t('plan downgrade lands on a live model', ac.resolveModelForPlan('claude-opus-5-5', 'growth', 'anthropic'), 'claude-sonnet-5');
t('forced-cheap action lands on live haiku', ac.resolveActionModel('brand_scan', undefined, 'starter', 'anthropic'), 'claude-haiku-4-5-20251001');
t('a saved preference naming a retired model is corrected', ac.resolveModelForPlan('claude-3-5-sonnet-20241022', 'growth', 'anthropic'), 'claude-sonnet-5');

t('openai with no catalog -> unchanged', ac.liveModelFor('gpt-4o-mini', 'openai'), 'gpt-4o-mini');
ac.setLiveCatalog('openai', ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'o3'].map((id) => mk(id, 'openai')));
t('openai retired mini -> live MINI-class, not gpt-5', ac.liveModelFor('gpt-4o-mini', 'openai'), 'gpt-5-mini');
t('openai model still live -> unchanged', ac.liveModelFor('gpt-5', 'openai'), 'gpt-5');

ac.setLiveCatalog('anthropic', []);
t('an EMPTY refresh keeps the last good catalog (a failed fetch must not mark everything retired)', ac.liveModelFor('claude-3-5-sonnet-20241022'), 'claude-sonnet-5');
t('undefined model is left alone', ac.liveModelFor(undefined), undefined);
t('credit cost follows the substituted model family', ac.inferModelMultiplier(ac.liveModelFor('claude-3-5-sonnet-20241022')), 25);

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
