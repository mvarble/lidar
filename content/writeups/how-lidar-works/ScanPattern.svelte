<script>
    import { palette } from '@mvarble/mesearch/palette';
    import { scan, objects, maxRange } from './scan.js';

    const choices = [16, 32, 64, 128];
    const columns = 1024;
    let beams = $state(32);
    let result = $derived(scan(beams, columns));

    let top;
    let image;

    // The colour of a point: muted for the ground, a series colour per object.
    const colour = (label) => (label < 0 ? palette.muted : palette.series[label]);

    $effect(() => {
        const { points, range, label } = result;

        // Bird's-eye view of the points, 60 m across, the sensor in the middle.
        const size = top.width;
        const half = 30;
        const px = (x, y) => [
            size / 2 - (y / half) * (size / 2),
            size / 2 - (x / half) * (size / 2),
        ];
        const ctx = top.getContext('2d');
        ctx.fillStyle = palette.paperRaised;
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = palette.rule;
        for (const r of [10, 20, 30]) {
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, (r / half) * (size / 2), 0, 2 * Math.PI);
            ctx.stroke();
        }
        for (const p of points) {
            const [u, v] = px(p.x, p.y);
            ctx.fillStyle = colour(p.label);
            ctx.fillRect(u - 1, v - 1, 2, 2);
        }
        ctx.fillStyle = palette.ink;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, 5, 0, 2 * Math.PI);
        ctx.fill();

        // The range image: one row per beam, one column per firing, nearer
        // returns drawn more strongly and missing returns left blank.
        const ictx = image.getContext('2d');
        const rowHeight = image.height / beams;
        const colWidth = image.width / columns;
        ictx.fillStyle = palette.paperSunken;
        ictx.fillRect(0, 0, image.width, image.height);
        for (let row = 0; row < beams; row++) {
            for (let col = 0; col < columns; col++) {
                const i = row * columns + col;
                if (!range[i]) continue;
                ictx.globalAlpha = 1 - (0.8 * range[i]) / maxRange;
                ictx.fillStyle = colour(label[i]);
                ictx.fillRect(col * colWidth, row * rowHeight, colWidth + 0.5, rowHeight + 0.5);
            }
        }
        ictx.globalAlpha = 1;
    });
</script>

<figure>
    <div class="controls" role="group" aria-label="Number of beams">
        {#each choices as n (n)}
            <button class:active={beams === n} onclick={() => (beams = n)}>{n} beams</button>
        {/each}
    </div>
    <canvas
        bind:this={top}
        width="900"
        height="900"
        class="top"
        aria-label="Bird's-eye view of a simulated LiDAR scan of a street"
    ></canvas>
    <canvas
        bind:this={image}
        width="1024"
        height="256"
        class="image"
        aria-label="The same scan as a range image, one row per beam"
    ></canvas>
    <ul class="legend">
        <li><span style="background: var(--muted)"></span>ground</li>
        {#each objects as { name }, i (i)}
            <li><span style="background: var(--series-{i + 1})"></span>{name}</li>
        {/each}
    </ul>
    <figcaption>
        A simulated spinning LiDAR, 1.8 m above a street, with its beams spread evenly over 45° of
        elevation and 1024 firings per revolution. Above, the points seen from above, with circles
        every 10 m; below, the same measurements as a range image, one row per beam from the highest
        down and one column per firing, with nearer returns drawn more strongly. Ground points lie
        on concentric rings that thin out with distance, and every object casts a shadow behind it
        in which there are no points at all.
    </figcaption>
</figure>

<style>
    figure {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }
    .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        font-family: var(--font-ui);
    }
    button {
        font: inherit;
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
    .top {
        width: 100%;
        max-width: 520px;
        aspect-ratio: 1;
        align-self: center;
        border: 1px solid var(--rule);
    }
    .image {
        width: 100%;
        height: 128px;
        image-rendering: pixelated;
        border: 1px solid var(--rule);
    }
    .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem 1rem;
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
        border-radius: 2px;
    }
</style>
