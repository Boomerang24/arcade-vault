// Motor de 2048 escrito desde cero (no hay game.js de referencia). El juego
// avanza por turnos: el estado solo cambia al pulsar una flecha. Este archivo
// arranca con la lógica pura del tablero (paso 1 de la spec 21); el canvas,
// los listeners y el ciclo de vida se añaden en pasos posteriores.
export type EngineStats = {
  score: number;
  lives: number;
  level: number;
  state: "playing" | "dead" | "gameover";
};
export type EngineCallbacks = {
  onStats: (stats: EngineStats) => void; // se invoca en cada frame
  onGameOver: (finalScore: number) => void; // se invoca una sola vez al entrar en "gameover"
};
export const SIZE = 4;
export type Direction = "up" | "down" | "left" | "right";
export type Cell = { row: number; col: number };
// `id` estable por ficha: permite animar cada una desde su celda previa a la
// nueva sin heurísticas de emparejamiento, incluso en fusiones (2 orígenes).
export type Tile = { id: number; value: number; row: number; col: number };
// Tablero como arreglo denso de 16 celdas (fila * SIZE + col), cada una `null`
// o con una ficha, tal como describe la sección Modelo de datos de la spec.
export type Board = (Tile | null)[];
export type SlideResult = {
  board: Board; // tablero resultante (fichas supervivientes ya en su celda destino)
  moved: boolean; // hubo desplazamiento o fusión -> turno válido
  gainedScore: number; // suma del valor de todas las fichas resultantes de fusión
  mergedIds: number[]; // ids de fichas supervivientes que absorbieron a otra (para el "pop")
  from: Map<number, Cell>; // id -> celda previa, para toda ficha existente antes del turno
  absorbed: { id: number; to: Cell }[]; // fichas eliminadas por fusión + su celda destino de viaje
};
export const idx = (row: number, col: number) => row * SIZE + col;
export function createEmptyBoard(): Board {
  return new Array(SIZE * SIZE).fill(null);
}
export function tilesOf(board: Board): Tile[] {
  return board.filter((t): t is Tile => t !== null);
}
export function maxTileValue(board: Board): number {
  let max = 0;
  for (const t of board) if (t && t.value > max) max = t.value;
  return max;
}
// 2 -> nivel 1, 4 -> 2, 8 -> 3, ... 2048 -> 11, y sigue subiendo. Nunca baja
// (la ficha máxima solo puede crecer). Con tablero vacío devuelve 1.
export function levelFromMaxTile(maxTile: number): number {
  if (maxTile < 2) return 1;
  return Math.log2(maxTile) - 1;
}
// Cada línea (fila o columna) devuelta en orden desde el borde de destino
// hacia el opuesto, que es como debe resolverse el deslizamiento.
function traversalLines(dir: Direction): Cell[][] {
  const lines: Cell[][] = [];
  for (let a = 0; a < SIZE; a++) {
    const line: Cell[] = [];
    for (let b = 0; b < SIZE; b++) {
      let row: number;
      let col: number;
      if (dir === "left") {
        row = a;
        col = b;
      } else if (dir === "right") {
        row = a;
        col = SIZE - 1 - b;
      } else if (dir === "up") {
        row = b;
        col = a;
      } else {
        row = SIZE - 1 - b;
        col = a;
      }
      line.push({ row, col });
    }
    lines.push(line);
  }
  return lines;
}
// Desliza todas las fichas hacia `dir`. No muta `board` ni sus fichas.
// Regla clásica: una ficha resultante de fusión no vuelve a fusionarse en el
// mismo turno (`4 4 4 4` -> `8 8 _ _`, nunca `16 _ _ _`).
export function slide(board: Board, dir: Direction): SlideResult {
  const from = new Map<number, Cell>();
  for (const t of board) if (t) from.set(t.id, { row: t.row, col: t.col });
  const next: Board = createEmptyBoard();
  const mergedIds: number[] = [];
  const absorbed: { id: number; to: Cell }[] = [];
  let gainedScore = 0;
  let moved = false;
  for (const line of traversalLines(dir)) {
    const existing: Tile[] = [];
    for (const cell of line) {
      const t = board[idx(cell.row, cell.col)];
      if (t) existing.push(t);
    }
    let slot = 0;
    let lastPlaced: Tile | null = null;
    let lastPlacedMerged = false;
    for (const tile of existing) {
      if (lastPlaced && !lastPlacedMerged && lastPlaced.value === tile.value) {
        const target = line[slot - 1];
        lastPlaced.value *= 2;
        lastPlaced.row = target.row;
        lastPlaced.col = target.col;
        lastPlacedMerged = true;
        mergedIds.push(lastPlaced.id);
        gainedScore += lastPlaced.value;
        absorbed.push({
          id: tile.id,
          to: { row: target.row, col: target.col },
        });
        moved = true;
        continue;
      }
      const dest = line[slot];
      const placed: Tile = {
        id: tile.id,
        value: tile.value,
        row: dest.row,
        col: dest.col,
      };
      next[idx(dest.row, dest.col)] = placed;
      const origin = from.get(tile.id);
      if (origin && (origin.row !== dest.row || origin.col !== dest.col)) {
        moved = true;
      }
      lastPlaced = placed;
      lastPlacedMerged = false;
      slot += 1;
    }
  }
  return { board: next, moved, gainedScore, mergedIds, from, absorbed };
}
// Coloca una ficha nueva (`2` al 90%, `4` al 10%) en una celda vacía al azar.
// `id` lo provee quien llama (el motor mantiene el contador). Devuelve la
// ficha creada o `null` si no había hueco. No muta `board`.
export function spawnTile(
  board: Board,
  id: number,
): { board: Board; tile: Tile | null } {
  const empties: number[] = [];
  for (let i = 0; i < board.length; i++) if (!board[i]) empties.push(i);
  if (empties.length === 0) return { board, tile: null };
  const cellIndex = empties[Math.floor(Math.random() * empties.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  const tile: Tile = {
    id,
    value,
    row: Math.floor(cellIndex / SIZE),
    col: cellIndex % SIZE,
  };
  const nextBoard = board.slice();
  nextBoard[cellIndex] = tile;
  return { board: nextBoard, tile };
}
// El tablero está bloqueado cuando no queda ninguna celda vacía Y no existe
// ningún par ortogonalmente adyacente con el mismo valor.
export function isBlocked(board: Board): boolean {
  for (const t of board) if (!t) return false;
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const v = board[idx(row, col)]!.value;
      if (col + 1 < SIZE && board[idx(row, col + 1)]!.value === v) return false;
      if (row + 1 < SIZE && board[idx(row + 1, col)]!.value === v) return false;
    }
  }
  return true;
}
// Tablero inicial: 2 fichas en celdas distintas, con la regla de aparición
// normal. Devuelve el tablero y el siguiente id libre.
export function createInitialBoard(startId = 1): {
  board: Board;
  nextId: number;
} {
  let board = createEmptyBoard();
  let nextId = startId;
  for (let i = 0; i < 2; i++) {
    const { board: b, tile } = spawnTile(board, nextId);
    board = b;
    if (tile) nextId += 1;
  }
  return { board, nextId };
}
