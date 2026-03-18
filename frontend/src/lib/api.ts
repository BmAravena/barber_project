const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function getToken(slug?: string) {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(slug ? `homie_token_${slug}` : 'homie_super_token');
}
export function setToken(slug: string, token: string) {
  localStorage.setItem(`homie_token_${slug}`, token);
}
export function clearToken(slug: string) {
  localStorage.removeItem(`homie_token_${slug}`);
  localStorage.removeItem(`homie_barber_${slug}`);
}

async function req(method: string, path: string, body?: unknown, slug?: string, superAdmin = false) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (superAdmin) {
    const t = getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
  } else if (slug) {
    const t = getToken(slug);
    if (t) headers['Authorization'] = `Bearer ${t}`;
    headers['X-Tenant'] = slug;
  }
  const sep = path.includes('?') ? '&' : '?';
  const url = slug && !superAdmin ? `${BASE}${path}${sep}tenant_slug=${slug}` : `${BASE}${path}`;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error de servidor' }));
    throw new Error(err.detail || 'Error');
  }
  return res.json();
}

// ── Public search ──────────────────────────────────────────────
export const apiSearch       = (q: string) => req('GET', `/api/search?q=${encodeURIComponent(q)}`);
export const apiSearchNearby = (lat: number, lng: number, radius_km: number) =>
  req('GET', `/api/search/nearby?lat=${lat}&lng=${lng}&radius_km=${radius_km}`);

// ── Public tenant ──────────────────────────────────────────────
export const apiTenantInfo   = (slug: string)     => req('GET',  '/api/tenant/info',  undefined, slug);
export const apiGetBarbers   = (slug: string)     => req('GET',  '/api/barbers',       undefined, slug);
export const apiGetBarber    = (slug: string, id: string) => req('GET', `/api/barbers/${id}`, undefined, slug);
export const apiGetServices  = (slug: string, bid: string) => req('GET', `/api/barbers/${bid}/services`, undefined, slug);
export const apiGetPortfolio = (slug: string, bid: string) => req('GET', `/api/barbers/${bid}/portfolio`, undefined, slug);
export const apiAvailability = (slug: string, bid: string, date: string) =>
  req('GET', `/api/barbers/${bid}/availability?date=${date}`, undefined, slug);
export const apiBook         = (slug: string, d: unknown) => req('POST', '/api/appointments', d, slug);

// ── Barber auth ────────────────────────────────────────────────
export const apiRegister = (slug: string, d: unknown) => req('POST', '/api/auth/register', d, slug);
export const apiLogin    = (slug: string, d: unknown) => req('POST', '/api/auth/login',    d, slug);

// ── Barber dashboard ───────────────────────────────────────────
export const apiGetMe           = (slug: string) => req('GET',  '/api/barbers/me',       undefined, slug);
export const apiUpdateMe        = (slug: string, d: unknown) => req('PUT', '/api/barbers/me', d, slug);
export const apiMyServices      = (slug: string) => req('GET',  '/api/services/my',      undefined, slug);
export const apiCreateService   = (slug: string, d: unknown) => req('POST', '/api/services',    d, slug);
export const apiUpdateService   = (slug: string, id: string, d: unknown) => req('PUT',  `/api/services/${id}`, d, slug);
export const apiDeleteService   = (slug: string, id: string) => req('DELETE', `/api/services/${id}`, undefined, slug);
export const apiAddPortfolio    = (slug: string, d: unknown) => req('POST', '/api/portfolio', d, slug);
export const apiDeletePortfolio = (slug: string, id: string) => req('DELETE', `/api/portfolio/${id}`, undefined, slug);
export const apiMyAppointments  = (slug: string) => req('GET',  '/api/appointments/my',  undefined, slug);
export const apiUpdateStatus    = (slug: string, id: string, status: string) =>
  req('PUT', `/api/appointments/${id}/status`, { status }, slug);

// ── Invites ─────────────────────────────────────────────────────
export const apiCreateInvite   = (slug: string, d: unknown)      => req('POST',   '/api/invites',              d,         slug);
export const apiListInvites    = (slug: string)                   => req('GET',    '/api/invites',              undefined, slug);
export const apiDeleteInvite   = (slug: string, id: string)       => req('DELETE', `/api/invites/${id}`,        undefined, slug);
export const apiValidateInvite = (slug: string, token: string)    => req('GET',    `/api/invites/validate/${token}`, undefined, slug);

// ── Onboarding ─────────────────────────────────────────────────
export const apiOnboarding = (d: unknown) => req('POST', '/api/onboarding', d);

// ── Billing / MercadoPago ──────────────────────────────────────────────
export const apiBillingStatus    = (slug: string)              => req('GET',  '/api/billing/status',    undefined, slug);
export const apiBillingSubscribe = (slug: string, plan: string) => req('POST', '/api/billing/subscribe', { plan }, slug);
export const apiBillingCancel    = (slug: string)              => req('POST', '/api/billing/cancel',    undefined, slug);

// ── Super admin ────────────────────────────────────────────────
export const apiSuperLogin         = (d: unknown)      => req('POST',   '/api/super/login',              d,         undefined, true);
export const apiSuperListTenants   = ()                => req('GET',    '/api/super/tenants',             undefined, undefined, true);
export const apiSuperCreateTenant  = (d: unknown)      => req('POST',   '/api/super/tenants',             d,         undefined, true);
export const apiSuperUpdateTenant  = (slug: string, d: unknown) => req('PUT', `/api/super/tenants/${slug}`, d, undefined, true);
export const apiSuperDeleteTenant  = (slug: string)    => req('DELETE', `/api/super/tenants/${slug}`,     undefined, undefined, true);
export const apiSuperTenantStats   = (slug: string)    => req('GET',    `/api/super/tenants/${slug}/stats`, undefined, undefined, true);
export const apiSuperGetEmailConfig = ()               => req('GET',    '/api/super/email-config',        undefined, undefined, true);
export const apiSuperSetEmailConfig = (d: unknown)     => req('POST',   '/api/super/email-config',        d,         undefined, true);
export const apiSuperTestEmail      = (to: string)     => req('POST',   '/api/super/email-test',          { to },    undefined, true);
export const apiSuperSchedulerJobs  = ()               => req('GET',    '/api/super/scheduler/jobs',      undefined, undefined, true);
export const apiSuperGetMPConfig     = ()               => req('GET',    '/api/super/mp-config',           undefined, undefined, true);
export const apiSuperSetMPConfig     = (d: unknown)     => req('POST',   '/api/super/mp-config',           d,         undefined, true);
export const apiSuperSubscriptions   = ()               => req('GET',    '/api/super/subscriptions',       undefined, undefined, true);
