import { useEffect, useState } from "react";
import { LAUNCHES, type Tone } from "../data";
import { applyApiUser as applyApiUserDirect, useAuth, useStore } from "../store";
import { Bar, Chip, Dot, Head, Icon, Panel, Reveal, ToneBtn } from "../ui";

/* -------- PHP API (Beget: public_html/api) -------- */
const API_AUTH = "https://producer-ai.ru/api/auth.php";
const API_LAUNCHES = "https://producer-ai.ru/api/launches.php";

/* -------- запуски -------- */
interface LaunchUI {
  name: string;
  expert: string;
  stage: string;
  progress: number;
  status: string;
  tone: Tone;
  revenue: string;
  romi: string;
}

interface ApiLaunch {
  id?: string | number;
  name?: string;
  expert?: string;
  stage?: string;
  status?: string;
  created_at?: string;
}

/** приводем строку из БД (id, name, expert, stage, status, created_at) к виду карточки */
function normalizeApiLaunch(l: ApiLaunch): LaunchUI {
  const status = (l.status ?? "планирование").toLowerCase();
  const tone: Tone = status.includes("заверш") ? "mut" : status.includes("актив") ? "mint" : "amber";
  return {
    name: l.name || "Запуск без названия",
    expert: l.expert || "—",
    stage: l.stage || (l.created_at ? `создан ${new Date(l.created_at).toLocaleDateString("ru-RU")}` : "—"),
    progress: status.includes("заверш") ? 100 : status.includes("актив") ? 57 : 18,
    status: l.status || "планирование",
    tone,
    revenue: "—",
    romi: "—",
  };
}

/* ================= ЭКРАН ВХОДА (гость) ================= */
function LoginGate({ push }: { push: (t: string, tone?: Tone) => void }) {
  const { loginAs, applyApiUser } = useAuth();
  const [login, setLogin] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState("");
  const [tries, setTries] = useState(0);
  const [checking, setChecking] = useState(false);
  const [shake, setShake] = useState(false);

  const fail = (msg: string) => {
    const n = tries + 1;
    setTries(n);
    setShake(true);
    window.setTimeout(() => setShake(false), 500);
    setErr(n >= 3 ? "Слишком много попыток. В продакшене аккаунт блокируется на 15 минут (rate-limit на backend)." : msg);
    setPass("");
    setChecking(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checking || !login.trim() || !pass) return;
    setChecking(true);
    setErr("");
    try {
      // реальный запрос к PHP API на Beget (public_html/api/auth.php)
      const res = await fetch(API_AUTH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password: pass }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        // сервер подтвердил: сохраняем токен и user, обновляем состояние store
        try {
          localStorage.setItem("pa_token", String(data.token ?? ""));
          localStorage.setItem("pa_user", JSON.stringify(data.user ?? null));
        } catch {
          /* приватный режим браузера */
        }
        const r = loginAs(login, pass);
        if (!r.ok) {
          // сервер принял, но локальные константы разошлись — доверяем серверу
          const u = data.user ?? {};
          const apiLogin = String(u.login ?? "Flinferd");
          const apiRole: "owner" | "user" = u.role === "owner" ? "owner" : "user";
          applyApiUserDirect(apiLogin, apiRole); // персист в localStorage (переживёт перезагрузку)
          applyApiUser(apiLogin, apiRole); // немедленное обновление состояния store
        }
        setChecking(false);
        push(
          (data.user?.role ?? "owner") === "owner"
            ? "Вход владельца: реальные данные + мастер-панель доступны"
            : "Добро пожаловать! Демо-данные заменены на реальные",
          "mint",
        );
        return;
      }
      // сервер ответил ошибкой (401/400/500)
      fail((data && typeof data.error === "string" && data.error) || "Неверный логин или пароль");
    } catch {
      // сеть/CORS: API недоступен — локальный ключ, чтобы прототип не ломался
      const r = loginAs(login, pass);
      if (r.ok) {
        setChecking(false);
        push("API недоступен — выполнен локальный вход (прототип-режим)", "amber");
        return;
      }
      fail("Неверный логин или пароль. Проверьте раскладку и регистр.");
    }
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-5">
      {/* form */}
      <Reveal className="lg:col-span-3">
        <Panel className={`relative overflow-hidden p-7 ${shake ? "shake border-coral/50" : ""}`}>
          <div className="pointer-events-none absolute -left-14 -top-14 h-44 w-44 rounded-full bg-amber/10 blur-3xl" />
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-amber/30 bg-amber/10 text-amber">
              <Icon name="lock" size={20} />
            </span>
            <div>
              <div className="font-display text-lg font-extrabold text-ink">Вход в кабинет</div>
              <div className="font-mono text-[10.5px] tracking-wider text-dim uppercase">сейчас вы в демо-режиме</div>
            </div>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase">Логин</label>
              <input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                autoComplete="username"
                placeholder="Ваш логин"
                className="w-full rounded-lg border border-line bg-deep/70 px-4 py-3 text-[14px] text-ink outline-none transition-colors placeholder:text-dim focus:border-amber/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase">Пароль</label>
              <div className="relative">
                <input
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-line bg-deep/70 px-4 py-3 pr-12 text-[14px] text-ink outline-none transition-colors placeholder:text-dim focus:border-amber/50"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-dim transition-colors hover:text-ink" aria-label="Показать пароль">
                  <Icon name="eye" size={17} />
                </button>
              </div>
            </div>

            {err && (
              <div className="flex items-start gap-2.5 rounded-lg border border-coral/30 bg-coral/[0.07] px-4 py-3 text-[12.5px] leading-snug text-coral">
                <Icon name="close" size={14} className="mt-0.5 shrink-0" />
                {err}
              </div>
            )}

            <button type="submit" disabled={checking || !login || !pass} className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg bg-amber py-3.5 font-mono text-[12px] font-bold tracking-[0.14em] text-deep uppercase transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40">
              {checking ? (
                <>
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-deep" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-deep" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-deep" />
                  проверяем
                </>
              ) : (
                <>
                  <Icon name="unlock" size={16} /> Войти
                </>
              )}
            </button>
          </form>

          <div className="mt-6 rounded-lg border border-amber/25 bg-amber/[0.05] p-4">
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-amber uppercase"><Icon name="lock" size={13} /> доступ владельца</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[12px] text-ink/90">
              <code className="rounded bg-deep/80 px-2 py-1 text-amber">flinferd</code>
              <span className="text-dim">/</span>
              <code className="rounded bg-deep/80 px-2 py-1 text-amber">$Flin914101$</code>
              <button
                onClick={() => {
                  setLogin("flinferd"); // ← ВСЕГДА с маленькой буквы
                  setPass("$Flin914101$");
                }}
                className="cursor-pointer rounded-md border border-amber/40 px-2.5 py-1 font-mono text-[10px] tracking-wide text-amber uppercase transition-colors hover:bg-amber/10"
              >
                подставить
              </button>
            </div>
            <p className="mt-2 text-[11.5px] leading-snug text-mut">Логин проверяется сервером (api/auth.php) и не чувствителен к регистру. После входа включаются реальные данные из PostgreSQL и мастер-панель.</p>
          </div>
        </Panel>
      </Reveal>

      {/* what each role sees */}
      <div className="flex flex-col gap-3.5 lg:col-span-2">
        {[
          { icon: "eye", tone: "amber", t: "Гость — демо-данные", d: "Все разделы открыты на демонстрационных данных. Изменения не сохраняются.", state: "вы здесь" },
          { icon: "user", tone: "sky", t: "Эксперт — реальные данные", d: "KPI, воронка, реклама и оплаты из PostgreSQL. Настройки читаются, изменения сохраняются.", state: "после входа" },
          { icon: "shield", tone: "mint", t: "Владелец — + мастер-панель", d: "Подключение баз Beget, токены Yandex Cloud, ключи интеграций, production-чеклист.", state: "только владелец" },
        ].map((c, i) => (
          <Reveal key={c.t} delay={i * 100}>
            <Panel hover className={`h-full p-5 ${i === 0 ? "border-amber/35" : ""}`}>
              <div className="flex items-center justify-between">
                <span className={`grid h-9 w-9 place-items-center rounded-lg ${c.tone === "amber" ? "bg-amber/12 text-amber" : c.tone === "sky" ? "bg-sky/12 text-sky" : "bg-mint/12 text-mint"}`}>
                  <Icon name={c.icon} size={17} />
                </span>
                <Chip tone={c.tone === "amber" ? "amber" : c.tone === "sky" ? "sky" : "mint"}>{c.state}</Chip>
              </div>
              <div className="mt-3 text-[13.5px] font-bold text-ink">{c.t}</div>
              <p className="mt-1 text-[12px] leading-relaxed text-mut">{c.d}</p>
            </Panel>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* ================= КАБИНЕТ (вошли) ================= */
function CabinetInner({ push, go }: { push: (t: string, tone?: Tone) => void; go: (id: string) => void }) {
  const { session, isOwner, logout } = useAuth();
  const { real, set } = useStore();
  const [ints, setInts] = useState(real.integrations);

  /* запуски: сначала демо-fallback, затем реальные из PostgreSQL (api/launches.php) */
  const [launches, setLaunches] = useState<LaunchUI[]>(LAUNCHES.map((l) => ({ ...l })));
  const [loadingLaunches, setLoadingLaunches] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(API_LAUNCHES);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data?.success && Array.isArray(data.data)) {
          setLaunches(data.data.map(normalizeApiLaunch)); // пустой массив → пустое состояние
        }
        // при ошибке API оставляем демо-данные из data.ts как fallback
      } catch {
        /* API недоступен — fallback остаётся */
      } finally {
        if (!cancelled) setLoadingLaunches(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const doneCount = real.checklist.filter((c) => c.done).length;

  const KEYS = [
    { name: "ЮKassa · секретный ключ", val: "live_a9f3••••••••••••7d2c" },
    { name: "VK Ads API · токен кабинета", val: "vkad••••••••••••91be" },
    { name: "Яндекс Директ · OAuth", val: "ydir••••••••••••4f08" },
  ];
  const [shown, setShown] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-5">
      {/* режим */}
      <Reveal>
        <Panel className={`flex flex-wrap items-center gap-4 p-5 ${isOwner ? "border-mint/30" : "border-sky/30"}`}>
          <span className={`grid h-11 w-11 place-items-center rounded-xl ${isOwner ? "bg-mint/12 text-mint" : "bg-sky/12 text-sky"}`}>
            <Icon name={isOwner ? "shield" : "user"} size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[15px] font-extrabold text-ink">{session.name}</div>
            <div className="font-mono text-[10.5px] tracking-wider text-dim uppercase">
              {isOwner ? "полный доступ · реальные данные + мастер-панель" : "реальные данные · настройки владельца скрыты"}
            </div>
          </div>
          {isOwner ? (
            <Chip tone="mint"><Icon name="crown" size={12} /> владелец</Chip>
          ) : (
            <Chip tone="sky">эксперт</Chip>
          )}
          <button onClick={() => { logout(); push("Вы вышли из аккаунта — включён демо-режим", "amber"); }} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3.5 py-2 font-mono text-[11px] tracking-wide text-mut uppercase transition-colors hover:border-coral/40 hover:text-coral">
            <Icon name="logout" size={14} /> Выйти
          </button>
        </Panel>
      </Reveal>

      {/* мастер-панель: владелец видит доступ, пользователь — заглушку */}
      {isOwner ? (
        <Reveal>
          <button onClick={() => go("master")} className="group relative w-full cursor-pointer overflow-hidden rounded-xl border border-mint/30 bg-gradient-to-r from-mint/[0.07] via-panel to-panel p-5 text-left transition-all duration-300 hover:border-mint/50 hover:shadow-[0_18px_44px_-20px_rgba(61,220,151,0.25)]">
            <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-mint/10 blur-3xl transition-opacity group-hover:opacity-150" />
            <div className="flex flex-wrap items-center gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-mint/15 text-mint"><Icon name="shield" size={23} /></span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[16px] font-extrabold text-ink">Мастер-панель владельца</div>
                <div className="text-[12.5px] text-mut">Базы Beget · токены Yandex Cloud · ключи интеграций · production-чеклист ({doneCount}/{real.checklist.length})</div>
              </div>
              <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-mint uppercase transition-transform duration-300 group-hover:translate-x-1">
                открыть <Icon name="arrow" size={15} />
              </span>
            </div>
          </button>
        </Reveal>
      ) : (
        <Reveal>
          <div className="flex items-center gap-4 rounded-xl border border-line bg-panel/60 p-5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-panel2 text-dim"><Icon name="lock" size={19} /></span>
            <div>
              <div className="text-[13.5px] font-bold text-mut">Мастер-панель доступна только владельцу</div>
              <div className="text-[12px] text-dim">Подключение баз данных, токены Yandex Cloud и production-настройки скрыты для роли «эксперт».</div>
            </div>
          </div>
        </Reveal>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {/* profile */}
        <Reveal>
          <Panel className="relative h-full overflow-hidden p-5">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky/10 blur-3xl" />
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-line2 bg-panel2 font-display text-xl font-extrabold text-amber">
                {session.role === "owner" ? "FL" : "АМ"}
              </div>
              <div>
                <div className="font-display text-lg font-extrabold text-ink">{isOwner ? "Flinferd" : "Алексей Морозов"}</div>
                <div className="font-mono text-[10.5px] tracking-wider text-dim uppercase">{isOwner ? "владелец сервиса" : "продюсер-эксперт"}</div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {[
                { l: "запусков", v: String(launches.length) },
                { l: "выручка", v: "9,4 млн" },
                { l: "ср. ROMI", v: "289%" },
              ].map((s) => (
                <div key={s.l} className="rounded-lg border border-line bg-deep/50 p-3 text-center">
                  <div className="font-display text-[16px] font-extrabold text-ink">{s.v}</div>
                  <div className="mt-0.5 font-mono text-[9.5px] tracking-wider text-dim uppercase">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              <ToneBtn tone="ghost" className="w-full justify-center" onClick={() => push("Уведомления: Telegram-бот присылает только решения на одобрение", "sky")}>
                Настройки уведомлений
              </ToneBtn>
              <ToneBtn tone="ghost" className="w-full justify-center" onClick={() => push("Экспорт: JSON (бриф, воронка) + CSV (платежи, события) из PostgreSQL", "sky")}>
                <Icon name="doc" size={14} /> Экспорт данных
              </ToneBtn>
            </div>
          </Panel>
        </Reveal>

        {/* launches */}
        <Reveal delay={100} className="xl:col-span-2">
          <Panel className="h-full p-5">
            <Head
              kicker="Все проекты · таблица launches"
              title="Запуски"
              right={
                loadingLaunches ? (
                  <span className="flex items-center gap-1.5 rounded-md border border-line bg-panel2 px-2.5 py-1">
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-amber" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-amber" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-amber" />
                    <span className="font-mono text-[10px] tracking-wider text-dim uppercase">из БД</span>
                  </span>
                ) : (
                  <Chip tone="mint">PostgreSQL · {launches.length}</Chip>
                )
              }
            />
            <div className="space-y-3">
              {loadingLaunches ? (
                <div className="grid place-items-center rounded-lg border border-dashed border-line2 py-12">
                  <span className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.18em] text-dim uppercase">
                    <span className="typing-dot h-2 w-2 rounded-full bg-amber" />
                    <span className="typing-dot h-2 w-2 rounded-full bg-amber" />
                    <span className="typing-dot h-2 w-2 rounded-full bg-amber" />
                    читаем launches
                  </span>
                </div>
              ) : launches.length === 0 ? (
                <div className="rounded-lg border border-dashed border-line2 px-6 py-10 text-center">
                  <div className="font-mono text-[12px] tracking-wide text-mut uppercase">Запусков пока нет</div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-dim">Таблица launches в базе пуста. Начните с распаковки — оркестратор создаст первую запись сам.</p>
                </div>
              ) : (
                launches.map((l, i) => (
                  <div key={`${l.name}-${i}`} className="rounded-lg border border-line bg-deep/40 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-line2">
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
                ))
              )}
            </div>
          </Panel>
        </Reveal>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* integrations */}
        <Reveal className="xl:col-span-3">
          <Panel className="h-full p-5">
            <Head kicker="Подключено к сервису" title="Интеграции" right={<Chip tone="sky">{ints.filter((i) => i.on).length} активно</Chip>} />
            <div className="grid gap-3 sm:grid-cols-2">
              {ints.map((it, i) => (
                <div key={it.name} className={`flex items-center justify-between rounded-lg border p-4 transition-all duration-300 ${it.on ? "border-line bg-deep/40 hover:border-line2" : "border-line/60 bg-deep/20"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`grid h-9 w-9 place-items-center rounded-lg ${it.on ? "bg-sky/10 text-sky" : "bg-panel2 text-dim"}`}>
                      <Icon name={it.name.includes("Beget") ? "schema" : it.name.includes("ЮKassa") ? "card" : it.name.includes("VK") ? "mega" : it.name.includes("Директ") ? "chart" : it.name.includes("Метрика") ? "target" : "chat"} size={17} />
                    </span>
                    <div>
                      <div className="text-[13px] font-bold text-ink">{it.name}</div>
                      <div className="font-mono text-[10px] text-dim">{it.desc}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={`font-mono text-[10px] uppercase ${it.on ? "text-mint" : "text-dim"}`}>{it.on ? "ок" : "нет"}</span>
                    <button
                      onClick={() => {
                        const next = ints.map((x, j) => (j === i ? { ...x, on: !x.on } : x));
                        setInts(next);
                        set({ integrations: next });
                        push(it.on ? `${it.name}: соединение разорвано, агент уведомлён` : `${it.name}: подключено, синхронизация запущена`, it.on ? "coral" : "mint");
                      }}
                      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-300 ${it.on ? "bg-mint" : "border border-line2 bg-panel2"}`}
                    >
                      <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all duration-300 ${it.on ? "left-[22px] bg-deep" : "left-0.5 bg-dim"}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>

        {/* keys */}
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Reveal delay={90}>
            <Panel className="p-5">
              <Head kicker={isOwner ? "Yandex Lockbox" : "Ключи · чтение"} title="Секреты" />
              <ul className="space-y-2.5">
                {KEYS.map((k) => (
                  <li key={k.name} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-deep/50 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold text-ink">{k.name}</div>
                      <div className="mt-0.5 truncate font-mono text-[11px] text-amber">{shown[k.name] ? k.val.replace(/•+/g, "x8k2m9q4") : k.val}</div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => setShown((s) => ({ ...s, [k.name]: !s[k.name] }))} className="cursor-pointer rounded-md border border-line px-2 py-1.5 text-dim transition-colors hover:text-ink" aria-label="Показать">
                        <Icon name="eye" size={13} />
                      </button>
                      <button onClick={() => push(`Ключ «${k.name}» скопирован в буфер обмена`, "sky")} className="cursor-pointer rounded-md border border-line px-2 py-1.5 text-dim transition-colors hover:text-ink" aria-label="Копировать">
                        <Icon name="copy" size={13} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </Reveal>
          <Reveal delay={160}>
            <Panel className={`flex-1 p-5 ${isOwner ? "border-mint/25" : "border-amber/25"}`}>
              <div className={`flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] uppercase ${isOwner ? "text-mint" : "text-amber"}`}>
                <Icon name="spark" size={13} /> {isOwner ? "режим владельца" : "как читается роль клиента"}
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-mut">
                {isOwner
                  ? "Вам доступны мастер-настройки: подключение PostgreSQL на Beget, токены Yandex Cloud и ключи рекламных кабинетов. Изменения применяются к реальным данным и сохраняются."
                  : "На клиенте остаются только вводные данные — ответы на вопросы распаковки и редкие одобрения. Всё остальное ведут агенты. Ведение курса — модуль v2."}
              </p>
            </Panel>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

export default function Cabinet({ push, go }: { push: (t: string, tone?: Tone) => void; go: (id: string) => void }) {
  const { live } = useAuth();
  return live ? <CabinetInner push={push} go={go} /> : <LoginGate push={push} />;
}
