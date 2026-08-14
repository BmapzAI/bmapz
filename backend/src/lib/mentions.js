/**
 * Parsing @mentions out of internal text, and telling the people named.
 *
 * A mention that only styles text is decoration. The point of typing "@derek" is
 * that Derek finds out — so this resolves handles to real users in THIS company
 * and notifies them.
 *
 * One parser, shared by task comments, task descriptions and team chat, so a
 * handle means the same thing everywhere.
 */
import { supabaseAdmin } from './supabase.js';
import { createNotification } from './notify.js';

/**
 * Handles that mean "the AI agent" whatever the company renamed it to.
 * The company's own `personal_agent_name` is added at resolve time.
 */
export const AGENT_ALIASES = new Set(['ai', 'ia', 'agent', 'agente', 'bmapz', 'bmapzai']);

/**
 * The company's own name for the agent, as a handle (lowercased, spaces removed).
 * Returns null when unset or unreadable — callers fall back to the aliases.
 */
export async function getAgentHandle(companyId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('companies').select('api_keys').eq('id', companyId).maybeSingle();
    if (error) throw error;
    const name = data?.api_keys?.personal_agent_name;
    return name ? String(name).trim().replace(/\s+/g, '').toLowerCase() : null;
  } catch (e) {
    console.error('[mentions] could not read agent name:', e.message);
    return null;
  }
}

/** True when `handle` refers to the AI agent in this company. */
export async function isAgentHandle(companyId, handle) {
  const h = String(handle || '').trim().toLowerCase();
  if (!h) return false;
  if (AGENT_ALIASES.has(h)) return true;
  return h === await getAgentHandle(companyId);
}

/** Handles that mean "the whole company". */
const EVERYONE_ALIASES = new Set(['all', 'everyone', 'todos', 'equipe', 'team']);

/**
 * Pull the handles out of a body of text.
 *
 * Requires the "@" to start a word so an email address is not read as a mention,
 * and accepts the character set a username can contain.
 */
export function extractHandles(text) {
  const found = String(text || '').match(/(^|\s)@([A-Za-z0-9_.-]{2,40})/g) || [];
  return [...new Set(
    found.map(m => m.trim().replace(/^@/, '').toLowerCase()).filter(Boolean),
  )];
}

/**
 * Resolve handles to users of this company, plus the two special targets.
 *
 * Returns { userIds, mentionsAgent, mentionsEveryone }. Company members are
 * resolved including guests (accessible_company_ids), matching how membership
 * works everywhere else — someone working in this company should be mentionable
 * in it.
 */
export async function resolveMentions({ text, companyId }) {
  const handles = extractHandles(text);
  if (!handles.length) return { userIds: [], mentionsAgent: false, mentionsEveryone: false };

  // The company's own name for the agent counts as its handle.
  const agentHandle = await getAgentHandle(companyId);

  const mentionsAgent = handles.some(h => AGENT_ALIASES.has(h) || (agentHandle && h === agentHandle));
  const mentionsEveryone = handles.some(h => EVERYONE_ALIASES.has(h));

  // Anything left could be a person.
  const personHandles = handles.filter(h =>
    !AGENT_ALIASES.has(h) && !EVERYONE_ALIASES.has(h) && h !== agentHandle);

  let userIds = [];
  if (mentionsEveryone || personHandles.length) {
    // Fetch this company's members and match handles in JS rather than filtering
    // by username in the query. Three reasons:
    //  - case-insensitive: handles are lowercased when parsed, but nothing forces
    //    usernames to be stored lowercase, and `in.()` is case-sensitive.
    //  - exact: `ilike` would treat "_" and "." — both legal handle characters —
    //    as wildcards, so "@john_doe" could notify "johnXdoe".
    //  - tenant-safe by construction: only this company's rows are ever read, so a
    //    handle cannot confirm the existence of a user in another company.
    const scoped = supabaseAdmin.from('users').select('id, username').limit(500);
    // companyId comes from the session, but it is interpolated into a filter, so
    // it is checked as a UUID before use.
    const isUuid = /^[0-9a-f-]{36}$/i.test(String(companyId || ''));
    const { data, error } = isUuid
      ? await scoped.or(`company_id.eq.${companyId},accessible_company_ids.cs.{${companyId}}`)
      : { data: null, error: new Error('invalid company id') };
    if (error) console.error('[mentions] company lookup failed:', error.message);

    const members = data || [];
    userIds = mentionsEveryone
      ? members.map(u => u.id)
      : members
        .filter(u => personHandles.includes(String(u.username || '').toLowerCase()))
        .map(u => u.id);
  }

  return { userIds: [...new Set(userIds)], mentionsAgent, mentionsEveryone };
}

/**
 * Notify everyone mentioned in a piece of text.
 *
 * Never throws — a failed notification must not fail the comment or message that
 * carried it. The author is excluded: being told about your own mention is noise.
 */
export async function notifyMentions({
  text, companyId, actorUserId, actorLabel, title, link, icon = '💬',
}) {
  try {
    const { userIds, mentionsEveryone } = await resolveMentions({ text, companyId });
    const targets = userIds.filter(id => id && id !== actorUserId);
    if (!targets.length) return { notified: 0, mentionsEveryone };

    const body = String(text || '').slice(0, 140);
    await Promise.all(targets.map(userId => createNotification({
      companyId,
      userId,
      type: 'mention',
      title: title || `${actorLabel || 'Someone'} mentioned you`,
      body,
      icon,
      priority: 'normal',
      link,
      metadata: { mentioned_by: actorUserId, everyone: mentionsEveryone },
    })));

    return { notified: targets.length, mentionsEveryone };
  } catch (err) {
    console.error('[mentions] notify failed:', err.message);
    return { notified: 0 };
  }
}

export default { extractHandles, resolveMentions, notifyMentions };
