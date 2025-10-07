// App.jsx — HANA Hero (menu + game screen + modes)
// - Classic: 25 random questions, 3 lives
// - Time Attack: 10s/question, 3 lives, no Seen/Correct counters in top bar
// - Practice: 25 random questions, sin vidas
import { useEffect, useRef, useState } from "react";
import defaultDeck from "./sap_basis_duo_questions.json";

// 🔗 Supabase helpers (ya en tu proyecto)
import {
  getLeaderboardByPoints,
  getLeaderboardByStreak,
  updateRecordIfBetter,
} from "./db";

/* ================= Constants ================= */
const USERS = ["Cris", "Jose", "Adrian", "Sebas", "Enrique", "Isaac"];
const USERS_KEY = "sap_basis_duo_users_v2";
const ROUND_SIZE = 25;
const MAX_LIVES = 3;
const TIME_PER_QUESTION = 10; // <-- ⏱ segundos por pregunta en Time Attack (ajústalo aquí)

export const MODES = {
  CLASSIC: "classic",
  TIME: "time",
  PRACTICE: "practice",
};

/* ================= Local Storage helpers ================= */
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
          hearts: MAX_LIVES,
        };
      } else {
        base[name].bestPoints ??= 0;
        base[name].hearts ??= MAX_LIVES;
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
        hearts: MAX_LIVES,
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
      hearts: MAX_LIVES,
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
const Hearts = ({ lives, maxLives = MAX_LIVES, lostAnim }) => (
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

// Top bar (oculta Seen/✔️ y muestra ⏱ a la izquierda en Time Attack)
const TopBar = ({
  gameMode,
  timerSec,
  seen,
  correct,
  streak,
  lives,
  total,
  currentUser,
  onChangeUser,
  lostAnim,
}) => {
  const isTime = gameMode === MODES.TIME;
  const progress = total ? Math.round((seen / total) * 100) : 0;

  const TimerPill = () => (
    <div className="select-none rounded-lg border border-slate-600/50 px-3 py-1 text-xs font-semibold text-slate-200 bg-slate-800/60">
      ⏱ {Math.max(0, timerSec ?? 0)}s
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="w-full flex items-center justify-between text-sm font-medium dark:text-slate-300">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-amber-500 font-semibold">
            <span className="text-xl">🔥</span>
            <span>{streak}</span>
          </div>

          {isTime ? (
            <TimerPill />
          ) : (
            <div className="ml-2 flex items-center gap-3 text-gray-600 dark:text-slate-300">
              <div>Seen: {seen}</div>
              <div>✔️ {correct}</div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <select
            value={currentUser}
            onChange={(e) => onChangeUser(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm dark:bg-slate-900 dark:border-slate-700"
            title="Active user"
          >
            {USERS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <Hearts lives={lives} maxLives={MAX_LIVES} lostAnim={lostAnim} />
        </div>
      </div>

      {!isTime && (
        <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden dark:bg-slate-700">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
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

// Pantalla de menú (centrada, mobile-friendly)
function MenuScreen({ user, setUser, gameMode, setGameMode, onStart, topPoints, topStreaks }) {
  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-center text-4xl md:text-6xl font-extrabold mb-6">HANA Hero</h1>

        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 md:p-7 mb-6">
          <label className="block text-sm mb-2 text-slate-300">User</label>
          <select
            value={user}
            onChange={(e) => setUser(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 mb-4"
          >
            {USERS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>

          <label className="block text-sm mb-2 text-slate-300">Game Mode</label>
          <select
            value={gameMode}
            onChange={(e) => setGameMode(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 mb-6"
          >
            <option value={MODES.CLASSIC}>Classic (25 Qs)</option>
            <option value={MODES.TIME}>Time Attack (10s/q)</option>
            <option value={MODES.PRACTICE}>Practice (no lives)</option>
          </select>

          <button
            onClick={onStart}
              className="mt-2 rounded-lg border border-emerald-400 text-emerald-300 px-4 py-2 text-sm hover:bg-emerald-400/10"
          >
            START ROUND
          </button>
        </div>

        <CloudLeaderboards topPoints={topPoints} topStreaks={topStreaks} />
      </div>
    </div>
  );
}

/* ================= Main App ================= */
export default function App() {
  const [screen, setScreen] = useState("menu"); // 'menu' | 'game'
  const [gameMode, setGameMode] = useState(MODES.CLASSIC);
  const [currentUser, setCurrentUser] = useState(USERS[0]);

  // Leaderboards globales
  const [topPoints, setTopPoints] = useState([]);
  const [topStreaks, setTopStreaks] = useState([]);

  // Estado juego
  const [deck, setDeck] = useState([]);
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState(new Set());
  const [phase, setPhase] = useState("answer"); // answer | review

  const [allUsers, setAllUsers] = useState(loadAllUsers());
  const stats = getUserStats(allUsers, currentUser);
  const { points, bestPoints, seen, correct, streak, bestStreak, hearts } = stats;

  const [lostAnim, setLostAnim] = useState(false);
  const prevHearts = useRef(null);

  // ⏱ Time Attack
  const [timer, setTimer] = useState(TIME_PER_QUESTION);
  const timerRef = useRef(null);

  // Helpers
  function shuffle(arr) {
    for (let j = arr.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [arr[j], arr[k]] = [arr[k], arr[j]];
    }
  }
  function getRandomDeck() {
    const arr = Array.isArray(defaultDeck) ? [...defaultDeck] : [];
    shuffle(arr);
    return arr.slice(0, ROUND_SIZE);
  }
  function resetRunAndDeck() {
    setChosen(new Set());
    setPhase("answer");
    setI(0);
    setDeck(getRandomDeck());
    if (gameMode === MODES.TIME) setTimer(TIME_PER_QUESTION);
  }
  function refreshLeaderboards() {
    Promise.all([getLeaderboardByPoints(10), getLeaderboardByStreak(10)])
      .then(([tp, ts]) => {
        setTopPoints(tp || []);
        setTopStreaks(ts || []);
      })
      .catch((e) => console.warn("Leaderboard fetch failed:", e?.message || e));
  }
  function updateUser(mutator) {
    setAllUsers((prev) => {
      const next = { ...prev };
      const s = { ...getUserStats(prev, currentUser) };
      mutator(s);
      setUserStats(next, currentUser, s);
      return next;
    });
  }

  // carga leaderboards al montar
  useEffect(() => {
    refreshLeaderboards();
  }, []);

  // animación corazón roto
  useEffect(() => {
    if (prevHearts.current !== null && hearts < prevHearts.current) {
      setLostAnim(true);
      const t = setTimeout(() => setLostAnim(false), 700);
      return () => clearTimeout(t);
    }
    prevHearts.current = hearts;
  }, [hearts]);

  // efecto timer por pregunta (solo Time Attack)
  useEffect(() => {
    if (screen !== "game" || gameMode !== MODES.TIME) return;
    if (phase !== "answer") return;

    clearInterval(timerRef.current);
    setTimer(TIME_PER_QUESTION);

    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          // Tiempo agotado => cuenta como fallo
          handleTimeOut();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [screen, gameMode, i, phase]);

  function handleTimeOut() {
    // marca respuesta como incorrecta (sin selección)
    updateUser((s) => {
      s.seen += 1;
      s.streak = 0;
      s.hearts = Math.max(0, (s.hearts || MAX_LIVES) - 1);
    });
    setPhase("review");
  }

  const cur = deck[i];
  const answers = cur?.answers || [];
  const isMulti = answers.length > 1;
  const maxSelectable = answers.length || 1;

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
    if (!cur || phase !== "answer") return;

    let ok = false;
    if (gameMode === MODES.TIME && chosen.size === 0) {
      // En time mode, permitir enviar sin seleccionar (ya contamos timeout como fallo)
      ok = false;
    } else {
      ok = eqSets(chosen, new Set(answers)) || answers.length === 0;
    }

    updateUser((s) => {
      s.seen += 1;
      if (ok) {
        s.correct += 1;
        s.points = (s.points || 0) + 10; // no restamos
        s.streak += 1;
        s.bestStreak = Math.max(s.bestStreak || 0, s.streak);
      } else {
        s.streak = 0;
        if (gameMode !== MODES.PRACTICE) {
          s.hearts = Math.max(0, (s.hearts || MAX_LIVES) - 1);
        }
      }
    });

    setPhase("review");
    if (gameMode === MODES.TIME) clearInterval(timerRef.current);
  }

  // sin vidas => sube récord y resetea
  useEffect(() => {
    if (screen !== "game") return;
    if (gameMode === MODES.PRACTICE) return;
    if (hearts === 0) {
      setTimeout(() => {
        setAllUsers((prev) => {
          const next = { ...prev };
          const s = { ...getUserStats(prev, currentUser) };

          const runPoints = s.points || 0;
          const runBestStreak = s.bestStreak || 0;

          s.bestPoints = Math.max(s.bestPoints || 0, s.points || 0);

          (async () => {
            try {
              await updateRecordIfBetter(currentUser, runPoints, runBestStreak);
              refreshLeaderboards();
            } catch (e) {
              console.warn("Supabase update failed:", e?.message || e);
            }
          })();

          s.points = 0;
          s.seen = 0;
          s.correct = 0;
          s.streak = 0;
          s.hearts = MAX_LIVES;

          setUserStats(next, currentUser, s);
          return next;
        });

        resetRunAndDeck();
        alert(`💔 ${currentUser} ran out of hearts! Run reset.\nYour best points record is saved.`);
      }, 50);
    }
  }, [hearts, screen, gameMode]); // eslint-disable-line

  function next() {
    if (!cur) return;
    const nextIndex = i + 1;

    if (nextIndex >= deck.length) {
      const acc = Math.round((stats.correct / Math.max(1, stats.seen)) * 100);
      const msg =
        `Finished ${ROUND_SIZE} questions, ${currentUser}!\n` +
        `Accuracy: ${acc}%  •  Points this run: ${stats.points}\n` +
        `Best Points: ${bestPoints}  •  Best Streak: ${bestStreak}\n\n` +
        `Start a new ${ROUND_SIZE}-question round?`;

      if (window.confirm(msg)) {
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
      if (screen !== "game") return;
      const digits = ["1", "2", "3", "4", "5", "6"];
      if (digits.includes(e.key)) {
        const idx = Number(e.key) - 1;
        if (cur && deck[i] && deck[i].choices[idx]) toggleChoice(deck[i].choices[idx][0]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, cur, chosen, phase, deck, i]);

  // ===== Render =====
  return (
    <div className="min-h-screen bg-[#0b1220] text-gray-800 dark:bg-slate-950 dark:text-slate-100">
      {/* tiny CSS animations */}
      <style>{`
        @keyframes pop { from { transform: scale(.98); opacity:.92 } to { transform: scale(1); opacity:1 } }
        @keyframes heartbreak { 0% { transform: scale(1) } 40% { transform: scale(1.15) rotate(-8deg) } 60% { transform: scale(0.95) rotate(6deg) } 100% { transform: scale(1) } }
      `}</style>

      {screen === "menu" ? (
        <MenuScreen
          user={currentUser}
          setUser={setCurrentUser}
          gameMode={gameMode}
          setGameMode={setGameMode}
          onStart={() => {
            // iniciar juego
            setScreen("game");
            resetRunAndDeck();
            // reset de vidas solo al entrar en un modo con vidas
            if (gameMode !== MODES.PRACTICE) {
              setAllUsers((prev) => {
                const next = { ...prev };
                const s = { ...getUserStats(prev, currentUser) };
                s.hearts = MAX_LIVES;
                s.streak = 0;
                setUserStats(next, currentUser, s);
                return next;
              });
            }
          }}
          topPoints={topPoints}
          topStreaks={topStreaks}
        />
      ) : (
        <div className="mx-auto w-full max-w-3xl px-5 py-6">
          {/* header actions */}
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => {
                setScreen("menu");
                clearInterval(timerRef.current);
              }}
              className="rounded-xl px-4 py-2 font-semibold border border-slate-700 bg-slate-900 hover:bg-slate-800"
            >
              ← Back to Menu
            </button>
            <button
              onClick={resetRunAndDeck}
            className="rounded-lg border border-emerald-400 text-emerald-300 px-3 py-2 text-sm hover:bg-emerald-400/10"
            >
              NEW ROUND
            </button>
          </div>

          {/* Top bar */}
          <div className="mb-4">
            <TopBar
              gameMode={gameMode}
              timerSec={timer}
              seen={seen}
              correct={correct}
              streak={streak}
              lives={hearts}
              total={deck.length}
              currentUser={currentUser}
              onChangeUser={setCurrentUser}
              lostAnim={lostAnim}
            />
          </div>

          {/* Question */}
          <div className="mb-3">
            {cur ? (
              <Bubble
                sub={
                  cur.answers?.length > 1
                    ? `Multiple answers: select ${cur.answers.length}.`
                    : `Single answer.`
                }
              >
                {cur.q}
              </Bubble>
            ) : (
              <Bubble>Deck loaded. Click an option to start.</Bubble>
            )}
          </div>

          {/* Multi counter (oculto en Time Attack si quieres minimal) */}
          {cur && cur.answers?.length > 1 && gameMode !== MODES.TIME && (
            <div className="mb-4 text-sm text-gray-300">
              Selected: <span className="font-semibold">{Array.from(chosen).length}</span> / {cur.answers.length}
            </div>
          )}

          {/* Choices */}
          <div className="flex flex-col gap-4">
            {cur &&
              cur.choices.map(([L, text], idx) => {
                const isActive = chosen.has(L);
                const isCorrect = phase === "review" && (cur.answers || []).includes(L);
                const isWrong = phase === "review" && isActive && !isCorrect;
                const atLimit =
                  phase === "answer" &&
                  (cur.answers?.length || 1) > 1 &&
                  !isActive &&
                  Array.from(chosen).length >= (cur.answers?.length || 1);

                return (
                  <Pill
                    key={idx}
                    letter={L}
                    text={text}
                    active={isActive}
                    correct={isCorrect}
                    wrong={isWrong}
                    disabled={atLimit}
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
                  (chosen.size > 0 || gameMode === MODES.TIME)
                    ? "bg-emerald-400 hover:bg-emerald-300 text-black"
                    : "bg-gray-300 dark:bg-slate-700 dark:text-slate-300 cursor-not-allowed text-black"
                } dark:text-white`}
                disabled={!(chosen.size > 0 || gameMode === MODES.TIME)}
                onClick={submit}
              >
                SEND
              </button>
            )}
            {cur && phase === "review" && (
              <button
                className="rounded-xl px-8 py-3 font-bold transition-all border bg-emerald-400 hover:bg-emerald-300 text-black dark:text-white"
                onClick={() => {
                  if (gameMode === MODES.TIME) clearInterval(timerRef.current);
                  next();
                }}
              >
                NEXT
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= helpers ================= */
function eqSets(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
