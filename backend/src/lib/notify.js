/**
 * Notification helper — one place to create in-app notifications.
 * Used by the workflow engine (hand-over actions), the SDR engine (outcomes),
 * and inbound-lead triggers. Notifications surface in the app's bell dropdown,
 * the Notifications tab, and the Home widget.
 */
import { supabaseAdmin } from './supabase.js';

/**
 * @param {object} n
 * @param {string} n.companyId
 * @param {string} [n.type]      info|lead|handover|sdr|workflow|qualification|system
 * @param {string} n.title
 * @param {string} [n.body]
 * @param {string} [n.link]      in-app path
 * @param {string} [n.icon]      emoji
 * @param {'low'|'normal'|'high'} [n.priority]
 * @param {string} [n.leadId]
 * @param {string} [n.userId]    null = whole company
 * @param {object} [n.metadata]
 */
export async function createNotification(n) {
  if (!n?.companyId || !n?.title) return null;
  try {
    const { data, error } = await supabaseAdmin.from('notifications').insert({
      company_id: n.companyId,
      user_id: n.userId || null,
      type: n.type || 'info',
      title: n.title,
      body: n.body || null,
      link: n.link || null,
      icon: n.icon || null,
      priority: n.priority || 'normal',
      lead_id: n.leadId || null,
      metadata: n.metadata || {},
    }).select().single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[notify] failed:', err.message);
    return null;
  }
}
