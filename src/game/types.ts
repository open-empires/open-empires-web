export type Vec2 = {
  x: number;
  y: number;
};

export type Terrain = "land" | "water";

export type Tile = {
  terrain: Terrain;
  elevation: number;
};

export type Unit = {
  id: string;
  name: string;
  pos: Vec2;
  target: Vec2 | null;
  hp: number;
  maxHp: number;
  attack: number;
  armor: number;
  speed: number;
  radiusPx: number;
};

export type Camera = {
  x: number;
  y: number;
};
