const mongoose=require('mongoose');
const lineSchema=new mongoose.Schema({sourceDescription:String,description:String,quantity:Number,unit:String,unitPrice:Number,totalMoney:Number,category:String,confidence:Number,page:Number,mappingReused:{type:Boolean,default:false}},{_id:true});
const adjustmentSchema=new mongoose.Schema({label:{type:String,required:true},type:{type:String,enum:['tax','shipping','delivery','handling','service_fee','processing_fee','tip','discount','credit','deposit','surcharge','other'],default:'other'},amountMoney:{type:Number,required:true},confidence:Number,page:Number},{_id:true});
const schema=new mongoose.Schema({
  organizationId:{type:mongoose.Schema.Types.ObjectId,ref:'Organization',required:true,index:true},
  locationId:{type:mongoose.Schema.Types.ObjectId,ref:'Location',required:true,index:true},
  vendorId:{type:mongoose.Schema.Types.ObjectId,ref:'Vendor',default:null,index:true},vendorName:String,invoiceNumber:String,invoiceDate:String,currency:{type:String,default:'USD'},subtotalMoney:Number,taxMoney:Number,totalMoney:Number,
  status:{type:String,enum:['RECEIVED','PROCESSING','PENDING_REVIEW','APPROVED','REJECTED','FAILED'],default:'RECEIVED',index:true},
  contentHash:{type:String,index:true,select:false},storageKey:{type:String,select:false},mimeType:String,originalName:String,
  duplicateCandidateIds:{type:[mongoose.Schema.Types.ObjectId],default:[]},duplicateDisposition:{type:String,enum:['','not_duplicate','duplicate_keep','duplicate_reject'],default:''},
  ocrFields:{type:mongoose.Schema.Types.Mixed,default:{}},lineItems:{type:[lineSchema],default:[]},adjustments:{type:[adjustmentSchema],default:[]},highRiskConfirmed:{type:Boolean,default:false},reconciliationOverrideReason:{type:String,default:''},reconciliationOverriddenBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},reconciliationOverriddenAt:Date,approvedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},approvedAt:Date,rejectionReason:String
},{timestamps:true});
schema.index({organizationId:1,locationId:1,status:1,invoiceDate:-1});
schema.index({organizationId:1,vendorId:1,invoiceNumber:1});
module.exports=mongoose.model('Invoice',schema);
