/** 客户端 API 封装：统一处理响应信封 { data, ...meta } 与错误 { error, message } */

export interface ApiError {
  error: string;
  message: string;
  status: number;
}

export interface ApiResult<T> {
  data: T;
  meta?: Record<string, any>;
  ok: boolean;
  error?: ApiError;
}

export class ApiClientError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** 企业上下文：设置后所有请求携带 x-company-id（用于 /company/* 相关接口） */
let companyContext: string | null = null;
export function setApiCompanyContext(id: string | null) {
  companyContext = id;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (companyContext) headers['x-company-id'] = companyContext;
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* 非 JSON 响应 */
  }
  if (!res.ok || json?.error) {
    const err = new ApiClientError(
      json?.error || 'REQUEST_FAILED',
      json?.message || `请求失败 (${res.status})`,
      res.status
    );
    return { ok: false, data: undefined as T, error: { error: err.code, message: err.message, status: res.status } };
  }
  const { data, ...meta } = json || {};
  return { ok: true, data, meta };
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  del: <T>(url: string) => request<T>('DELETE', url),
};

/** 构建查询串 */
export function qs(params: Record<string, any>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
