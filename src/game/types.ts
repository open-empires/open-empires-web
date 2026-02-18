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
  pos: Vec2;
  target: Vec2 | null;
  speed: number;
  radiusPx: number;
};

export type Camera = {
  x: number;
  y: number;
};
