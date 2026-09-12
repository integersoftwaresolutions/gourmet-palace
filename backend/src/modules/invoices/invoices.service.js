const crypto = require("crypto");
const path = require("path");
const Invoice = require("../../models/Invoice");
const Vendor = require("../../models/Vendor");
const CorrectionMapping = require("../../models/CorrectionMapping");
const PriceObservation = require("../../models/PriceObservation");
const ApiError = require("../../utils/ApiError");
const { applyScope, requireLocation } = require("../../utils/scope");
const storage = require("../storage/storage.service");
const env = require("../../config/getEnv")();
const audit = require("../audit/audit.service");
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png"]);
function invoiceLog(event, details = {}) {
  // Keep logs machine-searchable while never logging the uploaded file/base64 or API key.
  console.log(`[invoice] ${JSON.stringify({ event, at: new Date().toISOString(), ...details })}`);
}
function invoiceError(event, err, details = {}) {
  console.error(`[invoice] ${JSON.stringify({ event, at: new Date().toISOString(), error: err?.message, stack: err?.stack, ...details })}`);
}
function normalizeInvoiceDate(value) {
  const raw = String(value || '').trim();
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (!match) {
    const slash = /^(\d{1,2})[\\/]([0-9]{1,2})[\\/](\d{4})$/.exec(raw);
    if (slash) match = [raw, slash[3], slash[1], slash[2]];
  }
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function hasExpectedSignature(buffer, mimeType) {
  if (mimeType === "application/pdf")
    return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/jpeg")
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  if (mimeType === "image/png")
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return false;
}
function arithmetic(fields, lineItems, adjustments) {
  const lineTotal = (lineItems || []).reduce(
    (sum, row) => sum + (row.totalMoney == null ? 0 : Number(row.totalMoney)),
    0,
  );
  const subtotal =
      fields.subtotalMoney == null ? null : Number(fields.subtotalMoney),
    tax = fields.taxMoney == null ? null : Number(fields.taxMoney),
    total = fields.totalMoney == null ? null : Number(fields.totalMoney);
  const adjustmentRows = Array.isArray(adjustments) && adjustments.length
    ? adjustments
    : tax == null ? [] : [{ type: "tax", amountMoney: tax }];
  const adjustmentsTotalMoney = adjustmentRows.reduce((sum, row) => sum + (row.amountMoney == null ? 0 : Number(row.amountMoney)), 0);
  const calculatedTotalMoney = subtotal == null ? null : subtotal + adjustmentsTotalMoney;
  return {
    lineItemsTotalMoney: lineTotal,
    subtotalMoney: subtotal,
    taxMoney: tax,
    totalMoney: total,
    adjustmentsTotalMoney,
    calculatedTotalMoney,
    lineItemsMatchSubtotal:
      subtotal == null ? null : Math.abs(lineTotal - subtotal) <= 1,
    subtotalPlusAdjustmentsMatchesTotal:
      subtotal == null || total == null
        ? null
        : Math.abs(calculatedTotalMoney - total) <= 1,
    reconciliationDifferenceMoney:
      calculatedTotalMoney == null || total == null ? null : total - calculatedTotalMoney,
  };
}
function publicInvoice(value) {
  const obj = value?.toJSON ? value.toJSON() : { ...(value || {}) };
  delete obj.storageKey;
  delete obj.contentHash;
  return obj;
}

async function openAiExtract(buffer, mimeType) {
  const startedAt = Date.now();
  invoiceLog("extraction.start", { mimeType, bytes: buffer.length, provider: "openai", configured: Boolean(env.openaiApiKey), model: env.openaiModel });
  if (!env.openaiApiKey) {
    invoiceLog("extraction.skipped", { reason: "OPENAI_API_KEY_NOT_CONFIGURED" });
    return {
      fields: {},
      lineItems: [],
      warning: "OPENAI_API_KEY is not configured; manual review is required.",
    };
  }
  const base64 = buffer.toString("base64");
  const fileInput =
    mimeType === "application/pdf"
      ? {
          type: "input_file",
          filename: "invoice.pdf",
          file_data: `data:${mimeType};base64,${base64}`,
        }
      : {
          type: "input_image",
          image_url: `data:${mimeType};base64,${base64}`,
          detail: "high",
        };
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      vendorName: { type: ["string", "null"] },
      invoiceNumber: { type: ["string", "null"] },
      invoiceDate: { type: ["string", "null"] },
      subtotalMoney: { type: ["integer", "null"] },
      taxMoney: { type: ["integer", "null"] },
      totalMoney: { type: ["integer", "null"] },
      adjustments: {
        type: "array",
        items: {
          type: "object", additionalProperties: false,
          properties: {
            label: { type: "string" },
            type: { type: "string", enum: ["tax", "shipping", "delivery", "handling", "service_fee", "processing_fee", "tip", "discount", "credit", "deposit", "surcharge", "other"] },
            amountMoney: { type: "integer" },
            confidence: { type: ["number", "null"] },
            page: { type: ["integer", "null"] },
          },
          required: ["label", "type", "amountMoney", "confidence", "page"],
        },
      },
      // Strict structured outputs do not allow arbitrary keys in objects.
      // Keep these keys stable and preserve the existing stored object shape.
      confidence: {
        type: "object",
        additionalProperties: false,
        properties: {
          vendorName: { type: ["number", "null"] },
          invoiceNumber: { type: ["number", "null"] },
          invoiceDate: { type: ["number", "null"] },
          subtotalMoney: { type: ["number", "null"] },
          taxMoney: { type: ["number", "null"] },
          totalMoney: { type: ["number", "null"] },
          lineItems: { type: ["number", "null"] },
        },
        required: [
          "vendorName",
          "invoiceNumber",
          "invoiceDate",
          "subtotalMoney",
          "taxMoney",
          "totalMoney",
          "lineItems",
        ],
      },
      pages: {
        type: "object",
        additionalProperties: false,
        properties: {
          vendorName: { type: ["integer", "null"] },
          invoiceNumber: { type: ["integer", "null"] },
          invoiceDate: { type: ["integer", "null"] },
          subtotalMoney: { type: ["integer", "null"] },
          taxMoney: { type: ["integer", "null"] },
          totalMoney: { type: ["integer", "null"] },
          lineItems: { type: ["integer", "null"] },
        },
        required: [
          "vendorName",
          "invoiceNumber",
          "invoiceDate",
          "subtotalMoney",
          "taxMoney",
          "totalMoney",
          "lineItems",
        ],
      },
      lineItems: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            description: { type: "string" },
            quantity: { type: ["number", "null"] },
            unit: { type: ["string", "null"] },
            unitPrice: { type: ["integer", "null"] },
            totalMoney: { type: ["integer", "null"] },
            category: { type: ["string", "null"] },
            confidence: { type: ["number", "null"] },
            page: { type: ["integer", "null"] },
          },
          required: [
            "description",
            "quantity",
            "unit",
            "unitPrice",
            "totalMoney",
            "category",
            "confidence",
            "page",
          ],
        },
      },
    },
    required: [
      "vendorName",
      "invoiceNumber",
      "invoiceDate",
      "subtotalMoney",
      "taxMoney",
      "totalMoney",
      "adjustments",
      "confidence",
      "pages",
      "lineItems",
    ],
  };
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.openaiModel,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Extract this restaurant supplier invoice. Return invoiceDate strictly as YYYY-MM-DD (for example 2026-07-14), never M/D/YYYY. Money fields must be integer cents. Do not guess unreadable fields; use null. Categorize line items conservatively (meat, seafood, produce, packaging, food, beverage, supplies, other). Extract every summary adjustment between subtotal and grand total (including tax, shipping, handling, delivery, fees, discounts, credits, deposits, tips, and surcharges) into adjustments. Charges are positive; discounts and credits are negative. Include tax as an adjustment; do not omit zero-valued printed charges.",
            },
            fileInput,
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "invoice_extraction",
          strict: true,
          schema,
        },
      },
    }),
  });
  invoiceLog("extraction.response", { status: response.status, ok: response.ok, durationMs: Date.now() - startedAt });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    invoiceError("extraction.http_error", new Error(`OpenAI OCR failed (${response.status})`), { status: response.status, responseBody: body.slice(0, 500) });
    throw new Error(`OpenAI OCR failed (${response.status})`);
  }
  const data = await response.json();
  const text =
    data.output_text ||
    data.output
      ?.flatMap((o) => o.content || [])
      .find((c) => c.type === "output_text")?.text;
  if (!text) throw new Error("OpenAI OCR returned no structured output");
  const extracted = JSON.parse(text);
  invoiceLog("extraction.complete", { durationMs: Date.now() - startedAt, vendorName: extracted.vendorName || null, invoiceNumber: extracted.invoiceNumber || null, invoiceDate: extracted.invoiceDate || null, totalMoney: extracted.totalMoney ?? null, lineItemCount: extracted.lineItems?.length || 0, adjustmentCount: extracted.adjustments?.length || 0, confidenceKeys: Object.keys(extracted.confidence || {}), pages: extracted.pages || {} });
  return { fields: extracted, lineItems: extracted.lineItems || [], adjustments: extracted.adjustments || [] };
}

async function resolveVendor(organizationId, name) {
  if (!name?.trim()) { invoiceLog("vendor.resolve.skip", { reason: "missing_name" }); return null; }
  let v = await Vendor.findOne({
    organizationId,
    $or: [
      {
        name: new RegExp(
          `^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i",
        ),
      },
      {
        aliases: new RegExp(
          `^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i",
        ),
      },
    ],
  });
  if (!v) { v = await Vendor.create({ organizationId, name: name.trim() }); invoiceLog("vendor.created", { vendorId: String(v._id), name: v.name }); }
  else invoiceLog("vendor.matched", { vendorId: String(v._id), name: v.name });
  return v;
}
async function applyMappings(organizationId, vendorId, items) {
  invoiceLog("mappings.start", { vendorId: vendorId ? String(vendorId) : null, inputCount: items?.length || 0 });
  const base = items.map((i) => ({
    ...i,
    sourceDescription: i.sourceDescription || i.description || "",
  }));
  if (!vendorId) return base.map((i) => ({ ...i, mappingReused: false }));
  const mappings = await CorrectionMapping.find({
    organizationId,
    vendorId,
  }).lean();
  const mapped = base.map((i) => {
    const normalized = String(i.sourceDescription || i.description || "")
      .trim()
      .toLowerCase();
    const m = mappings.find((x) =>
      normalized.includes(String(x.pattern).toLowerCase()),
    );
    return m
      ? {
          ...i,
          description: m.normalizedDescription || i.description,
          unit: m.unit || i.unit,
          category: m.category || i.category,
          mappingReused: true,
        }
      : { ...i, mappingReused: false };
  });
  invoiceLog("mappings.complete", { vendorId: String(vendorId), availableMappings: mappings.length, reusedCount: mapped.filter((i) => i.mappingReused).length });
  return mapped;
}
async function upload(auth, user, p) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  invoiceLog("upload.start", { requestId, organizationId: String(auth.organizationId), locationId: p.locationId ? String(p.locationId) : null, mimeType: p.mimeType, fileName: p.fileName ? path.basename(p.fileName) : null, base64Chars: typeof p.base64 === "string" ? p.base64.length : 0 });
  const locationId = requireLocation(auth, p.locationId);
  if (!ALLOWED.has(p.mimeType)) { invoiceLog("upload.rejected", { requestId, reason: "mime_not_allowed", mimeType: p.mimeType });
    throw new ApiError(400, "Only PDF, JPG and PNG invoices are accepted"); }
  let buffer;
  try {
    buffer = Buffer.from(
      String(p.base64 || "").replace(/^data:[^;]+;base64,/, ""),
      "base64",
    );
  } catch {
    throw new ApiError(400, "Invalid file data");
  }
  invoiceLog("upload.decoded", { requestId, bytes: buffer.length });
  if (!buffer.length) throw new ApiError(400, "Invoice file is empty");
  if (!hasExpectedSignature(buffer, p.mimeType))
    throw new ApiError(
      400,
      "Invoice file content does not match the declared PDF/JPG/PNG type",
    );
  if (buffer.length > 20 * 1024 * 1024)
    throw new ApiError(413, "Invoice exceeds 20 MB limit");
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const duplicates = await Invoice.find({
    organizationId: auth.organizationId,
    contentHash: hash,
    status: { $ne: "REJECTED" },
  })
    .select("_id")
    .lean();
  invoiceLog("upload.duplicate_check", { requestId, hashPrefix: hash.slice(0, 12), duplicateCount: duplicates.length });
  const ext =
    p.mimeType === "application/pdf"
      ? ".pdf"
      : p.mimeType === "image/png"
        ? ".png"
        : ".jpg";
  const storageKey = await storage.put({
    organizationId: auth.organizationId,
    key: `invoices/${Date.now()}-${crypto.randomUUID()}${ext}`,
    buffer,
  });
  const invoice = await Invoice.create({
    organizationId: auth.organizationId,
    locationId,
    status: "PROCESSING",
    contentHash: hash,
    storageKey,
    mimeType: p.mimeType,
    originalName: path.basename(p.fileName || `invoice${ext}`),
    duplicateCandidateIds: duplicates.map((x) => x._id),
  });
  invoiceLog("upload.persisted", { requestId, invoiceId: String(invoice._id), storageKey, status: invoice.status });
  try {
    const ocr = await openAiExtract(buffer, p.mimeType);
    const f = ocr.fields || {};
    const vendor = await resolveVendor(auth.organizationId, f.vendorName);
    const lines = await applyMappings(
      auth.organizationId,
      vendor?._id,
      ocr.lineItems || [],
    );
    const normalizedDate = normalizeInvoiceDate(f.invoiceDate);
    if (f.invoiceDate && !normalizedDate) invoiceLog("date.invalid_extraction", { requestId, value: f.invoiceDate });
    const adjustments = (ocr.adjustments || []).map((row) => ({
      ...row,
      amountMoney: Number(row.amountMoney),
    }));
    const businessDupes =
      f.invoiceNumber && normalizedDate && f.totalMoney != null
        ? await Invoice.find({
            organizationId: auth.organizationId,
            _id: { $ne: invoice._id },
            status: { $ne: "REJECTED" },
            invoiceNumber: String(f.invoiceNumber),
            invoiceDate: normalizedDate,
            totalMoney: Number(f.totalMoney),
          })
            .select("_id")
            .lean()
        : [];
    invoice.duplicateCandidateIds = [
      ...new Set([
        ...(invoice.duplicateCandidateIds || []).map(String),
        ...businessDupes.map((x) => String(x._id)),
      ]),
    ];
    Object.assign(invoice, {
      vendorId: vendor?._id || null,
      vendorName: f.vendorName || "",
      invoiceNumber: f.invoiceNumber || "",
      invoiceDate: normalizedDate || "",
      subtotalMoney: f.subtotalMoney ?? null,
      taxMoney: f.taxMoney ?? null,
      totalMoney: f.totalMoney ?? null,
      ocrFields: {
        confidence: f.confidence || {},
        pages: f.pages || {},
        arithmetic: arithmetic(f, lines, adjustments),
        warning: ocr.warning || null,
      },
      lineItems: lines,
      adjustments,
      status: "PENDING_REVIEW",
    });
    await invoice.save();
    invoiceLog("upload.extraction_persisted", { requestId, invoiceId: String(invoice._id), status: invoice.status, vendorId: invoice.vendorId ? String(invoice.vendorId) : null, lineItemCount: lines.length, businessDuplicateCount: businessDupes.length, arithmetic: invoice.ocrFields.arithmetic });
  } catch (err) {
    invoiceError("upload.extraction_failed", err, { requestId, invoiceId: String(invoice._id) });
    invoice.status = "FAILED";
    invoice.ocrFields = { error: err.message };
    await invoice.save();
  }
  await audit.record({
    type: "invoice.upload",
    result: invoice.status === "FAILED" ? "failure" : "success",
    actorUserId: user?.id || null,
    organizationId: auth.organizationId,
    meta: {
      invoiceId: invoice.id,
      locationId,
      status: invoice.status,
      duplicateCandidates: duplicates.length,
    },
  });
  invoiceLog("upload.complete", { requestId, invoiceId: String(invoice._id), status: invoice.status, durationMs: Date.now() - startedAt });
  return publicInvoice(invoice);
}
async function list(auth, q) {
  const filter = applyScope(auth, {}, q.locationId);
  if (q.status) filter.status = q.status;
  const rows = await Invoice.find(filter)
    .select("+storageKey")
    .populate("vendorId", "name")
    .populate("approvedBy", "name")
    .sort({ createdAt: -1 })
    .lean();
  return rows.map((row) => {
    const clean = publicInvoice(row);
    if (row.storageKey) {
      const signed = storage.sign(row.storageKey, 300);
      clean.sourceUrl = `/api/v1/invoices/source/${signed.token}?exp=${signed.exp}&sig=${encodeURIComponent(signed.sig)}`;
    }
    return clean;
  });
}
async function get(auth, id) {
  const row = await Invoice.findOne(applyScope(auth, { _id: id }))
    .select("+storageKey")
    .populate("vendorId", "name")
    .populate("approvedBy", "name")
    .lean();
  if (!row) throw new ApiError(404, "Invoice not found");
  const signed = storage.sign(row.storageKey, 300);
  const clean = publicInvoice(row);
  return {
    ...clean,
    sourceUrl: `/api/v1/invoices/source/${signed.token}?exp=${signed.exp}&sig=${encodeURIComponent(signed.sig)}`,
  };
}
async function review(auth, user, id, p) {
  const inv = await Invoice.findOne(applyScope(auth, { _id: id }));
  if (!inv) throw new ApiError(404, "Invoice not found");
  if (!["PENDING_REVIEW", "FAILED"].includes(inv.status))
    throw new ApiError(409, "Invoice is not reviewable");
  const vendor = await resolveVendor(
    auth.organizationId,
    p.vendorName || inv.vendorName,
  );
  inv.vendorId = vendor?._id || null;
  inv.vendorName = p.vendorName ?? inv.vendorName;
  inv.invoiceNumber = p.invoiceNumber ?? inv.invoiceNumber;
  if (p.invoiceDate !== undefined) {
    const normalizedDate = normalizeInvoiceDate(p.invoiceDate);
    if (!normalizedDate) throw new ApiError(400, "Invoice date must be a valid date in YYYY-MM-DD format");
    inv.invoiceDate = normalizedDate;
  }
  for (const k of ["subtotalMoney", "taxMoney", "totalMoney"])
    if (p[k] !== undefined) inv[k] = p[k] == null ? null : Number(p[k]);
  if (Array.isArray(p.lineItems)) {
    const prior = inv.lineItems || [];
    inv.lineItems = p.lineItems.map((line, index) => {
      const existing = prior[index];
      return {
        ...line,
        sourceDescription:
          existing?.sourceDescription ||
          existing?.description ||
          line.sourceDescription ||
          line.description ||
          "",
      };
    });
  }
  if (Array.isArray(p.adjustments)) {
    inv.adjustments = p.adjustments.map((row) => ({
      label: String(row.label || "Other charge"),
      type: row.type || "other",
      amountMoney: Number(row.amountMoney || 0),
      confidence: row.confidence == null ? null : Number(row.confidence),
      page: row.page == null ? null : Number(row.page),
    }));
  }
  if (p.duplicateDisposition !== undefined) {
    if (
      !["", "not_duplicate", "duplicate_keep", "duplicate_reject"].includes(
        String(p.duplicateDisposition),
      )
    )
      throw new ApiError(400, "Invalid duplicate disposition");
    inv.duplicateDisposition = p.duplicateDisposition;
  }
  if (p.highRiskConfirmed !== undefined)
    inv.highRiskConfirmed = Boolean(p.highRiskConfirmed);
  if (p.reconciliationOverrideReason !== undefined) {
    inv.reconciliationOverrideReason = String(p.reconciliationOverrideReason || "").trim();
    if (inv.reconciliationOverrideReason) {
      inv.reconciliationOverriddenBy = user?.id || null;
      inv.reconciliationOverriddenAt = new Date();
    } else {
      inv.reconciliationOverriddenBy = null;
      inv.reconciliationOverriddenAt = null;
    }
  }
  inv.ocrFields = {
    ...(inv.ocrFields || {}),
    arithmetic: arithmetic(inv, inv.lineItems || [], inv.adjustments || []),
  };
  inv.status = "PENDING_REVIEW";
  await inv.save();
  await audit.record({
    type: "invoice.review",
    result: "success",
    actorUserId: user?.id || null,
    organizationId: auth.organizationId,
    meta: { invoiceId: id, changes: Object.keys(p) },
  });
  return publicInvoice(inv);
}
async function approve(auth, user, id) {
  const inv = await Invoice.findOne(applyScope(auth, { _id: id }));
  if (!inv) throw new ApiError(404, "Invoice not found");
  if (inv.status !== "PENDING_REVIEW")
    throw new ApiError(409, "Invoice must be pending review");
  if (!inv.highRiskConfirmed)
    throw new ApiError(
      400,
      "Invoice number, date and total must be explicitly confirmed before approval",
    );
  if (inv.duplicateCandidateIds.length && !inv.duplicateDisposition)
    throw new ApiError(
      400,
      "Duplicate candidates require an explicit disposition before approval",
    );
  if (inv.duplicateDisposition === "duplicate_reject")
    throw new ApiError(
      409,
      "This invoice is marked as a duplicate to reject; reject it instead of approving it",
    );
  if (!inv.invoiceNumber || !inv.invoiceDate || inv.totalMoney == null)
    throw new ApiError(400, "Invoice number, date and total are required");
  const reconciliation = arithmetic(inv, inv.lineItems || [], inv.adjustments || []);
  if (reconciliation.subtotalPlusAdjustmentsMatchesTotal === false && !inv.reconciliationOverrideReason)
    throw new ApiError(400, "Invoice totals do not reconcile; correct the adjustments or provide an override reason");
  if (inv.vendorId) {
    for (const li of inv.lineItems || []) {
      const pattern = String(li.sourceDescription || li.description || "")
        .trim()
        .toLowerCase();
      if (!pattern) continue;
      await CorrectionMapping.findOneAndUpdate(
        {
          organizationId: auth.organizationId,
          vendorId: inv.vendorId,
          pattern,
        },
        {
          normalizedDescription: li.description,
          unit: li.unit || "",
          category: li.category || "other",
          approvedBy: user.id,
          lastUsedAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      if (li.unitPrice != null)
        await PriceObservation.create({
          organizationId: auth.organizationId,
          locationId: inv.locationId,
          vendorId: inv.vendorId,
          invoiceId: inv.id,
          description: li.description,
          normalizedDescription: pattern,
          unit: li.unit || "",
          unitPrice: li.unitPrice,
          effectiveDate: inv.invoiceDate,
          category: li.category || "other",
        });
    }
  }
  inv.status = "APPROVED";
  inv.approvedBy = user.id;
  inv.approvedAt = new Date();
  await inv.save();
  await audit.record({
    type: "invoice.approve",
    result: "success",
    actorUserId: user?.id || null,
    organizationId: auth.organizationId,
    meta: { invoiceId: id },
  });
  return publicInvoice(inv);
}
async function reject(auth, user, id, reason) {
  const inv = await Invoice.findOne(applyScope(auth, { _id: id }));
  if (!inv) throw new ApiError(404, "Invoice not found");
  if (inv.status === "APPROVED")
    throw new ApiError(
      409,
      "Approved invoices require a versioned amendment, not rejection",
    );
  inv.status = "REJECTED";
  inv.rejectionReason = reason || "Rejected by reviewer";
  await inv.save();
  await audit.record({
    type: "invoice.reject",
    result: "success",
    actorUserId: user?.id || null,
    organizationId: auth.organizationId,
    meta: { invoiceId: id, reason: inv.rejectionReason },
  });
  return publicInvoice(inv);
}
async function remove(auth, user, id) {
  const invoice = await Invoice.findOne(applyScope(auth, { _id: id })).select("+storageKey");
  if (!invoice) throw new ApiError(404, "Invoice not found");
  if (invoice.status === "APPROVED") throw new ApiError(409, "Approved invoices cannot be deleted");
  const storageKey = invoice.storageKey;
  await Invoice.deleteOne({ _id: invoice._id });
  try { if (storageKey) await storage.remove(storageKey); }
  catch (err) { invoiceError("delete.storage_failed", err, { invoiceId: id }); }
  await audit.record({
    type: "invoice.delete",
    result: "success",
    actorUserId: user?.id || null,
    organizationId: auth.organizationId,
    meta: { invoiceId: id, priorStatus: invoice.status },
  });
  invoiceLog("delete.complete", { invoiceId: id, priorStatus: invoice.status });
  return { id, deleted: true };
}
module.exports = { upload, list, get, review, approve, reject, remove };
