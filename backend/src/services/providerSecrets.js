const fs=require('fs/promises');const path=require('path');const env=require('../config/env');const vault=require('./secretVault');const {signedFetch}=require('./awsSigV4');const ApiError=require('../utils/ApiError');
const localBase=path.resolve(process.cwd(),env.localSecretsDir||'storage/secrets');
const safe=s=>String(s).replace(/[^a-zA-Z0-9_.-]/g,'_');
function secretName(organizationId,provider){return `${env.secretStorePrefix||'gourmet-palace'}/${env.nodeEnv}/${safe(organizationId)}/${safe(provider)}`}
async function awsCall(target,payload){const region=env.aws.region;const body=JSON.stringify(payload);const res=await signedFetch({service:'secretsmanager',region,url:`https://secretsmanager.${region}.amazonaws.com/`,method:'POST',body,headers:{'content-type':'application/x-amz-json-1.1','x-amz-target':`secretsmanager.${target}`}});const data=await res.json().catch(()=>({}));if(!res.ok){const err=String(data.__type||data.code||'').split('#').pop();const e=new ApiError(res.status===404?404:502,`AWS Secrets Manager ${target} failed: ${data.message||err||res.status}`);e.awsType=err;throw e}return data}
async function put(organizationId,provider,value){
  if(env.secretStoreProvider==='aws'){const Name=secretName(organizationId,provider),SecretString=JSON.stringify(value);try{await awsCall('PutSecretValue',{SecretId:Name,SecretString})}catch(e){if(e.statusCode===404||e.awsType==='ResourceNotFoundException')await awsCall('CreateSecret',{Name,SecretString,Description:`Gourmet Palace ${provider} OAuth credentials`});else throw e}return `aws:${Name}`}
  const rel=`${safe(organizationId)}/${safe(provider)}.secret`;const abs=path.join(localBase,rel);await fs.mkdir(path.dirname(abs),{recursive:true});await fs.writeFile(abs,vault.encrypt(JSON.stringify(value)),{mode:0o600});return `local-secret:${rel}`
}
async function get(ref){
  if(!ref)throw new ApiError(409,'Provider secret reference is missing');
  if(String(ref).startsWith('aws:')){const d=await awsCall('GetSecretValue',{SecretId:String(ref).slice(4)});if(!d.SecretString)throw new ApiError(502,'Provider secret has no SecretString');return JSON.parse(d.SecretString)}
  if(String(ref).startsWith('local-secret:')){try{return JSON.parse(vault.decrypt(await fs.readFile(path.join(localBase,String(ref).slice(13)),'utf8')))}catch(e){if(e instanceof SyntaxError)throw e;throw new ApiError(409,'Local provider secret is unavailable')}}
  throw new ApiError(409,'Unsupported provider secret reference')
}
async function update(ref,value){if(String(ref||'').startsWith('aws:')){await awsCall('PutSecretValue',{SecretId:String(ref).slice(4),SecretString:JSON.stringify(value)});return ref}if(String(ref||'').startsWith('local-secret:')){const abs=path.join(localBase,String(ref).slice(13));await fs.mkdir(path.dirname(abs),{recursive:true});await fs.writeFile(abs,vault.encrypt(JSON.stringify(value)),{mode:0o600});return ref}throw new ApiError(409,'Provider secret reference is missing')}
module.exports={put,get,update,secretName};
