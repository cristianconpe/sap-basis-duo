import { useEffect, useMemo, useState } from "react";
import defaultDeck from "./sap_basis_duo_questions.json";

// ----------------------
// Small helpers
// ----------------------
function shuffle(arr) {
  for (let j = arr.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [arr[j], arr[k]] = [arr[k], arr[j]];
  }
}
function eqSets(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
const USERS = ["Cris", "Jose", "Adrian", "Sebas", "Enrique", "Isaac"];

// ----------------------
// UI atoms
// ----------------------
const Pill = ({ text, active, correct, wrong, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={[
      "w-full text-left rounded-2xl border px-5 py-4 transition-all",
      "focus:outline-none focus:ring-2",
      disabled ? "opacity-60 cursor-not-allowed" : "",
      active ? "border-emerald-500 ring-emerald-300" : "border-gray-200 hover:border-gray-300",
      correct ? "!border-green-500" : "",
      wrong ? "!border-red-500" : "",
      "bg-white dark:bg-slate-900",
      "text-gray-800 dark:text-gray-100",
    ].join(" ")}
  >
    <span className="text-[15px]">{text}</span>
  </button>
);

const Bubble = ({ children, sub }) => (
  <div className="w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-6 shadow-sm">
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-full bg-emerald-500" />
      <div>
        <p className="text-[18px] font-semibold text-gray-800 dark:text-gray-100 leading-6">{children}</p>
        {sub ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{sub}</p> : null}
      </div>
    </div>
  </div>
);

const Hearts = ({ hearts, broken }) => {
  const items = [];
  for (let i = 0; i < 3; i++) {
    const isLost = i < broken;
    items.push(
      <span key={i} className="text-xl select-none">
        {isLost ? "💔" : "❤️"}
      </span>
    );
  }
  return <div className="flex gap-2 items-center">{items}</div>;
};

const ProgressBar = ({ value }) => (
  <div className="h-2 w-full rounded bg-slate-700/50 overflow-hidden">
    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${value}%` }} />
  </div>
);

// ----------------------
// Main App
// ----------------------
export default function App() {
  // dataset
  const [deck, setDeck] = useState(() => {
    const initial = Array.isArray(defaultDeck) ? [...defaultDeck] : [];
    shuffle(initial);
    // shuffle choices for each question to avoid position bias
    initial.forEach((q) => shuffle(q.choices));
    return initial;
  });
  const [i, setI] = useState(0);

  // users & stats
  const [currentUser, setCurrentUser] = useState(() => {
    return localStorage.getItem("sap_duo_user") || USERS[0];
  });
  const [allUsers, setAllUsers] = useState(() => {
    const raw = localStorage.getItem("sap_duo_users");
    const base = {};
    USERS.forEach((u) => {
      base[u] = {
        points: 0,
        bestPoints: 0,
        seen: 0,
        correct: 0,
        streak: 0,
        bestStreak: 0,
        hearts: 3, // remaining hearts in current run
        brokenHearts: 0, // how many are broken (kept broken)
      };
    });
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return { ...base, ...parsed };
      } catch {
        return base;
      }
    }
    return base;
  });

  const s = allUsers[currentUser];
  const cur = deck[i];
  const answers = cur?.answers || [];
  const isMulti = answers.length > 1;
  const maxSelectable = answers.length || 1;

  // selection / phase / progress
  const [chosen, setChosen] = useState(new Set());
  const [phase, setPhase] = useState("answer"); // answer | review
  const progress = useMemo(() => {
    if (!deck.length) return 0;
    return Math.min(100, Math.round(((i + 1) / deck.length) * 100));
  }, [i, deck.length]);

  function saveAllUsers(next) {
    setAllUsers(next);
    localStorage.setItem("sap_duo_users", JSON.stringify(next));
  }

  // ---- Load leaderboard from Vercel KV and merge records
  useEffect(() => {
    fetch("/api/leaderboard-get")
      .then((r) => r.json())
      .then((remote) => {
        const remoteUsers = remote?.users || {};
        saveAllUsers((prev => {
          const next = typeof prev === "object" ? { ...prev } : { };
          USERS.forEach((u) => {
            if (!next[u]) {
              next[u] = { points:0, bestPoints:0, seen:0, correct:0, streak:0, bestStreak:0, hearts:3, brokenHearts:0 };
            }
          });
          for (const [name, rec] of Object.entries(remoteUsers)) {
            if (!next[name]) continue;
            next[name].bestPoints = Math.max(next[name].bestPoints || 0, rec.bestPoints || 0);
            next[name].bestStreak = Math.max(next[name].bestStreak || 0, rec.bestStreak || 0);
          }
          return next;
        }));
      })
      .catch(() => {});
  }, []);

  // ---- Handle user change
  function onUserChange(e) {
    const name = e.target.value;
    setCurrentUser(name);
    localStorage.setItem("sap_duo_user", name);
    setChosen(new Set());
    setPhase("answer");
  }

  // ---- Single click selection with limit (multi selects up to maxSelectable)
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

  // ---- Submit answer
  function submit() {
    if (!cur || chosen.size === 0) return;
    const ok = eqSets(chosen, new Set(answers)) || answers.length === 0;

    // update per-user stats
    const next = { ...allUsers };
    const stats = { ...s };

    stats.seen += 1;
    if (ok) {
      stats.correct += 1;
      stats.points += 10; // add points, never subtract
      stats.streak += 1;
      if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
      if (stats.points > stats.bestPoints) stats.bestPoints = stats.points;
    } else {
      // wrong: break a heart permanently
      if (stats.brokenHearts < 3) {
        stats.brokenHearts += 1;
      }
      stats.hearts = Math.max(0, 3 - stats.brokenHearts);
      // reset current streak only
      stats.streak = 0;
    }

    next[currentUser] = stats;
    saveAllUsers(next);

    setPhase("review");

    // If hearts finished, finalize run -> push record to KV and reset run counters
    if (stats.hearts === 0) {
      finalizeRun(stats);
    }
  }

  // ---- Finalize a run (lost all lives): upsert to KV and reset run counters
  async function finalizeRun(stats) {
    try {
      await fetch("/api/leaderboard-upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: currentUser,
          bestPoints: stats.bestPoints || 0,
          bestStreak: stats.bestStreak || 0,
        }),
      });
    } catch (_) {}

    // reset in-app counters for a new attempt
    const reset = { ...allUsers };
    reset[currentUser] = {
      ...stats,
      points: 0,
      seen: 0,
      correct: 0,
      streak: 0,
      hearts: 3,
      brokenHearts: 0,
    };
    saveAllUsers(reset);

    // reset deck progress visuals
    setChosen(new Set());
    setPhase("answer");
    setI(0);
    // reshuffle deck and choices for a fresh start
    const fresh = [...defaultDeck];
    shuffle(fresh);
    fresh.forEach((q) => shuffle(q.choices));
    setDeck(fresh);
  }

  // ---- Next question
  function nextQ() {
    if (!cur) return;
    let nextIndex = i + 1;
    if (nextIndex >= deck.length) {
      // loop back with reshuffle
      const fresh = [...defaultDeck];
      shuffle(fresh);
      fresh.forEach((q) => shuffle(q.choices));
      setDeck(fresh);
      nextIndex = 0;
    }
    setI(nextIndex);
    setChosen(new Set());
    setPhase("answer");
  }

  // keyboard: 1..6 to select
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
  }, [cur, deck, i]);

  const subHint = cur ? (isMulti ? `Multiple answers: select ${maxSelectable}.` : `Single answer.`) : undefined;
  const selectedCount = chosen.size;
  const atLimit = phase === "answer" && isMulti && selectedCount >= maxSelectable;

  // Leaderboards (from local state; already merged with KV on mount)
  const topStreaks = useMemo(() => {
    return [...USERS]
      .map((u) => ({ name: u, v: allUsers[u]?.bestStreak || 0 }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 6);
  }, [allUsers]);

  const topPoints = useMemo(() => {
    return [...USERS]
      .map((u) => ({ name: u, v: allUsers[u]?.bestPoints || 0 }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 6);
  }, [allUsers]);

  const acc = s.seen ? Math.round((s.correct / s.seen) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0B1220] text-gray-100">
      <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-5 sm:py-6">
        {/* Top bar (mobile friendly) */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔥</span>
            <span className="text-sm">Streak</span>
            <span className="rounded-md border border-emerald-700 bg-emerald-900/30 px-2 py-1 text-emerald-300 text-sm font-semibold">
              {s.streak}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <select
              className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
              value={currentUser}
              onChange={onUserChange}
            >
              {USERS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>

            <Hearts hearts={s.hearts} broken={s.brokenHearts} />
          </div>
        </div>

        {/* Accuracy line */}
        <div className="mb-4 text-sm text-gray-300">
          ✔️ {s.correct} / {s.seen} — {acc}%
        </div>

        {/* Progress */}
        <div className="mb-4">
          <ProgressBar value={progress} />
        </div>

        {/* Question */}
        <div className="mb-3">
          {cur ? <Bubble sub={subHint}>{cur.q}</Bubble> : <Bubble>Deck loaded. Click an option to start.</Bubble>}
        </div>

        {/* Multi counter */}
        {cur && isMulti && (
          <div className="mb-3 text-sm text-gray-300">
            Selected: <span className="font-semibold">{selectedCount}</span> / {maxSelectable}
          </div>
        )}

        {/* Choices */}
        <div className="flex flex-col gap-3">
          {cur &&
            cur.choices.map(([L, text], idx) => {
              const isActive = chosen.has(L);
              const isCorrect = phase === "review" && answers.includes(L);
              const isWrong = phase === "review" && isActive && !isCorrect;
              const disableThis = phase === "answer" && isMulti && !isActive && atLimit;
              return (
                <Pill
                  key={idx}
                  text={`${L}. ${text}`}
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
        <div className="mt-6 flex items-center justify-center gap-3">
          {cur && phase === "answer" && (
            <button
              className={`rounded-xl px-8 py-3 font-bold transition-all border 
                ${chosen.size > 0 ? "bg-emerald-500 hover:bg-emerald-400" : "bg-slate-600 cursor-not-allowed"} 
                text-black`}
              disabled={chosen.size === 0}
              onClick={submit}
            >
              SEND
            </button>
          )}
          {cur && phase === "review" && (
            <button
              className="rounded-xl px-8 py-3 font-bold transition-all border bg-emerald-500 hover:bg-emerald-400 text-black"
              onClick={nextQ}
            >
              NEXT
            </button>
          )}
        </div>

        {/* Leaderboards */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
            <h3 className="mb-3 font-semibold text-sky-300">Top Best Streaks</h3>
            <ol className="space-y-2">
              {topStreaks.map((t, idx) => (
                <li key={t.name} className="flex justify-between text-sm">
                  <span className="text-gray-300">{idx + 1}. {t.name}</span>
                  <span className="font-semibold text-emerald-300">{t.v}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
            <h3 className="mb-3 font-semibold text-sky-300">Top Best Points</h3>
            <ol className="space-y-2">
              {topPoints.map((t, idx) => (
                <li key={t.name} className="flex justify-between text-sm">
                  <span className="text-gray-300">{idx + 1}. {t.name}</span>
                  <span className="font-semibold text-emerald-300">{t.v}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-gray-500">
          Records sync via Vercel KV. New bests upload automatically when you lose all lives.
        </div>
      </div>
    </div>
  );
}
