// sur.plus — Impact Calculator report sender (Netlify Function + Resend)
//
// Required environment variable (Netlify → Site settings → Environment variables):
//   RESEND_API_KEY   your Resend API key
// Optional:
//   REPORT_FROM      verified sender, default: "sur.plus <reports@surpluspurpose.com>"
//   REPORT_NOTIFY    internal lead copy recipient, default: service@surpluspurpose.com
//
// Note: Netlify Functions require a Git-connected site or a CLI deploy —
// a pure drag-and-drop folder upload does NOT run functions.

const FROM = process.env.REPORT_FROM || 'Florian Lechner <florian@surpluspurpose.com>';
const NOTIFY = process.env.REPORT_NOTIFY || 'florian@surpluspurpose.com';
const REPLY_TO = process.env.REPORT_REPLY_TO || 'florian@surpluspurpose.com';

function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function validEmail(e){return typeof e==='string' && e.length<200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);}

function reportHtml(p, de){
  var m = p.metrics || {};
  var t = de ? {
    hi:'Ihr geschätztes Impact-Potenzial', cat:'Kategorie', val:'Überschusswert',
    sav:'Geschätzte jährliche Einsparung', co2:'Vermiedene Emissionen', ngo:'Mögliche NGO-Begünstigte', tax:'Steuervorteil',
    freq:'Art des Überschusses', ctry:'Steuerland',
    note:'Alle Werte sind konservativ kalkulierte Schätzungen nach veröffentlichten Methodiken (GHG Protocol, GIIN IRIS+) und keine Rechts-, Steuer- oder Finanzberatung.',
    cta:'Als Unternehmen bewerben', foot:'Du erhältst diese E-Mail, weil sie im sur.plus Impact Calculator angefordert wurde.'
  } : {
    hi:'Your estimated impact potential', cat:'Category', val:'Surplus value',
    sav:'Estimated annual savings', co2:'Emissions avoided', ngo:'Potential NGO beneficiaries', tax:'Tax advantage',
    freq:'Type of surplus', ctry:'Tax country',
    note:'All figures are conservatively calculated estimates under published methodologies (GHG Protocol, GIIN IRIS+) and are not legal, tax or financial advice.',
    cta:'Apply as a company', foot:'You received this email because it was requested in the sur.plus Impact Calculator.'
  };
  function row(label,v){return v ? '<tr><td style="padding:10px 0;border-bottom:1px solid #e6efea;color:#4A6B5A;font-size:14px">'+esc(label)+'</td><td style="padding:10px 0;border-bottom:1px solid #e6efea;text-align:right;font-weight:600;color:#15241d;font-size:15px">'+esc(v)+'</td></tr>' : '';}
  var valFmt = (p.surplusValue!=null && p.surplusValue!=='') ? ('€'+Number(p.surplusValue).toLocaleString(de?'de-DE':'en-GB')) : '';
  var freqNames = de
    ? { oneoff:'Einmalige Räumung', recurring:'Wiederkehrender Überschuss' }
    : { oneoff:'One-off clearance', recurring:'Recurring surplus' };
  var freqFmt = freqNames[String(p.frequency||'').toLowerCase()] || '';
  var countryNames = de
    ? { de:'Deutschland', at:'Österreich', ch:'Schweiz', fr:'Frankreich', es:'Spanien', pt:'Portugal', nl:'Niederlande', uk:'Vereinigtes Königreich', be:'Belgien', it:'Italien', pl:'Polen', se:'Schweden', dk:'Dänemark', fi:'Finnland', other:'Anderes Land' }
    : { de:'Germany', at:'Austria', ch:'Switzerland', fr:'France', es:'Spain', pt:'Portugal', nl:'Netherlands', uk:'United Kingdom', be:'Belgium', it:'Italy', pl:'Poland', se:'Sweden', dk:'Denmark', fi:'Finland', other:'Other country' };
  var countryFmt = countryNames[String(p.country||'').toLowerCase()] || '';
  return '<!doctype html><html><body style="margin:0;background:#f7faf8;font-family:Arial,Helvetica,sans-serif">'
    + '<div style="max-width:560px;margin:0 auto;padding:24px">'
    + '<div style="background:#0A2318;border-radius:16px 16px 0 0;padding:26px 24px;color:#fff">'
    + '<div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#4DB896;font-weight:700">sur.plus</div>'
    + '<div style="font-size:22px;font-weight:700;margin-top:6px">'+esc(t.hi)+'</div></div>'
    + '<div style="background:#fff;border:1px solid #e6efea;border-top:none;border-radius:0 0 16px 16px;padding:8px 24px 22px">'
    + '<table style="width:100%;border-collapse:collapse">'
    + row(t.cat, p.category) + row(t.val, valFmt) + row(t.freq, freqFmt) + row(t.sav, m.annualSavings)
    + row(t.co2, m.co2) + row(t.ngo, m.ngos) + row(t.ctry, countryFmt) + row(t.tax, m.taxAdvantage)
    + '</table>'
    + '<p style="font-size:12px;color:#7A9E8E;line-height:1.5;margin:16px 0 18px">'+esc(t.note)+'</p>'
    + '<a href="https://tally.so/r/7R1BE6" style="display:inline-block;background:#D4712A;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">'+esc(t.cta)+'</a>'
    + '</div>'
    + '<p style="font-size:11px;color:#9bb3a8;text-align:center;margin-top:14px">'+esc(t.foot)+' · service@surpluspurpose.com</p>'
    + '</div></body></html>';
}

exports.handler = async function(event){
  var headers = {'Content-Type':'application/json'};
  if(event.httpMethod!=='POST') return {statusCode:405, headers, body:JSON.stringify({error:'Method not allowed'})};
  if(!process.env.RESEND_API_KEY) return {statusCode:500, headers, body:JSON.stringify({error:'Mail service not configured'})};
  var p;
  try { p = JSON.parse(event.body||'{}'); } catch(e){ return {statusCode:400, headers, body:JSON.stringify({error:'Bad request'})}; }
  if(!validEmail(p.email)) return {statusCode:400, headers, body:JSON.stringify({error:'Invalid email'})};
  var de = (p.lang==='de');
  var subject = de ? 'Dein sur.plus Impact-Report' : 'Your sur.plus impact report';
  // routing hint for the internal lead copy: one-off = Clearance fixed price, recurring = plan
  var freqTag = p.frequency==='oneoff' ? 'one-off' : (p.frequency==='recurring' ? 'recurring' : '');
  var leadTag = (freqTag ? ' ['+freqTag+']' : '') + (p.country ? ' ['+String(p.country).toUpperCase()+']' : '');
  try {
    var res = await fetch('https://api.resend.com/emails', {
      method:'POST',
      headers:{'Authorization':'Bearer '+process.env.RESEND_API_KEY, 'Content-Type':'application/json'},
      body: JSON.stringify({ from:FROM, to:[p.email], reply_to:REPLY_TO, subject:subject, html:reportHtml(p,de) })
    });
    if(!res.ok){ var tx = await res.text(); return {statusCode:502, headers, body:JSON.stringify({error:'Send failed', detail:String(tx).slice(0,200)})}; }
    // internal lead copy — non-fatal
    try {
      await fetch('https://api.resend.com/emails', {
        method:'POST',
        headers:{'Authorization':'Bearer '+process.env.RESEND_API_KEY, 'Content-Type':'application/json'},
        body: JSON.stringify({ from:FROM, to:[NOTIFY], reply_to:p.email, subject:'New Impact Calculator lead: '+p.email+leadTag,
          html:'<p>New calculator lead from the website.</p><pre style="font-family:monospace;font-size:13px">'+esc(JSON.stringify(p,null,2))+'</pre>' })
      });
    } catch(e2){}
    return {statusCode:200, headers, body:JSON.stringify({ok:true})};
  } catch(e){
    return {statusCode:500, headers, body:JSON.stringify({error:'Server error'})};
  }
};
