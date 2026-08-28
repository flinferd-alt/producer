import { useEffect, useRef, useState } from "react";
import { QUESTIONS, type Tone } from "../data";
import { Chip, Icon, Panel, Reveal, ToneBtn, useReducedMotion } from "../ui";
import { useStore, useAuth } from "../store";
import { api, apiFetch, ApiError } from "../api";

interface Msg {
  from: "ai" | "me";
  text: string;
}

export default function Unpack({ go, push }: { go: (id: string) => void; push: (t: string, tone?: Tone) => void }) {
  const { activeLaunchId } = useStore();
  const { live } = useAuth();
  const reduced = useReducedMotion();

  // Режимы: loading (загрузка), summary (уже есть бриф), chat (прохождение)
  const [mode, setMode] = useState<"loading" | "summary" | "chat" | "idle">("idle");
  const [summaryText, setSummaryText] = useState<string | null>(null);

  // Состояние чата
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [done, setDone] = useState(false);
  const [generating, setGenerating] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const wait = (ms: number) => new Promise((r) => setTimeout(r, reduced ? 30 : ms));

  // 1. Загрузка данных при смене запуска
  useEffect(() => {
    if (!live || !activeLaunchId) {
      setMode("chat");
      startChat();
      return;
    }

    let mounted = true;
    setMode("loading");
    started.current = false;

    // Сбрасываем стейт
    setMsgs([]); setAnswers({}); setQIdx(0); setDone(false); setSummaryText(null);

    // Запрашиваем бриф с сервера
    apiFetch<{ summary: string | null; answers: { key: string; value: string }[] }>(`/launches/${activeLaunchId}/brief`)
      .then((res) => {
        if (!mounted) return;
        setSummaryText(res.summary || "Нейросеть не смогла сгенерировать summary.");
        const ansMap: Record<string, string> = {};
        if (res.answers) {
          res.answers.forEach((a) => { ansMap[a.key] = a.value; });
        }
        setAnswers(ansMap);
        setMode("summary");
      })
      .catch((e) => {
        if (!mounted) return;
        // 404 означает, что бриф еще не заполнялся
        if (e instanceof ApiError && e.status === 404) {
          setMode("chat");
          startChat();
        } else {
          push("Ошибка при загрузке брифа", "coral");
          setMode("chat");
        }
      });

    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLaunchId, live]);

  // Скролл чата вниз
  useEffect(() => {
    if (boxRef.current && mode === "chat") {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [msgs, typing, mode]);

  const startChat = async () => {
    if (started.current) return;
    started.current = true;
    setMode("chat");
    setMsgs([]);
    setAnswers({});
    setQIdx(0);
    setDone(false);
    setTyping(true);
    await wait(700);
    setTyping(false);
    setMsgs([{ from: "ai", text: QUESTIONS[0].q }]);
  };

  const answer = async (text: string) => {
    const t = text.trim();
    if (!t || typing || done) return;

    setMsgs((m) => [...m, { from: "me", text: t }]);
    setInput("");

    const newAnswers = { ...answers, [QUESTIONS[qIdx].key]: t };
    setAnswers(newAnswers);

    const next = qIdx + 1;
    setTyping(true);
    await wait(800 + Math.random() * 400);

    if (next < QUESTIONS.length) {
      setQIdx(next);
      setMsgs((m) => [...m, { from: "ai", text: QUESTIONS[next].q }]);
      setTyping(false);
    } else {
      // Все вопросы заданы -> Отправляем на сервер!
      setGenerating(true);

      try {
        if (live && activeLaunchId) {
          // Форматируем для API
          const payload = QUESTIONS.map(q => ({
            key: q.key,
            label: q.label,
            value: newAnswers[q.key] || ""
          }));

          const res = await api.saveBrief(activeLaunchId, payload);

          setMsgs((m) => [
            ...m,
            { from: "ai", text: "Распаковка завершена! Данные сохранены в базу." },
            { from: "ai", text: `🤖 Сводка от YandexGPT:\n\n${res.summary || "Сводка недоступна."}` }
          ]);
          setSummaryText(res.summary);
          push("Бриф успешно сохранён в PostgreSQL", "mint");
          if (res.yc !== "skipped") push("YandexGPT сгенерировал summary", "sky");

        } else {
          // Демо-режим
          await wait(1400);
          setMsgs((m) => [
            ...m,
            { from: "ai", text: "Распаковка завершена (Демо-режим). Передаю данные агенту-аналитику." }
          ]);
        }
      } catch (e) {
        setMsgs((m) => [...m, { from: "ai", text: "Произошла ошибка при сохранении брифа на сервер." }]);
      } finally {
        setGenerating(false);
        setTyping(false);
        setDone(true);
      }
    }
  };

  const q = QUESTIONS[Math.min(qIdx, QUESTIONS.length - 1)];
  const progress = Math.round((Object.keys(answers).length / QUESTIONS.length) * 100);

  if (!activeLaunchId && live) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line py-24 text-center">
        <Icon name="spark" size={32} className="mb-4 text-dim" />
        <div className="font-display text-lg font-bold text-ink">Запуск не выбран</div>
        <p className="mt-2 text-[13px] text-mut">Выберите запуск в верхнем меню или создайте новый в кабинете.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      {/* Левая колонка: Чат или Результат */}
      <Reveal className="xl:col-span-3">
        {mode === "loading" ? (
          <Panel className="flex h-[72vh] min-h-[520px] flex-col items-center justify-center">
             <span className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.18em] text-dim uppercase">
                <span className="typing-dot h-2 w-2 rounded-full bg-amber" />
                <span className="typing-dot h-2 w-2 rounded-full bg-amber" />
                <span className="typing-dot h-2 w-2 rounded-full bg-amber" />
                загрузка данных
              </span>
          </Panel>
        ) : mode === "summary" ? (
          <Panel className="flex h-[72vh] min-h-[520px] flex-col overflow-hidden p-6">
            <div className="mb-6 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-mint/12 text-mint"><Icon name="check" size={20} /></span>
              <div>
                <div className="font-display text-lg font-bold">Распаковка пройдена</div>
                <div className="font-mono text-[10.5px] text-dim">YandexGPT-5 · summary</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              <div className="rounded-xl border border-amber/30 bg-amber/[0.04] p-5 shadow-[inset_0_0_0_1px_rgba(255,178,36,0.1)]">
                <div className="mb-3 flex items-center gap-2 font-mono text-[10px] tracking-widest text-amber uppercase">
                  <Icon name="spark" size={12} /> Выводы нейросети
                </div>
                <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink/90">
                  {summaryText}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-5">
              <ToneBtn onClick={() => { push("Бриф передан агенту-аналитику ниши", "mint"); go("niche"); }}>
                Перейти к анализу ниши <Icon name="arrow" size={14} />
              </ToneBtn>
              <ToneBtn tone="ghost" onClick={() => {
                started.current = false;
                startChat();
              }}>
                <Icon name="refresh" size={14} /> Пройти заново
              </ToneBtn>
            </div>
          </Panel>
        ) : (
          <Panel className="flex h-[72vh] min-h-[520px] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber/12 text-amber"><Icon name="bot" size={18} /></span>
                <div>
                  <div className="text-[13.5px] font-bold">ИИ-продюсер · распаковка</div>
                  <div className="font-mono text-[10.5px] text-dim">YandexGPT-5 · сбор контекста</div>
                </div>
              </div>
              <Chip tone={done ? "mint" : "amber"}>{done ? "бриф готов" : `вопрос ${Math.min(qIdx + 1, 10)} / 10`}</Chip>
            </div>

            <div ref={boxRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-3 text-[13.5px] leading-relaxed ${
                      m.from === "me" ? "rounded-br-sm bg-amber/15 text-ink shadow-[inset_0_0_0_1px_rgba(255,178,36,0.25)]" : "rounded-bl-sm border border-line bg-panel2/60 text-ink/95"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {(typing || generating) && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-xl rounded-bl-sm border border-line bg-panel2/60 px-4 py-3.5">
                    {generating ? (
                      <span className="font-mono text-[11px] tracking-wider text-amber uppercase">анализируем ответы<span className="caret">…</span></span>
                    ) : (
                      <>
                        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-mut" />
                        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-mut" />
                        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-mut" />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {!done ? (
              <div className="border-t border-line px-5 py-4">
                {q.options && !typing && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {q.options.map((o) => (
                      <button key={o} onClick={() => answer(o)} className="cursor-pointer rounded-lg border border-line2 bg-panel2/70 px-3 py-1.5 text-[12px] text-ink/90 transition-all duration-200 hover:border-amber/50 hover:bg-amber/10 hover:text-amber active:scale-95">
                        {o}
                      </button>
                    ))}
                  </div>
                )}
                <form
                  className="flex gap-2.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    answer(input);
                  }}
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={typing || generating}
                    placeholder={q.placeholder ?? "Ваш ответ…"}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-deep/70 px-4 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-dim focus:border-amber/50"
                  />
                  <button type="submit" disabled={typing || generating || !input.trim()} className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-lg bg-amber text-deep transition-all hover:brightness-110 active:scale-95 disabled:opacity-40">
                    <Icon name="arrow" size={17} />
                  </button>
                </form>
                <div className="mt-2.5 font-mono text-[10px] tracking-wider text-dim uppercase">Отвечайте подробно — это повлияет на качество всего запуска</div>
              </div>
            ) : (
              <div className="border-t border-line px-5 py-4">
                <div className="flex flex-wrap gap-2.5">
                  <ToneBtn onClick={() => { push("Бриф передан агенту-аналитику ниши", "mint"); go("niche"); }}>
                    Передать в анализ ниши <Icon name="arrow" size={14} />
                  </ToneBtn>
                  <ToneBtn tone="ghost" onClick={() => {
                    started.current = false;
                    startChat();
                  }}>
                    Пройти заново
                  </ToneBtn>
                </div>
              </div>
            )}
          </Panel>
        )}
      </Reveal>

      {/* Правая колонка: Live brief */}
      <Reveal delay={120} className="xl:col-span-2">
        <Panel className="h-full p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">БД · {activeLaunchId ? `Запуск #${activeLaunchId}` : "Демо"}</div>
              <div className="font-display text-lg font-bold">Бриф запуска</div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-extrabold text-amber">{progress}%</div>
            </div>
          </div>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-line/70">
            <div className="h-full rounded-full bg-gradient-to-r from-amber to-mint transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <ul className="space-y-2.5">
            {QUESTIONS.map((qq) => {
              const val = answers[qq.key];
              return (
                <li key={qq.key} className={`rounded-lg border px-3.5 py-2.5 transition-all duration-500 ${val ? "border-mint/25 bg-mint/[0.04]" : "border-line/70 opacity-45"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] tracking-[0.14em] text-dim uppercase">{qq.label}</span>
                    {val ? <Icon name="check" size={13} className="text-mint" /> : <span className="font-mono text-[10px] text-dim">ожидание</span>}
                  </div>
                  {val && <div className="mt-1 text-[12.5px] leading-snug text-ink/90">{val}</div>}
                </li>
              );
            })}
          </ul>
        </Panel>
      </Reveal>
    </div>
  );
}