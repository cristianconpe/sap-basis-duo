// src/db.js
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_KEY?.trim();

if (!url || !key) {
  // error fuerte para que se vea en consola del navegador
  console.error("❌ Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel (and .env.local).");
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false }, // no sesiones en el cliente
});

// Upsert user and update record only if better
export async function updateRecordIfBetter(name, runPoints, runBestStreak) {
  if (!name) throw new Error("Name is required");

  const { data: row, error: selErr } = await supabase
    .from("users")
    .select("name,best_points,best_streak")
    .eq("name", name)
    .maybeSingle();
  if (selErr) throw selErr;

  const currentBestPoints = row?.best_points ?? 0;
  const currentBestStreak = row?.best_streak ?? 0;

  const nextBestPoints = Math.max(currentBestPoints, runPoints || 0);
  const nextBestStreak = Math.max(currentBestStreak, runBestStreak || 0);

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
