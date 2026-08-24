import { useEffect, useRef, useState } from "react";
import { FUNNEL_OPTIMIZED, FUNNEL_STAGES, FUNNEL_TIPS, type Tone } from "../data";
import { useAuth, useStore } from "../store";
import { Chip, Head, Icon, Panel, Range, Reveal, ToneBtn, useReducedMotion, fmt } from "../ui";

export default function Funnel({ push }: { push: (t: string, tone?: Tone) => void }) {
  const reduced = useReducedMotion();
  const { live } = useAuth();
  const { real, set } = useStore();
  const [stages, setStages] = useState(FUNNEL_STAGES);
  const [traffic, setTraffic] = useState(12000);
  const [price, setPrice] = useState(24900);
  const animRef = useRef(0);

  // в live-режиме синхронизируемся с реальными данными из хранилища
  useEffect(() => {
    if (live) {
      setStages(real.funnel);
      setTraffic(real.traffic);
      setPrice(real.price);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const persist = (patch: { stages?: typeof FUNNEL_STAGES; traffic?: number; price?: number }) => {
    if (!live) return;
    set({
      ...(patch.stages ? { funnel: patch.stages } : {}),
      ...(patch.traffic !== undefined ? { traffic: patch.traffic } : {}),
      ...(patch.price !== undefined ? { price: patch.price } : {}),
    });
  };

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
  const revenue = sales * price + tripSales * 990;
  const spend = 150000;
  const romi = ((revenue - spend) / spend) * 100;
  const cac = sales > 0 ? spend / sales : 0;

  const setStage = (id: string, v: number) => {
    const next = stages.map((x) => (x.id === id ? { ...x, value: v } : x));
    setStages(next);
    persist({ stages: next });
  };

  const optimize = () => {
    const optimized = stages.map((x) => ({ ...x, value: FUNNEL_OPTIMIZED[x.id] }));
    if (reduced) {
      setStages(optimized);
      persist({ stages: optimized });
      push("ИИ-оптимизация применена: +163 000 ₽ к прогнозу выручки", "mint");
      return;
    }
    cancelAnimationFrame(animRef.current);
    const from = stages.map((s) => s.value);
    const to = stages.map((s) => FUNNEL_OPTIMIZED[s.id]);
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      const e = 1 - Math.pow(1 - p, 3);
      setStages((s) => s.map((x, i) => ({ ...x, value: from[i] + (to[i] - from[i]) * e })));
      if (p < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        persist({ stages: optimized });
        push("ИИ-оптимизация применена: +163 000 ₽ к прогнозу выручки", "mint");
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
                    <span>Эталон ниши: <b className="text-mut">{s.bench.toFixed(1).replace(".", ",")}%</b> · {FUNNEL_TIPS[s.id]}</span>
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
              <Range value={traffic} min={4000} max={40000} step={500} onChange={(v) => { setTraffic(v); persist({ traffic: v }); }} />
            </div>
            <div className="rounded-lg border border-line bg-deep/40 p-4">
              <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-mut">
                <span>Цена курса</span><span className="text-amber">{fmt(price)} ₽</span>
              </div>
              <Range value={price} min={9900} max={59900} step={100} onChange={(v) => { setPrice(v); persist({ price: v }); }} />
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

          <ToneBtn className="w-full justify-center" onClick={optimize}>
            <Icon name="spark" size={15} /> Применить ИИ-оптимизацию воронки
          </ToneBtn>
          <button onClick={() => push("Конфигурация воронки сохранена как шаблон «Вебинар v3» — доступна для следующих запусков", "sky")} className="w-full cursor-pointer rounded-lg border border-line py-2.5 font-mono text-[11px] tracking-wide text-mut uppercase transition-colors hover:border-sky/40 hover:text-sky">
            Сохранить как шаблон запуска
          </button>
        </div>
      </Reveal>
    </div>
  );
}
