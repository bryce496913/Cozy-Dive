"""Pass 014 reef geometry: numpy construction shared by the Blender build and CPU checks.

Coordinates are game space (X right, Y up, Z toward the default camera). Every builder is
seeded and deterministic. Structural pieces conform to the accepted pre-Pass-014 envelopes in
baseline.json: rocks are carved *inside* their accepted convex hull with upward attachment faces
preserved; corals follow the exact structural parts their colliders already describe. Fine
growth that is intentionally passable (secondary branches, polyps, fronds) is labelled as such.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from scipy.spatial import ConvexHull, cKDTree

HERE = Path(__file__).resolve().parent
BASELINE = json.loads((HERE / 'baseline.json').read_text())
TAU = math.tau


@dataclass
class Mesh:
    name: str
    material: str
    positions: np.ndarray
    faces: np.ndarray
    uvs: np.ndarray
    colors: np.ndarray  # RGBA in [0,1]; alpha carries plant phase or is 1
    extras: dict = field(default_factory=dict)

    @property
    def triangles(self) -> int:
        return int(len(self.faces))


@dataclass
class Asset:
    name: str
    meshes: list[Mesh]
    colliders: list[np.ndarray] = field(default_factory=list)  # convex point sets (game space)
    extras: dict = field(default_factory=dict)


def merge(name: str, material: str, parts: list[Mesh]) -> Mesh:
    offset = 0
    faces = []
    for p in parts:
        faces.append(p.faces + offset)
        offset += len(p.positions)
    return Mesh(
        name,
        material,
        np.concatenate([p.positions for p in parts]),
        np.concatenate(faces),
        np.concatenate([p.uvs for p in parts]),
        np.concatenate([p.colors for p in parts]),
    )


# ---------------------------------------------------------------- noise


class Waves:
    """Smooth deterministic 3D noise from summed random plane waves (cheap, tileable-free)."""

    def __init__(self, seed: int, count: int = 24, base: float = 2.0, octaves: int = 3):
        r = np.random.default_rng(seed)
        dirs = r.standard_normal((count * octaves, 3))
        dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
        freq = np.repeat(base * 2.0 ** np.arange(octaves), count) * (0.75 + r.random(count * octaves) * 0.5)
        amp = np.repeat(0.5 ** np.arange(octaves), count)
        self.k = dirs * freq[:, None]
        self.phase = r.random(count * octaves) * TAU
        self.amp = amp / np.sqrt(count) / amp[:count].sum() * count ** 0.5

    def __call__(self, p: np.ndarray) -> np.ndarray:
        return (np.sin(p @ self.k.T + self.phase) * self.amp).sum(1)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- primitives


def icosphere(level: int) -> tuple[np.ndarray, np.ndarray]:
    t = (1 + 5 ** 0.5) / 2
    v = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t),
         (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6),
         (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10),
         (8, 6, 7), (9, 8, 1)]
    verts = [np.array(p, float) / np.linalg.norm(p) for p in v]
    faces = f
    for _ in range(level):
        cache: dict[tuple[int, int], int] = {}

        def mid(a, b):
            key = (min(a, b), max(a, b))
            if key not in cache:
                m = verts[a] + verts[b]
                verts.append(m / np.linalg.norm(m))
                cache[key] = len(verts) - 1
            return cache[key]

        nf = []
        for a, b, c in faces:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            nf += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        faces = nf
    return np.array(verts), np.array(faces, dtype=np.int64)


def neighbours(n: int, faces: np.ndarray) -> list[np.ndarray]:
    adj: list[set[int]] = [set() for _ in range(n)]
    for a, b, c in faces:
        adj[a].update((b, c))
        adj[b].update((a, c))
        adj[c].update((a, b))
    return [np.fromiter(s, int) for s in adj]


def laplacian(values: np.ndarray, adj: list[np.ndarray], iterations: int) -> np.ndarray:
    out = values.copy()
    for _ in range(iterations):
        out = np.array([out[a].mean(0) for a in adj]) * 0.5 + out * 0.5
    return out


def vertex_normals(p: np.ndarray, f: np.ndarray) -> np.ndarray:
    n = np.zeros_like(p)
    fn = np.cross(p[f[:, 1]] - p[f[:, 0]], p[f[:, 2]] - p[f[:, 0]])
    for i in range(3):
        np.add.at(n, f[:, i], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)


def frame(tangent: np.ndarray, previous: np.ndarray | None = None) -> tuple[np.ndarray, np.ndarray]:
    """Parallel transport: project the previous ring normal onto the new ring plane (no flips)."""
    t = tangent / np.linalg.norm(tangent)
    if previous is None:
        ref = np.array([0, 0, 1.0]) if abs(t[1]) > 0.9 else np.array([0, 1.0, 0])
        n = np.cross(t, ref)
    else:
        n = previous - t * np.dot(previous, t)
    if np.linalg.norm(n) < 1e-6:
        n = np.cross(t, np.array([1.0, 0, 0]))
    n /= np.linalg.norm(n)
    b = np.cross(t, n)
    return n, b


def tube(points: np.ndarray, radii: np.ndarray, sides: int, color, cap=True, profile=None, v_scale=1.0,
         phase: float = 1.0, flatten: float = 1.0) -> Mesh:
    """Parallel-transport swept tube with a closed tapered tip; `profile(i, angle)` scales radius."""
    points = np.asarray(points, float)
    radii = np.asarray(radii, float)
    rings = len(points)
    tangents = np.gradient(points, axis=0)
    pos, uv = [], []
    prev_n = None
    length = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(points, axis=0), axis=1))])
    for i in range(rings):
        n, b = frame(tangents[i], prev_n)
        prev_n = n
        for s in range(sides + 1):
            a = s / sides * TAU
            r = radii[i] * (profile(i, a) if profile else 1.0)
            pos.append(points[i] + (n * math.cos(a) * flatten + b * math.sin(a)) * r)
            uv.append((s / sides, length[i] * v_scale))
    faces = []
    w = sides + 1
    for i in range(rings - 1):
        for s in range(sides):
            a, b_, c, d = i * w + s, i * w + s + 1, (i + 1) * w + s, (i + 1) * w + s + 1
            faces += [(a, b_, c), (b_, d, c)]
    if cap:
        tip = points[-1] + tangents[-1] / (np.linalg.norm(tangents[-1]) + 1e-9) * radii[-1] * 0.8
        pos.append(tip)
        uv.append((0.5, length[-1] * v_scale + radii[-1]))
        t = len(pos) - 1
        base = (rings - 1) * w
        faces += [(base + s, base + s + 1, t) for s in range(sides)]
    pos = np.array(pos)
    col = np.tile(np.array([*color, phase]), (len(pos), 1))
    return Mesh('tube', '', pos, np.array(faces, np.int64), np.array(uv, float), col)


def curve(points: np.ndarray, samples: int) -> np.ndarray:
    """Catmull-Rom resampling through control points."""
    p = np.asarray(points, float)
    p = np.vstack([p[0] * 2 - p[1], p, p[-1] * 2 - p[-2]])
    out = []
    segs = len(p) - 3
    for i in range(samples):
        t = i / (samples - 1) * segs
        k = min(int(t), segs - 1)
        u = t - k
        p0, p1, p2, p3 = p[k:k + 4]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
    return np.array(out)


def ribbon(spine: np.ndarray, widths: np.ndarray, twist: np.ndarray, side_axis: np.ndarray, color, phase,
           columns: int = 3, fold: float = 0.0) -> Mesh:
    """Double-sided-ready blade strip with a midrib fold, twisted around its spine."""
    rows = len(spine)
    tangents = np.gradient(spine, axis=0)
    pos, uv = [], []
    for i in range(rows):
        t = tangents[i] / np.linalg.norm(tangents[i])
        side = side_axis - t * np.dot(side_axis, t)
        side /= np.linalg.norm(side) + 1e-9
        normal = np.cross(t, side)
        c, s = math.cos(twist[i]), math.sin(twist[i])
        side, normal = side * c + normal * s, normal * c - side * s
        for j in range(columns):
            x = j / (columns - 1) * 2 - 1
            pos.append(spine[i] + side * x * widths[i] * 0.5 + normal * fold * widths[i] * (1 - abs(x)))
            uv.append((j / (columns - 1), i / (rows - 1)))
    faces = []
    for i in range(rows - 1):
        for j in range(columns - 1):
            a = i * columns + j
            b = a + columns
            faces += [(a, b, a + 1), (b, b + 1, a + 1)]
    pos = np.array(pos)
    return Mesh('blade', '', pos, np.array(faces, np.int64), np.array(uv), np.tile([*color, phase], (len(pos), 1)))


def blob(center, radius, level, color, noise: Waves | None = None, amp=0.0, squash=(1, 1, 1)) -> Mesh:
    d, f = icosphere(level)
    r = radius * (1 + (noise(d * 1.0) * amp if noise else np.zeros(len(d))))
    p = center + d * r[:, None] * np.array(squash)
    uv = np.stack([np.arctan2(d[:, 2], d[:, 0]) / TAU + 0.5, d[:, 1] * 0.5 + 0.5], 1)
    return Mesh('blob', '', p, f, uv, np.tile([*color, 1.0], (len(p), 1)))


def box_uv(p: np.ndarray, n: np.ndarray, scale: float) -> np.ndarray:
    """Per-vertex planar projection by dominant normal axis (runtime rocks use triplanar)."""
    a = np.abs(n).argmax(1)
    uv = np.where(a[:, None] == 0, p[:, [2, 1]], np.where(a[:, None] == 1, p[:, [0, 2]], p[:, [0, 1]]))
    return uv * scale


# ---------------------------------------------------------------- reef rock


ARCHETYPES = ['porous-limestone', 'organic-outcrop', 'layered-sedimentary', 'layered-sedimentary',
              'crevice-overhang', 'porous-limestone']
SAND_LINE = -0.61  # rocks sit at y = height * 0.61, so local y = -0.61 is the sand plane


class HullRay:
    def __init__(self, points: np.ndarray):
        self.points = points
        self.hull = ConvexHull(points)
        self.eq = self.hull.equations  # n.x + d <= 0 inside
        self.center = points[self.hull.vertices].mean(0)

    def cast(self, dirs: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        n = self.eq[:, :3]
        off = -(self.eq[:, 3] + n @ self.center)  # plane distance from centre
        nd = dirs @ n.T
        with np.errstate(divide='ignore', invalid='ignore'):
            t = np.where(nd > 1e-9, off[None, :] / nd, np.inf)
        idx = t.argmin(1)
        return t[np.arange(len(dirs)), idx], n[idx]

    def inside(self, p: np.ndarray, eps=1e-6) -> np.ndarray:
        return (p @ self.eq[:, :3].T + self.eq[:, 3] <= eps).all(1)


def fracture(d: np.ndarray, r: np.ndarray, normal: np.ndarray, keep: float) -> np.ndarray:
    """Depth that flattens the hull beyond a plane: a broken, planar fracture face."""
    n = normal / np.linalg.norm(normal)
    reach = (r * (d @ n)).max()
    with np.errstate(divide='ignore'):
        limit = np.where(d @ n > 1e-6, reach * keep / np.maximum(d @ n, 1e-6), np.inf)
    return np.maximum(r - limit, 0)


def carve_depth(kind: str, d: np.ndarray, base: np.ndarray, hull_n: np.ndarray, r: np.ndarray, seed: int,
                adj: list[np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    """Inward carving (>= 0) in unit-rock space and a 'fresh fracture' mask.

    Upward attachment faces (hull normal y >= ~0.6) stay within a shallow tolerance so corals,
    plants and the host anemone remain seated on the accepted surface."""
    rng = np.random.default_rng(seed)
    y = base[:, 1]
    side = 1 - smoothstep(0.42, 0.66, hull_n[:, 1])  # 0 on attachment-capable tops
    below = smoothstep(SAND_LINE - 0.05, SAND_LINE + 0.1, y)  # buried region keeps a sand skirt
    erosion = Waves(seed + 1, 20, 3.4, 4)
    big = Waves(seed + 2, 16, 1.4, 2)
    knobs = Waves(seed + 3, 24, 5.5, 2)
    # Rounding: remove hull facet creases by carving toward a smoothed radius (always inward).
    rounded = laplacian(r[:, None], adj, 10)[:, 0]
    depth = np.maximum(r - rounded, 0) * 1.4
    depth += (0.5 + 0.5 * erosion(base)) * 0.045 * side
    depth += np.maximum(knobs(base), 0) * 0.035 * side
    fresh = np.zeros(len(d))

    def cut(count: int, keep: tuple[float, float]):
        nonlocal depth, fresh
        for _ in range(count):
            a = rng.random() * TAU
            n = np.array([math.cos(a), (rng.random() - 0.5) * 0.5, math.sin(a)])
            f = fracture(d, r, n, keep[0] + rng.random() * (keep[1] - keep[0])) * side
            fresh = np.maximum(fresh, np.clip(f * 12, 0, 1))
            depth = np.maximum(depth, f + depth * 0.4)

    if kind == 'porous-limestone':
        pits = rng.standard_normal((44, 3))
        pits /= np.linalg.norm(pits, axis=1, keepdims=True)
        size = 0.06 + rng.random(44) * 0.14
        deep = 0.06 + rng.random(44) * 0.16
        for c, sz, k in zip(pits, size, deep):
            ang = np.arccos(np.clip(d @ c, -1, 1))
            depth += k * np.exp(-(ang / sz) ** 4) * side  # flat-bottomed solution holes
        for _ in range(3):  # broad erosion embayments break the boulder outline
            c = rng.standard_normal(3) * np.array([1, 0.3, 1])
            c /= np.linalg.norm(c)
            depth += 0.2 * np.exp(-(np.arccos(np.clip(d @ c, -1, 1)) / 0.45) ** 2) * side
        cut(2, (0.8, 0.9))
    elif kind == 'organic-outcrop':
        lobes = rng.standard_normal((7, 3)) * np.array([1, 0.35, 1])
        lobes /= np.linalg.norm(lobes, axis=1, keepdims=True)
        keep = np.zeros(len(d))
        for c in lobes:
            keep = np.maximum(keep, np.exp(-(np.arccos(np.clip(d @ c, -1, 1)) / 0.4) ** 2))
        # Deep recesses between lobes; lobes read as protrusions with ledges and undercuts.
        shelf = np.sin(y * 7.5 + big(base) * 1.5)
        undercut = smoothstep(-0.2, 0.6, -shelf) * 0.08
        depth += (1 - keep) * 0.2 * side + undercut * side
        depth += (0.5 + 0.5 * big(base * 2.2)) * 0.05 * side
    elif kind == 'layered-sedimentary':
        warp = big(base * 0.8) * 0.06
        layer_y = (y + warp) * 6.0 + seed % 7 * 0.13
        k = np.floor(layer_y)
        recess = (np.sin(k * 12.9898 + seed) * 43758.5453) % 1  # per-stratum offset
        frac = layer_y - k
        groove = np.exp(-((frac - 0.06) / 0.08) ** 2)  # weathered bedding seam
        lip = smoothstep(0.75, 1.0, frac) * 0.05  # overhanging stratum lips
        depth += (recess * 0.15 + groove * 0.08 + lip) * side
        cut(3, (0.72, 0.86))
    elif kind == 'crevice-overhang':
        # Two narrow vertical clefts and a sheltered undercut beneath an upper ledge.
        for angle in (0.4 + seed % 3 * 0.2, 2.5):
            c = np.array([math.cos(angle), 0, math.sin(angle)])
            width = 0.09 + 0.035 * np.sin(y * 7 + angle)
            lateral = np.abs(d @ np.array([-c[2], 0, c[0]]))
            facing = d @ c
            mouth = (facing > 0.2) * np.exp(-(lateral / width) ** 2)
            depth += mouth * 0.42 * smoothstep(SAND_LINE, SAND_LINE + 0.2, y) * (1 - smoothstep(0.25, 0.6, y))
        c = np.array([math.cos(4.3), 0, math.sin(4.3)])
        undercut = smoothstep(0.15, 0.7, d @ c) * np.exp(-((y + 0.15) / 0.22) ** 2)
        depth += undercut * 0.36
        depth += (0.5 + 0.5 * big(base * 1.8)) * 0.07 * side
        cut(1, (0.8, 0.86))
    depth *= below
    depth = laplacian(depth[:, None], adj, 2)[:, 0]
    # Preserve attachment-capable tops within a shallow tolerance.
    depth = np.minimum(depth, r * 0.46) * (0.12 + 0.88 * side)
    return depth, fresh * side


def support_points(points: np.ndarray, count: int = 96) -> np.ndarray:
    """Extreme points along a Fibonacci sphere of directions plus box diagonals.

    Their hull is a subset of the full point hull, so a reduced collider never adds volume."""
    i = np.arange(count) + 0.5
    y = 1 - 2 * i / count
    r = np.sqrt(1 - y * y)
    a = i * 2.399963
    dirs = np.stack([np.cos(a) * r, y, np.sin(a) * r], 1)
    diag = np.array([[x, yy, z] for x in (-1, 0, 1) for yy in (-1, 0, 1) for z in (-1, 0, 1) if x or yy or z], float)
    dirs = np.vstack([dirs, diag / np.linalg.norm(diag, axis=1, keepdims=True)])
    chosen = np.unique((points @ dirs.T).argmax(0))
    return points[chosen]


def kmeans(points: np.ndarray, k: int, seed: int) -> np.ndarray:
    r = np.random.default_rng(seed)
    c = points[r.choice(len(points), k, replace=False)]
    for _ in range(30):
        label = cKDTree(c).query(points)[1]
        c = np.array([points[label == i].mean(0) if (label == i).any() else c[i] for i in range(k)])
    return cKDTree(c).query(points)[1]


def reef_rock(index: int, levels: tuple[int, ...] = (5, 4, 3)) -> Asset:
    kind = ARCHETYPES[index]
    pts = np.array(BASELINE['majorTemplates'][index]['points'])
    ray = HullRay(pts)
    meshes = []
    carved_points = None
    for lv, suffix in zip(levels, ('', '_LOD1', '_LOD2')):
        d, f = icosphere(lv)
        r, hn = ray.cast(d)
        base = ray.center + d * r[:, None]
        adj = neighbours(len(d), f)
        depth, fresh = carve_depth(kind, d, base, hn, r, 9100 + index * 37, adj)
        p = ray.center + d * (r - depth)[:, None]
        assert ray.inside(p, 1e-5).all(), 'carving must stay inside the accepted hull'
        n = vertex_normals(p, f)
        cav = np.clip(depth / 0.2, 0, 1)
        concave = np.clip((laplacian(depth[:, None], adj, 3)[:, 0] - depth) * -25, 0, 1)
        # Mineral patches: warm beige, cool grey and a faint green-grey, blended by broad noise.
        patch = Waves(9200 + index, 10, 1.6, 2)(p)
        beige = np.array([0.93, 0.86, 0.74])
        grey = np.array([0.80, 0.80, 0.77])
        green = np.array([0.74, 0.78, 0.66])
        w = smoothstep(-0.4, 0.4, patch)[:, None]
        col = beige * w + grey * (1 - w)
        col = col * (1 - 0.25 * smoothstep(0.3, 0.8, -patch)[:, None]) + green * 0.25 * smoothstep(0.3, 0.8, -patch)[:, None]
        col *= (1 - np.maximum(cav, concave)[:, None] * 0.5)
        up = np.clip(n[:, 1], 0, 1)
        film = up * smoothstep(0.1, 0.6, Waves(9300 + index, 10, 2.5, 2)(p))
        col = col * (1 - film[:, None] * 0.4) + film[:, None] * np.array([0.56, 0.66, 0.46]) * 0.4
        coralline = smoothstep(0.35, 0.7, Waves(9350 + index, 14, 3.0, 2)(p)) * (1 - cav)
        col = col * (1 - coralline[:, None] * 0.45) + coralline[:, None] * np.array([0.78, 0.55, 0.64]) * 0.45
        col = col * (1 - fresh[:, None] * 0.35) + fresh[:, None] * np.array([0.98, 0.96, 0.91]) * 0.35
        dust = 1 - smoothstep(SAND_LINE - 0.02, SAND_LINE + 0.2, p[:, 1])  # sand-burial transition
        col = col * (1 - dust[:, None] * 0.65) + dust[:, None] * np.array([0.88, 0.82, 0.70]) * 0.65
        rgba = np.concatenate([np.clip(col, 0, 1), np.ones((len(p), 1))], 1)
        meshes.append(Mesh(f'Rock_{index}{suffix}', 'ReefRock', p, f, box_uv(p, n, 0.9), rgba,
                           {'archetype': kind}))
        if carved_points is None:
            carved_points = p
    # Multiple convex parts from the carved surface: every part is inside the accepted hull.
    k = 10 if kind == 'crevice-overhang' else 7
    label = kmeans(carved_points, k, 9400 + index)
    colliders = [support_points(carved_points[label == i]) for i in range(k) if (label == i).sum() >= 8]
    return Asset(f'Rock_{index}', meshes, colliders, {'archetype': kind})


def pebble(index: int) -> Asset:
    """Small passable rubble from the three accepted pebble envelopes."""
    pts = np.array(BASELINE['pebbleTemplates'][index]['points'])
    ray = HullRay(pts)
    d, f = icosphere(2)
    r, hn = ray.cast(d)
    base = ray.center + d * r[:, None]
    adj = neighbours(len(d), f)
    depth = carve_depth(['porous-limestone', 'layered-sedimentary', 'organic-outcrop'][index], d, base, hn, r,
                        9500 + index, adj)[0] * 0.8
    p = ray.center + d * (r - depth)[:, None]
    n = vertex_normals(p, f)
    cav = np.clip(depth / 0.15, 0, 1)
    col = np.array([0.95, 0.91, 0.84]) * (1 - cav[:, None] * 0.4)
    rgba = np.concatenate([col, np.ones((len(p), 1))], 1)
    return Asset(f'Pebble_{index}', [Mesh(f'Pebble_{index}', 'ReefRock', p, f, box_uv(p, n, 0.9), rgba)])


# ---------------------------------------------------------------- hard coral


def principal_axis(points: np.ndarray) -> tuple[np.ndarray, np.ndarray, float]:
    c = points.mean(0)
    u, s, vt = np.linalg.svd(points - c)
    axis = vt[0]
    proj = (points - c) @ axis
    a, b = c + axis * proj.min(), c + axis * proj.max()
    if a[1] > b[1]:
        a, b = b, a
    radial = np.linalg.norm((points - c) - np.outer(proj, axis), axis=1)
    return a, b, float(np.percentile(radial, 60))


def branching_coral(formation: dict, variant: int) -> Asset:
    """Acropora-like colony: primaries follow the structural capsules; growth beyond is passable."""
    rng = np.random.default_rng(14100 + variant)
    noise = Waves(14110 + variant, 12, 3.0, 2)
    parts = [np.array(p) for p in formation['parts']]
    tissue, tips = [], []
    tint = [(0.80, 0.58, 0.46), (0.62, 0.56, 0.74), (0.72, 0.74, 0.50)][variant]
    tip_tint = tuple(min(1.0, c * 1.3 + 0.08) for c in tint)
    primaries = []
    for k, pts in enumerate(parts):
        a, b, radius = principal_axis(pts)
        # The capsule hull is radius ~0.09 -> 0.045 plus endcaps; stay just inside it.
        a = a + (b - a) / np.linalg.norm(b - a) * radius * 0.8
        b = b - (b - a) / np.linalg.norm(b - a) * radius * 0.6
        ctrl = np.array([a, a * 0.66 + b * 0.34, a * 0.33 + b * 0.67, b])
        ctrl[1:3] += (rng.random((2, 3)) - 0.5) * 0.02
        spine = curve(ctrl, 12)
        t = np.linspace(0, 1, 12)
        radii = (0.082 * (1 - t) + 0.04 * t) * (0.94 + 0.06 * np.sin(t * 9 + k))
        tissue.append(tube(spine, radii, 10, tint, profile=lambda i, ang: 1 + 0.06 * math.sin(ang * 3 + i)))
        primaries.append((spine, radii))
    # Fused junction collars where primaries leave each other.
    for spine, radii in primaries[1:]:
        tissue.append(blob(spine[0], radii[0] * 1.25, 2, tint, noise, 0.12, (1, 0.8, 1)))
    # Secondary and tertiary passable growth with irregular directions and thickness.
    out = 0
    for spine, radii in primaries:
        for j in range(7 + rng.integers(0, 4)):
            i = int(rng.integers(3, 11))
            start = spine[i]
            tangent = spine[min(i + 1, 11)] - spine[i - 1]
            tangent /= np.linalg.norm(tangent)
            side = rng.standard_normal(3)
            side -= tangent * side @ tangent
            side /= np.linalg.norm(side)
            direction = tangent * 0.55 + side * 0.65 + np.array([0, 0.45, 0])
            direction /= np.linalg.norm(direction)
            length = 0.12 + rng.random() * 0.2
            bend = np.array([0, 0.04, 0]) + (rng.random(3) - 0.5) * 0.05
            ctrl = np.array([start, start + direction * length * 0.5 + bend * 0.5, start + direction * length + bend])
            sp = curve(ctrl, 6)
            r0 = radii[i] * (0.6 + rng.random() * 0.15)
            rr = np.linspace(r0, 0.02, 6)
            tissue.append(tube(sp, rr, 7, tint))
            tips.append(tube(np.array([sp[-1], sp[-1] + direction * 0.03]), np.array([0.018, 0.011]), 6,
                             tip_tint))
            out += 1
            if rng.random() < 0.6:  # tertiary
                p0 = sp[3]
                d2 = direction + (rng.random(3) - 0.5) * 0.8
                d2[1] = abs(d2[1]) + 0.3
                d2 /= np.linalg.norm(d2)
                sp2 = curve(np.array([p0, p0 + d2 * 0.06, p0 + d2 * 0.11]), 4)
                tissue.append(tube(sp2, np.linspace(rr[3] * 0.8, 0.012, 4), 6, tint))
                tips.append(tube(np.array([sp2[-1], sp2[-1] + d2 * 0.022]), np.array([0.013, 0.008]), 6,
                                 tip_tint))
    # Encrusting basal plate where the colony meets rock or sand.
    base = blob(np.array([0, 0.0, 0]), 0.2, 3, tint, noise, 0.2, (1.15, 0.18, 1.0))
    tissue.append(base)
    body = merge('Coral_Branching_%d' % variant, 'CoralPolyp', tissue)
    shade_by_height(body, 0.0, 1.8, 0.82)
    tipmesh = merge('Coral_Branching_%d_Tips' % variant, 'CoralPolyp', tips)
    return Asset('Coral_Branching_%d' % variant, [body, tipmesh], [p for p in parts],
                 {'kind': 'branching', 'formation': formation['index'], 'passableGrowth': out})


def shade_by_height(m: Mesh, y0: float, y1: float, low: float) -> None:
    t = np.clip((m.positions[:, 1] - y0) / (y1 - y0), 0, 1)
    m.colors[:, :3] *= (low + (1 - low) * t)[:, None]


def massive_coral(formation: dict, variant: int) -> Asset:
    """Lobed brain / boulder colony: each structural lobe carved inward with maze-like valleys."""
    parts = [np.array(p) for p in formation['parts']]
    tint = [(0.78, 0.72, 0.58), (0.74, 0.64, 0.66), (0.68, 0.70, 0.62)][variant]
    valley_tint = [(0.52, 0.54, 0.42), (0.50, 0.44, 0.50), (0.56, 0.54, 0.48)][variant]
    meshes = []
    maze = Waves(14200 + variant, 32, 12.0, 2)
    warp = Waves(14230 + variant, 12, 2.0, 2)
    for k, pts in enumerate(parts):
        ray = HullRay(pts)
        d, f = icosphere(4)
        r, hn = ray.cast(d)
        adj = neighbours(len(d), f)
        rounded = laplacian(r[:, None], adj, 14)[:, 0]
        base = ray.center + d * np.minimum(rounded, r)[:, None]
        if variant < 2:
            # Zero crossings of band-limited noise form a meandering maze of valleys.
            field = maze(base + warp(base)[:, None] * 0.08)
            field /= field.std() + 1e-9
            valley = np.exp(-(field / 0.3) ** 2)
            depth = valley * 0.04
        else:
            field = Waves(14250 + k, 18, 9.0, 2)(base)
            field /= field.std() + 1e-9
            valley = np.clip(-field, 0, 1.5) / 1.5
            depth = valley * 0.035
        # Underside tucks in toward the substrate so lobes read as massed growth, not balls.
        tuck = smoothstep(0.0, -0.8, d[:, 1]) * 0.12
        depth += np.maximum(r - rounded, 0) + tuck * (r - depth)
        depth = laplacian(depth[:, None], adj, 1)[:, 0]
        depth = np.minimum(depth, r * 0.45)
        p = ray.center + d * (np.minimum(rounded, r) - depth)[:, None]
        n = vertex_normals(p, f)
        col = np.array(tint) * (1 - valley[:, None]) + np.array(valley_tint) * valley[:, None]
        col *= (0.65 + 0.35 * smoothstep(-0.6, 0.3, d[:, 1]))[:, None]
        uv = box_uv(p, n, 3.0)
        meshes.append(Mesh(f'Coral_Massive_{variant}_Lobe_{k}', 'CoralBrain' if variant < 2 else 'CoralPolyp', p, f,
                           uv, np.concatenate([col, np.ones((len(p), 1))], 1)))
    body = merge(f'Coral_Massive_{variant}', meshes[0].material, meshes)
    return Asset(f'Coral_Massive_{variant}', [body], parts, {'kind': 'rounded', 'formation': formation['index']})

def plate_coral(formation: dict, variant: int) -> Asset:
    """Tiered plating colony: organic trunk and struts carrying scalloped, ridged, upturned plates."""
    parts = [np.array(p) for p in formation['parts']]
    rng = np.random.default_rng(14300 + variant)
    tint = [(0.72, 0.62, 0.42), (0.76, 0.56, 0.52), (0.58, 0.60, 0.70)][variant]
    rim_tint = tuple(min(1.0, c * 1.25) for c in tint)
    stem_pts, plates = parts[0], parts[1:]
    a, b, radius = principal_axis(stem_pts)
    pieces = []
    spine = curve(np.array([a + [0, 0.02, 0], a * 0.6 + b * 0.4 + [0.02, 0, 0.01], b - [0, 0.05, 0]]), 10)
    pieces.append(tube(spine, np.linspace(radius * 0.95, radius * 0.7, 10), 12, tint,
                       profile=lambda i, ang: 1 + 0.07 * math.sin(ang * 3 + i * 0.9)))
    rim_noise = Waves(14310 + variant, 10, 2.0, 3)
    for k, pts in enumerate(plates):
        c = pts.mean(0)
        top, bottom = pts[:, 1].max(), pts[:, 1].min()
        rr = np.linalg.norm((pts - c)[:, [0, 2]], axis=1).max()
        thick = (top - bottom) * 0.5
        rings, sectors = 12, 96
        scallops = 7 + k * 2 + variant
        top_pos, bot_pos, uv, col = [], [], [], []
        for i in range(rings + 1):
            t = (i / rings) ** 0.8
            for s_ in range(sectors):
                ang = s_ / sectors * TAU
                dirv = np.array([math.cos(ang), 0, math.sin(ang)])
                edge = rr * (0.84 + 0.08 * rim_noise(dirv[None] * 1.7 + k)[0] + 0.05 * math.sin(ang * scallops + k))
                rad = edge * t
                wave = 0.025 * math.sin(ang * 4 + k * 1.7 + variant) * t ** 1.5
                upturn = 0.05 * t ** 3
                ridge = 0.005 * math.sin(ang * 70 + t * 4) * t
                mid = c[1] - 0.01 + wave + upturn
                half = thick * (0.62 * (1 - t) + 0.28)
                top_pos.append([c[0] + dirv[0] * rad, mid + half + ridge, c[2] + dirv[2] * rad])
                bot_pos.append([c[0] + dirv[0] * rad, mid - half * 0.8, c[2] + dirv[2] * rad])
                uv.append([dirv[0] * rad * 2 + 0.5, dirv[2] * rad * 2 + 0.5])
                growth = 0.5 + 0.5 * math.sin(t * 34)
                rim = smoothstep(0.8, 1.0, np.array(t))
                col.append(np.array(tint) * (0.92 + 0.08 * growth) * (1 - rim) + np.array(rim_tint) * rim)
        pos = np.array(top_pos + bot_pos)
        uv = np.array(uv + uv)
        col = np.array(col + col)
        half_n = len(top_pos)
        col[half_n:] *= 0.74  # shaded underside
        faces = []
        for side_index, off in enumerate((0, half_n)):
            for i in range(rings):
                for s_ in range(sectors):
                    a0 = off + i * sectors + s_
                    b0 = off + i * sectors + (s_ + 1) % sectors
                    c0, d0 = a0 + sectors, b0 + sectors
                    faces += [(a0, c0, b0), (b0, c0, d0)] if side_index == 0 else [(a0, b0, c0), (b0, d0, c0)]
        for s_ in range(sectors):  # rounded rim
            a0 = rings * sectors + s_
            b0 = rings * sectors + (s_ + 1) % sectors
            faces += [(a0, b0, half_n + a0), (b0, half_n + b0, half_n + a0)]
        faces = np.array(faces, np.int64)
        fn = np.cross(pos[faces[:, 1]] - pos[faces[:, 0]], pos[faces[:, 2]] - pos[faces[:, 0]])
        top_face = (faces < half_n).all(1)
        bottom_face = (faces >= half_n).all(1)
        flip = (top_face & (fn[:, 1] < 0)) | (bottom_face & (fn[:, 1] > 0))
        faces[flip] = faces[flip][:, [0, 2, 1]]
        # Rim quads: orient away from the plate axis.
        rim = ~(top_face | bottom_face)
        centroid = pos[faces].mean(1)
        out = (centroid - c)[:, [0, 2]]
        fn = np.cross(pos[faces[:, 1]] - pos[faces[:, 0]], pos[faces[:, 2]] - pos[faces[:, 0]])
        flip = rim & ((fn[:, [0, 2]] * out).sum(1) < 0)
        faces[flip] = faces[flip][:, [0, 2, 1]]
        hr = HullRay(pts)
        rel = pos - hr.center
        dist, _ = hr.cast(rel / np.maximum(np.linalg.norm(rel, axis=1, keepdims=True), 1e-9))
        scale = np.minimum(1, dist * 0.985 / np.maximum(np.linalg.norm(rel, axis=1), 1e-9))
        pos = hr.center + rel * scale[:, None]
        pieces.append(Mesh('plate', '', pos, faces, uv, np.concatenate([col, np.ones((len(pos), 1))], 1)))
        for _ in range(36):  # short upright branchlets near the rim (passable)
            ang = rng.random() * TAU
            t = 0.55 + rng.random() * 0.4
            rad = rr * 0.84 * t
            base_pt = np.array([c[0] + math.cos(ang) * rad, c[1] + thick * 0.35 + 0.05 * t ** 3,
                                c[2] + math.sin(ang) * rad])
            h = 0.02 + rng.random() * 0.025
            pieces.append(tube(np.array([base_pt, base_pt + [0.003, h, 0.002]]), np.array([0.009, 0.006]), 5,
                               rim_tint))
        strut = curve(np.array([spine[min(9, 3 + k * 3)], (spine[min(9, 3 + k * 3)] + c) / 2 + [0, -0.02, 0],
                                c - [0, thick * 0.5, 0]]), 6)
        pieces.append(tube(strut, np.linspace(radius * 0.6, radius * 0.45, 6), 8, tint, cap=False))
    base = blob(a + [0, 0.02, 0], radius * 2.0, 3, tint, Waves(14320, 8, 3, 2), 0.2, (1.2, 0.25, 1.1))
    pieces.append(base)
    body = merge(f'Coral_Plate_{variant}', 'CoralPolyp', pieces)
    return Asset(f'Coral_Plate_{variant}', [body], parts, {'kind': 'plate', 'formation': formation['index']})

def fit_envelope(m: Mesh, species: str, template: int, slack: float = 1.04) -> Mesh:
    """Keep each height band inside the accepted placement envelope for that template.

    The procedural template's radial reach per 1/20 height bin was what placement validated against
    rocks; a smooth height-dependent XZ scale keeps authored forms inside it without distorting stems."""
    env = np.array(BASELINE['plantEnvelopes'][species][template])
    env = np.maximum.reduce([np.roll(env, k) for k in (-1, 0, 1)])
    env = np.maximum(env, 0.03) * slack
    y = np.clip(m.positions[:, 1] * 20, 0, 20)
    bins = np.round(y).astype(int)
    r = np.hypot(m.positions[:, 0], m.positions[:, 2])
    need = np.ones(21)
    for b in range(21):
        sel = bins == b
        if sel.any():
            need[b] = min(1.0, env[b] / max(r[sel].max(), 1e-6))
    # Monotone-safe smoothing: a running minimum over neighbours, then light averaging.
    need = np.minimum.reduce([np.roll(need, k) if 0 else need for k in (0,)])
    for _ in range(2):
        need = np.minimum(need, (np.roll(need, 1) + need + np.roll(need, -1)) / 3 + 0.02)
    scale = np.interp(y, np.arange(21), need)
    # Interpolation can exceed a bin's need between samples; enforce per-vertex.
    scale = np.minimum(scale, env[bins] / np.maximum(r, 1e-6))
    scale = np.minimum(scale, 1.0)
    m.positions[:, 0] *= scale
    m.positions[:, 2] *= scale
    m.extras['xzFit'] = float(need.min())
    return m


def soft_coral(template: int) -> Mesh:
    """Finger leather coral: lobed fleshy trunk dividing into irregular tapering fingers."""
    rng = np.random.default_rng(14400 + template)
    tint = [(0.78, 0.66, 0.50), (0.70, 0.62, 0.66), (0.66, 0.70, 0.56)][template]
    parts = []
    trunk = curve(np.array([[0, 0, 0], [0.02, 0.18, 0.01], [-0.01, 0.34, 0.02]]), 8)
    parts.append(tube(trunk, np.linspace(0.11, 0.085, 8), 12, tint, cap=False,
                      profile=lambda i, a: 1 + 0.1 * math.sin(a * 3 + i), phase=0.1))

    def grow(start, direction, length, radius, depth, phase):
        bend = (rng.random(3) - 0.5) * 0.15
        bend[1] = abs(bend[1])
        ctrl = np.array([start, start + direction * length * 0.5 + bend * 0.3, start + direction * length + bend * 0.6])
        sp = curve(ctrl, 7)
        rr = np.linspace(radius, radius * (0.8 if depth < 2 else 0.7), 7)
        parts.append(tube(sp, rr, 9, tint, profile=lambda i, a: 1 + 0.1 * math.sin(a * 2 + i * 1.3)
                          + 0.05 * math.sin(a * 7 + i * 2.1), phase=phase))
        if depth < 2:
            for _ in range(2 + int(rng.random() < 0.5)):
                d = direction + (rng.random(3) - 0.5) * 1.1
                d[1] = abs(d[1]) + 0.5
                d /= np.linalg.norm(d)
                grow(sp[4 + int(rng.integers(0, 2))], d, length * 0.62, rr[-1] * 0.92, depth + 1,
                     (phase + rng.random() * 0.2) % 1)
        else:
            parts.append(blob(sp[-1], rr[-1] * 1.0, 1, tuple(min(1.0, c * 1.12) for c in tint)))

    for k in range(3 + template % 2):
        ang = k / (3 + template % 2) * TAU + rng.random() * 0.6
        d = np.array([math.cos(ang) * 0.5, 0.85, math.sin(ang) * 0.5])
        grow(trunk[-1], d / np.linalg.norm(d), 0.32, 0.085, 0, rng.random())
    m = merge(f'Soft_Coral_{template}', 'SoftTissue', parts)
    m.positions[:, 1] = np.maximum(m.positions[:, 1], 0)
    m.positions[:, 1] *= 1 / max(1e-6, m.positions[:, 1].max())
    shade_by_height(m, 0, 1, 0.7)
    return fit_envelope(m, 'soft-coral', template)


def sea_fan(template: int) -> Mesh:
    """Gorgonian: stout holdfast and stem, then a slightly curved anastomosing branch network."""
    rng = np.random.default_rng(14500 + template)
    tint = [(0.62, 0.36, 0.58), (0.84, 0.52, 0.34), (0.70, 0.42, 0.52)][template]
    parts = [blob(np.array([0, 0.0, 0]), 0.05, 2, tint, None, 0, (1.3, 0.4, 1.2))]
    stem = curve(np.array([[0, 0, 0], [0.004, 0.12, 0], [0, 0.26, 0.003]]), 6)
    parts.append(tube(stem, np.linspace(0.022, 0.016, 6), 8, tint, cap=False, phase=0.05))
    nodes = []

    def fan_point(x, y):  # gentle cup curvature in the fan plane (x across, z depth)
        return np.array([x, y, -0.09 * (x / 0.42) ** 2 + 0.02 * math.sin(y * 7 + template)])

    def branch(x, y, angle, length, radius, depth):
        pts = [fan_point(x, y)]
        for s in range(1, 5):
            angle += (rng.random() - 0.5) * 0.25
            x += math.sin(angle) * length / 4
            y += math.cos(angle) * length / 4
            pts.append(fan_point(x, y))
        pts = np.array(pts)
        tip = pts[-1]
        if abs(tip[0]) > 0.4 or tip[1] > 1.0:
            return
        parts.append(tube(curve(pts, 5), np.linspace(radius, radius * 0.8, 5), 4, tint,
                          phase=0.3 + 0.5 * tip[1]))
        nodes.extend(pts[1:])
        if depth < 6:
            for side in (-1, 1):
                if rng.random() < 0.88:
                    branch(tip[0], tip[1], angle + side * (0.3 + rng.random() * 0.3),
                           length * (0.82 + rng.random() * 0.12), max(0.0055, radius * 0.82), depth + 1)

    for k in (-1, 0, 1):
        branch(0, 0.26, k * 0.5, 0.15, 0.016, 0)
    # Anastomoses: short connections between nearby branch tips build the mesh-like lattice.
    nodes_arr = np.array(nodes)
    tree = cKDTree(nodes_arr)
    for i, j in sorted(tree.query_pairs(0.06))[:260]:
        if rng.random() < 0.45 and np.linalg.norm(nodes_arr[i] - nodes_arr[j]) > 0.02:
            parts.append(tube(np.array([nodes_arr[i], nodes_arr[j]]), np.array([0.0045, 0.0045]), 4, tint,
                              cap=False, phase=0.3 + 0.5 * nodes_arr[i][1]))
    m = merge(f'Sea_Fan_{template}', 'SoftTissue', parts)
    m.positions[:, 1] = np.maximum(m.positions[:, 1], 0)
    shade_by_height(m, 0, 1, 0.75)
    return fit_envelope(m, 'sea-fan', template)


def blade_spine(rng, height, lean, curl, sides=13):
    t = np.linspace(0, 1, sides)
    x = lean * t ** 1.7 + curl * np.sin(t * math.pi * 0.8) * 0.2
    return np.stack([x, t * height, np.zeros_like(t)], 1), t


def rotate_y(p: np.ndarray, ang: float) -> np.ndarray:
    c, s = math.cos(ang), math.sin(ang)
    return p @ np.array([[c, 0, -s], [0, 1, 0], [s, 0, c]])


def turtle_grass(template: int) -> Mesh:
    """Clump of strap blades from a rhizome knot: varied width/length, taper, droop, twist and ageing."""
    rng = np.random.default_rng(14600 + template)
    parts = [blob(np.array([0, 0.0, 0]), 0.04, 1, (0.45, 0.42, 0.32), None, 0, (1.6, 0.4, 1.0))]
    blades = 12 + int(rng.integers(0, 4))
    for k in range(blades):
        h = 0.4 + rng.random() * 0.6
        spine, t = blade_spine(rng, h, 0.1 + rng.random() * 0.22, rng.random() - 0.5)
        spine[:, 1] -= np.maximum(t - 0.6, 0) ** 2 * rng.random() * 0.25 * h  # older blades droop
        width = (0.03 + rng.random() * 0.03) * np.where(t < 0.9, 0.85 + 0.15 * np.sin(t * math.pi), (1 - t) / 0.1)
        width = np.maximum(width, 0.002)
        tw = t * (rng.random() - 0.5) * 2.2
        hue = rng.random()
        young = np.array([0.40, 0.62, 0.34]) * (0.9 + 0.2 * hue)
        old = np.array([0.56, 0.58, 0.32])
        base = young * (1 - 0.6 * hue) + old * 0.6 * hue
        b = ribbon(spine, width, tw, np.array([0, 0, 1.0]), tuple(base), rng.random(), 3, 0.18)
        b.positions = rotate_y(b.positions, k / blades * TAU + rng.random() * 0.5) + [
            (rng.random() - 0.5) * 0.06, 0, (rng.random() - 0.5) * 0.06]
        tt = np.repeat(t, 3)
        tip = np.clip((tt - 0.7) * 3.3, 0, 1) * (0.4 + 0.6 * hue)
        b.colors[:, :3] = b.colors[:, :3] * (1 - tip[:, None] * 0.5) + tip[:, None] * np.array([0.66, 0.58, 0.36]) * 0.5
        root = np.clip(1 - tt * 6, 0, 1)
        b.colors[:, :3] = b.colors[:, :3] * (1 - root[:, None] * 0.4) + root[:, None] * np.array([0.72, 0.70, 0.56]) * 0.4
        parts.append(b)
    m = merge(f'Turtle_Grass_{template}', 'Algae', parts)
    m.positions[:, 1] = np.maximum(m.positions[:, 1], 0)
    shade_by_height(m, 0, 1, 0.65)
    return fit_envelope(m, 'turtle-grass', template, 1.2)


def meadow_blade(template: int) -> Mesh:
    """Single meadow blade (instanced ~1,700 times): tapered, curved, twisted; 2-3 columns."""
    rng = np.random.default_rng(14700 + template)
    spine, t = blade_spine(rng, 1.0, [0.06, 0.12, 0.03][template], [0.2, -0.3, 0.5][template], 11)
    w = [0.026, 0.02, 0.04][template] * np.where(t < 0.85, 0.9 + 0.1 * np.sin(t * math.pi), (1 - t) / 0.15)
    w = np.maximum(w, 0.0015)
    b = ribbon(spine, w, t * [0.6, -0.9, 0.3][template], np.array([0, 0, 1.0]), (0.48, 0.62, 0.40), 0.0,
               3, 0.15)
    b.positions[:, 1] = np.maximum(b.positions[:, 1], 0)
    b.name = f'Meadow_Blade_{template}'
    b.material = 'Algae'
    tipfade = np.clip((t[:, None].repeat(3, 1).ravel() - 0.7) * 3, 0, 1)
    b.colors[:, :3] = b.colors[:, :3] * (1 - tipfade[:, None] * 0.3) + tipfade[:, None] * np.array(
        [0.66, 0.62, 0.40]) * 0.3
    shade_by_height(b, 0, 1, 0.55)
    return b


def caulerpa(template: int) -> Mesh:
    """Feather Caulerpa: creeping stolon with upright pinnate fronds of tapering branchlets."""
    rng = np.random.default_rng(14800 + template)
    green = (0.46, 0.70, 0.42)
    parts = []
    stolon = curve(np.array([[-0.18, 0.01, 0.02], [-0.05, 0.015, -0.02], [0.08, 0.01, 0.02], [0.2, 0.012, -0.01]]), 10)
    parts.append(tube(stolon, np.full(10, 0.012), 6, (0.52, 0.66, 0.44), phase=0.0))
    fronds = 5 + template % 2
    for k in range(fronds):
        base = stolon[1 + k * 8 // fronds]
        h = 0.65 + rng.random() * 0.35
        lean = (rng.random(3) - 0.5) * 0.2
        rachis = curve(np.array([base, base + [lean[0] * 0.5, h * 0.5, lean[2] * 0.5],
                                 base + [lean[0], h, lean[2]]]), 12)
        phase = rng.random()
        parts.append(tube(rachis, np.linspace(0.009, 0.004, 12), 5, green, phase=phase))
        plane = rng.random() * TAU
        side = np.array([math.cos(plane), 0, math.sin(plane)])
        for i in range(2, 11):
            t = i / 11
            for sgn in (-1, 1):
                L = 0.085 * math.sin(math.pi * min(1, t * 1.15)) + 0.02
                tip = rachis[i] + side * sgn * L + [0, L * 0.6, 0]
                parts.append(tube(np.array([rachis[i], (rachis[i] + tip) / 2 + [0, 0.006, 0], tip]),
                                  np.array([0.0065, 0.005, 0.0025]), 4, green, phase=phase))
    m = merge(f'Caulerpa_{template}', 'Algae', parts)
    m.positions[:, 1] = np.maximum(m.positions[:, 1], 0)
    shade_by_height(m, 0, 1, 0.72)
    return fit_envelope(m, 'caulerpa', template)


def halimeda(template: int) -> Mesh:
    """Halimeda: branching chains of calcified kidney-shaped segments on short joints."""
    rng = np.random.default_rng(14900 + template)
    parts = [blob(np.array([0, 0.01, 0]), 0.035, 1, (0.55, 0.58, 0.45), None, 0, (1.3, 0.6, 1.3))]

    def chain(p, direction, n, size, phase):
        for i in range(n):
            nrm = np.cross(direction, [0, 0, 1.0])
            if np.linalg.norm(nrm) < 1e-3:
                nrm = np.array([1.0, 0, 0])
            nrm /= np.linalg.norm(nrm)
            center = p + direction * size * 0.75
            seg = blob(np.zeros(3), 1, 1, (0.46, 0.66, 0.36), Waves(14910 + i, 6, 2.0, 1), 0.08,
                       (size * 1.15, size, size * 0.22))
            # Kidney notch and plane orientation.
            notch = np.exp(-((seg.positions[:, 0]) / (size * 0.3)) ** 2) * (seg.positions[:, 1] < -size * 0.4)
            seg.positions[:, 1] += notch * size * 0.25
            ang = math.atan2(direction[0], direction[1])
            yaw = rng.random() * TAU
            c, s = math.cos(-ang), math.sin(-ang)
            seg.positions = seg.positions @ np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]])
            seg.positions = rotate_y(seg.positions, yaw * 0.25) + center
            light = 1 - 0.25 * (i / max(1, n - 1))  # younger tips are greener, bases calcified
            seg.colors[:, :3] = seg.colors[:, :3] * light + (1 - light) * np.array([0.78, 0.78, 0.66])
            seg.colors[:, 3] = phase
            parts.append(seg)
            p = center + direction * size * 0.7
            direction = direction + (rng.random(3) - 0.5) * 0.35
            direction[1] = abs(direction[1]) + 0.5
            direction /= np.linalg.norm(direction)
            if i in (1, 3) and rng.random() < 0.8:
                d2 = direction + np.array([rng.choice([-0.8, 0.8]), 0.1, (rng.random() - 0.5) * 0.6])
                chain(p, d2 / np.linalg.norm(d2), max(1, n - i - 2), size * 0.92, (phase + 0.1) % 1)

    for k in range(3 + template % 2):
        ang = k * 2.1 + rng.random()
        d = np.array([math.cos(ang) * 0.35, 1, math.sin(ang) * 0.35])
        chain(np.array([0, 0.03, 0]), d / np.linalg.norm(d), 6, 0.075, rng.random())
    m = merge(f'Halimeda_{template}', 'Algae', parts)
    m.positions[:, 1] = np.maximum(m.positions[:, 1], 0)
    m.positions[:, 1] /= max(1.0, m.positions[:, 1].max())
    return fit_envelope(m, 'halimeda', template)


def red_algae(template: int) -> Mesh:
    """Fine dichotomous red macroalga with forked, slightly flattened tips."""
    rng = np.random.default_rng(15000 + template)
    parts = [blob(np.array([0, 0.005, 0]), 0.025, 1, (0.5, 0.32, 0.32), None, 0, (1.2, 0.5, 1.2))]

    def fork(p, d, length, radius, depth, phase):
        bend = (rng.random(3) - 0.5) * 0.1
        sp = curve(np.array([p, p + d * length * 0.5 + bend * 0.5, p + d * length + bend]), 5)
        shade = 0.85 + 0.15 * depth / 6
        col = (0.66 * shade, 0.36 * shade, 0.40 * shade)
        parts.append(tube(sp, np.linspace(radius, radius * 0.78, 5), 5, col, cap=depth >= 4, phase=phase,
                          flatten=0.55))
        if depth < 4:
            for sgn in (-1, 1):
                plane = np.cross(d, [0, 0, 1.0]) if depth % 2 == 0 else np.cross(d, [1.0, 0, 0])
                plane /= np.linalg.norm(plane) + 1e-9
                d2 = d + plane * sgn * (0.45 + rng.random() * 0.25)
                d2[1] = abs(d2[1]) + 0.2
                fork(sp[-1], d2 / np.linalg.norm(d2), length * (0.75 + rng.random() * 0.1), radius * 0.8,
                     depth + 1, (phase + rng.random() * 0.15) % 1)

    for k in range(3):
        ang = k * 2.2 + template
        d = np.array([math.cos(ang) * 0.3, 1, math.sin(ang) * 0.3])
        fork(np.array([0, 0.01, 0]), d / np.linalg.norm(d), 0.24, 0.012, 0, rng.random())
    m = merge(f'Red_Algae_{template}', 'Algae', parts)
    m.positions[:, 1] = np.maximum(m.positions[:, 1], 0)
    m.positions[:, 1] /= max(1.0, m.positions[:, 1].max())
    return fit_envelope(m, 'red-macroalgae', template)


# ---------------------------------------------------------------- substrate debris and backdrop


def shell(template: int) -> Mesh:
    """Small cowrie / cockle / turret shells, real size 1.5-4 cm at the miniature diver scale."""
    if template == 0:  # cockle: ribbed half-dome
        d, f = icosphere(2)
        d[:, 1] = np.abs(d[:, 1]) * 0.55
        rib = 1 + 0.06 * np.cos(np.arctan2(d[:, 2], d[:, 0]) * 18)
        p = d * np.array([1, 1, 0.9]) * rib[:, None] * 0.02
        col = np.tile([0.92, 0.84, 0.74, 1.0], (len(p), 1))
        col[:, :3] *= (0.85 + 0.15 * np.cos(np.arctan2(d[:, 2], d[:, 0]) * 18))[:, None]
    elif template == 1:  # cowrie: glossy ovoid with a slit
        d, f = icosphere(2)
        p = d * np.array([0.022, 0.012, 0.015])
        slit = np.exp(-(d[:, 2] / 0.12) ** 2) * (d[:, 1] < -0.3)
        p[:, 1] += slit * 0.004
        col = np.tile([0.86, 0.72, 0.58, 1.0], (len(p), 1))
        col[:, :3] *= (0.8 + 0.2 * (d[:, 1] > 0.2))[:, None]
    else:  # turret: tapering spiral
        t = np.linspace(0, 1, 22)
        spine = np.stack([0.004 * np.cos(t * 30), t * 0.04, 0.004 * np.sin(t * 30)], 1)
        m = tube(spine, 0.009 * (1 - t) + 0.0015, 6, (0.80, 0.70, 0.60),
                 profile=lambda i, a: 1 + 0.15 * math.sin(i * 1.6))
        m.positions = m.positions[:, [1, 0, 2]] * [1, 1, 1] + [0, 0.007, 0]  # lying on its side
        m.name, m.material = f'Shell_{template}', 'CoralPolyp'
        m.positions[:, 1] = np.maximum(m.positions[:, 1], 0)
        return m
    uv = box_uv(p, vertex_normals(p, f), 20)
    return Mesh(f'Shell_{template}', 'CoralPolyp', p, f, uv, col)


def rubble(template: int) -> Mesh:
    """Broken coral branch fragments (passable)."""
    rng = np.random.default_rng(15200 + template)
    parts = []
    for k in range(2 + template):
        a = np.array([(rng.random() - 0.5) * 0.08, 0.01, (rng.random() - 0.5) * 0.08])
        b = a + np.array([(rng.random() - 0.5) * 0.12, 0.004, (rng.random() - 0.5) * 0.12])
        parts.append(tube(np.array([a, (a + b) / 2 + [0, 0.006, 0], b]), np.array([0.012, 0.011, 0.008]), 6,
                          (0.92, 0.89, 0.82)))
    m = merge(f'Rubble_{template}', 'CoralPolyp', parts)
    return m


def backdrop(index: int) -> Asset:
    """Low-detail rear/side reef relief hugging the glass (<= 0.2 deep, outside swimmable space)."""
    rng = np.random.default_rng(15300 + index)
    length = [36.0, 28.0, 28.0][index]
    cols, rows = 220, 26
    ridge = Waves(15310 + index, 10, 0.35, 3)
    detail = Waves(15320 + index, 16, 2.5, 3)
    xs = np.linspace(-length / 2, length / 2, cols)
    pos, uv, col = [], [], []
    profile = 1.4 + 1.6 * (0.5 + 0.5 * ridge(np.stack([xs, np.zeros(cols), np.zeros(cols)], 1)))
    profile += np.maximum(0, Waves(15330 + index, 6, 0.6, 2)(np.stack([xs, xs * 0, xs * 0], 1))) * 1.2
    for i, x in enumerate(xs):
        h = profile[i]
        for j in range(rows):
            t = j / (rows - 1)
            y = h * t - 0.15
            bump = detail(np.array([[x, y, 0]]))[0]
            depth = 0.2 * (1 - t ** 3) * (0.65 + 0.35 * bump)  # thickest at the base, feathered at the crest
            pos.append([x, y, depth])
            uv.append([x * 0.5, y * 0.5])
            c = np.array([0.80, 0.78, 0.70]) * (0.75 + 0.2 * bump) * (0.7 + 0.3 * t)
            col.append([*c, 1.0])
    faces = []
    for i in range(cols - 1):
        for j in range(rows - 1):
            a = i * rows + j
            faces += [(a, a + rows, a + 1), (a + 1, a + rows, a + rows + 1)]
    m = Mesh(f'Backdrop_{index}', 'ReefRock', np.array(pos), np.array(faces, np.int64), np.array(uv),
             np.array(col))
    return Asset(f'Backdrop_{index}', [m], [], {'depth': 0.2, 'length': length})


def build_all() -> dict[str, list[Asset] | list[Mesh]]:
    forms = BASELINE['formations']
    by_kind: dict[str, list[dict]] = {'branching': [], 'rounded': [], 'plate': []}
    for f in forms:
        by_kind[f['kind']].append(f)
    return {
        'rocks': [reef_rock(i) for i in range(6)],
        'pebbles': [pebble(i) for i in range(3)],
        'corals': [branching_coral(f, i) for i, f in enumerate(by_kind['branching'])]
        + [massive_coral(f, i) for i, f in enumerate(by_kind['rounded'])]
        + [plate_coral(f, i) for i, f in enumerate(by_kind['plate'])],
        'plants': [soft_coral(i) for i in range(3)] + [sea_fan(i) for i in range(3)]
        + [turtle_grass(i) for i in range(3)] + [caulerpa(i) for i in range(3)]
        + [halimeda(i) for i in range(3)] + [red_algae(i) for i in range(3)]
        + [meadow_blade(i) for i in range(3)],
        'debris': [shell(i) for i in range(3)] + [rubble(i) for i in range(2)],
    }


if __name__ == '__main__':
    import time

    t0 = time.time()
    lib = build_all()
    for group, items in lib.items():
        for item in items:
            meshes = item.meshes if isinstance(item, Asset) else [item]
            print(group, item.name, sum(m.triangles for m in meshes),
                  len(item.colliders) if isinstance(item, Asset) else '',
                  [m.extras.get('xzFit') for m in meshes if 'xzFit' in m.extras])
    print('seconds', round(time.time() - t0, 1))
