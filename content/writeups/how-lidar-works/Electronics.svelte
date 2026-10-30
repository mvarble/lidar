<script>
    // Block diagrams of a pulsed time-of-flight LiDAR and an FMCW LiDAR, on a
    // grid of six columns and three rows. Electrical connections are solid,
    // optical paths dashed.
    const pitchX = 140;
    const pitchY = 92;
    const boxW = 118;
    const boxH = 54;

    // A box at column c and row r, spanning cs columns and rs rows.
    const box = (id, c, r, label, detail, cs = 1, rs = 1) => ({
        id,
        label,
        detail,
        x: c * pitchX,
        y: r * pitchY,
        w: boxW + (cs - 1) * pitchX,
        h: boxH + (rs - 1) * pitchY,
    });

    const architectures = {
        pulsed: {
            name: 'Pulsed time of flight',
            boxes: [
                box('clock', 0, 0, 'Reference clock', 'crystal and PLL'),
                box('fpga', 0, 1, 'FPGA / ASIC', 'schedule, TDC, calibration', 2),
                box('driver', 2, 0, 'Laser driver', 'GaN switch, capacitor'),
                box('laser', 3, 0, 'Pulsed laser', 'diode or VCSELs'),
                box('tx', 4, 0, 'Transmit optics', 'collimator, scanner'),
                box('scene', 5, 0, 'Scene', 'targets at range r', 1, 3),
                box('motor', 2, 1, 'Motor, encoder', 'or MEMS mirror driver'),
                box('bias', 4, 1, 'Detector bias', 'high voltage'),
                box('rx', 4, 2, 'Receive optics', 'lens, bandpass filter'),
                box('det', 3, 2, 'Photodetector', 'APD, SPAD or SiPM'),
                box('tia', 2, 2, 'TIA, comparator', 'or GS/s ADC'),
                box('tdc', 1, 2, 'Time measurement', 'TDC or histogram'),
                box('eth', 0, 2, 'Ethernet out', 'UDP point packets'),
            ],
            // Each edge is a list of anchors: [box, side] or [x, y].
            edges: [
                [
                    ['clock', 'bottom'],
                    ['fpga', 'top', 0],
                ],
                [
                    ['fpga', 'top', 1],
                    [1, 'row0'],
                    ['driver', 'left'],
                ],
                [
                    ['driver', 'right'],
                    ['laser', 'left'],
                ],
                [['laser', 'right'], ['tx', 'left'], 'optical'],
                [['tx', 'right'], ['scene', 'left', 0], 'optical'],
                [['scene', 'left', 2], ['rx', 'right'], 'optical'],
                [['rx', 'left'], ['det', 'right'], 'optical'],
                [['bias', 'bottom'], ['det', 'top'], 'bias'],
                [
                    ['det', 'left'],
                    ['tia', 'right'],
                ],
                [
                    ['tia', 'left'],
                    ['tdc', 'right'],
                ],
                [
                    ['tdc', 'top'],
                    ['fpga', 'bottom', 1],
                ],
                [
                    ['motor', 'left'],
                    ['fpga', 'right'],
                ],
                [
                    ['fpga', 'bottom', 0],
                    ['eth', 'top'],
                ],
            ],
        },
        fmcw: {
            name: 'FMCW',
            boxes: [
                box('clock', 0, 0, 'Reference clock', 'crystal and PLL'),
                box('fpga', 0, 1, 'FPGA / ASIC', 'chirp control, FFTs', 2),
                box('chirp', 1, 0, 'Chirp generator', 'DAC, modulator'),
                box('laser', 2, 0, 'Laser', 'narrow linewidth'),
                box('split', 3, 0, 'Splitter', 'taps off the light'),
                box('amp', 4, 0, 'Amplifier, optics', 'EDFA/SOA, circulator'),
                box('scene', 5, 0, 'Scene', 'targets at range r', 1, 3),
                box('ref', 2, 1, 'Reference arm', 'interferometer'),
                box('rx', 4, 2, 'Receive optics', 'shared aperture'),
                box('det', 3, 2, 'Coherent receiver', 'hybrid, balanced PDs'),
                box('adc', 2, 2, 'ADCs', 'hundreds of MS/s'),
                box('eth', 0, 2, 'Ethernet out', 'points with velocity'),
            ],
            edges: [
                [
                    ['clock', 'bottom'],
                    ['fpga', 'top', 0],
                ],
                [
                    ['fpga', 'top', 1],
                    ['chirp', 'bottom'],
                ],
                [
                    ['chirp', 'right'],
                    ['laser', 'left'],
                ],
                [['laser', 'right'], ['split', 'left'], 'optical'],
                [['split', 'right'], ['amp', 'left'], 'optical'],
                [['amp', 'right'], ['scene', 'left', 0], 'optical'],
                [['scene', 'left', 2], ['rx', 'right'], 'optical'],
                [['rx', 'left'], ['det', 'right'], 'optical'],
                [['split', 'bottom'], ['det', 'top'], 'optical'],
                [['laser', 'bottom'], ['ref', 'top'], 'optical'],
                [
                    ['ref', 'bottom'],
                    ['adc', 'top'],
                ],
                [
                    ['det', 'left'],
                    ['adc', 'right'],
                ],
                [
                    ['adc', 'left'],
                    [1, 'row2'],
                    ['fpga', 'bottom', 1],
                ],
                [
                    ['fpga', 'bottom', 0],
                    ['eth', 'top'],
                ],
            ],
        },
    };

    let which = $state('pulsed');
    let arch = $derived(architectures[which]);

    // The point on a box's side, at the centre of the side or, for a box that
    // spans several grid cells along that side, the centre of cell k.
    function anchor(boxes, [id, side, k]) {
        const b = boxes.find((bx) => bx.id === id);
        const alongX = k === undefined ? b.x + b.w / 2 : b.x + k * pitchX + boxW / 2;
        const alongY = k === undefined ? b.y + b.h / 2 : b.y + k * pitchY + boxH / 2;
        if (side === 'top') return [alongX, b.y];
        if (side === 'bottom') return [alongX, b.y + b.h];
        if (side === 'left') return [b.x, alongY];
        return [b.x + b.w, alongY];
    }

    // An edge's polyline. A waypoint [c, 'rowN'] sits at the centre of column c
    // in the gap above or below row N; elbows are inserted so every segment is
    // horizontal or vertical.
    function route(boxes, edge) {
        const points = edge
            .filter((a) => Array.isArray(a))
            .map((a) =>
                typeof a[1] === 'string' && a[1].startsWith('row')
                    ? [a[0] * pitchX + boxW / 2, Number(a[1].slice(3)) * pitchY + boxH / 2]
                    : anchor(boxes, a),
            );
        const path = [points[0]];
        for (let i = 1; i < points.length; i++) {
            const [px, py] = path.at(-1);
            const [x, y] = points[i];
            if (px !== x && py !== y) path.push([x, py]);
            path.push([x, y]);
        }
        return path.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('');
    }

    const kind = (edge) => (typeof edge.at(-1) === 'string' ? edge.at(-1) : 'electrical');
    const width = 5 * pitchX + boxW;
    const height = 2 * pitchY + boxH;
</script>

<figure>
    <div class="controls" role="group" aria-label="Architecture">
        {#each Object.entries(architectures) as [key, { name }] (key)}
            <button class:active={which === key} onclick={() => (which = key)}>{name}</button>
        {/each}
    </div>
    <div class="scroll">
        <svg
            viewBox="-6 -6 {width + 12} {height + 12}"
            role="img"
            aria-label="Block diagram of the electronics of a {arch.name} LiDAR"
        >
            <defs>
                <marker
                    id="electronics-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto"
                >
                    <path d="M0,0 L10,5 L0,10 z" class="head" />
                </marker>
            </defs>
            {#each arch.edges as edge, i (which + i)}
                <path
                    d={route(arch.boxes, edge)}
                    class="edge {kind(edge)}"
                    marker-end="url(#electronics-arrow)"
                />
            {/each}
            {#each arch.boxes as b (which + b.id)}
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="6" class="box box-{b.id}" />
                <text x={b.x + b.w / 2} y={b.y + b.h / 2 - 3} class="label">{b.label}</text>
                <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 13} class="detail">{b.detail}</text>
            {/each}
        </svg>
    </div>
    <ul class="legend">
        <li><span class="swatch electrical-swatch"></span>electrical signal</li>
        <li><span class="swatch optical-swatch"></span>light</li>
    </ul>
    <figcaption>
        The main blocks of a LiDAR's electronics. In a pulsed sensor, an FPGA or custom chip clocked
        by a crystal reference fires the laser through its driver, and times the echo once the
        photodetector, amplifier and comparator have turned it into an electrical edge. In an FMCW
        sensor, the same controller drives a chirp into a narrow-linewidth laser; a tap of the
        outgoing light is mixed with the echo in a coherent receiver, and a reference interferometer
        records the chirp actually produced, so that both can be digitised and transformed into
        frequencies.
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
    .scroll {
        overflow-x: auto;
    }
    svg {
        display: block;
        width: 100%;
        min-width: 620px;
        height: auto;
    }
    .box {
        fill: var(--paper-raised);
        stroke: var(--rule-strong);
    }
    .box-fpga {
        stroke: var(--series-1);
        stroke-width: 2;
    }
    .box-scene {
        fill: var(--paper-sunken);
    }
    .label {
        fill: var(--ink);
        font-family: var(--font-ui);
        font-size: 12.5px;
        font-weight: 600;
        text-anchor: middle;
    }
    .detail {
        fill: var(--muted);
        font-family: var(--font-ui);
        font-size: 10.5px;
        text-anchor: middle;
    }
    .edge {
        fill: none;
        stroke: var(--muted);
        stroke-width: 1.4;
    }
    .optical {
        stroke: var(--series-2);
        stroke-dasharray: 5 3;
    }
    .bias {
        stroke-dasharray: 2 3;
    }
    .head {
        fill: var(--muted);
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
    .electrical-swatch {
        border-color: var(--muted);
    }
    .optical-swatch {
        border-color: var(--series-2);
        border-top-style: dashed;
    }
</style>
