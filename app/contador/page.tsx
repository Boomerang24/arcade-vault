"use client";
import { useState } from "react";
const POKEDEX_SIZE = 151;
function pokemonIdFor(count: number) {
  return ((count - 1) % POKEDEX_SIZE) + 1;
}
export default function Contador() {
  const [count, setCount] = useState(1);
  const pokemonId = pokemonIdFor(count);
  const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`;
  return (
    <div
      className="fade-in"
      style={{ padding: "60px 24px", textAlign: "center" }}
    >
      <div className="kicker pixel neon-cyan">▸ CONTADOR</div>
      <h1 className="pixel" style={{ fontSize: 28, margin: "16px 0 40px" }}>
        CONTADOR POKÉMON
      </h1>
      <div
        className="card"
        style={{
          maxWidth: 320,
          margin: "0 auto",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        <img
          key={pokemonId}
          src={spriteUrl}
          alt={`Pokémon #${pokemonId}`}
          width={200}
          height={200}
          style={{ imageRendering: "pixelated" }}
        />
        <div className="pixel neon-yellow" style={{ fontSize: 40 }}>
          {count}
        </div>
        <button
          className="btn xl press"
          type="button"
          onClick={() => setCount((c) => c + 1)}
        >
          ▶ CONTAR
        </button>
      </div>
    </div>
  );
}
