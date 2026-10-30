<script>
    // A schematic of the PointPillars pipeline, left to right.
    const stages = [
        { label: 'Point cloud', detail: 'N × (x, y, z, r)' },
        { label: 'Pillars', detail: 'P × K × 9' },
        { label: 'PointNet', detail: 'shared MLP, max-pool' },
        { label: 'Pseudo-image', detail: 'C × H × W (BEV)' },
        { label: '2D CNN', detail: 'multi-scale backbone' },
        { label: 'Detection head', detail: 'class, box, heading' },
    ];
    const boxW = 112;
    const gap = 26;
    const boxH = 64;
    const width = stages.length * boxW + (stages.length - 1) * gap;
</script>

<figure>
    <svg viewBox="-4 -4 {width + 8} {boxH + 8}" role="img" aria-label="The PointPillars pipeline">
        <defs>
            <marker
                id="pillars-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
            >
                <path d="M0,0 L10,5 L0,10 z" class="head" />
            </marker>
        </defs>
        {#each stages as { label, detail }, i (label)}
            {@const x = i * (boxW + gap)}
            <rect {x} y="0" width={boxW} height={boxH} rx="6" class={i === 2 ? 'box key' : 'box'} />
            <text x={x + boxW / 2} y={boxH / 2 - 4} class="label">{label}</text>
            <text x={x + boxW / 2} y={boxH / 2 + 14} class="detail">{detail}</text>
            {#if i < stages.length - 1}
                <line
                    x1={x + boxW + 3}
                    x2={x + boxW + gap - 3}
                    y1={boxH / 2}
                    y2={boxH / 2}
                    class="arrow"
                    marker-end="url(#pillars-arrow)"
                />
            {/if}
        {/each}
    </svg>
    <figcaption>
        PointPillars. Points are grouped into vertical pillars on a bird's-eye grid, each holding up
        to K points described by nine features; a PointNet turns each pillar into a C-dimensional
        vector; the vectors are scattered back to their grid cells to form an image, which an
        ordinary 2D convolutional network and detection head process. Only the second and third
        stages are specific to point clouds.
    </figcaption>
</figure>

<style>
    svg {
        width: 100%;
        height: auto;
    }
    .box {
        fill: var(--paper-raised);
        stroke: var(--rule-strong);
    }
    .key {
        stroke: var(--series-1);
        stroke-width: 2;
    }
    .label {
        fill: var(--ink);
        font-family: var(--font-ui);
        font-size: 13px;
        font-weight: 600;
        text-anchor: middle;
    }
    .detail {
        fill: var(--muted);
        font-family: var(--font-ui);
        font-size: 10.5px;
        text-anchor: middle;
    }
    .arrow {
        stroke: var(--muted);
        stroke-width: 1.5;
    }
    .head {
        fill: var(--muted);
    }
</style>
