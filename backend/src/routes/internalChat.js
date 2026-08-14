/**
 * Internal team chat — staff-to-staff messaging inside one company.
 *
 * Deliberately separate from `messages` (the CLIENT inbox) and from the SDR:
 * nothing here is ever sent outside the company.
 *
 * Anything in the app can be shared into a thread as a `shared_ref`
 * ({ kind, id, title, subtitle, path }), so a teammate can open the exact lead,
 * report, draft, campaign, automation or SDR configuration being discussed.
 * Every new message raises a notification for the OTHER members only.
 */
import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, filterCompanyMembers } from '../middleware/auth.js';
import { createNotification } from '../lib/notify.js';
import { resolveMentions } from '../lib/mentions.js';

const router = Router();

const MIGRATION_HINT = 'Team chat is not enabled yet — run migration 017.';
const isMissingTable = (err) =>
  /internal_conversations|internal_messages|internal_conversation_members|does not exist/i.test(err?.message || '');

/** Members of a conversation, with their profile, for display. */
async function membersOf(conversationId) {
  const { data } = await supabaseAdmin
    .from('internal_conversation_members')
    .select('user_id, last_read_at, muted, user:user_id (id, full_name, email, profile_picture)')
    .eq('conversation_id', conversationId);
  return data || [];
}

/** Throws unless the caller belongs to this conversation. */
async function assertMember(conversationId, userId, companyId) {
  const { data } = await supabaseAdmin
    .from('internal_conversation_members')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!data) {
    const e = new Error('You are not part of this conversation.');
    e.status = 403;
    throw e;
  }
}

/* ───────────────────────── Conversations ───────────────────────── */

// GET /api/team-chat/conversations — my threads, newest first, with unread counts.
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const me = req.dbUser.id;
    const { data: mine, error } = await supabaseAdmin
      .from('internal_conversation_members')
      .select('conversation_id, last_read_at')
      .eq('user_id', me).eq('company_id', req.companyId);
    if (error) throw error;
    if (!mine?.length) return res.json([]);

    const ids = mine.map(m => m.conversation_id);
    const { data: convs } = await supabaseAdmin
      .from('internal_conversations').select('*')
      .in('id', ids).order('last_message_at', { ascending: false });

    const out = [];
    for (const c of convs || []) {
      const members = await membersOf(c.id);
      const readAt = mine.find(m => m.conversation_id === c.id)?.last_read_at;
      // Unread = messages from OTHERS since I last opened the thread.
      let unread = 0;
      try {
        let q = supabaseAdmin.from('internal_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', c.id).neq('sender_id', me);
        if (readAt) q = q.gt('created_at', readAt);
        const { count } = await q;
        unread = count || 0;
      } catch { unread = 0; }

      out.push({
        ...c,
        members: members.map(m => m.user).filter(Boolean),
        unread,
        // A DM is named after the other person, not the thread.
        display_title: c.kind === 'group'
          ? (c.title || 'Group')
          : (members.find(m => m.user_id !== me)?.user?.full_name
            || members.find(m => m.user_id !== me)?.user?.email
            || 'Direct message'),
      });
    }
    res.json(out);
  } catch (err) {
    if (isMissingTable(err)) return res.status(503).json({ error: MIGRATION_HINT, code: 'MIGRATION_PENDING' });
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/team-chat/conversations — start a DM or a group.
// Body: { user_ids: [...], title? }
router.post('/conversations', requireAuth, async (req, res) => {
  try {
    const me = req.dbUser.id;
    const others = [...new Set((req.body?.user_ids || []).filter(id => id && id !== me))];
    if (!others.length) return res.status(400).json({ error: 'Choose at least one teammate.' });

    // Everyone must be in this company — never allow a cross-company thread.
    //
    // Uses membership, not home company. `.eq('company_id', req.companyId)`
    // compared each target's HOME company against the ACTIVE one, so a teammate
    // who is a guest in this company (accessible_company_ids) could not be added
    // to a thread in the very company they were working in.
    const validIds = await filterCompanyMembers(others, req.companyId);
    if (!validIds.length) return res.status(400).json({ error: 'Those users are not in your company.' });

    const kind = validIds.length === 1 ? 'dm' : 'group';

    // Reuse an existing one-to-one thread instead of creating duplicates.
    if (kind === 'dm') {
      const { data: myConvs } = await supabaseAdmin
        .from('internal_conversation_members').select('conversation_id')
        .eq('user_id', me).eq('company_id', req.companyId);
      const { data: theirConvs } = await supabaseAdmin
        .from('internal_conversation_members').select('conversation_id')
        .eq('user_id', validIds[0]).eq('company_id', req.companyId);
      const shared = (myConvs || []).map(c => c.conversation_id)
        .filter(id => (theirConvs || []).some(c => c.conversation_id === id));
      if (shared.length) {
        const { data: existing } = await supabaseAdmin.from('internal_conversations')
          .select('*').in('id', shared).eq('kind', 'dm').limit(1).maybeSingle();
        if (existing) return res.json({ ...existing, reused: true });
      }
    }

    const { data: conv, error } = await supabaseAdmin.from('internal_conversations').insert({
      company_id: req.companyId, kind,
      title: kind === 'group' ? (req.body?.title || 'Team chat') : null,
      created_by: me,
    }).select().single();
    if (error) throw error;

    await supabaseAdmin.from('internal_conversation_members').insert(
      [me, ...validIds].map(user_id => ({
        conversation_id: conv.id, user_id, company_id: req.companyId,
        last_read_at: user_id === me ? new Date().toISOString() : null,
      }))
    );

    res.json(conv);
  } catch (err) {
    if (isMissingTable(err)) return res.status(503).json({ error: MIGRATION_HINT, code: 'MIGRATION_PENDING' });
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* ───────────────────────── Messages ───────────────────────── */

router.get('/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    await assertMember(req.params.id, req.dbUser.id, req.companyId);
    const { data, error } = await supabaseAdmin
      .from('internal_messages')
      .select('*, sender:sender_id (id, full_name, email, profile_picture)')
      .eq('conversation_id', req.params.id)
      .order('created_at', { ascending: true })
      .limit(Math.min(300, Number(req.query.limit) || 200));
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    if (isMissingTable(err)) return res.status(503).json({ error: MIGRATION_HINT, code: 'MIGRATION_PENDING' });
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/team-chat/conversations/:id/messages
// Body: { body?, shared_ref?, attachments? } — at least one of body/shared_ref.
router.post('/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    const me = req.dbUser.id;
    await assertMember(req.params.id, me, req.companyId);

    const body = String(req.body?.body || '').trim();
    const sharedRef = req.body?.shared_ref || null;
    if (!body && !sharedRef) return res.status(400).json({ error: 'Write something or share an item.' });

    const { data: message, error } = await supabaseAdmin.from('internal_messages').insert({
      conversation_id: req.params.id,
      company_id: req.companyId,
      sender_id: me,
      body: body || null,
      shared_ref: sharedRef,
      attachments: Array.isArray(req.body?.attachments) ? req.body.attachments : [],
    }).select('*, sender:sender_id (id, full_name, email, profile_picture)').single();
    if (error) throw error;

    const preview = body || (sharedRef?.title ? `Shared: ${sharedRef.title}` : 'Shared an item');
    await supabaseAdmin.from('internal_conversations').update({
      last_message_at: new Date().toISOString(),
      last_message_preview: preview.slice(0, 160),
    }).eq('id', req.params.id);

    // Mark my own copy as read — I have obviously seen what I just sent.
    await supabaseAdmin.from('internal_conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', req.params.id).eq('user_id', me);

    // Notify everyone else on the thread (respecting mute).
    const members = await membersOf(req.params.id);
    const senderName = req.dbUser.full_name || req.dbUser.email || 'A teammate';
    for (const m of members) {
      if (m.user_id === me || m.muted) continue;
      await createNotification({
        companyId: req.companyId,
        userId: m.user_id,               // user-specific: only they see it
        type: 'team_chat',
        icon: sharedRef ? '📎' : '💬',
        priority: 'normal',
        title: `${senderName}: ${preview.slice(0, 60)}`,
        body: sharedRef ? `Shared ${sharedRef.kind || 'an item'}: ${sharedRef.title || ''}` : '',
        link: `/TeamChat?c=${req.params.id}`,
      });
    }

    // A mention reaches you even if you muted the thread, because being named is
    // a direct request for your attention rather than general thread traffic.
    // Members already notified above are skipped so nobody gets it twice.
    if (body) {
      const alreadyNotified = new Set(members.filter(m => m.user_id !== me && !m.muted).map(m => m.user_id));
      const { userIds } = await resolveMentions({ text: body, companyId: req.companyId });
      await Promise.all(
        userIds
          .filter(id => id !== me && !alreadyNotified.has(id))
          .map(userId => createNotification({
            companyId: req.companyId,
            userId,
            type: 'mention',
            icon: '@',
            priority: 'normal',
            title: `${senderName} mentioned you in team chat`,
            body: preview.slice(0, 140),
            link: `/TeamChat?c=${req.params.id}`,
          })),
      );
    }

    res.json(message);
  } catch (err) {
    if (isMissingTable(err)) return res.status(503).json({ error: MIGRATION_HINT, code: 'MIGRATION_PENDING' });
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/team-chat/conversations/:id/read — clear my unread badge.
router.post('/conversations/:id/read', requireAuth, async (req, res) => {
  try {
    await assertMember(req.params.id, req.dbUser.id, req.companyId);
    await supabaseAdmin.from('internal_conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', req.params.id).eq('user_id', req.dbUser.id);
    res.json({ ok: true });
  } catch (err) {
    if (isMissingTable(err)) return res.json({ ok: false });
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /api/team-chat/conversations/:id — mute/unmute or rename a group.
router.patch('/conversations/:id', requireAuth, async (req, res) => {
  try {
    await assertMember(req.params.id, req.dbUser.id, req.companyId);
    if (typeof req.body?.muted === 'boolean') {
      await supabaseAdmin.from('internal_conversation_members')
        .update({ muted: req.body.muted })
        .eq('conversation_id', req.params.id).eq('user_id', req.dbUser.id);
    }
    if (typeof req.body?.title === 'string') {
      await supabaseAdmin.from('internal_conversations')
        .update({ title: req.body.title.slice(0, 120) })
        .eq('id', req.params.id).eq('company_id', req.companyId).eq('kind', 'group');
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/team-chat/unread — total badge for the sidebar.
router.get('/unread', requireAuth, async (req, res) => {
  try {
    const me = req.dbUser.id;
    const { data: mine } = await supabaseAdmin
      .from('internal_conversation_members')
      .select('conversation_id, last_read_at')
      .eq('user_id', me).eq('company_id', req.companyId);
    let total = 0;
    for (const m of mine || []) {
      let q = supabaseAdmin.from('internal_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', m.conversation_id).neq('sender_id', me);
      if (m.last_read_at) q = q.gt('created_at', m.last_read_at);
      const { count } = await q;
      total += count || 0;
    }
    res.json({ count: total });
  } catch {
    res.json({ count: 0 });
  }
});

export default router;
