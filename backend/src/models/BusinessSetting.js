const mongoose=require('mongoose');
const schema=new mongoose.Schema({organizationId:{type:mongoose.Schema.Types.ObjectId,ref:'Organization',required:true,index:true},locationId:{type:mongoose.Schema.Types.ObjectId,ref:'Location',default:null,index:true},key:{type:String,required:true,index:true},value:{type:mongoose.Schema.Types.Mixed,required:true},effectiveFrom:{type:Date,default:Date.now,index:true},createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true}},{timestamps:true});
schema.index({organizationId:1,locationId:1,key:1,effectiveFrom:-1});
module.exports=mongoose.model('BusinessSetting',schema);
