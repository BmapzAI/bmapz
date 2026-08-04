/**
 * Feature visibility rules.
 *
 * DESIGN STUDIO IS CONFIDENTIAL until the next launch cycle. Only an App Owner
 * account may see it — not company admins, not regular users. That means:
 *   - no sidebar / bottom-nav entry
 *   - no route (a direct URL must not render it)
 *   - no "Design Studio" shortcuts from Social, Blog or Ads
 *   - no mention of it by the support assistant (see backend/src/routes/help.js,
 *     which builds its page list from the same rule)
 *
 * Keep every Design reference behind this helper so the section cannot leak.
 */

/** The platform-owner role. Company admins are NOT owners. */
export const isAppOwner = (user) => user?.role === 'owner';

/** Whether the Design Studio may be shown to this user at all. */
export const canSeeDesign = (user) => isAppOwner(user);
