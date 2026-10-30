<script>
    // A car 4.6 m by 1.9 m, rotated 25°, seen from a sensor below and to the
    // left, returns points only from the two sides facing it. The box fitted
    // by PCA is compared with the box chosen by the L-shape search.
    let seed = 9;
    const random = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    const gauss = () =>
        Math.sqrt(-2 * Math.log(random() + 1e-12)) * Math.cos(2 * Math.PI * random());

    const heading = (25 * Math.PI) / 180;
    const [L, W] = [4.6, 1.9];
    const centre = [3.2, 2.6];
    const axis = [Math.cos(heading), Math.sin(heading)];
    const side = [-Math.sin(heading), Math.cos(heading)];
    const at = (u, v) => [
        centre[0] + u * axis[0] + v * side[0] + 0.03 * gauss(),
        centre[1] + u * axis[1] + v * side[1] + 0.03 * gauss(),
    ];
    // The rear and the right-hand side, the two faces towards the sensor at the origin.
    const points = [
        ...Array.from({ length: 16 }, (_, i) => at(-L / 2, -W / 2 + (W * i) / 15)),
        ...Array.from({ length: 30 }, (_, i) => at(-L / 2 + (L * i) / 29, -W / 2)),
    ];

    const project = (e) => points.map(([x, y]) => x * e[0] + y * e[1]);
    const rectangle = (theta) => {
        const e1 = [Math.cos(theta), Math.sin(theta)];
        const e2 = [-Math.sin(theta), Math.cos(theta)];
        const c1 = project(e1);
        const c2 = project(e2);
        const [lo1, hi1, lo2, hi2] = [
            Math.min(...c1),
            Math.max(...c1),
            Math.min(...c2),
            Math.max(...c2),
        ];
        const corner = (a, b) => [a * e1[0] + b * e2[0], a * e1[1] + b * e2[1]];
        const corners = [corner(lo1, lo2), corner(hi1, lo2), corner(hi1, hi2), corner(lo1, hi2)];
        // Closeness: each point's distance to its nearest edge, rewarded inversely.
        const score = c1.reduce((s, a, i) => {
            const d = Math.min(a - lo1, hi1 - a, c2[i] - lo2, hi2 - c2[i]);
            return s + 1 / Math.max(d, 0.05);
        }, 0);
        return { corners, score };
    };

    // PCA: the principal axis of the points' covariance.
    const mx = points.reduce((s, p) => s + p[0], 0) / points.length;
    const my = points.reduce((s, p) => s + p[1], 0) / points.length;
    let [a, b, c] = [0, 0, 0];
    for (const [x, y] of points) {
        a += (x - mx) ** 2;
        b += (x - mx) * (y - my);
        c += (y - my) ** 2;
    }
    const pca = rectangle(0.5 * Math.atan2(2 * b, a - c));

    // L-shape: search headings over a quarter turn for the best closeness.
    let lshape = rectangle(0);
    for (let k = 1; k < 90; k++) {
        const candidate = rectangle((k * Math.PI) / 180);
        if (candidate.score > lshape.score) lshape = candidate;
    }

    const X = (x) => 30 + 60 * x;
    const Y = (y) => 330 - 60 * y;
    const outline = (corners) => corners.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ');
</script>

<figure>
    <svg
        viewBox="0 0 460 350"
        role="img"
        aria-label="Bounding boxes fitted to an L-shaped cluster by PCA and by L-shape fitting"
    >
        <polygon points={outline(pca.corners)} class="pca" />
        <polygon points={outline(lshape.corners)} class="lshape" />
        {#each points as [x, y], i (i)}
            <circle cx={X(x)} cy={Y(y)} r="3" class="point" />
        {/each}
        <path d="M{X(0)},{Y(0)} l-7,9 h14 z" class="sensor" />
        <text x={X(0) + 12} y={Y(0) + 4} class="label">sensor</text>
    </svg>
    <ul class="legend">
        <li><span class="swatch pca-swatch"></span>PCA box</li>
        <li><span class="swatch lshape-swatch"></span>L-shape fit</li>
    </ul>
    <figcaption>
        The points a LiDAR sees on a car: only the rear and one side, which face the sensor. The box
        aligned with the points' principal axis is rotated by the diagonal of the L and is far too
        large. Searching over headings for the rectangle whose edges the points lie closest to
        recovers the car's heading and two of its sides; its far sides, which the sensor did not
        see, remain unknown.
    </figcaption>
</figure>

<style>
    figure {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    svg {
        width: 100%;
        max-width: 480px;
        align-self: center;
        background: var(--paper-raised);
        border: 1px solid var(--rule);
    }
    .point {
        fill: var(--ink);
    }
    .pca {
        fill: none;
        stroke: var(--series-2);
        stroke-width: 2;
        stroke-dasharray: 6 4;
    }
    .lshape {
        fill: none;
        stroke: var(--series-1);
        stroke-width: 2;
    }
    .sensor {
        fill: var(--muted);
    }
    .label {
        fill: var(--muted);
        font-family: var(--font-ui);
        font-size: 12px;
    }
    .legend {
        display: flex;
        justify-content: center;
        gap: 1.2rem;
        list-style: none;
        padding: 0;
        margin: 0;
        font-family: var(--font-ui);
        font-size: var(--font-size-ui);
        color: var(--muted);
    }
    .swatch {
        display: inline-block;
        width: 1.2rem;
        height: 0;
        margin-right: 0.4rem;
        vertical-align: middle;
        border-top: 2px solid;
    }
    .pca-swatch {
        border-color: var(--series-2);
        border-top-style: dashed;
    }
    .lshape-swatch {
        border-color: var(--series-1);
    }
</style>
