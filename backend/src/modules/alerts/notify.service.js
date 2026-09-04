const User=require('../../models/User');const {getMailProvider}=require('../mail/mail.provider');
async function notifyAlert(alert,recipientRoles=['owner','admin','manager']){
  const roles=recipientRoles.filter(r=>['owner','admin','manager'].includes(r));if(!roles.length)return {sent:0};
  const or=[];if(roles.some(r=>r==='owner'||r==='admin'))or.push({role:{$in:roles.filter(r=>r==='owner'||r==='admin')}});
  if(alert.locationId&&roles.includes('manager'))or.push({role:'manager',locationIds:alert.locationId});
  if(!or.length)return {sent:0};
  const users=await User.find({organizationId:alert.organizationId,isActive:true,'notificationPreferences.email':{$ne:false},'notificationPreferences.alerts':{$ne:false},$or:or}).select('email name').lean();
  let sent=0;const mail=getMailProvider();for(const user of users){try{await mail.sendMail({to:user.email,subject:`Gourmet Palace ${String(alert.severity||'').toUpperCase()} alert · ${alert.title}`,text:`${alert.title}\n\n${alert.detail||''}\n\nStatus: ${alert.status}\nOpen Gourmet Palace Command Center for authorized evidence and actions.`});sent++}catch(err){console.error('[alert:email]',user.email,err.message)}}return {sent}
}
module.exports={notifyAlert};
