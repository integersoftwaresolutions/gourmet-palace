const BusinessSetting=require('../../models/BusinessSetting');
const Location=require('../../models/Location');
const ApiError=require('../../utils/ApiError');
const audit=require('../audit/audit.service');
const DEFAULTS={
  foodCostTarget:{min:0.20,max:0.22}, selectedMargin:0.15,
  scoreWeights:{sales:0.40,demand:0.25,exceptions:0.20,operating:0.15},
  inventoryStaleHours:24,
  reviewBrandTone:'Warm, concise, professional, appreciative, and specific to the guest feedback. Never offer compensation or make factual claims not present in the review.',
  alertConfig:{
    sales_below_normal:{enabled:true,severity:'warning',percent:15,cooldownHours:24,recipientRoles:['owner','admin','manager']},
    exceptions_above_normal:{enabled:true,severity:'warning',percent:25,cooldownHours:24,recipientRoles:['owner','admin','manager']},
    average_ticket_dropping:{enabled:true,severity:'warning',percent:10,cooldownHours:24,recipientRoles:['owner','admin','manager']},
    location_underperforming_peers:{enabled:true,severity:'warning',scoreGap:15,cooldownHours:24,recipientRoles:['owner','admin']},
    urgent_negative_review:{enabled:true,severity:'critical',maxRating:2,cooldownHours:24,recipientRoles:['owner','admin']},
    vendor_price_increase:{enabled:true,severity:'warning',percent:10,cooldownHours:72,recipientRoles:['owner','admin','manager']},
    food_cost_above_target:{enabled:true,severity:'warning',cooldownHours:24,recipientRoles:['owner','admin']},
    direct_orders_declining:{enabled:true,severity:'warning',percent:15,cooldownHours:24,recipientRoles:['owner','admin']},
    inventory_critical:{enabled:true,severity:'critical',daysRemaining:2,cooldownHours:12,recipientRoles:['owner','admin','manager']},
    system_data_quality:{enabled:true,severity:'critical',cooldownHours:6,recipientRoles:['owner','admin']},
  },
  notificationDefaults:{email:true,inApp:true,brief:true,alerts:true},
};

function finite(v,min,max){return typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max}
function validateValue(key,value){
  if(key==='foodCostTarget'){if(!value||!finite(value.min,0,1)||!finite(value.max,0,1)||value.min>value.max)throw new ApiError(400,'foodCostTarget requires 0–1 min/max with min <= max')}
  else if(key==='selectedMargin'){if(!finite(value,0,1))throw new ApiError(400,'selectedMargin must be between 0 and 1')}
  else if(key==='scoreWeights'){const keys=['sales','demand','exceptions','operating'];if(!value||Object.keys(value).some(k=>!keys.includes(k))||keys.some(k=>!finite(value[k],0,1))||Math.abs(keys.reduce((s,k)=>s+value[k],0)-1)>.001)throw new ApiError(400,'scoreWeights must contain sales, demand, exceptions and operating and total 1.0')}
  else if(key==='inventoryStaleHours'){if(!finite(value,1,720))throw new ApiError(400,'inventoryStaleHours must be between 1 and 720')}
  else if(key==='reviewBrandTone'){if(typeof value!=='string'||!value.trim()||value.length>1000)throw new ApiError(400,'reviewBrandTone must be 1–1000 characters')}
  else if(key==='notificationDefaults'){if(!value||typeof value!=='object'||Object.values(value).some(v=>typeof v!=='boolean'))throw new ApiError(400,'notificationDefaults values must be booleans')}
  else if(key==='alertConfig'){const fixed=Object.keys(DEFAULTS.alertConfig);if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!fixed.includes(k)))throw new ApiError(400,'alertConfig may contain only fixed V1 alert types');for(const [type,c] of Object.entries(value)){if(!c||typeof c!=='object'||typeof c.enabled!=='boolean'||!['info','warning','critical'].includes(c.severity)||!finite(Number(c.cooldownHours??0),0,720))throw new ApiError(400,`Invalid configuration for ${type}`);if(c.recipientRoles!==undefined&&(!Array.isArray(c.recipientRoles)||c.recipientRoles.some(r=>!['owner','admin','manager'].includes(r))))throw new ApiError(400,`Invalid recipientRoles for ${type}`);for(const f of ['percent','scoreGap','maxRating','daysRemaining'])if(c[f]!=null&&(!Number.isFinite(Number(c[f]))||Number(c[f])<0))throw new ApiError(400,`Invalid ${f} for ${type}`)}}
  return value
}

async function getEffective(organizationId,key,locationId=null,at=new Date()){
  const rows=await BusinessSetting.find({organizationId,key,effectiveFrom:{$lte:at},$or:[{locationId:locationId||null},{locationId:null}]}).sort({locationId:-1,effectiveFrom:-1});
  const exact=locationId?rows.find(r=>String(r.locationId||'')===String(locationId)):null;
  const row=exact||rows.find(r=>!r.locationId); return row?row.value:DEFAULTS[key];
}
async function list(organizationId){const rows=await BusinessSetting.find({organizationId}).sort({effectiveFrom:-1}).lean(); return {defaults:DEFAULTS,history:rows};}
async function setValue({organizationId,locationId=null,key,value,effectiveFrom,actor,reqMeta={}}){
  if(!(key in DEFAULTS)) throw new ApiError(400,'Unsupported setting key');validateValue(key,value);
  if(locationId){const loc=await Location.findOne({_id:locationId,organizationId}); if(!loc) throw new ApiError(404,'Location not found');}
  const row=await BusinessSetting.create({organizationId,locationId:locationId||null,key,value,effectiveFrom:effectiveFrom?new Date(effectiveFrom):new Date(),createdBy:actor.id});
  await audit.record({type:'setting.update',result:'success',actorUserId:actor.id,organizationId,correlationId:reqMeta.correlationId,ip:reqMeta.ip,userAgent:reqMeta.userAgent,meta:{key,locationId,value,effectiveFrom:row.effectiveFrom}});
  return row.toJSON();
}
module.exports={DEFAULTS,getEffective,list,setValue,validateValue};
