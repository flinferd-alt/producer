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
  subscription: "free" | "pro" | "studio";
  freeLaunchesUsed: number;
  isFreeLimitReached: boolean;
  login: (login: string, password: string) => Promise<{ ok: true; role: Role }>;
  register: (login: string, password: string, name?: string) => Promise<{ ok: true; role: Role }>;
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

export interface NicheContext {
  niche_name: string;
  score: number;
  verdict: string;
  segments: { title: string; share: number; pain: string; gain: string; check: string }[];
  competitors: { name: string; weak: string; power: number }[];
  avg_check: number;
  margin: number;
  demand: number;
}

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

  /* --- Ниша: принятие стратегии --- */
  nicheContext: NicheContext | null;
  setNicheContext: (ctx: NicheContext | null) => void;
  isNicheAccepted: boolean;
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

  const [subscription, setSubscription] = useState<"free" | "pro" | "studio">(() => {
    const user = getStoredUser();
    return (user?.subscription_status as "free" | "pro" | "studio") ?? "free";
  });
  const [freeLaunchesUsed, setFreeLaunchesUsed] = useState(() => {
    const user = getStoredUser();
    return user?.free_launches_used ?? 0;
  });
  const isFreeLimitReached = subscription === "free" && freeLaunchesUsed >= 1;

  const [real, setReal] = useState<RealData>(EMPTY_REAL);
  const [loaded, setLoaded] = useState(false);

  const [launches, setLaunches] = useState<LaunchRow[]>([]);
  const [activeLaunchId, setActiveLaunchId] = useState<number | null>(null);
  const [nicheContext, setNicheContext] = useState<NicheContext | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const isNicheAccepted = useMemo(() => {
    const launch = launches.find((l) => l.id === activeLaunchId);
    if (!launch) return false;
    const stage = launch.stage || "";
    return stage === "niche_accepted" || stage === "product" || stage === "funnel" || stage === "traffic" || stage === "sales";
  }, [launches, activeLaunchId]);

  // Сбрасываем nicheContext при смене запуска
  useEffect(() => {
    setNicheContext(null);
  }, [activeLaunchId]);

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

  const register = useCallback(
    async (loginStr: string, password: string, name?: string) => {
      const { user } = await api.register(loginStr, password, name);
      const role: Role = user.role === "owner" ? "owner" : "user";
      setSession({ role, login: user.login, name: user.name, id: user.id });
      setSubscription(user.subscription_status || "free");
      setFreeLaunchesUsed(user.free_launches_used ?? 0);
      await refreshData();
      await refreshLaunches();
      return { ok: true as const, role };
    },
    [refreshData, refreshLaunches],
  );

  const login = useCallback(
    async (loginStr: string, password: string) => {
      const { user } = await api.login(loginStr, password);
      const role: Role = user.role === "owner" ? "owner" : "user";
      setSession({ role, login: user.login, name: user.name, id: user.id });
      setSubscription(user.subscription_status || "free");
      setFreeLaunchesUsed(user.free_launches_used ?? 0);
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
    setSubscription("free");
    setFreeLaunchesUsed(0);
    setReal(EMPTY_REAL);
    setLaunches([]);
    setActiveLaunchId(null);
    setNicheContext(null);
    setLoaded(false);
  }, []);

  const set = useCallback((patch: Partial<RealData>) => {
    setReal((r) => ({ ...r, ...patch }));
    if (sessionRef.current.role !== "guest" && getToken()) {
      api.putData(patch as Record<string, unknown>).catch(() => {});
    }
  }, []);

  const auth = useMemo<AuthValue>(() => ({ session, live: session.role !== "guest", isOwner: session.role === "owner", subscription, freeLaunchesUsed, isFreeLimitReached, login, register, logout }), [session, login, register, logout, subscription, freeLaunchesUsed, isFreeLimitReached]);
  const store = useMemo<StoreValue>(() => ({ real, loaded, set, refreshData, launches, activeLaunchId, setActiveLaunchId, refreshLaunches, nicheContext, setNicheContext, isNicheAccepted }), [real, loaded, set, refreshData, launches, activeLaunchId, setActiveLaunchId, refreshLaunches, nicheContext, isNicheAccepted]);

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