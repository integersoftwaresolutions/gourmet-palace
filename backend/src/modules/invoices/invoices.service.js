const crypto=require('crypto');const path=require('path');
const Invoice=require('../../models/Invoice');const Vendor=require('../../models/Vendor');const CorrectionMapping=require('../../models/CorrectionMapping');const PriceObservation=require('../../models/PriceObservation');const ApiError=require('../../utils/ApiError');const {applyScope,requireLocation}=require('../../utils/scope');const storage=require('../storage/storage.service');const env=require('../../config/env');const audit=require('../audit/audit.service');
const ALLOWED=new Set(['application/pdf','image/jpeg','image/png']);
function hasExpectedSignature(buffer,mimeType){if(mimeType==='application/pdf')return buffer.subarray(0,5).toString('ascii')==='%PDF-';if(mimeType==='image/jpeg')return buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff;if(mimeType==='image/png')return buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));return false}
function arithmetic(fields,lineItems){const lineTotal=(lineItems||[]).reduce((sum,row)=>sum+(row.totalMoney==null?0:Number(row.totalMoney)),0);const subtotal=fields.subtotalMoney==null?null:Number(fields.subtotalMoney),tax=fields.taxMoney==null?null:Number(fields.taxMoney),total=fields.totalMoney==null?null:Number(fields.totalMoney);return {lineItemsTotalMoney:lineTotal,subtotalMoney:subtotal,taxMoney:tax,totalMoney:total,lineItemsMatchSubtotal:subtotal==null?null:Math.abs(lineTotal-subtotal)<=1,subtotalPlusTaxMatchesTotal:subtotal==null||tax==null||total==null?null:Math.abs(subtotal+tax-total)<=1}}
function publicInvoice(value){const obj=value?.toJSON?value.toJSON():{...(value||{})};delete obj.storageKey;delete obj.contentHash;return obj}

async function openAiExtract(buffer, mimeType) {
  if (!env.openaiApiKey) {
    return { fields: {}, lineItems: [], warning: 'OPENAI_API_KEY is not configured; manual review is required.' };
  }
  const base64 = buffer.toString('base64');
  const fileInput = mimeType === 'application/pdf'
    ? { type: 'input_file', filename: 'invoice.pdf', file_data: `data:${mimeType};base64,${base64}` }
    : { type: 'input_image', image_url: `data:${mimeType};base64,${base64}`, detail: 'high' };
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      vendorName: { type: ['string', 'null'] },
      invoiceNumber: { type: ['string', 'null'] },
      invoiceDate: { type: ['string', 'null'] },
      subtotalMoney: { type: ['integer', 'null'] },
      taxMoney: { type: ['integer', 'null'] },
      totalMoney: { type: ['integer', 'null'] },
      confidence: { type: 'object', additionalProperties: { type: 'number' } },
      pages: { type: 'object', additionalProperties: { type: 'integer' } },
      lineItems: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            description: { type: 'string' }, quantity: { type: ['number', 'null'] }, unit: { type: ['string', 'null'] },
            unitPrice: { type: ['integer', 'null'] }, totalMoney: { type: ['integer', 'null'] }, category: { type: ['string', 'null'] },
            confidence: { type: ['number', 'null'] }, page: { type: ['integer', 'null'] },
          },
          required: ['description', 'quantity', 'unit', 'unitPrice', 'totalMoney', 'category', 'confidence', 'page'],
        },
      },
    },
    required: ['vendorName', 'invoiceNumber', 'invoiceDate', 'subtotalMoney', 'taxMoney', 'totalMoney', 'confidence', 'pages', 'lineItems'],
  };
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.openaiApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.openaiModel,
      input: [{ role: 'user', content: [
        { type: 'input_text', text: 'Extract this restaurant supplier invoice. Money fields must be integer cents. Do not guess unreadable fields; use null. Categorize line items conservatively (meat, seafood, produce, packaging, food, beverage, supplies, other).' },
        fileInput,
      ] }],
      text: { format: { type: 'json_schema', name: 'invoice_extraction', strict: true, schema } },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI OCR failed (${response.status})`);
  const data = await response.json();
  const text = data.output_text || data.output?.flatMap((o) => o.content || []).find((c) => c.type === 'output_text')?.text;
  if (!text) throw new Error('OpenAI OCR returned no structured output');
  const extracted = JSON.parse(text);
  return { fields: extracted, lineItems: extracted.lineItems || [] };
}

async function resolveVendor(organizationId,name){if(!name?.trim())return null;let v=await Vendor.findOne({organizationId,$or:[{name:new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`,'i')},{aliases:new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`,'i')}]});if(!v)v=await Vendor.create({organizationId,name:name.trim()});return v;}
async function applyMappings(organizationId,vendorId,items){const base=items.map(i=>({...i,sourceDescription:i.sourceDescription||i.description||''}));if(!vendorId)return base.map(i=>({...i,mappingReused:false}));const mappings=await CorrectionMapping.find({organizationId,vendorId}).lean();return base.map(i=>{const normalized=String(i.sourceDescription||i.description||'').trim().toLowerCase();const m=mappings.find(x=>normalized.includes(String(x.pattern).toLowerCase()));return m?{...i,description:m.normalizedDescription||i.description,unit:m.unit||i.unit,category:m.category||i.category,mappingReused:true}:{...i,mappingReused:false}})}
async function upload(auth,user,p){const locationId=requireLocation(auth,p.locationId);if(!ALLOWED.has(p.mimeType))throw new ApiError(400,'Only PDF, JPG and PNG invoices are accepted');let buffer;try{buffer=Buffer.from(String(p.base64||'').replace(/^data:[^;]+;base64,/,''),'base64')}catch{throw new ApiError(400,'Invalid file data')}if(!buffer.length)throw new ApiError(400,'Invoice file is empty');if(!hasExpectedSignature(buffer,p.mimeType))throw new ApiError(400,'Invoice file content does not match the declared PDF/JPG/PNG type');if(buffer.length>20*1024*1024)throw new ApiError(413,'Invoice exceeds 20 MB limit');const hash=crypto.createHash('sha256').update(buffer).digest('hex');const duplicates=await Invoice.find({organizationId:auth.organizationId,contentHash:hash,status:{$ne:'REJECTED'}}).select('_id').lean();const ext=p.mimeType==='application/pdf'?'.pdf':p.mimeType==='image/png'?'.png':'.jpg';const storageKey=await storage.put({organizationId:auth.organizationId,key:`invoices/${Date.now()}-${crypto.randomUUID()}${ext}`,buffer});const invoice=await Invoice.create({organizationId:auth.organizationId,locationId,status:'PROCESSING',contentHash:hash,storageKey,mimeType:p.mimeType,originalName:path.basename(p.fileName||`invoice${ext}`),duplicateCandidateIds:duplicates.map(x=>x._id)});try{const ocr=await openAiExtract(buffer,p.mimeType);const f=ocr.fields||{};const vendor=await resolveVendor(auth.organizationId,f.vendorName);const lines=await applyMappings(auth.organizationId,vendor?._id,ocr.lineItems||[]);
    const businessDupes=(f.invoiceNumber&&f.invoiceDate&&f.totalMoney!=null)?await Invoice.find({organizationId:auth.organizationId,_id:{$ne:invoice._id},status:{$ne:'REJECTED'},invoiceNumber:String(f.invoiceNumber),invoiceDate:String(f.invoiceDate),totalMoney:Number(f.totalMoney)}).select('_id').lean():[];
    invoice.duplicateCandidateIds=[...new Set([...(invoice.duplicateCandidateIds||[]).map(String),...businessDupes.map(x=>String(x._id))])];
    Object.assign(invoice,{vendorId:vendor?._id||null,vendorName:f.vendorName||'',invoiceNumber:f.invoiceNumber||'',invoiceDate:f.invoiceDate||'',subtotalMoney:f.subtotalMoney??null,taxMoney:f.taxMoney??null,totalMoney:f.totalMoney??null,ocrFields:{confidence:f.confidence||{},pages:f.pages||{},arithmetic:arithmetic(f,lines),warning:ocr.warning||null},lineItems:lines,status:'PENDING_REVIEW'});await invoice.save();}catch(err){invoice.status='FAILED';invoice.ocrFields={error:err.message};await invoice.save();}await audit.record({type:'invoice.upload',result:invoice.status==='FAILED'?'failure':'success',actorUserId:user?.id||null,organizationId:auth.organizationId,meta:{invoiceId:invoice.id,locationId,status:invoice.status,duplicateCandidates:duplicates.length}});return publicInvoice(invoice)}
async function list(auth,q){const filter=applyScope(auth,{},q.locationId);if(q.status)filter.status=q.status;return Invoice.find(filter).populate('vendorId','name').populate('approvedBy','name').sort({createdAt:-1}).lean()}
async function get(auth,id){const row=await Invoice.findOne(applyScope(auth,{_id:id})).select('+storageKey').populate('vendorId','name').populate('approvedBy','name').lean();if(!row)throw new ApiError(404,'Invoice not found');const signed=storage.sign(row.storageKey,300);const clean=publicInvoice(row);return {...clean,sourceUrl:`/api/v1/invoices/source/${signed.token}?exp=${signed.exp}&sig=${encodeURIComponent(signed.sig)}`}}
async function review(auth,user,id,p){const inv=await Invoice.findOne(applyScope(auth,{_id:id}));if(!inv)throw new ApiError(404,'Invoice not found');if(!['PENDING_REVIEW','FAILED'].includes(inv.status))throw new ApiError(409,'Invoice is not reviewable');const vendor=await resolveVendor(auth.organizationId,p.vendorName||inv.vendorName);inv.vendorId=vendor?._id||null;inv.vendorName=p.vendorName??inv.vendorName;inv.invoiceNumber=p.invoiceNumber??inv.invoiceNumber;inv.invoiceDate=p.invoiceDate??inv.invoiceDate;for(const k of ['subtotalMoney','taxMoney','totalMoney'])if(p[k]!==undefined)inv[k]=p[k]==null?null:Number(p[k]);if(Array.isArray(p.lineItems)){const prior=inv.lineItems||[];inv.lineItems=p.lineItems.map((line,index)=>{const existing=prior[index];return {...line,sourceDescription:existing?.sourceDescription||existing?.description||line.sourceDescription||line.description||''}});}if(p.duplicateDisposition!==undefined){if(!['','not_duplicate','duplicate_keep','duplicate_reject'].includes(String(p.duplicateDisposition)))throw new ApiError(400,'Invalid duplicate disposition');inv.duplicateDisposition=p.duplicateDisposition}if(p.highRiskConfirmed!==undefined)inv.highRiskConfirmed=Boolean(p.highRiskConfirmed);inv.ocrFields={...(inv.ocrFields||{}),arithmetic:arithmetic(inv,inv.lineItems||[])};inv.status='PENDING_REVIEW';await inv.save();await audit.record({type:'invoice.review',result:'success',actorUserId:user?.id||null,organizationId:auth.organizationId,meta:{invoiceId:id,changes:Object.keys(p)}});return publicInvoice(inv)}
async function approve(auth,user,id){const inv=await Invoice.findOne(applyScope(auth,{_id:id}));if(!inv)throw new ApiError(404,'Invoice not found');if(inv.status!=='PENDING_REVIEW')throw new ApiError(409,'Invoice must be pending review');if(!inv.highRiskConfirmed)throw new ApiError(400,'Invoice number, date and total must be explicitly confirmed before approval');if(inv.duplicateCandidateIds.length&&!inv.duplicateDisposition)throw new ApiError(400,'Duplicate candidates require an explicit disposition before approval');if(inv.duplicateDisposition==='duplicate_reject')throw new ApiError(409,'This invoice is marked as a duplicate to reject; reject it instead of approving it');if(!inv.invoiceNumber||!inv.invoiceDate||inv.totalMoney==null)throw new ApiError(400,'Invoice number, date and total are required');if(inv.vendorId){for(const li of inv.lineItems||[]){const pattern=String(li.sourceDescription||li.description||'').trim().toLowerCase();if(!pattern)continue;await CorrectionMapping.findOneAndUpdate({organizationId:auth.organizationId,vendorId:inv.vendorId,pattern},{normalizedDescription:li.description,unit:li.unit||'',category:li.category||'other',approvedBy:user.id,lastUsedAt:new Date()},{upsert:true,new:true,setDefaultsOnInsert:true});if(li.unitPrice!=null)await PriceObservation.create({organizationId:auth.organizationId,locationId:inv.locationId,vendorId:inv.vendorId,invoiceId:inv.id,description:li.description,normalizedDescription:pattern,unit:li.unit||'',unitPrice:li.unitPrice,effectiveDate:inv.invoiceDate,category:li.category||'other'});}}
  inv.status='APPROVED';inv.approvedBy=user.id;inv.approvedAt=new Date();await inv.save();await audit.record({type:'invoice.approve',result:'success',actorUserId:user?.id||null,organizationId:auth.organizationId,meta:{invoiceId:id}});return publicInvoice(inv)}
async function reject(auth,user,id,reason){const inv=await Invoice.findOne(applyScope(auth,{_id:id}));if(!inv)throw new ApiError(404,'Invoice not found');if(inv.status==='APPROVED')throw new ApiError(409,'Approved invoices require a versioned amendment, not rejection');inv.status='REJECTED';inv.rejectionReason=reason||'Rejected by reviewer';await inv.save();await audit.record({type:'invoice.reject',result:'success',actorUserId:user?.id||null,organizationId:auth.organizationId,meta:{invoiceId:id,reason:inv.rejectionReason}});return publicInvoice(inv)}
module.exports={upload,list,get,review,approve,reject};
