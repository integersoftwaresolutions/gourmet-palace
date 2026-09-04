const crypto=require('crypto');const Connection=require('../../models/Connection');const Location=require('../../models/Location');const Order=require('../../models/Order');const RawIngestEvent=require('../../models/RawIngestEvent');const JobRun=require('../../models/JobRun');const ApiError=require('../../utils/ApiError');const env=require('../../config/env');const secrets=require('../../services/providerSecrets');const storage=require('../storage/storage.service');const analytics=require('../analytics/analytics.service');const {addDays}=require('../../utils/dateRange');const {squareReconciliation,reconciliationPass}=require('../../utils/reconciliation');
const squareBase=()=>env.square.environment==='production'?'https://connect.squareup.com':'https://connect.squareupsandbox.com';
function publicConnection(c){if(!c)return null;const o=c.toJSON?c.toJSON():c;delete o.accessTokenEnc;delete o.refreshTokenEnc;delete o.secretRef;return o}
async function list(organizationId){return (await Connection.find({organizationId}).sort({provider:1})).map(publicConnection)}
function oauthState(req,provider){const state=crypto.randomBytes(24).toString('base64url');req.session.oauthState={provider,state,createdAt:Date.now()};return state}
async function squareConnect(req){if(!env.square.applicationId||!env.square.applicationSecret)throw new ApiError(503,'Square OAuth is not configured on the server');const state=oauthState(req,'square');const scopes=['MERCHANT_PROFILE_READ','ORDERS_READ','PAYMENTS_READ','ITEMS_READ','INVENTORY_READ','EMPLOYEES_READ','PAYOUTS_READ'];const url=new URL(`${squareBase()}/oauth2/authorize`);url.searchParams.set('client_id',env.square.applicationId);url.searchParams.set('scope',scopes.join(' '));url.searchParams.set('session','false');url.searchParams.set('state',state);url.searchParams.set('redirect_uri',env.square.redirectUri);return url.toString()}
function verifyState(req,provider,state){const s=req.session.oauthState;if(!s||s.provider!==provider||s.state!==state||Date.now()-s.createdAt>10*60*1000)throw new ApiError(400,'Invalid or expired OAuth state');delete req.session.oauthState}
function parseSquareScopes(raw){if(Array.isArray(raw))return raw.map(String).map(s=>s.trim()).filter(Boolean);return String(raw||'').split(/[ ,+]+/).map(s=>s.trim()).filter(Boolean)}
function squareCapabilities(granted){return{merchantProfile:granted.includes('MERCHANT_PROFILE_READ'),orders:granted.includes('ORDERS_READ'),payments:granted.includes('PAYMENTS_READ'),catalog:granted.includes('ITEMS_READ'),inventory:granted.includes('INVENTORY_READ'),employees:granted.includes('EMPLOYEES_READ'),payouts:granted.includes('PAYOUTS_READ')||granted.includes('SETTLEMENTS_READ')}}
async function squareGrantedScopes(accessToken,tokenResponse){
  let granted=parseSquareScopes(tokenResponse?.scopes||tokenResponse?.scope);
  if(granted.includes('ORDERS_READ')&&granted.includes('MERCHANT_PROFILE_READ'))return granted;
  const status=await fetch(`${squareBase()}/oauth2/token/status`,{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Square-Version':'2026-01-22','Content-Type':'application/json'}});
  const body=await status.json().catch(()=>({}));
  if(status.ok)granted=parseSquareScopes(body.scopes||body.scope);
  return granted;
}
async function squareCallback(req,organizationId,code,state){
  verifyState(req,'square',state);const res=await fetch(`${squareBase()}/oauth2/token`,{method:'POST',headers:{'Content-Type':'application/json','Square-Version':'2026-01-22'},body:JSON.stringify({client_id:env.square.applicationId,client_secret:env.square.applicationSecret,code,grant_type:'authorization_code',redirect_uri:env.square.redirectUri})});const data=await res.json();if(!res.ok)throw new ApiError(502,`Square OAuth failed: ${data.message||data.error_description||data.errors?.[0]?.detail||res.status}`);
  if(!data.access_token)throw new ApiError(502,'Square OAuth did not return an access token');
  const priorSquare=await Connection.findOne({organizationId,provider:'square'}).select('+secretRef');let priorSquareSecret=null;if(priorSquare?.secretRef&&!data.refresh_token){try{priorSquareSecret=await secrets.get(priorSquare.secretRef)}catch{priorSquareSecret=null}}const secretRef=await secrets.put(organizationId,'square',{accessToken:data.access_token,refreshToken:data.refresh_token||priorSquareSecret?.refreshToken||'',expiresAt:data.expires_at||null});
  const granted=await squareGrantedScopes(data.access_token,data);const capabilities=squareCapabilities(granted);
  await Connection.findOneAndUpdate({organizationId,provider:'square'},{$set:{status:capabilities.orders?'PARTIAL':'UNAVAILABLE',secretRef,expiresAt:data.expires_at?new Date(data.expires_at):null,scopes:granted,capabilities,lastError:capabilities.orders?null:'Required Square ORDERS_READ scope was not granted',metadata:{merchantId:data.merchant_id}},$unset:{accessTokenEnc:1,refreshTokenEnc:1}},{upsert:true,new:true,setDefaultsOnInsert:true}).select('+secretRef');
  return discoverSquare(organizationId)
}
async function refreshSquare(conn,secret){
  if(!secret.refreshToken)return {conn,secret};const res=await fetch(`${squareBase()}/oauth2/token`,{method:'POST',headers:{'Content-Type':'application/json','Square-Version':'2026-01-22'},body:JSON.stringify({client_id:env.square.applicationId,client_secret:env.square.applicationSecret,refresh_token:secret.refreshToken,grant_type:'refresh_token'})});const data=await res.json();if(!res.ok)throw new Error(`Square refresh failed (${res.status})`);
  const next={accessToken:data.access_token,refreshToken:data.refresh_token||secret.refreshToken,expiresAt:data.expires_at||secret.expiresAt||null};await secrets.update(conn.secretRef,next);conn.expiresAt=next.expiresAt?new Date(next.expiresAt):conn.expiresAt;await conn.save();return {conn,secret:next}
}
async function squareToken(organizationId){
  let conn=await Connection.findOne({organizationId,provider:'square'}).select('+secretRef');if(!conn?.secretRef)throw new ApiError(409,'Square is not connected');let secret=await secrets.get(conn.secretRef);if(!secret.accessToken)throw new ApiError(409,'Square credentials are unavailable');if(conn.expiresAt&&new Date(conn.expiresAt).getTime()-Date.now()<5*60*1000)({conn,secret}=await refreshSquare(conn,secret));return {conn,token:secret.accessToken}
}
async function sqFetch(token,path,options={}){const res=await fetch(`${squareBase()}${path}`,{...options,headers:{Authorization:`Bearer ${token}`,'Square-Version':'2026-01-22','Content-Type':'application/json',...(options.headers||{})}});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(`Square ${path} failed (${res.status}): ${data.errors?.[0]?.detail||'provider error'}`);return data}
const squareCatalogCache=new Map();
async function squareCatalogMap(organizationId,token,enabled=true){
  if(!enabled)return {available:false,variationToCategory:new Map()};
  const cached=squareCatalogCache.get(String(organizationId));if(cached&&Date.now()-cached.at<15*60*1000)return cached.value;
  try{
    let cursor;const objects=[];do{const q=new URLSearchParams({types:'ITEM,CATEGORY'});if(cursor)q.set('cursor',cursor);const data=await sqFetch(token,`/v2/catalog/list?${q.toString()}`);objects.push(...(data.objects||[]));cursor=data.cursor}while(cursor);
    const categories=new Map(objects.filter(x=>x.type==='CATEGORY').map(x=>[x.id,x.category_data?.name||'']));const variationToCategory=new Map();
    for(const obj of objects.filter(x=>x.type==='ITEM')){const ids=(obj.item_data?.categories||[]).map(x=>x.id||x.category_id).filter(Boolean);if(obj.item_data?.category_id)ids.push(obj.item_data.category_id);const name=ids.map(id=>categories.get(id)).find(Boolean)||'';for(const variation of obj.item_data?.variations||[])variationToCategory.set(variation.id,name);variationToCategory.set(obj.id,name)}
    const value={available:true,variationToCategory};squareCatalogCache.set(String(organizationId),{at:Date.now(),value});return value
  }catch{return {available:false,variationToCategory:new Map()}}
}
async function discoverSquare(organizationId){
  const {conn,token}=await squareToken(organizationId);
  const granted=await squareGrantedScopes(token,{scopes:conn.scopes});
  conn.scopes=granted;conn.capabilities=squareCapabilities(granted);
  if(!conn.capabilities.orders){conn.status='UNAVAILABLE';conn.lastError='Required Square ORDERS_READ scope was not granted';await conn.save();return publicConnection(conn)}
  try{
    const data=await sqFetch(token,'/v2/locations');
    conn.metadata={...(conn.metadata||{}),providerLocations:(data.locations||[]).map(l=>({id:l.id,name:l.name,status:l.status,timezone:l.timezone,address:l.address}))};
    conn.status='PARTIAL';conn.lastSuccessAt=new Date();conn.lastError=conn.capabilities.payments?null:'PAYMENTS_READ is unavailable; refund-dependent financial data will remain Partial';
  }catch(err){
    conn.status='PARTIAL';conn.lastError=String(err.message||err).slice(0,500);
  }
  await conn.save();return publicConnection(conn)
}
async function setMappings(organizationId,provider,mappings){
  if(!['square','toast'].includes(provider))throw new ApiError(400,'Unsupported provider');
  if(!mappings||typeof mappings!=='object'||Array.isArray(mappings))throw new ApiError(400,'mappings must be an object');
  if(mappings.locations&&typeof mappings.locations==='object'){for(const locationId of Object.keys(mappings.locations)){const location=await Location.findOne({_id:locationId,organizationId,status:'active'}).select('_id');if(!location)throw new ApiError(400,`Location mapping references an inactive or unknown location: ${locationId}`)}}
  if(provider==='square'){
    const allowed=new Set(['dine_in','takeout','delivery','third_party','direct_online']);
    if(mappings.channels){
      for(const [key,patterns] of Object.entries(mappings.channels)){
        if(!allowed.has(key)||!Array.isArray(patterns)||patterns.some(x=>typeof x!=='string'||x.length>120))throw new ApiError(400,'Invalid Square channel mapping');
      }
    }
    mappings.channelsApproved=mappings.channelsApproved===true;
    mappings.channelsApprovedAt=mappings.channelsApproved?new Date().toISOString():null;
    if(mappings.itemAliases!==undefined){if(!mappings.itemAliases||typeof mappings.itemAliases!=='object'||Array.isArray(mappings.itemAliases)||Object.keys(mappings.itemAliases).length>2000)throw new ApiError(400,'itemAliases must be an object with at most 2000 aliases');for(const [source,alias] of Object.entries(mappings.itemAliases)){if(!source.trim()||source.length>240)throw new ApiError(400,'Invalid item alias source');const name=typeof alias==='string'?alias:alias?.name;if(typeof name!=='string'||!name.trim()||name.length>240||((typeof alias==='object'&&alias?.category!=null)&&(typeof alias.category!=='string'||alias.category.length>120)))throw new ApiError(400,'Invalid canonical item alias')}}
    mappings.itemAliasesApproved=mappings.itemAliasesApproved===true;
    mappings.itemAliasesApprovedAt=mappings.itemAliasesApproved?new Date().toISOString():null;
  }
  const conn=await Connection.findOneAndUpdate({organizationId,provider},{$set:{mappings}},{new:true});
  if(!conn)throw new ApiError(404,'Connection not found');
  return publicConnection(conn)
}
function channelFromSquare(order,map={}){const raw=String(order.source?.name||order.fulfillments?.[0]?.type||'').trim();for(const [canonical,patterns] of Object.entries(map)){if((patterns||[]).some(p=>raw.toLowerCase().includes(String(p).toLowerCase())))return canonical}return 'unknown'}
function dateInZone(ts,timezone){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ts));const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));let date=`${m.year}-${m.month}-${m.day}`;if(Number(m.hour)<4)date=addDays(date,-1);return date}
function squareOrderBillable(order,paidOrderIds){
  if(order.state==='CANCELED'||order.state==='COMPLETED')return true;
  if(order.state!=='OPEN')return false;
  if(paidOrderIds.has(order.id))return true;
  return Number(order.net_amount_due_money?.amount||0)===0;
}
async function squareOrdersFromPayments(token,acquired,payments){
  const found=new Set(acquired.map((order)=>order.id));
  for(const payment of payments){
    if(payment.status&&payment.status!=='COMPLETED')continue;
    if(!payment.order_id||found.has(payment.order_id))continue;
    const data=await sqFetch(token,`/v2/orders/${encodeURIComponent(payment.order_id)}`);
    if(data.order){acquired.push(data.order);found.add(data.order.id)}
  }
}
async function squareSync({organizationId,locationId,businessDate,force=false,ignoreRetryDelay=false}){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(businessDate||'')))throw new ApiError(400,'businessDate must be YYYY-MM-DD');
  const loc=await Location.findOne({_id:locationId,organizationId,status:'active'});if(!loc)throw new ApiError(404,'Active location not found');
  const {conn,token}=await squareToken(organizationId);if(!conn.capabilities?.orders)throw new ApiError(409,'Square ORDERS_READ capability is unavailable');const providerLoc=conn.mappings?.locations?.[String(locationId)]?.squareLocationId;if(!providerLoc)throw new ApiError(409,'Square location mapping is not configured');
  const idem=`square:orders:${organizationId}:${locationId}:${businessDate}`;let job=await JobRun.findOne({idempotencyKey:idem});
  if(job?.status==='COMPLETE'&&!force)return job.result;
  if(!force&&!ignoreRetryDelay&&job?.nextRetryAt&&new Date(job.nextRetryAt)>new Date())return {...(job.result||{}),deferred:true,nextRetryAt:job.nextRetryAt};
  job=await JobRun.findOneAndUpdate({idempotencyKey:idem},{$set:{organizationId,source:'square',locationId,businessDate,jobType:'orders_sync',status:'RUNNING',startedAt:new Date(),error:null,nextRetryAt:null},$inc:{attempts:1}},{upsert:true,new:true,setDefaultsOnInsert:true});
  let rawEvent=null;
  try{
    let cursor;const acquired=[];
    do{
      const body={location_ids:[providerLoc],limit:500,query:{filter:{date_time_filter:{created_at:{start_at:new Date(`${addDays(businessDate,-1)}T08:00:00Z`).toISOString(),end_at:new Date(`${addDays(businessDate,2)}T12:00:00Z`).toISOString()}},state_filter:{states:['OPEN','COMPLETED','CANCELED']}}}};
      if(cursor)body.cursor=cursor;
      const data=await sqFetch(token,'/v2/orders/search',{method:'POST',body:JSON.stringify(body)});acquired.push(...(data.orders||[]));cursor=data.cursor
    }while(cursor);
    let payments=[],refunds=[];const rangeStart=new Date(`${addDays(businessDate,-1)}T08:00:00Z`).toISOString(),rangeEnd=new Date(`${addDays(businessDate,2)}T12:00:00Z`).toISOString();
    if(conn.capabilities?.payments){let paymentCursor;do{const q=new URLSearchParams({begin_time:rangeStart,end_time:rangeEnd,location_id:providerLoc,limit:'100'});if(paymentCursor)q.set('cursor',paymentCursor);const d=await sqFetch(token,`/v2/payments?${q}`);payments.push(...(d.payments||[]));paymentCursor=d.cursor}while(paymentCursor);let refundCursor;do{const q=new URLSearchParams({begin_time:rangeStart,end_time:rangeEnd,location_id:providerLoc,limit:'100'});if(refundCursor)q.set('cursor',refundCursor);const d=await sqFetch(token,`/v2/refunds?${q}`);refunds.push(...(d.refunds||[]));refundCursor=d.cursor}while(refundCursor)}
    await squareOrdersFromPayments(token,acquired,payments);
    const paidOrderIds=new Set(payments.filter((payment)=>payment.status==='COMPLETED'&&payment.order_id).map((payment)=>payment.order_id));
    const filtered=acquired.filter((order)=>squareOrderBillable(order,paidOrderIds)&&dateInZone(order.closed_at||order.updated_at||order.created_at,loc.timezone)===businessDate);
    const paymentOrder=new Map(payments.filter(p=>p.order_id).map(p=>[p.id,p.order_id]));const refundsByOrder=new Map();for(const r of refunds){if(r.status&&r.status!=='COMPLETED')continue;const orderId=paymentOrder.get(r.payment_id);if(!orderId)continue;refundsByOrder.set(orderId,(refundsByOrder.get(orderId)||0)+Number(r.amount_money?.amount||0))}
    const priorRaw=await RawIngestEvent.findOne({organizationId,provider:'square',locationId,businessDate,capability:'orders'}).sort({processingVersion:-1}).lean();
    const processingVersion=Number(priorRaw?.processingVersion||0)+1;
    const rawBuffer=Buffer.from(JSON.stringify({provider:'square',providerLocationId:providerLoc,businessDate,acquiredAt:new Date().toISOString(),orders:filtered,payments,refunds}));
    const rawHash=crypto.createHash('sha256').update(rawBuffer).digest('hex');
    const rawRef=await storage.put({organizationId,key:`raw-ingest/square/${locationId}/${businessDate}/v${processingVersion}-${crypto.randomUUID()}.json`,buffer:rawBuffer});
    rawEvent=await RawIngestEvent.create({organizationId,locationId,provider:'square',businessDate,capability:'orders',rawRef,contentHash:rawHash,recordCount:filtered.length+payments.length+refunds.length,sourceTimestamp:filtered.reduce((m,o)=>{const d=new Date(o.updated_at||o.created_at||0);return !m||d>m?d:m},null),processingVersion,status:'RECEIVED',metadata:{providerLocationId:providerLoc,orderCount:filtered.length,paymentCount:payments.length,refundCount:refunds.length,paymentsCapability:Boolean(conn.capabilities?.payments)}});
    const channelsApproved=conn.mappings?.channelsApproved===true;const channelMap=channelsApproved?(conn.mappings?.channels||{}):{};const catalog=await squareCatalogMap(organizationId,token,conn.capabilities?.catalog!==false);
    const control={orderCount:0,netMoney:0,refundMoney:0,voidMoney:0,discountMoney:0,channels:{dine_in:0,takeout:0,delivery:0,third_party:0,direct_online:0,unknown:0}};
    for(const o of filtered){
      const tax=Number(o.total_tax_money?.amount||0),tip=Number(o.total_tip_money?.amount||0),total=Number(o.total_money?.amount||0),discount=Number(o.total_discount_money?.amount||0);
      const returned=(o.returns||[]).reduce((sum,r)=>sum+Number(r.return_amounts?.total_money?.amount||0),0);
      const refund=conn.capabilities?.payments?(refundsByOrder.get(o.id)||0):(returned||0);const canceled=o.state==='CANCELED';const preRefundNet=Math.max(0,total-tax-tip);const salesNet=canceled?0:Math.max(0,preRefundNet-refund);const grossSales=canceled?0:Math.max(0,preRefundNet+discount);const voidMoney=canceled?Math.max(0,preRefundNet):0;const channel=canceled?'unknown':channelFromSquare(o,channelMap);
      const itemAliases=conn.mappings?.itemAliasesApproved===true?(conn.mappings?.itemAliases||{}):{};const items=canceled?[]:(o.line_items||[]).map(i=>{const rawName=i.name||'Unknown';const alias=itemAliases[i.catalog_object_id]||itemAliases[rawName];return {providerItemId:i.catalog_object_id||'',name:typeof alias==='string'?alias:(alias?.name||rawName),category:(typeof alias==='object'&&alias?.category)||catalog.variationToCategory.get(i.catalog_object_id)||'',quantity:Number(i.quantity||0),grossMoney:i.base_price_money?.amount?Number(i.quantity||0)*Number(i.base_price_money.amount):0,netMoney:Number(i.total_money?.amount||0)}});
      const existing=await Order.findOne({organizationId,provider:'square',providerOrderId:o.id}).select('processingVersion');
      await Order.findOneAndUpdate({organizationId,provider:'square',providerOrderId:o.id},{locationId,businessDate,orderState:canceled?'CANCELED':'COMPLETED',sourceTimestamp:new Date(o.updated_at||o.created_at),ingestTimestamp:new Date(),processingVersion:Number(existing?.processingVersion||0)+1,currency:o.total_money?.currency||'USD',grossMoney:grossSales,netMoney:salesNet,refundMoney:refund,voidMoney,discountMoney:canceled?0:discount,guestCount:null,channel,items,rawRef,status:'COMPLETE'},{upsert:true,new:true,setDefaultsOnInsert:true});
      if(canceled){control.voidMoney+=voidMoney;continue}control.orderCount++;control.netMoney+=salesNet;control.refundMoney+=refund;control.discountMoney+=discount;control.channels[channel]=(control.channels[channel]||0)+salesNet
    }
    const sourceClosed=dateInZone(new Date(),loc.timezone)>businessDate;const metric=await analytics.rebuildDaily({organizationId,locationId,businessDate});
    const rec=squareReconciliation({canonical:{orderCount:metric?.orderCount||0,netMoney:metric?.netMoney||0,refundMoney:metric?.refundMoney||0,voidMoney:metric?.voidMoney||0,discountMoney:metric?.discountMoney||0,channels:metric?.channels||{}},provider:control,channelsApproved});
    const requiredCapabilities=Boolean(conn.capabilities?.orders&&conn.capabilities?.payments);const pass=sourceClosed&&requiredCapabilities&&reconciliationPass(rec);
    if(metric){
      metric.reconciliation=rec;if(!pass)metric.dataStatus='PARTIAL';await metric.save();
      await analytics.rebuildBaselinesAndScore({organizationId,locationId,businessDate});
    }
    rawEvent.status=pass?'PROCESSED':'PARTIAL';rawEvent.metadata={...(rawEvent.metadata||{}),reconciliation:rec,sourceClosed};await rawEvent.save();
    const result={orders:filtered.filter(o=>o.state!=='CANCELED').length,canceled:filtered.filter(o=>o.state==='CANCELED').length,rawIngestId:rawEvent.id,reconciliation:rec,channelsApproved,catalogStatus:catalog.available?'COMPLETE':'UNAVAILABLE',paymentsStatus:conn.capabilities?.payments?'COMPLETE':'UNAVAILABLE',sourceClosed};job.status=pass?'COMPLETE':'PARTIAL';job.result=result;job.finishedAt=new Date();job.nextRetryAt=pass?null:new Date(Date.now()+Math.min(60*60000,Math.max(15*60000,2**Math.min(job.attempts||1,5)*60000)));await job.save();conn.lastSuccessAt=new Date();conn.status=pass?'READY':'PARTIAL';conn.lastError=pass?null:!conn.capabilities?.payments?'PAYMENTS_READ is unavailable; refund-dependent reconciliation remains Partial':!sourceClosed?'Source business day is still open':'Reconciliation outside tolerance';await conn.save();return result
  }catch(err){if(rawEvent){rawEvent.status='FAILED';rawEvent.error=String(err.message||err).slice(0,1000);await rawEvent.save().catch(()=>{});}job.status='FAILED';job.error=err.message;job.finishedAt=new Date();job.nextRetryAt=new Date(Date.now()+Math.min(6*3600000,2**Math.min(job.attempts||1,6)*60000));await job.save();conn.status='ERROR';conn.lastError=err.message;await conn.save();throw err}
}
async function squareBackfill({organizationId,locationId,from,to}){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(from||''))||!/^\d{4}-\d{2}-\d{2}$/.test(String(to||''))||from>to)throw new ApiError(400,'Square backfill requires a valid from/to date range');
  const loc=await Location.findOne({_id:locationId,organizationId,status:'active'}).select('_id');if(!loc)throw new ApiError(404,'Active location not found');
  const days=[];let cursor=from;while(cursor<=to){days.push(cursor);cursor=addDays(cursor,1);if(days.length>370)throw new ApiError(400,'Square backfill range is limited to 370 days per request')}
  const results=[];for(const businessDate of days){try{const result=await squareSync({organizationId,locationId,businessDate,force:false,ignoreRetryDelay:true});results.push({businessDate,status:result?.reconciliation&&reconciliationPass(result.reconciliation)&&result.sourceClosed&&result.paymentsStatus!=='UNAVAILABLE'?'COMPLETE':'PARTIAL',result})}catch(err){results.push({businessDate,status:'FAILED',error:err.message})}}
  const complete=results.filter(x=>x.status==='COMPLETE').length,partial=results.filter(x=>x.status==='PARTIAL').length,failed=results.filter(x=>x.status==='FAILED').length;return {from,to,days:days.length,complete,partial,failed,resumable:true,results};
}
function parseCsv(text){const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'&&q&&n==='"'){cell+='"';i++}else if(c==='"')q=!q;else if(c===','&&!q){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(cell);cell='';if(row.some(v=>v!==''))rows.push(row);row=[]}else cell+=c}if(cell||row.length){row.push(cell);rows.push(row)}return rows}
async function toastImport({organizationId,locationId,fileName,base64,mapping={}}){
  const loc=await Location.findOne({_id:locationId,organizationId,status:'active'});if(!loc)throw new ApiError(404,'Active location not found');
  const buffer=Buffer.from(String(base64||'').replace(/^data:[^;]+;base64,/,''),'base64');if(!buffer.length)throw new ApiError(400,'Toast export is empty');if(buffer.length>30*1024*1024)throw new ApiError(413,'Toast export exceeds 30 MB application upload limit');
  const archiveHash=crypto.createHash('sha256').update(buffer).digest('hex');const archived=await storage.put({organizationId,key:`toast-archive/${Date.now()}-${pathSafe(fileName||'toast-export.csv')}`,buffer});
  const squareConfig=await Connection.findOne({organizationId,provider:'square'}).lean();const approvedAliases=squareConfig?.mappings?.itemAliasesApproved===true?(squareConfig.mappings.itemAliases||{}):{};mapping={...mapping,itemAliases:{...approvedAliases,...(mapping.itemAliases||{})}};
  const rows=parseCsv(buffer.toString('utf8'));if(rows.length<2)throw new ApiError(400,'Toast CSV has no data rows');const headers=rows[0].map(x=>x.trim());const idx=name=>headers.findIndex(h=>h.toLowerCase()===String(mapping[name]||name).toLowerCase());
  const cols={id:idx('orderId'),date:idx('businessDate'),net:idx('netSales'),gross:idx('grossSales'),discount:idx('discounts'),refund:idx('refunds'),channel:idx('channel'),itemId:idx('itemId'),itemName:idx('itemName'),itemCategory:idx('itemCategory'),itemQuantity:idx('itemQuantity'),itemNet:idx('itemNetSales')};if(cols.id<0||cols.date<0||cols.net<0)throw new ApiError(400,'Toast mapping requires orderId, businessDate and netSales columns');
  const money=v=>{const n=Number(String(v??'0').replace(/[$,]/g,''));return Number.isFinite(n)?Math.round(n*100):0};const qty=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const groups=new Map();for(const r of rows.slice(1)){const id=String(r[cols.id]||'').trim(),businessDate=String(r[cols.date]||'').slice(0,10);if(!id||!/^\d{4}-\d{2}-\d{2}$/.test(businessDate))continue;let g=groups.get(id);if(!g){const channelRaw=cols.channel>=0?String(r[cols.channel]||''):'';let channel='unknown';for(const [k,patterns]of Object.entries(mapping.channels||{}))if((patterns||[]).some(p=>channelRaw.toLowerCase().includes(String(p).toLowerCase())))channel=k;g={providerOrderId:id,businessDate,grossMoney:cols.gross>=0?money(r[cols.gross]):money(r[cols.net]),netMoney:money(r[cols.net]),discountMoney:cols.discount>=0?money(r[cols.discount]):0,refundMoney:cols.refund>=0?money(r[cols.refund]):0,channel,items:[]};groups.set(id,g)}
    if(cols.itemName>=0&&String(r[cols.itemName]||'').trim()){const rawName=String(r[cols.itemName]).trim();const alias=(mapping.itemAliases||{})[rawName]||(cols.itemId>=0?(mapping.itemAliases||{})[String(r[cols.itemId]||'')]:null);const normalized=typeof alias==='string'?alias:alias?.name||rawName;g.items.push({providerItemId:cols.itemId>=0?String(r[cols.itemId]||''):'',name:normalized,category:(typeof alias==='object'&&alias?.category)|| (cols.itemCategory>=0?String(r[cols.itemCategory]||''):'') ,quantity:cols.itemQuantity>=0?qty(r[cols.itemQuantity]):0,grossMoney:cols.itemNet>=0?money(r[cols.itemNet]):0,netMoney:cols.itemNet>=0?money(r[cols.itemNet]):0})}
  }
  if(!groups.size)throw new ApiError(400,'Toast CSV did not contain any valid order rows');const prior=await RawIngestEvent.findOne({organizationId,provider:'toast',locationId,businessDate:'HISTORICAL_IMPORT',capability:'orders'}).sort({processingVersion:-1}).lean();const processingVersion=Number(prior?.processingVersion||0)+1;const rawEvent=await RawIngestEvent.create({organizationId,locationId,provider:'toast',businessDate:'HISTORICAL_IMPORT',capability:'orders',rawRef:archived,contentHash:archiveHash,recordCount:groups.size,processingVersion,status:'RECEIVED',metadata:{fileName:pathSafe(fileName||'toast-export.csv'),bytes:buffer.length}});
  let imported=0;for(const g of groups.values()){const existing=await Order.findOne({organizationId,provider:'toast',providerOrderId:g.providerOrderId}).select('processingVersion');await Order.findOneAndUpdate({organizationId,provider:'toast',providerOrderId:g.providerOrderId},{locationId:g.locationId||locationId,businessDate:g.businessDate,orderState:'COMPLETED',grossMoney:g.grossMoney,netMoney:g.netMoney,discountMoney:g.discountMoney,refundMoney:g.refundMoney,voidMoney:0,channel:g.channel,items:g.items,rawRef:archived,sourceTimestamp:new Date(`${g.businessDate}T12:00:00Z`),ingestTimestamp:new Date(),processingVersion:Number(existing?.processingVersion||0)+1,status:'COMPLETE'},{upsert:true,new:true,setDefaultsOnInsert:true});imported++}
  const dates=[...new Set([...groups.values()].map(g=>g.businessDate))].sort();for(const d of dates){await analytics.rebuildDaily({organizationId,locationId,businessDate:d});await analytics.rebuildBaselinesAndScore({organizationId,locationId,businessDate:d})}
  rawEvent.status='PROCESSED';rawEvent.metadata={...(rawEvent.metadata||{}),imported,dates:dates.length};await rawEvent.save();await Connection.findOneAndUpdate({organizationId,provider:'toast'},{status:'READY',capabilities:{historicalImport:true,live:false},metadata:{lastArchiveKey:archived,lastArchiveHash:archiveHash,lastImportRows:imported,lastImportDates:dates.length,lastOriginalName:pathSafe(fileName||'toast-export.csv')},lastSuccessAt:new Date()},{upsert:true,new:true});return {imported,archiveKey:archived,archiveHash,dates:dates.length,rawIngestId:rawEvent.id}
}
const pathSafe=s=>String(s).replace(/[^a-zA-Z0-9._-]/g,'_');
module.exports={list,squareConnect,squareCallback,discoverSquare,setMappings,squareSync,squareBackfill,toastImport};
