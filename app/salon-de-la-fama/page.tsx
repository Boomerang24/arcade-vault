import { getGames } from "@/lib/games";
import { getAllTopScores } from "@/lib/scores";
import { SalonClient } from "@/components/salon-client";
export default async function SalonDeLaFamaPage() {
  const [games, scoresByGame] = await Promise.all([
    getGames(),
    getAllTopScores(12),
  ]);
  return <SalonClient games={games} scoresByGame={scoresByGame} />;
}
