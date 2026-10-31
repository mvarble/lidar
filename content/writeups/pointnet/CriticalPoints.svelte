<script>
    // Critical point sets and upper-bound shapes for a toy PointNet in two
    // dimensions. Each of the K point functions is a soft indicator of
    // closeness to a centre c_j, h_j(p) = exp(-|p - c_j|^2), so the max-pooled
    // feature u_j(S) is attained at the point of S nearest c_j. The critical
    // set is those nearest points; the upper-bound shape is every location p
    // with h(p) <= u(S) in all K coordinates, that is, every location no
    // nearer to any centre than the shape itself is.
    let seed = 29;
    const random = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };

    // A mug in outline: a U-shaped body and a handle, 160 points.
    const shape = [];
    for (let k = 0; k < 120; k++) {
        const s = k / 119;
        if (s < 0.3) shape.push([-0.5, 0.6 - (s / 0.3) * 1.1]);
        else if (s < 0.7) shape.push([-0.5 + ((s - 0.3) / 0.4) * 1.0, -0.5]);
        else shape.push([0.5, -0.5 + ((s - 0.7) / 0.3) * 1.1]);
    }
    for (let k = 0; k < 40; k++) {
        const a = -Math.PI / 2 + (Math.PI * k) / 39;
        shape.push([0.5 + 0.28 * Math.cos(a), 0.05 + 0.3 * Math.sin(a)]);
    }
    const centres = Array.from({ length: 256 }, () => [random() * 2.2 - 1.1, random() * 2.2 - 1.1]);
    const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

    let K = $state(16);
    let result = $derived.by(() => {
        const used = centres.slice(0, K);
        // For each centre, the nearest shape point and its squared distance.
        const nearest = used.map((c) => {
            let best = 0;
            for (let i = 1; i < shape.length; i++)
                if (dist2(c, shape[i]) < dist2(c, shape[best])) best = i;
            return { i: best, d: dist2(c, shape[best]) };
        });
        const critical = new Set(nearest.map(({ i }) => i));
        // The upper-bound shape, on a grid.
        const cells = [];
        const n = 56;
        for (let a = 0; a < n; a++) {
            for (let b = 0; b < n; b++) {
                const p = [-1.1 + (2.2 * (a + 0.5)) / n, -1.1 + (2.2 * (b + 0.5)) / n];
                if (used.every((c, j) => dist2(c, p) >= nearest[j].d)) cells.push(p);
            }
        }
        return { used, critical, cells, size: 2.2 / n };
    });

    const X = (x) => 200 + 170 * x;
    const Y = (y) => 200 - 170 * y;
</script>

<figure>
    <label>
        bottleneck dimension K = {K} · critical points: {result.critical.size}
        <input type="range" min="1" max="256" step="1" bind:value={K} />
    </label>
    <svg
        viewBox="0 0 400 400"
        role="img"
        aria-label="Critical points and upper-bound shape of a toy PointNet"
    >
        {#each result.cells as [x, y], i (i)}
            <rect
                x={X(x - result.size / 2)}
                y={Y(y + result.size / 2)}
                width={170 * result.size + 0.4}
                height={170 * result.size + 0.4}
                class="bound"
            />
        {/each}
        {#each result.used as [x, y], j (j)}
            <path d="M{X(x) - 3},{Y(y)} h6 M{X(x)},{Y(y) - 3} v6" class="centre" />
        {/each}
        {#each shape as [x, y], i (i)}
            <circle
                cx={X(x)}
                cy={Y(y)}
                r={result.critical.has(i) ? 4 : 1.8}
                class={result.critical.has(i) ? 'critical' : 'point'}
            />
        {/each}
    </svg>
    <ul class="legend">
        <li><span class="dot point"></span>input points</li>
        <li><span class="dot critical"></span>critical points</li>
        <li><span class="swatch"></span>upper-bound shape</li>
        <li><span class="plus">+</span>centres of the point functions</li>
    </ul>
    <figcaption>
        A toy PointNet in two dimensions whose K point functions each measure closeness to a centre,
        so that each coordinate of the max-pooled feature is attained at the input point nearest its
        centre. Those points form the critical set, never more than K of them. Any point set that
        contains the critical set and lies within the shaded upper-bound shape has exactly the same
        feature. Increase K and the critical set grows to outline the mug while the upper-bound
        shape tightens around it; with few functions, many shapes are indistinguishable.
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
        flex-wrap: wrap;
        align-items: center;
        gap: 0.4rem 0.8rem;
        font-family: var(--font-ui);
        font-size: var(--font-size-ui);
        color: var(--muted);
    }
    input {
        flex: 1;
        min-width: 160px;
        max-width: 280px;
    }
    svg {
        width: 100%;
        max-width: 440px;
        align-self: center;
        background: var(--paper-raised);
        border: 1px solid var(--rule);
    }
    .bound {
        fill: var(--series-1);
        fill-opacity: 0.16;
    }
    .centre {
        stroke: var(--faint);
        stroke-width: 1;
    }
    .point {
        fill: var(--muted);
    }
    .critical {
        fill: var(--series-2);
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
    .dot {
        display: inline-block;
        width: 0.6rem;
        height: 0.6rem;
        margin-right: 0.4rem;
        border-radius: 50%;
    }
    .dot.point {
        background: var(--muted);
    }
    .dot.critical {
        background: var(--series-2);
    }
    .swatch {
        display: inline-block;
        width: 0.9rem;
        height: 0.6rem;
        margin-right: 0.4rem;
        background: color-mix(in srgb, var(--series-1) 30%, transparent);
    }
    .plus {
        margin-right: 0.4rem;
        color: var(--faint);
    }
</style>
