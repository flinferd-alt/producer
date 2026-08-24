import { useState } from "react";
import { INTEGRATIONS, LAUNCHES, type Tone } from "../data";
import { Bar, Chip, Dot, Head, Icon, Panel, Reveal, ToneBtn, TONE_TEXT } from "../ui";

export default function Cabinet({ push }: { push: (t: string, tone?: Tone) => void }) {
  const [ints, setInts] = useState(INTEGRATIONS);
  const [shown, setShown] = useState<Record<string, boolean>>({});

  const KEYS = [
    { name: "ЮKassa · секретный ключ", val: "live_a9f3••••••••••••7d2c" },
    { name: "VK Ads API · токен кабинета", val: "vkad••••••••••••91be" },
    { name: "Яндекс Директ · OAuth", val: "ydir••••••••••••4f08" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-3">
        {/* profile */}
        <Reveal>
          <Panel className="relative h-full overflow-hidden p-5">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky/10 blur-3xl" />
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-line2 bg-panel2 font-display text-xl font-extrabold text-amber">АМ</div>
              <div>
                <div className="font-display text-lg font-extrabold text-ink">Алексей Морозов</div>
                <div className="font-mono text-[10.5px] tracking-wider text-dim uppercase">продюсер-эксперт · тариф «Студия»</div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {[
                { l: "запусков", v: "7" },
                { l: "выручка", v: "9,4 млн" },
                { l: "средний ROMI", v: "289%" },
              ].map((s) => (
                <div key={s.l} className="rounded-lg border border-line bg-deep/50 p-3 text-center">
                  <div className="font-display text-[16px] font-extrabold text-ink">{s.v}</div>
                  <div className="mt-0.5 font-mono text-[9.5px] tracking-wider text-dim uppercase">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              <ToneBtn tone="ghost" className="w-full justify-center" onClick={() => push("Настройки уведомлений: Telegram-бот будет присылать только решения на одобрение", "sky")}>
                Настройки уведомлений
              </ToneBtn>
              <ToneBtn tone="ghost" className="w-full justify-center" onClick={() => push("Все данные запуска выгружены: JSON (бриф, воронка) + CSV (платежи, события)", "sky")}>
                <Icon name="doc" size={14} /> Экспорт данных
              </ToneBtn>
            </div>
          </Panel>
        </Reveal>

        {/* launches */}
        <Reveal delay={100} className="xl:col-span-2">
          <Panel className="h-full p-5">
            <Head kicker="Все проекты" title="Запуски" right={<Chip tone="mint">шаблоны сохраняются от запуска к запуску</Chip>} />
            <div className="space-y-3">
              {LAUNCHES.map((l) => (
                <div key={l.name} className="rounded-lg border border-line bg-deep/40 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-line2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Dot tone={l.tone} pulse={l.status === "активен"} />
                      <div>
                        <div className="text-[13.5px] font-bold text-ink">{l.name}</div>
                        <div className="font-mono text-[10.5px] text-dim">{l.expert} · {l.stage}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-mono text-[12px] font-bold text-amber">{l.revenue}</div>
                        <div className="font-mono text-[10px] text-dim">ROMI {l.romi}</div>
                      </div>
                      <Chip tone={l.tone}>{l.status}</Chip>
                    </div>
                  </div>
                  <Bar pct={l.progress} tone={l.tone} className="mt-3" />
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* integrations */}
        <Reveal className="xl:col-span-3">
          <Panel className="h-full p-5">
            <Head kicker="Подключено к сервису" title="Интеграции" right={<Chip tone="sky">ключи хранятся в Lockbox</Chip>} />
            <div className="grid gap-3 sm:grid-cols-2">
              {ints.map((it, i) => (
                <div key={it.name} className={`flex items-center justify-between rounded-lg border p-4 transition-all duration-300 ${it.on ? "border-line bg-deep/40 hover:border-line2" : "border-line/60 bg-deep/20"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`grid h-9 w-9 place-items-center rounded-lg ${it.on ? "bg-sky/10 text-sky" : "bg-panel2 text-dim"}`}>
                      <Icon name={it.name.includes("ЮKassa") ? "card" : it.name.includes("VK") ? "mega" : it.name.includes("Директ") ? "chart" : it.name.includes("Метрика") ? "target" : it.name.includes("Telegram") ? "chat" : "schema"} size={17} />
                    </span>
                    <div>
                      <div className="text-[13px] font-bold text-ink">{it.name}</div>
                      <div className="font-mono text-[10px] text-dim">{it.desc}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={`font-mono text-[10px] uppercase ${it.on ? "text-mint" : "text-dim"}`}>{it.on ? "ок" : "нет"}</span>
                    <button
                      onClick={() => {
                        setInts((arr) => arr.map((x, j) => (j === i ? { ...x, on: !x.on } : x)));
                        push(it.on ? `${it.name}: соединение разорвано, агент уведомлён` : `${it.name}: подключено, синхронизация запущена`, it.on ? "coral" : "mint");
                      }}
                      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-300 ${it.on ? "bg-mint" : "border border-line2 bg-panel2"}`}
                    >
                      <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all duration-300 ${it.on ? "left-[22px] bg-deep" : "left-0.5 bg-dim"}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>

        {/* keys + note */}
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Reveal delay={90}>
            <Panel className="p-5">
              <Head kicker="Yandex Lockbox" title="Ключи и секреты" />
              <ul className="space-y-2.5">
                {KEYS.map((k) => (
                  <li key={k.name} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-deep/50 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold text-ink">{k.name}</div>
                      <div className="mt-0.5 truncate font-mono text-[11px] text-amber">{shown[k.name] ? k.val.replace(/•+/g, "x8k2m9q4") : k.val}</div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => setShown((s) => ({ ...s, [k.name]: !s[k.name] }))} className="cursor-pointer rounded-md border border-line px-2 py-1.5 text-dim transition-colors hover:text-ink" aria-label="Показать">
                        <Icon name="lock" size={13} />
                      </button>
                      <button onClick={() => push(`Ключ «${k.name}» скопирован в буфер обмена`, "sky")} className="cursor-pointer rounded-md border border-line px-2 py-1.5 text-dim transition-colors hover:text-ink" aria-label="Копировать">
                        <Icon name="copy" size={13} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </Reveal>
          <Reveal delay={160}>
            <Panel className="flex-1 border-amber/25 p-5">
              <div className={`flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] uppercase ${TONE_TEXT.amber}`}>
                <Icon name="spark" size={13} /> как читается роль клиента
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-mut">
                На клиенте остаются только вводные данные — ответы на вопросы распаковки и редкие одобрения. Всё остальное — анализ, продукт,
                рекламу, оплаты и аналитику — ведут агенты. Ведение курса подключим отдельным модулем в v2.
              </p>
            </Panel>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
