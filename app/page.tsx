import { getGames } from "@/lib/games";
import { HomeClient } from "@/components/home-client";
export default async function Home() {
  const games = await getGames();
  return <HomeClient games={games} />;
}
