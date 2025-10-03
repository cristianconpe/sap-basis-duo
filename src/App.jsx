// App.jsx
import { useEffect, useState } from "react";
import defaultDeck from "./sap_basis_duo_questions.json"; // bundled dataset

// ----------------------
// Small components (UI)
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
      "bg-white",
    ].join(" ")}
    title="Click to select"
  >
    <span className="text-gray-800 text-[15px]">{text}</span>
  </button>
);

const Bubble = ({ children, sub }) => (
  <div className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-6 shadow-sm">
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-full bg-emerald-500" />
      <div>
        <p className="text-[18px] font-semibold text-gray-800 leading-6">{children}</p>
        {sub ? <p className="mt-1 text-sm text-gray-500">{sub}</p> : null}
      </div>
    </div>
  </div>
);

const TopBar = ({ seen, correct }) => {
  const acc = seen ? Math.round((correct / seen) * 100) : 0;
  return (
    <div className="w-full text-sm text-gray-500 flex items-center justify-between">
      <div>Seen: {seen}</div>
      <div>Correct: {correct}</div>
      <div>Accuracy: {acc}%</div>
    </div>
  );
};

// ----------------------
// Main App
// ----------------------
export default function App() {
  const [deck, setDeck] = useState([]);
  const [i, setI] = useState(0);
  const [seen, setSeen] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [chosen, setChosen] = useState(new Set());
  const [phase, setPhase] = useState("answer"); // answer → review

  const cur = deck[i];
  const answers = cur?.answers || [];
  const isMulti = answers.length > 1;
  const maxSelectable = answers.length || 1;

  // ---- preload bundled JSON (no upload, no fetch) ----
  useEffect(() => {
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

  // ---- Single click selection with limits ----
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
    if (ok) setCorrect((v) => v + 1);
    setPhase("review");

    if (!ok) {
      const wrong = JSON.parse(localStorage.getItem("sap_basis_duo_wrong") || "[]");
      wrong.push(cur);
      localStorage.setItem("sap_basis_duo_wrong", JSON.stringify(wrong));
    }
  }

  function next() {
    if (!cur) return;
    let nextIndex = i + 1;
    if (nextIndex >= deck.length) {
      const wrong = JSON.parse(localStorage.getItem("sap_basis_duo_wrong") || "[]");
      if (wrong.length) {
        shuffle(wrong);
        setDeck(wrong);
        localStorage.removeItem("sap_basis_duo_wrong");
        nextIndex = 0;
      } else {
        alert(`Finished! Accuracy: ${Math.round((correct / Math.max(1, seen)) * 100)}%`);
        return;
      }
    }
    setI(nextIndex);
    setChosen(new Set());
    setPhase("answer");
  }

  // Numeric shortcuts still supported (1–6) for selection only
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

  const subHint = cur
    ? isMulti
      ? `Multiple answers: select ${maxSelectable}.`
      : `Single answer.`
    : undefined;

  const selectedCount = chosen.size;
  const atLimit = phase === "answer" && isMulti && selectedCount >= maxSelectable;

  return (
    <div className="min-h-screen bg-[#f7f7fb] text-gray-800">
      <div className="mx-auto w-full max-w-3xl px-5 py-6">
        {/* Top bar only (upload removed) */}
        <div className="mb-4 flex items-center justify-between">
          <TopBar seen={seen} correct={correct} />
        </div>

        {/* Question bubble */}
        <div className="mb-3">
          {cur ? (
            <Bubble sub={subHint}>{cur.q}</Bubble>
          ) : (
            <Bubble>Deck loaded. Click an option to start.</Bubble>
          )}
        </div>

        {cur && isMulti && (
          <div className="mb-4 text-sm text-gray-600">
            Selected: <span className="font-semibold">{selectedCount}</span> / {maxSelectable}
          </div>
        )}

        {/* Options */}
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
        <div className="mt-8 flex items-center justify-center gap-3">
          {cur && phase === "answer" && (
            <button
              className={`rounded-xl px-8 py-3 font-bold transition-all border ${
                chosen.size > 0 ? "bg-emerald-400 hover:bg-emerald-300" : "bg-gray-200 cursor-not-allowed"
              } text-black`}
              disabled={chosen.size === 0}
              onClick={submit}
            >
              SEND
            </button>
          )}
          {cur && phase === "review" && (
            <button
              className="rounded-xl px-8 py-3 font-bold transition-all border bg-emerald-400 hover:bg-emerald-300 text-black"
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

function eqSets(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
