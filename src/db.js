// src/db.js
import { supabase } from "./supabase";

/** Devuelve todos los usuarios ordenados por best_points (desc) */
export async function getLeaderboardByPoints(limit = 10) {
  const { data, error } = await supabase
    .from("users")
    .select("name, best_points, best_streak")
    .order("best_points", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/** Devuelve todos los usuarios ordenados por best_streak (desc) */
export async function getLeaderboardByStreak(limit = 10) {
  const { data, error } = await supabase
    .from("users")
    .select("name, best_points, best_streak")
    .order("best_streak", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/**
 * Actualiza el récord del usuario si el run alcanzó un mejor puntaje o mejor streak.
 * name: "Cris" | "Jose" | ...
 * points: puntaje del run actual (no se resta al equivocarse)
 * streak: racha máxima alcanzada en el run actual
 */
export async function updateRecordIfBetter(name, points, streak) {
  // Obtén récord actual
  const { data: current, error: selErr } = await supabase
    .from("users")
    .select("best_points, best_streak")
    .eq("name", name)
    .single();
  if (selErr) throw selErr;

  const nextBestPoints = Math.max(current?.best_points ?? 0, points ?? 0);
  const nextBestStreak = Math.max(current?.best_streak ?? 0, streak ?? 0);

  // Si no mejora, no hacemos UPDATE para evitar escrituras innecesarias
  if (
    nextBestPoints === (current?.best_points ?? 0) &&
    nextBestStreak === (current?.best_streak ?? 0)
  ) {
    return { updated: false };
  }

  const { error: updErr } = await supabase
    .from("users")
    .update({
      best_points: nextBestPoints,
      best_streak: nextBestStreak,
      updated_at: new Date().toISOString(),
    })
    .eq("name", name);
  if (updErr) throw updErr;

  return { updated: true };
}
