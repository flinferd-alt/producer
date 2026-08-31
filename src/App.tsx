import { useCallback, useEffect, useRef, useState } from "react";
import { LAUNCHES, NAV, TICKER, type Tone } from "./data";
import { Chip, Dot, Icon, LockedNote, PaywallNote, ToneBtn, useScramble } from "./ui";
import { DataProvider, useAuth, useStore } from "./store";
import Dashboard from "./sections/Dashboard";
import Unpack from "./sections/Unpack";
import Niche from "./sections/Niche";
import { LeadMagnetSection, ProductSection, TripwireSection } from "./sections/ProductStack";
import Funnel from "./sections/Funnel";
import { AdsSection, PaymentsSection } from "./sections/Growth";
import { AgentsSection, StatsSection } from "./sections/Insights";
import Cabinet from "./sections/Cabinet";
import Master from "./sections/Master";
import Concept from "./sections/Concept";
import Welcome from "./sections/Welcome";

interface Toast {
  id: number;
  text: string;
  tone: Tone;
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-10 w-10 place-items-center rounded-xl border border-amber/30 bg-amber/10">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3.5 4.5h17l-6.3 7.4v5.6l-4.4-2.2v-3.4Z" fill="#ffb224" />
          <path d="M18.5 3v3M17 4.5h3" stroke="#3ddc97" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-mint pulse-dot text-mint" />
      </div>
      <div>
        <div className="font-display text-[15px] font-extrabold tracking-tight leading-none text-ink">
          ПРОДЮСЕР<span className="text-amber">.AI</span>
        </div>
        <div className="mt-1 font-mono text-[10px] tracking-[0.18em] text-dim uppercase">YandexGPT · Beget DB</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppInner />
    </DataProvider>
  );
}

function AppInner() {
  const { session, live, isOwner, subscription, refreshProfile } = useAuth();
  const { launches, activeLaunchId, setActiveLaunchId } = useStore();

  /* Разделы, заблокированные для free-пользователей (paywall) */
  const [section, setSection] = useState("welcome");

  const PAYWALL_SECTIONS = ["product", "leadmagnet", "tripwire", "funnel"];
  const isPaywallHit = live && subscription === "free" && PAYWALL_SECTIONS.includes(section);
  // Агенты: просмотр свободный, управление — Pro (передаём флаг в секцию)

  const isAgentsLocked = live && subscription === "free";
  const [menuOpen, setMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [launchIdx, setLaunchIdx] = useState(0); // Для демо-режима
  const [launchOpen, setLaunchOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const toastId = useRef(0);

  useEffect(() => {
    if (!isOwner && section === "master") setSection("dashboard");
    if (live && section === "welcome") setSection("dashboard");
  }, [isOwner, live, section]);

  // Обработка ?paid=1 — после оплаты YooKassa редиректит сюда
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") {
      params.delete("paid");
      const clean = params.toString();
      const next = clean ? `${window.location.pathname}?${clean}` : window.location.pathname;
      window.history.replaceState({}, "", next);
      refreshProfile().then(() => {
        push("Подписка активирована — тариф «Про» подключён", "mint");
      }).catch(() => {
        push("Подписка активирована (обновите страницу, если изменения не видны)", "mint");
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const push = useCallback((text: string, tone: Tone = "mint") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);



  const go = useCallback((id: string) => {
    if (live && subscription === "free" && PAYWALL_SECTIONS.includes(id)) {
      push("Раздел доступен на тарифе «Про»", "amber");
    }



    setSection(id);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });

  }, [live, subscription, push]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setLaunchOpen(false);
    };
    document.addEventListener("click", fn);
    return () => document.removeEventListener("click", fn);
  }, []);

  const current = NAV.find((n) => n.id === section) ?? NAV[0];
  const title = useScramble(current.label.toUpperCase());
  const groups = Array.from(new Set(NAV.map((n) => n.group)));

  // Форматируем список запусков (Реальные из БД или Демо)
  const uiLaunches = live
    ? launches.map((l) => {
        const s = (l.status || "").toLowerCase();
        const tone: Tone = s.includes("заверш") ? "mut" : s.includes("актив") || s.includes("active") ? "mint" : s.includes("пауз") ? "coral" : "amber";
        return { id: l.id, name: l.name, stage: l.stage || "распаковка", status: l.status || "активен", tone };
      })
    : LAUNCHES.map((l, i) => ({ id: i, ...l }));

  const launch = live
    ? uiLaunches.find((l) => l.id === activeLaunchId) || uiLaunches[0] || { id: -1, name: "Нет запусков", stage: "—", status: "создайте запуск", tone: "mut" as Tone }
    : uiLaunches[launchIdx];

  const isWelcome = section === "welcome";

  // Лендинг — полноэкранный, без сайдбара
  if (isWelcome) {
    return (
      <div className="relative min-h-screen text-ink">
        <div className="ambient-grid pointer-events-none fixed inset-0 z-0" />
        <div className="ambient-glow pointer-events-none fixed inset-0 z-0" />
        <div className="noise pointer-events-none fixed inset-0 z-[1]" />
        <Welcome onTry={() => {
          if (live) {
            setSection("dashboard");
          } else {
            setSection("cabinet");
          }
        }} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-ink">
      <div className="ambient-grid pointer-events-none fixed inset-0 z-0" />
      <div className="ambient-glow pointer-events-none fixed inset-0 z-0" />
      <div className="noise pointer-events-none fixed inset-0 z-[1]" />

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col border-r border-line bg-deep2/90 backdrop-blur-xl transition-transform duration-500 lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="border-b border-line px-5 py-5"><Logo /></div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((g) => {
            const items = NAV.filter((n) => n.group === g && (n.id !== "master" || isOwner));
            if (items.length === 0) return null;
            return (
              <div key={g} className="mb-5">
                <div className="mb-1.5 px-2.5 font-mono text-[10px] tracking-[0.24em] text-dim uppercase">
                  {g === "Система" && isOwner ? "Система · владелец" : g}
                </div>
                {items.map((n) => {
                  const active = n.id === section;
                  return (
                    <button
                      key={n.id}
                      onClick={() => go(n.id)}
                      className={`group mb-0.5 flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium transition-all duration-300 ${
                        active ? "bg-amber/10 text-amber shadow-[inset_0_0_0_1px_rgba(255,178,36,0.25)]" : "text-mut hover:bg-panel2 hover:text-ink"
                      }`}
                    >
                      <Icon name={n.icon} size={17} className={active ? "text-amber" : "text-dim group-hover:text-sky transition-colors"} />
                      {n.label}
                      {n.id === "cabinet" && !live && <span className={`grid place-items-center ${active ? "" : "ml-auto"}`} title="Требуется вход"><Icon name="lock" size={11} className="text-amber/60" /></span>}
                      {n.id === "master" && <span className={`grid place-items-center ${active ? "" : "ml-auto"}`} title="Только владелец"><Icon name="crown" size={11} className="text-mint/70" /></span>}
                      {live && subscription === "free" && PAYWALL_SECTIONS.includes(n.id) && <span className={`grid place-items-center ${active ? "" : "ml-auto"}`} title="Тариф «Про» — разблокирует раздел"><Icon name="crown" size={11} className="text-amber/70" /></span>}
                      {active && <span className={`${n.id === "cabinet" || n.id === "master" ? "" : "ml-auto"} h-1.5 w-1.5 rounded-full bg-amber`} />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Dot tone="mint" pulse />
            <div>
              <div className="font-mono text-[11px] text-ink">YandexGPT · онлайн</div>
              <div className="font-mono text-[10px] text-dim">ru-central1 · v1.4.2</div>
            </div>
          </div>
        </div>
      </aside>

      {menuOpen && <div className="fixed inset-0 z-30 bg-deep/70 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)} />}

      <div className="relative z-[2] lg:pl-[252px]">
        <header className="sticky top-0 z-20 border-b border-line bg-deep/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
            <button onClick={() => setMenuOpen(true)} className="cursor-pointer rounded-lg border border-line p-2 text-mut hover:text-ink lg:hidden" aria-label="Меню">
              <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"><path d="M4 7h16M4 12h10M4 17h16" /></svg>
            </button>
            <div className="min-w-0">
              <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">
                {current.group} / <span className="text-amber">{launch.status}</span>
              </div>
              <h1 className="font-display text-lg font-extrabold tracking-tight sm:text-xl whitespace-nowrap overflow-hidden text-ellipsis max-w-[46vw] lg:max-w-none">
                {title}<span className="caret text-amber">_</span>
              </h1>
            </div>

            <div className="ml-auto flex items-center gap-3">
              {isOwner ? (
                <button onClick={() => go("master")} className="hidden cursor-pointer items-center gap-1.5 rounded-md border border-mint/35 bg-mint/10 px-2.5 py-1 font-mono text-[11px] leading-5 tracking-wide text-mint transition-all hover:bg-mint/20 sm:inline-flex" title="Мастер-панель владельца">
                  <Icon name="crown" size={12} /> ВЛАДЕЛЕЦ · LIVE
                </button>
              ) : live ? (
                <Chip tone="mint" className="hidden sm:inline-flex"><Dot tone="mint" pulse /> LIVE · реальные данные</Chip>
              ) : (
                <button onClick={() => go("cabinet")} className="hidden cursor-pointer items-center gap-1.5 rounded-md border border-amber/35 bg-amber/10 px-2.5 py-1 font-mono text-[11px] leading-5 tracking-wide text-amber transition-all hover:bg-amber/20 sm:inline-flex" title="Войти, чтобы видеть реальные данные">
                  <Icon name="eye" size={12} /> ДЕМО-ДАННЫЕ
                </button>
              )}
              <Chip tone="amber" className="hidden md:inline-flex">Бюджет: 150 000 ₽</Chip>

              {/* Селектор запусков */}
              <div className="relative" ref={dropRef}>
                <button onClick={() => setLaunchOpen((v) => !v)} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-panel px-3 py-2 transition-colors hover:border-line2">
                  <Dot tone={launch.tone} />
                  <span className="hidden max-w-[180px] truncate text-[12.5px] font-semibold sm:block">{launch.name}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-dim transition-transform duration-300 ${launchOpen ? "rotate-180" : ""}`}>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {launchOpen && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-panel shadow-2xl shadow-black/50">
                    {uiLaunches.map((l, i) => (
                      <button
                        key={l.id}
                        onClick={() => {
                          if (live) setActiveLaunchId(l.id as number);
                          else setLaunchIdx(i);
                          setLaunchOpen(false);
                          push(`Переключились на запуск «${l.name}»`, "sky");
                        }}
                        className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-panel2 ${activeLaunchId === l.id && live ? "bg-panel2" : ""}`}
                      >
                        <Dot tone={l.tone} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold">{l.name}</span>
                          <span className="block font-mono text-[10.5px] text-dim">{l.stage}</span>
                        </span>
                      </button>
                    ))}
                    {isOwner && (
                       <div className="border-t border-line px-4 py-2.5">
                         <button onClick={() => { setLaunchOpen(false); go("cabinet"); }} className="flex w-full cursor-pointer items-center gap-2 font-mono text-[11px] tracking-wide text-amber uppercase hover:brightness-125">
                           <Icon name="spark" size={14} /> Создать новый запуск
                         </button>
                       </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => go("cabinet")}
                title={live ? session.name : "Войти в кабинет"}
                className={`grid h-9 w-9 cursor-pointer place-items-center rounded-full border font-display text-[12px] font-bold transition-all hover:scale-105 ${isOwner ? "border-mint/40 bg-mint/15 text-mint" : live ? "border-sky/40 bg-sky/15 text-sky" : "border-line2 bg-panel2 text-dim"}`}
              >
                {isOwner ? "FL" : live ? "АМ" : <Icon name="user" size={15} />}
              </button>
            </div>
          </div>

          {!live && (
            <div className="flex items-center justify-center gap-2.5 border-b border-amber/30 bg-amber/10 px-4 py-2">
              <Icon name="eye" size={16} className="text-amber" />
              <span className="font-display text-sm font-bold tracking-wide text-amber">ДЕМО-РЕЖИМ</span>
              <span className="text-[12px] text-amber/80">— данные не сохраняются, войдите для работы с реальными запусками</span>
              <button onClick={() => go("cabinet")} className="ml-2 cursor-pointer rounded-md border border-amber/40 bg-amber/15 px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wide text-amber transition-all hover:bg-amber/25">ВОЙТИ →</button>
            </div>
          )}

          <div className="ticker relative overflow-hidden border-t border-line/60 bg-deep2/60">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-deep to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-deep to-transparent" />
            <div className="ticker-track flex w-max items-center gap-8 py-1.5 pl-8">
              {[...TICKER, ...TICKER].map((t, i) => (
                <span key={i} className="flex items-center gap-2.5 font-mono text-[11px] whitespace-nowrap text-mut">
                  <span className={i % 3 === 0 ? "text-amber" : i % 3 === 1 ? "text-mint" : "text-sky"}>▸</span>{t}
                </span>
              ))}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          <div hidden={section !== "dashboard"}><Dashboard go={go} push={push} /></div>
          <div hidden={section !== "unpack"}><Unpack go={go} push={push} /></div>
          <div hidden={section !== "niche"}><Niche push={push} /></div>
          {isPaywallHit ? (
            <PaywallNote title={current.label} go={go} />
          ) : (
            <>
              <div hidden={section !== "product"}><ProductSection push={push} /></div>
              <div hidden={section !== "leadmagnet"}><LeadMagnetSection push={push} /></div>
              <div hidden={section !== "tripwire"}><TripwireSection push={push} /></div>
              <div hidden={section !== "funnel"}><Funnel push={push} /></div>
              <div hidden={section !== "ads"}><AdsSection push={push} /></div>
              <div hidden={section !== "payments"}><PaymentsSection push={push} /></div>
              <div hidden={section !== "stats"}><StatsSection /></div>
            </>
          )}
          <div hidden={section !== "agents"}><AgentsSection push={push} locked={isAgentsLocked} /></div>
          <div hidden={section !== "concept"}><Concept push={push} /></div>
          <div hidden={section !== "cabinet"}><Cabinet push={push} go={go} /></div>
          <div hidden={section !== "master"}><Master push={push} /></div>
        </main>

        <footer className="border-t border-line/70 bg-deep2/50">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 font-mono text-[10.5px] tracking-wide text-dim sm:px-6 lg:px-8">
            <span className="flex items-center gap-2"><Dot tone="mint" pulse /> Beget VDS · PostgreSQL 16 · онлайн</span>
            <span className="flex items-center gap-2"><Dot tone="amber" /> YandexGPT-5 · ru-central1 · 42 ток/с</span>
            <span className="flex items-center gap-2"><Dot tone="sky" /> PostgreSQL · записано 128 400 событий</span>
            <span className="ml-auto flex items-center gap-2"><Dot tone="mint" /> 0 ошибок · аптайм 99,98%</span>
          </div>
        </footer>
      </div>

      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(92vw,380px)] flex-col gap-2.5">
        {toasts.map((t) => {
          const border: Record<Tone, string> = { amber: "border-amber/40", mint: "border-mint/40", coral: "border-coral/40", sky: "border-sky/40", mut: "border-line2" };
          const dot: Record<Tone, Tone> = { amber: "amber", mint: "mint", coral: "coral", sky: "sky", mut: "mut" };
          return (
            <div key={t.id} className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${border[t.tone]} bg-panel/95 px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur-xl`}>
              <span className="mt-1"><Dot tone={dot[t.tone]} pulse /></span>
              <p className="text-[13px] leading-snug text-ink">{t.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { ToneBtn };