// App.jsx — Duolingo-style quiz with Hearts ❤️, Streak 🔥, Dark/Light auto
import { useEffect, useMemo, useState } from "react";
import defaultDeck from "./sap_basis_duo_questions.json"; // bundled dataset

// ======================
// UI COMPONENTS
// ======================
const Pill = ({ letter, text, active, correct, wrong, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={[
      "w-full text-left rounded-2xl border px-5 py-4 transition-all shadow-sm",
      "focus:outline-none focus:ring-2",
      disabled ? "opacity-60 cursor-not-allowed" : "hover:-translate-y-[1px]",
      active ? "border-emerald-500 ring-emerald-300 bg-white" : "border-gray-200 bg-white hover:border-gray-300",
      correct ? "!border-green-500" : "",
      wrong ? "!border-red-500" : "",
      "dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100",
    ].join(" ")}
    title="Click to select"
  >
    <div className="flex items-start">
      <span
        className={[
          "mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
          active ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-700",
          correct ? "!bg-green-500 !text-white" : "",
          wrong ? "!bg-red-500 !text-white" : "",
        ].join(" ")}
      >
        {letter}
      </span>
      <span className="text-gray-800 text-[15px] leading-6 dark:text-slate-100">{text}</span>
    </div>
  </button>
);

const Bubble = ({ children, sub }) => (
  <div className="w-full rounded-3xl border border-gray-200 bg-white px-6 py-7 shadow-sm animate-[pop_220ms_ease-out] dark:bg-slate-900 dark:border-slate-700">
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-full bg-emerald-500 shadow-inner" />
      <div>
        <p className="text-[18px] font-semibold text-gray-900 leading-6 dark:text-slate-100">{children}</p>
        {sub ? <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{sub}</p> : null}
      </div>
    </div>
  </div>
);

const Hearts = ({ lives, maxLives = 5 }) => (
  <div className="flex items-center gap-1">
    {[...Array(lives)].map((_, i) => (
      <span key={"full-" + i} className="text-red-500 text-xl">❤️</span>
    ))}
    {[...Array(Math.max(0, maxLives - lives))].map((_, i) => (
      <span key={"empty-" + i} className="text-gray-300 text-xl dark:text-slate-600">❤️</span>
    ))}
  </div>
);

const TopBar = ({ seen, correct, streak, lives, total, maxLives = 5 }) => {
  const acc = seen ? Math.round((correct / seen) * 100) : 0;
  const progress = total ? Math.round((seen / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="w-full flex items-center justify-between text-sm font-medium dark:text-slate-300">
        {/* 🔥 STREAK */}
        <div className="flex items-center gap-2 text-amber-500 font-semibold">
          <span className="text-xl">🔥</span>
          <span>{streak}</span>
        </div>

        {/* Accuracy / Seen / Correct */}
        <div className="flex items-center gap-4 text-gray-600 dark:text-slate-300">
          <div>Seen: {seen}</div>
          <div>✔️ {correct}</div>
          <div>{acc}%</div>
        </div>

        {/* ❤️ LIVES */}
        <Hearts lives={lives} maxLives={maxLives} />
      </div>

      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden dark:bg-slate-700">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

// ======================
//
// MAIN APP
//
// ======================
export default function App() {
  const MAX_LIVES = 5;

  const [deck, setDeck] = useState([]);
  const [i, setI] = useState(0);
  const [seen, setSeen] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [chosen, setChosen] = useState(new Set());
  const [phase, setPhase] = useState("answer"); // "answer" -> "review"
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);

  const cur = deck[i];
  const answers = cur?.answers || [];
  const isMulti = answers.length > 1;
  const maxSelectable = answers.length || 1;

  // Detect color scheme to decide button text color
  const isDark = useMemo(() => window.matchMedia("(prefers-color-scheme: dark)").matches, []);

  useEffect(() => {
    // Load initial deck from bundled JSON
    const initial = Array.isArray(defaultDeck) ? [...defaultDeck] : [];
    shuffle(initial);
    setDeck(initial);
  }, []);

  function shuffle(arr) {
    for (let j = arr.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [arr[j], arr[k]] = [arr[k], arr[j]];
    }
  }

  // Single-click selection with multi-limit
  function toggleChoice(letter) {
    if (!cur || phase !== "answer") return;
    const next = new Set(chosen);

    if (next.has(letter)) {
      next.delete(letter);
    } else if (!isMulti) {
      next.clear();
      next.add(letter);
    } else if (next.size < maxSelectable) {
      next.add(letter);
    }
    setChosen(next);
  }

  function submit() {
    if (!cur || chosen.size === 0) return;
    const ok = eqSets(chosen, new Set(answers)) || answers.length === 0;

    setSeen((v) => v + 1);

    if (ok) {
      setCorrect((v) => v + 1);
      setStreak((v) => v + 1);
    } else {
      setStreak(0);
      setLives((v) => {
        const newLives = Math.max(0, v - 1);
        if (newLives === 0) {
          // Out of hearts — restart deck/session
          setTimeout(() => {
            alert("💔 You ran out of hearts! Restarting...");
            restartSession();
          }, 10);
        }
        return newLives;
      });
    }

    setPhase("review");
  }

  function next() {
    if (!cur) return;

    // If no lives, do nothing (restartSession() handles it)
    if (lives === 0) return;

    let nextIndex = i + 1;
    if (nextIndex >= deck.length) {
      alert(`Finished! Accuracy: ${Math.round((correct / Math.max(1, seen)) * 100)}%`);
      return;
    }
    setI(nextIndex);
    setChosen(new Set());
    setPhase("answer");
  }

  function restartSession() {
    // Re-shuffle and reset counters
    const fresh = Array.isArray(defaultDeck) ? [...defaultDeck] : [];
    shuffle(fresh);
    setDeck(fresh);
    setI(0);
    setSeen(0);
    setCorrect(0);
    setChosen(new Set());
    setPhase("answer");
    setStreak(0);
    setLives(MAX_LIVES);
  }

  // Keyboard shortcuts (1–6 to toggle)
  useEffect(() => {
    const onKey = (e) => {
      const digits = ["1", "2", "3", "4", "5", "6"];
      if (digits.includes(e.key)) {
        const idx = Number(e.key) - 1;
        if (cur && deck[i] && deck[i].choices[idx]) toggleChoice(deck[i].choices[idx][0]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur, chosen, phase, deck, i]);

  const subHint = cur ? (isMulti ? `Multiple answers: select ${maxSelectable}.` : `Single answer.`) : undefined;
  const selectedCount = chosen.size;
  const atLimit = phase === "answer" && isMulti && selectedCount >= maxSelectable;

  return (
    <div className="min-h-screen bg-[#f7f7fb] text-gray-800 dark:bg-slate-950 dark:text-slate-100">
      <style>{`
        @keyframes pop { from{ transform: scale(.98); opacity: .9; } to{ transform: scale(1); opacity: 1; } }
      `}</style>

      <div className="mx-auto w-full max-w-3xl px-5 py-6">
        <TopBar
          seen={seen}
          correct={correct}
          streak={streak}
          lives={lives}
          total={deck.length}
          maxLives={MAX_LIVES}
        />

        <div className="mt-5 mb-3">
          {cur ? <Bubble sub={subHint}>{cur.q}</Bubble> : <Bubble>Deck loaded. Click an option to start.</Bubble>}
        </div>

        {cur && isMulti && (
          <div className="mb-4 text-sm text-gray-600 dark:text-slate-300">
            Selected: <span className="font-semibold">{selectedCount}</span> / {maxSelectable}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {cur &&
            cur.choices.map(([L, text], idx) => {
              const active = chosen.has(L);
              const isRight = phase === "review" && answers.includes(L);
              const isWrong = phase === "review" && active && !isRight;
              const disableThis = phase === "answer" && isMulti && !active && atLimit;

              return (
                <Pill
                  key={idx}
                  letter={L}
                  text={text}
                  active={active}
                  correct={isRight}
                  wrong={isWrong}
                  disabled={disableThis}
                  onClick={() => toggleChoice(L)}
                />
              );
            })}
        </div>

        <div className="mt-8 flex items-center justify-center gap-3">
          {cur && phase === "answer" && (
            <button
              className={`rounded-2xl px-8 py-3 font-bold transition-all border shadow-sm ${
                chosen.size > 0 ? "bg-emerald-400 hover:bg-emerald-300" : "bg-gray-200 cursor-not-allowed"
              } ${isDark ? "text-white" : "text-black"}`}
              disabled={chosen.size === 0}
              onClick={submit}
            >
              SEND
            </button>
          )}
          {cur && phase === "review" && (
            <button
              className={`rounded-2xl px-8 py-3 font-bold transition-all border shadow-sm bg-emerald-400 hover:bg-emerald-300 ${
                isDark ? "text-white" : "text-black"
              }`}
              onClick={next}
            >
              NEXT
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// ======================
// HELPERS
// ======================
function eqSets(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
