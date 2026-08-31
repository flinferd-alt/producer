import { useEffect, useState } from "react";
import { LEADMAGNETS, MODULES_A, MODULES_B, TARIFFS, type Tone } from "../data";
import { api, apiFetch, ApiError } from "../api";
import { useStore, useAuth } from "../store";
import type { ProductContext } from "../store";
import { Bar, Chip, Head, Icon, Panel, Range, Reveal, ToneBtn, fmt } from "../ui";

/* ================= ПРОДУКТ ================= */
export function ProductSection({ push }: { push: (t: string, tone?: Tone) => void }) {
  const { activeLaunchId, productContext, setProductContext, nicheContext } = useStore();
  const { live } = useAuth();
  const [mode, setMode] = useState<"loading" | "empty" | "generating" | "data">("loading");
  const [data, setData] = useState<ProductContext | null>(null);
  const [open, setOpen] = useState(0);
  const [price, setPrice] = useState(24900);
  const [target, setTarget] = useState(60);

  // Sync from store
  useEffect(() => {
    if (productContext) {
      setData(productContext);
      setMode("data");
      if (productContext.tariffs.length > 0) {
        const main = productContext.tariffs.find(t => t.hot) || productContext.tariffs[0];
        setPrice(main.price);
      }
    }
  }, [productContext]);

  // Load from API or use demo
  useEffect(() => {
    if (!live || !activeLaunchId) {
      setMode("data");
      setData({
        niche_name: "Нейрофотография на смартфон",
        positioning: "Практический курс для заработка на нейрофото: от первых кадров до стабильных заказов за 3 недели",
        usp: "Собственная методика промптов + доход с 1-й недели, а не «творчество ради творчества»",
        competitor_diff: "Все конкуренты учат «творчеству» — мы учим монетизации. Рассрочка 0-0-4, пакетная обработка, абонентская модель для селлеров",
        modules: MODULES_A,
        tariffs: TARIFFS,
        unit_economics: { cac: 3191, ltv: 24900, romi: 312, break_even: 6 },
        methodology: { format: "Живой поток + записи", frequency: "2 раза в неделю", feedback: "Личная обратная связь куратора", certificate: "Сертификат + помощь с портфолио" },
        risks: [
          { title: "Быстрое устаревание промптов", severity: "medium", mitigation: "Обновляем библиотеку промптов каждый месяц, модуль автоматизации" },
          { title: "Высокий аукцион VK в сезон", severity: "high", mitigation: "Диверсификация: 40% VK, 30% Директ, 30% TG + посевы" },
          { title: "Негатив от «заработок без усилий»", severity: "medium", mitigation: "Позиционирование через реальные кейсы и цифры дохода" },
        ],
        recommendations: [
          "Запустить трипваер до основного курса — окупает трафик",
          "70% трафика направить на квиз-лидмагнит (дешевле на 23%)",
          "Рассрочка 0-0-4 повышает конверсию на 1.2 п.п.",
          "Абонентская модель для селлеров — LTV +30%",
        ],
      });
      return;
    }
    let mounted = true;
    setMode("loading");
    apiFetch<ProductContext>(`/launches/${activeLaunchId}/product`)
      .then(res => { if (mounted) { setData(res); setMode("data"); } })
      .catch(e => {
        if (!mounted) return;
        if (e instanceof ApiError && e.status === 404) setMode("empty");
        else { push("Ошибка загрузки стратегии продукта", "coral"); setMode("empty"); }
      });
    return () => { mounted = false; };
  }, [activeLaunchId, live]);

  const generateProduct = async () => {
    if (!live || !activeLaunchId) return;
    setMode("generating");
    push("ИИ-продюсер генерирует стратегию продукта...", "amber");
    try {
      await api.generateProduct(activeLaunchId);
      const res = await apiFetch<ProductContext>(`/launches/${activeLaunchId}/product`);
      setData(res);
      setProductContext(res);
      setMode("data");
      push("Стратегия продукта готова", "mint");
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Ошибка генерации", "coral");
      setMode("empty");
    }
  };

  if (!activeLaunchId && live) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line py-24 text-center">
        <Icon name="spark" size={32} className="mb-4 text-dim" />
        <div className="font-display text-lg font-bold text-ink">Запуск не выбран</div>
        <p className="mt-2 text-[13px] text-mut">Выберите запуск, чтобы увидеть стратегию продукта.</p>
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
          загрузка стратегии
        </span>
      </div>
    );
  }

  if (mode === "empty") {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line py-24 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-amber/10 text-amber mb-4">
          <Icon name="layers" size={28} />
        </div>
        <div className="font-display text-xl font-bold text-ink">Стратегия продукта пока не создана</div>
        <p className="mt-2 max-w-md text-[13px] text-mut leading-relaxed">
          ИИ-продюсер сгенерирует программу курса, тарифную сетку, юнит-экономику и рекомендации — на основе данных распаковки и анализа ниши.
        </p>
        <div className="mt-6">
          <ToneBtn onClick={generateProduct} tone="amber">
            <Icon name="spark" size={16} /> Сгенерировать стратегию продукта
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
          ИИ-продюсер собирает стратегию продукта<span className="caret">...</span>
        </span>
      </div>
    );
  }

  const d = data!;
  const revenue = price * target;
  const cac = d.unit_economics.cac;
  const romi = d.unit_economics.romi;

  return (
    <div className="space-y-6">
      {/* 1. Стратегия продукта */}
      <Reveal>
        <Panel className="relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-amber/10 blur-3xl" />
          <Head kicker="Позиционирование · от ИИ-продюсера" title="Стратегия продукта" right={<Chip tone="amber">{d.niche_name}</Chip>} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-amber/25 bg-amber/[0.04] p-4">
              <div className="font-mono text-[10px] tracking-[0.18em] text-amber uppercase">Позиционирование</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink/90">{d.positioning}</p>
            </div>
            <div className="rounded-lg border border-mint/20 bg-mint/[0.04] p-4">
              <div className="font-mono text-[10px] tracking-[0.18em] text-mint uppercase">УТП</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink/90">{d.usp}</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-sky/20 bg-sky/[0.04] p-4">
            <div className="font-mono text-[10px] tracking-[0.18em] text-sky uppercase">Отстройка от конкурентов</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink/90">{d.competitor_diff}</p>
          </div>
          <div className="mt-4 flex gap-2">
            <ToneBtn tone="ghost" onClick={generateProduct}><Icon name="spark" size={14} /> Пересоздать</ToneBtn>
            <ToneBtn tone="ghost" onClick={() => push("Копирайтер переписывает позиционирование под сегмент «Селлеры»", "amber")}><Icon name="copy" size={14} /> Адаптировать под сегмент</ToneBtn>
          </div>
        </Panel>
      </Reveal>

      {/* 2. Программа курса */}
      <Reveal delay={80}>
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Программа курса · сгенерирована ИИ</div>
              <div className="font-display text-lg font-bold">{d.modules.length} модулей · {d.modules.reduce((s, m) => s + m.lessons.length, 0)} уроков</div>
            </div>
            <div className="flex items-center gap-2">
              <ToneBtn tone="ghost" onClick={generateProduct}>
                <Icon name="spark" size={14} />
              </ToneBtn>
            </div>
          </div>
          <div className="divide-y divide-line/60">
            {d.modules.map((m, i) => (
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

      {/* 3. Тарифная сетка + Юнит-экономика */}
      <div className="grid gap-4 xl:grid-cols-5">
        <Reveal className="xl:col-span-3" delay={110}>
          <Panel className="p-5">
            <Head kicker="Юнит-экономика · пересчёт в реальном времени" title="Экономика курса" right={<Chip tone="amber">единый источник правды</Chip>} />
            <div className="grid gap-6 lg:grid-cols-3">
              <div>
                <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-mut">
                  <span>Цена тарифа «Основной»</span>
                  <span className="text-amber">{fmt(price)} ₽</span>
                </div>
                <Range value={price} min={9900} max={89000} step={100} onChange={setPrice} />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-mut">
                  <span>Цель продаж за запуск</span>
                  <span className="text-amber">{target} шт</span>
                </div>
                <Range value={target} min={10} max={200} step={1} onChange={(v) => setTarget(Math.round(v))} />
              </div>
              <div className="flex items-center gap-5 rounded-lg border border-amber/25 bg-amber/[0.05] px-5 py-3">
                <div>
                  <div className="font-mono text-[10px] tracking-wider text-dim uppercase">Прогноз выручки</div>
                  <div className="font-display text-2xl font-extrabold text-amber">{fmt(revenue)} ₽</div>
                </div>
                <div className="h-9 w-px bg-line" />
                <div className="space-y-0.5 font-mono text-[11px] text-mut">
                  <div>CAC: <span className="text-ink">{fmt(cac)} ₽</span></div>
                  <div>ROMI: <span className="text-mint">{fmt(romi)}%</span></div>
                  <div>Точка окупаемости: <span className="text-sky">{d.unit_economics.break_even} продаж</span></div>
                </div>
              </div>
            </div>
          </Panel>
        </Reveal>

        <Reveal className="xl:col-span-2" delay={140}>
          <div className="flex h-full flex-col gap-3">
            {d.tariffs.filter((t) => t.hot).map((t) => (
              <Panel key={t.name} className="relative flex-1 overflow-hidden border-amber/35 p-5">
                <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber/10 blur-3xl" />
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-[10px] tracking-[0.2em] text-amber uppercase">{t.note}</div>
                    <div className="mt-1 font-display text-xl font-extrabold text-ink">Тариф {t.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl font-extrabold text-amber">{fmt(t.price)} ₽</div>
                    <div className="font-mono text-[10px] text-dim">или {fmt(Math.round(t.price / 4))} ₽ × 4</div>
                  </div>
                </div>
                <ul className="mt-4 space-y-2">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12.5px] text-ink/90">
                      <Icon name="check" size={13} className="mt-0.5 shrink-0 text-amber" /> {f}
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
            <div className="grid grid-cols-2 gap-3">
              {d.tariffs.filter((t) => !t.hot).map((t) => (
                <Panel key={t.name} hover className="p-4">
                  <div className="font-mono text-[9.5px] tracking-[0.16em] text-dim uppercase">{t.note}</div>
                  <div className="mt-1 text-[14px] font-bold text-ink">{t.name}</div>
                  <div className="mt-2 font-display text-lg font-extrabold text-sky">{fmt(t.price)} ₽</div>
                  <ul className="mt-2.5 space-y-1">
                    {t.features.slice(0, 3).map((f) => (
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

      {/* 5. Методология обучения */}
      <Reveal delay={160}>
        <Panel className="p-5">
          <Head kicker="Методология · взгляд методолога" title="Как будет учиться ученик" right={<Chip tone="sky">от ИИ-методолога</Chip>} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Формат", value: d.methodology.format, tone: "amber" as Tone },
              { label: "Частота", value: d.methodology.frequency, tone: "sky" as Tone },
              { label: "Обратная связь", value: d.methodology.feedback, tone: "mint" as Tone },
              { label: "Сертификация", value: d.methodology.certificate, tone: "amber" as Tone },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-line bg-deep/50 p-4">
                <div className={`font-mono text-[10px] tracking-[0.18em] uppercase ${item.tone === "amber" ? "text-amber" : item.tone === "sky" ? "text-sky" : "text-mint"}`}>{item.label}</div>
                <p className="mt-1.5 text-[12.5px] leading-snug text-ink/90 font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </Panel>
      </Reveal>

      {/* 6. Риски и рекомендации */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Reveal delay={200}>
          <Panel className="h-full p-5">
            <Head kicker="Управление рисками" title="Что может пойти не так" right={<Chip tone="coral">{d.risks.length} рисков</Chip>} />
            <div className="space-y-3">
              {d.risks.map((r, i) => (
                <div key={r.title + i} className={`rounded-lg border p-4 ${r.severity === "high" ? "border-coral/30 bg-coral/[0.04]" : r.severity === "medium" ? "border-amber/25 bg-amber/[0.04]" : "border-line bg-deep/50"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon name={r.severity === "high" ? "x" : r.severity === "medium" ? "bolt" : "check"} size={14} className={r.severity === "high" ? "text-coral" : r.severity === "medium" ? "text-amber" : "text-mint"} />
                      <span className="text-[13px] font-bold text-ink">{r.title}</span>
                    </div>
                    <Chip tone={r.severity === "high" ? "coral" : r.severity === "medium" ? "amber" : "mint"}>{r.severity === "high" ? "Высокий" : r.severity === "medium" ? "Средний" : "Низкий"}</Chip>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-mut"><span className="font-semibold text-sky">Решение:</span> {r.mitigation}</p>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={220}>
          <Panel className="relative h-full overflow-hidden border-mint/25 p-5">
            <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-mint/10 blur-3xl" />
            <Head kicker="Рекомендации ИИ" title="Что делать дальше" right={<Chip tone="mint">{d.recommendations.length} советов</Chip>} />
            <ul className="space-y-2.5">
              {d.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-3 text-[13px] leading-snug text-ink/90">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint/15 text-mint font-display text-[11px] font-bold">{i + 1}</span>
                  {rec}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex gap-2">
              <ToneBtn tone="ghost" onClick={generateProduct}><Icon name="spark" size={14} /> Другие рекомендации</ToneBtn>
              <ToneBtn tone="mint" onClick={() => push("Рекомендации приняты — переходим к лид-магниту", "mint")}>Принять и перейти к лид-магниту</ToneBtn>
            </div>
          </Panel>
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
