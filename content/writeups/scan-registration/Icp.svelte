<script>
    // Point-to-point ICP in two dimensions. The target is a sampled outline of
    // a room corner with a pillar; the source is a noisy, sparser scan of the
    // same outline, displaced by a rotation and a translation. Each step pairs
    // every source point with its nearest target point and applies the rigid
    // motion that best aligns the pairs.
    let seed = 21;
    const random = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    const gauss = () =>
        Math.sqrt(-2 * Math.log(random() + 1e-12)) * Math.cos(2 * Math.PI * random());

    function outline(step, noise) {
        const pts = [];
        for (let s = 0; s <= 9; s += step) {
            const [x, y] = s <= 5 ? [s, 0] : [5, s - 5];
            pts.push([x + noise * gauss(), y + noise * gauss()]);
        }
        for (let a = 0; a < 2 * Math.PI; a += step / 0.6) {
            pts.push([
                1.8 + 0.6 * Math.cos(a) + noise * gauss(),
                2.2 + 0.6 * Math.sin(a) + noise * gauss(),
            ]);
        }
        return pts;
    }
    const target = outline(0.12, 0);

    const startAngle = (28 * Math.PI) / 180;
    const startShift = [1.1, -0.6];
    const move = (pts, angle, [tx, ty]) =>
        pts.map(([x, y]) => [
            Math.cos(angle) * x - Math.sin(angle) * y + tx,
            Math.sin(angle) * x + Math.cos(angle) * y + ty,
        ]);
    const initial = move(outline(0.3, 0.04), startAngle, startShift);

    const nearest = (p) => {
        let best = target[0];
        let bestD = Infinity;
        for (const q of target) {
            const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
            if (d < bestD) {
                bestD = d;
                best = q;
            }
        }
        return best;
    };

    let source = $state(initial);
    let iteration = $state(0);
    let pairs = $derived(source.map((p) => [p, nearest(p)]));
    let rms = $derived(
        Math.sqrt(
            pairs.reduce((s, [p, q]) => s + (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2, 0) /
                pairs.length,
        ),
    );

    function step() {
        // Closed-form alignment of the current pairs (the 2D Kabsch solution).
        const n = pairs.length;
        const pm = [0, 0];
        const qm = [0, 0];
        for (const [p, q] of pairs) {
            pm[0] += p[0] / n;
            pm[1] += p[1] / n;
            qm[0] += q[0] / n;
            qm[1] += q[1] / n;
        }
        let [h00, h01, h10, h11] = [0, 0, 0, 0];
        for (const [p, q] of pairs) {
            const [a, b] = [p[0] - pm[0], p[1] - pm[1]];
            const [c, d] = [q[0] - qm[0], q[1] - qm[1]];
            h00 += a * c;
            h01 += a * d;
            h10 += b * c;
            h11 += b * d;
        }
        const angle = Math.atan2(h01 - h10, h00 + h11);
        const [cs, sn] = [Math.cos(angle), Math.sin(angle)];
        const t = [qm[0] - (cs * pm[0] - sn * pm[1]), qm[1] - (sn * pm[0] + cs * pm[1])];
        source = move(source, angle, t);
        iteration += 1;
    }
    function reset() {
        source = initial;
        iteration = 0;
    }

    const X = (x) => 60 + 62 * x;
    const Y = (y) => 330 - 62 * y;
</script>

<figure>
    <div class="controls">
        <button onclick={step}>Step</button>
        <button onclick={reset}>Reset</button>
        <span>iteration {iteration} · RMS distance to nearest target point {rms.toFixed(3)} m</span>
    </div>
    <svg viewBox="0 0 480 380" role="img" aria-label="Point-to-point ICP aligning two 2D scans">
        {#each pairs as [p, q], i (i)}
            <line x1={X(p[0])} y1={Y(p[1])} x2={X(q[0])} y2={Y(q[1])} class="pair" />
        {/each}
        {#each target as [x, y], i (i)}
            <circle cx={X(x)} cy={Y(y)} r="2.2" class="target" />
        {/each}
        {#each source as [x, y], i (i)}
            <circle cx={X(x)} cy={Y(y)} r="3.5" class="source" />
        {/each}
    </svg>
    <ul class="legend">
        <li><span style="background: var(--series-1)"></span>target</li>
        <li><span style="background: var(--series-2)"></span>source</li>
    </ul>
    <figcaption>
        Point-to-point ICP aligning a sparse, noisy scan (source) of a wall corner and a pillar to a
        dense one (target), starting 28° and 1.25 m out. Grey segments join each source point to its
        current nearest neighbour. Early correspondences are mostly wrong, yet each step's
        closed-form alignment of them moves the source closer, and after a handful of steps the
        correspondences, and with them the alignment, become right.
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
        max-width: 520px;
        align-self: center;
        background: var(--paper-raised);
        border: 1px solid var(--rule);
    }
    .pair {
        stroke: var(--faint);
        stroke-width: 1;
    }
    .target {
        fill: var(--series-1);
    }
    .source {
        fill: var(--series-2);
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
    .legend span {
        display: inline-block;
        width: 0.7rem;
        height: 0.7rem;
        margin-right: 0.35rem;
        border-radius: 50%;
    }
</style>
