<script>
    // Normals estimated by PCA on a noisy 2D scan of a corner and a round
    // pillar, for a neighbourhood radius the reader chooses. Each point is
    // coloured by its surface variation, the share of its smallest eigenvalue.
    let seed = 3;
    const random = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    const gauss = () =>
        Math.sqrt(-2 * Math.log(random() + 1e-12)) * Math.cos(2 * Math.PI * random());
    const noise = 0.03;

    const points = [];
    // An L-shaped wall: along y = 0 for x in [0, 4], then up x = 4 to y = 3.
    for (let s = 0; s <= 7; s += 0.06) {
        const [x, y] = s <= 4 ? [s, 0] : [4, s - 4];
        points.push([x + noise * gauss(), y + noise * gauss()]);
    }
    // A pillar of radius 0.5 centred at (1.6, 1.8), seen all round.
    for (let a = 0; a < 2 * Math.PI; a += 0.12) {
        points.push([
            1.6 + 0.5 * Math.cos(a) + noise * gauss(),
            1.8 + 0.5 * Math.sin(a) + noise * gauss(),
        ]);
    }

    function normals(radius) {
        return points.map((p) => {
            const near = points.filter(
                (q) => (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 <= radius * radius,
            );
            const cx = near.reduce((s, q) => s + q[0], 0) / near.length;
            const cy = near.reduce((s, q) => s + q[1], 0) / near.length;
            let a = 0;
            let b = 0;
            let c = 0;
            for (const q of near) {
                a += (q[0] - cx) ** 2;
                b += (q[0] - cx) * (q[1] - cy);
                c += (q[1] - cy) ** 2;
            }
            // Eigen-decomposition of the 2x2 covariance [[a, b], [b, c]].
            const mean = (a + c) / 2;
            const spread = Math.sqrt(((a - c) / 2) ** 2 + b * b);
            const small = mean - spread;
            const large = mean + spread;
            // The eigenvector of the smaller eigenvalue is the normal.
            let n = Math.abs(b) > 1e-12 ? [b, small - a] : a < c ? [1, 0] : [0, 1];
            const len = Math.hypot(n[0], n[1]);
            n = [n[0] / len, n[1] / len];
            const variation = large + small > 0 ? small / (large + small) : 0;
            return { p, n, variation };
        });
    }

    let radius = $state(0.25);
    let estimates = $derived(normals(radius));

    // Scene coordinates to the SVG's.
    const scale = 90;
    const ox = 40;
    const oy = 330;
    const X = (x) => ox + scale * x;
    const Y = (y) => oy - scale * y;
</script>

<figure>
    <label>
        Neighbourhood radius: {radius.toFixed(2)} m
        <input type="range" min="0.1" max="1" step="0.05" bind:value={radius} />
    </label>
    <svg viewBox="0 0 460 360" role="img" aria-label="Normals estimated by PCA on a noisy 2D scan">
        {#each estimates as { p, n, variation }, i (i)}
            <line
                x1={X(p[0] - 0.12 * n[0])}
                y1={Y(p[1] - 0.12 * n[1])}
                x2={X(p[0] + 0.12 * n[0])}
                y2={Y(p[1] + 0.12 * n[1])}
                class="normal"
            />
            <circle
                cx={X(p[0])}
                cy={Y(p[1])}
                r="2.6"
                style="fill: var(--series-{variation > 0.1 ? 2 : 1})"
            />
        {/each}
        <circle cx={X(3.3)} cy={Y(2.8)} r={scale * radius} class="ball" />
        <text x={X(3.3)} y={Y(2.8) + 4} class="label">r</text>
    </svg>
    <figcaption>
        Normals (grey ticks, drawn without orientation) estimated by PCA on a noisy scan of a corner
        and a round pillar, and the neighbourhood radius used, drawn to scale. Points whose surface
        variation exceeds 0.1, where the neighbourhood is not flat, are in the second colour. A
        small radius gives noisy normals; a large one bends the normals around the corner and the
        pillar and flags a wide band of points as non-planar.
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
        max-width: 260px;
    }
    svg {
        width: 100%;
        max-width: 560px;
        align-self: center;
        background: var(--paper-raised);
        border: 1px solid var(--rule);
    }
    .normal {
        stroke: var(--muted);
        stroke-width: 1;
    }
    .ball {
        fill: none;
        stroke: var(--rule-strong);
        stroke-dasharray: 4 3;
    }
    .label {
        fill: var(--muted);
        font-family: var(--font-ui);
        font-size: 12px;
        text-anchor: middle;
    }
</style>
