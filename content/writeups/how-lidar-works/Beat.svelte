<script>
    // Two waves of nearby frequencies, the stronger "local oscillator" and an
    // echo whose amplitude and phase the reader picks as a phasor, and the
    // output of a square-law detector that receives both. Time runs over one
    // unit, in which the waves make 24 and 20 cycles, so they beat 4 times.
    const [f1, f2] = [24, 20];
    const A = 1;
    const n = 1200;
    const ts = Array.from({ length: n + 1 }, (_, i) => i / n);
    const lo = ts.map((t) => A * Math.cos(2 * Math.PI * f1 * t));

    // The echo's phasor, a·e^{iφ}, relative to the local oscillator's A·e^{i0}.
    let a = $state(0.45);
    let phase = $state(1.1);
    let degrees = $derived(Math.round((phase * 180) / Math.PI));

    let echo = $derived(ts.map((t) => a * Math.cos(2 * Math.PI * f2 * t + phase)));
    let power = $derived(ts.map((_, i) => (lo[i] + echo[i]) ** 2));
    // What the detector reports: the power averaged over a time that is long
    // compared with an optical cycle and short compared with a beat.
    let averaged = $derived(
        ts.map(
            (t) =>
                (A * A) / 2 + (a * a) / 2 + A * a * Math.cos(2 * Math.PI * (f1 - f2) * t - phase),
        ),
    );
    // The beat peaks where (f1 - f2) t - φ/2π is a whole number.
    let peaks = $derived(
        [-1, 0, 1, 2, 3, 4]
            .map((k) => (phase / (2 * Math.PI) + k) / (f1 - f2))
            .filter((t) => t >= 0 && t <= 1),
    );

    // The waves.
    const [W, left, right] = [640, 16, 16];
    const panel = 110;
    const gapY = 34;
    const X = (t) => left + (W - left - right) * t;
    // Each panel maps its own value range onto its own vertical band.
    const band = (index, low, high) => (v) => {
        const top = 22 + index * (panel + gapY);
        return top + (panel * (high - v)) / (high - low);
    };
    const Y1 = band(0, -1.15, 1.15);
    const Y2 = band(1, 0, 4.1);
    const path = (vs, Y) =>
        vs.map((v, i) => `${i ? 'L' : 'M'}${X(ts[i]).toFixed(1)},${Y(v).toFixed(1)}`).join('');
    const H = 22 + 2 * panel + gapY + 12;

    // The phasor diagram, one unit of amplitude to R units of the drawing.
    const R = 60;
    let tip = $derived([R * a * Math.cos(phase), -R * a * Math.sin(phase)]);

    let disc;
    let dragging = false;
    function pick(event) {
        const point = disc.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        const { x, y } = point.matrixTransform(disc.getScreenCTM().inverse());
        a = Math.min(1, Math.max(0.05, Math.hypot(x, y) / R));
        phase = Math.atan2(-y, x);
    }
    function down(event) {
        dragging = true;
        disc.setPointerCapture(event.pointerId);
        pick(event);
    }
    function move(event) {
        if (dragging) pick(event);
    }
    function up() {
        dragging = false;
    }
</script>

<figure>
    <div class="layout">
        <div class="picker">
            <svg
                bind:this={disc}
                viewBox="-70 -72 205 144"
                class="disc"
                role="img"
                aria-label="Phasor diagram: click or drag to place the echo's phasor"
                onpointerdown={down}
                onpointermove={move}
                onpointerup={up}
                onpointercancel={up}
            >
                <defs>
                    <marker
                        id="beat-arrow-lo"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                    >
                        <path d="M0,0 L10,5 L0,10 z" class="lo-fill" />
                    </marker>
                    <marker
                        id="beat-arrow-echo"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                    >
                        <path d="M0,0 L10,5 L0,10 z" class="echo-fill" />
                    </marker>
                </defs>
                <circle cx="0" cy="0" r={R} class="unit" />
                <line x1={-R - 6} x2={2 * R + 8} y1="0" y2="0" class="cross" />
                <line x1="0" x2="0" y1={-R - 6} y2={R + 6} class="cross" />
                <circle cx={R} cy="0" r={R * a} class="orbit" />
                <line x1="0" y1="0" x2={R - 2} y2="0" class="lo" marker-end="url(#beat-arrow-lo)" />
                <line
                    x1="0"
                    y1="0"
                    x2={tip[0]}
                    y2={tip[1]}
                    class="echo"
                    marker-end="url(#beat-arrow-echo)"
                />
                <line x1={R} y1="0" x2={R + tip[0]} y2={tip[1]} class="echo copy" />
                <line x1="0" y1="0" x2={R + tip[0]} y2={tip[1]} class="sum" />
                <circle cx={R + tip[0]} cy={tip[1]} r="3" class="sum-tip" />
            </svg>
            <label>
                <span>amplitude {a.toFixed(2)}</span>
                <input type="range" min="0.05" max="1" step="0.01" bind:value={a} />
            </label>
            <label>
                <span>phase {degrees}°</span>
                <input type="range" min={-Math.PI} max={Math.PI} step="0.01" bind:value={phase} />
            </label>
        </div>
        <svg
            viewBox="0 0 {W} {H}"
            class="waves"
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
            {#each peaks as t (t)}
                <line x1={X(t)} x2={X(t)} y1={Y2(4.1)} y2={Y2(0)} class="peak" />
            {/each}
            <line x1={left} x2={W - right} y1={Y2(0)} y2={Y2(0)} class="axis" />
            <path d={path(power, Y2)} class="raw" />
            <path d={path(averaged, Y2)} class="beat" />
        </svg>
    </div>
    <p class="readout">
        beat depth Aa = {(A * a).toFixed(2)} · beats in the window: {f1 - f2}, whatever the phasor
    </p>
    <ul class="legend">
        <li><span class="swatch" style="border-color: var(--series-1)"></span>local oscillator</li>
        <li><span class="swatch" style="border-color: var(--series-2)"></span>echo</li>
        <li><span class="swatch" style="border-color: var(--faint)"></span>instantaneous power</li>
        <li>
            <span class="swatch" style="border-color: var(--series-3)"></span>what the detector
            reports
        </li>
    </ul>
    <figcaption>
        Two waves making 24 and 20 cycles in the window shown. Click or drag anywhere in the diagram
        to place the tip of the echo's phasor, or use the sliders, to set its amplitude (the arrow's
        length, relative to the local oscillator's) and its phase (the arrow's angle). The amplitude
        sets how deep the beat swells; the phase slides the swells, whose peaks are marked, along in
        time; and the number of swells never changes, because it is the difference of the two
        frequencies. In the diagram, the waves drifting in and out of step amount to the echo's
        arrow turning once per beat relative to the local oscillator's, so the tip of their sum (the
        thin dark arrow) runs round the dashed circle, and its length, which sets the power, swings
        between 1 − a and 1 + a. In a real FMCW sensor the optical waves make about 200 million
        million cycles a second, and the beat is between a few and a few hundred megahertz.
    </figcaption>
</figure>

<style>
    figure {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .layout {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 0.8rem;
    }
    .picker {
        flex: 0 0 210px;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        margin: 0 auto;
    }
    .waves {
        flex: 1 1 360px;
        min-width: 0;
        height: auto;
        background: var(--paper-raised);
    }
    .disc {
        width: 100%;
        background: var(--paper-raised);
        border: 1px solid var(--rule);
        touch-action: none;
        cursor: crosshair;
    }
    label {
        display: flex;
        flex-direction: column;
        font-family: var(--font-ui);
        font-size: var(--font-size-ui);
        color: var(--muted);
    }
    input {
        width: 100%;
    }
    path {
        fill: none;
    }
    .unit {
        fill: none;
        stroke: var(--rule-strong);
    }
    .cross {
        stroke: var(--rule);
    }
    .orbit {
        fill: none;
        stroke: var(--series-3);
        stroke-dasharray: 3 3;
    }
    .axis {
        stroke: var(--rule);
    }
    .lo {
        stroke: var(--series-1);
        stroke-width: 1.4;
    }
    .echo {
        stroke: var(--series-2);
        stroke-width: 1.4;
    }
    .copy {
        stroke-dasharray: 4 3;
        stroke-width: 1;
    }
    .sum {
        stroke: var(--ink);
        stroke-width: 1;
    }
    .sum-tip {
        fill: var(--ink);
    }
    .lo-fill {
        fill: var(--series-1);
    }
    .echo-fill {
        fill: var(--series-2);
    }
    .raw {
        stroke: var(--faint);
        stroke-width: 0.8;
    }
    .beat {
        stroke: var(--series-3);
        stroke-width: 2.5;
    }
    .peak {
        stroke: var(--series-3);
        stroke-dasharray: 2 4;
    }
    .title {
        fill: var(--muted);
        font-family: var(--font-ui);
        font-size: 12px;
    }
    .readout {
        margin: 0;
        text-align: center;
        font-family: var(--font-ui);
        font-size: var(--font-size-ui);
        color: var(--muted);
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
