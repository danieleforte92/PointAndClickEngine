import type { Polygon2, Vector2 } from "@pointclick/contracts";

export interface NavigationGrid {
  cellSize: number;
  height: number;
  origin: Vector2;
  walkable: boolean[];
  width: number;
}

export interface GridCell {
  x: number;
  y: number;
}

export interface MovementPlan {
  goal: Vector2;
  nextWaypointIndex: number;
  path: GridCell[];
  position: Vector2;
  sceneId: string;
  start: Vector2;
  waypoints: Vector2[];
}

export interface PathProgress {
  /** Public presentation status; movement is never part of WorldState. */
  status: "walking";
  sceneId: string;
  waypointIndex: number;
  ratio: number;
  completedWaypoints: number;
  currentWaypointIndex: number | null;
  goal: Vector2;
  path: GridCell[];
  position: Vector2;
  totalWaypoints: number;
  waypoints: Vector2[];
}

export interface NavigationResolution {
  goal: Vector2;
  goalCell: GridCell;
  path: GridCell[];
  startCell: GridCell;
  waypoints: Vector2[];
}

export const DEFAULT_NAVIGATION_CELL_SIZE = 24;
const epsilon = 1e-6;
const neighborOffsets: ReadonlyArray<GridCell> = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
  { x: 1, y: -1 }
];

function pointOnSegment(point: Vector2, start: Vector2, end: Vector2): boolean {
  const cross =
    (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > epsilon) return false;

  const dot =
    (point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y);
  if (dot < -epsilon) return false;

  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  return dot <= lengthSquared + epsilon;
}

function distanceSquared(left: Vector2, right: Vector2): number {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2;
}

function cellIndex(grid: NavigationGrid, cell: GridCell): number {
  return cell.y * grid.width + cell.x;
}

function inBounds(grid: NavigationGrid, cell: GridCell): boolean {
  return cell.x >= 0 && cell.x < grid.width && cell.y >= 0 && cell.y < grid.height;
}

function isWalkable(grid: NavigationGrid, cell: GridCell): boolean {
  return inBounds(grid, cell) && grid.walkable[cellIndex(grid, cell)] === true;
}

function isValidCellSize(cellSize: number): boolean {
  return Number.isFinite(cellSize) && cellSize > 0;
}

function navigationGridSignature(polygon: Polygon2, cellSize: number): string {
  return JSON.stringify([
    cellSize,
    polygon.points.map((point) => [point.x, point.y])
  ]);
}

export class NavigationGridCache {
  private readonly entries = new Map<
    string,
    { grid: NavigationGrid | null; signature: string }
  >();

  private builds = 0;

  get(sceneId: string, polygon: Polygon2, cellSize = DEFAULT_NAVIGATION_CELL_SIZE): NavigationGrid | null {
    const signature = navigationGridSignature(polygon, cellSize);
    const cached = this.entries.get(sceneId);
    if (cached?.signature === signature) {
      return cached.grid;
    }

    const grid = createNavigationGrid(polygon, cellSize);
    this.entries.set(sceneId, { grid, signature });
    this.builds += 1;
    return grid;
  }

  invalidate(sceneId?: string): void {
    if (sceneId === undefined) {
      this.entries.clear();
      return;
    }
    this.entries.delete(sceneId);
  }

  clear(): void {
    this.entries.clear();
  }

  has(sceneId: string): boolean {
    return this.entries.has(sceneId);
  }

  get size(): number {
    return this.entries.size;
  }

  get buildCount(): number {
    return this.builds;
  }
}

export function createNavigationGridCache(): NavigationGridCache {
  return new NavigationGridCache();
}

export function polygonBounds(polygon: Polygon2) {
  const xs = polygon.points.map((point) => point.x);
  const ys = polygon.points.map((point) => point.y);
  return {
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
    minX: Math.min(...xs),
    minY: Math.min(...ys)
  };
}

export function polygonArea(polygon: Polygon2): number {
  let total = 0;
  for (let index = 0; index < polygon.points.length; index += 1) {
    const current = polygon.points[index]!;
    const next = polygon.points[(index + 1) % polygon.points.length]!;
    total += current.x * next.y - next.x * current.y;
  }
  return Math.abs(total) / 2;
}

export function isDegeneratePolygon(polygon: Polygon2): boolean {
  return polygon.points.length < 3 || polygonArea(polygon) <= epsilon;
}

export function pointInPolygon(point: Vector2, polygon: Polygon2): boolean {
  let inside = false;
  for (
    let currentIndex = 0, previousIndex = polygon.points.length - 1;
    currentIndex < polygon.points.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const current = polygon.points[currentIndex]!;
    const previous = polygon.points[previousIndex]!;

    if (pointOnSegment(point, previous, current)) {
      return true;
    }

    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;

    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

export function closestPointOnSegment(point: Vector2, start: Vector2, end: Vector2): Vector2 {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX ** 2 + deltaY ** 2;
  if (lengthSquared <= epsilon) return { ...start };

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared)
  );

  return {
    x: start.x + deltaX * t,
    y: start.y + deltaY * t
  };
}

export function closestPointOnPolygon(point: Vector2, polygon: Polygon2): Vector2 {
  let closest = polygon.points[0] ?? point;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < polygon.points.length; index += 1) {
    const start = polygon.points[index]!;
    const end = polygon.points[(index + 1) % polygon.points.length]!;
    const candidate = closestPointOnSegment(point, start, end);
    const candidateDistance = distanceSquared(point, candidate);
    if (candidateDistance < closestDistance) {
      closest = candidate;
      closestDistance = candidateDistance;
    }
  }

  return { ...closest };
}

export function createNavigationGrid(
  polygon: Polygon2,
  cellSize = DEFAULT_NAVIGATION_CELL_SIZE
): NavigationGrid | null {
  if (isDegeneratePolygon(polygon) || !isValidCellSize(cellSize)) return null;

  const bounds = polygonBounds(polygon);
  const width = Math.max(1, Math.floor((bounds.maxX - bounds.minX) / cellSize) + 1);
  const height = Math.max(1, Math.floor((bounds.maxY - bounds.minY) / cellSize) + 1);
  const origin = { x: bounds.minX, y: bounds.minY };
  const walkable = new Array<boolean>(width * height).fill(false);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const center = cellCenter({ cellSize, height, origin, walkable, width }, { x, y });
      walkable[y * width + x] = pointInPolygon(center, polygon);
    }
  }

  return { cellSize, height, origin, walkable, width };
}

export function cellCenter(grid: NavigationGrid, cell: GridCell): Vector2 {
  return {
    x: grid.origin.x + cell.x * grid.cellSize,
    y: grid.origin.y + cell.y * grid.cellSize
  };
}

export function nearestWalkableCell(grid: NavigationGrid, point: Vector2): GridCell | null {
  let closest: GridCell | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const candidate = { x, y };
      if (!isWalkable(grid, candidate)) continue;

      const center = cellCenter(grid, candidate);
      const candidateDistance = distanceSquared(point, center);
      if (candidateDistance < closestDistance) {
        closest = candidate;
        closestDistance = candidateDistance;
      }
    }
  }

  return closest;
}

function movementCost(offset: GridCell): number {
  return offset.x !== 0 && offset.y !== 0 ? Math.SQRT2 : 1;
}

function heuristic(left: GridCell, right: GridCell): number {
  const dx = Math.abs(left.x - right.x);
  const dy = Math.abs(left.y - right.y);
  const diagonal = Math.min(dx, dy);
  const straight = Math.max(dx, dy) - diagonal;
  return diagonal * Math.SQRT2 + straight;
}

function canTraverse(grid: NavigationGrid, current: GridCell, offset: GridCell): boolean {
  const neighbor = { x: current.x + offset.x, y: current.y + offset.y };
  if (!isWalkable(grid, neighbor)) return false;

  if (offset.x === 0 || offset.y === 0) return true;

  return (
    isWalkable(grid, { x: current.x + offset.x, y: current.y }) &&
    isWalkable(grid, { x: current.x, y: current.y + offset.y })
  );
}

export function findPath(grid: NavigationGrid, start: GridCell, goal: GridCell): GridCell[] | null {
  if (!isWalkable(grid, start) || !isWalkable(grid, goal)) return null;

  const open: GridCell[] = [start];
  const openSet = new Set([cellIndex(grid, start)]);
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>([[cellIndex(grid, start), 0]]);
  const fScore = new Map<number, number>([[cellIndex(grid, start), heuristic(start, goal)]]);

  while (open.length > 0) {
    open.sort((left, right) => {
      const leftIndex = cellIndex(grid, left);
      const rightIndex = cellIndex(grid, right);
      const leftScore = fScore.get(leftIndex) ?? Number.POSITIVE_INFINITY;
      const rightScore = fScore.get(rightIndex) ?? Number.POSITIVE_INFINITY;
      if (leftScore !== rightScore) return leftScore - rightScore;
      if (left.y !== right.y) return left.y - right.y;
      return left.x - right.x;
    });

    const current = open.shift()!;
    const currentIndex = cellIndex(grid, current);
    openSet.delete(currentIndex);

    if (current.x === goal.x && current.y === goal.y) {
      const path: GridCell[] = [current];
      let cursor = currentIndex;
      while (cameFrom.has(cursor)) {
        cursor = cameFrom.get(cursor)!;
        path.push({ x: cursor % grid.width, y: Math.floor(cursor / grid.width) });
      }
      return path.reverse();
    }

    for (const offset of neighborOffsets) {
      const neighbor = { x: current.x + offset.x, y: current.y + offset.y };
      if (!canTraverse(grid, current, offset)) continue;

      const neighborIndex = cellIndex(grid, neighbor);
      const tentative = (gScore.get(currentIndex) ?? Number.POSITIVE_INFINITY) + movementCost(offset);
      if (tentative >= (gScore.get(neighborIndex) ?? Number.POSITIVE_INFINITY)) {
        continue;
      }

      cameFrom.set(neighborIndex, currentIndex);
      gScore.set(neighborIndex, tentative);
      fScore.set(neighborIndex, tentative + heuristic(neighbor, goal));

      if (!openSet.has(neighborIndex)) {
        open.push(neighbor);
        openSet.add(neighborIndex);
      }
    }
  }

  return null;
}

function pathWaypoints(grid: NavigationGrid, path: readonly GridCell[], goal: Vector2): Vector2[] {
  const waypoints = path.slice(1).map((cell) => cellCenter(grid, cell));
  if (waypoints.length === 0) {
    return [{ ...goal }];
  }

  waypoints[waypoints.length - 1] = { ...goal };
  return waypoints;
}

export function resolveWalkTargetOnGrid(
  grid: NavigationGrid,
  polygon: Polygon2,
  start: Vector2,
  target: Vector2
): NavigationResolution | null {
  const goal = pointInPolygon(target, polygon) ? { ...target } : closestPointOnPolygon(target, polygon);
  const startCell = nearestWalkableCell(grid, start);
  const goalCell = nearestWalkableCell(grid, goal);
  if (!startCell || !goalCell) return null;

  const path = findPath(grid, startCell, goalCell);
  if (!path) return null;

  return {
    goal,
    goalCell,
    path,
    startCell,
    waypoints: pathWaypoints(grid, path, goal)
  };
}

export function resolveWalkTarget(
  polygon: Polygon2,
  start: Vector2,
  target: Vector2,
  cellSize = DEFAULT_NAVIGATION_CELL_SIZE
): NavigationResolution | null {
  const grid = createNavigationGrid(polygon, cellSize);
  if (!grid) return null;
  return resolveWalkTargetOnGrid(grid, polygon, start, target);
}
