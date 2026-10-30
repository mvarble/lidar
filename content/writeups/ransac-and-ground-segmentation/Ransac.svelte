<script>
    // RANSAC fitting a line to 40 points near y = 0.45x + 1.2 mixed with 30
    // points scattered uniformly. Each iteration samples two points, draws the
    // line through them, and counts the points within the threshold.
    let seed = 5;
    const random = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    const gauss = () =>
        Math.sqrt(-2 * Math.log(random() + 1e-12)) * Math.cos(2 * Math.PI * random());
    const points = [
        ...Array.from({ length: 40 }, () => {
            const x = random() * 10;
            return [x, 0.45 * x + 1.2 + 0.15 * gauss()];
        }),
        ...Array.from({ length: 30 }, () => [random() * 10, random() * 7]),
    ];
    const threshold = 0.3;

    // The line through two points as a unit normal n and offset c, n·p = c.
    const lineThrough = (a, b) => {
        const n = [a[1] - b[1], b[0] - a[0]];
        const len = Math.hypot(n[0], n[1]);
        return { n: [n[0] / len, n[1] / len], c: (n[0] * a[0] + n[1] * a[1]) / len };
    };
    const inliersOf = ({ n, c }) =>
        points
            .map((p, i) => (Math.abs(n[0] * p[0] + n[1] * p[1] - c) < threshold ? i : -1))
            .filter((i) => i >= 0);

    let iteration = $state(0);
    let sample = $state(null);
    let current = $state(null);
    let best = $state(null);
    let bestInliers = $state([]);

    function step() {
        let i = Math.floor(random() * points.length);
        let j = Math.floor(random() * (points.length - 1));
        if (j >= i) j += 1;
        sample = [i, j];
        current = lineThrough(points[i], points[j]);
        const inliers = inliersOf(current);
        if (inliers.length > bestInliers.length) {
            best = current;
            bestInliers = inliers;
        }
        iteration += 1;
    }
    function run(n) {
        for (let k = 0; k < n; k++) step();
    }
    function reset() {
        iteration = 0;
        sample = null;
        current = null;
        best = null;
        bestInliers = [];
    }

    // Scene coordinates, x in [0, 10] and y in [0, 7], to the SVG's.
    const X = (x) => 20 + 52 * x;
    const Y = (y) => 380 - 52 * y;
    // The segment of a line n·p = c within x in [0, 10].
    const segment = ({ n, c }) => {
        if (Math.abs(n[1]) > 1e-6) {
            return [0, c / n[1], 10, (c - 10 * n[0]) / n[1]];
        }
        return [c / n[0], 0, c / n[0], 7];
    };
    let isInlier = $derived(new Set(bestInliers));
</script>

<figure>
    <div class="controls">
        <button onclick={() => run(1)}>One iteration</button>
        <button onclick={() => run(20)}>Twenty more</button>
        <button onclick={reset}>Reset</button>
        <span
            >iterations: {iteration} · best consensus: {bestInliers.length} of {points.length}</span
        >
    </div>
    <svg
        viewBox="0 0 560 400"
        role="img"
        aria-label="RANSAC fitting a line to points with many outliers"
    >
        <defs>
            <clipPath id="ransac-clip"><rect x="20" y="16" width="520" height="364" /></clipPath>
        </defs>
        <g clip-path="url(#ransac-clip)">
            {#if best}
                {@const [x1, y1, x2, y2] = segment(best)}
                <line x1={X(x1)} y1={Y(y1)} x2={X(x2)} y2={Y(y2)} class="best" />
            {/if}
            {#if current && current !== best}
                {@const [x1, y1, x2, y2] = segment(current)}
                <line x1={X(x1)} y1={Y(y1)} x2={X(x2)} y2={Y(y2)} class="current" />
            {/if}
        </g>
        {#each points as [x, y], i (i)}
            <circle cx={X(x)} cy={Y(y)} r="3.5" class={isInlier.has(i) ? 'inlier' : 'point'} />
        {/each}
        {#if sample}
            {#each sample as i (i)}
                <circle cx={X(points[i][0])} cy={Y(points[i][1])} r="7" class="sample" />
            {/each}
        {/if}
    </svg>
    <figcaption>
        RANSAC on 40 points near a line and 30 outliers. Each iteration draws the line through two
        random points (ringed, dashed line) and counts the points within 0.3 of it; the solid line
        is the line with the largest consensus so far, and its inliers are filled with the first
        colour. With 57% inliers, a sample of two is clean with probability about one in three, so a
        correct line almost always appears within a dozen iterations.
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
        align-items: center;
        gap: 0.4rem 0.6rem;
        font-family: var(--font-ui);
        font-size: var(--font-size-ui);
        color: var(--muted);
    }
    button {
        font: inherit;
        padding: 0.2rem 0.7rem;
        color: var(--ink);
        background: var(--paper-raised);
        border: 1px solid var(--rule-strong);
        border-radius: 999px;
        cursor: pointer;
    }
    svg {
        width: 100%;
        max-width: 560px;
        align-self: center;
        background: var(--paper-raised);
        border: 1px solid var(--rule);
    }
    .point {
        fill: var(--muted);
    }
    .inlier {
        fill: var(--series-1);
    }
    .sample {
        fill: none;
        stroke: var(--series-2);
        stroke-width: 2;
    }
    .best {
        stroke: var(--series-1);
        stroke-width: 2;
    }
    .current {
        stroke: var(--series-2);
        stroke-dasharray: 6 4;
    }
</style>
