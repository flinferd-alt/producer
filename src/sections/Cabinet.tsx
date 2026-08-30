import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api";
import type { Tone } from "../data";
import { useAuth, useStore } from "../store";
import { Bar, Chip, Dot, Head, Icon, Panel, Reveal, ToneBtn } from "../ui";

/* ================= ЭКРАН ВХОДА (гость) ================= */

function LoginGate({ push }: { push: (t: string, tone?: Tone) => void }) {
  const { login, register } = useAuth();
    const [mode, setMode] = useState<"login" | "register">("login");
    const [loginStr, setLoginStr] = useState("");
    const [pass, setPass] = useState("");
    const [name, setName] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [err, setErr] = useState("");
    const [tries, setTries] = useState(0);
    const [checking, setChecking] = useState(false);
    const [shake, setShake] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checking) return;
    setChecking(true);
    setErr("");
    try {
      if (mode === "register") {
        const r = await register(loginStr, pass, name || undefined);
        push("Аккаунт создан!", "mint");
      } else {
        const r = await login(loginStr, pass);
      push(
        r.role === "owner"
          ? "Вход владельца: реальные данные из PostgreSQL + мастер-панель"
          : "Добро пожаловать! Загружены реальные данные",
        "mint",
      );
            }
          } catch (error) {
      const n = tries + 1;
      setTries(n);
      setShake(true);
      window.setTimeout(() => setShake(false), 500);
      setPass("");
      if (error instanceof ApiError) {
        if (error.status === 401) setErr("Неверный логин или пароль.");
                else if (error.status === 409) setErr("Этот логин уже занят.");
                else if (error.status === 429) setErr(error.message);
        else setErr(`Сервер вернул ошибку ${error.status}: ${error.message}`);
      } else {
        setErr("Не удалось связаться с сервером авторизации. Проверьте соединение и попробуйте ещё раз.");
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-5">
      {/* форма входа */}
      <Reveal className="lg:col-span-3">
        <Panel className={`relative overflow-hidden p-7 ${shake ? "shake border-coral/50" : ""}`}>
          <div className="pointer-events-none absolute -left-14 -top-14 h-44 w-44 rounded-full bg-amber/10 blur-3xl" />
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-amber/30 bg-amber/10 text-amber">
              <Icon name={mode === "register" ? "user" : "lock"} size={20} />
            </span>
            <div>
              <div className="font-display text-lg font-extrabold text-ink">{mode === "register" ? "Регистрация" : "Вход в кабинет"}</div>
              <div className="font-mono text-[10.5px] tracking-wider text-dim uppercase">JWT · bcrypt · PostgreSQL</div>
            </div>
          </div>

          <div className="mt-5 flex rounded-lg border border-line bg-deep/50 p-1">
            <button type="button" onClick={() => { setMode("login"); setErr(""); }} className={`flex-1 rounded-md py-2 font-mono text-[11px] font-semibold tracking-wide uppercase transition-all ${mode === "login" ? "bg-amber text-deep" : "text-mut hover:text-ink"}`}>Вход</button>
            <button type="button" onClick={() => { setMode("register"); setErr(""); }} className={`flex-1 rounded-md py-2 font-mono text-[11px] font-semibold tracking-wide uppercase transition-all ${mode === "register" ? "bg-amber text-deep" : "text-mut hover:text-ink"}`}>Регистрация</button>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              {mode === "register" && (
              <div>
                <label className="mb-1.5 block font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase">Имя</label>
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Как вас называть" className="w-full rounded-lg border border-line bg-deep/70 px-4 py-3 text-[14px] text-ink outline-none transition-colors placeholder:text-dim focus:border-amber/50" />
              </div>
            )}
            <label className="mb-1.5 block font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase">Логин</label>
              <input
                value={loginStr}
                onChange={(e) => setLoginStr(e.target.value)}
                autoComplete="username"
                placeholder={mode === "register" ? "Минимум 3 символа" : "Ваш логин"}
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
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                                    placeholder={mode === "register" ? "Минимум 6 символов" : "••••••••••••"}
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

            <button
              type="submit"
              disabled={checking || !loginStr || !pass || (mode === "register" && loginStr.length < 3) || (mode === "register" && pass.length < 6)}
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg bg-amber py-3.5 font-mono text-[12px] font-bold tracking-[0.14em] text-deep uppercase transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checking ? (
                <>
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-deep" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-deep" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-deep" />
                  {mode === "register" ? "создаём" : "проверяем"}
                </>
              ) : (
                <>
                  <Icon name={mode === "register" ? "spark" : "unlock"} size={16} /> {mode === "register" ? "Создать аккаунт" : "Войти"}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 rounded-lg border border-sky/25 bg-sky/[0.05] p-4">
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-sky uppercase">
              <Icon name="shield" size={13} /> {mode === "register" ? "о регистрации" : "как устроена проверка"}
            </div>
            <ul className="mt-2 space-y-1.5 text-[11.5px] leading-snug text-mut">
              <li className="flex gap-2"><span className="text-sky">▸</span> Пароль хранится в bcrypt-хэше, даже мы его не видим.</li>
                            <li className="flex gap-2"><span className="text-sky">▸</span> Access-токен живёт 15 минут, refresh — 30 дней.</li>
                            {mode === "register" ? (
                              <>
                                <li className="flex gap-2"><span className="text-sky">▸</span> Бесплатный тариф: 1 запуск, 1 бриф, 1 анализ ниши.</li>
                                <li className="flex gap-2"><span className="text-sky">▸</span> Тариф «Про» — неограниченные запуски и ИИ-агенты.</li>
                              </>
                            ) : (
                              <li className="flex gap-2"><span className="text-sky">▸</span> 5 неудачных попыток блокируют вход.</li>
                            )}
            </ul>
                        {mode === "login" && <p className="mt-2.5 text-[11.5px] leading-snug text-dim">Доступ выдаёт владелец сервиса.</p>}
          </div>
        </Panel>
      </Reveal>

      {/* роли */}
      <div className="flex flex-col gap-3.5 lg:col-span-2">
        {[
          { icon: "eye", tone: "amber", t: "Гость — витрина", d: "Разделы-визитки сервиса. Реальные данные закрыты до входа.", state: "вы здесь" },
          { icon: "user", tone: "sky", t: "Эксперт — данные", d: "KPI, воронка, реклама загружаются из PostgreSQL.", state: "после входа" },
          { icon: "shield", tone: "mint", t: "Владелец", d: "Базы Beget, токены Yandex Cloud, настройки.", state: "только владелец" },
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

function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (s.includes("заверш")) return "mut";
  if (s.includes("актив") || s.includes("active")) return "mint";
  if (s.includes("пауз")) return "coral";
  return "amber";
}

function CabinetInner({ push, go }: { push: (t: string, tone?: Tone) => void; go: (id: string) => void }) {
  const { session, isOwner, logout, subscription, isFreeLimitReached, refreshProfile } = useAuth();

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  // Load payment history
  useEffect(() => {
    api.getPayments().then((data) => {
      setPaymentHistory(data.payments || []);
      if (data.subscription) {
        setSubInfo({ cancel_at: data.subscription.cancel_at, expires_at: data.subscription.expires_at });
      }
    }).catch(() => {});
  }, []);

  // Берем данные запусков из глобального хранилища
  const { real, set, launches, refreshLaunches, activeLaunchId, setActiveLaunchId } = useStore();

  /* создание запуска (владелец) */
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newExpert, setNewExpert] = useState("");
  const [saving, setSaving] = useState(false);

  /* оплата тарифа */
  const [paying, setPaying] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<Array<{id:number;yookassa_id:string;tariff:string;amount:string;currency:string;status:string;description:string;paid_at:string|null;refunded_at:string|null;created_at:string}>>([]);
  const [subInfo, setSubInfo] = useState<{cancel_at:string|null;expires_at:string|null}>({cancel_at:null,expires_at:null});
  const [cancelLoading, setCancelLoading] = useState(false);
  const handleCancelSub = async () => {
    setCancelLoading(true);
    try {
      await api.cancelSubscription();
      push('Подписка будет отменена по истечении оплаченного периода', 'amber');
      setSubInfo((prev) => ({ ...prev, cancel_at: prev.expires_at }));
    } catch (e) {
      push(e instanceof ApiError ? e.message : 'Ошибка отмены подписки', 'coral');
    } finally {
      setCancelLoading(false);
    }
  };

  const handlePay = async () => {
    setPaying(true);
    try {
      const res = await api.createPayment("pro");
      if (res.confirmation_url) window.location.href = res.confirmation_url;
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Ошибка создания платежа", "coral");
    } finally {
      setPaying(false);
    }
  };

  /* интеграции — из app_data */
  const [ints, setInts] = useState(real.integrations);
  const intsSynced = useRef(false);
  useEffect(() => {
    if (!intsSynced.current && real.integrations.length) {
      intsSynced.current = true;
      setInts(real.integrations);
    }
  }, [real.integrations]);

  const createLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !newName.trim()) return;
    setSaving(true);
    try {
      const res = await api.createLaunch({ name: newName.trim(), expert: newExpert.trim() || undefined });
      push(`Запуск «${newName.trim()}» создан — оркестратор начал распаковку`, "mint");
      setNewName("");
      setNewExpert("");
      setCreating(false);
      // Обновляем список глобально
      await refreshLaunches();
      // И сразу делаем новый запуск активным
      if (res && res.id) setActiveLaunchId(res.id);
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Не удалось создать запуск", "coral");
    } finally {
      setSaving(false);
    }
  };

  const doneCount = real.checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-5">
      {/* режим */}
      <Reveal>
        <Panel className={`flex flex-wrap items-center gap-4 p-5 ${isOwner ? "border-mint/30" : "border-sky/30"}`}>
          <span className={`grid h-11 w-11 place-items-center rounded-xl ${isOwner ? "bg-mint/12 text-mint" : "bg-sky/12 text-sky"}`}>
            <Icon name={isOwner ? "shield" : "user"} size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[15px] font-extrabold text-ink">{session.name || session.login}</div>
            <div className="font-mono text-[10.5px] tracking-wider text-dim uppercase">
              {isOwner ? "полный доступ · реальные данные + мастер-панель" : "реальные данные · настройки владельца скрыты"}
            </div>
          </div>
          {isOwner ? (
            <Chip tone="mint"><Icon name="crown" size={12} /> владелец</Chip>
          ) : (
            <Chip tone="sky">эксперт</Chip>
          )}
          <button
            onClick={() => {
              logout();
              push("Вы вышли: refresh-токен отозван, включён режим витрины", "amber");
            }}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3.5 py-2 font-mono text-[11px] tracking-wide text-mut uppercase transition-colors hover:border-coral/40 hover:text-coral"
          >
            <Icon name="logout" size={14} /> Выйти
          </button>
        </Panel>
      </Reveal>

      {/* статус подписки */}
      <Reveal>
        <Panel className={`flex flex-wrap items-center gap-4 p-5 ${subscription === "pro" ? "border-mint/30" : subscription === "studio" ? "border-sky/30" : isFreeLimitReached ? "border-coral/30" : "border-amber/30"}`}>
          <span className={`grid h-11 w-11 place-items-center rounded-xl ${subscription === "pro" ? "bg-mint/12 text-mint" : subscription === "studio" ? "bg-sky/12 text-sky" : "bg-amber/12 text-amber"}`}>
            <Icon name={subscription === "free" ? "spark" : "crown"} size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[15px] font-extrabold text-ink">
              {subscription === "pro" ? "Тариф «Про»" : subscription === "studio" ? "Тариф «Студия»" : "Бесплатный тариф"}
            </div>
            <div className="font-mono text-[10.5px] tracking-wider text-dim uppercase">
              {subscription === "pro" || subscription === "studio"
                ? "Неограниченные запуски, брифы и анализ ниши"
                : isFreeLimitReached
                  ? "Бесплатный запуск использован — оформите тариф"
                  : "1 бесплатный запуск · далее — тариф «Про»"}
            </div>
          </div>
          <Chip tone={subscription === "pro" ? "mint" : subscription === "studio" ? "sky" : isFreeLimitReached ? "coral" : "amber"}>
            {subscription === "pro" ? "4 900 ₽/мес" : subscription === "studio" ? "по договорённости" : isFreeLimitReached ? "лимит исчерпан" : "1 запуск бесплатно"}
          </Chip>
          {subscription === "free" && (
                      <ToneBtn tone="amber" onClick={handlePay} disabled={paying}>
                        <Icon name="spark" size={14} /> {paying ? "Перенаправление..." : "Оформить тариф"} «Про»
                      </ToneBtn>
                    )}
                    {(subscription === "pro" || subscription === "studio") && (
                      <div className="flex flex-wrap items-center gap-3">
                        {subInfo.cancel_at ? (
                          <Chip tone="amber">Отменена с {new Date(subInfo.cancel_at).toLocaleDateString("ru-RU")}</Chip>
                        ) : (
                          <ToneBtn tone="ghost" onClick={handleCancelSub} disabled={cancelLoading}>
                            {cancelLoading ? "Отмена…" : "Отменить подписку"}
                          </ToneBtn>
                        )}
                        {subInfo.expires_at && (
                          <span className="text-sm text-dim">
                            Действует до {new Date(subInfo.expires_at).toLocaleDateString("ru-RU")}
                          </span>
                        )}
                      </div>
                    )}
                  </Panel>
                </Reveal>

      {/* мастер-панель */}
      {isOwner ? (
        <Reveal>
          <button onClick={() => go("master")} className="group relative w-full cursor-pointer overflow-hidden rounded-xl border border-mint/30 bg-gradient-to-r from-mint/[0.07] via-panel to-panel p-5 text-left transition-all duration-300 hover:border-mint/50 hover:shadow-[0_18px_44px_-20px_rgba(61,220,151,0.25)]">
            <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-mint/10 blur-3xl" />
            <div className="flex flex-wrap items-center gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-mint/15 text-mint"><Icon name="shield" size={23} /></span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[16px] font-extrabold text-ink">Мастер-панель владельца</div>
                <div className="text-[12.5px] text-mut">Базы Beget · токены Yandex Cloud · ключи интеграций · production-чеклист ({doneCount}/{real.checklist.length || 8})</div>
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
        {/* История платежей */}
                <Reveal className="xl:col-span-3">
                  <Panel className="p-5">
                    <Head kicker="YooKassa · таблица payments" title="История платежей" />
                    {paymentHistory.length === 0 ? (
                      <div className="mt-3 text-[12px] text-dim">Платежей пока нет</div>
                    ) : (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-left text-[12px]">
                          <thead>
                            <tr className="border-b border-line font-mono text-[10px] tracking-wider text-dim uppercase">
                              <th className="pb-2 pr-4">Тариф</th>
                              <th className="pb-2 pr-4">Сумма</th>
                              <th className="pb-2 pr-4">Дата</th>
                              <th className="pb-2">Статус</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentHistory.map((p, i) => (
                              <tr key={i} className="border-b border-line/50">
                                <td className="py-2.5 pr-4 text-ink">{p.tariff || p.description || '—'}</td>
                                <td className="py-2.5 pr-4 text-ink">{p.amount ? `${p.amount} ₽` : '—'}</td>
                                <td className="py-2.5 pr-4 text-mut">{p.created_at ? new Date(p.created_at).toLocaleDateString('ru-RU') : '—'}</td>
                                <td className="py-2.5">
                                  <Chip tone={p.status === 'succeeded' ? 'mint' : p.status === 'canceled' ? 'mut' : p.status === 'refunded' ? 'coral' : 'amber'}>
                                    {p.status === 'succeeded' ? 'Оплачен' : p.status === 'canceled' ? 'Отменён' : p.status === 'refunded' ? 'Возврат' : p.status}
                                  </Chip>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Panel>
                </Reveal>

                  {/* Профиль */}
        <Reveal>
          <Panel className="relative h-full overflow-hidden p-5">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky/10 blur-3xl" />
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-line2 bg-panel2 font-display text-xl font-extrabold text-amber">
                {(session.login || "?").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-display text-lg font-extrabold text-ink">{session.name || session.login}</div>
                <div className="font-mono text-[10.5px] tracking-wider text-dim uppercase">{isOwner ? "владелец сервиса" : "продюсер-эксперт"}</div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {[
                { l: "запусков", v: String(launches.length) },
                { l: "интеграций", v: String(real.integrations.filter((i) => i.on).length) },
                { l: "чек-лист", v: `${doneCount}/${real.checklist.length || 8}` },
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

        {/* запуски из БД (глобальные) */}
        <Reveal delay={100} className="xl:col-span-2">
          <Panel className="h-full p-5">
            <Head
              kicker="PostgreSQL · таблица launches"
              title="Ваши запуски"
              right={<Chip tone="mint">В БД: {launches.length}</Chip>}
            />

            <div className="mb-4">
              {isFreeLimitReached && !isOwner ? (
                <div className="flex items-center gap-3 rounded-lg border border-coral/30 bg-coral/[0.06] p-4">
                  <Icon name="lock" size={18} className="text-coral" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-coral">Бесплатный лимит исчерпан</div>
                    <div className="text-[12px] text-mut">Оформите тариф «Про» для создания новых запусков</div>
                  </div>
                  <ToneBtn tone="amber" onClick={handlePay} disabled={paying}>
                                      <Icon name="spark" size={14} /> {paying ? "Перенаправление..." : "Тариф"} «Про»
                  </ToneBtn>
                </div>
              ) : creating ? (
                  <form onSubmit={createLaunch} className="flex flex-wrap items-center gap-2.5 rounded-lg border border-mint/30 bg-mint/[0.04] p-3">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Название запуска"
                      className="min-w-0 flex-1 rounded-lg border border-line bg-deep/70 px-3.5 py-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-dim focus:border-mint/50"
                    />
                    <input
                      value={newExpert}
                      onChange={(e) => setNewExpert(e.target.value)}
                      placeholder="Эксперт (необязательно)"
                      className="min-w-0 flex-1 rounded-lg border border-line bg-deep/70 px-3.5 py-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-dim focus:border-mint/50"
                    />
                    <ToneBtn tone="mint" type="submit" disabled={saving || !newName.trim()}>
                                          {saving ? "создаём…" : "создать"}
                                        </ToneBtn>
                    <button type="button" onClick={() => setCreating(false)} className="cursor-pointer text-dim transition-colors hover:text-ink" aria-label="Отмена">
                      <Icon name="close" size={16} />
                    </button>
                  </form>
                ) : (
                  <ToneBtn tone="ghost" onClick={() => setCreating(true)}>
                    <Icon name="arrow" size={14} /> Создать новый запуск
                  </ToneBtn>
                )}
              </div>

            <div className="space-y-3">
              {launches.length === 0 ? (
                <div className="rounded-lg border border-dashed border-line2 px-6 py-10 text-center">
                  <div className="font-mono text-[12px] tracking-wide text-mut uppercase">Запусков пока нет</div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-dim">
                    Таблица launches пуста. {isOwner ? "Создайте первый запуск — оркестратор начнёт распаковку." : "Владелец создаст запуск, и он появится здесь."}
                  </p>
                </div>
              ) : (
                launches.map((l) => {
                  const tone = statusTone(l.status ?? "");
                  const active = (l.status ?? "").toLowerCase().includes("актив") || (l.status ?? "").toLowerCase().includes("active");
                  const isCurrent = l.id === activeLaunchId;

                  return (
                    <div 
                      key={l.id} 
                      className={`cursor-pointer rounded-lg border p-4 transition-all duration-300 hover:-translate-y-0.5 ${
                        isCurrent ? "border-amber/50 bg-amber/[0.04]" : "border-line bg-deep/40 hover:border-line2"
                      }`}
                      onClick={() => {
                        setActiveLaunchId(l.id);
                        if (!isCurrent) push(`Выбран запуск: ${l.name}`, "sky");
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Dot tone={tone} pulse={active} />
                          <div>
                            <div className="text-[13.5px] font-bold text-ink">
                              {l.name}
                              {isCurrent && <span className="ml-2 inline-block rounded border border-amber/30 bg-amber/10 px-1.5 py-0.5 font-mono text-[9px] text-amber uppercase">Текущий</span>}
                            </div>
                            <div className="font-mono text-[10.5px] text-dim">
                              {l.expert || "эксперт не указан"} · {l.stage || "—"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right font-mono text-[10px] text-dim">
                            {new Date(l.created_at).toLocaleDateString("ru-RU")}
                          </div>
                          <Chip tone={tone}>{l.status}</Chip>
                        </div>
                      </div>
                      <Bar pct={active ? 55 : (l.status ?? "").toLowerCase().includes("заверш") ? 100 : 15} tone={tone} className="mt-3" />
                    </div>
                  );
                })
              )}
            </div>
          </Panel>
        </Reveal>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* интеграции из app_data */}
        <Reveal className="xl:col-span-3">
          <Panel className="h-full p-5">
            <Head kicker="PostgreSQL · app_data.integrations" title="Интеграции" right={<Chip tone="sky">{ints.filter((i) => i.on).length} активно</Chip>} />
            {ints.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line2 px-6 py-8 text-center text-[12px] text-dim">
                Список интеграций загрузится из БД после первой синхронизации.
              </div>
            ) : (
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
                          push(it.on ? `${it.name}: соединение разорвано` : `${it.name}: подключено`, it.on ? "coral" : "mint");
                        }}
                        className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-300 ${it.on ? "bg-mint" : "border border-line2 bg-panel2"}`}
                      >
                        <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all duration-300 ${it.on ? "left-[22px] bg-deep" : "left-0.5 bg-dim"}`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </Reveal>

        {/* источники данных */}
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Reveal delay={90}>
            <Panel className="p-5">
              <Head kicker="Откуда приходят данные" title="Источники" />
              <ul className="space-y-2.5">
                <li className="flex items-center justify-between gap-3 rounded-lg border border-line bg-deep/50 px-4 py-3">
                  <div>
                    <div className="text-[12px] font-bold text-ink">PostgreSQL · Beget</div>
                    <div className="font-mono text-[10.5px] text-dim">{real.dbConns[0] ? `${real.dbConns[0].host}:${real.dbConns[0].port}/${real.dbConns[0].db}` : "адрес задаётся в мастер-панели"}</div>
                  </div>
                  <Chip tone={real.dbConns.length ? "mint" : "mut"}>{real.dbConns.length ? "в реестре" : "—"}</Chip>
                </li>
                <li className="flex items-center justify-between gap-3 rounded-lg border border-line bg-deep/50 px-4 py-3">
                  <div>
                    <div className="text-[12px] font-bold text-ink">YandexGPT</div>
                    <div className="font-mono text-[10.5px] text-dim">summary брифа, агенты, отчёты</div>
                  </div>
                  <Chip tone={real.tokens.some((t) => t.provider.includes("YandexGPT")) ? "mint" : "mut"}>
                    {real.tokens.some((t) => t.provider.includes("YandexGPT")) ? "ключ задан" : "нет ключа"}
                  </Chip>
                </li>
                <li className="flex items-center justify-between gap-3 rounded-lg border border-line bg-deep/50 px-4 py-3">
                  <div>
                    <div className="text-[12px] font-bold text-ink">PHP API · producer-ai.ru</div>
                    <div className="font-mono text-[10.5px] text-dim">JWT · rate-limit · CORS по домену</div>
                  </div>
                  <Chip tone="sky">online</Chip>
                </li>
              </ul>
            </Panel>
          </Reveal>
          <Reveal delay={160}>
            <Panel className={`flex-1 p-5 ${isOwner ? "border-mint/25" : "border-amber/25"}`}>
              <div className={`flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] uppercase ${isOwner ? "text-mint" : "text-amber"}`}>
                <Icon name="spark" size={13} /> {isOwner ? "режим владельца" : "принцип сервиса"}
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-mut">
                {isOwner
                  ? "Все изменения кабинета пишутся в app_data через PUT /api/data. Токены и подключения — в мастер-панели; секреты хранятся в .env на сервере, а не в браузере."
                  : "Клиент отвечает только на вопросы распаковки и одобряет решения. Данные хранятся в PostgreSQL, в браузере — только JWT-токен сессии."}
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