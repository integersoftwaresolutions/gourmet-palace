const API_BASE = import.meta.env.VITE_API_BASE ?? '/api/v1'

export type ApiErrorBody = {
  success: false
  message: string
  data: null
  meta: null
  errors: Array<{ field: string; message: string }> | null
}

export type ApiSuccess<T> = {
  success: true
  message: string
  data: T
  meta: unknown
  errors: null
}

export class ApiClientError extends Error {
  status: number
  errors: ApiErrorBody['errors']

  constructor(status: number, body: ApiErrorBody) {
    super(body.message || 'Request failed')
    this.name = 'ApiClientError'
    this.status = status
    this.errors = body.errors
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

export async function apiRequest<T>(
  path: string,
  { body, headers, ...init }: RequestOptions = {},
): Promise<ApiSuccess<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const json = (await res.json().catch(() => null)) as
    | ApiSuccess<T>
    | ApiErrorBody
    | null

  if (!res.ok || !json || json.success === false) {
    throw new ApiClientError(
      res.status,
      (json as ApiErrorBody) ?? {
        success: false,
        message: res.statusText || 'Request failed',
        data: null,
        meta: null,
        errors: null,
      },
    )
  }

  return json
}

export type AuthUser = {
  id: string
  organizationId: string
  name: string
  email: string
  role: string
  locationIds?: string[]
  isActive: boolean
  invitedAt?: string | null
  notificationPreferences?: { email: boolean; inApp: boolean; alerts: boolean; brief: boolean }
  createdAt?: string
  updatedAt?: string
}

export type Permissions = {
  role: string
  isAdmin: boolean
  canFinance: boolean
  allLocations: boolean
  locationIds: string[]
}

export type Location = {
  id: string
  organizationId: string
  name: string
  address: string
  timezone: string
  status: 'active' | 'inactive'
}

export type AdminUser = AuthUser & {
  locations: Array<{ id: string; name: string }>
  status: 'active' | 'invited' | 'inactive'
}

export const authApi = {
  signin: (body: { email: string; password: string }) =>
    apiRequest<{ user: AuthUser }>('/auth/signin', { method: 'POST', body }),

  signout: () =>
    apiRequest<{ signedOut: boolean }>('/auth/signout', { method: 'POST' }),

  me: () =>
    apiRequest<{ user: AuthUser; permissions: Permissions }>('/auth/me', {
      method: 'GET',
    }),

  forgotPassword: (body: { email: string }) =>
    apiRequest<{ accepted: boolean }>('/auth/forgot-password', {
      method: 'POST',
      body,
    }),

  resetPassword: (body: { token: string; newPassword: string }) =>
    apiRequest<{ reset: boolean }>('/auth/reset-password', {
      method: 'POST',
      body,
    }),

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    apiRequest<{ changed: boolean }>('/auth/change-password', {
      method: 'POST',
      body,
    }),

  updatePreferences: (body: Partial<{ email: boolean; inApp: boolean; alerts: boolean; brief: boolean }>) =>
    apiRequest<{ user: AuthUser }>('/auth/preferences', { method: 'PATCH', body }),
}

export const locationsApi = {
  list: () =>
    apiRequest<{ locations: Location[] }>('/locations', { method: 'GET' }),

  create: (body: {
    name: string
    address?: string
    timezone?: string
    status?: 'active' | 'inactive'
  }) =>
    apiRequest<{ location: Location }>('/locations', {
      method: 'POST',
      body,
    }),

  update: (
    id: string,
    body: Partial<{
      name: string
      address: string
      timezone: string
      status: 'active' | 'inactive'
    }>,
  ) =>
    apiRequest<{ location: Location }>(`/locations/${id}`, {
      method: 'PATCH',
      body,
    }),
}

export const usersApi = {
  list: () => apiRequest<{ users: AdminUser[] }>('/users', { method: 'GET' }),

  invite: (body: {
    name: string
    email: string
    role: 'admin' | 'manager'
    locationIds: string[]
  }) =>
    apiRequest<{ user: AdminUser }>('/users/invite', {
      method: 'POST',
      body,
    }),

  update: (
    id: string,
    body: Partial<{
      name: string
      role: 'admin' | 'manager'
      locationIds: string[]
      isActive: boolean
      notificationPreferences: { email: boolean; inApp: boolean; alerts: boolean; brief: boolean }
    }>,
  ) =>
    apiRequest<{ user: AdminUser }>(`/users/${id}`, {
      method: 'PATCH',
      body,
    }),
}

export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiClientError) || !err.errors) return {}
  return err.errors.reduce<Record<string, string>>((acc, item) => {
    if (item.field) acc[item.field] = item.message
    return acc
  }, {})
}

export type MoneySummary={grossMoney:number|null;netMoney:number|null;orderCount:number|null;guestCount:number|null;averageTicket:number|null;refundMoney:number|null;voidMoney:number|null;discountMoney:number|null}
export type AnalyticsSummary={range:{from:string;to:string;label:string};current:MoneySummary;comparison:{grossPct:number|null;netSalesPct:number|null;ordersPct:number|null;guestsPct:number|null;averageTicketPct:number|null;refundsPct:number|null;previousRange:{from:string;to:string}};dataStatus:'COMPLETE'|'PARTIAL'|'STALE'|'UNAVAILABLE';coverage:number;freshnessAt:string|null}
export type DashboardPriority={ref:string;type:string;severity:'info'|'warning'|'critical';title:string;detail:string;locationId?:string|null;locationName?:string|null;evidence:unknown[];nextAction:string}
export type DashboardLocationSnapshot={locationId:string;name:string;score:number|null;rank:number|null}
export type DashboardSignals={exceptions:{refundMoney:number|null;voidMoney:number|null;discountMoney:number|null;status:'COMPLETE'|'UNAVAILABLE'}}
export type DashboardDataQuality={locationId:string;locationName:string;metric:'source'|'guestCount';status:'COMPLETE'|'PARTIAL'|'STALE'|'UNAVAILABLE';message:string}
export type DashboardData=AnalyticsSummary&{headline:string;businessHealth:number|null;businessHealthCoverage:number;businessHealthComparison:{businessDate:string|null;score:number|null;change:number|null};businessHealthScoreVersion:number;bestLocation:DashboardLocationSnapshot|null;weakestLocation:DashboardLocationSnapshot|null;scores:Array<{_id:string;scoreVersion:number;score:number|null;rank:number;coverage:number;netSales:number;components:Record<string,number|null>;weights:Record<string,number>;comparison:Record<string,number|null>;locationId:{_id:string;name:string}|string}>;priorities:DashboardPriority[];dataQuality:DashboardDataQuality[];signals:DashboardSignals}
export type PerformanceItem={name:string;units:number;revenue:number;category?:string;changePct:number|null}
export type PerformanceData=AnalyticsSummary&{channels:Record<string,number>;topItems:PerformanceItem[];slowItems:PerformanceItem[];categories:Array<{name:string;revenue:number}>;locationComparisons:Array<{locationId:string;locationName:string;grossMoney:number;netMoney:number;orderCount:number;guestCount:number|null;refundMoney:number;averageTicket:number|null;netSalesPct:number|null;ordersPct:number|null;coverage:number}>;locationScores:Array<{_id:string;score:number|null;rank:number;coverage:number;netSales:number;locationId:{_id:string;name:string}|string;comparison?:Record<string,number|null>}>;summaryLine:string;summaryMode:'AI'|'DETERMINISTIC_FALLBACK';sourceProviders:string[];guestSource:'toast'|'square'|'mixed'|'unavailable'|string;peerComparison:{grossPct:number|null;netSalesPct:number|null;ordersPct:number|null;averageTicketPct:number|null;guestsPct:number|null;refundsPct:number|null;peerCount:number}|null;dayparts:Array<{label:string;netMoney:number}>;daypartStatus:'COMPLETE'|'PARTIAL'|'UNAVAILABLE'}
export type OrderRecord={_id:string;locationId:{_id:string;name:string}|string;provider:'square'|'toast';providerOrderId:string;orderState:'COMPLETED'|'CANCELED';businessDate:string;sourceTimestamp?:string;currency:string;grossMoney:number;netMoney:number;refundMoney:number;voidMoney:number;discountMoney:number;guestCount:number|null;channel:string;items:Array<{providerItemId?:string;name:string;category?:string;quantity:number;grossMoney:number;netMoney:number}>;status:'COMPLETE'|'PARTIAL'}
export type FinanceData=AnalyticsSummary&{estimatedProfitAtSelectedMargin:number|null;selectedMargin:number;storeRankings:Array<{locationId:string;locationName:string;rank:number;netMoney:number;estimatedProfit:number;selectedMargin:number;days:number}>;dailyTrend:Array<{businessDate:string;netMoney:number;estimatedProfit:number}>;periodSummaries:Record<'daily'|'weekly'|'wtd'|'mtd',{range:{from:string;to:string;label:string};current:MoneySummary;comparison:{netSalesPct:number|null;ordersPct:number|null;previousRange:{from:string;to:string}};dataStatus:string;coverage:number}>}
export type ConnectionRecord={_id:string;provider:'square'|'toast';status:'READY'|'PARTIAL'|'UNAVAILABLE'|'ERROR';capabilities:Record<string,boolean>;mappings:Record<string,unknown>;metadata:Record<string,unknown>;lastSuccessAt?:string|null;lastError?:string|null;scopes:string[]}
export type BriefRecord={_id:string;businessDate:string;revision:number;isCurrent:boolean;status:'COMPLETE'|'PARTIAL'|'FAILED';publishedAt:string;content:Record<string,unknown>;emailStatus?:string}
function qs(query:Record<string,string|number|undefined|null>={}){const p=new URLSearchParams();for(const[k,v]of Object.entries(query))if(v!==undefined&&v!==null&&v!=='')p.set(k,String(v));const s=p.toString();return s?`?${s}`:''}
export const analyticsApi={dashboard:(query:Record<string,string>)=>apiRequest<DashboardData>(`/analytics/dashboard${qs(query)}`),performance:(query:Record<string,string>)=>apiRequest<PerformanceData>(`/analytics/performance${qs(query)}`),orders:(query:Record<string,string>)=>apiRequest<{range:{from:string;to:string};page:number;limit:number;total:number;orders:OrderRecord[]}>(`/analytics/orders${qs(query)}`),finance:(query:Record<string,string>)=>apiRequest<FinanceData>(`/analytics/finance${qs(query)}`)}
export const briefsApi={list:(query:Record<string,string>={})=>apiRequest<{briefs:BriefRecord[]}>(`/briefs${qs(query)}`),current:(query:Record<string,string>={})=>apiRequest<{brief:BriefRecord|null}>(`/briefs/current${qs(query)}`),generate:(businessDate:string)=>apiRequest<{brief:BriefRecord}>('/briefs/generate',{method:'POST',body:{businessDate}})}
export const integrationsApi={list:()=>apiRequest<{connections:ConnectionRecord[]}>('/integrations'),connect:(provider:'square')=>apiRequest<{url:string}>(`/integrations/${provider}/connect`,{method:'POST'}),discover:(provider:'square')=>apiRequest<{connection:ConnectionRecord}>(`/integrations/${provider}/discover`,{method:'POST'}),setMappings:(provider:string,mappings:Record<string,unknown>)=>apiRequest<{connection:ConnectionRecord}>(`/integrations/${provider}/mappings`,{method:'PUT',body:{mappings}}),squareSync:(locationId:string,businessDate:string)=>apiRequest<Record<string,unknown>>('/integrations/square/sync',{method:'POST',body:{locationId,businessDate}}),squareBackfill:(locationId:string,from:string,to:string)=>apiRequest<{from:string;to:string;days:number;complete:number;partial:number;failed:number;resumable:boolean;results:Array<Record<string,unknown>>}>('/integrations/square/backfill',{method:'POST',body:{locationId,from,to}}),toastImport:(body:Record<string,unknown>)=>apiRequest<Record<string,unknown>>('/integrations/toast/import',{method:'POST',body})}
export const settingsApi={list:()=>apiRequest<{defaults:Record<string,unknown>;history:Array<Record<string,unknown>>}>('/settings'),set:(body:Record<string,unknown>)=>apiRequest<{setting:Record<string,unknown>}>('/settings',{method:'POST',body})}
export const systemApi={health:()=>apiRequest<{connections:ConnectionRecord[];jobs:Array<Record<string,unknown>>;audit:Array<Record<string,unknown>>;reconciliation:Array<Record<string,unknown>>;server:Record<string,unknown>}>('/system/health'),rerun:(body:{source:string;locationId:string;businessDate:string})=>apiRequest<{result:unknown}>('/system/rerun',{method:'POST',body}),exportUrl:`${API_BASE}/export`}
