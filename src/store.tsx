/**
 * store.tsx — глобальное состояние: сессия (JWT) + реальные данные из БД.
 *
 * Никаких паролей и демо-данных в коде:
 *  - вход — POST /api/auth.php (password_verify + bcrypt на сервере);
 *  - данные — GET /api/data, изменения — PUT /api/data (PostgreSQL, app_data);
 *  - localStorage хранит ТОЛЬКО access-токен и сессионный объект пользователя.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AdChannel, ApiToken, DbConn, FunnelStage, Kpi, Tx } from "./data";
import { api, ApiError, clearAuth, getStoredUser, getToken, type StoredUser } from "./api";

/* ---------------- сессия ---------------- */

export type Role = "guest" | "user" | "owner";

export interface Session {
  role: Role;
  login: string;
  name: string;
  id?: number;
}

const GUEST: Session = { role: "guest", login: "", name: "" };

interface AuthValue {
  session: Session;
  live: boolean;   // true — пользователь вошёл (реальные данные)
  isOwner: boolean;
  login: (login: string, password: string) => Promise<{ ok: true; role: Role }>;
  logout: () => void;
}

/* ---------------- реальные данные ---------------- */

export interface IntegrationItem {
  name: string;
  desc: string;
  on: boolean;
  tone: "amber" | "mint" | "coral" | "sky" | "mut";
}

export interface ChecklistItem {
  id: string;
  title: string;
  desc: string;
  done: boolean;
}

export interface RealData {
  funnel: FunnelStage[];
  traffic: number;
  price: number;
  budget: number;
  ads: AdChannel[];
  txs: Tx[];
  kpis: Kpi[];
  integrations: IntegrationItem[];
  dbConns: DbConn[];
  tokens: ApiToken[];
  checklist: ChecklistItem[];
}

/** Пустое состояние: до входа и до загрузки из БД бизнес-данных нет. */
const EMPTY_REAL: RealData = {
  funnel: [],
  traffic: 0,
  price: 0,
  budget: 0,
  ads: [],
  txs: [],
  kpis: [],
  integrations: [],
  dbConns: [],
  tokens: [],
  checklist: [],
};

interface StoreValue {
  real: RealData;
  loaded: boolean; // true после успешного GET /api/data
  /** Обновляет состояние и синхронизирует ключи с БД (PUT /api/data). */
  set: (patch: Partial<RealData>) => void;
  refreshData: () => Promise<void>;
}

const AuthCtx = createContext<AuthValue | null>(null);
const StoreCtx = createContext<StoreValue | null>(null);

/* ---------------- провайдер ---------------- */

export function DataProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(() => {
    // сессия восстанавливается из сохранённого серверного входа (токен + user)
    const token = getToken();
    const user = getStoredUser();
    if (!token || !user) return GUEST;
    return {
      role: user.role === "owner" ? "owner" : "user",
      login: user.login,
      name: user.name,
      id: user.id,
    };
  });

  const [real, setReal] = useState<RealData>(EMPTY_REAL);
  const [loaded, setLoaded] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  /** Загрузка реальных данных из PostgreSQL через GET /api/data. */
  const refreshData = useCallback(async () => {
    try {
      const data = (await api.getData()) as Partial<RealData>;
      setReal({ ...EMPTY_REAL, ...data });
      setLoaded(true);
    } catch (e) {
      // токен протух и refresh не помог — разлогиниваемся
      if (e instanceof ApiError && e.status === 401) {
        clearAuth();
        setSession(GUEST);
        setReal(EMPTY_REAL);
      }
      setLoaded(true);
      console.warn("Не удалось загрузить данные из БД:", e);
    }
  }, []);

  // при старте: если есть токен — подгружаем данные
  useEffect(() => {
    if (getToken()) void refreshData();
  }, [refreshData]);

  /** Вход через сервер: bcrypt + JWT. Пароль никуда, кроме API, не попадает. */
  const login = useCallback(
    async (loginStr: string, password: string) => {
      const { user } = await api.login(loginStr, password);
      const role: Role = user.role === "owner" ? "owner" : "user";
      setSession({ role, login: user.login, name: user.name, id: user.id });
      await refreshData();
      return { ok: true as const, role };
    },
    [refreshData],
  );

  /** Выход: отзыв refresh-токена на сервере + очистка локального хранилища. */
  const logout = useCallback(() => {
    void api.logout();
    clearAuth();
    setSession(GUEST);
    setReal(EMPTY_REAL);
    setLoaded(false);
  }, []);

  /**
   * Обновление данных: мгновенно в состоянии + асинхронно в БД.
   * Бизнес-данные больше не живут в localStorage — только в PostgreSQL.
   */
  const set = useCallback((patch: Partial<RealData>) => {
    setReal((r) => ({ ...r, ...patch }));
    if (sessionRef.current.role !== "guest" && getToken()) {
      api.putData(patch as Record<string, unknown>).catch((e) => {
        console.warn("Синхронизация с БД не удалась:", e);
      });
    }
  }, []);

  const auth = useMemo<AuthValue>(
    () => ({
      session,
      live: session.role !== "guest",
      isOwner: session.role === "owner",
      login,
      logout,
    }),
    [session, login, logout],
  );

  const store = useMemo<StoreValue>(
    () => ({ real, loaded, set, refreshData }),
    [real, loaded, set, refreshData],
  );

  return (
    <AuthCtx.Provider value={auth}>
      <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>
    </AuthCtx.Provider>
  );
}

/* ---------------- хуки ---------------- */

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth вне DataProvider");
  return v;
}

export function useStore(): StoreValue {
  const v = useContext(StoreCtx);
  if (!v) throw new Error("useStore вне DataProvider");
  return v;
}

export type { StoredUser };
