---
title: Attention and transformers
created: 2026-10-31
---

_Attention_ is a way for each element of a collection to gather information from the others, weighting each by how relevant it is, with the relevance itself computed from the data. A _transformer_ is a network built by stacking attention layers with small per-element networks, joined by residual connections and normalisation. Introduced for machine translation [](cite:vaswani2017), transformers now dominate language modelling and much of computer vision, and they are increasingly the backbones of networks for point clouds. This document explains the mechanism from the beginning: scaled dot-product attention, its multi-head form, the transformer block, the ways position is encoded, and the restrictions of attention to local windows that make it affordable on large inputs.

The document assumes familiarity with multilayer perceptrons and their training, and with matrix notation. Throughout, the input is a collection of $N$ _tokens_, each a feature vector of dimension $d$, stacked as the rows of a matrix $X \in \bbR^{N \times d}$. A token may be a word, a patch of an image, or a point of a point cloud.

# Scaled dot-product attention

Attention computes, for each token, a weighted average of information from all the tokens, with weights that depend on the tokens themselves. Three learned linear maps turn each token into three vectors with different roles: a _query_, which describes what the token is looking for; a _key_, which describes what it offers; and a _value_, the information it passes on if chosen. For the whole input,

$$
	Q = X W_Q, \qquad K = X W_K, \qquad V = X W_V,
$$

with $W_Q, W_K \in \bbR^{d \times d_k}$ and $W_V \in \bbR^{d \times d_v}$. Token $i$'s relevance to token $j$ is measured by the dot product of $i$'s query with $j$'s key, the scores of each row are turned into weights that are positive and sum to one by the _softmax_, and the output for token $i$ is the weighted average of the values:

$$
	\operatorname{Attention}(Q, K, V) = \operatorname{softmax}\Big(\frac{Q K\T}{\sqrt{d_k}}\Big)\, V, \qquad \operatorname{softmax}(\bfz)_j = \frac{e^{z_j}}{\sum_l e^{z_l}}, @tag(attention)
$$

with the softmax applied to each row separately. The $N \times N$ matrix of weights, the _attention map_, says how much each token draws on each other token.

The division by $\sqrt{d_k}$ keeps the scores in a useful range. If the components of a query and a key are independent with mean zero and variance one, their dot product has variance $d_k$, so without the scaling the scores of a wide model would be large, the softmax would put almost all its weight on a single token, and its gradients would vanish.

## A worked example

Take three tokens whose keys, in two dimensions, are $\bfk_1 = (1, 0)$, $\bfk_2 = (0, 1)$ and $\bfk_3 = (-1, 0)$, with scalar values $10$, $20$ and $30$, and a query $\bfq = (1, 0)$. The scaled scores are $\bfq \cdot \bfk_j / \sqrt{2}$, that is $0.707$, $0$ and $-0.707$. Exponentiating gives $2.028$, $1$ and $0.493$, which sum to $3.521$, so the weights are $0.576$, $0.284$ and $0.140$. The output is

$$
	0.576 \times 10 + 0.284 \times 20 + 0.140 \times 30 = 15.64,
$$

drawn mostly from the first token, whose key points the same way as the query, a little from the second, at right angles, and least from the third, which points the opposite way.

## Attention as an operation on sets

Nothing in [](eq:attention) depends on the order of the tokens. Permuting the rows of $X$ permutes the rows of $Q$, $K$ and $V$ alike, and so permutes the rows of the output in the same way: attention is _permutation equivariant_. That makes it a natural operation for sets, such as point clouds, but it also means that attention by itself knows nothing about where a token is, which is why the positional encodings described below are needed.

Its cost is the other notable property. Every token attends to every other, so computing the attention map takes $O(N^2 d_k)$ time and, if the map is stored, $O(N^2)$ memory. For a sentence of a few hundred words this is cheap; for an image of a million pixels or a LiDAR scan of a hundred thousand points it is prohibitive, which motivates the local forms of attention described below.

# Multi-head attention

A single attention map can express one notion of relevance at a time. _Multi-head attention_ runs $h$ attentions in parallel, each with its own projections $W_Q^{(m)}, W_K^{(m)}, W_V^{(m)}$ into a smaller dimension, usually $d / h$, concatenates their outputs, and mixes them with one more linear map:

$$
	\operatorname{MultiHead}(X) = \big[\operatorname{head}_1, \dots, \operatorname{head}_h\big]\, W_O, \qquad \operatorname{head}_m = \operatorname{Attention}\big(X W_Q^{(m)}, X W_K^{(m)}, X W_V^{(m)}\big).
$$

The cost is about the same as a single head of full width, and different heads learn to attend for different reasons, such as to nearby tokens, to tokens of similar content, or to particular landmarks.

When the queries come from the same tokens as the keys and values, as here, the operation is _self-attention_. When the queries come from one set and the keys and values from another, it is _cross-attention_, which lets one set of tokens read from another.

# The transformer block

A transformer is a stack of identical _blocks_, each combining attention, which mixes information between tokens, with a _feed-forward network_ (FFN), which processes each token on its own. The feed-forward network is a two-layer perceptron applied to every token with shared weights, typically widening the features by a factor of four in its hidden layer:

$$
	\operatorname{FFN}(\bfx) = W_2\, \sigma(W_1 \bfx + \bfb_1) + \bfb_2,
$$

with a nonlinearity $\sigma$ such as the ReLU or its smooth relative, the GELU.

Two devices make deep stacks of blocks trainable. _Residual connections_ add each sub-layer's input to its output, so that a block learns a correction to its input and gradients pass easily through many layers. _Layer normalisation_ [](cite:ba2016) rescales each token's feature vector to zero mean and unit variance across its features, followed by a learned scale $\bfgamma$ and shift $\bfbeta$:

$$
	\operatorname{LN}(\bfx) = \bfgamma \odot \frac{\bfx - \mu(\bfx)}{\sigma(\bfx)} + \bfbeta,
$$

where $\mu(\bfx)$ and $\sigma(\bfx)$ are the mean and standard deviation of the components of $\bfx$. Unlike batch normalisation, it involves no statistics across the batch, so it behaves the same in training and inference and for any batch size.

Where the normalisation goes matters. The original transformer applied it after each residual addition, the _post-norm_ arrangement,

$$
	\bfx \leftarrow \operatorname{LN}\big(\bfx + \operatorname{Attn}(\bfx)\big), \qquad \bfx \leftarrow \operatorname{LN}\big(\bfx + \operatorname{FFN}(\bfx)\big),
$$

while most current models use _pre-norm_, normalising the input of each sub-layer and leaving the residual path untouched,

$$
	\bfx \leftarrow \bfx + \operatorname{Attn}\big(\operatorname{LN}(\bfx)\big), \qquad \bfx \leftarrow \bfx + \operatorname{FFN}\big(\operatorname{LN}(\bfx)\big),
$$

which keeps the scale of gradients well behaved at initialisation and so trains more stably, without the careful warm-up of the learning rate that post-norm needs [](cite:xiong2020).

# Positional encoding

Because attention is permutation equivariant, a transformer must be told where each token is. There are three broad approaches.

- **Absolute positional encoding** adds to each token a vector that depends only on its own position, either fixed, such as the sinusoids of different frequencies used in the original transformer, or learned, one vector per position.
- **Relative positional encoding** makes the attention between two tokens depend on their offset from one another, typically by adding to each attention score a learned bias or embedding that is a function of the offset. Relative encodings generalise better, since what matters for local structure is usually where a neighbour lies relative to a token, not where both lie in absolute terms, but they must be computed for every pair of tokens that attend to each other.
- **Conditional positional encoding** generates position information from the data itself, typically by a convolution over each token's spatial neighbourhood whose output is added to the token's features before attention. Because a convolution's kernel sees where each neighbour sits, the result encodes local geometry, and it costs one convolution per layer rather than a computation per pair of tokens.

For points, positions are continuous 3D coordinates rather than indices in a sequence, and all three approaches have point-cloud versions: absolute encodings computed from coordinates by a small network, relative encodings computed from coordinate differences, and conditional encodings computed by sparse convolutions.

# Variants of the attention weights

The dot product of [](eq:attention) produces one scalar weight per pair of tokens, shared by every channel of the value. _Vector attention_, used by the Point Transformer [](cite:zhao2021) and its successor [](cite:wu2022), instead computes a separate weight for each channel, by passing the difference between the query and the key, plus a positional encoding of the two tokens' offset, through a small perceptron, and normalising with a softmax over the neighbours channel by channel. It is more expressive and was found to train well on point clouds, at the cost of evaluating a perceptron for every pair of tokens, whereas dot-product attention reduces to matrix multiplications for which hardware and software are heavily optimised.

# Local attention

To make attention affordable on large inputs, each token can be restricted to attend within a subset of the others. The commonest restriction partitions the tokens into _windows_ (or _patches_) of $w$ tokens and applies attention within each, which costs $O(N w)$ rather than $O(N^2)$, linear in $N$ for a fixed window. The Vision Transformer [](cite:dosovitskiy2021) treats an image as a sequence of fixed-size patches with global attention among them; the Swin Transformer [](cite:liu2021) instead restricts attention to non-overlapping windows of patches and lets information cross between windows by shifting the window grid by half a window in alternate layers, the _shifted window_ scheme.

Local attention trades away some of the global view for cost, and the design of a local scheme turns on two questions. The first is how to form windows whose members are genuinely near one another, which on an image grid is trivial and on an irregular point cloud is not. The second is how to let information flow between windows across layers, by shifting them, by dilating them, or by changing the partition from one layer to the next, so that stacked layers still see a wide neighbourhood.

## Computing attention efficiently

Even within windows of a few thousand tokens, the memory traffic of forming and storing the attention map dominates the cost on a GPU. _FlashAttention_ [](cite:dao2022) computes exact attention in tiles that fit in the GPU's fast on-chip memory, accumulating the softmax-weighted sums incrementally so that the full attention map is never written to the GPU's main memory. This reduces memory from quadratic to linear in the window size and makes attention over large windows several times faster, without changing its result. Because it applies only to standard dot-product attention, it has given that form a large practical advantage over variants, such as vector attention or attention with per-pair relative encodings, that do not fit its pattern.

# Summary

Attention [](eq:attention) lets each token average the values of the others with weights given by the softmax of query–key dot products, scaled by $\sqrt{d_k}$. It is permutation equivariant and costs time quadratic in the number of tokens. Multi-head attention runs several attentions in parallel; a transformer block pairs attention with a per-token feed-forward network through residual connections and layer normalisation, in current practice placed before each sub-layer. Positional information is added absolutely, relatively, or conditionally through convolutions, and attention is made affordable on large inputs by restricting it to windows, with some scheme for mixing information between windows, and by computing it in tiles without storing the attention map.
