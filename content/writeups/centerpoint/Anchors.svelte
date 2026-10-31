<script>
    // A car rotated by a chosen yaw, against the two anchors an anchor-based
    // head places at its centre (0° and 90°, the class's mean size), and the
    // centre-based target, which is the same Gaussian peak at every yaw.
    // Anchors count as positive at a bird's-eye IoU of at least 0.55 and
    // negative below 0.4, the vehicle thresholds of the paper's comparison.
    const [L, W] = [4.6, 1.9];
    let yaw = $state(30);

    const rect = (deg) => {
        const a = (deg * Math.PI) / 180;
        const [c, s] = [Math.cos(a), Math.sin(a)];
        return [
            [L / 2, W / 2],
            [-L / 2, W / 2],
            [-L / 2, -W / 2],
            [L / 2, -W / 2],
        ].map(([x, y]) => [c * x - s * y, s * x + c * y]);
    };
    const area = (poly) =>
        Math.abs(
            poly.reduce((s, [x, y], i) => {
                const [u, v] = poly[(i + 1) % poly.length];
                return s + x * v - u * y;
            }, 0),
        ) / 2;
    // Sutherland–Hodgman clipping of one convex polygon by another.
    function clip(subject, clipper) {
        let out = subject;
        for (let i = 0; i < clipper.length && out.length; i++) {
            const [a, b] = [clipper[i], clipper[(i + 1) % clipper.length]];
            const inside = ([x, y]) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) >= 0;
            const cross = (p, q) => {
                const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
                const [ex, ey] = [b[0] - a[0], b[1] - a[1]];
                const t = ((a[0] - p[0]) * ey - (a[1] - p[1]) * ex) / (dx * ey - dy * ex);
                return [p[0] + t * dx, p[1] + t * dy];
            };
            const input = out;
            out = [];
            input.forEach((p, k) => {
                const q = input[(k + 1) % input.length];
                if (inside(q)) {
                    if (!inside(p)) out.push(cross(p, q));
                    out.push(q);
                } else if (inside(p)) out.push(cross(p, q));
            });
        }
        return out;
    }
    const iou = (p, q) => {
        const inter = area(clip(p, q));
        return inter / (area(p) + area(q) - inter);
    };

    let car = $derived(rect(yaw));
    let ious = $derived([iou(car, rect(0)), iou(car, rect(90))]);
    let best = $derived(Math.max(...ious));
    let status = $derived(best >= 0.55 ? 'positive' : best < 0.4 ? 'negative' : 'ignored');
    const curve = Array.from({ length: 91 }, (_, d) =>
        Math.max(iou(rect(d), rect(0)), iou(rect(d), rect(90))),
    );

    const X = (x) => 110 + 30 * x;
    const Y = (y) => 110 - 30 * y;
    const outline = (poly) => poly.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ');
    // The IoU curve, yaw 0–90° across, IoU 0–1 up.
    const CX = (d) => 250 + (d / 90) * 170;
    const CY = (v) => 190 - v * 160;
    const curvePath = curve.map((v, d) => `${d ? 'L' : 'M'}${CX(d)},${CY(v)}`).join('');
</script>

<figure>
    <label>
        yaw of the car: {yaw}°
        <input type="range" min="0" max="90" step="1" bind:value={yaw} />
    </label>
    <svg viewBox="0 0 440 220" role="img" aria-label="Anchor IoU against the yaw of a car">
        <polygon points={outline(rect(0))} class="anchor" />
        <polygon points={outline(rect(90))} class="anchor" />
        <polygon points={outline(car)} class="car" />
        <circle cx={X(0)} cy={Y(0)} r="3" class="centre" />
        <text x="110" y="214" class="label">best anchor IoU {best.toFixed(2)}: {status}</text>

        <line x1={CX(0)} x2={CX(90)} y1={CY(0)} y2={CY(0)} class="axis" />
        <line x1={CX(0)} x2={CX(0)} y1={CY(0)} y2={CY(1)} class="axis" />
        <line x1={CX(0)} x2={CX(90)} y1={CY(0.55)} y2={CY(0.55)} class="threshold" />
        <text x={CX(90)} y={CY(0.55) - 4} class="tick end">0.55</text>
        <path d={curvePath} class="curve" />
        <circle cx={CX(yaw)} cy={CY(best)} r="4" class="marker" />
        <text x={CX(0)} y={CY(0) + 14} class="tick">0°</text>
        <text x={CX(45)} y={CY(0) + 14} class="tick">45°</text>
        <text x={CX(90)} y={CY(0) + 14} class="tick">90°</text>
        <text x={CX(0) - 6} y={CY(1) + 4} class="tick end">1</text>
        <text x={CX(45)} y="14" class="label">best anchor IoU against yaw</text>
    </svg>
    <ul class="legend">
        <li><span class="swatch anchor-swatch"></span>anchors at 0° and 90°</li>
        <li><span class="swatch car-swatch"></span>the car</li>
        <li><span class="dot"></span>its centre, the only thing a heatmap target encodes</li>
    </ul>
    <figcaption>
        A car of 4.6 m by 1.9 m and the two anchors an anchor-based head places at its centre. As
        the car turns, its overlap with the better anchor falls, below the positive threshold of
        0.55 between about 31° and 59° and to 0.41 at 45°, so that a car part way through a turn has
        no anchor above the threshold at its own centre. A centre-based head is trained on the same
        peak at the car's centre whatever its yaw, and regresses the yaw separately.
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
        align-items: center;
        gap: 0.8rem;
        font-family: var(--font-ui);
        font-size: var(--font-size-ui);
        color: var(--muted);
    }
    input {
        flex: 1;
        max-width: 280px;
    }
    svg {
        width: 100%;
        max-width: 620px;
        align-self: center;
        background: var(--paper-raised);
        border: 1px solid var(--rule);
    }
    .anchor {
        fill: none;
        stroke: var(--series-2);
        stroke-dasharray: 5 3;
    }
    .car {
        fill: var(--series-1);
        fill-opacity: 0.2;
        stroke: var(--series-1);
        stroke-width: 2;
    }
    .centre,
    .marker {
        fill: var(--ink);
    }
    .axis {
        stroke: var(--rule-strong);
    }
    .threshold {
        stroke: var(--series-2);
        stroke-dasharray: 3 3;
    }
    .curve {
        fill: none;
        stroke: var(--series-1);
        stroke-width: 2;
    }
    .label {
        fill: var(--ink);
        font-family: var(--font-ui);
        font-size: 12px;
        text-anchor: middle;
    }
    .tick {
        fill: var(--muted);
        font-family: var(--font-ui);
        font-size: 10.5px;
        text-anchor: middle;
    }
    .end {
        text-anchor: end;
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
        width: 1rem;
        height: 0.6rem;
        margin-right: 0.4rem;
        vertical-align: middle;
    }
    .anchor-swatch {
        border: 1px dashed var(--series-2);
    }
    .car-swatch {
        border: 2px solid var(--series-1);
    }
    .dot {
        display: inline-block;
        width: 0.5rem;
        height: 0.5rem;
        margin-right: 0.4rem;
        border-radius: 50%;
        background: var(--ink);
    }
</style>
