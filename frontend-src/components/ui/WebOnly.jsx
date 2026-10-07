import { isNativeApp } from '@/lib/platform';

/**
 * Renders its children on the website only; inside the Android / iOS apps it renders `fallback` (nothing by default).
 *
 * Use it around anything that sells, upgrades, prices or links to an outside checkout. The apps are consumption-only
 * (plans and credit packs are bought on ai.bmapz.com), because the stores require their own payment system for digital
 * subscriptions and reject apps that send people to an outside one. Do NOT use it to hide role-gated features: those are
 * decided by the user's role on every platform (Design Studio stays App-Owner-only everywhere).
 */
export default function WebOnly({ children, fallback = null }) {
  return isNativeApp() ? fallback : children;
}
