# LiDAR

A library of notes on LiDAR. It opens with a crash course, read in order, from the physics and electronics of the sensor and the structure of the data it produces to the algorithms that process it: neighbour search, normals, ground segmentation, clustering, registration, odometry and mapping, tracking, and learned detectors. The rest of the site holds writeups of recent research papers, linked back to the course.

The site is hosted at <https://mvarble.github.io/lidar/>.

## How it is built

This repository is a [`@mvarble/mesearch`](https://github.com/mvarble/mesearch) site. It holds only the documents, under `content/`, and a little configuration; everything about how the site is rendered, laid out and mapped is mesearch's. See that project for how the documents become a site.

```sh
pnpm install
pnpm dev     # serve the site while writing
pnpm build   # write the static site to build/
```
