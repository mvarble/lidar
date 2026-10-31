<script>
    // Point-cloud serialisation in two dimensions. Points are quantised to a
    // 64 × 64 grid, given a code by a space-filling curve, sorted by it, and
    // cut into patches of consecutive points; each patch is one colour.
    let seed = 41;
    const random = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };

    // A bird's-eye street: two building fronts, three cars, a few poles and
    // some scattered ground returns, in [0, 1)².
    const points = [];
    const segment = (x0, y0, x1, y1, n) => {
        for (let k = 0; k < n; k++) {
            const t = random();
            points.push([
                x0 + t * (x1 - x0) + 0.004 * random(),
                y0 + t * (y1 - y0) + 0.004 * random(),
            ]);
        }
    };
    segment(0.05, 0.9, 0.95, 0.9, 160);
    segment(0.05, 0.1, 0.6, 0.1, 100);
    segment(0.6, 0.1, 0.6, 0.25, 30);
    for (const [cx, cy] of [
        [0.25, 0.68],
        [0.62, 0.72],
        [0.45, 0.33],
    ]) {
        segment(cx - 0.08, cy - 0.035, cx + 0.08, cy - 0.035, 25);
        segment(cx - 0.08, cy - 0.035, cx - 0.08, cy + 0.035, 12);
    }
    for (const [px, py] of [
        [0.15, 0.8],
        [0.8, 0.2],
        [0.85, 0.55],
    ]) {
        for (let k = 0; k < 10; k++) points.push([px + 0.01 * random(), py + 0.01 * random()]);
    }
    for (let k = 0; k < 120; k++) points.push([random(), 0.15 + 0.7 * random()]);

    const X = (x) => 10 + 380 * x;
    const Y = (y) => 390 - 380 * y;

    const bits = 6;
    const n = 1 << bits;
    const morton = (x, y) => {
        let code = 0;
        for (let b = 0; b < bits; b++)
            code |= (((x >> b) & 1) << (2 * b)) | (((y >> b) & 1) << (2 * b + 1));
        return code;
    };
    const hilbert = (x, y) => {
        let d = 0;
        for (let s = n >> 1; s > 0; s >>= 1) {
            const rx = (x & s) > 0 ? 1 : 0;
            const ry = (y & s) > 0 ? 1 : 0;
            d += s * s * ((3 * rx) ^ ry);
            if (ry === 0) {
                if (rx === 1) {
                    x = n - 1 - x;
                    y = n - 1 - y;
                }
                [x, y] = [y, x];
            }
        }
        return d;
    };
    const patterns = {
        'Z-order': (x, y) => morton(x, y),
        'Trans Z-order': (x, y) => morton(y, x),
        Hilbert: (x, y) => hilbert(x, y),
        'Trans Hilbert': (x, y) => hilbert(y, x),
    };

    let pattern = $state('Hilbert');
    let patch = $state(32);
    let order = $derived.by(() => {
        const code = patterns[pattern];
        return points
            .map(([x, y], i) => ({ i, c: code(Math.floor(x * n), Math.floor(y * n)) }))
            .sort((a, b) => a.c - b.c)
            .map(({ i }) => i);
    });
    let path = $derived(
        order.map((i, k) => `${k ? 'L' : 'M'}${X(points[i][0])},${Y(points[i][1])}`).join(''),
    );
</script>

<figure>
    <div class="controls" role="group" aria-label="Serialisation pattern">
        {#each Object.keys(patterns) as name (name)}
            <button class:active={pattern === name} onclick={() => (pattern = name)}>{name}</button>
        {/each}
    </div>
    <label>
        patch size: {patch} points
        <input type="range" min="8" max="128" step="8" bind:value={patch} />
    </label>
    <svg
        viewBox="0 0 400 400"
        role="img"
        aria-label="A point set serialised by a space-filling curve and cut into patches"
    >
        <path d={path} class="path" />
        {#each order as i, k (i)}
            <circle
                cx={X(points[i][0])}
                cy={Y(points[i][1])}
                r="3"
                style="fill: var(--series-{(Math.floor(k / patch) % 8) + 1})"
            />
        {/each}
    </svg>
    <figcaption>
        A bird's-eye view of a street, its points quantised to a 64 × 64 grid, ordered by a
        space-filling curve (the thin line joins them in order), and cut into patches of consecutive
        points, one colour per patch. Most patches are compact clusters of nearby points, which is
        what makes attention within a patch a stand-in for attention among neighbours, but each
        curve has seams where consecutive points lie far apart and where near points fall in
        different patches. The seams fall in different places for different curves, which is why
        changing the pattern from one layer to the next lets information cross them.
    </figcaption>
</figure>

<style>
    figure {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
    }
    button {
        font-family: var(--font-ui);
        font-size: var(--font-size-ui);
        padding: 0.2rem 0.7rem;
        color: var(--ink);
        background: var(--paper-raised);
        border: 1px solid var(--rule-strong);
        border-radius: 999px;
        cursor: pointer;
    }
    button.active {
        background: var(--ink);
        color: var(--paper);
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
        max-width: 460px;
        align-self: center;
        background: var(--paper-raised);
        border: 1px solid var(--rule);
    }
    .path {
        fill: none;
        stroke: var(--faint);
        stroke-width: 0.6;
    }
</style>
