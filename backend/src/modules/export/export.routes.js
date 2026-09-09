const { Router } = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, requireAdmin } = require('../../middlewares/auth.middleware');
const Organization = require('../../models/Organization');
const Location = require('../../models/Location');
const User = require('../../models/User');
const BusinessSetting = require('../../models/BusinessSetting');
const Order = require('../../models/Order');
const DailyMetric = require('../../models/DailyMetric');
const LocationScore = require('../../models/LocationScore');
const Baseline = require('../../models/Baseline');
const Brief = require('../../models/Brief');
const AuditEvent = require('../../models/AuditEvent');
const JobRun = require('../../models/JobRun');
const Connection = require('../../models/Connection');
const RawIngestEvent = require('../../models/RawIngestEvent');
const Invoice = require('../../models/Invoice');
const InventoryItem = require('../../models/InventoryItem');
const InventoryUpdate = require('../../models/InventoryUpdate');
const Vendor = require('../../models/Vendor');
const PriceObservation = require('../../models/PriceObservation');
const Review = require('../../models/Review');
const SeoMetric = require('../../models/SeoMetric');
const Alert = require('../../models/Alert');
const Forecast = require('../../models/Forecast');
const ChatMessage = require('../../models/ChatMessage');

const r = Router();
r.use(authenticate, requireAdmin);
r.get('/', asyncHandler(async (req, res) => {
  const org = req.auth.organizationId;
  const collections = {
    organization: await Organization.findById(org).lean(),
    locations: await Location.find({ organizationId: org }).lean(),
    users: (await User.find({ organizationId: org }).lean()).map(({ passwordHash, ...u }) => u),
    settings: await BusinessSetting.find({ organizationId: org }).lean(),
    orders: (await Order.find({ organizationId: org }).select('+rawRef').lean()).map(({ rawRef, ...o }) => ({ ...o, hasPrivateRaw: Boolean(rawRef) })),
    dailyMetrics: await DailyMetric.find({ organizationId: org }).lean(),
    locationScores: await LocationScore.find({ organizationId: org }).lean(),
    baselines: await Baseline.find({ organizationId: org }).lean(),
    briefs: await Brief.find({ organizationId: org }).lean(),
    auditEvents: await AuditEvent.find({ organizationId: org }).lean(),
    jobRuns: await JobRun.find({ organizationId: org }).lean(),
    rawIngestEvents: (await RawIngestEvent.find({ organizationId: org }).select('+rawRef').lean()).map(({ rawRef, ...row }) => ({ ...row, hasPrivateRaw: Boolean(rawRef) })),
    connections: (await Connection.find({ organizationId: org }).lean()).map(({ accessTokenEnc, refreshTokenEnc, secretRef, ...c }) => c),
    invoices: await Invoice.find({ organizationId: org }).lean(),
    inventoryItems: await InventoryItem.find({ organizationId: org }).lean(),
    inventoryUpdates: await InventoryUpdate.find({ organizationId: org }).lean(),
    vendors: await Vendor.find({ organizationId: org }).lean(),
    priceObservations: await PriceObservation.find({ organizationId: org }).lean(),
    reviews: await Review.find({ organizationId: org }).lean(),
    seoMetrics: await SeoMetric.find({ organizationId: org }).lean(),
    alerts: await Alert.find({ organizationId: org }).lean(),
    forecasts: await Forecast.find({ organizationId: org }).lean(),
    chatMessages: await ChatMessage.find({ organizationId: org }).lean(),
  };
  res.type('application/json').set('Content-Disposition', `attachment; filename="gourmet-palace-export-${new Date().toISOString().slice(0, 10)}.json"`).send(JSON.stringify({ exportedAt: new Date().toISOString(), schemaVersion: 1, ...collections }, null, 2));
}));
module.exports = r;
