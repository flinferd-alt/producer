import { useEffect, useState } from "react";
import { FEED, KPIS, PIPELINE, type Tone } from "../data";
import { useAuth, useStore } from "../store";
import { Bar, Chip, Dot, Head, Icon, Num, Panel, Reveal, Spark, ToneBtn, useReducedMotion, TONE_TEXT, fmt } from "../ui";

const SPARK_COLOR: Record<Tone, string> = { amber: "#ffb224", mint: "#3ddc97", coral: "#ff6a55", sky: "#5fb9ff", mut: "#5c7291" };

export default function Dashboard({ go, push }: { go: (id: string) => void; push: (t: string, tone?: Tone) => void }) {
  const reduced = useReducedMotion();
  const { live } = useAuth();
  const { real } = useStore();
  const [feed, setFeed] = useState(FEED);
  const kpis = live ? real.kpis : KPIS;

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setFeed((f) => [...f.slice(1), f[0]]), 4200);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k, i) => (
          <Reveal key={k.label} delay={i * 70}>
            <Panel hover className="relative overflow-hidden p-4">
              <div className="mb-1 font-mono text-[10.5px] tracking-[0.14em] text-dim uppercase">{k.label}</div>
              <div className="flex items-end justify-between gap-2">
                <Num value={k.value} prefix={k.prefix} suffix={k.suffix} className="font-display text-[22px] font-extrabold leading-none tracking-tight xl:text-2xl" />
                <Spark data={k.series} color={SPARK_COLOR[k.tone]} w={72} h={26} />
              </div>
              <div className="mt-2.5">
                <Chip tone={k.up ? "mint" : "coral"}>{k.up ? "▲" : "▼"} {k.delta}</Chip>
              </div>
              <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl opacity-[0.13] ${k.tone === "amber" ? "bg-amber" : k.tone === "mint" ? "bg-mint" : k.tone === "coral" ? "bg-coral" : "bg-sky"}`} />
            </Panel>
          </Reveal>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* launch timeline */}
        <Reveal className="xl:col-span-2">
          <Panel className="scan relative h-full overflow-hidden p-5">
            <Head
              kicker="Запуск «Нейрофотография» · день 12 из 21"
              title="Каркас запуска"
              right={<Chip tone="amber">выполнено 57%</Chip>}
            />
            <Bar pct={57} tone="amber" className="mb-5 h-2" />
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {PIPELINE.map((p) => (
                <div key={p.num} className={`group rounded-lg border p-3 transition-all duration-300 hover:-translate-y-0.5 ${p.status === "в работе" ? "border-amber/30 bg-amber/[0.04]" : p.status === "готово" ? "border-line bg-panel2/40" : "border-line/60 opacity-60"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[13px] font-bold text-dim">{p.num}</span>
                    <Dot tone={p.tone} pulse={p.status === "в работе"} />
                  </div>
                  <div className="mt-1.5 text-[13px] font-bold text-ink">{p.title}</div>
                  <div className="mt-1 text-[11.5px] leading-snug text-mut">{p.text}</div>
                  <div className={`mt-2 font-mono text-[10px] tracking-wider uppercase ${TONE_TEXT[p.tone]}`}>{p.status}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <ToneBtn onClick={() => go("funnel")}>Открыть воронку <Icon name="arrow" size={14} /></ToneBtn>
              <ToneBtn tone="ghost" onClick={() => go("ads")}>Реклама</ToneBtn>
              <ToneBtn tone="ghost" onClick={() => go("stats")}>Статистика</ToneBtn>
            </div>
          </Panel>
        </Reveal>

        {/* AI next move */}
        <Reveal delay={120}>
          <Panel className="relative h-full overflow-hidden border-amber/25 p-5">
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber/10 blur-3xl" />
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber/15 text-amber"><Icon name="spark" size={18} /></span>
              <div>
                <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Следующий ход</div>
                <div className="text-[13.5px] font-bold text-amber">Рекомендация оркестратора</div>
              </div>
            </div>
            <p className="mt-4 text-[13.5px] leading-relaxed text-ink">
              Кампания <b>VK · Lookalike</b> показывает ROMI 412% при CPL 88 ₽. Предлагаю перенести туда <b className="text-amber">22 500 ₽</b> из Директа — прогноз <b className="text-mint">+31 лид</b> и <b className="text-mint">+54 000 ₽</b> выручки к 21-му дню.
            </p>
            <div className="mt-3 rounded-lg border border-line bg-deep/60 p-3 font-mono text-[11px] leading-relaxed text-mut">
              расчёт: PostgreSQL · 14 дней · доверие 0.87
              <br />риск: истощение аудитории ~9 дней
            </div>
            <div className="mt-4 flex gap-2.5">
              <ToneBtn onClick={() => push("Одобрено: медиабаер переносит 22 500 ₽ в VK · Lookalike", "mint")}>Одобрить</ToneBtn>
              <ToneBtn tone="ghost" onClick={() => push("Отклонено: оркестратор пересчитает план без этой гипотезы", "coral")}>Отклонить</ToneBtn>
            </div>
          </Panel>
        </Reveal>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* live feed */}
        <Reveal className="xl:col-span-2">
          <Panel className="h-full p-5">
            <Head kicker="Лента событий · обновляется в реальном времени" title="Что делают AI-агенты" right={<Chip tone="mint"><Dot tone="mint" pulse /> live</Chip>} />
            <ul className="space-y-1">
              {feed.map((e, i) => (
                <li key={`${e.time}-${e.agent}-${i}`} className={`flex items-start gap-3.5 rounded-lg px-3 py-2.5 transition-all duration-500 ${i === 0 ? "bg-panel2/70 shadow-[inset_0_0_0_1px_rgba(44,65,102,0.6)]" : ""}`}>
                  <span className="mt-1 font-mono text-[11px] text-dim">{e.time}</span>
                  <Chip tone={e.tone} className="mt-0.5 shrink-0">{e.agent}</Chip>
                  <span className="text-[13px] leading-snug text-ink/90">{e.text}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>

        {/* money mini */}
        <Reveal delay={100}>
          <Panel className="h-full p-5">
            <Head kicker="Деньги" title="Выручка по дням" right={<Chip tone="amber">тыс. ₽</Chip>} />
            <svg viewBox="0 0 260 110" className="w-full">
              {[0, 1, 2, 3].map((i) => (
                <line key={i} x1="0" x2="260" y1={15 + i * 28} y2={15 + i * 28} stroke="#1d2b41" strokeWidth="1" />
              ))}
              {[112, 138, 121, 174, 168, 226, 246].map((v, i) => {
                const h = (v / 260) * 88;
                return (
                  <g key={i}>
                    <rect x={8 + i * 36} y={104 - h} width="22" height={h} rx="3" fill={i === 6 ? "#ffb224" : "#2c4166"} className="transition-all duration-300 hover:fill-[#5fb9ff]" />
                    {i === 6 && <text x={19 + i * 36} y={96 - h} textAnchor="middle" fill="#ffb224" fontSize="10" fontFamily="JetBrains Mono">{v}</text>}
                  </g>
                );
              })}
            </svg>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-line bg-deep/50 p-3">
                <div className="font-mono text-[10px] tracking-wider text-dim uppercase">Средний чек</div>
                <div className="mt-1 font-display text-lg font-bold text-ink">{fmt(24900)} ₽</div>
              </div>
              <div className="rounded-lg border border-line bg-deep/50 p-3">
                <div className="font-mono text-[10px] tracking-wider text-dim uppercase">До цели 3 млн</div>
                <div className="mt-1 font-display text-lg font-bold text-amber">41,5%</div>
              </div>
            </div>
            <button onClick={() => go("payments")} className="mt-4 flex w-full cursor-pointer items-center justify-between rounded-lg border border-line px-3.5 py-2.5 font-mono text-[11px] tracking-wide text-mut uppercase transition-colors hover:border-amber/40 hover:text-amber">
              Все платежи <Icon name="arrow" size={14} />
            </button>
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}
