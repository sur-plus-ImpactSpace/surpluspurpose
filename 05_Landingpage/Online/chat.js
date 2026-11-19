/* sur.plus — live chat widget (cookieless, vanilla JS, EN/DE)
 *
 * Opens from any element with class "js-open-chat" (optional data-msg prefill).
 * State: a random thread UUID + optional reply email in localStorage — no cookies,
 * no third-party scripts. Backend: /.netlify/functions/chat (Supabase EU storage).
 */
(function () {
  'use strict';

  var API = '/.netlify/functions/chat';
  var DE = document.documentElement.lang === 'de' || location.pathname.indexOf('/de/') === 0;
  var T = DE
    ? {
        title: 'Chat mit Florian',
        sub: 'Erreichbar 8–18 Uhr · Antwort meist in Minuten.',
        subOff: 'Gerade außerhalb der Zeiten (8–18 Uhr) – Antwort folgt.',
        placeholder: 'Deine Nachricht …',
        emailPh: 'E-Mail für Antworten (optional)',
        send: 'Senden',
        hello: 'Hi! Ich bin Florian, Gründer von sur.plus. Was kann ich für dich tun?',
        helloOff: 'Hi! Ich bin Florian. Gerade bin ich außerhalb der Geschäftszeiten (täglich 8–18 Uhr) unterwegs – entschuldige die Wartezeit. Schreib mir trotzdem gern: Mit E-Mail-Adresse antworte ich dir so schnell wie möglich, spätestens am nächsten Morgen.',
        error: 'Senden fehlgeschlagen – bitte noch einmal versuchen oder an service@surpluspurpose.com mailen.',
        close: 'Chat schließen'
      }
    : {
        title: 'Chat with Florian',
        sub: 'Available 8am–6pm CET · replies usually in minutes.',
        subOff: 'Currently outside chat hours (8am–6pm CET) – reply will follow.',
        placeholder: 'Your message …',
        emailPh: 'Email for replies (optional)',
        send: 'Send',
        hello: "Hi! I'm Florian, founder of sur.plus. How can I help?",
        helloOff: "Hi! I'm Florian. You've caught me outside chat hours (8am–6pm CET, daily) – sorry for the wait. Do leave your message: with an email address I'll get back to you as soon as I can, by next morning at the latest.",
        error: 'Sending failed – please try again or email service@surpluspurpose.com.',
        close: 'Close chat'
      };

  function inBusinessHours() {
    try {
      var h = Number(
        new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/Berlin' })
          .format(new Date())
      );
      return h >= 8 && h < 18;
    } catch (e) {
      var lh = new Date().getHours();
      return lh >= 8 && lh < 18;
    }
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  var thread = store.get('spChatThread');
  if (!thread) { thread = uuid(); store.set('spChatThread', thread); }

  var el = null, listEl = null, pollTimer = null, lastTs = null, seen = {};

  function build() {
    if (el) return;
    var online = inBusinessHours();
    el = document.createElement('div');
    el.id = 'sp-chat';
    el.innerHTML =
      '<style>' +
      '#sp-chat{position:fixed;right:18px;bottom:18px;z-index:9999;width:min(360px,calc(100vw - 36px));' +
      'font-family:inherit;display:none;flex-direction:column;background:#fff;border-radius:16px;' +
      'box-shadow:0 12px 48px rgba(10,35,24,.28);overflow:hidden;border:1px solid #e6efea}' +
      '#sp-chat.open{display:flex}' +
      /* LP uses a custom "black-hole" cursor (cursor:none globally); restore the
         native cursor inside the chat, same as the legal modal does. */
      'body.bh-on #sp-chat,body.bh-on #sp-chat *{cursor:auto!important}' +
      'body.bh-on #sp-chat button,body.bh-on #sp-chat .spc-x,body.bh-on #sp-chat .spc-s{cursor:pointer!important}' +
      '#sp-chat button{cursor:pointer}' +
      '#sp-chat .spc-h{background:#0A2318;color:#fff;padding:14px 16px;display:flex;gap:10px;align-items:center}' +
      '#sp-chat .spc-h img{width:38px;height:38px;border-radius:50%;object-fit:cover}' +
      '#sp-chat .spc-ht{flex:1;min-width:0}' +
      '#sp-chat .spc-ht b{display:block;font-size:15px}' +
      '#sp-chat .spc-ht span{display:block;font-size:11.5px;color:#9fd6c2;margin-top:2px}' +
      '#sp-chat .spc-x{background:none;border:0;color:#9fd6c2;font-size:22px;line-height:1;cursor:pointer;padding:4px}' +
      '#sp-chat .spc-m{height:300px;overflow-y:auto;padding:14px 12px;background:#f7faf8;display:flex;flex-direction:column;gap:8px}' +
      '#sp-chat .spc-b{max-width:82%;padding:8px 12px;border-radius:12px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}' +
      '#sp-chat .spc-b.v{align-self:flex-end;background:#0A2318;color:#fff;border-bottom-right-radius:4px}' +
      '#sp-chat .spc-b.f{align-self:flex-start;background:#fff;border:1px solid #e6efea;color:#15241d;border-bottom-left-radius:4px}' +
      '#sp-chat .spc-e{border:0;border-top:1px solid #eef4f0;padding:8px 12px;font-size:12.5px;width:100%;outline:none;color:#15241d}' +
      '#sp-chat .spc-f{display:flex;border-top:1px solid #e6efea}' +
      '#sp-chat textarea{flex:1;border:0;resize:none;padding:11px 12px;font-size:13.5px;font-family:inherit;outline:none;height:44px;color:#15241d}' +
      '#sp-chat .spc-s{border:0;background:#4DB896;color:#0A2318;font-weight:700;padding:0 16px;cursor:pointer;font-size:13.5px}' +
      '#sp-chat .spc-s:disabled{opacity:.55;cursor:default}' +
      '#sp-chat .spc-err{display:none;font-size:11.5px;color:#b4552d;padding:6px 12px;background:#fff7f2}' +
      '</style>' +
      '<div class="spc-h">' +
      '<img src="/img/founder_avatar.webp" onerror="this.style.display=\'none\'" alt="">' +
      '<div class="spc-ht"><b>' + T.title + '</b><span>' + (online ? T.sub : T.subOff) + '</span></div>' +
      '<button class="spc-x" type="button" aria-label="' + T.close + '">&times;</button>' +
      '</div>' +
      '<div class="spc-m" aria-live="polite"></div>' +
      '<div class="spc-err"></div>' +
      '<input class="spc-e" type="email" autocomplete="email" placeholder="' + T.emailPh + '">' +
      '<div class="spc-f"><textarea rows="1" placeholder="' + T.placeholder + '"></textarea>' +
      '<button class="spc-s" type="button">' + T.send + '</button></div>';
    document.body.appendChild(el);

    listEl = el.querySelector('.spc-m');
    var email = el.querySelector('.spc-e');
    email.value = store.get('spChatEmail') || '';
    email.addEventListener('change', function () { store.set('spChatEmail', email.value.trim()); });
    el.querySelector('.spc-x').addEventListener('click', close);
    el.querySelector('.spc-s').addEventListener('click', send);
    el.querySelector('textarea').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    bubble('f', online ? T.hello : T.helloOff);
  }

  function bubble(kind, text) {
    var b = document.createElement('div');
    b.className = 'spc-b ' + kind;
    b.textContent = text;
    listEl.appendChild(b);
    listEl.scrollTop = listEl.scrollHeight;
  }

  function showError(msg) {
    var e = el.querySelector('.spc-err');
    e.textContent = msg;
    e.style.display = 'block';
    setTimeout(function () { e.style.display = 'none'; }, 6000);
  }

  function render(messages) {
    (messages || []).forEach(function (m) {
      if (seen[m.id]) return;
      seen[m.id] = true;
      bubble(m.sender === 'florian' ? 'f' : 'v', m.body);
      lastTs = m.created_at;
    });
  }

  function poll() {
    var url = API + '?thread=' + thread + (lastTs ? '&after=' + encodeURIComponent(lastTs) : '');
    fetch(url).then(function (r) { return r.ok ? r.json() : { messages: [] }; })
      .then(function (d) { render(d.messages); })
      .catch(function () {});
  }

  function send() {
    var ta = el.querySelector('textarea');
    var btn = el.querySelector('.spc-s');
    var body = ta.value.trim();
    if (!body) return;
    btn.disabled = true;
    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread: thread,
        body: body,
        email: (store.get('spChatEmail') || '').trim() || undefined,
        lang: DE ? 'de' : 'en',
        page: location.pathname
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        btn.disabled = false;
        if (!res.ok || !res.d.ok) return showError(T.error);
        ta.value = '';
        if (res.d.message) render([res.d.message]);
        if (window.spTrack) spTrack('chat_message_sent');
      })
      .catch(function () { btn.disabled = false; showError(T.error); });
  }

  function open(prefill) {
    build();
    el.classList.add('open');
    if (prefill) el.querySelector('textarea').value = prefill;
    el.querySelector('textarea').focus();
    // Full refresh on every open: clear rendered bubbles, refetch the thread.
    seen = {}; lastTs = null;
    listEl.innerHTML = '';
    bubble('f', inBusinessHours() ? T.hello : T.helloOff);
    poll();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(poll, 4000);
    if (window.spTrack) spTrack('chat_open');
  }

  function close() {
    if (el) el.classList.remove('open');
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('.js-open-chat, a[href="#chat"]') : null;
    if (!a) return;
    e.preventDefault();
    open(a.getAttribute('data-msg') || '');
  });
})();
