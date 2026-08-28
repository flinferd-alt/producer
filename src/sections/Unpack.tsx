import { useEffect, useRef, useState } from "react";
import { QUESTIONS, type Tone } from "../data";
import { Chip, Icon, Panel, Reveal, ToneBtn, useReducedMotion } from "../ui";

interface Msg {
  from: "ai" | "me";
  text: string;
}

export default function Unpack({ go, push }: { go: (id: string) => void; push: (t: string, tone?: Tone) => void }) {
  const reduced = useReducedMotion();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(true);
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [done, setDone] = useState(false);
  const [generating, setGenerating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const wait = (ms: number) => new Promise((r) => setTimeout(r, reduced ? 30 : ms));

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      await wait(700);
      setTyping(false);
      setMsgs([{ from: "ai", text: QUESTIONS[0].q }]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [msgs, typing]);

  const answer = async (text: string) => {
    const t = text.trim();
    if (!t || typing || done) return;
    setMsgs((m) => [...m, { from: "me", text: t }]);
    setInput("");
    setAnswers((a) => ({ ...a, [QUESTIONS[qIdx].key]: t }));
    const next = qIdx + 1;
    setTyping(true);
    await wait(900 + Math.random() * 500);
    if (next < QUESTIONS.length) {
      setQIdx(next);
      setMsgs((m) => [...m, { from: "ai", text: QUESTIONS[next].q }]);
      setTyping(false);
    } else {
      setGenerating(true);
      await wait(1400);
      setGenerating(false);
      setTyping(false);
      setDone(true);
      setMsgs((m) => [
        ...m,
        { from: "ai", text: "Распаковка завершена. Я собрал бриф из 10 ответов, соотнёс его с анализом ниши и заложил в юнит-экономику. Передаю данные агенту-аналитику — проверьте бриф справа." },
      ]);
      push("Бриф сформирован и сохранён в PostgreSQL запуска", "mint");
    }
  };

  const q = QUESTIONS[Math.min(qIdx, QUESTIONS.length - 1)];
  const progress = Math.round((Object.keys(answers).length / QUESTIONS.length) * 100);

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      {/* chat */}
      <Reveal className="xl:col-span-3">
        <Panel className="flex h-[72vh] min-h-[520px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber/12 text-amber"><Icon name="bot" size={18} /></span>
              <div>
                <div className="text-[13.5px] font-bold">ИИ-продюсер · распаковка</div>
                <div className="font-mono text-[10.5px] text-dim">YandexGPT-5 · контекст запуска в памяти</div>
              </div>
            </div>
            <Chip tone={done ? "mint" : "amber"}>{done ? "бриф готов" : `вопрос ${Math.min(qIdx + 1, 10)} / 10`}</Chip>
          </div>

          <div ref={boxRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-[13.5px] leading-relaxed ${
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
                    <span className="font-mono text-[11px] tracking-wider text-amber uppercase">генерирую бриф<span className="caret">…</span></span>
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
                  disabled={typing}
                  placeholder={q.placeholder ?? "Ваш ответ…"}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-deep/70 px-4 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-dim focus:border-amber/50"
                />
                <button type="submit" disabled={typing || !input.trim()} className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-lg bg-amber text-deep transition-all hover:brightness-110 active:scale-95 disabled:opacity-40">
                  <Icon name="arrow" size={17} />
                </button>
              </form>
              <div className="mt-2.5 font-mono text-[10px] tracking-wider text-dim uppercase">Клиент отвечает только на вопросы — всё остальное делает сервис</div>
            </div>
          ) : (
            <div className="border-t border-line px-5 py-4">
              <div className="flex flex-wrap gap-2.5">
                <ToneBtn onClick={() => { push("Бриф передан агенту-аналитику ниши", "mint"); go("niche"); }}>
                  Передать в анализ ниши <Icon name="arrow" size={14} />
                </ToneBtn>
                <ToneBtn tone="ghost" onClick={() => push("Бриф выгружен в PDF и отправлен в Telegram", "sky")}>
                  <Icon name="doc" size={14} /> Скачать бриф
                </ToneBtn>
                <ToneBtn tone="ghost" onClick={() => { started.current = true; setMsgs([]); setAnswers({}); setQIdx(0); setDone(false); setTyping(true); setTimeout(async () => { setTyping(false); setMsgs([{ from: "ai", text: QUESTIONS[0].q }]); }, reduced ? 30 : 600); }}>
                  Пройти заново
                </ToneBtn>
              </div>
            </div>
          )}
        </Panel>
      </Reveal>

      {/* live brief */}
      <Reveal delay={120} className="xl:col-span-2">
        <Panel className="h-full p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">Собирается на лету</div>
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
          <div className="mt-4 rounded-lg border border-line bg-deep/60 p-3.5 font-mono text-[11px] leading-relaxed text-mut">
            <span className="text-amber">хранение:</span> Beget PostgreSQL · таблица briefs
            <br />
            <span className="text-amber">версии:</span> каждый запуск сохраняет свой бриф — ИИ сравнивает гипотезы от запуска к запуску
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
