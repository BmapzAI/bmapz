// Proves the built app bundle (mobile/www) contains no way to buy anything.
//
// The stores require their own payment system for digital subscriptions and credit packs, take 15-30%, and reject apps that link to an
// outside checkout. The app is consumption-only, and "the buttons are hidden at run time" is the weaker claim, so the native build
// REMOVES the billing code instead (vite.config.js swaps the billing screens for a stub when VITE_NATIVE_BUILD=1). This looks for
// what that removal must have taken with it. A needle that appears means a purchase path survived into a store build.
//
//   node mobile/scripts/check-bundle.mjs            fails (exit 1) when any needle is found
//   node mobile/scripts/check-bundle.mjs --report   prints what it finds and exits 0 (to see the baseline)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = path.join(root, 'mobile', 'www');
const reportOnly = process.argv.includes('--report');

// Each needle: the text to look for and why its presence is a problem.
const NEEDLES = [
  ['js.stripe.com', 'the Stripe.js loader (card entry inside the app)'],
  ['checkout.stripe.com', 'a hosted Stripe checkout address'],
  ['billing.stripe.com', 'the Stripe customer portal address'],
  ['/api/billing/checkout', 'the call that creates a purchase'],
  ['/api/billing/portal', 'the call that opens the subscription portal'],
  ['/api/addons/purchase', 'the add-on purchase call'],
  ['loadStripe', 'Stripe.js initialisation'],
  ['@stripe/react-stripe-js', 'Stripe card components'],
  // Not a purchase marker: proof that Design Studio, the App Owner's confidential feature, is not shipped inside the app (it is only used by that page).
  ['/api/ai/edit-image', "Design Studio's image editor"],
];

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
}

if (!fs.existsSync(dir)) {
  console.error('mobile/www does not exist: build the web bundle first (npm run build:web in mobile/).');
  process.exit(1);
}

const files = walk(dir).filter((f) => /\.(js|mjs|css|html|json|map)$/.test(f) && !f.endsWith('.map'));
const hits = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const [needle, why] of NEEDLES) {
    if (text.includes(needle)) hits.push(`${path.relative(dir, file)}: contains "${needle}" (${why})`);
  }
}

console.log(`Scanned ${files.length} files in mobile/www for ${NEEDLES.length} purchase markers.`);
if (hits.length) {
  console.log('\nFound:\n  - ' + hits.join('\n  - '));
  if (!reportOnly) {
    console.error('\nA purchase path is present in the app bundle. Remove it from the native build (see vite.config.js, VITE_NATIVE_BUILD).');
    process.exit(1);
  }
} else {
  console.log('None found: the app bundle has no purchase code.');
}
