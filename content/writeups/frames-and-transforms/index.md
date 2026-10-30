---
title: Coordinate frames, rigid transforms and calibration
created: 2026-10-30
depends_on: [how-lidar-works]
---

A point measured by a LiDAR is a position relative to the sensor, and almost nothing useful can be done with it until it is expressed relative to something else: the vehicle carrying the sensor, a camera beside it, a map of the world, or the same sensor a tenth of a second earlier. This writeup develops the geometry that does this. It introduces coordinate frames and the rigid transforms between them, the ways rotations are represented and why each is used, the small-angle calculus on which every pose optimiser in later writeups depends, and then the operations performed on every scan in practice: extrinsic calibration, projection into a camera image, projection into a range image or a bird's-eye grid, and the correction of the distortion a moving sensor puts into its own scan.

This writeup builds on [How LiDAR works](../how-lidar-works/), which describes the points themselves, how they are computed from range and angle in the sensor's frame [](eq:writeups/how-lidar-works/spherical), and why each carries a timestamp. A thorough treatment of the material here is [](cite:barfoot2017); [](cite:sola2018) is a short and practical one.

# Coordinate frames

A _coordinate frame_ is an origin and three orthonormal axes attached to something. A typical vehicle carries many: one for each LiDAR, camera, radar and inertial measurement unit (IMU), and a body frame for the vehicle itself, by ROS convention called `base_link`, usually on the ground beneath the centre of the rear axle. Beyond the vehicle there are frames fixed in the world: an `odom` frame, in which the vehicle's motion is smooth but drifts over time, and a `map` frame, in which its position is globally consistent but may jump when the localisation is corrected.

Conventions for the axes matter, because mixing them is the most common source of bugs in this kind of code. Vehicle and LiDAR frames almost always follow the right-handed convention $x$ forward, $y$ left, $z$ up (ROS's REP 103). Camera frames almost always follow the _optical_ convention $z$ forward along the optical axis, $x$ right and $y$ down, matching image rows and columns. Some datasets and engines use $y$ up or a left-handed system. Before trusting any transform, it is worth checking which convention each frame uses.

# Rotations

A rotation of three-dimensional space is a linear map that preserves lengths, angles and handedness. As a matrix, it is an $R \in \bbR^{3 \times 3}$ with

$$
	R\T R = I, \qquad \det R = 1,
$$

and the set of all of them, closed under multiplication and inversion, is the _special orthogonal group_ $\SO(3)$. Its inverse is its transpose, its columns are the axes of the rotated frame expressed in the original one, and composing two rotations is multiplying their matrices. A rotation has three degrees of freedom, though a matrix has nine entries, and the various representations of rotations are different ways of handling that redundancy.

## Euler angles

The most intuitive representation is three successive rotations about coordinate axes. The usual one for vehicles is yaw $\psi$ about $z$, then pitch $\vartheta$ about the new $y$, then roll $\phi$ about the newest $x$:

$$
	R = R_z(\psi)\,R_y(\vartheta)\,R_x(\phi),
	\qquad
	R_z(\psi) = \begin{pmatrix} \cos\psi & -\sin\psi & 0 \\ \sin\psi & \cos\psi & 0 \\ 0 & 0 & 1 \end{pmatrix},
$$

with $R_y$ and $R_x$ defined likewise. Roll, pitch and yaw are excellent for reading and for writing configuration files, since a mounting angle "pitched down $5°$" is immediately clear. They are poor for computation. There are twelve different axis orders in use, and two programs that disagree about the order produce different rotations from the same three numbers. Interpolating the angles does not interpolate the rotations smoothly. And at a pitch of $\pm 90°$ yaw and roll rotate about the same axis, so one degree of freedom is lost and nearby rotations require large changes of angle, a singularity called _gimbal lock_.

## Axis and angle

Every rotation is a rotation by some angle $\theta$ about some unit axis $\bfk$, a fact known as Euler's rotation theorem. Packing the two into one vector $\bfomega = \theta\bfk$, the _rotation vector_, gives a minimal three-number representation without the arbitrary choice of axis order. The matrix is given by _Rodrigues' formula_,

$$
	R = I + \sin\theta\,[\bfk]_\times + (1 - \cos\theta)\,[\bfk]_\times^2, @tag(rodrigues)
$$

where $[\bfk]_\times$ is the skew-symmetric matrix that computes cross products, $[\bfk]_\times \bfv = \bfk \times \bfv$:

$$
	[\bfk]_\times = \begin{pmatrix} 0 & -k_3 & k_2 \\ k_3 & 0 & -k_1 \\ -k_2 & k_1 & 0 \end{pmatrix}.
$$

## Unit quaternions

A _quaternion_ $q = w + x\,\rmi + y\,\rmj + z\,\rmk$ is a four-component number with the multiplication rules $\rmi^2 = \rmj^2 = \rmk^2 = \rmi\rmj\rmk = -1$. The rotation by $\theta$ about the unit axis $\bfk$ is represented by the unit quaternion

$$
	q = \cos\tfrac{\theta}{2} + \sin\tfrac{\theta}{2}\,(k_1 \rmi + k_2 \rmj + k_3 \rmk),
$$

which rotates a vector $\bfv$, written as the pure quaternion $v_1\rmi + v_2\rmj + v_3\rmk$, by $\bfv \mapsto q \bfv q^{\ast}$, where $q^{\ast}$ negates the three imaginary parts. Composing rotations is multiplying quaternions, and the corresponding matrix is

$$
	R(q) = \begin{pmatrix}
		1 - 2(y^2 + z^2) & 2(xy - wz) & 2(xz + wy) \\
		2(xy + wz) & 1 - 2(x^2 + z^2) & 2(yz - wx) \\
		2(xz - wy) & 2(yz + wx) & 1 - 2(x^2 + y^2)
	\end{pmatrix}.
$$

Quaternions are the representation of choice for storing and transmitting rotations: four numbers, no singularities, cheap to compose, and easily renormalised when rounding errors accumulate (whereas a matrix drifts away from orthogonality and must be re-orthogonalised). Two caveats are worth knowing. First, $q$ and $-q$ represent the same rotation, since the half-angle makes a full turn of $q$ correspond to two turns of space. Second, libraries disagree on the order of the components: ROS and SciPy store $(x, y, z, w)$, while Eigen's constructor and many papers write $(w, x, y, z)$.

The quaternion representation also gives the right way to interpolate. _Spherical linear interpolation_ between unit quaternions $q_0$ and $q_1$,

$$
	\operatorname{slerp}(q_0, q_1; s) = \frac{\sin((1 - s)\Omega)}{\sin\Omega}\,q_0 + \frac{\sin(s\Omega)}{\sin\Omega}\,q_1, \qquad \cos\Omega = q_0 \cdot q_1,
$$

moves at constant angular speed along the shortest rotation from one to the other as $s$ runs from $0$ to $1$, provided the sign of $q_1$ is first flipped if $q_0 \cdot q_1 < 0$, so that the shorter of the two paths is taken.

# Rigid transforms

A _rigid transform_ is a rotation followed by a translation, $\bfp \mapsto R\bfp + \bft$, and describes how one frame sits relative to another. The set of them is the _special Euclidean group_ $\SE(3)$. Writing points in _homogeneous coordinates_, with a fourth coordinate equal to $1$, turns the transform into a single matrix multiplication:

$$
	T = \begin{pmatrix} R & \bft \\ \mathbf{0}\T & 1 \end{pmatrix},
	\qquad
	T \begin{pmatrix} \bfp \\ 1 \end{pmatrix} = \begin{pmatrix} R\bfp + \bft \\ 1 \end{pmatrix},
	\qquad
	T^{-1} = \begin{pmatrix} R\T & -R\T\bft \\ \mathbf{0}\T & 1 \end{pmatrix}.
$$

This course writes $T_{AB}$ for the transform that takes the coordinates of a point in frame $B$ to its coordinates in frame $A$, so that ${}^{A}\bfp = T_{AB}\,{}^{B}\bfp$. Its translation $\bft_{AB}$ is the origin of $B$ expressed in $A$, and its rotation's columns are the axes of $B$ expressed in $A$, which is why $T_{AB}$ is also called _the pose of $B$ in $A$_. With this notation, chains read naturally, since adjacent subscripts cancel:

$$
	T_{AC} = T_{AB}\,T_{BC}, \qquad T_{BA} = T_{AB}^{-1}.
$$

For example, a LiDAR point is placed on a map by ${}^{\mathrm{map}}\bfp = T_{\mathrm{map},\mathrm{base}}\,T_{\mathrm{base},\mathrm{lidar}}\,{}^{\mathrm{lidar}}\bfp$: the first transform is the vehicle's pose, which changes every instant, and the second is the sensor's mounting, its _extrinsic calibration_, which is fixed. ROS's `tf2` library maintains the tree of all such transforms, with timestamps, so that any frame can be expressed in any other at any time.

Applying a transform to a whole point cloud is one matrix product. With the points as the rows of an $N \times 3$ array,

```python
import numpy as np

def transform(T, points):
    """Apply a 4x4 rigid transform to an (N, 3) array of points."""
    return points @ T[:3, :3].T + T[:3, 3]
```

which costs $O(N)$ and, for a scan of a hundred thousand points, well under a millisecond.

As a worked example, suppose a LiDAR is mounted $1.5$ m ahead of `base_link` and $1.8$ m above it, yawed $90°$ to the left so that its $x$ axis points along the vehicle's $y$ axis. Then

$$
	T_{\mathrm{base},\mathrm{lidar}} = \begin{pmatrix} 0 & -1 & 0 & 1.5 \\ 1 & 0 & 0 & 0 \\ 0 & 0 & 1 & 1.8 \\ 0 & 0 & 0 & 1 \end{pmatrix},
$$

and a point $10$ m straight ahead of the sensor, ${}^{\mathrm{lidar}}\bfp = (10, 0, 0)$, is at ${}^{\mathrm{base}}\bfp = (1.5, 10, 1.8)$: ten metres to the vehicle's left, as it should be.

# Small motions and the tangent space

Every pose estimator in the course, from ICP to a SLAM back end, finds a transform by iteratively improving a guess. That requires a way to nudge a rotation by a small amount, and the rotation matrix itself cannot be nudged directly: adding a small matrix to $R$ does not in general leave it in $\SO(3)$. The remedy is to nudge in the space of rotation vectors and map the result back.

The map from rotation vectors to rotations is the _exponential map_. For a rotation vector $\bfomega$ it is

$$
	\operatorname{Exp}(\bfomega) = \exp([\bfomega]_\times) = \sum_{n \ge 0} \frac{[\bfomega]_\times^n}{n!},
$$

the matrix exponential of the skew-symmetric matrix, and summing the series gives exactly Rodrigues' formula [](eq:rodrigues) with $\theta = \lVert\bfomega\rVert$ and $\bfk = \bfomega / \theta$. Its inverse, $\operatorname{Log}$, recovers the rotation vector from a matrix. (The skew-symmetric matrices form the _Lie algebra_ $\mathfrak{so}(3)$ of the group, and the exponential map of a Lie group generalises the same idea; [](cite:sola2018) develops it at the level needed here.) For a small rotation vector, the series gives the first-order approximation

$$
	\operatorname{Exp}(\bfomega) \approx I + [\bfomega]_\times, @tag(small-rotation)
$$

and so perturbing a rotation $R$ by a small $\bfomega$ gives $R\operatorname{Exp}(\bfomega)\bfp \approx R\bfp + R(\bfomega \times \bfp) = R\bfp - R[\bfp]_\times\bfomega$, which is linear in $\bfomega$. An optimiser therefore works with the six numbers $(\bfomega, \delta\bft)$ of a small rigid motion, linearises its cost through [](eq:small-rotation), solves a linear least-squares problem for them, applies them to the current estimate through the exponential map, and repeats. This pattern, sometimes called optimisation _on the manifold_, recurs in the writeups on registration and SLAM.

The same exponential map, extended to $\SE(3)$, describes a motion at constant linear and angular velocity, a _twist_ $\bfxi = (\bfomega, \bfv)$: the pose after a fraction $s$ of a motion $\operatorname{Exp}(\bfxi)$ is $\operatorname{Exp}(s\bfxi)$. This is the basis of the motion correction described below.

# Extrinsic calibration

The _extrinsic calibration_ of a sensor is its fixed transform to the body frame or to another sensor. Errors in it are unforgiving: a yaw error of half a degree displaces a point at $50$ m by $44$ cm, enough to put a pedestrian on the wrong side of a kerb, or to make two LiDARs on the same vehicle disagree about where a wall is.

Calibration methods fall into three groups.

- **Target-based methods** observe a known object from both sensors. To calibrate a LiDAR against a camera, a planar board, often a checkerboard, is shown in several poses: the camera finds the board's plane from the pattern and the LiDAR from the points that fall on it, and the transform is found that makes the planes agree. Boards with holes, spheres or retroreflective markers provide points and edges as well as planes.
- **Motion-based methods** solve the _hand–eye_ problem. If two rigidly connected sensors each estimate their own motion between two moments, as $A$ and $B$, the unknown transform $X$ between them satisfies $AX = XB$; several motions with differing axes of rotation determine $X$. LiDAR odometry gives $A$, and visual or wheel odometry gives $B$.
- **Targetless, appearance-based methods** refine a calibration during normal driving by maximising the agreement between the sensors, for instance between LiDAR intensity and image brightness, or between depth discontinuities and image edges.

Two related calibrations are easy to forget. The _intrinsic_ calibration of the LiDAR itself, the per-channel elevations and offsets of [How LiDAR works](../how-lidar-works/#the-raw-measurement), is supplied by the manufacturer but can be refined. And _temporal_ calibration matters as much as spatial: if a LiDAR's clock is $10$ ms behind a camera's on a vehicle moving at $20$ m/s, the two disagree by $20$ cm. Sensors are therefore synchronised to a common clock, usually by the Precision Time Protocol (PTP) or by a GPS pulse-per-second signal.

# Projection into a camera

Fusing a LiDAR with a camera, whether to colour the points, to give image pixels a depth, or to train a network on both, starts by projecting points into the image. A LiDAR point is first moved into the camera's optical frame, ${}^{C}\bfp = T_{CL}\,{}^{L}\bfp = (X, Y, Z)$, and then, under the _pinhole model_, onto the image at the pixel

$$
	u = f_x \frac{X}{Z} + c_x, \qquad v = f_y \frac{Y}{Z} + c_y, @tag(pinhole)
$$

where the focal lengths $f_x, f_y$ and the principal point $(c_x, c_y)$, in pixels, are the camera's _intrinsics_, usually gathered into a matrix $K$. Real lenses also distort the image, and the distortion model found during camera calibration is applied to $(X/Z, Y/Z)$ before $K$.

```python
def project(points_lidar, T_cam_lidar, K, width, height):
    """Pixel coordinates and depths of the LiDAR points that land in the image."""
    p = transform(T_cam_lidar, points_lidar)
    p = p[p[:, 2] > 0.1]                      # only points in front of the camera
    uv = (p[:, :2] / p[:, 2:3]) @ K[:2, :2].T + K[:2, 2]
    inside = (uv[:, 0] >= 0) & (uv[:, 0] < width) & (uv[:, 1] >= 0) & (uv[:, 1] < height)
    return uv[inside], p[inside, 2]
```

Two details trip up first implementations. Points behind the camera have $Z < 0$ and project, through the division, to apparently valid pixels, so they must be discarded first, as above. And because the camera and the LiDAR sit in different places, they see the scene from slightly different viewpoints. A point on a wall that the LiDAR sees just past the edge of a pole may be hidden from the camera behind that pole, and projecting it gives it the pole's colour. Keeping, for each pixel, only the nearest projected point (a _z-buffer_) and discarding points much farther than their neighbours removes most of these errors. The resulting sparse depth image, with a LiDAR depth at a few percent of the pixels, is the input to depth completion and the training target for monocular depth networks.

# Projection into images and grids

Many algorithms and most networks want an image rather than a set of points, and there are two standard ways of turning a cloud into one.

**The spherical projection** recovers a range image from any cloud, including one that has lost its sensor ordering. A point at range $r = \lVert\bfp\rVert$ has azimuth $\varphi = \operatorname{atan2}(y, x)$ and elevation $\theta = \arcsin(z / r)$, and is placed at

$$
	\text{column} = \Big\lfloor \tfrac{1}{2}\big(1 - \tfrac{\varphi}{\pi}\big)\,W \Big\rfloor, \qquad \text{row} = \Big\lfloor \frac{\theta_{\max} - \theta}{\theta_{\max} - \theta_{\min}}\,H \Big\rfloor,
$$

for an $H \times W$ image spanning elevations from $\theta_{\min}$ to $\theta_{\max}$. When several points fall in one pixel, the nearest is usually kept. When the cloud still carries each point's ring index, that index should be used for the row instead, because the channels of a real sensor are not evenly spaced in elevation and do not share an origin, so the computed elevation places some points in the wrong row.

**The bird's-eye view** (BEV) drops the vertical dimension: the ground plane around the vehicle is divided into square cells of side $\delta$, a point $(x, y, z)$ falls in the cell $(\lfloor (x - x_{\min})/\delta \rfloor, \lfloor (y - y_{\min})/\delta \rfloor)$, and each cell records statistics of its points, such as their number, maximum height and mean intensity. The BEV is the natural frame for driving, since objects on a road do not overlap from above and keep their real size at every range. It is the representation behind occupancy grids and most LiDAR object detectors, and it is the frame in which their outputs are evaluated.

# Motion distortion and deskewing

[How LiDAR works](../how-lidar-works/#time-and-motion) explained that a spinning sensor takes a tenth of a second to collect a scan, and that a moving sensor smears its own scan over that time. Correcting this, _deskewing_, re-expresses every point in the sensor's frame at one reference time, usually the end of the sweep.

Let the sweep run from $t_0$ to $t_1$ and let point $k$ be measured at time $t_k$, at the fraction $s_k = (t_k - t_0)/(t_1 - t_0)$ of the sweep, with coordinates ${}^{k}\bfp_k$ in the sensor's frame at that moment. Writing $T_{W}(t)$ for the sensor's pose in a world frame at time $t$, the point in the world is $T_{W}(t_k)\,{}^{k}\bfp_k$, and in the sensor frame at $t_1$ it is

$$
	{}^{1}\bfp_k = T_{W}(t_1)^{-1}\,T_{W}(t_k)\;{}^{k}\bfp_k.
$$

The sensor's motion over the sweep must come from somewhere: an IMU, wheel odometry, or, in LiDAR-only systems, the assumption that the motion during this sweep equals the motion estimated for the previous one, the _constant-velocity model_. If the motion over the sweep is $T_{W}(t_0)^{-1}T_{W}(t_1) = \operatorname{Exp}(\bfxi)$ and is taken to be at constant velocity, then $T_W(t_k) = T_W(t_0)\operatorname{Exp}(s_k\bfxi)$ and the correction collapses to

$$
	{}^{1}\bfp_k = \operatorname{Exp}\big((s_k - 1)\,\bfxi\big)\;{}^{k}\bfp_k,
$$

so each point is moved backwards along the motion by the fraction of the sweep still to come. In practice it is common to approximate the exponential by interpolating the rotation by slerp and the translation linearly, which differs from it negligibly over a single sweep:

```python
from scipy.spatial.transform import Rotation, Slerp

def deskew(points, s, R_sweep, t_sweep):
    """Express each point in the sensor frame at the end of the sweep.

    points: (N, 3) in the sensor frame at their own capture times.
    s: (N,) fraction of the sweep elapsed at each capture, in [0, 1].
    R_sweep, t_sweep: the sensor's motion over the sweep, as the pose of its
    frame at the end of the sweep in its frame at the start.
    """
    slerp = Slerp([0, 1], Rotation.concatenate([Rotation.identity(), R_sweep]))
    R_k = slerp(s)                                  # pose at capture, in start frame
    p_start = R_k.apply(points) + s[:, None] * t_sweep
    return R_sweep.inv().apply(p_start - t_sweep)   # into the end frame
```

Deskewing matters more than it seems. On a vehicle turning at $30°$ per second, the start and end of a $10$ Hz sweep are rotated $3°$ apart, which at $30$ m is an error of $1.6$ m; without correction, a registration algorithm aligns smeared scans and its estimate of the motion is biased. Objects that are themselves moving, such as other cars, remain distorted by their own motion even after the sensor's motion is removed, which is one of the difficulties that object trackers face.

# Summary

Points are useful only once placed in a common frame. Rotations live in $\SO(3)$ and are best stored as unit quaternions, read as roll, pitch and yaw, and perturbed through the exponential map; rigid transforms live in $\SE(3)$, compose by multiplication, and are written $T_{AB}$ with cancelling subscripts. Extrinsic, intrinsic and temporal calibration fix the relations between sensors, the pinhole model [](eq:pinhole) carries points into camera images, the spherical projection and the bird's-eye view carry them into images and grids, and deskewing removes the sensor's own motion from each scan. The next writeup turns from where points are to which points are near which: the spatial data structures that make neighbourhood queries fast.
