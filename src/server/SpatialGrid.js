// ===========================================================================
// SpatialGrid.js — uniform-grid spatial hash for O(1) neighbor queries.
//
// Used for two things in the simulation:
//   1) body-point collision queries (head-vs-bodies)
//   2) food proximity queries       (head-vs-food)
//
// It is rebuilt every tick from scratch (cheap) because entities move a lot.
// Items are stored by integer cell key = cx * 73856093 ^ cy * 19349663, with a
// Map<key, item[]> for fast inserts and queries.
// ===========================================================================

export class SpatialGrid {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.map = new Map();
  }

  _key(cx, cy) {
    // Mix into a single integer key. We bias to positive coordinates by adding
    // a large offset to keep XOR results stable / hashable.
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  _cell(x, y) {
    return [Math.floor(x / this.cellSize), Math.floor(y / this.cellSize)];
  }

  clear() {
    this.map.clear();
  }

  insert(item) {
    // item must expose x, y. We store the reference directly.
    const [cx, cy] = this._cell(item.x, item.y);
    const k = this._key(cx, cy);
    let bucket = this.map.get(k);
    if (!bucket) { bucket = []; this.map.set(k, bucket); }
    bucket.push(item);
  }

  // Call fn(item) for every item in cells overlapping the circle (x,y,r).
  // fn may return true to stop early.
  queryCircle(x, y, r, fn) {
    const minx = Math.floor((x - r) / this.cellSize);
    const maxx = Math.floor((x + r) / this.cellSize);
    const miny = Math.floor((y - r) / this.cellSize);
    const maxy = Math.floor((y + r) / this.cellSize);
    for (let cx = minx; cx <= maxx; cx++) {
      for (let cy = miny; cy <= maxy; cy++) {
        const bucket = this.map.get(this._key(cx, cy));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          if (fn(bucket[i])) return;
        }
      }
    }
  }
}

export default SpatialGrid;
