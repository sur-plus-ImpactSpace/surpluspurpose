/* sur.plus — Messskript (Ergänzung zu Plausible)
   ------------------------------------------------------------------
   Cookiefrei. Kein localStorage, kein sessionStorage, keine IDs,
   keine personenbezogenen Daten. Misst ausschließlich aggregierbares
   Leseverhalten und sendet genau EIN zusätzliches Event pro Seitenaufruf:

     page_exit  { tiefe, dauer, fokus }

   tiefe  = maximal erreichte Scrolltiefe, in Stufen
   dauer  = aktive Verweildauer (nur bei sichtbarem Tab), in Stufen
   fokus  = Sektion, in der der Besucher am längsten gelesen hat

   Stufen statt Rohwerte, damit die Auswertung in Plausible sauber
   gruppiert und keine quasi-eindeutigen Merkmale entstehen.
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  if (window.__spAnalytics) return;
  window.__spAnalytics = 1;

  /* ---------- vendor-neutraler Event-Shim ----------
     Definiert spTrack nur, wenn die Seite noch keinen hat —
     die Landingpage bringt einen eigenen mit. */
  if (!window.spTrack) {
    window.spTrack = function (name, props) {
      try {
        (window.spEvents = window.spEvents || []).push([name, props, Date.now()]);
        if (window.plausible) window.plausible(name, { props: props });
      } catch (e) {}
    };
  }
  var track = window.spTrack;

  /* ---------- Scrolltiefe ---------- */
  var maxPct = 0;

  function depthNow() {
    var de = document.documentElement, bd = document.body;
    var full = Math.max(de.scrollHeight || 0, bd ? bd.scrollHeight || 0 : 0);
    var view = window.innerHeight || de.clientHeight || 0;
    if (!full || full <= view) return 100;           // Seite passt ohne Scrollen
    var y = window.pageYOffset || de.scrollTop || 0;
    return Math.max(0, Math.min(100, Math.round((y + view) / full * 100)));
  }

  function sampleScroll() {
    var p = depthNow();
    if (p > maxPct) maxPct = p;
  }

  addEventListener('scroll', sampleScroll, { passive: true });
  addEventListener('resize', sampleScroll, { passive: true });

  /* ---------- aktive Verweildauer ----------
     Läuft nur, solange der Tab sichtbar ist. Ein offener Hintergrund-Tab
     erzeugt damit keine Fantasie-Lesezeiten. */
  var activeMs = 0;
  var since = document.visibilityState === 'visible' ? Date.now() : 0;

  function pause() {
    if (since) { activeMs += Date.now() - since; since = 0; }
  }

  function resume() {
    if (!since && document.visibilityState === 'visible') since = Date.now();
  }

  /* ---------- Sektions-Verweildauer ----------
     Zählt im Sekundentakt, welche Sektion gerade die Bildschirmmitte
     einnimmt. Opt-in über data-sp-section; die bekannten Sektionen der
     Landingpage werden automatisch ergänzt. */
  var sections = [], dwell = {};

  var AUTO = [
    ['for-companies', 'unternehmen'],
    ['for-ngos',      'ngo'],
    ['pricing',       'preise'],
    ['how',           'ablauf'],
    ['faq',           'faq']
  ];

  function initSections() {
    var found = [].slice.call(document.querySelectorAll('[data-sp-section]'));
    for (var i = 0; i < AUTO.length; i++) {
      var el = document.getElementById(AUTO[i][0]);
      if (el && found.indexOf(el) < 0) {
        el.setAttribute('data-sp-section', AUTO[i][1]);
        found.push(el);
      }
    }
    sections = found;
    for (var j = 0; j < sections.length; j++) {
      dwell[sections[j].getAttribute('data-sp-section')] = 0;
    }
  }

  function sampleSections() {
    if (document.visibilityState !== 'visible' || !sections.length) return;
    var mid = (window.innerHeight || 0) / 2;
    for (var i = 0; i < sections.length; i++) {
      var r = sections[i].getBoundingClientRect();
      if (r.top < mid && r.bottom > mid) {
        dwell[sections[i].getAttribute('data-sp-section')]++;
      }
    }
  }

  /* ---------- Stufen ---------- */
  function depthBucket(p) {
    if (p >= 90) return '90-100%';
    if (p >= 75) return '75-90%';
    if (p >= 50) return '50-75%';
    if (p >= 25) return '25-50%';
    return '0-25%';
  }

  function timeBucket(s) {
    if (s < 10)  return '0-10s';
    if (s < 30)  return '10-30s';
    if (s < 60)  return '30-60s';
    if (s < 180) return '1-3min';
    if (s < 600) return '3-10min';
    return '10min+';
  }

  /* ---------- Abschluss ----------
     visibilitychange → hidden ist das letzte Ereignis, auf das man sich
     plattformübergreifend verlassen kann (beforeunload feuert auf Mobil
     unzuverlässig). Wir senden dort genau einmal. */
  var sent = false;

  function finish() {
    if (sent) return;
    sent = true;
    pause();
    sampleScroll();

    var top = 'keine', best = 0;
    for (var k in dwell) {
      if (Object.prototype.hasOwnProperty.call(dwell, k) && dwell[k] > best) {
        best = dwell[k];
        top = k;
      }
    }

    track('page_exit', {
      tiefe: depthBucket(maxPct),
      dauer: timeBucket(Math.round(activeMs / 1000)),
      fokus: best >= 3 ? top : 'keine'     // unter 3 Sekunden ist Rauschen
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') finish();
    else resume();
  });
  addEventListener('pagehide', finish);

  /* ---------- Start ---------- */
  function start() {
    initSections();
    sampleScroll();
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
  else start();

  setInterval(sampleSections, 1000);
})();
