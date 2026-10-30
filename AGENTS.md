# Writing for LiDAR

This repository is a [mesearch](https://github.com/mvarble/mesearch) site: a library of documents written to be read and learned from. `mesearch dev` serves it while you write and `mesearch build` writes the static site to `build/`. Everything about how the site looks is mesearch's; this repository holds only the documents and a little configuration.

This file holds what is particular to this site. How a mesearch site is written in general is kept in two files that belong to mesearch:

- `.agents/skills/explain/authoring.md`: the conventions --- where documents go, their frontmatter, links and prose, and how mathematics, statements, proofs, citations and plots are written. Read it before writing or editing any document here.
- `.agents/skills/explain/SKILL.md`: an [agent skill](https://agentskills.io), the procedure for explaining whatever is asked for --- a concept, a document in `source/` or elsewhere, an algorithm, a theorem, a textbook chapter. Follow it when asked to explain something, whether or not your harness loaded it for you.

Both are replaced each time `mesearch init` is run, which is how this project takes the conventions of a newer mesearch, so never edit them. Whatever this site does differently is written below, and this file wins wherever it disagrees with them.

## Site-specific opinions

- The site is about LiDAR: the sensors, the data they produce, the classical algorithms that process it, and the machine-learning research built on it. It opens with a sequence, `lidar-crash-course`, that is a short textbook taking a reader from the physics of the sensor to the algorithms expected of an engineer working with LiDAR. The rest of the site holds writeups of research papers, which link back into that sequence rather than re-explaining its material.
- The reader is comfortable with linear algebra (eigendecompositions, the SVD, least squares), multivariable calculus, elementary probability and programming, and is new to LiDAR, robotics and 3D geometry. Anything beyond that is explained or linked.
- Notation: points are bold lower-case ($\bfp$, $\bfq$), matrices upper-case ($R$, $\Sigma$), a rigid transform is $T = (R, \bft) \in \SE(3)$, and $T_{AB}$ maps coordinates in frame $B$ to frame $A$. The site defines the macros `\PP`, `\EE`, `\SO`, `\SE` and `\T` (transpose, as in `R\T`).
- Describe an algorithm in prose and mathematics, then give it as a short block of Python (NumPy) or pseudocode in a fenced code block, and state its cost. Prefer the vocabulary used in industry and in the Point Cloud Library and Open3D (voxel downsampling, point-to-plane ICP, ground segmentation), so that the documents prepare a reader for technical interviews.
- A writeup of a paper names the problem the paper solves, places it against the classical method in the crash course that it improves on, and links to that writeup's section.
