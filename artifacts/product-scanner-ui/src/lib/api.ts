export interface User {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface ProductInfo {
  found: boolean;
  message?: string;
  name?: string;
  name_en?: string;
  brand?: string;
  category?: string;
  category_emoji?: string;
  description?: string;
  features?: string[];
  price_estimate?: string;
  confidence?: "high" | "medium" | "low";
  notes?: string;
}

export interface PriceStore {
  store: string;
  store_key: string;
  price: string;
  original_price?: string;
  discount?: string;
  condition?: string;
  available: boolean;
  url: string;
}

export interface PriceResult {
  currency: string;
  prices: PriceStore[];
  best_deal_key: string;
  note?: string;
}

export interface PriceHistoryResult {
  found: boolean;
  currency: string;
  months: { label: string; price: number }[];
  current_price: number;
  lowest: number;
  highest: number;
  trend: "down" | "up" | "stable";
  change_pct: number;
  advice: string;
  note?: string;
}

class ApiError extends Error {
  status: number;
  retryAfter?: number;
  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function getDeviceId() {
  let id = localStorage.getItem("device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("device_id", id);
  }
  return id;
}

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<{ data: T; quotaRemaining: number | null }> {
  const headers = new Headers(options.headers);
  headers.set("X-Device-Id", getDeviceId());
  
  if (options.method && options.method !== "GET" && options.method !== "HEAD") {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers,
  });

  const quota = res.headers.get("X-RateLimit-Remaining");
  const quotaRemaining = quota ? parseInt(quota, 10) : null;

  if (!res.ok) {
    let msg = "An error occurred";
    try {
      const body = await res.json();
      msg = body.detail || body.message || msg;
    } catch (e) {
      // ignore
    }
    const retryAfter = res.headers.get("Retry-After") ? parseInt(res.headers.get("Retry-After")!, 10) : undefined;
    throw new ApiError(msg, res.status, retryAfter);
  }

  const data = await res.json();
  return { data, quotaRemaining };
}

// Auth endpoints
export async function register(data: any) {
  const res = await fetchApi("/auth/register", { method: "POST", body: JSON.stringify(data) });
  return res.data;
}

export async function login(data: any) {
  const res = await fetchApi("/auth/login", { method: "POST", body: JSON.stringify(data) });
  return res.data;
}

export async function logout() {
  const headers = new Headers();
  headers.set("X-CSRF-Token", getCsrfToken());
  const res = await fetchApi("/auth/logout", { method: "POST", headers });
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await fetchApi<User>("/auth/me");
  return res.data;
}

export interface QuotaInfo {
  remaining: number;
  daily_limit: number;
  reset_at: string;
}

export async function getQuota(): Promise<QuotaInfo> {
  const res = await fetchApi<QuotaInfo>("/api/quota");
  return res.data;
}

// Product endpoints
export async function recognizeText(query: string) {
  return fetchApi<ProductInfo>("/api/recognize-text", { method: "POST", body: JSON.stringify({ query }) });
}

export async function recognizeBarcode(barcode: string) {
  return fetchApi<ProductInfo>("/api/recognize-barcode", { method: "POST", body: JSON.stringify({ barcode }) });
}

export async function recognizeImage(image_base64: string, for_barcode = false) {
  return fetchApi<ProductInfo>("/api/recognize-image", { method: "POST", body: JSON.stringify({ image_base64, for_barcode }) });
}

export async function getPrices(query: string) {
  return fetchApi<PriceResult>("/api/prices", { method: "POST", body: JSON.stringify({ query }) });
}

export async function getPriceHistory(query: string) {
  return fetchApi<PriceHistoryResult>("/api/price-history", { method: "POST", body: JSON.stringify({ query }) });
}
