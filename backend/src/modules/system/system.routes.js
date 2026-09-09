const {Router}=require('express');const Connection=require('../../models/Connection');const JobRun=require('../../models/JobRun');const AuditEvent=require('../../models/AuditEvent');const DailyMetric=require('../../models/DailyMetric');const ApiResponse=require('../../utils/ApiResponse');const asyncHandler=require('../../utils/asyncHandler');const {authenticate,requireAdmin}=require('../../middlewares/auth.middleware');const integrations=require('../integrations/integrations.service');const analytics=require('../analytics/analytics.service');const ApiError=require('../../utils/ApiError');const auditSvc=require('../audit/audit.service');const {requestMeta}=require('../../utils/requestMeta');
const r=Router();r.use(authenticate,requireAdmin);
r.get('/health',asyncHandler(async(req,res)=>{
  const [connections,jobs,audit,reconciliation]=await Promise.all([
    Connection.find({organizationId:req.auth.organizationId}).select('-accessTokenEnc -refreshTokenEnc').lean(),
    JobRun.find({organizationId:req.auth.organizationId}).sort({createdAt:-1}).limit(100).lean(),
    AuditEvent.find({organizationId:req.auth.organizationId}).sort({createdAt:-1}).limit(100).lean(),
    DailyMetric.find({organizationId:req.auth.organizationId,$or:[{dataStatus:{$ne:'COMPLETE'}},{'reconciliation.orderCount.pass':false},{'reconciliation.netSales.pass':false},{'reconciliation.refunds.pass':false},{'reconciliation.voids.pass':false},{'reconciliation.discounts.pass':false},{'reconciliation.channels.pass':false}]}).sort({businessDate:-1}).limit(100).lean(),
  ]);
  ApiResponse.send(res,{data:{connections,jobs,audit,reconciliation,server:{uptime:process.uptime(),node:process.version,now:new Date().toISOString()}}});
}));
r.post('/rerun',asyncHandler(async(req,res)=>{
  const {source,locationId,businessDate}=req.body;
  if(!source||!locationId||!businessDate)throw new ApiError(400,'source, locationId and businessDate are required');
  let result;
  if(source==='square'){
    result=await integrations.squareSync({organizationId:req.auth.organizationId,locationId,businessDate,force:true});
  }else if(source==='google'){
    result=await integrations.googleSync({organizationId:req.auth.organizationId,locationId,from:businessDate,to:businessDate});
  }else if(source==='forecast'){
    result=await analytics.rebuildForecast({organizationId:req.auth.organizationId,locationId,businessDate});
  }else if(source==='calculate'){
    await analytics.rebuildDaily({organizationId:req.auth.organizationId,locationId,businessDate});
    result=await analytics.rebuildBaselinesAndScore({organizationId:req.auth.organizationId,locationId,businessDate});
  }else throw new ApiError(400,'Unsupported rerun source');
  await auditSvc.record({type:'system.manual_rerun',result:'success',actorUserId:req.user.id,organizationId:req.auth.organizationId,...requestMeta(req),meta:{source,locationId,businessDate}});
  ApiResponse.send(res,{data:{result}});
}));
module.exports=r;
