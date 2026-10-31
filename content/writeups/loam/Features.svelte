<script>
    // LOAM's feature selection on one simulated scan line. A sensor at the
    // origin sweeps a beam over a room corner with a box in front of it, one
    // point every half degree. Each point's smoothness c is computed from five
    // neighbours on each side; the line is split into four subregions, each
    // giving at most two edge points (largest c) and four planar points
    // (smallest c), and the reliability checks reject points on surfaces nearly
    // parallel to the beam and on the far side of an occlusion.
    const walls = [
        [-9, 6, 4, 6],
        [4, 6, 4, -3],
        [-1.6, 2.4, -0.2, 2.4],
        [-0.2, 2.4, -0.2, 3.4],
        [-0.2, 3.4, -1.6, 3.4],
        [-1.6, 3.4, -1.6, 2.4],
    ];
    function cast(a) {
        const [dx, dy] = [Math.cos(a), Math.sin(a)];
        let best = Infinity;
        for (const [x0, y0, x1, y1] of walls) {
            const [ex, ey] = [x1 - x0, y1 - y0];
            const det = -dx * ey + dy * ex;
            if (Math.abs(det) < 1e-12) continue;
            const t = (-x0 * ey + y0 * ex) / det;
            const u = (dx * y0 - dy * x0) / det;
            if (t > 0 && u >= 0 && u <= 1) best = Math.min(best, t);
        }
        return [best * dx, best * dy];
    }
    const points = [];
    for (let deg = -30; deg <= 150; deg += 0.5) {
        const p = cast((deg * Math.PI) / 180);
        if (Number.isFinite(p[0])) points.push(p);
    }
    const n = points.length;
    const half = 5;
    const norm = ([x, y]) => Math.hypot(x, y);

    // Equation (1) of the paper.
    const c = points.map((p, i) => {
        if (i < half || i >= n - half) return null;
        let [sx, sy] = [0, 0];
        for (let j = i - half; j <= i + half; j++) {
            sx += p[0] - points[j][0];
            sy += p[1] - points[j][1];
        }
        return Math.hypot(sx, sy) / (2 * half * norm(p));
    });

    // The reliability checks.
    const unreliable = points.map((p, i) => {
        if (c[i] === null) return null;
        // On a surface nearly parallel to the beam: the local surface direction
        // makes a small angle with the line of sight.
        const [a, b] = [points[i - 1], points[i + 1]];
        const [tx, ty] = [b[0] - a[0], b[1] - a[1]];
        const cos = Math.abs(tx * p[0] + ty * p[1]) / (Math.hypot(tx, ty) * norm(p));
        if (cos > Math.cos((15 * Math.PI) / 180)) return 'parallel';
        // On the far side of an occlusion: between this point and a neighbour
        // there is a jump much larger than the spacing of a continuous surface,
        // and the point across the jump is nearer the sensor.
        for (let j = i - half; j < i + half; j++) {
            const gap = Math.hypot(
                points[j + 1][0] - points[j][0],
                points[j + 1][1] - points[j][1],
            );
            if (gap < 0.5) continue;
            const across = j < i ? points[j] : points[j + 1];
            if (norm(across) < norm(p)) return 'occluded';
        }
        return null;
    });

    let checks = $state(true);
    let selection = $derived.by(() => {
        const label = new Array(n).fill(null);
        const taken = new Array(n).fill(false);
        const take = (i, kind) => {
            label[i] = kind;
            for (let j = i - half; j <= i + half; j++) if (j >= 0 && j < n) taken[j] = true;
        };
        const bounds = [0, 1, 2, 3, 4].map((k) => Math.round((k * n) / 4));
        for (let r = 0; r < 4; r++) {
            const idx = [];
            for (let i = bounds[r]; i < bounds[r + 1]; i++) if (c[i] !== null) idx.push(i);
            idx.sort((a, b) => c[b] - c[a]);
            let edges = 0;
            for (const i of idx) {
                if (edges === 2 || c[i] < 0.005) break;
                if (taken[i] || (checks && unreliable[i])) continue;
                take(i, 'edge');
                edges++;
            }
            let planes = 0;
            for (const i of [...idx].reverse()) {
                if (planes === 4 || c[i] > 0.001) break;
                if (taken[i] || (checks && unreliable[i])) continue;
                take(i, 'planar');
                planes++;
            }
        }
        return label;
    });

    const X = (x) => 230 + 26 * x;
    const Y = (y) => 190 - 26 * y;
</script>

<figure>
    <label class="toggle">
        <input type="checkbox" bind:checked={checks} />
        apply the reliability checks
    </label>
    <svg
        viewBox="0 0 360 290"
        role="img"
        aria-label="LOAM feature selection on a simulated scan line"
    >
        {#each walls as [x0, y0, x1, y1], i (i)}
            <line x1={X(x0)} y1={Y(y0)} x2={X(x1)} y2={Y(y1)} class="wall" />
        {/each}
        {#each points as p, i (i)}
            {#if checks && unreliable[i]}
                <circle cx={X(p[0])} cy={Y(p[1])} r="4.5" class="rejected" />
            {/if}
            <circle
                cx={X(p[0])}
                cy={Y(p[1])}
                r={selection[i] ? 4 : 1.6}
                class={selection[i] ?? 'point'}
            />
        {/each}
        <path d="M{X(0)},{Y(0)} m-6,6 l6,-12 l6,12 z" class="sensor" />
    </svg>
    <ul class="legend">
        <li><span class="dot edge"></span>edge point (largest c)</li>
        <li><span class="dot planar"></span>planar point (smallest c)</li>
        <li><span class="ring"></span>rejected as unreliable</li>
    </ul>
    <figcaption>
        One simulated scan line, a point every half degree, over the corner of a room with a box in
        front of the far wall. With the checks on, points where the wall runs nearly along the beam
        and points just beyond the box's shadow, whose apparent "edge" is only an occlusion boundary
        that would move if the sensor moved, are ruled out, and the edge points fall on the real
        corners. Turn the checks off to see the occlusion boundaries chosen instead. The scan is
        split into four subregions, so the planar points are spread along the line rather than
        clustered on the flattest stretch.
    </figcaption>
</figure>

<style>
    figure {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .toggle {
        font-family: var(--font-ui);
        font-size: var(--font-size-ui);
        color: var(--muted);
    }
    svg {
        width: 100%;
        max-width: 520px;
        align-self: center;
        background: var(--paper-raised);
        border: 1px solid var(--rule);
    }
    .wall {
        stroke: var(--rule-strong);
        stroke-width: 2;
    }
    .point {
        fill: var(--muted);
    }
    .edge {
        fill: var(--series-2);
    }
    .planar {
        fill: var(--series-1);
    }
    .rejected {
        fill: none;
        stroke: var(--faint);
        stroke-width: 1;
    }
    .sensor {
        fill: var(--ink);
    }
    .legend {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.4rem 1.2rem;
        list-style: none;
        padding: 0;
        margin: 0;
        font-family: var(--font-ui);
        font-size: var(--font-size-ui);
        color: var(--muted);
    }
    .dot,
    .ring {
        display: inline-block;
        width: 0.6rem;
        height: 0.6rem;
        margin-right: 0.4rem;
        border-radius: 50%;
    }
    .dot.edge {
        background: var(--series-2);
    }
    .dot.planar {
        background: var(--series-1);
    }
    .ring {
        border: 1px solid var(--faint);
    }
</style>
