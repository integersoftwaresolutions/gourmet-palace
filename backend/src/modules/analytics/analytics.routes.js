const { Router } = require('express');
const ApiResponse = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middlewares/auth.middleware');
const svc = require('./analytics.service');

const r = Router();
r.use(authenticate);
r.get('/dashboard', asyncHandler(async (req, res) => ApiResponse.send(res, { data: await svc.dashboard(req.auth, req.query) })));
r.get('/performance', asyncHandler(async (req, res) => ApiResponse.send(res, { data: await svc.performance(req.auth, req.query) })));
r.get('/orders', asyncHandler(async (req, res) => ApiResponse.send(res, { data: await svc.orders(req.auth, req.query) })));
r.get('/finance', asyncHandler(async (req, res) => ApiResponse.send(res, { data: await svc.finance(req.auth, req.query) })));
r.get('/forecasts', asyncHandler(async (req, res) => ApiResponse.send(res, { data: await svc.forecasts(req.auth, req.query) })));
r.get('/presence', asyncHandler(async (req, res) => ApiResponse.send(res, { data: await svc.presence(req.auth, req.query) })));
module.exports = r;
