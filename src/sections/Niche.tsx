import { useEffect, useState } from "react";
import { COMPETITORS, NICHE, SEGMENTS, SWOT, type Tone } from "../data";
import { Bar, Chip, Head, Icon, Num, Panel, Reveal, Spark, ToneBtn, TONE_TEXT, fmt } from "../ui";
import { useStore, useAuth } from "../store";
import { apiFetch, ApiError } from "../api";

interface Competitor {
  name: string;
  students: number;
  check: number;
  rating: number;
  weak: string;
  power: number;
}

interface WordstatKeyword {
  phrase: string;
  count: number;
  is_main: boolean;
}

interface NicheData {
  score: number;
  niche_name: string;
  verdict: string;
  demand: number;
  demand_growth: number;
  avg_check: number;
  margin: number;
  cpc: number;
  competitors: Competitor[];
  demand_source: "wordstat" | "ai_estimate";
  competitors_source: "search" | "ai_estimate";
  wordstat_top: WordstatKeyword[];
  segments: { title: string; share: number; pain: string; gain: string; check: string }[];
  swot: { title: string; tone: string; items: string[] }[];
  search_checked_at?: string;
  created_at?: string;
}

export default function Niche({ push }: { push: (t: string, tone?: Tone) => void }) {
  const { activeLaunchId } = useStore();
  const { live } = useAuth();

  const [mode, setMode] = useState<"loading" | "empty" | "generating" | "data">("loading");
  const [data, setData] = useState<NicheData | null>(null);

    // Загрузка данных при смене запуска
  useEffect(() => {
    if (!live || !activeLaunchId) {
      setMode("data");
      // В демо-режиме показываем хардкод
      setData({
        score: NICHE.score,
        niche_name: NICHE.name,
        verdict: NICHE.verdict,
        demand: NICHE.demand,
        demand_growth: NICHE.demandGrowth,
        avg_check: NICHE.avgCheck,
        margin: NICHE.margin,
        cpc: NICHE.cpc,
        competitors: COMPETITORS,
        demand_source: "ai_estimate",
        competitors_source: "ai_estimate",
        wordstat_top: [],
        segments: SEGMENTS,
        swot: SWOT,
      });
      return;
    }

    let mounted = true;
    setMode("loading");

    apiFetch<NicheData>(`/launches/${activeLaunchId}/niche`)
      .then((res) => {
        if (!mounted) return;
        setData(res);
        setMode("data");
      })
      .catch((e) => {
        if (!mounted) return;
        if (e instanceof ApiError && e.status === 404) {
          setMode("empty");
        } else {
          push("Ошибка при загрузке анализа ниши", "coral");
          setMode("empty");
        }
      });

    return () => { mounted = false; };
  }, [activeLaunchId, live, push]);

  // Запуск ИИ-анализа: POST → бэкенд идёт в Search API + YandexGPT
  const generateNiche = async () => {
    if (!live || !activeLaunchId) return;

    setMode("generating");
    push("Агент-аналитик запущен: идём в Wordstat и поиск конкурентов...", "amber");

    try {
      await apiFetch(`/launches/${activeLaunchId}/niche`, {
        method: "POST",
        body: {},
      });

      push("Анализ ниши завершён: данные Wordstat и конкурентов сохранены", "mint");

      const newData = await apiFetch<NicheData>(`/launches/${activeLaunchId}/niche`);
      setData(newData);
      setMode("data");
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Не удалось сгенерировать анализ", "coral");
      setMode("empty");
    }
  };

    if (!activeLaunchId && live) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line py-24 text-center">
        <Icon name="spark" size={32} className="mb-4 text-dim" />
        <div className="font-display text-lg font-bold text-ink">Запуск не выбран</div>
        <p className="mt-2 text-[13px] text-mut">Выберите запуск в верхнем меню, чтобы посмотреть анализ.</p>
      </div>
    );
  }

  if (mode === "loading") {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <span className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.18em] text-dim uppercase">
          <span className="typing-dot h-2 w-2 rounded-full bg-amber" />
          <span className="typing-dot h-2 w-2 rounded-full bg-amber" />
          <span className="typing-dot h-2 w-2 rounded-full bg-amber" />
          загрузка метрик
        </span>
      </div>
    );
  }

  if (mode === "empty") {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line py-24 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-sky/10 text-sky mb-4">
          <Icon name="target" size={28} />
        </div>
        <div className="font-display text-xl font-bold text-ink">Ниша еще не проанализирована</div>
        <p className="mt-2 max-w-md text-[13px] text-mut leading-relaxed">
          Нажмите кнопку ниже, чтобы ИИ-агент собрал данные о рынке из Wordstat, изучил конкурентов через поиск Яндекса и рассчитал потенциал.
        </p>
        <div className="mt-6">
          <ToneBtn onClick={generateNiche} tone="mint">
            <Icon name="spark" size={16} /> Запустить ИИ-анализ ниши
          </ToneBtn>
        </div>
      </div>
    );
  }

  if (mode === "generating") {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-amber/10 text-amber mb-4 pulse-dot">
           <Icon name="bot" size={24} />
        </div>
        <span className="font-mono text-[11px] tracking-wider text-amber uppercase">
           Запрашиваем Wordstat и поиск конкурентов<span className="caret">…</span>
        </span>
      </div>
    );
  }

  // Отрисовка данных
  const safeData = data || { 
    score: 0, niche_name: "Неизвестно", verdict: "", 
    demand: 0, demand_growth: 0, avg_check: 0, margin: 0, cpc: 0, 
    competitors: [],
    demand_source: "ai_estimate" as const,
    competitors_source: "ai_estimate" as const,
    wordstat_top: [],
    segments: [],
    swot: [],
  };

  // Нормализация: segments может прийти как JSON-строка из PostgreSQL
  const segments = Array.isArray(safeData.segments)
    ? safeData.segments
    : typeof safeData.segments === 'string'
      ? (JSON.parse(safeData.segments) as { title: string; share: number; pain: string; gain: string; check: string }[])
      : [];

  const swotData = Array.isArray(safeData.swot)
    ? safeData.swot
    : typeof safeData.swot === 'string'
      ? (JSON.parse(safeData.swot) as { title: string; tone: string; items: string[] }[])
      : [];

  const demandBadge = safeData.demand_source === "wordstat" 
    ? <Chip tone="mint">Wordstat · реальные данные</Chip> 
    : <Chip tone="amber">оценка ИИ</Chip>;

  const compBadge = safeData.competitors_source === "search" 
    ? <Chip tone="sky">поиск Яндекса</Chip> 
    : <Chip tone="amber">оценка ИИ</Chip>;

  return (
    <div className="space-y-6">
      {/* top: score + demand metrics */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Reveal>
          <Panel hover className="relative h-full overflow-hidden p-5">
            <div className="pointer-events-none absolute -left-10 -top-10 h-36 w-36 rounded-full bg-mint/10 blur-3xl" />
            <div className="flex items-center gap-5">
              <div className="relative h-28 w-28 shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#1d2b41" strokeWidth="8" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#3ddc97" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(safeData.score / 100) * 264} 264`} className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="font-display text-[26px] font-extrabold leading-none text-mint">{safeData.score}</div>
                    <div className="font-mono text-[9px] tracking-widest text-dim uppercase">/ 100</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Привлекательность ниши</div>
                <div className="mt-1 font-display text-lg font-bold leading-tight text-ink">{safeData.niche_name}</div>
                <div className="mt-2.5">{demandBadge}</div>
              </div>
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={90} className="xl:col-span-2">
          <Panel className="h-full p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Спрос · показов/мес</div>
              <div className="flex items-center gap-2">
                <Chip tone={safeData.demand_growth > 0 ? "mint" : "coral"}>
                  {safeData.demand_growth > 0 ? "+" : ""}{safeData.demand_growth}%
                </Chip>
                {demandBadge}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-6">
              <div>
                <Num value={safeData.demand} className="font-display text-3xl font-extrabold text-ink" />
                <div className="mt-1 font-mono text-[10.5px] text-dim">показов в месяц</div>
              </div>
              <div className="hidden sm:block">
                <Spark data={NICHE.wordstat} color="#3ddc97" w={220} h={56} />
              </div>
              <div className="ml-auto grid grid-cols-3 gap-5">
                {[
                  { l: "Средний чек", v: `${fmt(safeData.avg_check)} ₽` },
                  { l: "Маржа продукта", v: `${safeData.margin}%` },
                  { l: "CPC в аукционе", v: `${safeData.cpc} ₽` },
                ].map((m) => (
                  <div key={m.l}>
                    <div className="font-display text-lg font-bold text-amber">{m.v}</div>
                    <div className="mt-0.5 font-mono text-[10px] tracking-wider text-dim uppercase">{m.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </Reveal>
      </div>
      {/* competitors */}
      <Reveal>
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <div>
              <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Агент-аналитик · БД: competitors</div>
              <div className="font-display text-lg font-bold">Конкуренты</div>
            </div>
            <div className="flex items-center gap-2">
              {compBadge}
              <ToneBtn tone="ghost" onClick={generateNiche}>
                <Icon name="refresh" size={14} /> Пересканировать
              </ToneBtn>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-line font-mono text-[10px] tracking-[0.16em] text-dim uppercase">
                  <th className="px-5 py-3 font-medium">Школа</th>
                  <th className="px-4 py-3 font-medium">Учеников</th>
                  <th className="px-4 py-3 font-medium">Чек</th>
                  <th className="px-4 py-3 font-medium">Рейтинг</th>
                  <th className="px-4 py-3 font-medium">Уязвимость (нашёл ИИ)</th>
                  <th className="px-5 py-3 font-medium w-40">Сила</th>
                </tr>
              </thead>
              <tbody>
                {safeData.competitors.length === 0 ? (
                   <tr>
                     <td colSpan={6} className="px-5 py-8 text-center text-[12px] text-dim">Список конкурентов пуст</td>
                   </tr>
                ) : safeData.competitors.map((c, i) => (
                  <tr key={`${c.name}-${i}`} className="group border-b border-line/60 transition-colors last:border-0 hover:bg-panel2/50">
                    <td className="px-5 py-3.5 text-[13px] font-bold text-ink">{c.name}</td>
                    <td className="px-4 py-3.5 font-mono text-[12.5px] text-ink/90">{fmt(c.students)}</td>
                    <td className="px-4 py-3.5 font-mono text-[12.5px] text-ink/90">{fmt(c.check)} ₽</td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-[12.5px] text-amber">★ {Number(c.rating || 0).toFixed(1)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-[12px] leading-snug text-mut">{c.weak}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Bar pct={c.power} tone={c.power > 70 ? "coral" : c.power > 50 ? "amber" : "mint"} className="flex-1" />
                        <span className="font-mono text-[11px] text-dim">{c.power}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Reveal>

      {/* Wordstat топ-фразы */}
      {safeData.wordstat_top.length > 0 && (
        <Reveal>
          <Panel className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Yandex Wordstat · топ фраз</div>
                <div className="font-display text-lg font-bold">Реальный спрос по ключам</div>
              </div>
              {demandBadge}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {safeData.wordstat_top.map((kw, i) => (
                <div key={`${kw.phrase}-${i}`} className="rounded-lg border border-line bg-panel2/50 px-3 py-2">
                  <span className="text-[12.5px] font-medium text-ink/90">{kw.phrase}</span>
                  <span className="ml-2 font-mono text-[11px] text-mint">{fmt(kw.count)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>
      )}
      {/* segments + swot (оставляем статику) */}
      <div className="grid gap-4 xl:grid-cols-5">
        <Reveal className="xl:col-span-3">
          <Panel className="h-full p-5">
            <Head kicker="Целевая аудитория" title="4 сегмента — кому продаём" right={<Chip tone="sky">{segments.length > 0 ? `ИИ-анализ: ${segments.length} сегмент${segments.length === 1 ? '' : segments.length < 5 ? 'а' : 'ов'}` : 'по данным распаковки'}</Chip>} />
            <div className="grid gap-3 sm:grid-cols-2">
             {segments.length === 0 ? (
                <div className="col-span-2 rounded-lg border border-dashed border-line p-6 text-center text-[12px] text-dim">
                  Сегменты ЦА определятся после ИИ-анализа ниши
                </div>
              ) : segments.map((s, i) => (
                <div key={s.title} className={`rounded-lg border p-4 transition-all duration-300 hover:-translate-y-0.5 ${i === 0 ? "border-amber/30 bg-amber/[0.04]" : "border-line bg-panel2/40 hover:border-line2"}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-[13.5px] font-bold text-ink">{s.title}</div>
                    <span className="font-display text-[15px] font-extrabold text-amber">{s.share}%</span>
                  </div>
                  <Bar pct={s.share} tone={i === 0 ? "amber" : "sky"} className="mt-2" />
                  <div className="mt-3 space-y-1.5 text-[12px] leading-snug">
                    <div><span className="font-mono text-[10px] tracking-wider text-coral uppercase">боль: </span><span className="text-mut">{s.pain}</span></div>
                    <div><span className="font-mono text-[10px] tracking-wider text-mint uppercase">ценность: </span><span className="text-mut">{s.gain}</span></div>
                    <div><span className="font-mono text-[10px] tracking-wider text-sky uppercase">чек: </span><span className="text-mut">{s.check}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={110} className="xl:col-span-2">
          <Panel className="h-full p-5">
            <Head kicker="SWOT" title="Позиция запуска" right={<Chip tone={swotData.length > 0 ? "mint" : "sky"}>{swotData.length > 0 ? "на основе данных" : "демо"}</Chip>} />
            <div className="grid grid-cols-2 gap-3">
              {(swotData.length > 0 ? swotData : SWOT).map((s) => (
                <div key={s.title} className="rounded-lg border border-line bg-deep/50 p-3.5">
                  <div className={`font-mono text-[10px] tracking-[0.16em] uppercase ${TONE_TEXT[s.tone as Tone] ?? ''}`}>{s.title}</div>
                  <ul className="mt-2 space-y-1.5">
                    {s.items.map((it) => (
                      <li key={it} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-mut">
                        <span className={`mt-[5px] h-1 w-1 shrink-0 rounded-full ${s.tone === "mint" ? "bg-mint" : s.tone === "coral" ? "bg-coral" : s.tone === "sky" ? "bg-sky" : "bg-amber"}`} />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>
      </div>

      {/* verdict */}
      <Reveal>
        <Panel className="relative overflow-hidden border-mint/25 p-5">
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-mint/10 blur-3xl" />
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-mint/15 text-mint"><Icon name="spark" size={18} /></span>
            <div>
              <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Вывод агента-аналитика</div>
              <div className="text-[13.5px] font-bold text-mint">Стратегия определена</div>
            </div>
          </div>
          <p className="mt-3.5 max-w-4xl text-[13.5px] leading-relaxed text-ink/90">{safeData.verdict}</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <ToneBtn tone="mint" onClick={() => push("Вывод принят — оркестратор обновил стратегию запуска", "mint")}>Принять стратегию</ToneBtn>
            <ToneBtn tone="ghost" onClick={generateNiche}>Сгенерировать другой вариант</ToneBtn>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}