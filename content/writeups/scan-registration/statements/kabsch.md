---
type: statement
kind: proposition
title: Kabsch–Umeyama
slug: kabsch
---

Let $\bfp_1, \dots, \bfp_n$ and $\bfq_1, \dots, \bfq_n$ be points of $\bbR^3$ with centroids $\bar\bfp$ and $\bar\bfq$, and let

$$
	H = \sum_{i=1}^{n} (\bfp_i - \bar\bfp)(\bfq_i - \bar\bfq)\T = U S V\T
$$

be a singular value decomposition. Then a rotation $R \in \SO(3)$ and translation $\bft \in \bbR^3$ that minimise $\sum_i \lVert R\bfp_i + \bft - \bfq_i\rVert^2$ are

$$
	R^\star = V \operatorname{diag}\big(1, 1, \det(V U\T)\big) U\T, \qquad \bft^\star = \bar\bfq - R^\star\bar\bfp.
$$
