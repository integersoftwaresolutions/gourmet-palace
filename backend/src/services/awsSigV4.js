const crypto=require('crypto');const ApiError=require('../utils/ApiError');const env=require('../config/env');
let cached=null;
const sha256=v=>crypto.createHash('sha256').update(v).digest('hex');const hmac=(key,data)=>crypto.createHmac('sha256',key).update(data).digest();
function rfc3986(s){return encodeURIComponent(s).replace(/[!'()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`)}
async function resolveCredentials(explicit){
  if(explicit?.accessKeyId&&explicit?.secretAccessKey)return explicit;
  if(env.aws?.accessKeyId&&env.aws?.secretAccessKey)return {accessKeyId:env.aws.accessKeyId,secretAccessKey:env.aws.secretAccessKey,sessionToken:env.aws.sessionToken||''};
  if(cached&&(!cached.expiration||new Date(cached.expiration).getTime()-Date.now()>300000))return cached;
  const rel=process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI;if(rel){
    const res=await fetch(`http://169.254.170.2${rel}`);if(!res.ok)throw new ApiError(503,'Unable to obtain ECS task-role credentials');const d=await res.json();cached={accessKeyId:d.AccessKeyId,secretAccessKey:d.SecretAccessKey,sessionToken:d.Token||'',expiration:d.Expiration};return cached
  }
  throw new ApiError(503,'AWS credentials are unavailable. Configure an ECS task role or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY.')
}
async function signedFetch({service,region,url,method='GET',body=Buffer.alloc(0),headers={},credentials}){
  const creds=await resolveCredentials(credentials);const u=url instanceof URL?url:new URL(url);const now=new Date();const amz=now.toISOString().replace(/[:-]|\.\d{3}/g,'');const date=amz.slice(0,8);const payload=Buffer.isBuffer(body)?body:Buffer.from(typeof body==='string'?body:JSON.stringify(body));const payloadHash=sha256(payload);
  const h={...headers,host:u.host,'x-amz-content-sha256':payloadHash,'x-amz-date':amz};if(creds.sessionToken)h['x-amz-security-token']=creds.sessionToken;
  const normalized=Object.entries(h).map(([k,v])=>[k.toLowerCase(),String(v).trim().replace(/\s+/g,' ')]).sort(([a],[b])=>a.localeCompare(b));const canonicalHeaders=normalized.map(([k,v])=>`${k}:${v}\n`).join('');const signedHeaders=normalized.map(([k])=>k).join(';');
  const query=[...u.searchParams.entries()].map(([k,v])=>[rfc3986(k),rfc3986(v)]).sort((a,b)=>a[0]===b[0]?a[1].localeCompare(b[1]):a[0].localeCompare(b[0])).map(([k,v])=>`${k}=${v}`).join('&');
  const canonicalRequest=[method.toUpperCase(),u.pathname||'/',query,canonicalHeaders,signedHeaders,payloadHash].join('\n');const scope=`${date}/${region}/${service}/aws4_request`;const stringToSign=`AWS4-HMAC-SHA256\n${amz}\n${scope}\n${sha256(canonicalRequest)}`;
  const kDate=hmac(Buffer.from(`AWS4${creds.secretAccessKey}`),date),kRegion=hmac(kDate,region),kService=hmac(kRegion,service),kSigning=hmac(kService,'aws4_request');const signature=crypto.createHmac('sha256',kSigning).update(stringToSign).digest('hex');
  const finalHeaders={...headers,'x-amz-content-sha256':payloadHash,'x-amz-date':amz,Authorization:`AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`};if(creds.sessionToken)finalHeaders['x-amz-security-token']=creds.sessionToken;
  return fetch(u,{method,headers:finalHeaders,...(method==='GET'||method==='HEAD'?{}:{body:payload})})
}
module.exports={signedFetch,resolveCredentials};
