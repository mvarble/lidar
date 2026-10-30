<script>
    // Two waves of nearby frequencies, the stronger "local oscillator" and a
    // weaker echo with a different phase, and the output of a square-law
    // detector that receives both. Time runs over one unit, in which the waves
    // make 24 and 20 cycles, so they beat 4 times.
    const [f1, f2] = [24, 20];
    const [A, a, phase] = [1, 0.45, 1.1];
    const n = 1200;
    const ts = Array.from({ length: n + 1 }, (_, i) => i / n);
    const lo = ts.map((t) => A * Math.cos(2 * Math.PI * f1 * t));
    const echo = ts.map((t) => a * Math.cos(2 * Math.PI * f2 * t + phase));
    const power = ts.map((_, i) => (lo[i] + echo[i]) ** 2);
    // What the detector reports: the power averaged over a time that is long
    // compared with an optical cycle and short compared with a beat.
    const averaged = ts.map(
        (t) => (A * A) / 2 + (a * a) / 2 + A * a * Math.cos(2 * Math.PI * (f1 - f2) * t - phase),
    );

    const [W, left, right] = [640, 16, 16];
    const panel = 110;
    const gapY = 34;
    const X = (t) => left + (W - left - right) * t;
    // Each panel maps its own value range onto its own vertical band.
    const band = (index, lo, hi) => (v) => {
        const top = 22 + index * (panel + gapY);
        return top + (panel * (hi - v)) / (hi - lo);
    };
    const Y1 = band(0, -1.2, 1.2);
    const Y2 = band(1, 0, 2.2);
    const path = (vs, Y) =>
        vs.map((v, i) => `${i ? 'L' : 'M'}${X(ts[i]).toFixed(1)},${Y(v).toFixed(1)}`).join('');
    const H = 22 + 2 * panel + gapY + 12;
</script>

<figure>
    <svg
        viewBox="0 0 {W} {H}"
        role="img"
        aria-label="Two waves of nearby frequency and the beat in the detector's output"
    >
        <text x={left} y="14" class="title">The two waves arriving at the detector</text>
        <line x1={left} x2={W - right} y1={Y1(0)} y2={Y1(0)} class="axis" />
        <path d={path(lo, Y1)} class="lo" />
        <path d={path(echo, Y1)} class="echo" />
        <text x={left} y={22 + panel + gapY - 8} class="title"
            >The detector's output: the power of their sum</text
        >
        <line x1={left} x2={W - right} y1={Y2(0)} y2={Y2(0)} class="axis" />
        <path d={path(power, Y2)} class="raw" />
        <path d={path(averaged, Y2)} class="beat" />
    </svg>
    <ul class="legend">
        <li><span class="swatch" style="border-color: var(--series-1)"></span>local oscillator</li>
        <li>
            <span class="swatch" style="border-color: var(--series-2)"></span>weaker echo, shifted
            phase
        </li>
        <li><span class="swatch" style="border-color: var(--faint)"></span>instantaneous power</li>
        <li>
            <span class="swatch" style="border-color: var(--series-3)"></span>what the detector
            reports
        </li>
    </ul>
    <figcaption>
        Two waves making 24 and 20 cycles in the window shown. Neither cancels the other. Where
        their crests line up the power of the sum is high, where a crest meets a trough it is low,
        and the waves drift into and out of step 24 − 20 = 4 times. A detector far too slow to
        follow the individual cycles reports only that slow swell, the beat. The echo's smaller
        amplitude makes the swell shallower and its phase shifts where the swell peaks, but neither
        changes how often it swells. In a real FMCW sensor the optical waves make about 200 million
        million cycles a second, and the beat is in the megahertz to hundreds of megahertz.
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
    path {
        fill: none;
    }
    .axis {
        stroke: var(--rule);
    }
    .lo {
        stroke: var(--series-1);
        stroke-width: 1.2;
    }
    .echo {
        stroke: var(--series-2);
        stroke-width: 1.2;
    }
    .raw {
        stroke: var(--faint);
        stroke-width: 0.8;
    }
    .beat {
        stroke: var(--series-3);
        stroke-width: 2.5;
    }
    .title {
        fill: var(--muted);
        font-family: var(--font-ui);
        font-size: 12px;
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
        border-top: 3px solid;
    }
</style>
