// App.jsx — Duolingo-style quiz (3 lives, global leaderboards, 25-question rounds)
import { useEffect, useRef, useState } from "react";
import defaultDeck from "./sap_basis_duo_questions.json";

// 🔗 Supabase helpers
import {
  getLeaderboardByPoints,
  getLeaderboardByStreak,
  updateRecordIfBetter,
} from "./db";

/* ================= Users & Storage ================= */
const USERS = ["Cris", "Jose", "Adrian", "Sebas", "Enrique", "Isaac"];
const USERS_KEY = "sap_basis_duo_users_v2";

function loadAllUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const base = raw ? JSON.parse(raw) : {};
    for (const name of USERS) {
      if (!base[name]) {
        base[name] = {
          points: 0,
          bestPoints: 0,
          seen: 0,
          correct: 0,
          streak: 0,
          bestStreak: 0,
          hearts: 3,
        };
      } else {
        base[name].bestPoints ??= 0;
        base[name].hearts ??= 3;
      }
    }
    return base;
  } catch {
    const init = {};
    for (const name of USERS) {
      init[name] = {
        points: 0,
        bestPoints: 0,
        seen: 0,
        correct: 0,
        streak: 0,
        bestStreak: 0,
        hearts: 3,
      };
    }
    return init;
  }
}
function saveAllUsers(obj) {
  localStorage.setItem(USERS_KEY, JSON.stringify(obj));
}
function getUserStats(all, name) {
  return (
    all[name] || {
      points: 0,
      bestPoints: 0,
      seen: 0,
      correct: 0,
      streak: 0,
      bestStreak: 0,
      hearts: 3,
    }
  );
}
function setUserStats(all, name, stats) {
  all[name] = stats;
  saveAllUsers(all);
}

/* ================= UI Bits ================= */
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

// Hearts: ❤️ full, 💔 broken (persiste rota)
const Hearts = ({ lives, maxLives = 3, lostAnim }) => (
  <div className="flex items-center gap-1">
    {Array.from({ length: maxLives }).map((_, idx) => {
      const full = idx < lives;
      const breaking = !full && idx === lives && lostAnim;
      return (
        <span
          key={idx}
          className={["text-xl select-none", "text-red-500", breaking ? "animate-[heartbreak_700ms_ease]" : ""].join(" ")}
        >
          {full ? "❤️" : "💔"}
        </span>
      );
    })}
  </div>
);

// Top bar minimal (móvil)
const TopBar = ({ seen, correct, streak, lives, total, currentUser, onChangeUser, lostAnim }) => {
  const progress = total ? Math.round((seen / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="w-full flex items-center justify-between text-sm font-medium dark:text-slate-300">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-amber-500 font-semibold">
            <span className="text-xl">🔥</span>
            <span>{streak}</span>
          </div>
          <div className="ml-2 flex items-center gap-3 text-gray-600 dark:text-slate-300">
            <div>Seen: {seen}</div>
            <div>✔️ {correct}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={currentUser}
            onChange={(e) => onChangeUser(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm dark:bg-slate-900 dark:border-slate-700"
            title="Active user"
          >
            {USERS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <Hearts lives={lives} maxLives={3} lostAnim={lostAnim} />
        </div>
      </div>

      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden dark:bg-slate-700">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

// 🌐 Global leaderboards (Supabase)
const CloudLeaderboards = ({ topPoints, topStreaks }) => {
  const Card = ({ title, rows, field, valueClass }) => (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:bg-slate-900 dark:border-slate-700">
      <h3 className="font-semibold mb-3 text-gray-800 dark:text-slate-100">{title}</h3>
      <ul className="space-y-2">
        {rows.map((row, idx) => (
          <li key={`${row.name}-${idx}`} className="flex justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-6 text-gray-500">{idx + 1}.</span>
              <span className="font-medium">{row.name}</span>
            </div>
            <span className={`font-semibold ${valueClass}`}>{row[field]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  
  return (
    <div className="grid md:grid-cols-2 gap-4 mt-8">
      <Card title="🏆 Top Best Points" rows={topPoints} field="best_points" valueClass="text-sky-600 dark:text-sky-300" />
      <Card title="🔥 Top Best Streak" rows={topStreaks} field="best_streak" valueClass="text-amber-600 dark:text-amber-300" />
    </div>
  );
};

/* ================= Main App ================= */
export default function App() {
  const MAX_LIVES = 3;

  const [deck, setDeck] = useState([]);
  const [i, setI] = useState(0);

  const [chosen, setChosen] = useState(new Set());
  const [phase, setPhase] = useState("answer"); // answer | review

  const [allUsers, setAllUsers] = useState(loadAllUsers());
  const [currentUser, setCurrentUser] = useState(USERS[0]);

  const [lostAnim, setLostAnim] = useState(false);
  const prevHearts = useRef(null);

  // 🔽 Global leaderboards (Supabase)
  const [topPoints, setTopPoints] = useState([]);
  const [topStreaks, setTopStreaks] = useState([]);

  async function refreshLeaderboards() {
    try {
      const [tp, ts] = await Promise.all([getLeaderboardByPoints(10), getLeaderboardByStreak(10)]);
      setTopPoints(tp || []);
      setTopStreaks(ts || []);
    } catch (e) {
      console.warn("Leaderboard fetch failed:", e?.message || e);
    }
  }

  // Stats del usuario activo
  const stats = getUserStats(allUsers, currentUser);
  const { points, bestPoints, seen, correct, streak, bestStreak, hearts } = stats;

  const cur = deck[i];
  const answers = cur?.answers || [];
  const isMulti = answers.length > 1;
  const maxSelectable = answers.length || 1;

  // --------- helpers de ronda 25 ---------
  function getRandomDeck() {
    const arr = Array.isArray(defaultDeck) ? [...defaultDeck] : [];
    for (let k = arr.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [arr[k], arr[j]] = [arr[j], arr[k]];
    }
    return arr.slice(0, 25); // 25 preguntas por ronda
  }

  function resetRunAndDeck() {
    setChosen(new Set());
    setPhase("answer");
    setI(0);
    setDeck(getRandomDeck());
  }
  // ---------------------------------------

  useEffect(() => {
    resetRunAndDeck();         // carga 25 aleatorias al inicio
    refreshLeaderboards();     // carga leaderboards globales
  }, []);

  function updateUser(mutator) {
    setAllUsers((prev) => {
      const next = { ...prev };
      const s = { ...getUserStats(prev, currentUser) };
      mutator(s);
      setUserStats(next, currentUser, s);
      return next;
    });
  }

  // animación de corazón roto al perder vida
  useEffect(() => {
    if (prevHearts.current !== null && hearts < prevHearts.current) {
      setLostAnim(true);
      const t = setTimeout(() => setLostAnim(false), 700);
      return () => clearTimeout(t);
    }
    prevHearts.current = hearts;
  }, [hearts]);

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

    updateUser((s) => {
      s.seen += 1;
      if (ok) {
        s.correct += 1;
        s.points = (s.points || 0) + 10; // nunca restamos
        s.streak += 1;
        s.bestStreak = Math.max(s.bestStreak || 0, s.streak);
      } else {
        s.streak = 0;
        s.hearts = Math.max(0, (s.hearts || MAX_LIVES) - 1); // pierde vida
      }
    });

    setPhase("review");
  }

  // Al quedarse sin vidas: sube récord si mejora y reinicia RUN y DECK (25 nuevas)
  useEffect(() => {
    if (hearts === 0) {
      setTimeout(() => {
        setAllUsers((prev) => {
          const next = { ...prev };
          const s = { ...getUserStats(prev, currentUser) };

          const runPoints = s.points || 0;
          const runBestStreak = s.bestStreak || 0;

          // récord local (visual)
          s.bestPoints = Math.max(s.bestPoints || 0, s.points || 0);

          // 🔗 récord global (Supabase)
          (async () => {
            try {
              await updateRecordIfBetter(currentUser, runPoints, runBestStreak);
              await refreshLeaderboards();
            } catch (e) {
              console.warn("Supabase update failed:", e?.message || e);
            }
          })();

          // reset del run
          s.points = 0;
          s.seen = 0;
          s.correct = 0;
          s.streak = 0;
          s.hearts = MAX_LIVES;

          setUserStats(next, currentUser, s);
          return next;
        });

        resetRunAndDeck(); // nuevo set aleatorio de 25
        alert(`💔 ${currentUser} ran out of hearts! Run reset.\nYour best points record is saved.`);
      }, 50);
    }
  }, [hearts]); // eslint-disable-line

  function next() {
    if (!cur || hearts === 0) return;
    const nextIndex = i + 1;

    // Al completar la ronda de 25 preguntas:
    if (nextIndex >= deck.length) {
      const acc = Math.round((stats.correct / Math.max(1, stats.seen)) * 100);
      const msg =
        `Finished 25 questions, ${currentUser}!\n` +
        `Accuracy: ${acc}%  •  Points this run: ${stats.points}\n` +
        `Best Points: ${bestPoints}  •  Best Streak: ${bestStreak}\n\n` +
        `Start a new 25-question round?`;

      if (window.confirm(msg)) {
        // Sólo reiniciamos la ronda (no los puntos/vidas);
        // tu lógica de reset de puntos/vidas sigue ocurriendo al perder las 3 vidas.
        resetRunAndDeck();
      }
      return;
    }

    setI(nextIndex);
    setChosen(new Set());
    setPhase("answer");
  }

  // Atajos de selección (1–6)
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
    <div className="min-h-screen bg-[#0b1220] text-gray-800 dark:bg-slate-950 dark:text-slate-100">
      {/* tiny CSS animations */}
      <style>{`
        @keyframes pop { from { transform: scale(.98); opacity:.92 } to { transform: scale(1); opacity:1 } }
        @keyframes heartbreak {
          0% { transform: scale(1); filter: hue-rotate(0deg); }
          40% { transform: scale(1.15) rotate(-8deg); }
          60% { transform: scale(0.95) rotate(6deg); }
          100% { transform: scale(1); }
        }
      `}</style>

      <div className="mx-auto w-full max-w-3xl px-5 py-6">
        {/* Top bar */}
        <div className="mb-4">
          <TopBar
            seen={seen}
            correct={correct}
            streak={streak}
            lives={hearts}
            total={deck.length} // 25 por ronda
            currentUser={currentUser}
            onChangeUser={setCurrentUser}
            lostAnim={lostAnim}
          />
        </div>

        {/* Question */}
        <div className="mb-3">
          {cur ? <Bubble sub={subHint}>{cur.q}</Bubble> : <Bubble>Deck loaded. Click an option to start.</Bubble>}
        </div>

        {/* Multi counter */}
        {cur && isMulti && (
          <div className="mb-4 text-sm text-gray-300">
            Selected: <span className="font-semibold">{selectedCount}</span> / {maxSelectable}
          </div>
        )}

        {/* Choices */}
        <div className="flex flex-col gap-4">
          {cur &&
            cur.choices.map(([L, text], idx) => {
              const isActive = chosen.has(L);
              const isCorrect = phase === "review" && answers.includes(L);
              const isWrong = phase === "review" && isActive && !isCorrect;
              const disableThis = phase === "answer" && isMulti && !isActive && atLimit;
              return (
                <Pill
                  key={idx}
                  letter={L}
                  text={text}
                  active={isActive}
                  correct={isCorrect}
                  wrong={isWrong}
                  disabled={disableThis}
                  onClick={() => toggleChoice(L)}
                />
              );
            })}
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-center gap-3">
          {cur && phase === "answer" && (
            <button
              className={`rounded-xl px-8 py-3 font-bold transition-all border ${
                chosen.size > 0
                  ? "bg-emerald-400 hover:bg-emerald-300 text-black"
                  : "bg-gray-300 dark:bg-slate-700 dark:text-slate-300 cursor-not-allowed text-black"
              } dark:text-white`}
              disabled={chosen.size === 0}
              onClick={submit}
            >
              SEND
            </button>
          )}
          {cur && phase === "review" && (
            <button
              className="rounded-xl px-8 py-3 font-bold transition-all border bg-emerald-400 hover:bg-emerald-300 text-black dark:text-white"
              onClick={next}
            >
              NEXT
            </button>
          )}
        </div>

        {/* 🌐 Global Leaderboards (Supabase) */}
        <CloudLeaderboards topPoints={topPoints} topStreaks={topStreaks} />
      </div>
    </div>
  );
}

/* ================= helpers ================= */
function eqSets(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
