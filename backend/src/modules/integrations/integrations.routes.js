const {Router}=require('express');const ApiResponse=require('../../utils/ApiResponse');const asyncHandler=require('../../utils/asyncHandler');const {authenticate,requireAdmin}=require('../../middlewares/auth.middleware');const svc=require('./integrations.service');const {parseRange}=require('../../utils/dateRange');const audit=require('../audit/audit.service');const {requestMeta}=require('../../utils/requestMeta');const r=Router();r.use(authenticate,requireAdmin);
async function log(req,type,meta){await audit.record({type,result:'success',actorUserId:req.user.id,organizationId:req.auth.organizationId,...requestMeta(req),meta})}
r.get('/',asyncHandler(async(req,res)=>ApiResponse.send(res,{data:{connections:await svc.list(req.auth.organizationId)}})));
r.post('/square/connect',asyncHandler(async(req,res)=>ApiResponse.send(res,{data:{url:await svc.squareConnect(req)}})));
r.get('/square/callback',asyncHandler(async(req,res)=>{
  const appUrl=require('../../config/env').appUrl;
  try{
    await svc.squareCallback(req,req.auth.organizationId,req.query.code,req.query.state);
    await log(req,'integration.square.connect',{});
    res.redirect(`${appUrl}/admin/integrations?connected=square`);
  }catch(err){
    res.redirect(`${appUrl}/admin/integrations?error=${encodeURIComponent(String(err.message||err).slice(0,180))}`);
  }
}));
r.post('/square/discover',asyncHandler(async(req,res)=>ApiResponse.send(res,{data:{connection:await svc.discoverSquare(req.auth.organizationId)}})));
r.post('/square/sync',asyncHandler(async(req,res)=>{const data=await svc.squareSync({organizationId:req.auth.organizationId,locationId:req.body.locationId,businessDate:req.body.businessDate,force:req.body.force===true});await log(req,'integration.square.manual_sync',{locationId:req.body.locationId,businessDate:req.body.businessDate});ApiResponse.send(res,{data})}));
r.post('/square/backfill',asyncHandler(async(req,res)=>{const range=parseRange(req.body);const data=await svc.squareBackfill({organizationId:req.auth.organizationId,locationId:req.body.locationId,from:range.from,to:range.to});await log(req,'integration.square.backfill',{locationId:req.body.locationId,from:range.from,to:range.to,complete:data.complete,partial:data.partial,failed:data.failed});ApiResponse.send(res,{data})}));
r.put('/:provider/mappings',asyncHandler(async(req,res)=>{const connection=await svc.setMappings(req.auth.organizationId,req.params.provider,req.body.mappings);await log(req,'integration.mapping.update',{provider:req.params.provider,channelsApproved:req.params.provider==='square'?req.body.mappings?.channelsApproved:undefined});ApiResponse.send(res,{data:{connection}})}));
r.post('/toast/import',asyncHandler(async(req,res)=>{const data=await svc.toastImport({organizationId:req.auth.organizationId,...req.body});await log(req,'integration.toast.historical_import',{locationId:req.body.locationId,rows:data.imported,archiveKey:data.archiveKey});ApiResponse.send(res,{data})}));
module.exports=r;
