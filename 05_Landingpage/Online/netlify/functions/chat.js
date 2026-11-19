// sur.plus — live chat backend (Netlify Function + Supabase REST + Resend)
//
// One endpoint, four operations:
//   GET  ?thread=<uuid>[&after=<iso>]          visitor polls messages of their thread
//   POST {thread, body, email?, lang?, page?}  visitor sends a message (+ email notify)
//   GET  ?ops=1&token=<CHAT_OPS_TOKEN>         operator lists recent messages (all threads)
//   POST {ops:1, token, thread, body}          operator replies as "florian"
//
// Storage: Supabase table public.lp_chat_messages (RLS enabled, NO anon policies —
// only this function talks to it, with the service-role key). The visitor's thread
// UUID is generated client-side (crypto.randomUUID) and lives in localStorage;
// it is unguessable and is the only "credential" a visitor has.
//
// Required env (Netlify → Site settings → Environment variables):
//   CHAT_SUPABASE_URL          e.g. https://xyzcompany.supabase.co
//   CHAT_SUPABASE_SERVICE_KEY  service-role key of the chat project
//   CHAT_OPS_TOKEN             long random string; only Florian knows it
// Optional (already set for the report/exit functions):
//   RESEND_API_KEY, REPORT_FROM, REPORT_NOTIFY
// Optional push notification via Telegram (see docs/ops/lp-chat-runbook.md):
//   CHAT_TELEGRAM_BOT_TOKEN, CHAT_TELEGRAM_CHAT_ID

const crypto = require('crypto');

const FROM = process.env.REPORT_FROM || 'Florian Lechner <florian@surpluspurpose.com>';
const NOTIFY = process.env.REPORT_NOTIFY || 'florian@surpluspurpose.com';
const TABLE = 'lp_chat_messages';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 2000;
const FLOOD_LIMIT = 40; // visitor messages per thread per hour

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}

function configured() {
  return Boolean(process.env.CHAT_SUPABASE_URL && process.env.CHAT_SUPABASE_SERVICE_KEY);
}

function sbHeaders(extra) {
  const key = process.env.CHAT_SUPABASE_SERVICE_KEY;
  return Object.assign(
    { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    extra || {}
  );
}

function sbUrl(query) {
  return process.env.CHAT_SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + TABLE + query;
}

function tokenOk(supplied) {
  const expected = process.env.CHAT_OPS_TOKEN;
  if (!expected || typeof supplied !== 'string') return false;
  const a = Buffer.from(String(supplied));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validEmail(e) {
  return typeof e === 'string' && e.length < 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function listMessages(thread, after) {
  let q = '?select=id,sender,body,created_at&thread_id=eq.' + thread + '&order=created_at.asc&limit=200';
  if (after) q += '&created_at=gt.' + encodeURIComponent(after);
  const res = await fetch(sbUrl(q), { headers: sbHeaders() });
  if (!res.ok) throw new Error('supabase_select_' + res.status + ' ' + (await res.text()).slice(0, 300));
  return res.json();
}

async function countLastHour(thread) {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const res = await fetch(
    sbUrl('?select=id&thread_id=eq.' + thread + '&sender=eq.visitor&created_at=gte.' + encodeURIComponent(since)),
    { headers: sbHeaders({ Prefer: 'count=exact', Range: '0-0' }) }
  );
  const range = res.headers.get('content-range') || '0/0';
  return Number(range.split('/')[1] || 0);
}

async function insertMessage(row) {
  const res = await fetch(sbUrl(''), {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(row)
  });
  if (!res.ok) throw new Error('supabase_insert_' + res.status + ' ' + (await res.text()).slice(0, 300));
  const rows = await res.json();
  return rows[0];
}

async function notifyTelegram(p) {
  const token = process.env.CHAT_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.CHAT_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const opsLink = 'https://surpluspurpose.com/chat-ops.html#' + p.thread;
  const text =
    '💬 Live-Chat (' + String(p.thread).slice(0, 8) + '…)\n\n' +
    String(p.body).slice(0, 1000) +
    '\n\n' + (p.email ? '📧 ' + p.email : 'keine E-Mail angegeben') +
    ' · ' + (p.lang || '?') + ' · ' + (p.page || '?') +
    '\n' + opsLink;
  try {
    const res = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
    });
    if (!res.ok) {
      // Telegram error bodies contain no secrets; log them so failures are debuggable.
      console.error('telegram notify failed:', res.status, (await res.text()).slice(0, 300));
    }
  } catch (e) {
    console.error('telegram notify error:', e instanceof Error ? e.message : e);
  }
}

async function notifyFlorian(p, saved) {
  if (!process.env.RESEND_API_KEY) return;
  const shortId = String(p.thread).slice(0, 8);
  const opsLink = 'https://surpluspurpose.com/chat-ops.html#' + p.thread;
  const html =
    '<p><b>Neue Live-Chat-Nachricht</b> (Thread ' + esc(shortId) + '&hellip;)</p>' +
    '<blockquote style="border-left:3px solid #4DB896;margin:8px 0;padding:6px 12px;color:#15241d">' +
    esc(p.body) + '</blockquote><ul>' +
    '<li><b>E-Mail des Besuchers:</b> ' + esc(p.email || '(keine angegeben)') + '</li>' +
    '<li><b>Sprache/Seite:</b> ' + esc(p.lang || '?') + ' · ' + esc(p.page || '?') + '</li>' +
    '<li><b>Zeit:</b> ' + esc(saved ? saved.created_at : '') + '</li></ul>' +
    '<p><a href="' + opsLink + '">Im Chat antworten &rarr;</a></p>';
  const body = {
    from: FROM,
    to: [NOTIFY],
    subject: 'Live-Chat: neue Nachricht (' + shortId + '…)' + (p.email ? ' · ' + p.email : ''),
    html
  };
  if (p.email && validEmail(p.email)) body.reply_to = p.email;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    /* notification is best-effort; the message itself is already stored */
  }
}

exports.handler = async function (event) {
  if (!configured()) return json(503, { error: 'chat_not_configured' });

  try {
    if (event.httpMethod === 'GET') {
      const q = event.queryStringParameters || {};

      if (q.ops === '1') {
        if (!tokenOk(q.token)) return json(401, { error: 'unauthorized' });
        const res = await fetch(
          sbUrl('?select=id,thread_id,sender,body,visitor_email,lang,page,created_at&order=created_at.desc&limit=300'),
          { headers: sbHeaders() }
        );
        if (!res.ok) return json(502, { error: 'storage_unavailable' });
        return json(200, { messages: await res.json() });
      }

      if (!UUID_RE.test(q.thread || '')) return json(400, { error: 'invalid_thread' });
      const after = q.after && !Number.isNaN(Date.parse(q.after)) ? q.after : null;
      return json(200, { messages: await listMessages(q.thread, after) });
    }

    if (event.httpMethod === 'POST') {
      let p;
      try {
        p = JSON.parse(event.body || '{}');
      } catch (e) {
        return json(400, { error: 'bad_request' });
      }

      const body = typeof p.body === 'string' ? p.body.trim() : '';
      if (!UUID_RE.test(p.thread || '')) return json(400, { error: 'invalid_thread' });
      if (!body || body.length > MAX_BODY) return json(400, { error: 'invalid_body' });

      if (p.ops === 1 || p.ops === '1') {
        if (!tokenOk(p.token)) return json(401, { error: 'unauthorized' });
        const saved = await insertMessage({ thread_id: p.thread, sender: 'florian', body });
        return json(200, { ok: true, message: saved });
      }

      if (p.email && !validEmail(p.email)) return json(400, { error: 'invalid_email' });
      if (p.website) return json(200, { ok: true }); // honeypot: pretend success, store nothing
      if ((await countLastHour(p.thread)) >= FLOOD_LIMIT) return json(429, { error: 'too_many_messages' });

      const saved = await insertMessage({
        thread_id: p.thread,
        sender: 'visitor',
        body,
        visitor_email: p.email || null,
        lang: typeof p.lang === 'string' ? p.lang.slice(0, 8) : null,
        page: typeof p.page === 'string' ? p.page.slice(0, 200) : null
      });
      await Promise.all([notifyFlorian(p, saved), notifyTelegram(p)]);
      return json(200, { ok: true, message: { id: saved.id, sender: saved.sender, body: saved.body, created_at: saved.created_at } });
    }

    return json(405, { error: 'method_not_allowed' });
  } catch (e) {
    // Detail only in the function log — the client just sees a generic error.
    console.error('chat function error:', e instanceof Error ? e.message : e);
    return json(502, { error: 'storage_unavailable' });
  }
};
