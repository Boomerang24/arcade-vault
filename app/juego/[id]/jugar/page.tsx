import { notFound } from "next/navigation";
import { getGame } from "@/lib/games";
import { JugarClient } from "@/components/jugar-client";
export default async function GamePlayerPage({
  params,
}: PageProps<"/juego/[id]/jugar">) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();
  return <JugarClient game={game} />;
}
