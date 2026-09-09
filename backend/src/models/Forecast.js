const mongoose=require('mongoose');
const daySchema=new mongoose.Schema({
  businessDate:{type:String,required:true},
  weekday:Number,
  expectedMoney:{type:Number,default:null},
  lowMoney:{type:Number,default:null},
  highMoney:{type:Number,default:null},
  comparableCount:{type:Number,default:0},
  status:{type:String,enum:['COMPLETE','PROVISIONAL','UNAVAILABLE'],default:'UNAVAILABLE'},
},{_id:false});
const schema=new mongoose.Schema({
  organizationId:{type:mongoose.Schema.Types.ObjectId,ref:'Organization',required:true,index:true},
  locationId:{type:mongoose.Schema.Types.ObjectId,ref:'Location',required:true,index:true},
  weekStart:{type:String,required:true,index:true},
  expectedMoney:Number,
  lowMoney:Number,
  highMoney:Number,
  coverage:Number,
  status:{type:String,enum:['COMPLETE','PROVISIONAL','UNAVAILABLE'],default:'PROVISIONAL'},
  formulaVersion:{type:Number,default:1},
  comparisonDates:{type:[String],default:[]},
  days:{type:[daySchema],default:[]},
},{timestamps:true});
schema.index({organizationId:1,locationId:1,weekStart:1},{unique:true});
module.exports=mongoose.model('Forecast',schema);
