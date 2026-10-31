---
type: statement
kind: theorem
title: Universal approximation
slug: universal-approximation
---

Let $\calX = \{S \subseteq [0,1]^m : |S| = n\}$ and let $f : \calX \to \bbR$ be continuous with respect to the Hausdorff distance $d_H$. For every $\varepsilon > 0$ there exist a continuous function $h$ and a symmetric function $g(\bfx_1, \dots, \bfx_n) = \gamma \circ \operatorname{MAX}$, where $\gamma$ is continuous and $\operatorname{MAX}$ takes $n$ vectors to their elementwise maximum, such that for every $S \in \calX$,

$$
	\Big| f(S) - \gamma\Big(\operatorname{MAX}_{\bfx_i \in S} \{ h(\bfx_i) \}\Big) \Big| < \varepsilon.
$$
