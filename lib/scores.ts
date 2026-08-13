import { createClient } from "@/lib/supabase/server";
export type ScoreRow = {
  id: string;
  gameId: string;
  name: string;
  score: number;
  createdAt: string;
};
export async function getTopScores(
  gameId: string,
  limit = 10,
): Promise<ScoreRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    gameId: row.game_id,
    name: row.name,
    score: row.score,
    createdAt: row.created_at,
  }));
}
export async function getAllTopScores(
  limit = 12,
): Promise<Record<string, ScoreRow[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .order("score", { ascending: false });
  if (error) throw error;
  const byGame: Record<string, ScoreRow[]> = {};
  for (const row of data ?? []) {
    const list = (byGame[row.game_id] ??= []);
    if (list.length < limit) {
      list.push({
        id: row.id,
        gameId: row.game_id,
        name: row.name,
        score: row.score,
        createdAt: row.created_at,
      });
    }
  }
  return byGame;
}
