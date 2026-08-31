import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LEGAL, type Tone } from "./data";
import { api } from "./api";

/* ---------------- hooks ---------------- */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

export function useCountUp(target: number, duration = 1100) {
  const reduced = useReducedMotion();
  const [val, setVal] = useState(reduced ? target : 0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (reduced) {
      setVal(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (target - from) * eased;
      setVal(v);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced]);
  return val;
}

const POOL = "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ0123456789·—";

export function useScramble(text: string) {
  const reduced = useReducedMotion();
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (reduced) {
      setOut(text);
      return;
    }
    let frame = 0;
    const total = 16;
    const id = setInterval(() => {
      frame++;
      const fixed = Math.floor((frame / total) * text.length);
      let s = "";
      for (let i = 0; i < text.length; i++) {
        if (i < fixed || text[i] === " ") s += text[i];
        else s += POOL[Math.floor(Math.random() * POOL.length)];
      }
      setOut(s);
      if (frame >= total) {
        setOut(text);
        clearInterval(id);
      }
    }, 34);
    return () => clearInterval(id);
  }, [text, reduced]);
  return out;
}

/* ---------------- reveal ---------------- */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${inView ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ---------------- icons (custom inline SVG) ---------------- */
const PATHS: Record<string, ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="5" rx="1.5" />
      <rect x="13.5" y="11" width="7.5" height="10" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 4v-4H6.5A2.5 2.5 0 0 1 4 13.5Z" />
      <path d="M8.5 8h7M8.5 11h4.5" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 4.5-9 4.5-9-4.5Z" />
      <path d="m4.5 11.5-1.5.75 9 4.5 9-4.5-1.5-.75" />
      <path d="m4.5 15.75-1.5.75 9 4.5 9-4.5-1.5-.75" />
    </>
  ),
  magnet: (
    <>
      <path d="M5 4v6a7 7 0 0 0 14 0V4" />
      <path d="M5 4h4v6a3 3 0 0 0 6 0V4h4" />
      <path d="M5 8h4M15 8h4" />
    </>
  ),
  bolt: <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5Z" />,
  funnel: <path d="M3 4h18l-6.8 8v6.2L9.8 16V12Z" />,
  mega: (
    <>
      <path d="m3 10 14-5v14L3 14Z" />
      <path d="M17 8.5c1.8.4 3 1.7 3 3.5s-1.2 3.1-3 3.5" />
      <path d="M6.5 14.8 8 20h3l-1.2-4.4" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19M6 15h4" />
    </>
  ),
  chart: (
    <>
      <path d="M3.5 3.5v17h17" />
      <path d="m7 14 4-5 3.5 3L19 6.5" />
      <circle cx="19" cy="6.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  bot: (
    <>
      <rect x="5" y="7.5" width="14" height="11" rx="3" />
      <path d="M12 7.5V4.5M12 4.5h.01M8.5 4.5h7" />
      <circle cx="9" cy="12.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12.5" r="1.2" fill="currentColor" stroke="none" />
      <path d="M9.5 15.5h5" />
      <path d="M2.5 12v3M21.5 12v3" />
    </>
  ),
  schema: (
    <>
      <circle cx="5" cy="6" r="2.2" />
      <circle cx="19" cy="6" r="2.2" />
      <circle cx="12" cy="18" r="2.2" />
      <path d="M7.2 6h9.6M6.2 7.9l4.6 8.2M17.8 7.9l-4.6 8.2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.3-3.6 4-5.5 7.5-5.5s6.2 1.9 7.5 5.5" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  arrow: <path d="M4 12h15m-6-7 7 7-7 7" />,
  play: <path d="M8 5.5v13l11-6.5Z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  spark: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m12 9.5 1.2 1.3 1.3 1.2-1.3 1.2L12 14.5l-1.2-1.3-1.3-1.2 1.3-1.2Z" fill="currentColor" stroke="none" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M5.5 15.5h-1a1.5 1.5 0 0 1-1.5-1.5V5.5A1.5 1.5 0 0 1 4.5 4H14a1.5 1.5 0 0 1 1.5 1.5v1" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3h8l4 4v14H6Z" />
      <path d="M14 3v4h4M9 12h6M9 15.5h6M9 8.5h2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 7.7-1.6" />
      <circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  shield: (
    <>
      <path d="M12 3.5 5 6.2v5.2c0 4.6 3 7.6 7 9.1 4-1.5 7-4.5 7-9.1V6.2Z" />
      <path d="m9.2 11.8 2 2 3.6-4.1" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  logout: (
    <>
      <path d="M9.5 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20h4" />
      <path d="m15 8 4 4-4 4M19 12H9.5" />
    </>
  ),
  crown: <path d="M4.5 16.5h15M5.5 16.5 4.5 8l4.4 3L12 5.5 15.1 11l4.4-3-1 8.5Z" />,
};

export function Icon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name] ?? PATHS.spark}
    </svg>
  );
}

/* ---------------- small components ---------------- */
export const TONE_TEXT: Record<Tone, string> = {
  amber: "text-amber",
  mint: "text-mint",
  coral: "text-coral",
  sky: "text-sky",
  mut: "text-mut",
};

export function Chip({ tone = "mut", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  const map: Record<Tone, string> = {
    amber: "bg-amber/10 text-amber border-amber/25",
    mint: "bg-mint/10 text-mint border-mint/25",
    coral: "bg-coral/10 text-coral border-coral/25",
    sky: "bg-sky/10 text-sky border-sky/25",
    mut: "bg-panel2 text-mut border-line",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] leading-5 tracking-wide ${map[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Dot({ tone = "mint", pulse = false }: { tone?: Tone; pulse?: boolean }) {
  const bg: Record<Tone, string> = { amber: "bg-amber", mint: "bg-mint", coral: "bg-coral", sky: "bg-sky", mut: "bg-dim" };
  const text: Record<Tone, string> = { amber: "text-amber", mint: "text-mint", coral: "text-coral", sky: "text-sky", mut: "text-dim" };
  return <span className={`inline-block h-2 w-2 rounded-full ${bg[tone]} ${text[tone]} ${pulse ? "pulse-dot" : ""}`} />;
}

export function Spark({ data, color = "#3ddc97", w = 96, h = 30, fill = true }: { data: number[]; color?: string; w?: number; h?: number; fill?: boolean }) {
  const { pts, area } = useMemo(() => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = w / (data.length - 1);
    const p = data.map((v, i) => `${(i * step).toFixed(1)},${(h - 3 - ((v - min) / range) * (h - 6)).toFixed(1)}`);
    return { pts: p.join(" "), area: `0,${h} ${p.join(" ")} ${w},${h}` };
  }, [data, w, h]);
  const gid = useMemo(() => `g${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden="true">
      {fill && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#${gid})`} />
        </>
      )}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.split(" ").pop()?.split(",")[0]} cy={pts.split(" ").pop()?.split(",")[1]} r="2.6" fill={color} />
    </svg>
  );
}

export function Bar({ pct, tone = "amber", className = "" }: { pct: number; tone?: Tone; className?: string }) {
  const bg: Record<Tone, string> = { amber: "bg-amber", mint: "bg-mint", coral: "bg-coral", sky: "bg-sky", mut: "bg-dim" };
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-line/70 ${className}`}>
      <div className={`h-full rounded-full ${bg[tone]} transition-all duration-700 ease-out`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export function Toggle({ on, onChange, tone = "mint" }: { on: boolean; onChange: (v: boolean) => void; tone?: Tone }) {
  const bg: Record<Tone, string> = { amber: "bg-amber", mint: "bg-mint", coral: "bg-coral", sky: "bg-sky", mut: "bg-dim" };
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-300 ${on ? `${bg[tone]} border-transparent` : "border-line2 bg-panel2"}`}
      role="switch"
      aria-checked={on}
    >
      <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-deep transition-all duration-300 ${on ? "left-[22px]" : "left-0.5 bg-dim"}`} style={{ height: 18, width: 18 }} />
    </button>
  );
}

export function Range({ value, min, max, step = 0.1, onChange, tone = "#ffb224" }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; tone?: string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ ["--fill" as string]: `${pct}%`, background: `linear-gradient(to right, ${tone} ${pct}%, #223450 ${pct}%)` }}
    />
  );
}

export function Num({ value, prefix = "", suffix = "", className = "" }: { value: number; prefix?: string; suffix?: string; className?: string }) {
  const v = useCountUp(value);
  return (
    <span className={className}>
      {prefix}
      {Math.round(v).toLocaleString("ru-RU")}
      {suffix}
    </span>
  );
}

export function fmt(n: number) {
  return Math.round(n).toLocaleString("ru-RU");
}

export function ToneBtn({ children, onClick, tone = "amber", className = "", disabled = false, type = "button" }: { children: ReactNode; onClick?: () => void; tone?: "amber" | "ghost" | "mint" | "coral"; className?: string; disabled?: boolean; type?: "button" | "submit" | "reset" }) {
  const map = {
    amber: "bg-amber text-deep hover:brightness-110 shadow-[0_8px_24px_-10px_rgba(255,178,36,0.7)]",
    mint: "bg-mint text-deep hover:brightness-110 shadow-[0_8px_24px_-10px_rgba(61,220,151,0.6)]",
    coral: "bg-coral/15 text-coral border border-coral/30 hover:bg-coral/25",
    ghost: "border border-line2 text-mut hover:text-ink hover:border-sky/50 hover:bg-sky/5",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 font-mono text-[12px] font-semibold tracking-wide uppercase transition-all duration-300 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${map[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = "", hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return <div className={`panel ${hover ? "panel-hover" : ""} ${className}`}>{children}</div>;
}

export function Head({ kicker, title, right }: { kicker: string; title: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="mb-1.5 font-mono text-[11px] tracking-[0.22em] text-dim uppercase">{kicker}</div>
        <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h2>
      </div>
      {right}
    </div>
  );
}

/** Paywall-заглушка для free-пользователей — показывает тариф «Про». */
export function PaywallNote({ title, go }: { title: string; go: (id: string) => void }) {
  const [agreed, setAgreed] = useState(false);
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState("");

  const handlePay = async () => {
    if (!agreed) { setErr("Подтвердите согласие с офертой"); return; }
    setPaying(true); setErr("");
    try {
      const res = await api.createPayment("pro");
      if (res.confirmation_url) window.location.href = res.confirmation_url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка оплаты");
    } finally { setPaying(false); }
  };

  return (
    <div className="panel relative overflow-hidden p-8">
      <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-amber/10 blur-3xl" />
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl border border-amber/30 bg-amber/10 text-amber">
          <Icon name="crown" size={28} />
        </span>
        <div>
          <div className="font-display text-xl font-extrabold text-ink">{title}</div>
          <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-mut">
            Тариф «Про» — 4 900 ₽/мес. Разблокирует продукт, лид-магнит, трипваер и воронку продаж.
          </p>
        </div>

        {/*Что бесплатно*/}
        <div className="w-full max-w-md rounded-xl border border-mint/20 bg-mint/5 px-4 py-3">
          <div className="mb-2 font-mono text-[10px] tracking-[0.2em] text-mint uppercase">Бесплатно — без тарифа</div>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12px] text-mut">
            <span className="flex items-center gap-1"><Icon name="check" size={11} className="text-mint" /> Распаковка</span>
            <span className="flex items-center gap-1"><Icon name="check" size={11} className="text-mint" /> Анализ ниши</span>
            <span className="flex items-center gap-1"><Icon name="check" size={11} className="text-mint" /> Реклама</span>
            <span className="flex items-center gap-1"><Icon name="check" size={11} className="text-mint" /> Платежи</span>
            <span className="flex items-center gap-1"><Icon name="check" size={11} className="text-mint" /> Статистика</span>
          </div>
          <button onClick={() => go("unpack")} className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 font-mono text-[11px] font-semibold tracking-wide text-mint transition-all hover:brightness-125">
            Посмотреть бесплатные разделы <Icon name="arrow" size={12} />
          </button>
        </div>

        {/*Что в Pro*/}
        <ul className="mt-1 space-y-1.5 text-left text-[12px] leading-snug text-mut">
          <li className="flex items-start gap-2"><Icon name="crown" size={12} className="mt-0.5 shrink-0 text-amber" /> Продукт: программа курса от ИИ</li>
          <li className="flex items-start gap-2"><Icon name="crown" size={12} className="mt-0.5 shrink-0 text-amber" /> Лид-магнит: магнит для сбора заявок</li>
          <li className="flex items-start gap-2"><Icon name="crown" size={12} className="mt-0.5 shrink-0 text-amber" /> Трипваер: дешёвый продукт для прогрева</li>
          <li className="flex items-start gap-2"><Icon name="crown" size={12} className="mt-0.5 shrink-0 text-amber" /> Воронка продаж с юнит-экономикой</li>
          <li className="flex items-start gap-2"><Icon name="check" size={12} className="mt-0.5 shrink-0 text-mint" /> Неограниченные запуски и брифы</li>
        </ul>

        <div className="flex flex-col items-center gap-3">
          <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-tight text-dim">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-amber" />
            <span>Принимаю <a href={LEGAL.offerUrl} target="_blank" className="text-amber hover:underline">оферту</a> и <a href={LEGAL.privacyUrl} target="_blank" className="text-amber hover:underline">политику</a></span>
          </label>
          <ToneBtn tone="amber" onClick={handlePay} disabled={paying}>
            <Icon name="spark" size={14} /> {paying ? "Перенаправление..." : "Оплатить 4 900 ₽/мес"}
          </ToneBtn>
          {err && <div className="text-[11px] text-coral">{err}</div>}
        </div>
      </div>
    </div>
  );
}

/** Заглушка: раздел заблокирован до завершения распаковки и/или анализа ниши. */
export function PrerequisiteNote({ title, go, isUnpackDone, isNicheAccepted }: { title: string; go: (id: string) => void; isUnpackDone: boolean; isNicheAccepted: boolean }) {
  return (
    <div className="panel relative overflow-hidden p-8">
      <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-sky/10 blur-3xl" />
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl border border-sky/30 bg-sky/10 text-sky">
          <Icon name="layers" size={28} />
        </span>
        <div>
          <div className="font-display text-xl font-extrabold text-ink">{title}</div>
          <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-mut">
            Для работы с этим разделом сначала завершите предыдущие шаги — данные понадобятся для генерации.
          </p>
        </div>

        <div className="w-full max-w-md space-y-2.5">
          <div className={`rounded-xl border px-4 py-3 ${isUnpackDone ? 'border-mint/20 bg-mint/5' : 'border-sky/25 bg-sky/5'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name={isUnpackDone ? 'check' : 'chat'} size={14} className={isUnpackDone ? 'text-mint' : 'text-sky'} />
                <span className="text-[12px] font-semibold text-ink">Распаковка эксперта</span>
              </div>
              {isUnpackDone ? (
                <Chip tone="mint">Готово</Chip>
              ) : (
                <ToneBtn tone="ghost" className="!px-2.5 !py-1 !text-[10px]" onClick={() => go("unpack")}>
                  Пройти →
                </ToneBtn>
              )}
            </div>
          </div>

          <div className={`rounded-xl border px-4 py-3 ${isNicheAccepted ? 'border-mint/20 bg-mint/5' : 'border-sky/25 bg-sky/5'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name={isNicheAccepted ? 'check' : 'target'} size={14} className={isNicheAccepted ? 'text-mint' : 'text-sky'} />
                <span className="text-[12px] font-semibold text-ink">Анализ ниши</span>
              </div>
              {isNicheAccepted ? (
                <Chip tone="mint">Готово</Chip>
              ) : (
                <ToneBtn tone="ghost" className="!px-2.5 !py-1 !text-[10px]" onClick={() => go("niche")}>
                  {isUnpackDone ? 'Анализ →' : 'Сначала распаковка'}
                </ToneBtn>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Заглушка для разделов с реальными данными, когда пользователь не вошёл. */
export function LockedNote({
  title = "Раздел с реальными данными",
  text = "Войдите в кабинет: показатели, воронка, реклама и платежи загружаются из PostgreSQL через защищённый API.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="panel relative overflow-hidden p-8">
      <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-amber/10 blur-3xl" />
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-amber/30 bg-amber/10 text-amber">
          <Icon name="lock" size={22} />
        </span>
        <div className="min-w-0">
          <div className="font-display text-[16px] font-extrabold text-ink">{title}</div>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-mut">{text}</p>
        </div>
        <Chip tone="amber" className="sm:ml-auto">JWT · bcrypt · 15 мин</Chip>
      </div>
    </div>
  );
}
