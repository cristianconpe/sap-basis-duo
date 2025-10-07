// src/db.js
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

if (!url || !key) {
  console.warn("⚠️ Supabase env vars missing: VITE_SUPABASE_URL / VITE_SUPABASE_KEY");
}
export const supabase = createClient(url, key);

// Upsert user and update record only if better
export async function updateRecordIfBetter(name, runPoints, runBestStreak) {
  if (!name) throw new Error("Name is required");

  // 1) get current row
  const { data: rows, error: selErr } = await supabase
    .from("users")
    .select("name,best_points,best_streak")
    .eq("name", name)
    .maybeSingle();

  if (selErr) throw selErr;

  const currentBestPoints = rows?.best_points ?? 0;
  const currentBestStreak = rows?.best_streak ?? 0;

  const nextBestPoints = Math.max(currentBestPoints, runPoints || 0);
  const nextBestStreak = Math.max(currentBestStreak, runBestStreak || 0);

  // 2) upsert if better or row doesn't exist
  const { error: upErr } = await supabase
    .from("users")
    .upsert(
      {
        name,
        best_points: nextBestPoints,
        best_streak: nextBestStreak,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "name" }
    );

  if (upErr) throw upErr;
  return { best_points: nextBestPoints, best_streak: nextBestStreak };
}

export async function getLeaderboardByPoints(limit = 10) {
  const { data, error } = await supabase
    .from("users")
    .select("name,best_points")
    .order("best_points", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getLeaderboardByStreak(limit = 10) {
  const { data, error } = await supabase
    .from("users")
    .select("name,best_streak")
    .order("best_streak", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
