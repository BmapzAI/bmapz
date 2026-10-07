/**
 * Wording for the Android / iOS apps when the server says a plan or credit limit was reached.
 *
 * The server's messages tell people to "upgrade your plan or buy a credit pack" and mention the pricing page. On the website that is
 * right. In the app it is a call to action to buy outside the store's payment system, which both stores treat as steering and reject
 * (and the app has no place to act on it anyway). So inside the app those messages are replaced by a plain statement of the situation.
 * Messages that are NOT about plans or credits (a missing provider key, a validation error) are left exactly as the server wrote them.
 */
const BY_CODE = {
  CREDITS_EXHAUSTED: "You've used all of your AI credits for this period.",
  NO_SUBSCRIPTION: "This account doesn't have an active plan.",
  NO_SCAN_TOKENS: 'No scan tokens are available for this period.',
};

// Anything else that still carries buying language (older routes that send no code).
const STEERING = /\b(upgrade|pricing page|credit pack|top[- ]?up|buy (more|a|an|extra)|purchase)\b/i;

export function neutralizeForApp(message, code) {
  if (code && Object.prototype.hasOwnProperty.call(BY_CODE, code)) return BY_CODE[code];
  if (STEERING.test(String(message || ''))) return "This isn't available on your current plan.";
  return message;
}
