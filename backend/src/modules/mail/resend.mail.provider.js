const env=require('../../config/env');
async function sendMail(message){if(!env.resendApiKey)throw new Error('RESEND_API_KEY is not configured');const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.resendApiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.resendFrom,to:[message.to],subject:message.subject,text:message.text,html:message.html||undefined})});if(!res.ok){const txt=await res.text();throw new Error(`Resend failed (${res.status}): ${txt.slice(0,300)}`)}return res.json()}
module.exports={sendMail};
