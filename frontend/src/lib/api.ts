const API_BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

export type ApiErrorBody = {
  success: false;
  message: string;
  data: null;
  meta: null;
  errors: Array<{ field: string; message: string }> | null;
};

export type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
  meta: unknown;
  errors: null;
};

export class ApiClientError extends Error {
  status: number;
  errors: ApiErrorBody["errors"];

  constructor(status: number, body: ApiErrorBody) {
    super(body.message || "Request failed");
    this.name = "ApiClientError";
    this.status = status;
    this.errors = body.errors;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export async function apiRequest<T>(
  path: string,
  { body, headers, ...init }: RequestOptions = {},
): Promise<ApiSuccess<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json().catch(() => null)) as
    | ApiSuccess<T>
    | ApiErrorBody
    | null;

  if (!res.ok || !json || json.success === false) {
    throw new ApiClientError(
      res.status,
      (json as ApiErrorBody) ?? {
        success: false,
        message: res.statusText || "Request failed",
        data: null,
        meta: null,
        errors: null,
      },
    );
  }

  return json;
}

export type AuthUser = {
  id: string;
  organizationId: string | null;
  name: string;
  email: string;
  role: string;
  locationIds?: string[];
  isActive: boolean;
  emailVerified: boolean;
  onboardingComplete: boolean;
  emailVerifiedAt?: string | null;
  onboardingCompletedAt?: string | null;
  invitedAt?: string | null;
  notificationPreferences?: {
    email: boolean;
    inApp: boolean;
    alerts: boolean;
    brief: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type Permissions = {
  role: string;
  isAdmin: boolean;
  canFinance: boolean;
  allLocations: boolean;
  locationIds: string[];
};

export type Location = {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  timezone: string;
  status: "active" | "inactive";
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
};

export type AdminUser = AuthUser & {
  locations: Array<{ id: string; name: string }>;
  status: "active" | "invited" | "inactive";
};

export const authApi = {
  register: (body: { name: string; email: string; password: string }) =>
    apiRequest<{ registered: boolean; email: string }>("/auth/register", {
      method: "POST",
      body,
    }),

  verifyEmail: (body: { token: string }) =>
    apiRequest<{ verified: boolean }>("/auth/verify-email", {
      method: "POST",
      body,
    }),

  resendVerification: (body: { email: string }) =>
    apiRequest<{ accepted: boolean }>("/auth/resend-verification", {
      method: "POST",
      body,
    }),

  signin: (body: { email: string; password: string }) =>
    apiRequest<{ user: AuthUser; next: string }>("/auth/signin", {
      method: "POST",
      body,
    }),

  signout: () =>
    apiRequest<{ signedOut: boolean }>("/auth/signout", { method: "POST" }),

  me: () =>
    apiRequest<{ user: AuthUser; permissions: Permissions | null }>("/auth/me", {
      method: "GET",
    }),

  completeOnboarding: (body: {
    organizationName: string;
    locationName: string;
    locationAddress: string;
    timezone: string;
  }) =>
    apiRequest<{
      completed: boolean;
      user: AuthUser;
      organization: Organization;
      location: Location;
    }>("/auth/onboarding", {
      method: "POST",
      body,
    }),

  forgotPassword: (body: { email: string }) =>
    apiRequest<{ accepted: boolean }>("/auth/forgot-password", {
      method: "POST",
      body,
    }),

  resetPassword: (body: { token: string; newPassword: string }) =>
    apiRequest<{ reset: boolean }>("/auth/reset-password", {
      method: "POST",
      body,
    }),

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    apiRequest<{ changed: boolean }>("/auth/change-password", {
      method: "POST",
      body,
    }),

  updatePreferences: (
    body: Partial<{
      email: boolean;
      inApp: boolean;
      alerts: boolean;
      brief: boolean;
    }>,
  ) =>
    apiRequest<{ user: AuthUser }>("/auth/preferences", {
      method: "PATCH",
      body,
    }),
};

export const locationsApi = {
  list: () =>
    apiRequest<{ locations: Location[] }>("/locations", { method: "GET" }),

  create: (body: {
    name: string;
    address?: string;
    timezone?: string;
    status?: "active" | "inactive";
  }) =>
    apiRequest<{ location: Location }>("/locations", {
      method: "POST",
      body,
    }),

  update: (
    id: string,
    body: Partial<{
      name: string;
      address: string;
      timezone: string;
      status: "active" | "inactive";
    }>,
  ) =>
    apiRequest<{ location: Location }>(`/locations/${id}`, {
      method: "PATCH",
      body,
    }),
};

export const usersApi = {
  list: () => apiRequest<{ users: AdminUser[] }>("/users", { method: "GET" }),

  invite: (body: {
    name: string;
    email: string;
    role: "admin" | "manager";
    locationIds: string[];
  }) =>
    apiRequest<{ user: AdminUser }>("/users/invite", {
      method: "POST",
      body,
    }),

  update: (
    id: string,
    body: Partial<{
      name: string;
      role: "admin" | "manager";
      locationIds: string[];
      isActive: boolean;
      notificationPreferences: {
        email: boolean;
        inApp: boolean;
        alerts: boolean;
        brief: boolean;
      };
    }>,
  ) =>
    apiRequest<{ user: AdminUser }>(`/users/${id}`, {
      method: "PATCH",
      body,
    }),
};

export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiClientError) || !err.errors) return {};
  return err.errors.reduce<Record<string, string>>((acc, item) => {
    if (item.field) acc[item.field] = item.message;
    return acc;
  }, {});
}

export type MoneySummary = {
  grossMoney: number | null;
  netMoney: number | null;
  orderCount: number | null;
  guestCount: number | null;
  averageTicket: number | null;
  refundMoney: number | null;
  voidMoney: number | null;
  discountMoney: number | null;
};
export type AnalyticsSummary = {
  range: { from: string; to: string; label: string };
  current: MoneySummary;
  comparison: {
    grossPct: number | null;
    netSalesPct: number | null;
    ordersPct: number | null;
    guestsPct: number | null;
    averageTicketPct: number | null;
    refundsPct: number | null;
    voidsPct: number | null;
    discountsPct: number | null;
    previousRange: { from: string; to: string };
  };
  dataStatus: "COMPLETE" | "PARTIAL" | "STALE" | "UNAVAILABLE";
  coverage: number;
  freshnessAt: string | null;
};
export type DashboardPriority = {
  ref: string;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  locationId?: string | null;
  locationName?: string | null;
  evidence: unknown[];
  nextAction: string;
  delta?: number;
};
export type DashboardLocationSnapshot = {
  locationId: string;
  name: string;
  score: number | null;
  rank: number | null;
};
export type DashboardSignals = {
  exceptions: {
    refundMoney: number | null;
    voidMoney: number | null;
    discountMoney: number | null;
    status: "COMPLETE" | "UNAVAILABLE";
  };
  reviews: {
    urgentCount: number;
    draftCount: number;
    approvedCount: number;
    status: "COMPLETE" | "WARNING";
  };
  forecast: {
    weekStart: string;
    expectedMoney: number | null;
    status: "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
    coverage: number;
  };
};
export type DashboardDataQuality = {
  locationId: string;
  locationName: string;
  metric: "source" | "guestCount";
  status: "COMPLETE" | "PARTIAL" | "STALE" | "UNAVAILABLE";
  message: string;
};
export type DashboardData = AnalyticsSummary & {
  headline: string;
  businessHealth: number | null;
  businessHealthCoverage: number;
  businessHealthComparison: {
    businessDate: string | null;
    score: number | null;
    change: number | null;
  };
  businessHealthScoreVersion: number;
  bestLocation: DashboardLocationSnapshot | null;
  weakestLocation: DashboardLocationSnapshot | null;
  scores: Array<{
    _id: string;
    scoreVersion: number;
    score: number | null;
    rank: number;
    coverage: number;
    netSales: number;
    components: Record<string, number | null>;
    weights: Record<string, number>;
    comparison: Record<string, number | null>;
    locationId: { _id: string; name: string } | string;
  }>;
  alerts: AlertRecord[];
  priorities: DashboardPriority[];
  dataQuality: DashboardDataQuality[];
  workflow: { reviewDrafts: number; reviewRepliesApproved: number };
  signals: DashboardSignals;
};
export type PerformanceItem = {
  name: string;
  units: number;
  revenue: number;
  category?: string;
  changePct: number | null;
};
export type ExceptionCluster = {
  kind: "refunds" | "voids" | "discounts";
  locationId: string;
  locationName: string;
  channel: string;
  daypart: string | null;
  orderCount: number;
  money: number;
};
export type PerformanceData = AnalyticsSummary & {
  channels: Record<string, number>;
  topItems: PerformanceItem[];
  slowItems: PerformanceItem[];
  categories: Array<{ name: string; revenue: number }>;
  locationComparisons: Array<{
    locationId: string;
    locationName: string;
    grossMoney: number;
    netMoney: number;
    orderCount: number;
    guestCount: number | null;
    refundMoney: number;
    voidMoney: number;
    discountMoney: number;
    averageTicket: number | null;
    netSalesPct: number | null;
    ordersPct: number | null;
    coverage: number;
  }>;
  locationScores: Array<{
    _id: string;
    score: number | null;
    rank: number;
    coverage: number;
    netSales: number;
    locationId: { _id: string; name: string } | string;
    comparison?: Record<string, number | null>;
  }>;
  summaryLine: string;
  summaryMode: "AI" | "DETERMINISTIC_FALLBACK";
  sourceProviders: string[];
  guestSource: "toast" | "square" | "mixed" | "unavailable" | string;
  peerComparison: {
    grossPct: number | null;
    netSalesPct: number | null;
    ordersPct: number | null;
    averageTicketPct: number | null;
    guestsPct: number | null;
    refundsPct: number | null;
    peerCount: number;
  } | null;
  dayparts: Array<{ label: string; netMoney: number }>;
  daypartStatus: "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
  exceptionClusters: ExceptionCluster[];
};
export type OrderRecord = {
  _id: string;
  locationId: { _id: string; name: string } | string;
  provider: "square" | "toast";
  providerOrderId: string;
  orderState: "COMPLETED" | "CANCELED";
  businessDate: string;
  sourceTimestamp?: string;
  currency: string;
  grossMoney: number;
  netMoney: number;
  refundMoney: number;
  voidMoney: number;
  discountMoney: number;
  guestCount: number | null;
  channel: string;
  items: Array<{
    providerItemId?: string;
    name: string;
    category?: string;
    quantity: number;
    grossMoney: number;
    netMoney: number;
  }>;
  status: "COMPLETE" | "PARTIAL";
};
export type FinanceData = AnalyticsSummary & {
  approvedFoodPurchases: number;
  foodCostPercent: number | null;
  foodCostTarget: { min: number; max: number } | null;
  estimatedProfitAtSelectedMargin: number | null;
  selectedMargin: number;
  invoiceCoverage: { approved: number; label: string };
  storeRankings: Array<{
    locationId: string;
    locationName: string;
    rank: number;
    netMoney: number;
    estimatedProfit: number;
    selectedMargin: number;
    days: number;
  }>;
  dailyTrend: Array<{
    businessDate: string;
    netMoney: number;
    estimatedProfit: number;
  }>;
  periodSummaries: Record<
    "daily" | "weekly" | "wtd" | "mtd",
    {
      range: { from: string; to: string; label: string };
      current: MoneySummary;
      comparison: {
        netSalesPct: number | null;
        ordersPct: number | null;
        previousRange: { from: string; to: string };
      };
      dataStatus: string;
      coverage: number;
    }
  >;
  sourceProviders: string[];
  locationScoreOrder: Array<{
    locationId: string;
    locationName: string;
    initials: string;
    rank: number | null;
    score: number | null;
  }>;
};
export type InventoryItemRecord = {
  _id?: string;
  id?: string;
  locationId: string;
  name: string;
  unit: string;
  currentQuantity: number;
  parLevel: number;
  ingredientCost: number;
  averageDailyUsage: number | null;
  usageEstimate: number | null;
  usageSource: "manual" | "manual_history" | "unavailable";
  lastCountAt: string | null;
  lastCountBy?: { name: string } | string | null;
  vendorId?: { _id: string; name: string } | string | null;
  daysRemaining: number | null;
  stale: boolean;
  stockStatus: "ok" | "low" | "critical";
  status: "active" | "inactive";
};
export type InvoiceLine = {
  _id?: string;
  sourceDescription?: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalMoney: number | null;
  category: string | null;
  confidence?: number | null;
  page?: number | null;
  mappingReused?: boolean;
};
export type InvoiceAdjustment = { _id?: string; label: string; type: string; amountMoney: number; confidence?: number | null; page?: number | null };
export type InvoiceRecord = {
  _id: string;
  locationId: string;
  vendorId?: { _id: string; name: string } | string | null;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  subtotalMoney: number | null;
  taxMoney: number | null;
  totalMoney: number | null;
  status:
    | "RECEIVED"
    | "PROCESSING"
    | "PENDING_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | "FAILED";
  duplicateCandidateIds: string[];
  duplicateDisposition: string;
  ocrFields: Record<string, unknown>;
  lineItems: InvoiceLine[];
  adjustments: InvoiceAdjustment[];
  highRiskConfirmed: boolean;
  originalName: string;
  mimeType: string;
  sourceUrl?: string;
  approvedAt?: string;
};
export type AlertRecord = {
  _id: string;
  locationId?: string | { _id: string; name: string } | null;
  type: string;
  severity: "info" | "warning" | "critical";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
  title: string;
  detail: string;
  actual?: unknown;
  normal?: unknown;
  threshold?: unknown;
  delta?: number;
  evidence?: unknown[];
  assigneeUserId?: { _id: string; name: string; email: string } | null;
  notes: Array<{ text: string; createdAt: string }>;
  createdAt: string;
  occurrenceCount: number;
};
export type ConnectionRecord = {
  _id: string;
  provider: "square" | "google" | "toast";
  status: "READY" | "PARTIAL" | "UNAVAILABLE" | "ERROR";
  capabilities: Record<string, boolean>;
  mappings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  lastSuccessAt?: string | null;
  lastError?: string | null;
  scopes: string[];
};
export type ReviewRecord = {
  _id: string;
  locationId: string;
  rating: number;
  text: string;
  reviewerName: string;
  reviewedAt: string;
  sourceUrl?: string;
  replyText?: string;
  replyStatus: "none" | "draft" | "approved" | "posted" | "failed";
  approvedText?: string;
};
export type BriefRecord = {
  _id: string;
  businessDate: string;
  revision: number;
  isCurrent: boolean;
  status: "COMPLETE" | "PARTIAL" | "FAILED";
  publishedAt: string;
  content: Record<string, unknown>;
  emailStatus?: string;
};
export type PresenceSummary = {
  ga4: {
    sessions: number | null;
    keyEvents: number | null;
    totalUsersSum: number | null;
    status: string;
    sessionsPct: number | null;
  };
  gsc: {
    clicks: number | null;
    impressions: number | null;
    ctr: number | null;
    position: number | null;
    status: string;
    clicksPct: number | null;
    queriesPagesStatus: string;
  };
  gbp: {
    websiteClicks: number | null;
    callClicks: number | null;
    directionRequests: number | null;
    impressions: number | null;
    status: string;
    websiteClicksPct: number | null;
  };
  squareDirect: {
    orders: number | null;
    revenue: number | null;
    mappingApproved: boolean;
    status: string;
    revenuePct: number | null;
  };
  freshnessAt: string | null;
  locations: number;
};
export type PresenceLocationRow = {
  locationId: string;
  locationName: string;
  ga4Sessions: number | null;
  gscClicks: number | null;
  directRevenue: number | null;
  gbpClicks: number | null;
};
export type PresenceData = {
  range: { from: string; to: string };
  previousRange: { from: string; to: string };
  seo: Array<Record<string, unknown>>;
  reviews: ReviewRecord[];
  recommendations: Array<{
    source: string;
    metric: string;
    period: { from: string; to: string };
    confidence: string;
    evidence: Record<string, unknown>;
    recommendation: string;
  }>;
  summary: PresenceSummary;
  locations: PresenceLocationRow[];
};
export type ReportVendor = {
  vendorId: string | null;
  vendorName: string;
  totalMoney: number;
  invoiceCount: number;
};
export type ReportScorecard = {
  businessDate: string;
  score: number | null;
  rank: number | null;
  coverage: number;
  netSales?: number;
  locationId: { _id: string; name: string } | string;
};
export type ReportData = {
  range: { from: string; to: string; label?: string };
  generatedAt: string;
  brief: BriefRecord | null;
  performance: PerformanceData;
  finance: FinanceData;
  scorecards: ReportScorecard[];
  invoices: {
    count: number;
    total: number;
    categorySpend: Record<string, number>;
    vendorSpend: Record<string, number>;
    vendors: ReportVendor[];
    rows: InvoiceRecord[];
  };
  priceChanges: Array<{
    description: string;
    vendorId?: string;
    unit?: string;
    previousUnitPrice: number;
    unitPrice: number;
    changePct: number;
    effectiveDate: string;
  }>;
  inventory: InventoryItemRecord[];
  inventorySummary: { count: number; stale: number; low: number };
  reviews: ReviewRecord[];
  reviewSummary: {
    count: number;
    averageRating: number | null;
    urgent: number;
  };
  seoSummary: PresenceSummary;
  alerts: AlertRecord[];
  alertSummary: {
    total: number;
    open: number;
    acknowledged: number;
    critical: number;
  };
  forecasts: ForecastRow[];
};
function qs(query: Record<string, string | number | undefined | null> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query))
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}
export type ForecastStatus = "COMPLETE" | "PROVISIONAL" | "UNAVAILABLE";
export type ForecastDay = {
  businessDate: string;
  weekday: number;
  expectedMoney: number | null;
  lowMoney: number | null;
  highMoney: number | null;
  comparableCount: number;
  status: ForecastStatus;
};
export type ForecastRow = {
  _id?: string;
  locationId: { _id: string; name: string } | string;
  weekStart: string;
  expectedMoney: number | null;
  lowMoney: number | null;
  highMoney: number | null;
  coverage: number;
  status: ForecastStatus;
  formulaVersion?: number;
  comparisonDates?: string[];
  days?: ForecastDay[];
};
export type ForecastLocation = {
  locationId: string;
  locationName: string;
  expectedMoney: number | null;
  lowMoney: number | null;
  highMoney: number | null;
  coverage: number;
  status: ForecastStatus;
};
export type ForecastThisWeek = {
  weekStart: string;
  expectedMoney: number | null;
  lowMoney: number | null;
  highMoney: number | null;
  coverage: number;
  status: ForecastStatus;
  formulaVersion: number;
  comparableTarget: number;
  provisionalMin: number;
  comparisonDates: string[];
  days: ForecastDay[];
  locationCount: number;
  locations: ForecastLocation[];
};
export type ForecastsData = {
  forecasts: ForecastRow[];
  thisWeek: ForecastThisWeek;
};
export const analyticsApi = {
  dashboard: (query: Record<string, string>) =>
    apiRequest<DashboardData>(`/analytics/dashboard${qs(query)}`),
  performance: (query: Record<string, string>) =>
    apiRequest<PerformanceData>(`/analytics/performance${qs(query)}`),
  orders: (query: Record<string, string>) =>
    apiRequest<{
      range: { from: string; to: string };
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
      orders: OrderRecord[];
    }>(`/analytics/orders${qs(query)}`),
  finance: (query: Record<string, string>) =>
    apiRequest<FinanceData>(`/analytics/finance${qs(query)}`),
  forecasts: (query: Record<string, string>) =>
    apiRequest<ForecastsData>(`/analytics/forecasts${qs(query)}`),
  presence: (query: Record<string, string>) =>
    apiRequest<PresenceData>(`/analytics/presence${qs(query)}`),
};
export const inventoryApi = {
  list: (query: Record<string, string>) =>
    apiRequest<{ items: InventoryItemRecord[] }>(`/inventory${qs(query)}`),
  create: (body: Record<string, unknown>) =>
    apiRequest<{ item: InventoryItemRecord }>("/inventory", {
      method: "POST",
      body,
    }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<{ item: InventoryItemRecord }>(`/inventory/${id}`, {
      method: "PATCH",
      body,
    }),
  count: (id: string, body: Record<string, unknown>) =>
    apiRequest<{ item: InventoryItemRecord }>(`/inventory/${id}/count`, {
      method: "POST",
      body,
    }),
  bulkCount: (items: Array<Record<string, unknown>>) =>
    apiRequest<{ items: InventoryItemRecord[] }>("/inventory/bulk-count", {
      method: "POST",
      body: { items },
    }),
  copyPrevious: (locationId: string) =>
    apiRequest<{
      items: Array<{
        itemId: string;
        name: string;
        unit: string;
        quantity: number;
      }>;
    }>("/inventory/copy-previous", { method: "POST", body: { locationId } }),
  history: (id: string) =>
    apiRequest<{ history: Array<Record<string, unknown>> }>(
      `/inventory/${id}/history`,
    ),
  exportCsv: (query: Record<string, string>) =>
    apiRequest<{ csv: string }>(`/inventory/csv-export${qs(query)}`),
  importCsv: (locationId: string, csv: string) =>
    apiRequest<{
      created: number;
      updated: number;
      errors: Array<{ row: number; message: string }>;
    }>("/inventory/csv-import", { method: "POST", body: { locationId, csv } }),
};
export const invoicesApi = {
  list: (query: Record<string, string>) =>
    apiRequest<{ invoices: InvoiceRecord[] }>(`/invoices${qs(query)}`),
  get: (id: string) =>
    apiRequest<{ invoice: InvoiceRecord }>(`/invoices/${id}`),
  upload: (body: {
    locationId: string;
    fileName: string;
    mimeType: string;
    base64: string;
  }) =>
    apiRequest<{ invoice: InvoiceRecord }>("/invoices", {
      method: "POST",
      body,
    }),
  review: (id: string, body: Record<string, unknown>) =>
    apiRequest<{ invoice: InvoiceRecord }>(`/invoices/${id}/review`, {
      method: "PATCH",
      body,
    }),
  approve: (id: string) =>
    apiRequest<{ invoice: InvoiceRecord }>(`/invoices/${id}/approve`, {
      method: "POST",
    }),
  reject: (id: string, reason: string) =>
    apiRequest<{ invoice: InvoiceRecord }>(`/invoices/${id}/reject`, {
      method: "POST",
      body: { reason },
    }),
  remove: (id: string) =>
    apiRequest<{ id: string; deleted: boolean }>(`/invoices/${id}`, { method: "DELETE" }),
};
export const vendorsApi = {
  list: (query: Record<string, string>) =>
    apiRequest<{
      range: { from: string; to: string };
      vendors: Array<Record<string, unknown>>;
    }>(`/vendors${qs(query)}`),
  get: (id: string, query: Record<string, string>) =>
    apiRequest<{
      range: { from: string; to: string };
      vendor: Record<string, unknown>;
      summary: Record<string, unknown>;
      invoices: InvoiceRecord[];
      purchasedItems: Array<Record<string, unknown>>;
      prices: Array<Record<string, unknown>>;
      priceChanges: Array<Record<string, unknown>>;
      comparisons: Array<Record<string, unknown>>;
      locationNames: Record<string, string>;
    }>(`/vendors/${id}${qs(query)}`),
};
export const alertsApi = {
  list: (query: Record<string, string>) =>
    apiRequest<{ alerts: AlertRecord[] }>(`/alerts${qs(query)}`),
  action: (id: string, body: Record<string, unknown>) =>
    apiRequest<{ alert: AlertRecord }>(`/alerts/${id}`, {
      method: "PATCH",
      body,
    }),
};
export const briefsApi = {
  list: (query: Record<string, string> = {}) =>
    apiRequest<{ briefs: BriefRecord[] }>(`/briefs${qs(query)}`),
  current: (query: Record<string, string> = {}) =>
    apiRequest<{ brief: BriefRecord | null }>(`/briefs/current${qs(query)}`),
  generate: (businessDate: string) =>
    apiRequest<{ brief: BriefRecord }>("/briefs/generate", {
      method: "POST",
      body: { businessDate },
    }),
};
export const reportsApi = {
  get: (query: Record<string, string>) =>
    apiRequest<{ report: ReportData }>(`/reports${qs(query)}`),
  csvUrl: (query: Record<string, string>) =>
    `${API_BASE}/reports/csv${qs(query)}`,
};
export const integrationsApi = {
  list: () => apiRequest<{ connections: ConnectionRecord[] }>("/integrations"),
  connect: (provider: "square" | "google") =>
    apiRequest<{ url: string }>(`/integrations/${provider}/connect`, {
      method: "POST",
    }),
  discover: (provider: "square" | "google") =>
    apiRequest<{ connection: ConnectionRecord }>(
      `/integrations/${provider}/discover`,
      { method: "POST" },
    ),
  setMappings: (provider: string, mappings: Record<string, unknown>) =>
    apiRequest<{ connection: ConnectionRecord }>(
      `/integrations/${provider}/mappings`,
      { method: "PUT", body: { mappings } },
    ),
  syncNow: (locationId: string) =>
    apiRequest<{
      locationId: string;
      businessDate: string;
      status: "COMPLETE" | "PARTIAL" | "FAILED" | "UNAVAILABLE";
      sources: Record<string, { status: string; error?: string; message?: string; result?: Record<string, unknown> }>;
      errors: Record<string, string>;
    }>("/integrations/sync-now", { method: "POST", body: { locationId } }),
  squareSync: (locationId: string, businessDate: string) =>
    apiRequest<Record<string, unknown>>("/integrations/square/sync", {
      method: "POST",
      body: { locationId, businessDate },
    }),
  squareBackfill: (locationId: string, from: string, to: string) =>
    apiRequest<{
      from: string;
      to: string;
      days: number;
      complete: number;
      partial: number;
      failed: number;
      resumable: boolean;
      results: Array<Record<string, unknown>>;
    }>("/integrations/square/backfill", {
      method: "POST",
      body: { locationId, from, to },
    }),
  googleSync: (locationId: string) =>
    apiRequest<{
      range: { from: string; to: string };
      errors: Record<string, string>;
      sources: Record<
        string,
        {
          status: string;
          daysImported?: number;
          reviewsImported?: number;
          pages?: number;
        }
      >;
    }>("/integrations/google/sync", { method: "POST", body: { locationId } }),
  googleBackfill: (locationId: string, from: string, to: string) =>
    apiRequest<{
      range: { from: string; to: string };
      errors: Record<string, string>;
      sources: Record<string, { status: string; daysImported?: number }>;
    }>("/integrations/google/backfill", {
      method: "POST",
      body: { locationId, from, to },
    }),
  toastImport: (body: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>("/integrations/toast/import", {
      method: "POST",
      body,
    }),
};
export const reviewsApi = {
  list: (query: Record<string, string>) =>
    apiRequest<{
      reviews: ReviewRecord[];
      summary: {
        count: number;
        averageRating: number | null;
        urgentCount: number;
        themes: Array<{ theme: string; count: number }>;
        ratingMovement: number | null;
        sampleQualification: string;
        range: { from: string; to: string };
        previousRange: { from: string; to: string };
      };
    }>(`/reviews${qs(query)}`),
  draftAi: (id: string) =>
    apiRequest<{ review: ReviewRecord }>(`/reviews/${id}/draft-ai`, {
      method: "POST",
    }),
  draft: (id: string, text: string) =>
    apiRequest<{ review: ReviewRecord }>(`/reviews/${id}/draft`, {
      method: "PATCH",
      body: { text },
    }),
  approve: (id: string) =>
    apiRequest<{ review: ReviewRecord }>(`/reviews/${id}/approve`, {
      method: "POST",
    }),
  post: (id: string) =>
    apiRequest<{ review: ReviewRecord }>(`/reviews/${id}/post`, {
      method: "POST",
    }),
};
export const chatApi = {
  ask: (body: {
    question: string;
    sessionId?: string;
    scope?: Record<string, string>;
  }) =>
    apiRequest<{
      sessionId: string;
      message: { _id: string; content: string; evidence: unknown[] };
      toolFamily: string;
      evidence: unknown[];
      dataStatus: string | null;
    }>("/chat/ask", { method: "POST", body }),
  history: (sessionId?: string) =>
    apiRequest<{ messages: Array<Record<string, unknown>> }>(
      `/chat/history${qs({ sessionId })}`,
    ),
  feedback: (id: string, feedback: "up" | "down" | "") =>
    apiRequest<{ message: Record<string, unknown> }>(
      `/chat/messages/${id}/feedback`,
      { method: "PATCH", body: { feedback } },
    ),
};
export const settingsApi = {
  list: () =>
    apiRequest<{
      defaults: Record<string, unknown>;
      history: Array<Record<string, unknown>>;
    }>("/settings"),
  set: (body: Record<string, unknown>) =>
    apiRequest<{ setting: Record<string, unknown> }>("/settings", {
      method: "POST",
      body,
    }),
};
export const systemApi = {
  health: () =>
    apiRequest<{
      connections: ConnectionRecord[];
      jobs: Array<Record<string, unknown>>;
      audit: Array<Record<string, unknown>>;
      reconciliation: Array<Record<string, unknown>>;
      server: Record<string, unknown>;
    }>("/system/health"),
  rerun: (body: { source: string; locationId: string; businessDate: string }) =>
    apiRequest<{ result: unknown }>("/system/rerun", { method: "POST", body }),
  exportUrl: `${API_BASE}/export`,
};
