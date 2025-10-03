// POST /api/leaderboard-upsert
// body: { name, bestPoints, bestStreak }
export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const body = await req.json().catch(() => ({}));
  const { name, bestPoints = 0, bestStreak = 0 } = body || {};
  if (!name) return new Response(JSON.stringify({ error: "name required" }), { status: 400 });

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const key = "leaderboard:v1";

  // lee leaderboard actual
  const get = await fetch(`${url}/get/${key}`, { headers: { Authorization: `Bearer ${token}` } });
  let data = { users: {} };
  if (get.ok) {
    const { result } = await get.json();
    if (result) data = JSON.parse(result);
  }

  const current = data.users[name] || { bestPoints: 0, bestStreak: 0 };
  data.users[name] = {
    bestPoints: Math.max(Number(current.bestPoints || 0), Number(bestPoints || 0)),
    bestStreak: Math.max(Number(current.bestStreak || 0), Number(bestStreak || 0)),
  };

  // guarda en KV
  const set = await fetch(`${url}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ value: JSON.stringify(data) }),
  });

  if (!set.ok) return new Response(JSON.stringify({ error: "kv set failed" }), { status: 500 });
  return new Response(JSON.stringify({ ok: true, users: data.users }), {
    status: 200, headers: { "content-type": "application/json" }
  });
}
