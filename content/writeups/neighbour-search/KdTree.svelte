<script>
    // A 2D k-d tree over a fixed set of points, with a nearest-neighbour query
    // at wherever the reader clicks. Points the search examined are marked.
    const size = 480;
    let seed = 11;
    const random = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    const points = Array.from({ length: 64 }, () => [
        20 + random() * (size - 40),
        20 + random() * (size - 40),
    ]);

    // Split on alternating axes at the median, recording each split's segment
    // within the cell it divides, so that the partition can be drawn.
    const segments = [];
    function build(items, depth, box) {
        if (!items.length) return null;
        const axis = depth % 2;
        items.sort((a, b) => a[axis] - b[axis]);
        const mid = items.length >> 1;
        const point = items[mid];
        const [x0, y0, x1, y1] = box;
        segments.push(axis === 0 ? [point[0], y0, point[0], y1] : [x0, point[1], x1, point[1]]);
        const lowBox = axis === 0 ? [x0, y0, point[0], y1] : [x0, y0, x1, point[1]];
        const highBox = axis === 0 ? [point[0], y0, x1, y1] : [x0, point[1], x1, y1];
        return {
            point,
            axis,
            low: build(items.slice(0, mid), depth + 1, lowBox),
            high: build(items.slice(mid + 1), depth + 1, highBox),
        };
    }
    const tree = build([...points], 0, [0, 0, size, size]);

    const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

    function nearest(query) {
        let best = null;
        let bestD = Infinity;
        const visited = [];
        (function search(node) {
            if (!node) return;
            visited.push(node.point);
            const d = dist2(query, node.point);
            if (d < bestD) {
                bestD = d;
                best = node.point;
            }
            const diff = query[node.axis] - node.point[node.axis];
            const [near, far] = diff < 0 ? [node.low, node.high] : [node.high, node.low];
            search(near);
            // The far side can hold a nearer point only if the splitting line
            // is closer than the best distance found so far.
            if (diff * diff < bestD) search(far);
        })(tree);
        return { best, radius: Math.sqrt(bestD), visited };
    }

    let query = $state([300, 170]);
    let result = $derived(nearest(query));

    let svg;
    function click(event) {
        const rect = svg.getBoundingClientRect();
        query = [
            ((event.clientX - rect.left) / rect.width) * size,
            ((event.clientY - rect.top) / rect.height) * size,
        ];
    }
</script>

<figure>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <svg
        bind:this={svg}
        viewBox="0 0 {size} {size}"
        role="img"
        aria-label="A two-dimensional k-d tree partition with a nearest-neighbour query"
        onclick={click}
    >
        {#each segments as [x1, y1, x2, y2], i (i)}
            <line {x1} {y1} {x2} {y2} class="split" />
        {/each}
        <circle cx={query[0]} cy={query[1]} r={result.radius} class="ball" />
        {#each points as [cx, cy], i (i)}
            <circle {cx} {cy} r="3.5" class="point" />
        {/each}
        {#each result.visited as [cx, cy], i (i)}
            <circle {cx} {cy} r="5" class="visited" />
        {/each}
        <circle cx={result.best[0]} cy={result.best[1]} r="6" class="best" />
        <circle cx={query[0]} cy={query[1]} r="5" class="query" />
    </svg>
    <figcaption>
        A k-d tree over 64 points, splitting alternately on <i>x</i> and <i>y</i> at the median.
        Click to move the query point (dark). The search examined only the {result.visited.length} highlighted
        points before proving that the filled one is nearest: every other cell lies entirely outside the
        circle through the nearest point.
    </figcaption>
</figure>

<style>
    svg {
        display: block;
        width: 100%;
        max-width: 480px;
        margin: 0 auto;
        background: var(--paper-raised);
        border: 1px solid var(--rule);
        cursor: crosshair;
    }
    .split {
        stroke: var(--rule-strong);
    }
    .ball {
        fill: none;
        stroke: var(--series-2);
        stroke-dasharray: 4 3;
    }
    .point {
        fill: var(--muted);
    }
    .visited {
        fill: none;
        stroke: var(--series-1);
        stroke-width: 2;
    }
    .best {
        fill: var(--series-1);
    }
    .query {
        fill: var(--ink);
    }
</style>
