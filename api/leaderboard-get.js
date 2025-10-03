// GET /api/leaderboard-get  -> devuelve { users: { [name]: { bestPoints, bestStreak } } }
export const config = { runtime: "edge" };

export default async function handler() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.KV_REST_API_TOKEN;
  const key = "leaderboard:v1";

  const r = await fetch(`${url}/get/${key}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (r.status === 404) {
    return new Response(JSON.stringify({ users: {} }), {
      status: 200, headers: { "content-type": "application/json" }
    });
  }

  if (!r.ok) {
    return new Response(JSON.stringify({ error: "kv get failed" }), { status: 500 });
  }

  const { result } = await r.json(); // string | null
  const data = result ? JSON.parse(result) : { users: {} };
  return new Response(JSON.stringify(data), {
    status: 200, headers: { "content-type": "application/json" }
  });
}
