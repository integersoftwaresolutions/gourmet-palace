function getClientIp(req) { const forwarded=req.headers['x-forwarded-for']; if(typeof forwarded==='string'&&forwarded.length)return forwarded.split(',')[0].trim(); return req.ip||req.socket?.remoteAddress||null; }
function getUserAgent(req){const ua=req.headers['user-agent']; return typeof ua==='string'?ua.slice(0,512):null;}
function requestMeta(req){return {correlationId:req.correlationId||req.id||req.headers['x-correlation-id'],ip:getClientIp(req),userAgent:getUserAgent(req)}}
module.exports={getClientIp,getUserAgent,requestMeta};
