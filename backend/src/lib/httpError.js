/**
 * Safe error responses for route-level catch blocks.
 *
 * index.js has a global error handler that deliberately refuses to send err.message
 * to the client on a 5xx, because an unexpected failure is usually a database error
 * and Postgres names tables, columns and constraints in its messages — a crash
 * would otherwise hand an attacker a free map of the schema.
 *
 * That handler only runs for errors passed to next(). Routes that catch their own
 * errors and call res.status(500).json({ error: err.message }) answer the request
 * themselves, so they never reach it and the scrubbing does not apply. That pattern
 * is used in ~199 places, which is why this helper exists rather than a fix in one
 * route: the logic lives in one place and matches the global handler exactly.
 *
 * The full error still goes to the logs. Only what reaches the CLIENT changes.
 */

/** Postgres and Supabase errors read like a schema dump. Never forward one. */
const LOOKS_LIKE_SQL = /relation "|column "|constraint|violates|pg_|SQLSTATE|duplicate key|syntax error at/i;

/**
 * What it is safe to tell the caller about a failure we did not expect.
 *
 * Errors we raised on purpose carry an explicit status (4xx) and a message we
 * wrote, so those are returned as-is. Anything else gets a generic sentence.
 */
export function safeMessage(err, fallback = 'Something went wrong on our side. Please try again.') {
  const status = err?.status || err?.statusCode || 500;
  const msg = String(err?.message || '');
  if (status >= 400 && status < 500 && msg && !LOOKS_LIKE_SQL.test(msg)) return msg;
  return fallback;
}

/**
 * Log the real error, answer with a safe one.
 *
 * `context` is a short tag for the logs, e.g. '[integrations] status'. It is never
 * sent to the client.
 */
export function sendServerError(res, err, context, shape = 'error') {
  const status = err?.status || err?.statusCode || 500;
  console.error(context, status, err?.message, err?.stack ? `\n${err.stack}` : '');
  const message = safeMessage(err);
  return res
    .status(status >= 400 && status < 600 ? status : 500)
    .json(shape === 'success' ? { success: false, message } : { error: message });
}
