// sur.plus — exit-intent feedback / launch-list capture (Netlify Function + Resend)
// Notifies the team about who was leaving, which side (corporate/NGO), the reason,
// and an optional launch-email. Never hard-errors the UI (returns 200 even if Resend
// isn't configured yet), so the overlay always works.

const FROM = process.env.REPORT_FROM || 'Florian Lechner <florian@surpluspurpose.com>';
const NOTIFY = process.env.REPORT_NOTIFY || 'florian@surpluspurpose.com';

function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function validEmail(e){return typeof e==='string' && e.length<200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);}

exports.handler = async function(event){
  var headers = {'Content-Type':'application/json'};
  if(event.httpMethod!=='POST') return {statusCode:405, headers, body:JSON.stringify({error:'Method not allowed'})};
  if(!process.env.RESEND_API_KEY) return {statusCode:200, headers, body:JSON.stringify({ok:true, note:'not configured'})};
  var p;
  try { p = JSON.parse(event.body||'{}'); } catch(e){ return {statusCode:400, headers, body:JSON.stringify({error:'Bad request'})}; }
  if(p.email && !validEmail(p.email)) return {statusCode:400, headers, body:JSON.stringify({error:'Invalid email'})};
  var subject = 'Exit feedback — ' + (p.side||'?') + ' / ' + (p.reason||'?') + (p.email ? (' · ' + p.email) : '');
  var html = '<p>Exit-intent feedback from the website:</p><ul>'
    + '<li><b>Side:</b> ' + esc(p.side) + '</li>'
    + '<li><b>Reason:</b> ' + esc(p.reason) + '</li>'
    + '<li><b>Email:</b> ' + esc(p.email||'(none)') + '</li>'
    + '<li><b>Lang:</b> ' + esc(p.lang) + '</li>'
    + '<li><b>Page:</b> ' + esc(p.page) + '</li></ul>';
  try {
    var body = { from:FROM, to:[NOTIFY], subject:subject, html:html };
    if(p.email && validEmail(p.email)) body.reply_to = p.email;
    await fetch('https://api.resend.com/emails', {
      method:'POST',
      headers:{'Authorization':'Bearer '+process.env.RESEND_API_KEY, 'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    return {statusCode:200, headers, body:JSON.stringify({ok:true})};
  } catch(e){
    return {statusCode:200, headers, body:JSON.stringify({ok:true, note:'send failed'})};
  }
};
