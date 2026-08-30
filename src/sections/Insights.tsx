import { useMemo, useState } from "react";
import { AGENTS, COHORTS, REVENUE_SERIES, ROMI_BY_CHANNEL, type Tone } from "../data";
import { useAuth } from "../store";
import { Bar, Chip, Dot, Head, Icon, LockedNote, Panel, Reveal, ToneBtn, TONE_TEXT, fmt } from "../ui";

/* ================= СТАТИСТИКА ================= */
export function StatsSection() {
  const { live } = useAuth();
  const periods = Object.keys(REVENUE_SERIES);
  const [period, setPeriod] = useState(periods[1]);
  const { rev, spend } = REVENUE_SERIES[period];

  const W = 640;
  const H = 200;
  const path = useMemo(() => {
    const max = Math.max(...rev) * 1.15;
    const step = W / (rev.length - 1);
    const pts = rev.map((v, i) => [i * step, H - 20 - (v / max) * (H - 45)]);
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    const sp = spend.map((v, i) => [i * step, H - 20 - (v / max) * (H - 45)]);
    const ds = sp.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    return { d, ds, area: `${d} L${W},${H} L0,${H} Z`, last: pts[pts.length - 1] };
  }, [rev, spend]);

  const totalRev = rev.reduce((s, v) => s + v, 0);
  const totalSpend = spend.reduce((s, v) => s + v, 0);

  if (!live) {
    return (
      <LockedNote
        title="Статистика запуска"
        text="Выручка, когорты и ROMI по каналам рассчитываются по событиям в PostgreSQL. Войдите, чтобы видеть цифры реального запуска."
      />
    );
  }

  return (
    <div className="space-y-5">
      <Reveal>
        <Panel className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">PostgreSQL · таблица events · срез 60 сек</div>
              <div className="font-display text-lg font-bold">Выручка и расходы, тыс. ₽</div>
            </div>
            <div className="flex rounded-lg border border-line bg-deep/60 p-0.5">
              {periods.map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`cursor-pointer rounded-md px-3.5 py-1.5 font-mono text-[11px] tracking-wide uppercase transition-all ${period === p ? "bg-amber text-deep" : "text-mut hover:text-ink"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <div>
              <div className="font-mono text-[10px] tracking-wider text-dim uppercase">Выручка за период</div>
              <div className="font-display text-2xl font-extrabold text-amber">{fmt(totalRev * 1000)} ₽</div>
            </div>
            <div>
              <div className="font-mono text-[10px] tracking-wider text-dim uppercase">Расходы на трафик</div>
              <div className="font-display text-2xl font-extrabold text-coral">{fmt(totalSpend * 1000)} ₽</div>
            </div>
            <div>
              <div className="font-mono text-[10px] tracking-wider text-dim uppercase">Маржа запуска</div>
              <div className="font-display text-2xl font-extrabold text-mint">{fmt(((totalRev - totalSpend) / totalRev) * 100)}%</div>
            </div>
            <div className="ml-auto flex items-center gap-4 font-mono text-[11px] text-mut">
              <span className="flex items-center gap-2"><span className="h-0.5 w-5 rounded bg-amber" /> выручка</span>
              <span className="flex items-center gap-2"><span className="h-0.5 w-5 rounded bg-coral" /> трафик</span>
            </div>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" preserveAspectRatio="none" style={{ maxHeight: 240 }}>
            {[0.25, 0.5, 0.75].map((p) => (
              <line key={p} x1="0" x2={W} y1={H * p} y2={H * p} stroke="#1d2b41" strokeWidth="1" strokeDasharray="4 5" />
            ))}
            <defs>
              <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffb224" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#ffb224" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={path.area} fill="url(#revArea)" />
            <path d={path.d} fill="none" stroke="#ffb224" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-700" />
            <path d={path.ds} fill="none" stroke="#ff6a55" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="5 5" className="transition-all duration-700" />
            <circle cx={path.last[0]} cy={path.last[1]} r="4.5" fill="#ffb224" stroke="#0b1119" strokeWidth="2" />
          </svg>
        </Panel>
      </Reveal>

      <div className="grid gap-4 xl:grid-cols-5">
        <Reveal className="xl:col-span-3">
          <Panel className="h-full p-5">
            <Head kicker="Удержание учеников" title="Когорты по неделям запуска" right={<Chip tone="sky">% активных</Chip>} />
            <div className="space-y-1.5">
              <div className="grid grid-cols-[110px_repeat(5,1fr)] gap-1.5 font-mono text-[10px] text-dim uppercase">
                <span />
                {[1, 2, 3, 4, 5].map((n) => <span key={n} className="text-center">нед {n}</span>)}
              </div>
              {COHORTS.map((c) => (
                <div key={c.week} className="grid grid-cols-[110px_repeat(5,1fr)] items-center gap-1.5">
                  <span className="font-mono text-[11px] text-mut">{c.week}</span>
                  {c.values.map((v, i) => (
                    <div
                      key={i}
                      className={`grid h-11 place-items-center rounded-md font-mono text-[11.5px] font-bold transition-all duration-500 hover:scale-[1.04] ${v === 0 ? "border border-line/50 text-dim/40" : "text-deep"}`}
                      style={v > 0 ? { background: `rgba(61,220,151,${0.16 + (v / 100) * 0.84})`, color: v > 45 ? "#0b1119" : "#3ddc97" } : {}}
                    >
                      {v === 0 ? "·" : `${v}%`}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-mut">Досматриваемость уроков растёт от когорты к когорте — ИИ-куратор v2 усилит этот эффект напоминаниями и геймификацией.</p>
          </Panel>
        </Reveal>

        <Reveal delay={110} className="xl:col-span-2">
          <Panel className="h-full p-5">
            <Head kicker="Эффективность каналов" title="ROMI по каналам" />
            <div className="space-y-4">
              {ROMI_BY_CHANNEL.map((r) => (
                <div key={r.name}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[12.5px] font-bold text-ink">{r.name}</span>
                    <span className={`font-display text-[15px] font-extrabold ${TONE_TEXT[r.tone]}`}>{r.romi}%</span>
                  </div>
                  <Bar pct={(r.romi / 420) * 100} tone={r.tone} className="h-2.5" />
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-lg border border-amber/25 bg-amber/[0.04] p-4">
              <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-amber uppercase"><Icon name="spark" size={13} /> вывод аналитика</div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-mut">VK окупается в 4,1 раза — потолок масштабирования ещё не достигнут. Посевы держим как эксперимент с бюджетом ≤10%.</p>
            </div>
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}

/* ================= АГЕНТЫ ================= */
export function AgentsSection({ push, locked = false }: { push: (t: string, tone?: Tone) => void; locked?: boolean }) {
  const [statuses, setStatuses] = useState<Record<string, string>>(() => Object.fromEntries(AGENTS.map((a) => [a.id, a.status])));
  const [openLog, setOpenLog] = useState<string | null>("orch");

  return (
    <div className="space-y-5">
      <Reveal>
        <Panel className="flex flex-wrap items-center gap-5 border-amber/25 p-5">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-amber/12 text-amber"><Icon name="bot" size={24} /></span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-bold text-ink">Оркестратор управляет 8 агентами</div>
            <p className="text-[12.5px] text-mut">Каждый агент — промпт-роль + инструменты (API, базы данных) + лимиты бюджета. Решения с деньгами уходят на одобрение человеку.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Chip tone="mint"><Dot tone="mint" pulse /> 7 в работе</Chip>
            <Chip tone="coral">1 в ожидании</Chip>
            <Chip tone="amber">1 134 задачи за запуск</Chip>
          </div>
        </Panel>
      </Reveal>

      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        {AGENTS.map((a, i) => {
          const st = statuses[a.id];
          const active = st === "в работе";
          return (
            <Reveal key={a.id} delay={(i % 4) * 80}>
              <Panel hover className={`flex h-full flex-col p-4.5 p-5 ${!active && "opacity-70"}`}>
                <div className="flex items-start justify-between">
                  <span className={`grid h-10 w-10 place-items-center rounded-lg ${a.tone === "amber" ? "bg-amber/12 text-amber" : a.tone === "mint" ? "bg-mint/12 text-mint" : a.tone === "coral" ? "bg-coral/12 text-coral" : "bg-sky/12 text-sky"}`}>
                    <Icon name={a.id === "orch" ? "schema" : a.id === "media" ? "mega" : a.id === "fin" ? "card" : a.id === "copy" ? "doc" : a.id === "sales" ? "chat" : a.id === "analyst" ? "target" : a.id === "art" ? "layers" : "bot"} size={19} />
                  </span>
                  <Chip tone={active ? "mint" : st === "ожидает" ? "coral" : "mut"}>
                    {active && <Dot tone="mint" pulse />} {st}
                  </Chip>
                </div>
                <div className="mt-3 text-[14px] font-bold text-ink">{a.name}</div>
                <p className="mt-1 flex-1 text-[11.5px] leading-snug text-mut">{a.role}</p>
                <div className="mt-3 font-mono text-[10px] text-dim">{a.model}</div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between font-mono text-[10px] text-dim">
                    <span>нагрузка</span><span>{a.load}%</span>
                  </div>
                  <Bar pct={a.load} tone={a.load > 70 ? "coral" : a.load > 45 ? "amber" : "mint"} />
                </div>
                <div className="mt-3.5 flex items-center justify-between">
                  <span className="font-mono text-[10.5px] text-mut">{a.tasks} задач</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => { if (locked) { push("Управление агентами — тариф Про", "amber"); return; } setOpenLog(openLog === a.id ? null : a.id); }} className={`cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] uppercase transition-colors ${openLog === a.id ? "border-sky/50 text-sky" : "border-line text-dim hover:text-ink"}`}>лог</button>
                    <button
                      onClick={() => {
                        if (locked) { push("Управление агентами — тариф Про", "amber"); return; }
                        const next = active ? "пауза" : "в работе";
                        setStatuses((s) => ({ ...s, [a.id]: next }));
                        push(`Агент «${a.name}»: ${next === "пауза" ? "приостановлен" : "возвращён в работу"}`, next === "пауза" ? "coral" : "mint");
                      }}
                      className={`cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] uppercase transition-colors ${active ? "border-coral/40 text-coral hover:bg-coral/10" : "border-mint/40 text-mint hover:bg-mint/10"}`}
                    >
                      {active ? "стоп" : "пуск"}
                    </button>
                  </div>
                </div>
                {openLog === a.id && (
                  <div className="mt-3 space-y-1.5 rounded-lg border border-line bg-deep/70 p-3 font-mono text-[10.5px] leading-relaxed">
                    {a.logs.map((l) => (
                      <div key={l} className="text-mut"><span className="text-sky">▸</span> {l}</div>
                    ))}
                    <div className="text-dim">─ журнал пишется в PostgreSQL (agent_logs) ─</div>
                  </div>
                )}
              </Panel>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
