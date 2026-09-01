import { useState } from "react";
import { CONTACTS, LEGAL, PRICING, type Tone } from "../data";
import { Bar, Chip, Icon, ToneBtn } from "../ui";
import { api, getToken } from "../api";

const STEPS = [
  { icon: "chat", title: "Распаковка", text: "10 вопросов — и ИИ-продюсер знает нишу, аудиторию и цель лучше, чем вы сами" },
  { icon: "target", title: "Анализ ниши", text: "Wordstat + конкуренты + сегменты ЦА — данные, а не догадки" },
  { icon: "layers", title: "Программа курса", text: "Модули, уроки, тарифы — всё генерируется на основе брифа и данных ниши" },
  { icon: "funnel", title: "Воронка продаж", text: "Лид-магнит → трипваер → курс — с расчётом юнит-экономики" },
  { icon: "mega", title: "Трафик и продажи", text: "ИИ-медиабаер запускает рекламу, скрипт продаж закрывает в Telegram" },
];

const NUMBERS = [
  { value: "82%", label: "ниш с потенциалом ROMI > 300%" },
  { value: "10 мин", label: "на полный бриф эксперта" },
  { value: "7", label: "ИИ-агентов работают параллельно" },
  { value: "0", label: "строк кода от вас" },
];

export default function Welcome({ onTry }: { onTry: () => void }) {
  const [emailSent, setEmailSent] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const handleEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSent(true);
  };

  const handlePay = async (tariff: "pro" | "studio") => {
    if (!getToken()) {
      onTry(); // перейти к входу в кабинет
      return;
    }
    if (!agreed) {
      setPayError("Подтвердите согласие с офертой");
      return;
    }
    setPaying(true);
    setPayError("");
    try {
      const res = await api.createPayment(tariff);
      if (res.confirmation_url) {
        window.location.href = res.confirmation_url;
      } else {
        setPayError("YooKassa не вернула ссылку оплаты. Попробуйте позже или свяжитесь с поддержкой.");
      }
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Ошибка создания платежа");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen text-ink">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-amber/8 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-20 h-[400px] w-[400px] rounded-full bg-mint/6 blur-3xl" />
        <div className="relative mx-auto max-w-4xl text-center">
          <Chip tone="amber" className="mb-6">YandexGPT-5 · Beget PostgreSQL · Cloud Functions</Chip>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Продюсер<span className="text-amber">.</span>AI
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-mut sm:text-xl">
            От идеи до запуска онлайн-курса за часы, а не месяцы.
            YandexGPT анализирует нишу, пишет программу, строит воронку
            и запускает рекламу — пока вы пьёте кофе.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <ToneBtn tone="mint" onClick={onTry} className="px-8 py-3 text-sm">
              <Icon name="play" size={18} /> Попробовать бесплатно
            </ToneBtn>
            <a href="#pricing" className="inline-flex items-center gap-2 rounded-lg border border-line2 px-6 py-3 font-mono text-[12px] font-semibold tracking-wide uppercase text-mut transition-all hover:border-amber/40 hover:text-ink">
              Тарифы и цены
            </a>
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="border-y border-line bg-deep2/50 px-4 py-10 sm:px-6">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 sm:grid-cols-4">
          {NUMBERS.map((n) => (
            <div key={n.label} className="text-center">
              <div className="font-display text-3xl font-extrabold text-amber">{n.value}</div>
              <div className="mt-1 font-mono text-[11px] tracking-wider text-dim uppercase">{n.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <div className="font-mono text-[10px] tracking-[0.24em] text-dim uppercase">Как это работает</div>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">5 шагов — и курс запущен</h2>
          </div>
          <div className="space-y-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="group flex gap-4 rounded-xl border border-line bg-panel p-4 transition-all hover:border-amber/30 hover:bg-amber/[0.03] sm:gap-6 sm:p-5">
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-amber/10 text-amber">
                    <Icon name={s.icon} size={20} />
                  </span>
                  <span className="font-mono text-[10px] text-dim">{i + 1}</span>
                </div>
                <div>
                  <div className="font-display text-base font-bold text-ink">{s.title}</div>
                  <p className="mt-1 text-[13px] leading-relaxed text-mut">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-line bg-deep2/30 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="font-mono text-[10px] tracking-[0.24em] text-dim uppercase">Тарифы</div>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">Выберите план</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {PRICING.map((p) => {
              const toneMap: Record<Tone, { border: string; bg: string; glow: string }> = {
                amber: { border: "border-amber/40", bg: "bg-amber/5", glow: "shadow-[0_8px_32px_-12px_rgba(255,178,36,0.5)]" },
                sky: { border: "border-sky/30", bg: "bg-sky/5", glow: "" },
                mint: { border: "border-mint/30", bg: "bg-mint/5", glow: "" },
                coral: { border: "border-coral/30", bg: "bg-coral/5", glow: "" },
                mut: { border: "border-line", bg: "", glow: "" },
              };
              const t = toneMap[p.tone];
              return (
                <div key={p.id} className={`relative rounded-2xl border ${t.border} ${t.bg} ${t.glow} p-5 sm:p-6`}>
                  {p.hot && <div className="absolute -top-3 left-1/2 -translate-x-1/2"><Chip tone="amber">Хит продаж</Chip></div>}
                  <div className="font-display text-lg font-bold text-ink">{p.name}</div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-3xl font-extrabold text-ink">{p.price}</span>
                    <span className="font-mono text-[12px] text-dim">{p.period}</span>
                  </div>
                  <p className="mt-2 text-[13px] text-mut">{p.desc}</p>
                  <ul className="mt-4 space-y-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13px] text-mut">
                        <Icon name="check" size={14} className="mt-0.5 shrink-0 text-mint" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    {p.id !== "starter" && (
                      <label className="mb-3 flex cursor-pointer items-start gap-2 text-[11px] leading-tight text-dim">
                        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-amber" />
                        <span>Принимаю <a href={LEGAL.offerUrl} target="_blank" className="text-amber hover:underline">условия оферты</a> и <a href={LEGAL.privacyUrl} target="_blank" className="text-amber hover:underline">политику конфиденциальности</a></span>
                      </label>
                    )}
                    <ToneBtn tone={p.tone === "sky" ? "ghost" : p.tone === "mint" ? "mint" : "amber"} onClick={() => { if (p.id === "pro") handlePay("pro"); else if (p.id === "studio") handlePay("studio"); else onTry(); }} disabled={paying && p.id !== "starter"} className="w-full justify-center">
                      {p.cta}
                    </ToneBtn>
                  </div>
                </div>
              );
            })}
          </div>
          {payError && (
            <div className="mx-auto mt-4 max-w-md rounded-lg border border-coral/30 bg-coral/5 px-4 py-2.5 text-center text-[12px] text-coral">
              {payError}
            </div>
          )}
        </div>
      </section>

      {/* Email capture */}
      <section className="border-t border-line px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">Получите доступ к бета-версии</h2>
          <p className="mt-2 text-[13px] text-mut">Оставьте email — мы пришлём приглашение, когда откроем регистрацию.</p>
          {emailSent ? (
            <div className="mt-6 rounded-xl border border-mint/30 bg-mint/5 p-4 text-center">
              <Icon name="check" size={20} className="mx-auto text-mint" />
              <div className="mt-2 font-display text-base font-bold text-mint">Готово! Проверьте почту.</div>
            </div>
          ) : (
            <form onSubmit={handleEmail} className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                required
                placeholder="your@email.com"
                className="flex-1 rounded-lg border border-line bg-panel px-4 py-2.5 font-mono text-[13px] text-ink placeholder:text-dim focus:border-amber/50 focus:outline-none"
              />
              <ToneBtn tone="mint" type="submit" className="shrink-0">
                <Icon name="spark" size={14} /> Отправить
              </ToneBtn>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-deep2/50 px-4 py-8 sm:px-6" id="footer">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-amber/30 bg-amber/10">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3.5 4.5h17l-6.3 7.4v5.6l-4.4-2.2v-3.4Z" fill="#ffb224" />
                <path d="M18.5 3v3M17 4.5h3" stroke="#3ddc97" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <span className="font-display text-sm font-bold text-ink">
              ПРОДЮСЕР<span className="text-amber">.AI</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a href={CONTACTS.telegram} target="_blank" rel="noopener" className="text-mut transition-colors hover:text-ink" title="Telegram">
              <Icon name="chat" size={18} />
            </a>
            <a href={`mailto:${CONTACTS.email}`} className="text-mut transition-colors hover:text-ink" title="Email">
              <Icon name="doc" size={18} />
            </a>
          </div>
          <div className="font-mono text-[11px] text-dim">
            © {new Date().getFullYear()} ПРОДЮСЕР.AI
          </div>
        </div>

          <div className="border-t border-line/60 pt-5">
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
              <div className="font-mono text-[11px] text-dim">
                {LEGAL.fullName} · ИНН {LEGAL.inn}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[11px]">
                <a href={LEGAL.offerUrl} className="text-mut hover:text-amber transition-colors">Оферта</a>
                <a href={LEGAL.privacyUrl} className="text-mut hover:text-amber transition-colors">Политика конфиденциальности</a>
              </div>
            </div>
            <div className="mt-3 flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
              <div className="flex items-center gap-3 font-mono text-[11px] text-dim">
                <a href={`mailto:${LEGAL.email}`} className="hover:text-ink transition-colors">{LEGAL.email}</a>
                <span className="text-line2">·</span>
                <a href={LEGAL.telegram} target="_blank" rel="noopener" className="hover:text-ink transition-colors">Telegram</a>
              </div>
              <div className="font-mono text-[11px] text-dim">
                {LEGAL.deliveryNote}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
