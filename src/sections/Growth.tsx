import { useRef, useState } from "react";
import { AD_CHANNELS, CAMPAIGNS, TARIFFS, TXS, type Tone } from "../data";
import { Bar, Chip, Dot, Head, Icon, Num, Panel, Range, Reveal, Spark, ToneBtn, useReducedMotion, fmt } from "../ui";

const BUDGET = 150000;

/* ================= РЕКЛАМА ================= */
export function AdsSection({ push }: { push: (t: string, tone?: Tone) => void }) {
  const reduced = useReducedMotion();
  const [channels, setChannels] = useState(AD_CHANNELS);
  const [statuses, setStatuses] = useState<Record<string, boolean>>(() => Object.fromEntries(AD_CHANNELS.map((c) => [c.id, c.active])));
  const [campStatus, setCampStatus] = useState<Record<string, string>>(() => Object.fromEntries(CAMPAIGNS.map((c) => [c.id, c.status])));
  const animRef = useRef(0);

  const totalSpend = channels.reduce((s, c) => s + (BUDGET * c.share) / 100, 0);
  const totalLeads = channels.reduce((s, c) => s + c.leads, 0);

  const setShare = (id: string, v: number) => {
    setChannels((cs) => {
      const others = cs.filter((c) => c.id !== id);
      const rest = 100 - v;
      const oldRest = others.reduce((s, c) => s + c.share, 0) || 1;
      return cs.map((c) => (c.id === id ? { ...c, share: v } : { ...c, share: (c.share / oldRest) * rest }));
    });
  };

  const rebalance = () => {
    const target = channels.map((c) => c.recShare);
    if (reduced) {
      setChannels((cs) => cs.map((c, i) => ({ ...c, share: target[i] })));
      push("Медиабаер перераспределил бюджет по CPL и ROMI: прогноз +31 лид", "mint");
      return;
    }
    cancelAnimationFrame(animRef.current);
    const from = channels.map((c) => c.share);
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 850);
      const e = 1 - Math.pow(1 - p, 3);
      setChannels((cs) => cs.map((c, i) => ({ ...c, share: from[i] + (target[i] - from[i]) * e })));
      if (p < 1) animRef.current = requestAnimationFrame(tick);
      else push("Медиабаер перераспределил бюджет по CPL и ROMI: прогноз +31 лид", "mint");
    };
    animRef.current = requestAnimationFrame(tick);
  };

  return (
    <div className="space-y-5">
      <Reveal>
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {[
            { l: "Бюджет запуска", v: BUDGET, s: " ₽", tone: "text-amber" },
            { l: "Потрачено", v: totalSpend, s: " ₽", tone: "text-ink" },
            { l: "Лиды со всех каналов", v: totalLeads, s: "", tone: "text-sky" },
            { l: "Средний CPL", v: totalSpend / totalLeads, s: " ₽", tone: "text-mint" },
          ].map((k, i) => (
            <Panel key={k.l} hover className="p-4">
              <div className="font-mono text-[10px] tracking-[0.14em] text-dim uppercase">{k.l}</div>
              <Num value={k.v} suffix={k.s} className={`mt-1.5 font-display text-xl font-extrabold ${k.tone}`} />
            </Panel>
          ))}
        </div>
      </Reveal>

      <div className="grid gap-4 xl:grid-cols-5">
        <Reveal className="xl:col-span-3">
          <Panel className="h-full p-5">
            <Head
              kicker="Медиамикс · управляется через VK Ads API и Директ API"
              title="Распределение бюджета"
              right={<ToneBtn onClick={rebalance}><Icon name="spark" size={14} /> ИИ-ребалансировка</ToneBtn>}
            />
            <div className="space-y-4">
              {channels.map((c) => {
                const spend = (BUDGET * c.share) / 100;
                const on = statuses[c.id];
                return (
                  <div key={c.id} className={`rounded-lg border p-4 transition-all duration-300 ${on ? "border-line bg-deep/40 hover:border-line2" : "border-line/60 bg-deep/20 opacity-55"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <Dot tone={c.tone} pulse={on} />
                        <span className="text-[13.5px] font-bold text-ink">{c.name}</span>
                        {c.recShare > c.share + 2 && on && <Chip tone="mint">ИИ: +{c.recShare - c.share} п.п.</Chip>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-display text-[16px] font-extrabold text-amber">{c.share.toFixed(0)}%</span>
                        <button
                          onClick={() => { setStatuses((s) => ({ ...s, [c.id]: !on })); push(on ? `Канал «${c.name}» на паузе — бюджет перераспределён` : `Канал «${c.name}» запущен снова`, on ? "coral" : "mint"); }}
                          className={`cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[10px] tracking-wide uppercase transition-colors ${on ? "border-coral/40 text-coral hover:bg-coral/10" : "border-mint/40 text-mint hover:bg-mint/10"}`}
                        >
                          {on ? "пауза" : "запустить"}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Range value={c.share} min={0} max={70} step={1} onChange={(v) => setShare(c.id, Math.round(v))} />
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[11px] text-mut">
                      <span>бюджет: <b className="text-ink">{fmt(spend)} ₽</b></span>
                      <span>CPL: <b className={c.cpl < 120 ? "text-mint" : c.cpl < 160 ? "text-amber" : "text-coral"}>{c.cpl} ₽</b></span>
                      <span>лиды: <b className="text-ink">{fmt(c.leads)}</b></span>
                      <span className="ml-auto hidden sm:block"><Spark data={c.series} color={on ? "#5fb9ff" : "#5c7291"} w={90} h={22} fill={false} /></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={110} className="xl:col-span-2">
          <Panel className="h-full overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Медиабаер-агент · 6 кампаний</div>
              <div className="font-display text-lg font-bold">Кампании</div>
            </div>
            <ul className="divide-y divide-line/60">
              {CAMPAIGNS.map((c) => {
                const st = campStatus[c.id];
                return (
                  <li key={c.id} className="px-5 py-3.5 transition-colors hover:bg-panel2/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] font-bold text-ink">{c.name}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-dim">{c.channel} · потрачено {fmt(c.spend)} ₽</div>
                      </div>
                      <Chip tone={st === "активна" ? "mint" : st === "обучение" ? "sky" : "mut"}>{st}</Chip>
                    </div>
                    <div className="mt-2 flex items-center gap-4 font-mono text-[10.5px] text-mut">
                      <span>CPL <b className="text-ink">{c.cpl} ₽</b></span>
                      <span>ROMI <b className={c.romi > 300 ? "text-mint" : c.romi > 180 ? "text-amber" : "text-coral"}>{c.romi}%</b></span>
                      <button onClick={() => { setCampStatus((s) => ({ ...s, [c.id]: st === "пауза" ? "активна" : "пауза" })); push(st === "пауза" ? `Кампания «${c.name}» запущена` : `Кампания «${c.name}» приостановлена`, st === "пауза" ? "mint" : "coral"); }} className="ml-auto flex cursor-pointer items-center gap-1 text-dim uppercase transition-colors hover:text-ink">
                        <Icon name={st === "пауза" ? "play" : "pause"} size={12} /> {st === "пауза" ? "старт" : "пауза"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-line bg-sky/[0.04] px-5 py-4">
              <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-sky uppercase"><Icon name="spark" size={13} /> инсайт медиабаера</div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-mut">Креативы с «доходом» обыгрывают «творчество» на 41% по CTR. Сгенерировал 6 новых связок — ждут одобрения в кабинете.</p>
            </div>
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}

/* ================= ОПЛАТЫ ================= */
export function PaymentsSection({ push }: { push: (t: string, tone?: Tone) => void }) {
  return (
    <div className="space-y-5">
      <Reveal>
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {[
            { l: "Принято платежей", v: "1 245 000", s: " ₽", tone: "text-amber", sub: "через ЮKassa" },
            { l: "Средний чек", v: "24 900", s: " ₽", tone: "text-ink", sub: "+рассрочки 31%" },
            { l: "Возвраты", v: "2,1", s: "%", tone: "text-coral", sub: "резерв 5% заложен" },
            { l: "Ближайшая выплата", v: "пт, 14:00", s: "", tone: "text-mint", sub: "486 300 ₽ на р/с" },
          ].map((k) => (
            <Panel key={k.l} hover className="p-4">
              <div className="font-mono text-[10px] tracking-[0.14em] text-dim uppercase">{k.l}</div>
              <div className={`mt-1.5 font-display text-xl font-extrabold ${k.tone}`}>{k.v}<span className="text-sm">{k.s}</span></div>
              <div className="mt-1 font-mono text-[10px] text-dim">{k.sub}</div>
            </Panel>
          ))}
        </div>
      </Reveal>

      <div className="grid gap-4 xl:grid-cols-5">
        <Reveal className="xl:col-span-3">
          <Panel className="h-full overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
              <div>
                <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Реестр ЮKassa · вебхуки обрабатывает финконтроль</div>
                <div className="font-display text-lg font-bold">Последние платежи</div>
              </div>
              <ToneBtn tone="ghost" onClick={() => push("Реестр выгружен в CSV: 47 платежей, сверка с ЮKassa без расхождений", "sky")}>
                <Icon name="doc" size={14} /> Экспорт
              </ToneBtn>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-line font-mono text-[10px] tracking-[0.14em] text-dim uppercase">
                    <th className="px-5 py-3 font-medium">Платёж</th>
                    <th className="px-4 py-3 font-medium">Клиент</th>
                    <th className="px-4 py-3 font-medium">Тариф</th>
                    <th className="px-4 py-3 font-medium text-right">Сумма</th>
                    <th className="px-5 py-3 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {TXS.map((t) => (
                    <tr key={t.id} className="border-b border-line/60 transition-colors last:border-0 hover:bg-panel2/40">
                      <td className="px-5 py-3">
                        <div className="font-mono text-[12px] text-ink">{t.id}</div>
                        <div className="font-mono text-[10px] text-dim">{t.date} · {t.method}</div>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-ink/90">{t.customer}</td>
                      <td className="px-4 py-3 text-[12px] text-mut">{t.tariff}</td>
                      <td className="px-4 py-3 text-right font-mono text-[12.5px] font-bold text-ink">{fmt(t.amount)} ₽</td>
                      <td className="px-5 py-3">
                        <Chip tone={t.status === "успешно" ? "mint" : t.status === "в обработке" ? "sky" : "coral"}>{t.status}</Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </Reveal>

        <div className="flex flex-col gap-4 xl:col-span-2">
          <Reveal delay={90}>
            <Panel className="p-5">
              <Head kicker="Что продаём" title="Тарифная сетка" />
              <ul className="space-y-2">
                {TARIFFS.map((t) => (
                  <li key={t.name} className={`flex items-center justify-between rounded-lg border px-4 py-3 ${t.hot ? "border-amber/35 bg-amber/[0.05]" : "border-line bg-deep/40"}`}>
                    <div>
                      <div className="text-[13px] font-bold text-ink">{t.name} {t.hot && <Chip tone="amber" className="ml-1">хит</Chip>}</div>
                      <div className="font-mono text-[10px] text-dim">{t.note}</div>
                    </div>
                    <div className="font-display text-[16px] font-extrabold text-amber">{fmt(t.price)} ₽</div>
                  </li>
                ))}
              </ul>
            </Panel>
          </Reveal>
          <Reveal delay={160}>
            <Panel className="p-5">
              <Head kicker="Комплаенс" title="Автоматически закрыто" />
              <ul className="space-y-2.5">
                {[
                  { t: "54-ФЗ: чеки", d: "ЮKassa + облачная касса: чек на оплату, рассрочку и возврат" },
                  { t: "152-ФЗ: согласия", d: "чекбоксы на лендингах, ПДн хранятся в Yandex Cloud (РФ)" },
                  { t: "Оферта", d: "фиксирует объём услуги — защита от потребительского экстремизма" },
                  { t: "Резерв возвратов", d: "5% выручки автоматически откладывается финконтролем" },
                ].map((x) => (
                  <li key={x.t} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-mint/15 text-mint"><Icon name="check" size={11} /></span>
                    <div>
                      <div className="text-[12.5px] font-bold text-ink">{x.t}</div>
                      <div className="text-[11.5px] leading-snug text-mut">{x.d}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
