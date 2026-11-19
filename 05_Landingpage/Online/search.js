/* sur.plus — Antwort-Suche (cookieless, vanilla JS, EN/DE, 0 € Betriebskosten)
 *
 * Clientseitige Volltextsuche über alle LP-Inhalte (FAQ, Sektionen, Ratgeber,
 * Guides, Case Studies). Index: /search-index.{de|en}.json — erzeugt von
 * tools/build-search-index.mjs, lazy geladen beim ersten Öffnen.
 *
 * Öffnet sich über Elemente mit Klasse "js-open-search" (optional data-q
 * als vorbefüllte Frage), über a[href="#search"] oder Tastatur: "/" bzw.
 * Cmd/Ctrl+K. Fallback im Footer: Live-Chat mit Florian (js-open-chat,
 * wird von chat.js übernommen — die eingegebene Frage wird vorbefüllt).
 *
 * Keine Cookies, keine Fremd-Scripts, keine Backend-Calls außer dem
 * statischen Index-JSON. Kein LLM — dadurch dauerhaft kostenlos.
 */
(function (global) {
  'use strict';

  /* ---------------- Suche (pure Funktionen, in Node testbar) ---------------- */

  var STOP = {
    de: 'der die das den dem des ein eine einen einem einer und oder aber auch ist sind war sein kann man wie was wer wo wann warum wir ihr sie es ich du mit von für auf aus bei nach zu zum zur im in an am um über unter vor nicht kein keine es dass wenn dann noch nur schon mehr sehr als bis durch gegen ohne wird werden wurde muss müssen soll sollen darf dürfen hat haben hatte',
    en: 'the a an and or but also is are was be been can may how what who where when why we you they it i with of for on from at after to in into about over under before not no that if then still only already more very as until through against without will would must should could has have had do does did'
  };
  var stopSets = {};
  function stopSet(lang) {
    if (!stopSets[lang]) {
      stopSets[lang] = {};
      (STOP[lang] || '').split(' ').forEach(function (w) { stopSets[lang][w] = 1; });
    }
    return stopSets[lang];
  }

  function normalize(s) {
    s = String(s || '').toLowerCase();
    s = s.replace(/sur\.plus/g, 'surplus');
    s = s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
    return s;
  }

  // Kleine Synonym-Erweiterung für häufige Frage-Formulierungen
  var SYN = {
    de: {
      kostet: ['preis', 'preise', 'plan', 'kosten'],
      kosten: ['preis', 'preise', 'plan'],
      preis: ['kosten', 'plan'], preise: ['kosten', 'plan'],
      teuer: ['preis', 'kosten'], abo: ['plan'],
      firma: ['unternehmen'], firmen: ['unternehmen'],
      verein: ['ngo', 'gemeinnuetzig'], vereine: ['ngo', 'gemeinnuetzig'],
      moebel: ['bueromoebel'], laptop: ['it', 'hardware'], laptops: ['it', 'hardware'],
      steuer: ['steuerlich'], steuern: ['steuerlich'],
      spenden: ['sachspende', 'spende'], spende: ['sachspende']
    },
    en: {
      cost: ['pricing', 'price', 'plan'], costs: ['pricing', 'price', 'plan'],
      price: ['pricing', 'plan'], expensive: ['pricing', 'price'],
      company: ['companies', 'business'], charity: ['ngo', 'nonprofit'],
      laptop: ['it', 'hardware'], laptops: ['it', 'hardware'],
      donate: ['donation', 'donating'], tax: ['deductible']
    }
  };

  function tokenize(s, lang) {
    var stop = stopSet(lang || 'de');
    return normalize(s).split(/[^a-z0-9§€]+/).filter(function (t) {
      return t.length > 1 && !stop[t];
    });
  }

  // Dokumente einmalig vor-normalisieren
  function prepare(docs, lang) {
    for (var i = 0; i < docs.length; i++) {
      var d = docs[i];
      d._t = ' ' + normalize(d.t) + ' ';
      d._x = ' ' + normalize((d.x || '') + (d.kw ? ' ' + d.kw : '')) + ' ';
      d._lang = lang;
    }
    return docs;
  }

  function countOcc(hay, needle, cap) {
    var n = 0, i = 0;
    while (n < cap && (i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
    return n;
  }

  function scoreToken(d, tok, weight) {
    var hit = 0;
    if (d._t.indexOf(' ' + tok + ' ') !== -1) hit += 6;              // exaktes Wort im Titel
    else if (d._t.indexOf(' ' + tok) !== -1) hit += 3;               // Prefix im Titel
    else if (d._t.indexOf(tok) !== -1) hit += 1.5;                   // Teilwort im Titel (Komposita)
    var occ = countOcc(d._x, ' ' + tok, 3);
    if (occ) hit += 1.25 * occ;                                       // Prefix/Wort im Text
    else if (d._x.indexOf(tok) !== -1) hit += 0.6;                   // Teilwort im Text
    return hit * weight;
  }

  function scoreDoc(d, groups, weights) {
    var score = 0, covered = 0;
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i], best = 0;
      for (var j = 0; j < g.length; j++) {
        // Original volles Gewicht, Synonyme leicht reduziert
        var h = scoreToken(d, g[j], j === 0 ? 1 : 0.8);
        if (h > best) best = h;
      }
      if (best) covered++;
      score += best * (weights ? weights[i] : 1);
    }
    if (!score) return 0;
    score *= covered / groups.length;                                 // Abdeckungs-Bonus
    if (covered === groups.length && groups.length > 1) score *= 1.35;
    if (d.k === 'faq') score *= 1.5;                                  // FAQ = fertige Antworten
    else if (d.k === 'p') score *= 1.15;
    return score;
  }

  function search(docs, query, lang, limit) {
    var tokens = tokenize(query, lang);
    if (!tokens.length) return [];
    var syn = SYN[lang] || {};
    var groups = tokens.map(function (t) { return [t].concat(syn[t] || []); });
    // IDF-light: häufige Wörter (z. B. der Markenname) zählen weniger als seltene
    var weights = tokens.map(function (t) {
      var df = 1;
      for (var i = 0; i < docs.length; i++) {
        if (docs[i]._t.indexOf(t) !== -1 || docs[i]._x.indexOf(t) !== -1) df++;
      }
      return Math.log(1 + docs.length / df);
    });
    var wSum = weights.reduce(function (a, b) { return a + b; }, 0) || 1;
    weights = weights.map(function (w) { return (w * weights.length) / wSum; }); // Mittelwert 1
    var scored = [];
    for (var i = 0; i < docs.length; i++) {
      var s = scoreDoc(docs[i], groups, weights);
      if (s > 0) scored.push({ d: docs[i], s: s });
    }
    scored.sort(function (a, b) { return b.s - a.s; });
    return scored.slice(0, limit || 8);
  }

  // Snippet um den ersten Treffer herum, Treffer markiert
  function snippet(d, tokens, maxLen) {
    var raw = d.x || '';
    var norm = ' ' + normalize(raw) + ' '; // ohne kw-Feld, Offsets müssen zum Anzeigetext passen
    var pos = -1;
    for (var i = 0; i < tokens.length && pos === -1; i++) pos = norm.indexOf(tokens[i]);
    if (pos < 0) pos = 0; else pos = Math.max(0, pos - 1);
    var start = 0;
    if (pos > 60) { start = raw.lastIndexOf(' ', pos - 40); if (start < 0) start = pos - 40; }
    var text = (start > 0 ? '…' : '') + raw.slice(start, start + (maxLen || 220)) + (raw.length > start + (maxLen || 220) ? '…' : '');
    return text;
  }

  function markHits(escapedText, tokens) {
    var t = escapedText;
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      if (tok.length < 3) continue;
      // auch Umlaut-Originale markieren: ae->(ae|ä) etc.
      var pat = tok
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/ae/g, '(?:ae|ä)').replace(/oe/g, '(?:oe|ö)')
        .replace(/ue/g, '(?:ue|ü)').replace(/ss/g, '(?:ss|ß)');
      try { t = t.replace(new RegExp('(' + pat + ')', 'gi'), '\u0001$1\u0002'); } catch (e) {}
    }
    return t.replace(/\u0001/g, '<mark>').replace(/\u0002/g, '</mark>');
  }

  var core = { normalize: normalize, tokenize: tokenize, prepare: prepare, search: search, snippet: snippet, markHits: markHits };

  // Node-Testumgebung: nur Kern exportieren, kein DOM
  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = core;
    return;
  }
  global.__spSearchCore = core;

  /* ---------------- Widget ---------------- */

  var DE = document.documentElement.lang === 'de' || location.pathname.indexOf('/de/') === 0;
  var LANG = DE ? 'de' : 'en';
  var T = DE
    ? {
        title: 'Antwort-Suche',
        ph: 'Frage oder Stichwort … z. B. „Was kostet sur.plus?“',
        hint: 'Durchsucht die ganze Website: FAQ, Ratgeber, Case Studies.',
        empty: 'Keine Treffer. Anders formulieren – oder direkt fragen:',
        footer: 'Antwort nicht dabei?',
        chat: 'Mit Florian chatten',
        loading: 'Suche wird geladen …',
        error: 'Suche gerade nicht verfügbar – frag Florian direkt:',
        close: 'Suche schließen',
        kinds: { faq: 'FAQ', p: 'Seite', s: 'Abschnitt' },
        results: function (n) { return n + (n === 1 ? ' Treffer' : ' Treffer'); }
      }
    : {
        title: 'Answer search',
        ph: 'Question or keyword … e.g. “What does sur.plus cost?”',
        hint: 'Searches the whole site: FAQ, guides, case studies.',
        empty: 'No matches. Try rephrasing – or just ask:',
        footer: 'Didn\u2019t find it?',
        chat: 'Chat with Florian',
        loading: 'Loading search …',
        error: 'Search unavailable right now – ask Florian directly:',
        close: 'Close search',
        kinds: { faq: 'FAQ', p: 'Page', s: 'Section' },
        results: function (n) { return n + (n === 1 ? ' result' : ' results'); }
      };

  var el = null, docs = null, loading = false, inputEl = null, listEl = null, hintEl = null;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function build() {
    if (el) return;
    el = document.createElement('div');
    el.id = 'sp-search';
    el.innerHTML =
      '<style>' +
      '#sp-search{position:fixed;inset:0;z-index:10000;display:none;background:rgba(10,35,24,.45);backdrop-filter:blur(3px)}' +
      '#sp-search.open{display:block}' +
      '#sp-search .sps-c{position:absolute;left:50%;top:min(12vh,120px);transform:translateX(-50%);width:min(640px,calc(100vw - 28px));' +
      'background:#fff;border-radius:16px;box-shadow:0 18px 60px rgba(10,35,24,.35);overflow:hidden;border:1px solid #e6efea;' +
      'display:flex;flex-direction:column;max-height:min(72vh,640px);font-family:inherit;text-align:left}' +
      'body.bh-on #sp-search,body.bh-on #sp-search *{cursor:auto!important}' +
      'body.bh-on #sp-search a,body.bh-on #sp-search button{cursor:pointer!important}' +
      '#sp-search .sps-h{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #e6efea;background:#0A2318}' +
      '#sp-search .sps-h svg{flex:none}' +
      '#sp-search input{flex:1;border:0;outline:none;font:inherit;font-size:15.5px;color:#fff;background:transparent}' +
      '#sp-search input::placeholder{color:#9fd6c2;opacity:.85}' +
      '#sp-search .sps-x{background:none;border:0;color:#9fd6c2;font-size:22px;line-height:1;cursor:pointer;padding:2px 4px}' +
      '#sp-search .sps-hint{font-size:11.5px;color:#5b7268;padding:8px 16px 0}' +
      '#sp-search .sps-l{overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:2px}' +
      '#sp-search .sps-r{display:block;text-decoration:none;padding:10px 10px 11px;border-radius:10px;color:#15241d}' +
      '#sp-search .sps-r:hover,#sp-search .sps-r:focus{background:#f0f7f3;outline:none}' +
      '#sp-search .sps-r b{display:block;font-size:14px;line-height:1.35;font-weight:600}' +
      '#sp-search .sps-r p{margin:3px 0 0;font-size:12.5px;line-height:1.5;color:#4a5f55;text-align:left;max-width:none}' +
      '#sp-search .sps-r .sps-k{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;' +
      'color:#2c7a5b;background:#e2f3ec;border-radius:5px;padding:1px 6px;margin-right:7px;vertical-align:1px}' +
      '#sp-search .sps-r .sps-u{display:block;margin-top:4px;font-size:11px;color:#8aa197}' +
      '#sp-search mark{background:#c9ecdd;color:inherit;border-radius:3px;padding:0 1px}' +
      '#sp-search .sps-f{border-top:1px solid #e6efea;padding:10px 14px;display:flex;align-items:center;gap:10px;background:#f7faf8}' +
      '#sp-search .sps-f span{flex:1;font-size:12px;color:#5b7268}' +
      '#sp-search .sps-chat{border:0;border-radius:9px;background:#4DB896;color:#0A2318;font-weight:700;font-size:12.5px;' +
      'padding:8px 14px;cursor:pointer;white-space:nowrap}' +
      '@media (max-width:520px){#sp-search .sps-c{top:8px;max-height:calc(100vh - 16px)}}' +
      '</style>' +
      '<div class="sps-c" role="dialog" aria-modal="true" aria-label="' + T.title + '">' +
      '<div class="sps-h">' +
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9fd6c2" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">' +
      '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>' +
      '<input type="search" autocomplete="off" spellcheck="false" placeholder="' + T.ph + '" aria-label="' + T.title + '">' +
      '<button class="sps-x" type="button" aria-label="' + T.close + '">&times;</button>' +
      '</div>' +
      '<div class="sps-hint">' + T.hint + '</div>' +
      '<div class="sps-l" role="listbox" aria-live="polite"></div>' +
      '<div class="sps-f"><span>' + T.footer + '</span>' +
      '<button class="sps-chat js-open-chat" type="button">' + T.chat + '</button></div>' +
      '</div>';
    document.body.appendChild(el);

    inputEl = el.querySelector('input');
    listEl = el.querySelector('.sps-l');
    hintEl = el.querySelector('.sps-hint');

    el.addEventListener('click', function (e) { if (e.target === el) close(); });
    el.querySelector('.sps-x').addEventListener('click', close);
    el.querySelector('.sps-chat').addEventListener('click', function () {
      // Frage in den Chat mitnehmen; chat.js übernimmt über die Klasse js-open-chat
      this.setAttribute('data-msg', inputEl.value.trim());
      close();
    });

    var deb = null;
    inputEl.addEventListener('input', function () {
      if (deb) clearTimeout(deb);
      deb = setTimeout(render, 110);
    });
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        var first = listEl.querySelector('.sps-r');
        if (first) { e.preventDefault(); first.focus(); }
      }
    });
    listEl.addEventListener('keydown', function (e) {
      var items = [].slice.call(listEl.querySelectorAll('.sps-r'));
      var i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && i > -1 && items[i + 1]) { e.preventDefault(); items[i + 1].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? items[i - 1] : inputEl).focus(); }
    });
  }

  function loadIndex() {
    if (docs || loading) return;
    loading = true;
    hintEl.textContent = T.loading;
    fetch('/search-index.' + LANG + '.json')
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) {
        docs = core.prepare(d.docs || [], LANG);
        loading = false;
        hintEl.textContent = T.hint;
        render();
      })
      .catch(function () {
        loading = false;
        hintEl.textContent = T.error;
      });
  }

  function render() {
    if (!listEl) return;
    var q = inputEl.value.trim();
    listEl.innerHTML = '';
    if (!q || !docs) { hintEl.textContent = docs ? T.hint : hintEl.textContent; return; }
    var tokens = core.tokenize(q, LANG);
    var hits = core.search(docs, q, LANG, 8);
    if (!hits.length) { hintEl.textContent = T.empty; return; }
    hintEl.textContent = T.results(hits.length);
    var frag = document.createDocumentFragment();
    hits.forEach(function (h) {
      var d = h.d;
      var a = document.createElement('a');
      a.className = 'sps-r';
      a.href = d.u;
      a.setAttribute('role', 'option');
      a.innerHTML =
        '<b><span class="sps-k">' + (T.kinds[d.k] || '') + '</span>' + core.markHits(esc(d.t), tokens) + '</b>' +
        '<p>' + core.markHits(esc(core.snippet(d, tokens, 200)), tokens) + '</p>' +
        '<span class="sps-u">' + esc(d.u.replace(/#.*$/, '')) + '</span>';
      a.addEventListener('click', function () {
        if (global.spTrack) spTrack('search_result_click');
        close();
      });
      frag.appendChild(a);
    });
    listEl.appendChild(frag);
  }

  function open(prefill) {
    build();
    el.classList.add('open');
    loadIndex();
    if (prefill) inputEl.value = prefill;
    inputEl.focus();
    inputEl.select();
    render();
    if (global.spTrack) spTrack('search_open');
  }

  function close() {
    if (el) el.classList.remove('open');
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('.js-open-search, a[href="#search"]') : null;
    if (!a) return;
    e.preventDefault();
    open(a.getAttribute('data-q') || '');
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && el && el.classList.contains('open')) { close(); return; }
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    var typing = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable);
    if (typing) return;
    if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      open('');
    }
  });

  global.spSearch = { open: open, close: close };
})(typeof window !== 'undefined' ? window : globalThis);
