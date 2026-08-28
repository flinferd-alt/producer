/**
 * api.ts — клиент PHP API (Beget, public_html/api).
 *
 * Хранение: access-токен и сессионные данные — в localStorage;
 * refresh-токен живёт в httpOnly-cookie (ставит сервер, JS его не видит).
 * При 401 клиент один раз пытается обновить access через POST /auth/refresh.
 */

const API_BASE = "https://producer-ai.ru/api";

const LS_TOKEN = "np_access_token";
const LS_USER = "np_session_user";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface StoredUser {
  id: number;
  login: string;
  role: "user" | "owner";
  name: string;
}

export interface LaunchRow {
  id: number;
  name: string;
  expert: string | null;
  stage: string | null;
  status: string;
  config?: unknown;
  created_at: string;
}

/* ---------------- хранение токена ---------------- */

export function getToken(): string | null {
  try {
    return localStorage.getItem(LS_TOKEN);
  } catch {
    return null;
  }
}

export function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(LS_USER);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
  } catch {
    /* приватный режим — игнорируем */
  }
}

function saveAuth(token: string, user: StoredUser): void {
  try {
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_USER, JSON.stringify(user));
  } catch {
    /* приватный режим */
  }
}

/* ---------------- refresh access-токена ---------------- */

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include", // httpOnly-cookie np_refresh
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { success?: boolean; data?: { access_token?: string } };
    const token = body?.data?.access_token;
    if (!body?.success || !token) return false;
    localStorage.setItem(LS_TOKEN, token);
    return true;
  } catch {
    return false;
  }
}

/* ---------------- универсальный fetch ---------------- */

interface ApiOpts {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** не пытаться обновлять токен при 401 (для самих auth-эндпоинтов) */
  noRetry?: boolean;
}

export async function apiFetch<T>(path: string, opts: ApiOpts = {}): Promise<T> {
  const buildHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  };

  const doFetch = () =>
    fetch(`${API_BASE}${path}`, {
      method: opts.method ?? "GET",
      headers: buildHeaders(),
      credentials: "include",
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

  let res = await doFetch();

  // один автоматический refresh при протухшем access-токене
  if (res.status === 401 && !opts.noRetry && getToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await doFetch();
  }

  type ApiBody = { success?: boolean; data?: T; error?: string };
  let body: ApiBody | null = null;
  try {
    body = (await res.json()) as ApiBody;
  } catch {
    body = null;
  }

  if (!res.ok || (body && body.success === false)) {
    const message = body?.error ?? `HTTP ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return (body && body.data !== undefined ? body.data : body) as T;
}

/* ---------------- эндпоинты ---------------- */

export const api = {
  /** Вход. Возвращает access_token + пользователя; сохраняет их локально. */
  async login(login: string, password: string): Promise<{ access_token: string; user: StoredUser }> {
    const data = await apiFetch<{ access_token: string; user: StoredUser }>(
      "/auth.php",
      { method: "POST", body: { login, password }, noRetry: true },
    );
    saveAuth(data.access_token, data.user);
    return data;
  },

  /** Выход: отзыв refresh-токена на сервере. */
  logout(): Promise<unknown> {
    return apiFetch("/auth/logout", { method: "POST", noRetry: true }).catch(() => undefined);
  },

  /** Данные кабинета (воронка, каналы, интеграции, токены, чек-лист...). */
  getData: () => apiFetch<Record<string, unknown>>("/data"),

  /** Сохранить ключи данных кабинета (только owner на сервере). */
  putData: (patch: Record<string, unknown>) => apiFetch<{ updated: string[] }>("/data", { method: "PUT", body: patch }),

  /* ---- запуски ---- */
  getLaunches: () => apiFetch<LaunchRow[]>("/launches"),

  createLaunch: (payload: { name: string; expert?: string }) =>
    apiFetch<LaunchRow>("/launches", { method: "POST", body: payload }),

  getLaunch: (id: number) => apiFetch<Record<string, unknown>>(`/launches/${id}`),

  /** Сохранить ответы распаковки; сервер сам сгенерирует summary в YandexGPT. */
  saveBrief: (id: number, answers: { key: string; label: string; value: string }[]) =>
    apiFetch<{ brief_id: number; summary: string | null; yc: string }>(
      `/launches/${id}/brief`,
      { method: "POST", body: { answers } },
    ),

  saveNiche: (id: number, payload: Record<string, unknown>) =>
    apiFetch<{ snapshot_id: number }>(`/launches/${id}/niche`, { method: "POST", body: payload }),

  savePlan: (id: number, payload: Record<string, unknown>) =>
    apiFetch<{ saved: boolean }>(`/launches/${id}/plan`, { method: "POST", body: payload }),
};
