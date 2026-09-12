const crypto=require('crypto');
const env=require('../config/getEnv')();
function key(){return crypto.createHash('sha256').update(env.secretEncryptionKey||env.sessionSecret).digest()}
function encrypt(value){if(!value)return null; const iv=crypto.randomBytes(12); const cipher=crypto.createCipheriv('aes-256-gcm',key(),iv); const enc=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]); const tag=cipher.getAuthTag(); return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`}
function decrypt(payload){if(!payload)return null; const [v,ivs,tags,data]=String(payload).split('.'); if(v!=='v1') throw new Error('Unsupported secret format'); const decipher=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(ivs,'base64url')); decipher.setAuthTag(Buffer.from(tags,'base64url')); return Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8')}
module.exports={encrypt,decrypt};
