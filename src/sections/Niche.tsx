import { COMPETITORS, NICHE, SEGMENTS, SWOT, type Tone } from "../data";
import { Bar, Chip, Head, Icon, Num, Panel, Reveal, Spark, ToneBtn, TONE_TEXT, fmt } from "../ui";

export default function Niche({ push }: { push: (t: string, tone?: Tone) => void }) {
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
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#3ddc97" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(NICHE.score / 100) * 264} 264`} className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="font-display text-[26px] font-extrabold leading-none text-mint">{NICHE.score}</div>
                    <div className="font-mono text-[9px] tracking-widest text-dim uppercase">/ 100</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Привлекательность ниши</div>
                <div className="mt-1 font-display text-lg font-bold leading-tight text-ink">{NICHE.name}</div>
                <Chip tone="mint" className="mt-2.5">▲ окно 9–12 мес</Chip>
              </div>
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={90} className="xl:col-span-2">
          <Panel className="h-full p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Спрос · Wordstat, тыс. показов/мес</div>
              <Chip tone="mint">+{NICHE.demandGrowth}% за квартал</Chip>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-6">
              <div>
                <Num value={NICHE.demand} className="font-display text-3xl font-extrabold text-ink" />
                <div className="mt-1 font-mono text-[10.5px] text-dim">показов в месяц</div>
              </div>
              <div className="hidden sm:block">
                <Spark data={NICHE.wordstat} color="#3ddc97" w={220} h={56} />
              </div>
              <div className="ml-auto grid grid-cols-3 gap-5">
                {[
                  { l: "Средний чек", v: `${fmt(NICHE.avgCheck)} ₽` },
                  { l: "Маржа продукта", v: `${NICHE.margin}%` },
                  { l: "CPC в аукционе", v: `${NICHE.cpc} ₽` },
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
              <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Агент-аналитик · скоринг по 24 параметрам</div>
              <div className="font-display text-lg font-bold">Конкуренты</div>
            </div>
            <ToneBtn tone="ghost" onClick={() => push("Аналитик запустил внеплановый рескан: 5 школ, 24 параметра, ~2 мин", "sky")}>
              <Icon name="spark" size={14} /> Пересканировать
            </ToneBtn>
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
                {COMPETITORS.map((c) => (
                  <tr key={c.name} className="group border-b border-line/60 transition-colors last:border-0 hover:bg-panel2/50">
                    <td className="px-5 py-3.5 text-[13px] font-bold text-ink">{c.name}</td>
                    <td className="px-4 py-3.5 font-mono text-[12.5px] text-ink/90">{fmt(c.students)}</td>
                    <td className="px-4 py-3.5 font-mono text-[12.5px] text-ink/90">{fmt(c.check)} ₽</td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-[12.5px] text-amber">★ {c.rating.toFixed(1)}</span>
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

      {/* segments + swot */}
      <div className="grid gap-4 xl:grid-cols-5">
        <Reveal className="xl:col-span-3">
          <Panel className="h-full p-5">
            <Head kicker="Целевая аудитория" title="4 сегмента — кому продаём" right={<Chip tone="sky">по данным распаковки + Wordstat</Chip>} />
            <div className="grid gap-3 sm:grid-cols-2">
              {SEGMENTS.map((s, i) => (
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
            <Head kicker="SWOT" title="Позиция запуска" />
            <div className="grid grid-cols-2 gap-3">
              {SWOT.map((s) => (
                <div key={s.title} className="rounded-lg border border-line bg-deep/50 p-3.5">
                  <div className={`font-mono text-[10px] tracking-[0.16em] uppercase ${TONE_TEXT[s.tone]}`}>{s.title}</div>
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
              <div className="text-[13.5px] font-bold text-mint">Заходить сейчас. Дифференциация — «деньги», не «творчество»</div>
            </div>
          </div>
          <p className="mt-3.5 max-w-4xl text-[13.5px] leading-relaxed text-ink/90">{NICHE.verdict}</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <ToneBtn tone="mint" onClick={() => push("Вывод принят — оркестратор обновил стратегию запуска", "mint")}>Принять стратегию</ToneBtn>
            <ToneBtn tone="ghost" onClick={() => push("Аналитик углубился: парсит отзывы конкурентов, отчёт через ~4 мин", "sky")}>Копнуть глубже</ToneBtn>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
