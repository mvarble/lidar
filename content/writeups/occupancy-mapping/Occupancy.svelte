<script>
    import { palette } from '@mvarble/mesearch/palette';

    // A sensor drives along a room 20 m by 15 m, scanning 360 rays at each of
    // 40 positions, while a pedestrian walks across. Each ray is traced through
    // a grid of 0.25 m cells by voxel traversal, and the cells' log-odds of
    // occupancy are updated: free along the ray, occupied where it ends.
    const width = 20;
    const height = 15;
    const cell = 0.25;
    const cols = width / cell;
    const rows = height / cell;
    const steps = 40;
    const rays = 360;
    const maxRange = 12;
    const [lFree, lOcc, lMax] = [-0.4, 0.85, 3.5];

    // Walls as segments: the room, with a doorway, and two pillars.
    const box = (x0, y0, x1, y1) => [
        [x0, y0, x1, y0],
        [x1, y0, x1, y1],
        [x1, y1, x0, y1],
        [x0, y1, x0, y0],
    ];
    const walls = [
        [0.5, 0.5, 19.5, 0.5],
        [19.5, 0.5, 19.5, 14.5],
        [19.5, 14.5, 12, 14.5],
        [10, 14.5, 0.5, 14.5],
        [0.5, 14.5, 0.5, 0.5],
        ...box(5, 7, 7, 9),
        ...box(13, 9, 14, 12),
        [8, 11, 11, 11],
    ];
    const sensorAt = (k) => [
        2 + (16 * k) / (steps - 1),
        3 + 2.5 * Math.sin((Math.PI * k) / (steps - 1)),
    ];
    const walkerAt = (k) => [9 + (3 * k) / (steps - 1), 13 - (6 * k) / (steps - 1)];

    // Distance along a unit ray to a segment or a circle, or Infinity.
    function toSegment([ox, oy], [dx, dy], [x0, y0, x1, y1]) {
        const [ex, ey] = [x1 - x0, y1 - y0];
        const det = dx * -ey - dy * -ex;
        if (Math.abs(det) < 1e-12) return Infinity;
        const [rx, ry] = [x0 - ox, y0 - oy];
        const t = (rx * -ey - ry * -ex) / det;
        const u = (dx * ry - dy * rx) / det;
        return t > 0 && u >= 0 && u <= 1 ? t : Infinity;
    }
    function toCircle([ox, oy], [dx, dy], [cx, cy], r) {
        const [fx, fy] = [ox - cx, oy - cy];
        const b = fx * dx + fy * dy;
        const disc = b * b - (fx * fx + fy * fy - r * r);
        if (disc < 0) return Infinity;
        const t = -b - Math.sqrt(disc);
        return t > 0 ? t : Infinity;
    }

    // Integrate scans 0..k-1 into a fresh grid of log-odds.
    function integrate(k) {
        const grid = new Float32Array(cols * rows);
        const seen = new Uint8Array(cols * rows);
        const update = (i, j, l) => {
            if (i < 0 || j < 0 || i >= cols || j >= rows) return;
            const idx = j * cols + i;
            grid[idx] = Math.max(-lMax, Math.min(lMax, grid[idx] + l));
            seen[idx] = 1;
        };
        for (let s = 0; s < k; s++) {
            const o = sensorAt(s);
            const walker = walkerAt(s);
            for (let r = 0; r < rays; r++) {
                const a = (2 * Math.PI * r) / rays;
                const d = [Math.cos(a), Math.sin(a)];
                let t = Math.min(
                    ...walls.map((w) => toSegment(o, d, w)),
                    toCircle(o, d, walker, 0.3),
                );
                const hit = t <= maxRange;
                t = Math.min(t, maxRange);
                // Amanatides-Woo traversal from the sensor's cell to the end's.
                let [i, j] = [Math.floor(o[0] / cell), Math.floor(o[1] / cell)];
                const [iEnd, jEnd] = [
                    Math.floor((o[0] + t * d[0]) / cell),
                    Math.floor((o[1] + t * d[1]) / cell),
                ];
                const stepI = d[0] > 0 ? 1 : -1;
                const stepJ = d[1] > 0 ? 1 : -1;
                const next = (p, dir, idx, step) =>
                    Math.abs(dir) < 1e-12
                        ? Infinity
                        : ((idx + (step > 0 ? 1 : 0)) * cell - p) / dir;
                let tMaxI = next(o[0], d[0], i, stepI);
                let tMaxJ = next(o[1], d[1], j, stepJ);
                const tDeltaI = Math.abs(cell / d[0]);
                const tDeltaJ = Math.abs(cell / d[1]);
                while (!(i === iEnd && j === jEnd)) {
                    update(i, j, lFree);
                    if (tMaxI < tMaxJ) {
                        i += stepI;
                        tMaxI += tDeltaI;
                    } else {
                        j += stepJ;
                        tMaxJ += tDeltaJ;
                    }
                    if (Math.min(tMaxI, tMaxJ) > t + 2 * cell) break;
                }
                update(iEnd, jEnd, hit ? lOcc : lFree);
            }
        }
        return { grid, seen };
    }

    let scans = $state(1);
    let canvas;

    $effect(() => {
        const { grid, seen } = integrate(scans);
        const ctx = canvas.getContext('2d');
        const px = canvas.width / cols;
        ctx.globalAlpha = 1;
        ctx.fillStyle = palette.paperSunken;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                const idx = j * cols + i;
                if (!seen[idx]) continue;
                const p = 1 / (1 + Math.exp(-grid[idx]));
                ctx.globalAlpha = Math.abs(2 * p - 1);
                ctx.fillStyle = p > 0.5 ? palette.ink : palette.paperRaised;
                ctx.fillRect(i * px, (rows - 1 - j) * px, px + 0.5, px + 0.5);
            }
        }
        ctx.globalAlpha = 1;
        const at = ([x, y]) => [(x / cell) * px, (rows - y / cell) * px];
        ctx.strokeStyle = palette.series[0];
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let s = 0; s < scans; s++) {
            const [u, v] = at(sensorAt(s));
            if (s) ctx.lineTo(u, v);
            else ctx.moveTo(u, v);
        }
        ctx.stroke();
        const [su, sv] = at(sensorAt(scans - 1));
        ctx.fillStyle = palette.series[0];
        ctx.beginPath();
        ctx.arc(su, sv, 6, 0, 2 * Math.PI);
        ctx.fill();
        const [wu, wv] = at(walkerAt(scans - 1));
        ctx.strokeStyle = palette.series[1];
        ctx.beginPath();
        ctx.arc(wu, wv, (0.3 / cell) * px + 3, 0, 2 * Math.PI);
        ctx.stroke();
    });
</script>

<figure>
    <label>
        Scans integrated: {scans} of {steps}
        <input type="range" min="1" max={steps} step="1" bind:value={scans} />
    </label>
    <canvas
        bind:this={canvas}
        width="800"
        height="600"
        aria-label="An occupancy grid built from simulated 2D scans"
    ></canvas>
    <figcaption>
        An occupancy grid built as a sensor (filled circle, with its path) drives through a room
        with a doorway, two pillars and a partition, while a pedestrian (ringed) walks across.
        Unknown cells are shaded, free cells pale and occupied cells dark, more strongly the more
        certain they are. The space behind each obstacle stays unknown until it is seen from
        elsewhere. The pedestrian leaves no lasting trail, since each cell it occupied is later
        observed free and its log-odds fall again; for the same reason it shows only faintly where
        it now stands, in cells that earlier scans saw as free many times.
    </figcaption>
</figure>

<style>
    figure {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    label {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        font-family: var(--font-ui);
        font-size: var(--font-size-ui);
        color: var(--muted);
    }
    input {
        flex: 1;
        max-width: 280px;
    }
    canvas {
        width: 100%;
        max-width: 600px;
        align-self: center;
        border: 1px solid var(--rule);
    }
</style>
