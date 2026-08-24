import { useState } from "react";
import { LEADMAGNETS, MODULES_A, MODULES_B, TARIFFS, type Tone } from "../data";
import { Bar, Chip, Head, Icon, Panel, Range, Reveal, ToneBtn, fmt } from "../ui";

/* ================= ПРОДУКТ ================= */
export function ProductSection({ push }: { push: (t: string, tone?: Tone) => void }) {
  const [variant, setVariant] = useState<"A" | "B">("A");
  const [open, setOpen] = useState(0);
  const [price, setPrice] = useState(24900);
  const [target, setTarget] = useState(60);
  const modules = variant === "A" ? MODULES_A : MODULES_B;
  const revenue = price * target;

  return (
    <div className="space-y-6">
      {/* unit economics strip */}
      <Reveal>
        <Panel className="p-5">
          <Head kicker="Юнит-экономика · пересчёт в реальном времени" title="Экономика основного курса" right={<Chip tone="amber">единый источник правды</Chip>} />
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-mut">
                <span>Цена тарифа «Основной»</span>
                <span className="text-amber">{fmt(price)} ₽</span>
              </div>
              <Range value={price} min={9900} max={59900} step={100} onChange={setPrice} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-mut">
                <span>Цель продаж за запуск</span>
                <span className="text-amber">{target} шт</span>
              </div>
              <Range value={target} min={20} max={150} step={1} onChange={(v) => setTarget(Math.round(v))} />
            </div>
            <div className="flex items-center gap-5 rounded-lg border border-amber/25 bg-amber/[0.05] px-5 py-3">
              <div>
                <div className="font-mono text-[10px] tracking-wider text-dim uppercase">Прогноз выручки</div>
                <div className="font-display text-2xl font-extrabold text-amber">{fmt(revenue)} ₽</div>
              </div>
              <div className="h-9 w-px bg-line" />
              <div className="space-y-0.5 font-mono text-[11px] text-mut">
                <div>CAC при цели: <span className="text-ink">{fmt(150000 / target)} ₽</span></div>
                <div>ROMI: <span className="text-mint">{fmt(((revenue - 150000) / 150000) * 100)}%</span></div>
              </div>
            </div>
          </div>
        </Panel>
      </Reveal>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* program */}
        <Reveal className="xl:col-span-3">
          <Panel className="h-full overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Программа курса · сгенерирована ИИ</div>
                <div className="font-display text-lg font-bold">6 модулей · 18 уроков · 9,5 ч</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-line bg-deep/60 p-0.5">
                  {(["A", "B"] as const).map((v) => (
                    <button key={v} onClick={() => { setVariant(v); push(v === "A" ? "Включена сборка A: «от фундамента к деньгам»" : "ИИ пересобрал программу: акцент на быстрый результат", "sky"); }} className={`cursor-pointer rounded-md px-3.5 py-1.5 font-mono text-[11px] tracking-wide uppercase transition-all ${variant === v ? "bg-amber text-deep" : "text-mut hover:text-ink"}`}>
                      {v === "A" ? "Сборка A" : "Сборка B"}
                    </button>
                  ))}
                </div>
                <ToneBtn tone="ghost" onClick={() => push("Копирайтер переписывает программу под сегмент «Селлеры»…", "amber")}>
                  <Icon name="spark" size={14} />
                </ToneBtn>
              </div>
            </div>
            <div className="divide-y divide-line/60">
              {modules.map((m, i) => (
                <div key={m.title + i} className="group">
                  <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full cursor-pointer items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-panel2/50">
                    <span className={`font-display text-[13px] font-extrabold ${open === i ? "text-amber" : "text-dim"}`}>{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1 text-[13.5px] font-bold text-ink">{m.title}</span>
                    <span className="font-mono text-[10.5px] text-dim">{m.lessons.length} урока</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-dim transition-transform duration-300 ${open === i ? "rotate-180 text-amber" : ""}`}>
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  <div className={`grid transition-all duration-500 ease-out ${open === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="overflow-hidden">
                      <ul className="space-y-1.5 px-5 pb-4 pl-[52px]">
                        {m.lessons.map((l) => (
                          <li key={l} className="flex items-center gap-2.5 text-[12.5px] text-mut">
                            <Icon name="play" size={12} className="text-sky" />
                            {l}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>

        {/* tariffs — asymmetric */}
        <Reveal delay={110} className="xl:col-span-2">
          <div className="flex h-full flex-col gap-3">
            {TARIFFS.filter((t) => t.hot).map((t) => (
              <Panel key={t.name} className="relative flex-1 overflow-hidden border-amber/35 p-5">
                <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber/10 blur-3xl" />
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-[10px] tracking-[0.2em] text-amber uppercase">{t.note}</div>
                    <div className="mt-1 font-display text-xl font-extrabold text-ink">Тариф {t.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl font-extrabold text-amber">{fmt(t.price)} ₽</div>
                    <div className="font-mono text-[10px] text-dim">или 6 225 ₽ × 4</div>
                  </div>
                </div>
                <ul className="mt-4 space-y-2">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12.5px] text-ink/90">
                      <Icon name="check" size={13} className="mt-0.5 shrink-0 text-amber" /> {f}
                    </li>
                  ))}
                </ul>
                <Bar pct={68} tone="amber" className="mt-4" />
                <div className="mt-1.5 font-mono text-[10.5px] text-dim">68% всех оплат · конверсия в покупку 6,5%</div>
              </Panel>
            ))}
            <div className="grid grid-cols-2 gap-3">
              {TARIFFS.filter((t) => !t.hot).map((t) => (
                <Panel key={t.name} hover className="p-4">
                  <div className="font-mono text-[9.5px] tracking-[0.16em] text-dim uppercase">{t.note}</div>
                  <div className="mt-1 text-[14px] font-bold text-ink">{t.name}</div>
                  <div className="mt-2 font-display text-lg font-extrabold text-sky">{fmt(t.price)} ₽</div>
                  <ul className="mt-2.5 space-y-1">
                    {t.features.slice(0, 2).map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-[11px] leading-snug text-mut">
                        <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-line2" /> {f}
                      </li>
                    ))}
                  </ul>
                </Panel>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

/* ================= ЛИД-МАГНИТ ================= */
export function LeadMagnetSection({ push }: { push: (t: string, tone?: Tone) => void }) {
  const [idx, setIdx] = useState(0);
  const lm = LEADMAGNETS[idx];

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <Reveal className="xl:col-span-2">
        <Panel className="relative h-full overflow-hidden p-6">
          <div className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-sky/10 blur-3xl" />
          <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Превью лендинга выдачи</div>
          <div className="floaty mx-auto mt-6 w-fit">
            <div className="w-64 rounded-xl border border-line2 bg-panel2 p-5 shadow-2xl shadow-black/50 sm:w-72">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber/15 text-amber"><Icon name="doc" size={16} /></span>
                <span className="font-mono text-[9.5px] tracking-widest text-dim uppercase">бесплатно · PDF</span>
              </div>
              <div className="mt-3.5 font-display text-[16px] font-extrabold leading-snug text-ink">{lm.title}</div>
              <div className="mt-1 font-mono text-[10.5px] text-mut">{lm.sub}</div>
              <ul className="mt-4 space-y-1.5">
                {lm.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[11.5px] text-ink/85">
                    <Icon name="check" size={11} className="mt-0.5 shrink-0 text-mint" /> {b}
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-lg bg-amber py-2.5 text-center font-mono text-[11px] font-bold tracking-wider text-deep uppercase">Забрать бесплатно</div>
            </div>
          </div>
          <div className="mt-6 flex justify-center gap-2">
            {LEADMAGNETS.map((_, i) => (
              <button key={i} onClick={() => { setIdx(i); push(`Вариант ${["A", "B", "C"][i]}: ${LEADMAGNETS[i].title}`, "sky"); }} className={`h-2 cursor-pointer rounded-full transition-all duration-300 ${i === idx ? "w-7 bg-amber" : "w-2 bg-line2 hover:bg-dim"}`} aria-label={`Вариант ${i + 1}`} />
            ))}
          </div>
        </Panel>
      </Reveal>

      <Reveal delay={110} className="xl:col-span-3">
        <Panel className="h-full p-5">
          <Head kicker="Верх воронки · сгенерирован из распаковки" title="Лид-магнит и A/B-варианты" right={<Chip tone="sky">3 гипотезы</Chip>} />
          <div className="grid gap-3 sm:grid-cols-3">
            {LEADMAGNETS.map((v, i) => (
              <button key={v.title} onClick={() => { setIdx(i); push(`Активирован вариант ${["A", "B", "C"][i]}`, "sky"); }} className={`cursor-pointer rounded-lg border p-4 text-left transition-all duration-300 hover:-translate-y-0.5 ${i === idx ? "border-amber/40 bg-amber/[0.05]" : "border-line bg-deep/40 hover:border-line2"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-display text-[13px] font-extrabold text-dim">{["A", "B", "C"][i]}</span>
                  <span className={`font-mono text-[11px] ${i === idx ? "text-amber" : "text-dim"}`}>{v.conv}%</span>
                </div>
                <div className="mt-1.5 min-h-[42px] text-[12px] font-bold leading-snug text-ink">{v.title}</div>
                <Bar pct={v.conv} tone={i === idx ? "amber" : "mut"} className="mt-2.5" />
                <div className="mt-1.5 font-mono text-[10px] text-dim">{fmt(v.leads)} лидов за 12 дней</div>
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-deep/50 p-4">
              <div className="font-mono text-[10px] tracking-wider text-dim uppercase">Каналы выдачи</div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {["Лендинг + VK", "Telegram-бот", "Директ → квиз", "QR на вебинаре"].map((c) => (
                  <Chip key={c} tone="sky">{c}</Chip>
                ))}
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-mut">Каждый лид получает тег сегмента из квиза — скрипт продаж начинает прогрев адресно.</p>
            </div>
            <div className="rounded-lg border border-mint/25 bg-mint/[0.04] p-4">
              <div className="font-mono text-[10px] tracking-wider text-mint uppercase">Решение ИИ</div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink/90">
                Вариант <b>C (квиз)</b> даёт лид на 23% дешевле и сразу сегментирует аудиторию. Рекомендую направить 70% трафика на него, A оставить контрольным.
              </p>
              <ToneBtn tone="mint" className="mt-3" onClick={() => push("Трафик перенаправлен: 70% на квиз, 30% на вариант A", "mint")}>Применить</ToneBtn>
            </div>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}

/* ================= ТРИПВАЕР ================= */
export function TripwireSection({ push }: { push: (t: string, tone?: Tone) => void }) {
  const [oto, setOto] = useState(true);
  const leads = 1214;
  const conv = oto ? 4.5 : 3.1;
  const sales = Math.round((leads * conv) / 100);
  const revenue = sales * 990;

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <Reveal className="xl:col-span-2">
        <Panel hover className="relative h-full overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-12 -bottom-12 h-44 w-44 rounded-full bg-coral/10 blur-3xl" />
          <div className="flex items-center justify-between">
            <Chip tone="coral"><Icon name="bolt" size={12} /> трипваер</Chip>
            <span className="font-mono text-[10.5px] text-dim">OTO · сразу после лид-магнита</span>
          </div>
          <div className="mt-5 font-display text-xl font-extrabold leading-snug text-ink">«Промпт-пак PRO»: 200 промптов + пресеты света</div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-mut">Недорогой продукт, который превращает подписчика в покупателя и окупает трафик ещё до продажи курса.</p>
          <div className="mt-5 flex items-end gap-3">
            <span className="font-display text-4xl font-extrabold text-coral">990 ₽</span>
            <span className="mb-1 font-mono text-[12px] text-dim line-through">2 900 ₽</span>
            <Chip tone="mint" className="mb-1.5">−66%</Chip>
          </div>
          <button onClick={() => push("Оплата трипваера прошла: ЮKassa → чек 54-ФЗ отправлен покупателю", "mint")} className="mt-5 w-full cursor-pointer rounded-lg bg-coral py-3 text-center font-mono text-[12px] font-bold tracking-wider text-deep uppercase transition-all hover:brightness-110 active:scale-[0.98]">
            Купить за 990 ₽
          </button>
          <div className="mt-3 text-center font-mono text-[10px] text-dim">предложение действует 40 минут после подписки</div>
        </Panel>
      </Reveal>

      <Reveal delay={110} className="xl:col-span-3">
        <Panel className="h-full p-5">
          <Head kicker="Окупает трафик · работает автономно" title="Экономика трипваера" right={<Chip tone="coral">без затрат на рекламу</Chip>} />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-line bg-deep/50 p-4">
              <div className="font-mono text-[10px] tracking-wider text-dim uppercase">Конверсия из лида</div>
              <div className="mt-1.5 font-display text-2xl font-extrabold text-coral">{conv.toFixed(1).replace(".", ",")}%</div>
              <Bar pct={conv * 10} tone="coral" className="mt-2.5" />
            </div>
            <div className="rounded-lg border border-line bg-deep/50 p-4">
              <div className="font-mono text-[10px] tracking-wider text-dim uppercase">Продаж за запуск</div>
              <div className="mt-1.5 font-display text-2xl font-extrabold text-ink">{fmt(sales)}</div>
              <div className="mt-2 font-mono text-[10.5px] text-dim">из {fmt(leads)} лидов</div>
            </div>
            <div className="rounded-lg border border-mint/25 bg-mint/[0.04] p-4">
              <div className="font-mono text-[10px] tracking-wider text-mint uppercase">Выручка</div>
              <div className="mt-1.5 font-display text-2xl font-extrabold text-mint">{fmt(revenue)} ₽</div>
              <div className="mt-2 font-mono text-[10.5px] text-dim">окупает {fmt((revenue / 150000) * 100)}% бюджета на трафик</div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-deep/50 px-4 py-3.5">
            <div>
              <div className="text-[13px] font-bold text-ink">OTO-апселл «Разбор профиля за 4 900 ₽»</div>
              <div className="font-mono text-[10.5px] text-dim">предлагается на странице «спасибо» — берёт каждый 9-й покупатель трипваера</div>
            </div>
            <label className="flex cursor-pointer items-center gap-2.5">
              <span className={`font-mono text-[10.5px] uppercase ${oto ? "text-mint" : "text-dim"}`}>{oto ? "вкл" : "выкл"}</span>
              <button onClick={() => { setOto(!oto); push(oto ? "OTO-апселл отключён — конверсия пересчитана" : "OTO-апселл включён — прогноз +23 520 ₽", oto ? "coral" : "mint"); }} className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors duration-300 ${oto ? "bg-mint" : "border border-line2 bg-panel2"}`}>
                <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all duration-300 ${oto ? "left-[22px] bg-deep" : "left-0.5 bg-dim"}`} />
              </button>
            </label>
          </div>

          <div className="mt-4 rounded-lg border border-amber/25 bg-amber/[0.04] p-4">
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-amber uppercase"><Icon name="spark" size={13} /> что дальше · максимайзер v2</div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-mut">После курса сервис предложит клуб «Нейрофото.Про» за 3 900 ₽/мес — подписочная модель поднимает LTV ученика на 25–30%. Модуль запланирован на v2.0.</p>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
