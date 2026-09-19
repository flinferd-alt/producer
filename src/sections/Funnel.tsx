import { useEffect, useRef, useState } from "react";
import { api, apiFetch, ApiError } from "../api";
import { useAuth, useStore } from "../store";
import type { FunnelContext } from "../store";
import { Chip, Head, Icon, LockedNote, Panel, Range, Reveal, ToneBtn, useReducedMotion, fmt } from "../ui";
import type { Tone } from "../data";

type Stage = FunnelContext["stages"][number];

/** Пустая структура воронки — до генерации ИИ. */
const EMPTY_STAGES: Stage[] = [
  { id: "reg", label: "Клик → регистрация на вебинар", value: 8.5, bench: 7.0, tip: "", opt: 9.8 },
  { id: "show", label: "Регистрация → пришли на эфир", value: 45, bench: 42, tip: "", opt: 51 },
  { id: "stay", label: "Эфир → досмотрели до оффера", value: 60, bench: 55, tip: "", opt: 64 },
  { id: "buy", label: "Досмотрели → купили курс", value: 6.5, bench: 5.2, tip: "", opt: 7.4 },
  { id: "trip", label: "Не купили → взяли трипваер", value: 4.5, bench: 3.5, tip: "", opt: 5.6 },
];

const SPEND = 150000;

export default function Funnel({ push }: { push: (t: string, tone?: Tone) => void }) {
  const reduced = useReducedMotion();
  const { live } = useAuth();
  const { activeLaunchId, tripwireContext, funnelContext, setFunnelContext, refreshLaunches } = useStore();
  const [mode, setMode] = useState<"loading" | "empty" | "generating" | "data">("loading");
  const [data, setData] = useState<FunnelContext | null>(null);
  const [stages, setStages] = useState<Stage[]>(EMPTY_STAGES);
  const [traffic, setTraffic] = useState(12000);
  const [price, setPrice] = useState(24900);
  const animRef = useRef(0);

  // Данные уже в сторе (после генерации) — подхватываем без запроса
  useEffect(() => {
    if (funnelContext) {
      setData(funnelContext);
      setMode("data");
    }
  }, [funnelContext]);

  // Загружаем воронку с API при смене запуска
  useEffect(() => {
    if (!live || !activeLaunchId) {
      setMode("empty");
      return;
    }
    let mounted = true;
    setMode("loading");
    apiFetch<FunnelContext>(`/launches/${activeLaunchId}/funnel`)
      .then((res) => {
        if (mounted) {
          setData(res);
          setMode("data");
        }
      })
      .catch(() => {
        if (mounted) setMode("empty");
      });
    return () => {
      mounted = false;
    };
  }, [activeLaunchId, live]);

  // Синк локального симулятора из снапшота ИИ
  useEffect(() => {
    if (!data) return;
    setStages(data.stages.length ? data.stages : EMPTY_STAGES);
    setTraffic(data.traffic || 12000);
    setPrice(data.price || 24900);
  }, [data]);

  const generate = async () => {
    if (!live || !activeLaunchId) return;
    setMode("generating");
    push("ИИ-продюсер проектирует воронку...", "amber");
    try {
      await api.generateFunnel(activeLaunchId);
      const res = await apiFetch<FunnelContext>(`/launches/${activeLaunchId}/funnel`);
      setData(res);
      setFunnelContext(res);
      setMode("data");
      push("Воронка сгенерирована", "mint");
      void refreshLaunches();
    } catch (e) {
      setMode("empty");
      push(e instanceof ApiError ? e.message : "Не удалось сгенерировать воронку", "coral");
    }
  };

  if (!live) {
    return <LockedNote title="Воронка продаж" text="ИИ-продюсер проектирует воронку запуска: этапы с конверсиями, бенчмарки ниши, точки оптимизации и прогноз юнит-экономики с учётом трипваера. Войдите, чтобы сгенерировать воронку." />;
  }

  if (mode === "loading") {
    return (
      <Panel className="p-10 text-center">
        <div className="font-mono text-[11px] tracking-wider text-dim uppercase">Загружаем воронку запуска...</div>
      </Panel>
    );
  }

  if (mode === "generating") {
    return (
      <Panel className="p-10 text-center">
        <div className="flex items-center justify-center gap-3">
          <Icon name="spark" size={16} className="text-amber" />
          <span className="font-mono text-[11px] tracking-wider text-amber uppercase">ИИ-продюсер проектирует воронку...</span>
        </div>
      </Panel>
    );
  }

  if (mode === "empty") {
    return (
      <Reveal>
        <Panel className="p-10 text-center">
          <Head kicker="Воронка продаж" title="Воронка ещё не спроектирована" />
          <p className="mx-auto mt-2 max-w-lg text-[12.5px] leading-relaxed text-mut">
            ИИ-продюсер соберёт воронку под ваш запуск: этапы с конверсиями, бенчмарки ниши,
            точки оптимизации и прогноз юнит-экономики с учётом трипваера.
          </p>
          <div className="mt-6">
            <ToneBtn onClick={generate} tone="coral">
              <Icon name="spark" size={16} /> Сгенерировать воронку
            </ToneBtn>
          </div>
        </Panel>
      </Reveal>
    );
  }

  const reg = stages[0].value;
  const show = stages[1].value;
  const stay = stages[2].value;
  const buy = stages[3].value;
  const trip = stages[4].value;

  const leads = (traffic * reg) / 100;
  const showed = (leads * show) / 100;
  const stayed = (showed * stay) / 100;
  const sales = (stayed * buy) / 100;
  const tripSales = ((stayed - sales) * trip) / 100;
  const twPrice = tripwireContext?.price ?? 990;
  const revenue = sales * price + tripSales * twPrice;
  const spend = SPEND;
  const romi = ((revenue - spend) / spend) * 100;
  const cac = sales > 0 ? spend / sales : 0;

  const setStage = (id: string, v: number) => {
    setStages((prev) => prev.map((x) => (x.id === id ? { ...x, value: v } : x)));
  };

  const optimize = () => {
    const optimized = stages.map((x) => ({ ...x, value: x.opt }));
    const delta = ((optimized.reduce((s, x) => s + x.value, 0) - stages.reduce((s, x) => s + x.value, 0)) / 100) * 100;
    if (reduced) {
      setStages(optimized);
      push("ИИ-оптимизация воронки применена", "mint");
      return;
    }
    cancelAnimationFrame(animRef.current);
    const from = stages.map((s) => s.value);
    const to = stages.map((s) => s.opt);
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      const e = 1 - Math.pow(1 - p, 3);
      setStages((s) => s.map((x, i) => ({ ...x, value: from[i] + (to[i] - from[i]) * e })));
      if (p < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        push(`ИИ-оптимизация применена: +${fmt(Math.round(delta))} п.п. суммарного прироста конверсий`, "mint");
      }
    };
    animRef.current = requestAnimationFrame(tick);
  };

  const maxAbs = Math.max(leads, showed, stayed, sales);
  const rows = [
    { label: "Клики по рекламе", value: traffic, tone: "text-sky" },
    { label: "Регистрации на вебинар", value: leads, tone: "text-sky" },
    { label: "Пришли на эфир", value: showed, tone: "text-amber" },
    { label: "Досмотрели до оффера", value: stayed, tone: "text-amber" },
    { label: "Купили курс", value: sales, tone: "text-mint" },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      {/* editor */}
      <Reveal className="xl:col-span-3">
        <Panel className="h-full p-5">
          <Head kicker="Симулятор воронки · вебинарная модель" title="Крутите конверсии — прогноз считается мгновенно" right={<Chip tone="amber">юнит-экономика live</Chip>} />

          <div className="space-y-4">
            {stages.map((s) => {
              const delta = s.value - s.bench;
              return (
                <div key={s.id} className="rounded-lg border border-line bg-deep/40 p-4 transition-colors hover:border-line2">
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-ink">{s.label}</span>
                    <div className="flex items-center gap-2.5">
                      <span className={`font-mono text-[10.5px] ${delta >= 0 ? "text-mint" : "text-coral"}`}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1).replace(".", ",")} п.п. к эталону</span>
                      <span className="font-display text-[17px] font-extrabold text-amber w-16 text-right">{s.value.toFixed(1).replace(".", ",")}%</span>
                    </div>
                  </div>
                  <Range value={s.value} min={0.5} max={s.id === "reg" || s.id === "buy" || s.id === "trip" ? 15 : 90} step={0.1} onChange={(v) => setStage(s.id, v)} />
                  <div className="mt-2 flex items-start gap-2 text-[11px] leading-snug text-dim">
                    <Icon name="spark" size={12} className="mt-0.5 shrink-0 text-sky" />
                    <span>Эталон ниши: <b className="text-mut">{s.bench.toFixed(1).replace(".", ",")}%</b>{s.tip ? <> · {s.tip}</> : null}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-deep/40 p-4">
              <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-mut">
                <span>Клики (трафик за запуск)</span><span className="text-amber">{fmt(traffic)}</span>
              </div>
              <Range value={traffic} min={4000} max={40000} step={500} onChange={(v) => setTraffic(v)} />
            </div>
            <div className="rounded-lg border border-line bg-deep/40 p-4">
              <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-mut">
                <span>Цена курса</span><span className="text-amber">{fmt(price)} ₽</span>
              </div>
              <Range value={price} min={9900} max={59900} step={100} onChange={(v) => setPrice(v)} />
            </div>
          </div>
        </Panel>
      </Reveal>

      {/* forecast */}
      <Reveal delay={110} className="xl:col-span-2">
        <div className="flex h-full flex-col gap-4">
          <Panel className="p-5">
            <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Прогноз запуска</div>
            <div className="mt-3 space-y-2.5">
              {rows.map((r, i) => (
                <div key={r.label} className="flex items-center gap-3">
                  <div className="w-44 shrink-0">
                    <div className="text-[11.5px] leading-tight text-mut">{r.label}</div>
                  </div>
                  <div className="h-6 flex-1 overflow-hidden rounded-md bg-line/40">
                    <div
                      className={`flex h-full items-center rounded-md pl-2 font-mono text-[10.5px] font-bold text-deep transition-all duration-500 ${i === 0 ? "bg-sky/70" : i < 2 ? "bg-sky" : i < 4 ? "bg-amber" : "bg-mint"}`}
                      style={{ width: `${Math.max(9, (r.value / maxAbs) * 100)}%`, minWidth: 64 }}
                    >
                      {fmt(r.value)}
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <div className="w-44 shrink-0 text-[11.5px] text-mut">+ трипваер</div>
                <div className="h-6 flex-1">
                  <div className="flex h-full w-fit min-w-[64px] items-center rounded-md bg-coral/80 pl-2 pr-2 font-mono text-[10.5px] font-bold text-deep transition-all duration-500">{fmt(tripSales)}</div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel className={`p-5 ${romi >= 250 ? "border-mint/30" : romi >= 100 ? "border-amber/30" : "border-coral/30"}`}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="font-mono text-[10px] tracking-wider text-dim uppercase">Выручка</div>
                <div className="mt-1 font-display text-[26px] font-extrabold leading-none text-ink">{fmt(revenue)} ₽</div>
              </div>
              <div>
                <div className="font-mono text-[10px] tracking-wider text-dim uppercase">ROMI</div>
                <div className={`mt-1 font-display text-[26px] font-extrabold leading-none ${romi >= 250 ? "text-mint" : romi >= 100 ? "text-amber" : "text-coral"}`}>{fmt(romi)}%</div>
              </div>
              <div>
                <div className="font-mono text-[10px] tracking-wider text-dim uppercase">CAC</div>
                <div className="mt-1 font-display text-lg font-bold text-ink">{fmt(cac)} ₽</div>
              </div>
              <div>
                <div className="font-mono text-[10px] tracking-wider text-dim uppercase">Продаж курса</div>
                <div className="mt-1 font-display text-lg font-bold text-ink">{fmt(sales)}</div>
              </div>
            </div>
            <div className={`mt-3 rounded-lg px-3.5 py-2.5 font-mono text-[11px] leading-relaxed ${romi >= 250 ? "bg-mint/10 text-mint" : romi >= 100 ? "bg-amber/10 text-amber" : "bg-coral/10 text-coral"}`}>
              {romi >= 250
                ? "Воронка эффективнее эталона. Есть запас на масштабирование трафика +30%."
                : romi >= 100
                  ? "Воронка в плюсе, но ниже эталона 300%. ИИ видит 2 точки роста — справа."
                  : "Воронка в минусе. Срочно: поднимите доходимость и конверсию в покупку."}
            </div>
          </Panel>

          {data?.ai_verdict ? (
            <Panel className="p-5">
              <div className="flex items-start gap-3">
                <Icon name="spark" size={14} className="mt-1 shrink-0 text-amber" />
                <div>
                  <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Вердикт ИИ-продюсера</div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-mut">{data.ai_verdict}</p>
                  {data.recommendations?.length ? (
                    <ul className="mt-3 space-y-1.5">
                      {data.recommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] leading-snug text-dim">
                          <span className="mt-0.5 text-mint">▲</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </Panel>
          ) : null}

          <ToneBtn className="w-full justify-center" onClick={optimize}>
            <Icon name="spark" size={15} /> Применить ИИ-оптимизацию воронки
          </ToneBtn>
          <button onClick={generate} className="w-full cursor-pointer rounded-lg border border-line py-2.5 font-mono text-[11px] tracking-wide text-mut uppercase transition-colors hover:border-sky/40 hover:text-sky">
            Перегенерировать воронку
          </button>
        </div>
      </Reveal>
    </div>
  );
}
