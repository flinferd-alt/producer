import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AD_CHANNELS, DEFAULT_DB_CONNS, DEFAULT_TOKENS, FUNNEL_STAGES, INTEGRATIONS, KPIS, PROD_CHECKLIST, TXS,
  type AdChannel, type ApiToken, type DbConn, type FunnelStage, type Kpi, type Tx,
} from "./data";

/* ---------------- доступ ---------------- */
export type Role = "guest" | "user" | "owner";

export const OWNER_LOGIN = "Flinferd";
export const OWNER_PASS = "$Flin914101$";
export const USER_LOGIN = "expert";
export const USER_PASS = "neuro2026";

export interface Session {
  role: Role;
  login: string;
  name: string;
}

interface AuthValue {
  session: Session;
  live: boolean; // true = реальные данные (вошли в аккаунт)
  isOwner: boolean;
  loginAs: (login: string, pass: string) => { ok: boolean; role?: Role };
  logout: () => void;
}

const AuthCtx = createContext<AuthValue | null>(null);

/* ---------------- реальные данные ---------------- */
export interface RealData {
  funnel: FunnelStage[];
  traffic: number;
  price: number;
  budget: number;
  ads: AdChannel[];
  txs: Tx[];
  kpis: Kpi[];
  integrations: typeof INTEGRATIONS;
  dbConns: DbConn[];
  tokens: ApiToken[];
  checklist: { id: string; done: boolean }[];
}

const seedReal = (): RealData => ({
  funnel: FUNNEL_STAGES,
  traffic: 12000,
  price: 24900,
  budget: 150000,
  ads: AD_CHANNELS,
  txs: TXS,
  kpis: KPIS,
  integrations: INTEGRATIONS,
  dbConns: DEFAULT_DB_CONNS,
  tokens: DEFAULT_TOKENS,
  checklist: PROD_CHECKLIST.map((p) => ({ id: p.id, done: p.done })),
});

interface StoreValue {
  real: RealData;
  set: (patch: Partial<RealData>) => void;
}

const StoreCtx = createContext<StoreValue | null>(null);

const LS_AUTH = "np_auth_v1";
const LS_DATA = "np_real_data_v1";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(() =>
    readJson<Session>(LS_AUTH, { role: "guest", login: "", name: "" }),
  );
  const [real, setReal] = useState<RealData>(() => {
    const seeded = seedReal();
    const saved = readJson<Partial<RealData>>(LS_DATA, {});
    return { ...seeded, ...saved };
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_DATA, JSON.stringify(real));
    } catch {
      /* приватный режим — игнорируем */
    }
  }, [real]);

  const loginAs = useCallback((login: string, pass: string) => {
    const l = login.trim();
    if (l === OWNER_LOGIN && pass === OWNER_PASS) {
      const s: Session = { role: "owner", login: l, name: "Flinferd · владелец" };
      setSession(s);
      localStorage.setItem(LS_AUTH, JSON.stringify(s));
      return { ok: true, role: "owner" as Role };
    }
    if (l === USER_LOGIN && pass === USER_PASS) {
      const s: Session = { role: "user", login: l, name: "Алексей Морозов · эксперт" };
      setSession(s);
      localStorage.setItem(LS_AUTH, JSON.stringify(s));
      return { ok: true, role: "user" as Role };
    }
    return { ok: false };
  }, []);

  const logout = useCallback(() => {
    const s: Session = { role: "guest", login: "", name: "" };
    setSession(s);
    localStorage.removeItem(LS_AUTH);
  }, []);

  const set = useCallback((patch: Partial<RealData>) => {
    setReal((r) => ({ ...r, ...patch }));
  }, []);

  const auth = useMemo<AuthValue>(
    () => ({
      session,
      live: session.role !== "guest",
      isOwner: session.role === "owner",
      loginAs,
      logout,
    }),
    [session, loginAs, logout],
  );

  const store = useMemo<StoreValue>(() => ({ real, set }), [real, set]);

  return (
    <AuthCtx.Provider value={auth}>
      <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>
    </AuthCtx.Provider>
  );
}

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
