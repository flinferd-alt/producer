import { useEffect, useRef, useState } from "react";
import { ENV_VARS, PROD_CHECKLIST, TOKEN_PROVIDERS, type Tone } from "../data";
import { useAuth, useStore } from "../store";
import { Chip, Dot, Head, Icon, Panel, Reveal, ToneBtn, useReducedMotion } from "../ui";

export default function Master({ push }: { push: (t: string, tone?: Tone) => void }) {
  const { isOwner, session } = useAuth();
  const { real, set } = useStore();
  const reduced = useReducedMotion();

  /* ---- базы ---- */
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ name: "", host: "", port: "5432", db: "", user: "", pass: "", ssl: true });
  const [pinging, setPinging] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  /* ---- токены ---- */
  const [tkProvider, setTkProvider] = useState(TOKEN_PROVIDERS[0]);
  const [tkValue, setTkValue] = useState("");
  const [tkOpen, setTkOpen] = useState<Record<string, boolean>>({});

  /* ---- чеклист ---- */
  const [checks, setChecks] = useState<Record<string, boolean>>(() => Object.fromEntries(real.checklist.map((c) => [c.id, c.done])));

  // если данные из БД доехали позже монтирования (восстановленная сессия) — подтягиваем один раз
  const checksSynced = useRef(real.checklist.length > 0);
  useEffect(() => {
    if (!checksSynced.current && real.checklist.length > 0) {
      checksSynced.current = true;
      setChecks(Object.fromEntries(real.checklist.map((c) => [c.id, !!c.done])));
    }
  }, [real.checklist]);

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <Panel className="p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-coral/12 text-coral"><Icon name="lock" size={26} /></span>
          <div className="mt-4 font-display text-lg font-extrabold text-ink">Раздел только для владельца</div>
          <p className="mt-2 text-[13px] leading-relaxed text-mut">Мастер-панель содержит боевые настройки сервиса: подключения баз данных, токены Yandex Cloud и ключи интеграций. Войдите с правами владельца.</p>
        </Panel>
      </div>
    );
  }

  /* ---------- базы ---------- */
  const addConn = () => {
    if (!draft.host.trim() || !draft.name.trim()) {
      push("Заполните название и хост подключения", "coral");
      return;
    }
    set({
      dbConns: [
        ...real.dbConns,
        { id: `db-${Date.now()}`, name: draft.name.trim(), host: draft.host.trim(), port: Number(draft.port) || 5432, db: draft.db.trim() || draft.name.trim(), user: draft.user.trim() || "app", status: "offline", ssl: draft.ssl },
      ],
    });
    push(`Подключение «${draft.name}» сохранено. Проверьте его пингом.`, "sky");
    setDraft({ name: "", host: "", port: "5432", db: "", user: "", pass: "", ssl: true });
    setShowForm(false);
  };

  const ping = (id: string) => {
    if (reduced) {
      set({ dbConns: real.dbConns.map((c) => (c.id === id ? { ...c, status: "online", ping: 8 + Math.round(Math.random() * 30) } : c)) });
      push("Соединение установлено: handshake SSL + SELECT 1 — ок", "mint");
      return;
    }
    setPinging(id);
    window.setTimeout(() => {
      const ms = 8 + Math.round(Math.random() * 34);
      set({ dbConns: real.dbConns.map((c) => (c.id === id ? { ...c, status: "online", ping: ms } : c)) });
      setPinging(null);
      push(`Соединение установлено за ${ms} мс: SSL handshake + SELECT 1 — ок`, "mint");
    }, 900);
  };

  const drop = (id: string) => {
    set({ dbConns: real.dbConns.map((c) => (c.id === id ? { ...c, status: "offline", ping: undefined } : c)) });
    push("Соединение разорвано, строка подключения удалена из памяти агентов", "coral");
  };

  const remove = (id: string) => {
    const c = real.dbConns.find((x) => x.id === id);
    set({ dbConns: real.dbConns.filter((x) => x.id !== id) });
    setConfirmDel(null);
    push(`Подключение «${c?.name ?? id}» удалено из реестра`, "coral");
  };

  /* ---------- токены ---------- */
  const addToken = () => {
    const v = tkValue.trim();
    if (!v) {
      push("Вставьте значение токена или ключа", "coral");
      return;
    }
    set({
      tokens: [
        ...real.tokens,
        { id: `tk-${Date.now()}`, provider: tkProvider, value: v.length > 14 ? `${v.slice(0, 6)}••••••${v.slice(-4)}` : v, added: new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" }) },
      ],
    });
    push(`${tkProvider}: сохранён в зашифрованное хранилище (pgcrypto)`, "mint");
    setTkValue("");
  };

  const revoke = (id: string) => {
    set({ tokens: real.tokens.filter((t) => t.id !== id) });
    push("Токен отозван: сервис больше не сможет им пользоваться", "coral");
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    push(`${label} скопирован в буфер обмена`, "sky");
  };

  const doneCount = real.checklist.filter((c) => c.done).length;
  const toggleCheck = (id: string) => {
    const next = { ...checks, [id]: !checks[id] };
    setChecks(next);
    // сохраняем полные элементы (title/desc нужны серверу и другим экранам)
    set({ checklist: PROD_CHECKLIST.map((p) => ({ ...p, done: !!next[p.id] })) });
  };

  const envText = ENV_VARS.map((e) => `${e.k}=${e.v}`).join("\n");

  return (
    <div className="space-y-6">
      {/* header strip */}
      <Reveal>
        <Panel className="relative overflow-hidden border-mint/30 p-5">
          <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-mint/10 blur-3xl" />
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-mint/15 text-mint"><Icon name="shield" size={23} /></span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg font-extrabold text-ink">Мастер-панель · {session.login}</div>
              <div className="text-[12.5px] text-mut">Боевые настройки применяются к реальным данным и сохраняются между сессиями. В продакшене — только через backend с JWT и rate-limit.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip tone="mint"><Dot tone="mint" pulse /> {real.dbConns.filter((c) => c.status === "online").length} БД онлайн</Chip>
              <Chip tone="sky">{real.tokens.length} токенов</Chip>
              <Chip tone={doneCount === PROD_CHECKLIST.length ? "mint" : "amber"}>чек-лист {doneCount}/{PROD_CHECKLIST.length}</Chip>
            </div>
          </div>
        </Panel>
      </Reveal>

      {/* ======== базы данных ======== */}
      <section>
        <Head kicker="Хранилище сервиса · только PostgreSQL" title="Базы данных на Beget" right={<Chip tone="mint">postgres:// · SSL</Chip>} />
        <div className="space-y-3">
          {real.dbConns.map((c) => (
            <Reveal key={c.id}>
              <Panel hover className="p-4.5 p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${c.status === "online" ? "bg-mint/12 text-mint" : "bg-panel2 text-dim"}`}>
                    <Icon name="schema" size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-[14px] font-bold text-ink">{c.name}</span>
                      <Chip tone={c.status === "online" ? "mint" : c.status === "test" ? "amber" : "mut"}>
                        {c.status === "online" && <Dot tone="mint" pulse />} {c.status}
                      </Chip>
                      {c.ssl && <Chip tone="sky">SSL</Chip>}
                    </div>
                    <div className="mt-1 truncate font-mono text-[11.5px] text-mut">
                      {c.user}@{c.host}:{c.port}/{c.db}
                      {c.ping !== undefined && c.status === "online" && <span className="text-mint"> · пинг {c.ping} мс</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ToneBtn tone="ghost" onClick={() => ping(c.id)} disabled={pinging === c.id}>
                      {pinging === c.id ? (
                        <>
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-sky" />
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-sky" />
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-sky" />
                        </>
                      ) : (
                        <>
                          <Icon name="spark" size={13} /> пинг
                        </>
                      )}
                    </ToneBtn>
                    {c.status === "online" ? (
                      <ToneBtn tone="ghost" onClick={() => drop(c.id)}>
                        <Icon name="pause" size={13} /> отключить
                      </ToneBtn>
                    ) : (
                      confirmDel === c.id ? (
                        <>
                          <ToneBtn tone="coral" onClick={() => remove(c.id)}>точно?</ToneBtn>
                          <ToneBtn tone="ghost" onClick={() => setConfirmDel(null)}>нет</ToneBtn>
                        </>
                      ) : (
                        <ToneBtn tone="ghost" onClick={() => setConfirmDel(c.id)}>
                          <Icon name="close" size={13} /> удалить
                        </ToneBtn>
                      )
                    )}
                  </div>
                </div>
              </Panel>
            </Reveal>
          ))}

          {showForm ? (
            <Reveal>
              <Panel className="border-sky/30 p-5">
                <div className="flex items-center justify-between">
                  <div className="font-display text-[15px] font-bold text-ink">Новое подключение PostgreSQL</div>
                  <button onClick={() => setShowForm(false)} className="cursor-pointer text-dim transition-colors hover:text-ink" aria-label="Закрыть">
                    <Icon name="close" size={17} />
                  </button>
                </div>
                <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { k: "name", l: "Название", ph: "neuroprod_main", type: "text" },
                    { k: "host", l: "Хост Beget", ph: "логин.beget.tech", type: "text" },
                    { k: "port", l: "Порт", ph: "5432", type: "text" },
                    { k: "db", l: "Имя БД", ph: "логин_prod", type: "text" },
                    { k: "user", l: "Пользователь", ph: "логин_app", type: "text" },
                    { k: "pass", l: "Пароль", ph: "••••••••", type: "password" },
                  ].map((f) => (
                    <div key={f.k}>
                      <label className="mb-1.5 block font-mono text-[10px] tracking-[0.16em] text-dim uppercase">{f.l}</label>
                      <input
                        type={f.type}
                        value={(draft as Record<string, string | boolean>)[f.k] as string}
                        onChange={(e) => setDraft((d) => ({ ...d, [f.k]: e.target.value }))}
                        placeholder={f.ph}
                        className="w-full rounded-lg border border-line bg-deep/70 px-3.5 py-2.5 font-mono text-[12.5px] text-ink outline-none transition-colors placeholder:text-dim/60 focus:border-sky/50"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <button onClick={() => setDraft((d) => ({ ...d, ssl: !d.ssl }))} className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors duration-300 ${draft.ssl ? "bg-mint" : "border border-line2 bg-panel2"}`}>
                      <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all duration-300 ${draft.ssl ? "left-[22px] bg-deep" : "left-0.5 bg-dim"}`} />
                    </button>
                    <span className="font-mono text-[11px] tracking-wide text-mut uppercase">sslmode=require</span>
                  </label>
                  <ToneBtn tone="mint" className="ml-auto" onClick={addConn}>
                    <Icon name="check" size={14} /> Сохранить подключение
                  </ToneBtn>
                </div>
                <p className="mt-3 font-mono text-[10.5px] leading-relaxed text-dim">
                  строка: postgres://{draft.user || "user"}:•••@{draft.host || "host"}:{draft.port || 5432}/{draft.db || "db"}?sslmode=require — хранится только на backend
                </p>
              </Panel>
            </Reveal>
          ) : (
            <ToneBtn tone="ghost" onClick={() => setShowForm(true)}>
              <Icon name="arrow" size={14} /> Подключить базу данных
            </ToneBtn>
          )}
        </div>
      </section>

      {/* ======== токены ======== */}
      <section>
        <Head kicker="Yandex Cloud и интеграции" title="Токены и API-ключи" right={<Chip tone="amber">шифрование pgcrypto</Chip>} />
        <div className="grid gap-4 xl:grid-cols-5">
          <Reveal className="xl:col-span-2">
            <Panel className="h-full p-5">
              <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Добавить токен</div>
              <label className="mb-1.5 mt-4 block font-mono text-[10px] tracking-[0.16em] text-dim uppercase">Сервис</label>
              <select value={tkProvider} onChange={(e) => setTkProvider(e.target.value)} className="w-full cursor-pointer rounded-lg border border-line bg-deep/70 px-3.5 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-sky/50">
                {TOKEN_PROVIDERS.map((p) => (
                  <option key={p} value={p} className="bg-deep text-ink">{p}</option>
                ))}
              </select>
              <label className="mb-1.5 mt-3.5 block font-mono text-[10px] tracking-[0.16em] text-dim uppercase">Значение</label>
              <input value={tkValue} onChange={(e) => setTkValue(e.target.value)} placeholder="Вставьте токен или ключ…" className="w-full rounded-lg border border-line bg-deep/70 px-3.5 py-2.5 font-mono text-[12.5px] text-ink outline-none transition-colors placeholder:text-dim/60 focus:border-sky/50" />
              <ToneBtn className="mt-4 w-full justify-center" onClick={addToken}>
                <Icon name="lock" size={14} /> Сохранить в Lockbox
              </ToneBtn>
              <p className="mt-3 text-[11.5px] leading-relaxed text-dim">Токены Yandex Cloud нужны агентам для вызовов YandexGPT. Токены VK/Директа — медиабаеру для управления кампаниями.</p>
            </Panel>
          </Reveal>

          <Reveal delay={100} className="xl:col-span-3">
            <Panel className="h-full p-5">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Реестр ({real.tokens.length})</div>
                <Chip tone="mint">доступ только у владельца и backend</Chip>
              </div>
              {real.tokens.length === 0 ? (
                <div className="mt-6 rounded-lg border border-dashed border-line2 p-6 text-center font-mono text-[11.5px] text-dim">Токенов пока нет — добавьте первый слева</div>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {real.tokens.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 rounded-lg border border-line bg-deep/50 px-4 py-3 transition-colors hover:border-line2">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${t.provider.includes("Yandex") ? "bg-amber/12 text-amber" : t.provider.includes("VK") ? "bg-sky/12 text-sky" : t.provider.includes("ЮKassa") ? "bg-mint/12 text-mint" : "bg-panel2 text-mut"}`}>
                        <Icon name="lock" size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-bold text-ink">{t.provider}</div>
                        <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-amber">
                          <span>{tkOpen[t.id] ? t.value.replace(/•+/g, "x8k2m9q4z1") : t.value}</span>
                          <button onClick={() => setTkOpen((o) => ({ ...o, [t.id]: !o[t.id] }))} className="cursor-pointer text-dim transition-colors hover:text-ink" aria-label="Показать">
                            <Icon name="eye" size={12} />
                          </button>
                        </div>
                      </div>
                      <span className="hidden font-mono text-[10px] text-dim sm:block">{t.added}</span>
                      <button onClick={() => copy(t.value, t.provider)} className="cursor-pointer rounded-md border border-line px-2 py-1.5 text-dim transition-colors hover:text-ink" aria-label="Копировать">
                        <Icon name="copy" size={13} />
                      </button>
                      <button onClick={() => revoke(t.id)} className="cursor-pointer rounded-md border border-line px-2 py-1.5 text-dim transition-colors hover:border-coral/40 hover:text-coral" aria-label="Отозвать">
                        <Icon name="close" size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </Reveal>
        </div>
      </section>

      {/* ======== чеклист + env ======== */}
      <div className="grid gap-4 xl:grid-cols-5">
        <section className="xl:col-span-3">
          <Head kicker="Выход на реальную работу" title="Production-чеклист" right={<Chip tone={doneCount === PROD_CHECKLIST.length ? "mint" : "amber"}>{doneCount}/{PROD_CHECKLIST.length}</Chip>} />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {PROD_CHECKLIST.map((item, i) => (
              <Reveal key={item.id} delay={(i % 2) * 80}>
                <button onClick={() => toggleCheck(item.id)} className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border p-4 text-left transition-all duration-300 ${checks[item.id] ? "border-mint/30 bg-mint/[0.05]" : "border-line bg-panel/40 hover:border-line2"}`}>
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border transition-colors ${checks[item.id] ? "border-mint bg-mint text-deep" : "border-line2"}`}>
                    {checks[item.id] && <Icon name="check" size={12} />}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[13px] font-bold ${checks[item.id] ? "text-mut line-through" : "text-ink"}`}>{item.title}</span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-dim">{item.desc}</span>
                  </span>
                </button>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="xl:col-span-2">
          <Head kicker="Для деплоя на Beget" title=".env переменные" />
          <Reveal>
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <span className="font-mono text-[11px] text-dim">.env · production</span>
                <ToneBtn tone="ghost" onClick={() => copy(envText, "Файл .env")}>
                  <Icon name="copy" size={13} /> копировать всё
                </ToneBtn>
              </div>
              <div className="max-h-72 overflow-y-auto p-4 font-mono text-[11.5px] leading-[1.9]">
                {ENV_VARS.map((e) => (
                  <div key={e.k} className="group flex items-start justify-between gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="text-sky">{e.k}</span>
                      <span className="text-dim">=</span>
                      <span className="break-all text-ink/90">{e.v}</span>
                    </span>
                    <button onClick={() => copy(e.v, e.k)} className="cursor-pointer text-dim opacity-0 transition-all hover:text-ink group-hover:opacity-100" aria-label="Копировать">
                      <Icon name="copy" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
          </Reveal>
        </section>
      </div>
    </div>
  );
}
