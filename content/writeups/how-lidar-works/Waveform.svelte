<script>
    // A received waveform for a single laser shot whose footprint grazes the
    // edge of a car at 18 m and lands the rest of its light on a wall at 24 m,
    // after passing through a raindrop at 3 m.
    const c = 0.299792458; // metres per nanosecond
    const echoes = [
        { range: 3, amplitude: 0.18, label: 'raindrop' },
        { range: 18, amplitude: 0.55, label: 'first return' },
        { range: 24, amplitude: 0.85, label: 'last return' },
    ].map((echo) => ({ ...echo, time: (2 * echo.range) / c }));
    const sigma = 2.5; // pulse width, in nanoseconds
    const threshold = 0.3;

    // A fixed pseudo-random sequence, so the noise is the same on every render.
    let seed = 7;
    const random = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    const times = Array.from({ length: 1001 }, (_, i) => i * 0.25);
    const signal = times.map(
        (t) =>
            echoes.reduce(
                (sum, { time, amplitude }) =>
                    sum + amplitude * Math.exp(-((t - time) ** 2) / (2 * sigma ** 2)),
                0,
            ) +
            0.04 * (random() - 0.5) +
            0.03,
    );

    const width = 640;
    const height = 260;
    const left = 48;
    const right = 16;
    const top = 28;
    const bottom = 52;
    const x = (t) => left + ((width - left - right) * t) / 250;
    const y = (v) => height - bottom - (height - top - bottom) * v;
    const path = times.map((t, i) => `${i ? 'L' : 'M'}${x(t)},${y(signal[i])}`).join('');
    const ticks = [0, 50, 100, 150, 200, 250];
</script>

<figure>
    <svg
        viewBox="0 0 {width} {height}"
        role="img"
        aria-label="Received optical power against time for one laser shot, with a small echo from a raindrop and two echoes above the detection threshold"
    >
        {#each ticks as t (t)}
            <line x1={x(t)} x2={x(t)} y1={top} y2={height - bottom} class="grid" />
            <text x={x(t)} y={height - bottom + 16} class="tick">{t} ns</text>
            <text x={x(t)} y={height - bottom + 32} class="tick">{((c * t) / 2).toFixed(1)} m</text>
        {/each}
        <line x1={left} x2={width - right} y1={y(0)} y2={y(0)} class="axis" />
        <line x1={left} x2={width - right} y1={y(threshold)} y2={y(threshold)} class="threshold" />
        <text x={width - right} y={y(threshold) - 6} class="label end">threshold</text>
        <path d={path} class="signal" />
        {#each echoes as echo (echo.label)}
            <text x={x(echo.time)} y={y(echo.amplitude) - 10} class="label">{echo.label}</text>
        {/each}
        <text x={14} y={y(0.5)} class="tick" transform="rotate(-90 14 {y(0.5)})"
            >received power</text
        >
    </svg>
    <figcaption>
        The light returned by one laser shot, against the time since it was fired (upper axis
        labels) and the equivalent range, half the distance light travels in that time (lower). A
        raindrop scatters back too little light to cross the threshold. The beam's footprint
        straddles the edge of a car, so part of the pulse returns from the car at 18 m and the rest
        from a wall at 24 m: a sensor reporting two returns gives both points.
    </figcaption>
</figure>

<style>
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
    .threshold {
        stroke: var(--series-2);
        stroke-dasharray: 6 4;
    }
    .signal {
        fill: none;
        stroke: var(--series-1);
        stroke-width: 1.5;
    }
    .tick {
        fill: var(--muted);
        font-family: var(--font-ui);
        font-size: 11px;
        text-anchor: middle;
    }
    .label {
        fill: var(--ink);
        font-family: var(--font-ui);
        font-size: 12px;
        text-anchor: middle;
    }
    .end {
        text-anchor: end;
    }
</style>
