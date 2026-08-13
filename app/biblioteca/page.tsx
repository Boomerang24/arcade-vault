import { getGames } from "@/lib/games";
import { BibliotecaClient } from "@/components/biblioteca-client";
export default async function Biblioteca() {
  const games = await getGames();
  return <BibliotecaClient games={games} />;
}
