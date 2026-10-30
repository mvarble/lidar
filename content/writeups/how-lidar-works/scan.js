// A toy spinning LiDAR, 1.8 m above flat ground, in a street with two cars, a
// pedestrian, a pole and the front of a building. Every beam is cast against
// the scene and the nearest hit is kept, as a sensor reporting one return would.

export const height = 1.8;
export const maxRange = 60;

// Axis-aligned boxes, [xmin, xmax, ymin, ymax, zmin, zmax], in the sensor's
// frame: x forward, y left, z up, with the ground at z = -height.
export const objects = [
    { name: 'car', box: [6, 10.5, -4.5, -2.7, -1.8, -0.3] },
    { name: 'car', box: [-12, -7.5, 3, 4.8, -1.8, -0.2] },
    { name: 'pedestrian', box: [12, 12.5, 2, 2.6, -1.8, -0.05] },
    { name: 'pole', box: [3, 3.3, 3, 3.3, -1.8, 4] },
    { name: 'building', box: [22, 26, -30, 8, -1.8, 9] },
];

// The distance along a unit ray from the origin to an axis-aligned box, by
// the slab method, or Infinity if it misses.
function hitBox(d, [x0, x1, y0, y1, z0, z1]) {
    let near = 0;
    let far = Infinity;
    for (const [dir, lo, hi] of [
        [d[0], x0, x1],
        [d[1], y0, y1],
        [d[2], z0, z1],
    ]) {
        if (Math.abs(dir) < 1e-12) {
            if (lo > 0 || hi < 0) return Infinity;
            continue;
        }
        let t0 = lo / dir;
        let t1 = hi / dir;
        if (t0 > t1) [t0, t1] = [t1, t0];
        near = Math.max(near, t0);
        far = Math.min(far, t1);
        if (near > far) return Infinity;
    }
    return near;
}

// Scan the scene with `beams` lasers spread evenly over ±22.5° of elevation
// and `columns` firings per revolution. Returns the range image, row 0 being
// the highest beam, with each pixel's range (0 for no return) and what it hit
// (-1 for the ground, else an index into `objects`), and the hits as points.
export function scan(beams, columns) {
    const range = new Float32Array(beams * columns);
    const label = new Int8Array(beams * columns);
    const points = [];
    for (let row = 0; row < beams; row++) {
        const elevation = ((22.5 - (45 * row) / (beams - 1)) * Math.PI) / 180;
        for (let col = 0; col < columns; col++) {
            const azimuth = Math.PI - (2 * Math.PI * col) / columns;
            const d = [
                Math.cos(elevation) * Math.cos(azimuth),
                Math.cos(elevation) * Math.sin(azimuth),
                Math.sin(elevation),
            ];
            let best = d[2] < 0 ? -height / d[2] : Infinity;
            let what = -1;
            objects.forEach(({ box }, i) => {
                const t = hitBox(d, box);
                if (t < best) {
                    best = t;
                    what = i;
                }
            });
            const pixel = row * columns + col;
            if (best <= maxRange) {
                range[pixel] = best;
                label[pixel] = what;
                points.push({ x: best * d[0], y: best * d[1], z: best * d[2], label: what });
            }
        }
    }
    return { range, label, points };
}
