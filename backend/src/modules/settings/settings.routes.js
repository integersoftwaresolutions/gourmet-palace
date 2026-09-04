const {Router}=require('express'); const ApiResponse=require('../../utils/ApiResponse'); const asyncHandler=require('../../utils/asyncHandler'); const {authenticate,requireAdmin}=require('../../middlewares/auth.middleware'); const svc=require('./settings.service'); const {requestMeta}=require('../../utils/requestMeta');
const r=Router(); r.use(authenticate,requireAdmin);
r.get('/',asyncHandler(async(req,res)=>ApiResponse.send(res,{data:await svc.list(req.auth.organizationId)})));
r.post('/',asyncHandler(async(req,res)=>ApiResponse.send(res,{statusCode:201,data:{setting:await svc.setValue({organizationId:req.auth.organizationId,locationId:req.body.locationId||null,key:req.body.key,value:req.body.value,effectiveFrom:req.body.effectiveFrom,actor:req.user,reqMeta:requestMeta(req)})}})));
module.exports=r;
