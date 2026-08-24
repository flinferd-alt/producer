import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_DB_CONNS,
  DEFAULT_TOKENS,
  ENV_VARS,
  INTEGRATIONS,
  LAUNCHES,
  PROD_CHECKLIST,
  TOKEN_PROVIDERS,
  type ApiToken,
  type DbConn,
  type Tone,
} from "../data";
import { Bar, Chip, Dot, Head, Icon, Panel, Reveal, ToneBtn } from "../ui";

/* ------------------------------------------------------------------ */
/* доступ владельца (прототип: проверка на клиенте, в production — JWT) */
/* ------------------------------------------------------------------ */
const OWNER_LOGIN = "Flinferd";
const OWNER_PASS = "$Flin914101$";
const SESSION_KEY = "neuroprod.owner.session";
const DATA_KEY = "neuroprod.cabinet.v1";

interface Session {
  login: string;
  ts: number;
}

interface CabinetData {
  conns: DbConn[];
  tokens: ApiToken[];
  ints: typeof INTEGRATIONS;
  checklist: Record<string, boolean>;
}

const DEFAULT_DATA: CabinetData = {
  conns: DEFAULT_DB_CONNS,
  tokens: DEFAULT_TOKENS,
  ints: INTEGRATIONS,
  checklist: Object.fromEntries(PROD_CHECKLIST.map((c) => [c.id, c.done])),
};

function usePersist<T>(key: string, init: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : init;
    } catch {
      return init;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* noop */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

function maskValue(v: string) {
  if (v.length <= 6) return v.slice(0, 2) + "••••";
  return v.slice(0, 4) + "••••••••" + v.slice(-4);
}

const COPYABLE: Record<string, string> = {
  webhook: "https://flinferd.ru/api/webhooks/yookassa",
  cron: "*/15 * * * * curl -fsS https://flinferd.ru/api/cron/orchestrator\n0 3 * * * curl -fsS https://flinferd.ru/api/cron/night-audit",
};

/* ------------------------------------------------------------------ */
/* экран входа                                                         */
/* ------------------------------------------------------------------ */
function LoginGate({ onSuccess }: { onSuccess: (s: Session) => void }) {
  const [login, setLogin] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [busy, setBusy] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    window.setTimeout(() => {
      if (login.trim() === OWNER_LOGIN && pass === OWNER_PASS) {
        onSuccess({ login: OWNER_LOGIN, ts: Date.now() });
      } else {
        setAttempts((a) => a + 1);
        setErr("Доступ запрещён — неверный логин или пароль");
        setShakeKey((k) => k + 1);
        setBusy(false);
      }
    }, 750);
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[440px] items-center">
      <Reveal className="w-full">
        <Panel key={shakeKey} className={`overflow-hidden ${err ? "shake border-coral/40" : ""}`}>
          <div className="flex items-center gap-3 border-b border-coral/25 bg-coral/[0.06] px-5 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-coral/15 text-coral"><Icon name="lock" size={15} /></span>
            <div>
              <div className="font-mono text-[11px] font-bold tracking-[0.2em] text-coral uppercase">Restricted · зона владельца</div>
              <div className="font-mono text-[10px] text-dim">настройки запуска, ключи и подключения</div>
            </div>
          </div>
          <div className="p-6">
            <div className="font-display text-xl font-extrabold text-ink">Вход в кабинет</div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-mut">
              Раздел доступен только владельцу аккаунта. Здесь — базы данных, токены Yandex Cloud, интеграции и production-настройки.
            </p>
            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block font-mono text-[10.5px] tracking-[0.18em] text-dim uppercase">Логин</label>
                <input
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  autoComplete="username"
                  placeholder="Ваш логин владельца"
                  className="w-full rounded-lg border border-line bg-deep/70 px-4 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-dim focus:border-amber/50"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10.5px] tracking-[0.18em] text-dim uppercase">Пароль</label>
                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    className="w-full rounded-lg border border-line bg-deep/70 px-4 py-2.5 pr-11 text-[13.5px] text-ink outline-none transition-colors placeholder:text-dim focus:border-amber/50"
                  />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-dim transition-colors hover:text-ink" aria-label="Показать пароль">
                    <Icon name={show ? "lock" : "unlock"} size={15} />
                  </button>
                </div>
              </div>
              {err && (
                <div className="flex items-start gap-2.5 rounded-lg border border-coral/30 bg-coral/[0.07] px-3.5 py-2.5">
                  <Icon name="close" size={13} className="mt-0.5 shrink-0 text-coral" />
                  <div className="text-[12px] leading-snug text-coral">
                    {err}. Попытка {attempts}.
                    {attempts >= 5 && <div className="mt-1 text-[11px] opacity-80">В production: 5 неудач = блокировка на 15 минут (rate-limit на backend).</div>}
                  </div>
                </div>
              )}
              <button type="submit" disabled={busy || !login.trim() || !pass} className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg bg-amber py-3 font-mono text-[12px] font-bold tracking-[0.14em] text-deep uppercase transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
                {busy ? (
                  <>
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-deep" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-deep" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-deep" />
                    проверка…
                  </>
                ) : (
                  <>
                    <Icon name="lock" size={14} /> Войти
                  </>
                )}
              </button>
            </form>
            <div className="mt-5 rounded-lg border border-line bg-deep/50 p-3.5 font-mono text-[10.5px] leading-relaxed text-dim">
              <span className="text-amber">прототип:</span> проверка выполняется на клиенте. Для боевого режима переносится на backend:
              bcrypt-хэш пароля + JWT-сессии + rate-limit — пошагово в README, раздел «Безопасность».
            </div>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* содержимое кабинета                                                 */
/* ------------------------------------------------------------------ */
function CabinetInner({ session, onLogout, push }: { session: Session; onLogout: () => void; push: (t: string, tone?: Tone) => void }) {
  const [data, setData] = usePersist<CabinetData>(DATA_KEY, DEFAULT_DATA);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [dbFormOpen, setDbFormOpen] = useState(false);
  const [dbForm, setDbForm] = useState({ name: "", host: "", port: "5432", db: "", user: "", pass: "", ssl: true });
  const [tkProvider, setTkProvider] = useState(TOKEN_PROVIDERS[0]);
  const [tkValue, setTkValue] = useState("");
  const confirmTimer = useRef<number | null>(null);

  const copy = (text: string, msg = "Скопировано в буфер обмена") => {
    try {
      void navigator.clipboard?.writeText(text);
    } catch {
      /* noop */
    }
    push(msg, "sky");
  };

  const askDelete = (id: string, doDelete: () => void) => {
    if (confirmId === id) {
      doDelete();
      setConfirmId(null);
      return;
    }
    setConfirmId(id);
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    confirmTimer.current = window.setTimeout(() => setConfirmId(null), 3200);
  };

  const pingConn = (id: string) => {
    setData((d) => ({ ...d, conns: d.conns.map((c) => (c.id === id ? { ...c, status: "test" as const } : c)) }));
    window.setTimeout(() => {
      const ms = 8 + Math.floor(Math.random() * 22);
      setData((d) => ({ ...d, conns: d.conns.map((c) => (c.id === id ? { ...c, status: "online" as const, ping: ms } : c)) }));
      push(`Пинг БД: ${ms} мс — соединение стабильно`, "mint");
    }, 900);
  };

  const addConn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbForm.host.trim() || !dbForm.db.trim() || !dbForm.user.trim()) {
      push("Заполните хост, базу и пользователя — иначе строку подключения не собрать", "coral");
      return;
    }
    const id = `db-${Date.now()}`;
    const conn: DbConn = {
      id,
      name: dbForm.name.trim() || dbForm.db.trim(),
      host: dbForm.host.trim(),
      port: Number(dbForm.port) || 5432,
      db: dbForm.db.trim(),
      user: dbForm.user.trim(),
      status: "test",
      ssl: dbForm.ssl,
    };
    setData((d) => ({ ...d, conns: [...d.conns, conn] }));
    setDbFormOpen(false);
    setDbForm({ name: "", host: "", port: "5432", db: "", user: "", pass: "", ssl: true });
    push(`Проверяю подключение к ${conn.host}…`, "amber");
    window.setTimeout(() => {
      const ms = 9 + Math.floor(Math.random() * 20);
      setData((d) => ({ ...d, conns: d.conns.map((c) => (c.id === id ? { ...c, status: "online" as const, ping: ms } : c)) }));
      push(`Подключение установлено: ${conn.host}:${conn.port}/${conn.db} · пинг ${ms} мс`, "mint");
    }, 1200);
  };

  const addToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tkValue.trim()) {
      push("Вставьте значение токена — пустые ключи не сохраняю", "coral");
      return;
    }
    const tk: ApiToken = {
      id: `tk-${Date.now()}`,
      provider: tkProvider,
      value: tkValue.trim(),
      added: new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" }),
    };
    setData((d) => ({ ...d, tokens: [...d.tokens, tk] }));
    setTkValue("");
    push(`Токен «${tkProvider}» сохранён в зашифрованное хранилище (Lockbox)`, "mint");
  };

  const onlineCount = data.conns.filter((c) => c.status === "online").length;
  const doneCount = PROD_CHECKLIST.filter((c) => data.checklist[c.id]).length;
  const since = new Date(session.ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  const inputCls = "w-full rounded-lg border border-line bg-deep/70 px-3.5 py-2 text-[12.5px] text-ink outline-none transition-colors placeholder:text-dim focus:border-amber/50";

  return (
    <div className="space-y-5">
      {/* security strip */}
      <Reveal>
        <Panel className="flex flex-wrap items-center gap-4 border-amber/25 p-4.5 p-5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber/12 text-amber"><Icon name="user" size={21} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-display text-[15px] font-extrabold text-ink">{session.login}</span>
              <Chip tone="amber"><Dot tone="amber" pulse /> режим владельца</Chip>
            </div>
            <div className="mt-0.5 font-mono text-[10.5px] text-dim">сессия с {since} · доступ: настройки запуска, ключи, подключения</div>
          </div>
          <div className="flex gap-2">
            <ToneBtn tone="ghost" onClick={() => push("Смена пароля выполняется на backend: bcrypt-хэш в таблице users (README § «Безопасность»)", "sky")}>
              Сменить пароль
            </ToneBtn>
            <ToneBtn tone="coral" onClick={onLogout}>
              <Icon name="lock" size={13} /> Выйти
            </ToneBtn>
          </div>
        </Panel>
      </Reveal>

      <div className="grid gap-4 xl:grid-cols-6">
        {/* profile */}
        <Reveal className="xl:col-span-2">
          <Panel className="relative h-full overflow-hidden p-5">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky/10 blur-3xl" />
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-line2 bg-panel2 font-display text-xl font-extrabold text-amber">АМ</div>
              <div>
                <div className="font-display text-lg font-extrabold text-ink">Алексей Морозов</div>
                <div className="font-mono text-[10.5px] tracking-wider text-dim uppercase">продюсер-эксперт · «Студия»</div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {[
                { l: "запусков", v: "7" },
                { l: "выручка", v: "9,4 млн" },
                { l: "ROMI", v: "289%" },
              ].map((s) => (
                <div key={s.l} className="rounded-lg border border-line bg-deep/50 p-3 text-center">
                  <div className="font-display text-[16px] font-extrabold text-ink">{s.v}</div>
                  <div className="mt-0.5 font-mono text-[9.5px] tracking-wider text-dim uppercase">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              <ToneBtn tone="ghost" className="w-full justify-center" onClick={() => push("Уведомления: Telegram-бот присылает только решения на одобрение и алерты", "sky")}>
                Настройки уведомлений
              </ToneBtn>
              <ToneBtn tone="ghost" className="w-full justify-center" onClick={() => push("Экспорт: JSON (бриф, воронка) + CSV (платежи, события) выгружен из PostgreSQL", "sky")}>
                <Icon name="doc" size={14} /> Экспорт данных
              </ToneBtn>
            </div>
          </Panel>
        </Reveal>

        {/* databases */}
        <Reveal delay={90} className="xl:col-span-4">
          <Panel className="h-full p-5">
            <Head kicker="Beget · VDS · PostgreSQL 16" title="Базы данных" right={<Chip tone={onlineCount > 0 ? "mint" : "coral"}>{onlineCount} онлайн</Chip>} />
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { l: "подключений", v: String(data.conns.length) },
                { l: "таблиц", v: "24" },
                { l: "размер БД", v: "312 МБ" },
                { l: "бэкап", v: "03:00 ✓" },
              ].map((s) => (
                <div key={s.l} className="rounded-lg border border-line bg-deep/50 px-3.5 py-2.5">
                  <div className="font-display text-[15px] font-extrabold text-ink">{s.v}</div>
                  <div className="font-mono text-[9.5px] tracking-wider text-dim uppercase">{s.l}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2.5">
              {data.conns.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-deep/40 px-4 py-3 transition-colors hover:border-line2">
                  <Dot tone={c.status === "online" ? "mint" : c.status === "test" ? "amber" : "coral"} pulse={c.status !== "offline"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-bold text-ink">{c.name}</span>
                      {c.ssl && <Chip tone="sky">SSL</Chip>}
                      {c.status === "test" && <Chip tone="amber">проверка…</Chip>}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-dim">
                      {c.user}@{c.host}:{c.port}/{c.db}
                    </div>
                  </div>
                  {typeof c.ping === "number" && c.status === "online" && <span className="font-mono text-[11px] text-mint">{c.ping} мс</span>}
                  <div className="flex gap-1.5">
                    <button onClick={() => pingConn(c.id)} className="cursor-pointer rounded-md border border-line px-2.5 py-1.5 font-mono text-[10px] tracking-wide text-mut uppercase transition-colors hover:border-mint/40 hover:text-mint">
                      пинг
                    </button>
                    <button
                      onClick={() =>
                        askDelete(c.id, () => {
                          setData((d) => ({ ...d, conns: d.conns.filter((x) => x.id !== c.id) }));
                          push(`Подключение «${c.name}» удалено. Строка отозвана из backend`, "coral");
                        })
                      }
                      className={`cursor-pointer rounded-md border px-2.5 py-1.5 font-mono text-[10px] tracking-wide uppercase transition-colors ${confirmId === c.id ? "border-coral bg-coral/15 text-coral" : "border-line text-mut hover:border-coral/40 hover:text-coral"}`}
                    >
                      {confirmId === c.id ? "точно?" : "отключить"}
                    </button>
                  </div>
                </div>
              ))}
              {data.conns.length === 0 && (
                <div className="rounded-lg border border-dashed border-line2 px-4 py-6 text-center font-mono text-[11.5px] text-dim">
                  Подключений нет — добавьте базу Beget PostgreSQL ниже
                </div>
              )}
            </div>

            {!dbFormOpen ? (
              <ToneBtn className="mt-4" onClick={() => setDbFormOpen(true)}>
                <Icon name="schema" size={15} /> Подключить базу данных
              </ToneBtn>
            ) : (
              <form onSubmit={addConn} className="mt-4 rounded-lg border border-amber/25 bg-amber/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-mono text-[10.5px] tracking-[0.18em] text-amber uppercase">Новое подключение</div>
                  <button type="button" onClick={() => setDbFormOpen(false)} className="cursor-pointer text-dim transition-colors hover:text-ink" aria-label="Закрыть">
                    <Icon name="close" size={14} />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <input className={inputCls} placeholder="Имя (neuroprod_main)" value={dbForm.name} onChange={(e) => setDbForm({ ...dbForm, name: e.target.value })} />
                  <input className={`${inputCls} sm:col-span-2`} placeholder="Хост · flinferd.beget.tech" value={dbForm.host} onChange={(e) => setDbForm({ ...dbForm, host: e.target.value })} />
                  <input className={inputCls} placeholder="Порт · 5432" value={dbForm.port} onChange={(e) => setDbForm({ ...dbForm, port: e.target.value })} />
                  <input className={inputCls} placeholder="База · flinferd_prod" value={dbForm.db} onChange={(e) => setDbForm({ ...dbForm, db: e.target.value })} />
                  <input className={inputCls} placeholder="Пользователь · flinferd_app" value={dbForm.user} onChange={(e) => setDbForm({ ...dbForm, user: e.target.value })} />
                  <input className={`${inputCls} sm:col-span-2`} type="password" placeholder="Пароль БД" value={dbForm.pass} onChange={(e) => setDbForm({ ...dbForm, pass: e.target.value })} />
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-deep/50 px-3.5">
                    <button type="button" onClick={() => setDbForm({ ...dbForm, ssl: !dbForm.ssl })} className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${dbForm.ssl ? "bg-mint" : "border border-line2 bg-panel2"}`}>
                      <span className={`absolute top-0.5 h-[16px] w-[16px] rounded-full transition-all ${dbForm.ssl ? "left-[18px] bg-deep" : "left-0.5 bg-dim"}`} />
                    </button>
                    <span className="font-mono text-[10.5px] uppercase text-mut">ssl {dbForm.ssl ? "вкл" : "выкл"}</span>
                  </label>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="submit" className="cursor-pointer rounded-lg bg-amber px-4 py-2 font-mono text-[11px] font-bold tracking-wider text-deep uppercase transition-all hover:brightness-110 active:scale-95">
                    Подключить
                  </button>
                  <div className="self-center font-mono text-[10px] text-dim">строка подключения собирается автоматически · ?sslmode=require</div>
                </div>
              </form>
            )}

            <div className="mt-3.5 font-mono text-[10.5px] leading-relaxed text-dim">
              <span className="text-amber">production:</span> пароли БД не хранятся в браузере — только в Yandex Lockbox / .env backend (README § «Безопасность»). Здесь — прототип настроек.
            </div>
          </Panel>
        </Reveal>
      </div>

      <div className="grid gap-4 xl:grid-cols-6">
        {/* tokens */}
        <Reveal className="xl:col-span-3">
          <Panel className="h-full p-5">
            <Head kicker="Yandex Cloud · VK · Директ · ЮKassa" title="Токены и ключи" right={<Chip tone="mint">Lockbox · шифрование</Chip>} />
            <div className="space-y-2">
              {data.tokens.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg border border-line bg-deep/40 px-4 py-2.5 transition-colors hover:border-line2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky/10 text-sky"><Icon name="lock" size={14} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-bold text-ink">{t.provider}</div>
                    <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px]">
                      <span className="truncate text-amber">{shown[t.id] ? t.value : maskValue(t.value)}</span>
                      <span className="text-dim">· {t.added}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button onClick={() => setShown((s) => ({ ...s, [t.id]: !s[t.id] }))} className="cursor-pointer rounded-md border border-line px-2 py-1.5 text-dim transition-colors hover:text-ink" aria-label="Показать">
                      <Icon name={shown[t.id] ? "lock" : "unlock"} size={12} />
                    </button>
                    <button onClick={() => copy(t.value, `Значение «${t.provider}» скопировано`)} className="cursor-pointer rounded-md border border-line px-2 py-1.5 text-dim transition-colors hover:text-ink" aria-label="Копировать">
                      <Icon name="copy" size={12} />
                    </button>
                    <button
                      onClick={() =>
                        askDelete(t.id, () => {
                          setData((d) => ({ ...d, tokens: d.tokens.filter((x) => x.id !== t.id) }));
                          push(`Токен «${t.provider}» отозван и удалён`, "coral");
                        })
                      }
                      className={`cursor-pointer rounded-md border px-2 py-1.5 font-mono text-[9.5px] uppercase transition-colors ${confirmId === t.id ? "border-coral bg-coral/15 text-coral" : "border-line text-dim hover:text-coral"}`}
                    >
                      {confirmId === t.id ? "точно?" : "удалить"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={addToken} className="mt-4 rounded-lg border border-line bg-deep/40 p-3.5">
              <div className="grid gap-2.5 sm:grid-cols-[1fr_1fr_auto]">
                <select value={tkProvider} onChange={(e) => setTkProvider(e.target.value)} className="cursor-pointer rounded-lg border border-line bg-panel2 px-3 py-2 text-[12px] text-ink outline-none focus:border-amber/50">
                  {TOKEN_PROVIDERS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <input className={inputCls} placeholder="Значение токена / ключа" value={tkValue} onChange={(e) => setTkValue(e.target.value)} />
                <button type="submit" className="cursor-pointer rounded-lg bg-amber px-4 py-2 font-mono text-[11px] font-bold tracking-wider text-deep uppercase transition-all hover:brightness-110 active:scale-95">
                  Добавить
                </button>
              </div>
              <div className="mt-2.5 font-mono text-[10px] leading-relaxed text-dim">
                Токены подставляются в backend как переменные окружения. Никогда не вставляйте секреты во фронтенд-код.
              </div>
            </form>
          </Panel>
        </Reveal>

        {/* integrations */}
        <Reveal delay={90} className="xl:col-span-3">
          <Panel className="h-full p-5">
            <Head kicker="Подключено к сервису" title="Интеграции" right={<Chip tone="sky">{data.ints.filter((i) => i.on).length} активно</Chip>} />
            <div className="space-y-2.5">
              {data.ints.map((it, i) => (
                <div key={it.name} className={`flex items-center justify-between gap-3 rounded-lg border p-3.5 transition-all duration-300 ${it.on ? "border-line bg-deep/40 hover:border-line2" : "border-line/60 bg-deep/20"}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${it.on ? "bg-sky/10 text-sky" : "bg-panel2 text-dim"}`}>
                      <Icon name={it.name.includes("ЮKassa") ? "card" : it.name.includes("VK") ? "mega" : it.name.includes("Директ") ? "chart" : it.name.includes("Метрика") ? "target" : it.name.includes("Telegram") ? "chat" : it.name.includes("PostgreSQL") ? "schema" : "bot"} size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-bold text-ink">{it.name}</div>
                      <div className="truncate font-mono text-[10px] text-dim">{it.desc}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className={`font-mono text-[10px] uppercase ${it.on ? "text-mint" : "text-dim"}`}>{it.on ? "ок" : "нет"}</span>
                    <button
                      onClick={() => {
                        setData((d) => ({ ...d, ints: d.ints.map((x, j) => (j === i ? { ...x, on: !x.on } : x)) }));
                        push(it.on ? `${it.name}: соединение разорвано, агенты уведомлены` : `${it.name}: подключено, синхронизация запущена`, it.on ? "coral" : "mint");
                      }}
                      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-300 ${it.on ? "bg-mint" : "border border-line2 bg-panel2"}`}
                      aria-label={`Переключить ${it.name}`}
                    >
                      <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all duration-300 ${it.on ? "left-[22px] bg-deep" : "left-0.5 bg-dim"}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>
      </div>

      <div className="grid gap-4 xl:grid-cols-6">
        {/* production checklist */}
        <Reveal className="xl:col-span-4">
          <Panel className="h-full p-5">
            <Head kicker="Выход на реальную работу" title="Production-чеклист" right={<Chip tone={doneCount === PROD_CHECKLIST.length ? "mint" : "amber"}>{doneCount}/{PROD_CHECKLIST.length}</Chip>} />
            <Bar pct={(doneCount / PROD_CHECKLIST.length) * 100} tone={doneCount === PROD_CHECKLIST.length ? "mint" : "amber"} className="mb-4 h-2" />
            <div className="grid gap-2.5 sm:grid-cols-2">
              {PROD_CHECKLIST.map((c) => {
                const done = !!data.checklist[c.id];
                return (
                  <div key={c.id} className={`rounded-lg border p-3.5 transition-all duration-300 ${done ? "border-mint/25 bg-mint/[0.04]" : "border-line bg-deep/40"}`}>
                    <div className="flex items-start gap-2.5">
                      <button
                        onClick={() => {
                          setData((d) => ({ ...d, checklist: { ...d.checklist, [c.id]: !done } }));
                          push(done ? `«${c.title}» — отметка снята` : `«${c.title}» — выполнено`, done ? "amber" : "mint");
                        }}
                        className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 cursor-pointer place-items-center rounded border transition-colors ${done ? "border-mint bg-mint text-deep" : "border-line2 hover:border-mint/50"}`}
                        aria-label={c.title}
                      >
                        {done && <Icon name="check" size={11} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={`text-[12.5px] font-bold ${done ? "text-mut line-through" : "text-ink"}`}>{c.title}</div>
                        <div className="mt-0.5 text-[11px] leading-snug text-dim">{c.desc}</div>
                      </div>
                      {COPYABLE[c.id] && (
                        <button onClick={() => copy(COPYABLE[c.id], `«${c.title}» — значение скопировано`)} className="shrink-0 cursor-pointer rounded-md border border-line px-2 py-1 font-mono text-[9.5px] text-dim uppercase transition-colors hover:border-sky/40 hover:text-sky">
                          копир.
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </Reveal>

        {/* env vars */}
        <Reveal delay={90} className="xl:col-span-2">
          <Panel className="h-full p-5">
            <Head kicker="Переменные окружения" title=".env backend" />
            <div className="space-y-2">
              {ENV_VARS.map((v) => (
                <div key={v.k} className="rounded-lg border border-line bg-deep/60 px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10.5px] font-bold tracking-wide text-amber">{v.k}</span>
                    <button onClick={() => copy(`${v.k}=${v.v}`, `${v.k} скопирована`)} className="cursor-pointer rounded border border-line px-1.5 py-1 text-dim transition-colors hover:text-ink" aria-label={`Копировать ${v.k}`}>
                      <Icon name="copy" size={11} />
                    </button>
                  </div>
                  <div className="mt-1 truncate font-mono text-[10.5px] text-mut">{maskValue(v.v)}</div>
                  <div className="mt-0.5 font-mono text-[9.5px] text-dim">{v.note}</div>
                </div>
              ))}
            </div>
            <ToneBtn tone="ghost" className="mt-3.5 w-full justify-center" onClick={() => copy(ENV_VARS.map((v) => `${v.k}=${v.v}`).join("\n"), "Полный .env скопирован — вставьте на Beget Functions")}>
              <Icon name="doc" size={13} /> Скопировать весь .env
            </ToneBtn>
          </Panel>
        </Reveal>
      </div>

      {/* launches */}
      <Reveal>
        <Panel className="p-5">
          <Head kicker="Все проекты" title="Запуски" right={<Chip tone="mint">шаблоны сохраняются от запуска к запуску</Chip>} />
          <div className="space-y-3">
            {LAUNCHES.map((l) => (
              <div key={l.name} className="rounded-lg border border-line bg-deep/40 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-line2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Dot tone={l.tone} pulse={l.status === "активен"} />
                    <div>
                      <div className="text-[13.5px] font-bold text-ink">{l.name}</div>
                      <div className="font-mono text-[10.5px] text-dim">{l.expert} · {l.stage}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-mono text-[12px] font-bold text-amber">{l.revenue}</div>
                      <div className="font-mono text-[10px] text-dim">ROMI {l.romi}</div>
                    </div>
                    <Chip tone={l.tone}>{l.status}</Chip>
                  </div>
                </div>
                <Bar pct={l.progress} tone={l.tone} className="mt-3" />
              </div>
            ))}
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export default function Cabinet({ push }: { push: (t: string, tone?: Tone) => void }) {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  });

  if (!session) {
    return (
      <LoginGate
        onSuccess={(s) => {
          try {
            localStorage.setItem(SESSION_KEY, JSON.stringify(s));
          } catch {
            /* noop */
          }
          setSession(s);
          push("Личность подтверждена — добро пожаловать в кабинет владельца", "mint");
        }}
      />
    );
  }

  return (
    <CabinetInner
      session={session}
      push={push}
      onLogout={() => {
        try {
          localStorage.removeItem(SESSION_KEY);
        } catch {
          /* noop */
        }
        setSession(null);
        push("Сессия завершена. Кабинет снова заблокирован", "amber");
      }}
    />
  );
}
