<script>
    // A vehicle drives once round a 20 m by 12 m block in 1 m steps. Its
    // odometry over-reports each turn slightly and is noisy, so dead reckoning
    // drifts. Closing the loop adds one constraint, that the last pose is the
    // first, and Gauss-Newton on the pose graph spreads the error round the loop.
    let seed = 13;
    const random = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    const gauss = () =>
        Math.sqrt(-2 * Math.log(random() + 1e-12)) * Math.cos(2 * Math.PI * random());
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

    // Ground truth: poses (x, y, heading) round the rectangle, with the
    // corners turned in single steps.
    const truth = [[0, 0, 0]];
    for (const [length, turn] of [
        [20, Math.PI / 2],
        [12, Math.PI / 2],
        [20, Math.PI / 2],
        [12, Math.PI / 2],
    ]) {
        for (let k = 0; k < length; k++) {
            const [x, y, h] = truth.at(-1);
            const dh = k === length - 1 ? turn : 0;
            truth.push([x + Math.cos(h), y + Math.sin(h), wrap(h + dh)]);
        }
    }

    // The relative motion from pose a to pose b, in a's frame.
    const relative = ([xa, ya, ha], [xb, yb, hb]) => {
        const [dx, dy] = [xb - xa, yb - ya];
        return [
            Math.cos(ha) * dx + Math.sin(ha) * dy,
            -Math.sin(ha) * dx + Math.cos(ha) * dy,
            wrap(hb - ha),
        ];
    };
    const compose = ([x, y, h], [dx, dy, dh]) => [
        x + Math.cos(h) * dx - Math.sin(h) * dy,
        y + Math.sin(h) * dx + Math.cos(h) * dy,
        wrap(h + dh),
    ];

    // Odometry: true steps, with a 4% over-reading of turns and small noise.
    const odometry = truth.slice(1).map((pose, i) => {
        const [dx, dy, dh] = relative(truth[i], pose);
        return [dx * (1 + 0.01 * gauss()), dy + 0.01 * gauss(), dh * 1.04 + 0.004 * gauss()];
    });
    const deadReckoned = odometry.reduce(
        (poses, step) => [...poses, compose(poses.at(-1), step)],
        [[0, 0, 0]],
    );
    const n = deadReckoned.length;
    const edges = odometry.map((z, i) => ({ i, j: i + 1, z }));
    const loop = { i: n - 1, j: 0, z: relative(truth[n - 1], truth[0]) };

    // Gauss-Newton on the 2D pose graph, with the first pose held fixed.
    function optimise(initial, constraints) {
        let poses = initial.map((p) => [...p]);
        const dim = 3 * poses.length;
        for (let iter = 0; iter < 10; iter++) {
            const H = Array.from({ length: dim }, () => new Float64Array(dim));
            const b = new Float64Array(dim);
            for (const { i, j, z } of constraints) {
                const [xi, yi, hi] = poses[i];
                const [xj, yj, hj] = poses[j];
                const [c, s] = [Math.cos(hi), Math.sin(hi)];
                const [dx, dy] = [xj - xi, yj - yi];
                const e = [c * dx + s * dy - z[0], -s * dx + c * dy - z[1], wrap(hj - hi - z[2])];
                const A = [
                    [-c, -s, -s * dx + c * dy],
                    [s, -c, -c * dx - s * dy],
                    [0, 0, -1],
                ];
                const B = [
                    [c, s, 0],
                    [-s, c, 0],
                    [0, 0, 1],
                ];
                const blocks = [
                    [3 * i, A],
                    [3 * j, B],
                ];
                for (const [r0, J1] of blocks) {
                    for (let r = 0; r < 3; r++) {
                        for (let k = 0; k < 3; k++) b[r0 + r] += J1[k][r] * e[k];
                        for (const [c0, J2] of blocks) {
                            for (let col = 0; col < 3; col++) {
                                for (let k = 0; k < 3; k++)
                                    H[r0 + r][c0 + col] += J1[k][r] * J2[k][col];
                            }
                        }
                    }
                }
            }
            for (let r = 0; r < 3; r++) H[r][r] += 1e6;
            const dx = solve(
                H,
                b.map((v) => -v),
            );
            poses = poses.map(([x, y, h], k) => [
                x + dx[3 * k],
                y + dx[3 * k + 1],
                wrap(h + dx[3 * k + 2]),
            ]);
        }
        return poses;
    }

    // Dense Gaussian elimination with partial pivoting.
    function solve(H, rhs) {
        const m = rhs.length;
        const M = H.map((row, r) => [...row, rhs[r]]);
        for (let col = 0; col < m; col++) {
            let pivot = col;
            for (let r = col + 1; r < m; r++)
                if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
            [M[col], M[pivot]] = [M[pivot], M[col]];
            for (let r = col + 1; r < m; r++) {
                const f = M[r][col] / M[col][col];
                if (f) for (let k = col; k <= m; k++) M[r][k] -= f * M[col][k];
            }
        }
        const x = new Array(m).fill(0);
        for (let r = m - 1; r >= 0; r--) {
            let sum = M[r][m];
            for (let k = r + 1; k < m; k++) sum -= M[r][k] * x[k];
            x[r] = sum / M[r][r];
        }
        return x;
    }

    let closed = $state(false);
    let optimised = $derived(closed ? optimise(deadReckoned, [...edges, loop]) : null);

    const X = (x) => 60 + 18 * x;
    const Y = (y) => 300 - 18 * y;
    const path = (poses) => poses.map(([x, y], k) => `${k ? 'L' : 'M'}${X(x)},${Y(y)}`).join('');
</script>

<figure>
    <div class="controls">
        <button onclick={() => (closed = !closed)}
            >{closed ? 'Open the loop' : 'Close the loop'}</button
        >
    </div>
    <svg
        viewBox="0 0 480 360"
        role="img"
        aria-label="Drifting odometry corrected by a loop closure in a pose graph"
    >
        <path d={path(truth)} class="truth" />
        <path d={path(deadReckoned)} class="odometry" />
        {#if optimised}
            <line
                x1={X(deadReckoned[n - 1][0])}
                y1={Y(deadReckoned[n - 1][1])}
                x2={X(0)}
                y2={Y(0)}
                class="loop"
            />
            <path d={path(optimised)} class="optimised" />
            {#each optimised as [x, y], k (k)}
                <circle cx={X(x)} cy={Y(y)} r="2" class="node" />
            {/each}
        {/if}
    </svg>
    <ul class="legend">
        <li><span class="swatch truth-swatch"></span>true path</li>
        <li><span class="swatch odometry-swatch"></span>odometry alone</li>
        <li><span class="swatch optimised-swatch"></span>after loop closure</li>
    </ul>
    <figcaption>
        Odometry that over-reads every turn by 4% drifts steadily, and after one lap round a 20 m by
        12 m block it ends several metres from where it began. Recognising the start, a loop
        closure, adds one constraint between the last pose and the first; optimising the pose graph
        spreads the accumulated error over all 64 steps and largely restores the shape of the block.
    </figcaption>
</figure>

<style>
    figure {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
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
    svg {
        width: 100%;
        max-width: 520px;
        align-self: center;
        background: var(--paper-raised);
        border: 1px solid var(--rule);
    }
    path {
        fill: none;
        stroke-width: 2;
    }
    .truth {
        stroke: var(--rule-strong);
        stroke-width: 6;
    }
    .odometry {
        stroke: var(--series-2);
        stroke-dasharray: 5 3;
    }
    .optimised {
        stroke: var(--series-1);
    }
    .node {
        fill: var(--series-1);
    }
    .loop {
        stroke: var(--ink);
        stroke-dasharray: 2 3;
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
    .swatch {
        display: inline-block;
        width: 1.2rem;
        height: 0;
        margin-right: 0.4rem;
        vertical-align: middle;
        border-top: 2px solid;
    }
    .truth-swatch {
        border-color: var(--rule-strong);
        border-top-width: 5px;
    }
    .odometry-swatch {
        border-color: var(--series-2);
        border-top-style: dashed;
    }
    .optimised-swatch {
        border-color: var(--series-1);
    }
</style>
