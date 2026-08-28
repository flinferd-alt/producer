/**
 * store.tsx — глобальное состояние: сессия (JWT) + реальные данные из БД.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AdChannel, ApiToken, DbConn, FunnelStage, Kpi, Tx } from "./data";
import { api, ApiError, clearAuth, getStoredUser, getToken, type StoredUser, type LaunchRow } from "./api";

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
  live: boolean;
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

const EMPTY_REAL: RealData = {
  funnel: [], traffic: 0, price: 0, budget: 0, ads: [], txs: [], kpis: [], integrations: [], dbConns: [], tokens: [], checklist: [],
};

interface StoreValue {
  real: RealData;
  loaded: boolean;
  set: (patch: Partial<RealData>) => void;
  refreshData: () => Promise<void>;

  /* --- Глобальные запуски --- */
  launches: LaunchRow[];
  activeLaunchId: number | null;
  setActiveLaunchId: (id: number | null) => void;
  refreshLaunches: () => Promise<void>;
}

const AuthCtx = createContext<AuthValue | null>(null);
const StoreCtx = createContext<StoreValue | null>(null);

/* ---------------- провайдер ---------------- */

export function DataProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(() => {
    const token = getToken();
    const user = getStoredUser();
    if (!token || !user) return GUEST;
    return { role: user.role === "owner" ? "owner" : "user", login: user.login, name: user.name, id: user.id };
  });

  const [real, setReal] = useState<RealData>(EMPTY_REAL);
  const [loaded, setLoaded] = useState(false);

  const [launches, setLaunches] = useState<LaunchRow[]>([]);
  const [activeLaunchId, setActiveLaunchId] = useState<number | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const refreshData = useCallback(async () => {
    try {
      const data = (await api.getData()) as Partial<RealData>;
      setReal({ ...EMPTY_REAL, ...data });
      setLoaded(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        clearAuth();
        setSession(GUEST);
        setReal(EMPTY_REAL);
        setLaunches([]);
        setActiveLaunchId(null);
      }
      setLoaded(true);
    }
  }, []);

  const refreshLaunches = useCallback(async () => {
    try {
      const rows = await api.getLaunches();
      const valid = Array.isArray(rows) ? rows : [];
      setLaunches(valid);
      setActiveLaunchId((prev) => (prev ? prev : valid.length > 0 ? valid[0].id : null));
    } catch (e) {
      console.warn("Не удалось загрузить запуски:", e);
    }
  }, []);

  useEffect(() => {
    if (getToken()) {
      void refreshData();
      void refreshLaunches();
    }
  }, [refreshData, refreshLaunches]);

  const login = useCallback(
    async (loginStr: string, password: string) => {
      const { user } = await api.login(loginStr, password);
      const role: Role = user.role === "owner" ? "owner" : "user";
      setSession({ role, login: user.login, name: user.name, id: user.id });
      await refreshData();
      await refreshLaunches();
      return { ok: true as const, role };
    },
    [refreshData, refreshLaunches],
  );

  const logout = useCallback(() => {
    void api.logout();
    clearAuth();
    setSession(GUEST);
    setReal(EMPTY_REAL);
    setLaunches([]);
    setActiveLaunchId(null);
    setLoaded(false);
  }, []);

  const set = useCallback((patch: Partial<RealData>) => {
    setReal((r) => ({ ...r, ...patch }));
    if (sessionRef.current.role !== "guest" && getToken()) {
      api.putData(patch as Record<string, unknown>).catch(() => {});
    }
  }, []);

  const auth = useMemo<AuthValue>(() => ({ session, live: session.role !== "guest", isOwner: session.role === "owner", login, logout }), [session, login, logout]);
  const store = useMemo<StoreValue>(() => ({ real, loaded, set, refreshData, launches, activeLaunchId, setActiveLaunchId, refreshLaunches }), [real, loaded, set, refreshData, launches, activeLaunchId, refreshLaunches]);

  return (
    <AuthCtx.Provider value={auth}>
      <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth вне DataProvider");
  return v;
}
export function useStore() {
  const v = useContext(StoreCtx);
  if (!v) throw new Error("useStore вне DataProvider");
  return v;
}
export type { StoredUser };