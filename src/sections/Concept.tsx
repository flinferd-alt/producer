import { useState } from "react";
import { ARCH_EXTRA, ARCH_GROUPS, OPEN_QUESTIONS, PIPELINE, PITFALLS, ROADMAP, type Tone } from "../data";
import { Chip, Dot, Head, Icon, Panel, Reveal, ToneBtn, TONE_TEXT } from "../ui";

function ArchArrow({ down = false }: { down?: boolean }) {
  return (
    <div className={`flex items-center justify-center text-line2 ${down ? "rotate-90 py-1" : ""}`}>
      <svg width={down ? 20 : 44} height={down ? 44 : 20} viewBox={down ? "0 0 20 44" : "0 0 44 20"} fill="none" aria-hidden="true">
        <path d={down ? "M10 2v34m-6-8 6 8 6-8" : "M2 10h34m-8-6 8 6-8 6"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="flow-dash" />
      </svg>
    </div>
  );
}

export default function Concept({ push }: { push: (t: string, tone?: Tone) => void }) {
  const [checked, setChecked] = useState<boolean[]>(OPEN_QUESTIONS.map(() => false));

  return (
    <div className="space-y-8">
      {/* pipeline */}
      <section>
        <Head
          kicker="Как устроен сервис"
          title="Продюсер — это конвейер из 8 этапов"
          right={<Chip tone="sky">каждый этап = набор AI-агентов</Chip>}
        />
        <Reveal>
          <Panel className="overflow-x-auto p-5">
            <div className="flex min-w-[900px] items-stretch gap-0">
              {PIPELINE.map((p, i) => (
                <div key={p.num} className="flex items-center">
                  <div className={`relative w-[130px] shrink-0 rounded-lg border p-3 text-center transition-all duration-300 hover:-translate-y-1 ${p.status === "в работе" ? "border-amber/35 bg-amber/[0.05]" : "border-line bg-panel2/40"} ${p.status === "позже" ? "opacity-50" : ""}`}>
                    <div className={`font-display text-[15px] font-extrabold ${TONE_TEXT[p.tone]}`}>{p.num}</div>
                    <div className="mt-0.5 text-[11.5px] font-bold leading-tight text-ink">{p.title}</div>
                    <div className={`mt-1 font-mono text-[9px] tracking-wider uppercase ${TONE_TEXT[p.tone]}`}>{p.status}</div>
                  </div>
                  {i < PIPELINE.length - 1 && <ArchArrow />}
                </div>
              ))}
            </div>
            <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-mut">
              Каждый этап оставляет данные в базах Yandex Cloud. От запуска к запуску ИИ не начинает с нуля: воронка, офферы и медиамикс
              корректируются на основе накопленной статистики — это и есть «обучающийся продюсер».
            </p>
          </Panel>
        </Reveal>
      </section>

      {/* architecture */}
      <section>
        <Head kicker="Архитектура на Yandex Cloud" title="Четыре слоя системы" right={<Chip tone="mint">все данные — в РФ, 152-ФЗ</Chip>} />
        <div className="grid gap-3 lg:grid-cols-4">
          {ARCH_GROUPS.map((g, i) => (
            <Reveal key={g.title} delay={i * 90}>
              <div className="flex h-full items-stretch gap-0">
                <Panel hover className="h-full flex-1 p-5">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">слой {i + 1}</div>
                    <Dot tone={g.tone} pulse={i === 1} />
                  </div>
                  <div className={`mt-1 font-display text-[15px] font-bold ${TONE_TEXT[g.tone]}`}>{g.title}</div>
                  <ul className="mt-3.5 space-y-2.5">
                    {g.items.map((it) => (
                      <li key={it} className="flex items-start gap-2 text-[12.5px] leading-snug text-ink/90">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-line2" />
                        {it}
                      </li>
                    ))}
                  </ul>
                </Panel>
                {i < 3 && <div className="hidden lg:flex items-center"><ArchArrow /></div>}
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120}>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {ARCH_EXTRA.map((s) => (
              <div key={s.title} className="panel panel-hover flex items-center gap-3 px-4 py-3">
                <Icon name="schema" size={16} className="shrink-0 text-sky" />
                <div>
                  <div className="text-[12.5px] font-bold text-ink">{s.title}</div>
                  <div className="font-mono text-[10.5px] text-dim">{s.text}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* pitfalls */}
      <section>
        <Head kicker="Подводные камни" title="Что может пойти не так — и как закрываем" right={<Chip tone="coral">8 рисков под контролем</Chip>} />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PITFALLS.map((p, i) => (
            <Reveal key={p.title} delay={(i % 4) * 80}>
              <Panel hover className="h-full p-4.5 p-5">
                <Chip tone={p.tone}>{p.tag}</Chip>
                <div className="mt-2.5 text-[14px] font-bold leading-snug text-ink">{p.title}</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-mut">{p.text}</p>
              </Panel>
            </Reveal>
          ))}
        </div>
      </section>

      {/* roadmap + questions */}
      <div className="grid gap-4 xl:grid-cols-5">
        <section className="xl:col-span-3">
          <Head kicker="Дорожная карта" title="MVP → v2.0" />
          <div className="space-y-3">
            {ROADMAP.map((r, i) => (
              <Reveal key={r.phase} delay={i * 100}>
                <Panel hover className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
                  <div className="sm:w-36 shrink-0">
                    <div className={`font-display text-xl font-extrabold ${TONE_TEXT[r.tone]}`}>{r.phase}</div>
                    <div className="mt-1 font-mono text-[10.5px] tracking-wider text-dim uppercase">{r.time}</div>
                  </div>
                  <div className="grid flex-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                    {r.items.map((it) => (
                      <div key={it} className="flex items-start gap-2 text-[12.5px] leading-snug text-ink/90">
                        <Icon name="check" size={13} className={`mt-0.5 shrink-0 ${TONE_TEXT[r.tone]}`} />
                        {it}
                      </div>
                    ))}
                  </div>
                </Panel>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="xl:col-span-2">
          <Head kicker="Решаем вместе" title="Открытые вопросы" right={<Chip tone="amber">{checked.filter(Boolean).length}/{OPEN_QUESTIONS.length}</Chip>} />
          <Reveal>
            <Panel className="p-5">
              <ul className="space-y-2">
                {OPEN_QUESTIONS.map((oq, i) => (
                  <li key={oq}>
                    <button
                      onClick={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
                      className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-all duration-300 ${checked[i] ? "border-mint/30 bg-mint/[0.05]" : "border-line hover:border-line2"}`}
                    >
                      <span className={`mt-0.5 grid h-4.5 w-4.5 h-[18px] w-[18px] shrink-0 place-items-center rounded border transition-colors ${checked[i] ? "border-mint bg-mint text-deep" : "border-line2"}`}>
                        {checked[i] && <Icon name="check" size={11} />}
                      </span>
                      <span className={`text-[12.5px] leading-snug ${checked[i] ? "text-mut line-through" : "text-ink/90"}`}>{oq}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <ToneBtn className="mt-4 w-full justify-center" onClick={() => push("Ответы зафиксированы — оркестратор учтёт их в архитектуре запуска", "mint")}>
                Зафиксировать решения
              </ToneBtn>
            </Panel>
          </Reveal>
        </section>
      </div>

      {/* additions */}
      <section>
        <Head kicker="Что добавлено к исходной задумке" title="Усилители, которые я предлагаю" />
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { icon: "lock", tone: "amber" as Tone, t: "Контур одобрений", d: "ИИ готовит решения по деньгам и трафику, человек подтверждает в один клик — в Telegram или кабинете. Доверие + защита от галлюцинаций." },
            { icon: "chart", tone: "mint" as Tone, t: "Юнит-экономика — источник правды", d: "Любое изменение воронки, тарифа или бюджета мгновенно пересчитывает CAC, LTV и ROMI. Все агенты смотрят в одни цифры." },
            { icon: "layers", tone: "sky" as Tone, t: "Шаблоны запусков + максимайзер", d: "Успешная конфигурация сохраняется как шаблон для следующих запусков. После курса — апселл в клуб/менторство: +25% к LTV." },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 90}>
              <Panel hover className="h-full p-5">
                <span className={`grid h-10 w-10 place-items-center rounded-lg ${c.tone === "amber" ? "bg-amber/12 text-amber" : c.tone === "mint" ? "bg-mint/12 text-mint" : "bg-sky/12 text-sky"}`}>
                  <Icon name={c.icon} size={19} />
                </span>
                <div className="mt-3 text-[14.5px] font-bold text-ink">{c.t}</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-mut">{c.d}</p>
              </Panel>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
