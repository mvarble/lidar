<script>
    // A constant-velocity Kalman filter following a car along one axis from
    // noisy position measurements at 10 Hz. The car cruises, brakes, then cruises. The
    // band is the filter's ±2σ uncertainty in position.
    let seed = 17;
    const random = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    const gauss = () =>
        Math.sqrt(-2 * Math.log(random() + 1e-12)) * Math.cos(2 * Math.PI * random());

    const dt = 0.1;
    const steps = 80;
    const sigmaZ = 0.5; // measurement noise, m
    const sigmaA = 1.5; // process noise, as white acceleration, m/s²
    let [pos, vel] = [0, 12];
    const truth = [];
    const measurements = [];
    for (let k = 0; k < steps; k++) {
        const accel = k >= 40 && k < 55 ? -6 : 0;
        pos += vel * dt + 0.5 * accel * dt * dt;
        vel += accel * dt;
        truth.push(pos);
        measurements.push(pos + sigmaZ * gauss());
    }

    // The filter, with state [position, velocity] and covariance P.
    let x = [measurements[0], 0];
    let P = [
        [sigmaZ ** 2, 0],
        [0, 100],
    ];
    const q = sigmaA ** 2;
    const Q = [
        [(q * dt ** 4) / 4, (q * dt ** 3) / 2],
        [(q * dt ** 3) / 2, q * dt ** 2],
    ];
    const estimates = [{ mean: x[0], sd: Math.sqrt(P[0][0]) }];
    for (let k = 1; k < steps; k++) {
        // Predict: x = F x, P = F P Fᵀ + Q, with F = [[1, dt], [0, 1]].
        x = [x[0] + dt * x[1], x[1]];
        P = [
            [
                P[0][0] + dt * (P[1][0] + P[0][1]) + dt * dt * P[1][1] + Q[0][0],
                P[0][1] + dt * P[1][1] + Q[0][1],
            ],
            [P[1][0] + dt * P[1][1] + Q[1][0], P[1][1] + Q[1][1]],
        ];
        // Update with z = H x + v, H = [1, 0].
        const S = P[0][0] + sigmaZ ** 2;
        const K = [P[0][0] / S, P[1][0] / S];
        const innovation = measurements[k] - x[0];
        x = [x[0] + K[0] * innovation, x[1] + K[1] * innovation];
        P = [
            [(1 - K[0]) * P[0][0], (1 - K[0]) * P[0][1]],
            [P[1][0] - K[1] * P[0][0], P[1][1] - K[1] * P[0][1]],
        ];
        estimates.push({ mean: x[0], sd: Math.sqrt(P[0][0]) });
    }

    // Plot the error relative to the truth, so that centimetres are visible.
    const [W, H, left, right, top, bottom] = [640, 280, 52, 16, 16, 44];
    const X = (k) => left + ((W - left - right) * k) / (steps - 1);
    const Y = (e) => top + ((H - top - bottom) * (2 - e)) / 4;
    const band =
        estimates
            .map((e, k) => `${k ? 'L' : 'M'}${X(k)},${Y(e.mean - truth[k] + 2 * e.sd)}`)
            .join('') +
        estimates
            .map((e, k) => [k, e])
            .reverse()
            .map(([k, e]) => `L${X(k)},${Y(e.mean - truth[k] - 2 * e.sd)}`)
            .join('') +
        'Z';
    const line = estimates
        .map((e, k) => `${k ? 'L' : 'M'}${X(k)},${Y(e.mean - truth[k])}`)
        .join('');
    const yTicks = [-2, -1, 0, 1, 2];
    const xTicks = [0, 2, 4, 6, 8];
</script>

<figure>
    <svg
        viewBox="0 0 {W} {H}"
        role="img"
        aria-label="Position error of a Kalman filter tracking a braking car"
    >
        {#each yTicks as e (e)}
            <line x1={left} x2={W - right} y1={Y(e)} y2={Y(e)} class={e ? 'grid' : 'axis'} />
            <text x={left - 8} y={Y(e) + 4} class="tick end">{e} m</text>
        {/each}
        {#each xTicks as t (t)}
            <text x={X(t / dt)} y={H - bottom + 18} class="tick">{t} s</text>
        {/each}
        <line x1={X(40)} x2={X(40)} y1={top} y2={H - bottom} class="brake" />
        <text x={X(40) + 6} y={top + 12} class="tick start">braking begins</text>
        <defs>
            <clipPath id="kalman-plot">
                <rect x={left} y={top} width={W - left - right} height={H - top - bottom} />
            </clipPath>
        </defs>
        <g clip-path="url(#kalman-plot)">
            <path d={band} class="band" />
            <path d={line} class="estimate" />
        </g>
        {#each measurements as z, k (k)}
            <circle cx={X(k)} cy={Y(z - truth[k])} r="2.4" class="measurement" />
        {/each}
    </svg>
    <ul class="legend">
        <li><span class="dot"></span>measurement error</li>
        <li><span class="swatch"></span>filter error, with ±2σ band</li>
    </ul>
    <figcaption>
        The errors of position measurements with a standard deviation of 0.5 m, and of a
        constant-velocity Kalman filter fed with them, while a car cruises at 12 m/s, brakes at 6
        m/s² for one and a half seconds, and cruises again. The filter's error is smaller than the
        measurements' and its uncertainty band settles within a second. The braking, which the model
        does not anticipate, makes the estimate lag behind the truth and outside its own band; it
        recovers once the car settles at its new speed. A larger process noise would shorten the lag
        at the cost of noisier estimates.
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
        height: auto;
        background: var(--paper-raised);
    }
    .grid {
        stroke: var(--rule);
    }
    .axis {
        stroke: var(--rule-strong);
    }
    .brake {
        stroke: var(--muted);
        stroke-dasharray: 3 3;
    }
    .band {
        fill: var(--series-1);
        fill-opacity: 0.15;
        stroke: none;
    }
    .estimate {
        fill: none;
        stroke: var(--series-1);
        stroke-width: 2;
    }
    .measurement {
        fill: var(--series-2);
    }
    .tick {
        fill: var(--muted);
        font-family: var(--font-ui);
        font-size: 11px;
        text-anchor: middle;
    }
    .end {
        text-anchor: end;
    }
    .start {
        text-anchor: start;
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
        width: 0.5rem;
        height: 0.5rem;
        margin-right: 0.4rem;
        border-radius: 50%;
        background: var(--series-2);
    }
    .swatch {
        display: inline-block;
        width: 1.2rem;
        height: 0.6rem;
        margin-right: 0.4rem;
        vertical-align: middle;
        background: color-mix(in srgb, var(--series-1) 25%, transparent);
        border-top: 2px solid var(--series-1);
    }
</style>
