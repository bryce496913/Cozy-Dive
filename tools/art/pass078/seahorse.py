"""V0.7 Pass 078: re-author the seahorse to the V0.7 hero-animal standard.

    python3 tools/art/pass078/seahorse.py <raw.glb>        # Blender 5.1 module (`pip install bpy==5.1.2`)
    node tools/art/pass078/splice_anchored.mjs <raw.glb> Seahorse

The Pass 013/015 seahorse was a tube with relief displaced along its normals, an ellipsoid head and
a cylinder snout. This one is sculpted as signed distance fields, fused, polygonised and reduced in
Blender:

  * **Trunk.** A swept body along the seahorse's S-curve with a heptagonal bony section: seven
    longitudinal ridges (dorsal, superior, lateral and inferior pairs), eleven trunk rings that are
    each a slightly domed plate with a groove at the joint, and tubercles where ridges cross the
    joints, spinier along the back and neck. The brood pouch swells forward below the chest.
  * **Head.** A second sweep set nearly at right angles to the trunk: a deep, narrow skull with a
    bulging gill cover, tapering into a long tubular snout with a dorsal ridge and a slightly flared
    mouth. Fused to the neck by a smooth union, so there is no seam.
  * **Crown.** A raised coronet with five star points, eye bosses with brow spines, a cheek spine.
  * **Tail.** A separate sweep (the controller grips with it) of about 34 quadrangular rings that
    taper and coil to the existing grip point (`SEAHORSE_COIL`), with corner tubercles.
  * **Fins.** Rayed membranes with scalloped margins and corrugation along the rays.

Controller contract (`src/creatures/discoveries/Seahorse.ts`, `AuthoredAquarium.ts`): nodes
`HorseBody` (root space), `HorseTail` (local to the tail pivot at y 0.33), `HorseDorsal` (local to
its pivot at 0, 0.59, -0.14), `HorseLeftFin` / `HorseRightFin` (local to 0.045, 0.97, 0.02; the
right fin is mirrored by the runtime), no node transforms; materials `HorseSkin15`, `Eye`, `Iris`
and `Fine_Membrane` are matched by name to the shipped ones when spliced. Game space: X right,
Y up, Z toward the snout.
"""
import math
import sys
from pathlib import Path

import bpy  # noqa: I001 - bpy must load before bmesh
import numpy as np
from scipy.spatial import cKDTree
from skimage.measure import marching_cubes

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'tools/art/pass015'))
sys.path.insert(0, str(ROOT / 'tools/art/pass077'))
import creatures as c15  # noqa: E402  (shared noise, colour helpers)
from colony import decimate  # noqa: E402  (Blender Decimate helper)

TAU = math.tau
#: The tail pivot (root y) and the coil centre the grip code expects (root units).
TAIL_PIVOT = 0.33
COIL = (0.15, 0.16)
VOXEL = 0.0024
BLEND = 0.006


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def spline(points, n):
    """Centripetal-ish Catmull-Rom through `points`, resampled to `n` points by arc length."""
    p = np.asarray(points, float)
    p = np.vstack([2 * p[0] - p[1], p, 2 * p[-1] - p[-2]])
    dense = []
    for k in range(len(p) - 3):
        p0, p1, p2, p3 = p[k:k + 4]
        for u in np.linspace(0, 1, 60, endpoint=False):
            dense.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u
                                + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
    dense.append(p[-2])
    dense = np.asarray(dense)
    s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(dense, axis=0), axis=1))])
    t = np.linspace(0, s[-1], n)
    return np.stack([np.interp(t, s, dense[:, k]) for k in range(3)], 1), t


class Sweep:
    """A swept body along a centreline in the y-z plane, with a profile R(t, theta).

    theta is measured around the centreline from the dorsal side (0) through the animal's right
    (+pi/2) to ventral (+-pi); `ventral` is the side the frame's D axis points to."""

    def __init__(self, points, profile, samples=900, ventral_sign=1.0):
        self.c, self.s = spline(points, samples)
        self.length = self.s[-1]
        tan = np.gradient(self.c, axis=0)
        self.t_ = tan / np.linalg.norm(tan, axis=1, keepdims=True)
        lat = np.array([1.0, 0, 0])
        self.d = np.cross(lat, self.t_) * ventral_sign  # toward the belly / underside
        self.profile = profile
        self.tree = cKDTree(self.c)

    def local(self, p):
        _, i = self.tree.query(p)
        q = p - self.c[i]
        x = q[:, 0]
        y = (q * self.d[i]).sum(1)
        along = (q * self.t_[i]).sum(1)
        theta = np.arctan2(x, -y)
        return i, x, y, along, theta

    def sdf(self, p):
        i, x, y, along, theta = self.local(p)
        t = self.s[i] / self.length
        r = self.profile(t, theta)
        radial = np.hypot(x, y)
        d = radial - r
        first, last = i == 0, i == len(self.c) - 1
        d = np.where(last & (along > 0), np.hypot(radial, along) - r, d)
        d = np.where(first & (along < 0), np.hypot(radial, along) - r, d)
        return d

    def param(self, p):
        i, x, y, along, theta = self.local(p)
        return self.s[i] / self.length, theta


def ellipse(a_lat, b_dors, b_vent, theta):
    """Radius of an egg-shaped section: half-width a, dorsal half-depth b_d, ventral b_v."""
    b = np.where(np.cos(theta) > 0, b_dors, b_vent)
    return 1 / np.sqrt((np.sin(theta) / a_lat) ** 2 + (np.cos(theta) / b) ** 2)


def ridges(theta, angles, width):
    out = np.zeros_like(theta)
    for a in angles:
        d = np.angle(np.exp(1j * (theta - a)))
        out = np.maximum(out, np.exp(-(d / width) ** 2))
    return out


TRUNK_RIDGES = (0.0, 0.85, -0.85, 1.75, -1.75, 2.55, -2.55)
TRUNK_RINGS = 11
TAIL_RIDGES = (math.pi / 4, -math.pi / 4, 3 * math.pi / 4, -3 * math.pi / 4)
TAIL_RINGS = 34


def plates(t, rings):
    """(dome, groove, joint) along the body: domed plates, grooves and tubercle rows at joints."""
    f = (t * rings) % 1.0
    dome = np.sin(np.pi * f)
    groove = np.exp(-(f / 0.07) ** 2) + np.exp(-((1 - f) / 0.07) ** 2)
    joint = np.exp(-(np.minimum(f, 1 - f) / 0.13) ** 2)
    return dome, groove, joint


def trunk_profile(t, theta):
    lat = np.interp(t, [0, 0.3, 0.55, 0.8, 1], [0.05, 0.072, 0.062, 0.05, 0.044])
    dors = np.interp(t, [0, 0.3, 0.6, 1], [0.05, 0.058, 0.055, 0.05])
    vent = np.interp(t, [0, 0.18, 0.36, 0.6, 0.8, 1], [0.052, 0.085, 0.098, 0.07, 0.055, 0.05])
    r = ellipse(lat, dors, vent, theta)
    rid = ridges(theta, TRUNK_RIDGES, 0.2)
    dome, groove, joint = plates(t, TRUNK_RINGS)
    # Ridges stand proud; the pouch (ventral, lower trunk) is smooth skin without plates.
    pouch = smoothstep(0.55, 1.0, -np.cos(theta)) * smoothstep(0.62, 0.4, t)
    r = r * (1 + (0.13 * rid + 0.035 * dome - 0.07 * groove) * (1 - 0.8 * pouch))
    spiny = np.where(np.abs(theta) < 1.0, 1.0, 0.6) * (1 + 0.6 * smoothstep(0.7, 1.0, t))
    r = r + 0.011 * rid ** 3 * joint * spiny * (1 - pouch)
    return r


def head_profile(t, theta):
    # Skull (deep, narrow), gill cover, then a long tubular snout with a flared mouth.
    snout = smoothstep(0.3, 0.5, t)
    lat = 0.057 * (1 - snout) + 0.021 * snout
    dors = 0.07 * (1 - snout) + 0.023 * snout
    vent = 0.068 * (1 - snout) + 0.025 * snout
    mouth = np.exp(-((t - 0.985) / 0.035) ** 2)
    gill = np.exp(-((t - 0.16) / 0.08) ** 2) * np.exp(-((np.abs(theta) - 1.9) / 0.6) ** 2)
    r = ellipse(lat * (1 + 0.18 * gill), dors, vent, theta) * (1 + 0.28 * mouth)
    rid = ridges(theta, (0.0,), 0.22)
    # The gill-cover rim and the joint at the snout's base read as grooves across the head.
    rim = np.exp(-((t - 0.27) / 0.025) ** 2) * smoothstep(0.6, 1.4, np.abs(theta))
    base = np.exp(-((t - 0.42) / 0.02) ** 2)
    r = r * (1 + 0.1 * rid * snout - 0.06 * rim - 0.05 * base)
    return r


def tail_profile(t, theta):
    rad = 0.047 * (1 - t) ** 0.9 + 0.009
    r = rad * (1 + 0.16 * ridges(theta, TAIL_RIDGES, 0.38))
    dome, groove, joint = plates(t, TAIL_RINGS)
    r = r * (1 + 0.04 * dome - 0.09 * groove)
    return r + 0.0065 * (1 - t) * ridges(theta, TAIL_RIDGES, 0.18) ** 3 * joint


def capsule(p, a, b, ra, rb):
    a, b = np.asarray(a, float), np.asarray(b, float)
    ba = b - a
    h = np.clip(((p - a) @ ba) / (ba @ ba), 0, 1)
    return np.linalg.norm(p - a - h[:, None] * ba, axis=1) - (ra + (rb - ra) * h)


def smin(ds, k=BLEND):
    m = np.min(ds, axis=0)
    return m - k * np.log(np.sum(np.exp(-(np.asarray(ds) - m) / k), axis=0))


TRUNK = Sweep([(0, 0.29, -0.02), (0, 0.42, -0.005), (0, 0.6, -0.06), (0, 0.77, -0.115),
               (0, 0.9, -0.1), (0, 0.985, -0.045), (0, 1.03, 0.0)], trunk_profile)
HEAD = Sweep([(0, 1.035, -0.035), (0, 1.04, 0.045), (0, 1.005, 0.15), (0, 0.988, 0.25),
              (0, 0.982, 0.322)], head_profile)
# Tail (tail-local: root y - 0.33), coiling to the grip point at (y, z) = COIL - pivot.
CY, CZ = COIL[0] - TAIL_PIVOT, COIL[1]
TAIL = Sweep([(0, 0.035, -0.025), (0, -0.07, -0.045), (0, -0.17, -0.03), (0, -0.25, 0.03),
              (0, -0.272, 0.13), (0, -0.235, 0.215), (0, -0.16, 0.24), (0, -0.105, 0.19),
              (0, -0.115, 0.125), (0, -0.165, 0.11), (0, -0.2, 0.145), (0, -0.19, 0.175)],
             tail_profile, ventral_sign=-1.0)
EYES = [(s * 0.047, 1.04, 0.085) for s in (-1, 1)]


def body_sdf(p):
    ds = [TRUNK.sdf(p), HEAD.sdf(p)]
    for s in (-1, 1):
        ex, ey, ez = EYES[(s + 1) // 2]
        ds.append(np.linalg.norm(p - np.array([ex, ey, ez]), axis=1) - 0.025)  # eye boss
        ds.append(capsule(p, (s * 0.045, 1.06, 0.075), (s * 0.06, 1.085, 0.083), 0.0065, 0.0018))  # brow
        ds.append(capsule(p, (s * 0.046, 0.995, 0.075), (s * 0.064, 0.978, 0.08), 0.006, 0.0018))  # cheek
    # Coronet: a raised boss with five star points.
    ds.append(capsule(p, (0, 1.065, -0.012), (0, 1.108, -0.026), 0.022, 0.016))
    for k in range(5):
        a = k / 5 * TAU
        tip = (0.021 * math.sin(a), 1.124 + 0.004 * math.cos(a), -0.028 + 0.021 * math.cos(a))
        ds.append(capsule(p, (0, 1.104, -0.026), tip, 0.0065, 0.002))
    # Dorsal spines: one at each trunk-ring joint along the back, longer on the neck.
    for k in range(1, TRUNK_RINGS):
        i = int(k / TRUNK_RINGS * (len(TRUNK.c) - 1))
        c, d, tn = TRUNK.c[i], TRUNK.d[i], TRUNK.t_[i]
        r = trunk_profile(np.array([k / TRUNK_RINGS]), np.array([0.0]))[0]
        base = c - d * r * 0.85
        length = 0.012 + 0.01 * (k / TRUNK_RINGS)
        tip = base - d * length + tn * length * 0.6
        ds.append(capsule(p, base, tip, 0.006, 0.0016))
    return smin(ds)


def polygonise(sdf, lo, hi, chunk=400000):
    lo, hi = np.asarray(lo, float), np.asarray(hi, float)
    shape = np.ceil((hi - lo) / VOXEL).astype(int) + 1
    axes = [lo[k] + np.arange(shape[k]) * VOXEL for k in range(3)]
    X, Y, Z = np.meshgrid(*axes, indexing='ij')
    pts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    field = np.empty(len(pts))
    for i in range(0, len(pts), chunk):
        field[i:i + chunk] = sdf(pts[i:i + chunk])
    field = field.reshape(shape)
    verts, faces, _, _ = marching_cubes(field, 0.0, spacing=(VOXEL,) * 3)
    return verts + lo, faces[:, ::-1].copy()


def vertex_normals(p, f):
    n = np.zeros_like(p)
    fn = np.cross(p[f[:, 1]] - p[f[:, 0]], p[f[:, 2]] - p[f[:, 0]])
    for i in range(3):
        np.add.at(n, f[:, i], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)


def skin_colour(p, rid, groove, tub, seed):
    """Yellow-olive ground, dark saddles, white speckle, pale ridges and tubercles, dark seams."""
    ground = np.array([0.80, 0.70, 0.30])
    saddle = smoothstep(0.2, 0.55, c15.Waves(seed, 14, 7.0, 2)(p + np.array([0, 0, 0.3])))
    col = ground * (1 - saddle[:, None] * 0.72) + np.array([0.34, 0.27, 0.10]) * saddle[:, None] * 0.72
    s1, _ = c15.worley(p, 0.02, seed + 10)
    speck = np.clip(1 - s1 / 0.006, 0, 1)
    col = col * (1 - speck[:, None] * 0.8) + np.array([0.98, 0.96, 0.88]) * speck[:, None] * 0.8
    col = col * (1 + 0.16 * rid[:, None] + 0.3 * tub[:, None])
    col = col * (1 - 0.38 * np.clip(groove, 0, 1))[:, None]
    return np.clip(col, 0, 1)


def body_mesh():
    v, f = polygonise(body_sdf, (-0.12, 0.25, -0.2), (0.12, 1.18, 0.38))
    v, f = decimate(v, f, 16000)
    tt, th = TRUNK.param(v)
    ht, hth = HEAD.param(v)
    on_head = HEAD.sdf(v) < TRUNK.sdf(v)
    t = np.where(on_head, ht, tt)
    theta = np.where(on_head, hth, th)
    rid = np.where(on_head, ridges(theta, (0.0,), 0.22) * smoothstep(0.3, 0.5, t), ridges(theta, TRUNK_RIDGES, 0.2))
    _, groove, joint = plates(t, TRUNK_RINGS)
    groove = np.where(on_head, 0, groove)
    tub = np.where(on_head, 0, rid ** 3 * joint)
    # The coronet and spines read as pale bone.
    crown = smoothstep(1.08, 1.12, v[:, 1]) * (np.abs(v[:, 2] + 0.02) < 0.06)
    col = skin_colour(v, rid, groove, np.maximum(tub, crown * 0.35), 1601)
    # A paler snout and belly, as on the old model.
    belly = smoothstep(0.4, 1.0, -np.cos(theta)) * (~on_head) * smoothstep(0.65, 0.3, t)
    col = col * (1 - 0.3 * belly[:, None]) + np.array([0.92, 0.84, 0.55]) * 0.3 * belly[:, None]
    # One bony-plate texture tile per anatomical plate (the material repeats 3x per UV unit).
    rings = np.where(on_head, 6, TRUNK_RINGS)
    faces = np.where(on_head, 5, len(TRUNK_RIDGES))
    uv = np.stack([(theta + np.pi) / TAU * faces / 3, t * rings / 3], 1)
    return v, f, uv, col


def tail_mesh():
    lo = TAIL.c.min(0) - 0.07
    hi = TAIL.c.max(0) + 0.07
    v, f = polygonise(TAIL.sdf, lo, hi)
    v, f = decimate(v, f, 10000)
    t, theta = TAIL.param(v)
    rid = ridges(theta, TAIL_RIDGES, 0.3)
    _, groove, joint = plates(t, TAIL_RINGS)
    col = skin_colour(v + np.array([0, TAIL_PIVOT, 0]), rid, groove, rid ** 3 * joint, 1601)
    uv = np.stack([(theta + np.pi) / TAU * 4 / 3, t * TAIL_RINGS / 3], 1)
    return v, f, uv, col


def eye_meshes():
    """Eyeballs (Eye) with a dark iris (Iris), set into their bosses, looking out and forward."""
    out = []
    for s in (-1, 1):
        ex, ey, ez = EYES[(s + 1) // 2]
        centre = np.array([ex + s * 0.012, ey, ez + 0.004])
        look = np.array([s * 0.8, 0.05, 0.6])
        look /= np.linalg.norm(look)
        for material, radius, offset, squash in (('Eye', 0.0155, 0.0, 1.0), ('Iris', 0.0085, 0.0118, 0.45)):
            u, w = np.meshgrid(np.linspace(0, TAU, 25)[:-1], np.linspace(0, np.pi, 13))
            d = np.stack([np.sin(w) * np.cos(u), np.cos(w), np.sin(w) * np.sin(u)], -1).reshape(-1, 3)
            # Align +y of the sphere with the look direction, squash along it for the iris.
            ax = np.cross([0, 1, 0], look)
            ang = math.acos(np.clip(look[1], -1, 1))
            ax = ax / (np.linalg.norm(ax) + 1e-12)
            K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
            R = np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K
            local = d * np.array([radius, radius * squash, radius])
            pts = local @ R.T + centre + look * offset
            rows, cols = 13, 24
            faces = []
            for i in range(rows - 1):
                for j in range(cols):
                    a, b = i * cols + j, i * cols + (j + 1) % cols
                    faces += [(a, a + cols, b), (b, a + cols, b + cols)]
            col = np.tile([0.85, 0.8, 0.55] if material == 'Eye' else [0.05, 0.05, 0.04], (len(pts), 1))
            uv = np.zeros((len(pts), 2))
            out.append((material, pts, np.array(faces), uv, col))
    return out


def fin(base_a, base_b, tips, rays, edge_bulge=0.08, corrugate=0.0012, normal=(1, 0, 0)):
    """A rayed membrane: rays fan from a base line to a scalloped margin through `tips`."""
    base_a, base_b = np.asarray(base_a, float), np.asarray(base_b, float)
    tips = np.asarray(tips, float)
    normal = np.asarray(normal, float)
    rows = 9
    pos = []
    for j in range(rays):
        u = j / (rays - 1)
        b = base_a + (base_b - base_a) * u
        # The margin: interpolate the given tip polyline, scalloped between rays.
        k = u * (len(tips) - 1)
        i0 = min(int(k), len(tips) - 2)
        tip = tips[i0] + (tips[i0 + 1] - tips[i0]) * (k - i0)
        for i in range(rows):
            w = i / (rows - 1)
            pt = b + (tip - b) * w
            pos.append(pt + normal * corrugate * (1 if j % 2 else -1) * w)
    # Scallops: pull the margin in halfway between rays (insert mid columns).
    pos = np.array(pos)
    faces = []
    for j in range(rays - 1):
        for i in range(rows - 1):
            a = j * rows + i
            faces += [(a, a + rows, a + 1), (a + 1, a + rows, a + rows + 1)]
    return pos, np.array(faces)


def fins():
    # Dorsal: along the back, local to its pivot; rays sweep back (-z), margin rounded.
    d_tips = [(0, -0.05, -0.07), (0, -0.03, -0.118), (0, 0.0, -0.13), (0, 0.03, -0.112), (0, 0.045, -0.06)]
    dorsal = fin((0, -0.055, 0), (0, 0.045, 0), d_tips, 18)
    # Pectoral: a small rounded fan behind the gill cover, local to its pivot; rays out (+x) and back.
    p_tips = [(0.022, -0.025, 0.012), (0.04, -0.012, 0.03), (0.045, 0.008, 0.05), (0.03, 0.022, 0.06)]
    pect = fin((0, -0.02, 0), (0, 0.02, 0.008), p_tips, 11, normal=(0, 0, 1), corrugate=0.0008)
    return dorsal, pect


# ------------------------------------------------------------------ Blender


def to_blender(p):
    return np.stack([p[:, 0], -p[:, 2], p[:, 1]], 1)


def material(name):
    """Authoring materials (the splice swaps in the shipped ones by name): the Pass 015 skin with
    its bony-plate maps over vertex colour, glossy eyes, and the translucent fin membrane."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    if name == 'HorseSkin15':
        return c15.skin_material('HorseSkin15', 'bony-plate', 0.6, 0.8, 3.0)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    if name in ('Eye', 'Iris'):
        vc = m.node_tree.nodes.new('ShaderNodeVertexColor')
        vc.layer_name = 'Col'
        m.node_tree.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = 0.22 if name == 'Eye' else 0.32
    else:
        bsdf.inputs['Base Color'].default_value = (0.75, 0.72, 0.45, 1)
        bsdf.inputs['Alpha'].default_value = 0.55
        bsdf.inputs['Roughness'].default_value = 0.6
        m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else None
    return m


def make(name, parts, parent):
    """parts: [(material, positions, faces, uv, colour or None)]"""
    me = bpy.data.meshes.new(name)
    verts, faces, uvs, cols, mats, offset = [], [], [], [], [], 0
    names = []
    for m, p, f, uv, col in parts:
        if m not in names:
            names.append(m)
        verts.append(p)
        faces.append(f + offset)
        uvs.append(uv)
        cols.append(col if col is not None else np.ones((len(p), 3)))
        mats += [names.index(m)] * len(f)
        offset += len(p)
    v = np.concatenate(verts)
    f = np.concatenate(faces)
    me.from_pydata(to_blender(v).tolist(), [], f.tolist())
    for m in names:
        me.materials.append(material(m))
    me.polygons.foreach_set('material_index', mats)
    uv = np.concatenate(uvs)
    layer = me.uv_layers.new(name='UVMap')
    loops = np.empty(len(me.loops), int)
    me.loops.foreach_get('vertex_index', loops)
    layer.data.foreach_set('uv', uv[loops].ravel())
    if any(c is not None for *_, c in parts):
        col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        lin = c15.srgb_to_linear(np.clip(np.concatenate(cols), 0, 1))
        col.data.foreach_set('color', np.concatenate([lin, np.ones((len(lin), 1))], 1).ravel())
        me.color_attributes.active_color = col
    for poly in me.polygons:
        poly.use_smooth = True
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.parent = parent
    return o


def build(out):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    root = bpy.data.objects.new('Seahorse', None)
    bpy.context.scene.collection.objects.link(root)
    v, f, uv, col = body_mesh()
    make('HorseBody', [('HorseSkin15', v, f, uv, col)] + eye_meshes(), root)
    v, f, uv, col = tail_mesh()
    make('HorseTail', [('HorseSkin15', v, f, uv, col)], root)
    (dp, df), (pp, pf) = fins()
    make('HorseDorsal', [('Fine_Membrane', dp, df, np.zeros((len(dp), 2)), None)], root)
    make('HorseLeftFin', [('Fine_Membrane', pp, pf, np.zeros((len(pp), 2)), None)], root)
    mirrored = pp * np.array([-1, 1, 1])
    make('HorseRightFin', [('Fine_Membrane', mirrored, pf[:, ::-1], np.zeros((len(pp), 2)), None)], root)
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'seahorse.blend'), compress=True)
    bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', export_yup=True, export_extras=True,
                              export_animations=False, export_vertex_color='ACTIVE')
    for o in root.children:
        print(o.name, len(o.data.polygons), 'tris')


if __name__ == '__main__':
    build(Path(sys.argv[1]))
