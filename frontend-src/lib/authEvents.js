/**
 * What to do when Supabase reports an auth event.
 *
 * AuthContext used to answer EVERY event (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED...) by switching the whole app
 * to the full-screen loading state and reloading the profile. Supabase announces SIGNED_IN again each time the page regains focus
 * and TOKEN_REFRESHED about once an hour, so people were thrown out of whatever they were typing, and in the phone app every return
 * from the background did it. A failed reload on such a repeat event (offline on the train) replaced the app with "Connection Error".
 *
 *   reload  - fetch /api/auth/me again
 *   spinner - show the full-screen loading state while doing so
 *   silent  - if that fetch fails, keep what is on screen instead of showing an error
 */
export function authEventPlan({ event, sessionUserId, loadedUserId }) {
  // Same person, new token. apiFetch reads the live session on every request, so nothing needs reloading.
  if (event === 'TOKEN_REFRESHED') return { reload: false, spinner: false, silent: false };
  // Signed out, or no session yet: clear everything and say so.
  if (!sessionUserId) return { reload: true, spinner: true, silent: false };
  // A repeat announcement for the person already on screen: refresh quietly.
  if (sessionUserId === loadedUserId) return { reload: true, spinner: false, silent: true };
  // A different person (or the first load): the full treatment.
  return { reload: true, spinner: true, silent: false };
}
