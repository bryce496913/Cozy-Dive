"""Pass 062: benchmark geometry for the two art treatments (game space, +Y up, metres).

Style 'natural' (A, Natural Realism) and 'crafted' (B, Crafted Stylized Realism) build the same
four benchmark subjects at the same size as the shipped Pass 014 templates they would replace:

  Rock            a reef rock outcrop        ~1.8 x 1.5 x 1.4 (shipped Rock_0 is a ~1.7 m ball)
  Coral_Brain     a massive brain coral      ~1.45 wide, ~0.95 tall (shipped Coral_Massive_0 ~1.4)
  Coral_Branching a staghorn thicket         ~1.4 wide, ~2.0 tall (shipped Coral_Branching_0)
  Seagrass_0..2   turtle-grass clumps        ~1.0 tall (shipped Turtle_Grass_0..2)

The difference between the styles is deliberate and documented per function: A spends geometry on
irregularity (sharp strata, pits, fractures, broken tips); B spends it on clean, readable masses
(fewer, softer strata, rounded tips, even branch spacing) and leaves micro-detail to calmer maps.
Every subject grows from the sand instead of sitting on it: the rock has a buried foot and a
weathered undercut, the brain coral a flared skirt, the staghorn a fused base, grass a sheath.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'pass014'))
import reef_geometry as rg  # noqa: E402

TAU = math.tau
smoothstep = rg.smoothstep

STYLES = ('natural', 'crafted')


def srgb(c):
    return np.asarray(c, float)


def finish(name: str, material: str, p: np.ndarray, f: np.ndarray, col: np.ndarray, uv=None,
           extras=None) -> rg.Mesh:
    if uv is None:
        uv = rg.box_uv(p, rg.vertex_normals(p, f), 0.9)
    rgba = np.concatenate([np.clip(col, 0, 1), np.ones((len(p), 1))], 1)
    return rg.Mesh(name, material, p, f.astype(np.int64), uv, rgba, extras or {})


def cavity(p: np.ndarray, f: np.ndarray, adj, iterations=2) -> np.ndarray:
    """Positive in hollows, negative on crests (signed Laplacian along the normal)."""
    n = rg.vertex_normals(p, f)
    smooth = rg.laplacian(p, adj, iterations)
    return ((smooth - p) * n).sum(1)


# ---------------------------------------------------------------- reef rock


def rotation(yaw: float, tilt_x: float, tilt_z: float) -> np.ndarray:
    cy, sy = math.cos(yaw), math.sin(yaw)
    cx, sx = math.cos(tilt_x), math.sin(tilt_x)
    cz, sz = math.cos(tilt_z), math.sin(tilt_z)
    ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return ry @ rx @ rz


def block_exit(d: np.ndarray, centre, half, exponent, rot) -> np.ndarray:
    """Distance along each unit ray from the origin to where it leaves a superellipsoid block.

    The origin must lie inside the block, so the exit is unique (bisection on the implicit)."""
    local_d = d @ rot  # rotate rays into the block frame (rot is orthonormal)
    local_c = np.asarray(centre) @ rot
    lo, hi = np.zeros(len(d)), np.full(len(d), 4.0)
    for _ in range(32):
        t = (lo + hi) / 2
        q = np.abs((local_d * t[:, None] - local_c) / half)
        inside = (q ** exponent).sum(1) < 1
        lo = np.where(inside, t, lo)
        hi = np.where(inside, hi, t)
    return lo


def rock(style: str) -> rg.Mesh:
    """A sedimentary reef outcrop built from a few overlapping slabs, not a single ball.

    The silhouette is the union of tilted superellipsoid slabs (flat-faced, softly edged blocks),
    sampled along rays from a common centre, so the offset upper slabs leave real ledges and
    overhangs; bedding, pits and fractures are then carved into the faces.
    A: four slabs with near-boxy faces (exponent 3.6-4), thin uneven bedding planes, solution pits,
       two fracture planes, fine ridged weathering (82k triangles).
    B: three softer slabs (exponent 2.6-3), two broad strata steps, five clean hollows, one tilted
       top face, smoothed so the big planes read first (20k triangles).
    """
    natural = style == 'natural'
    rng = np.random.default_rng(62101 if natural else 62102)
    d, f = rg.icosphere(6 if natural else 5)
    adj = rg.neighbours(len(d), f)
    if natural:
        blocks = [((0.0, -0.05, 0.0), (0.95, 0.5, 0.72), 3.8, rotation(0.2, 0.06, -0.05)),
                  ((0.18, 0.36, -0.08), (0.62, 0.32, 0.5), 3.6, rotation(0.65, -0.1, 0.12)),
                  ((-0.42, 0.12, 0.2), (0.5, 0.48, 0.42), 3.2, rotation(-0.4, 0.15, 0.3)),
                  ((0.35, 0.05, 0.3), (0.55, 0.36, 0.38), 4.0, rotation(1.1, 0.0, -0.2))]
    else:
        blocks = [((0.0, -0.05, 0.0), (0.98, 0.5, 0.74), 3.4, rotation(0.2, 0.05, -0.04)),
                  ((0.2, 0.36, -0.06), (0.6, 0.32, 0.5), 3.2, rotation(0.55, -0.08, 0.1)),
                  ((-0.4, 0.1, 0.22), (0.5, 0.46, 0.42), 3.2, rotation(-0.4, 0.1, 0.22))]
    r = np.max([block_exit(d, *b) for b in blocks], axis=0)
    p = d * r[:, None]
    warp = rg.Waves(62111 if natural else 62112, count=20, base=1.6, octaves=3)
    p *= (1 + warp(d) * (0.06 if natural else 0.04))[:, None]
    p = rg.laplacian(p, adj, 1) * 0.3 + p * 0.7
    # Bedding: per-layer horizontal inset/outset, blended across a boundary band.
    layer_h = 0.11 if natural else 0.3
    band = 0.15 if natural else 0.45
    count = int(2.2 / layer_h) + 3
    offsets = rng.uniform(-0.05, 0.035, count) if natural else np.tile([0.045, -0.035], count)[:count]
    t = (p[:, 1] + 1.0) / layer_h
    k = np.clip(np.floor(t).astype(int), 0, count - 2)
    frac = t - np.floor(t)
    s = offsets[k] + (offsets[k + 1] - offsets[k]) * smoothstep(1 - band, 1.0, frac)
    p[:, [0, 2]] *= (1 + s)[:, None]
    # Weathered undercut at the sediment line (bioerosion).
    under = smoothstep(-0.3, -0.52, p[:, 1]) * (0.16 if natural else 0.1)
    p[:, [0, 2]] *= (1 - under)[:, None]
    cuts = ([(np.array([0.85, 0.2, -0.45]), 0.78), (np.array([-0.55, 0.3, 0.8]), 0.62)] if natural
            else [(np.array([0.12, 1.0, 0.25]), 0.62)])
    for normal, offset in cuts:
        normal = normal / np.linalg.norm(normal)
        over = np.maximum(p @ normal - offset, 0)
        p -= normal * (over * (0.93 if natural else 0.85))[:, None]
    n = rg.vertex_normals(p, f)
    if natural:
        from scipy.spatial import cKDTree
        seeds = p[rng.choice(len(p), 90, replace=False)]
        dist, idx = cKDTree(seeds).query(p)
        radius = rng.uniform(0.025, 0.08, len(seeds))[idx]
        pit = smoothstep(radius, radius * 0.3, dist) * 0.045
        rough = rg.Waves(62121, count=24, base=10.0, octaves=3)
        ridged = (1 - np.abs(rough(p))) ** 2 * 0.016
        p -= n * (pit - ridged)[:, None]
    else:
        for c in p[rng.choice(len(p), 5, replace=False)]:
            dist = np.linalg.norm(p - c, axis=1)
            p -= n * (smoothstep(0.24, 0.0, dist) * 0.06)[:, None]
        p += n * (rg.Waves(62122, count=16, base=5.0, octaves=2)(p) * 0.008)[:, None]
        p = rg.laplacian(p, adj, 1) * 0.7 + p * 0.3
    # Bury the foot: geometry below the sand line becomes a shallow buried skirt.
    sand = -0.42
    below = p[:, 1] < sand
    p[below, 1] = sand - (sand - p[below, 1]) * 0.25
    p[:, 1] -= sand + 0.1  # origin on the sand plane; ~0.1 m stays buried
    cav = cavity(p, f, adj, 3)
    n = rg.vertex_normals(p, f)
    ao = np.clip(1 - np.clip(cav, 0, None) * (14 if natural else 9), 0.45, 1)
    top = smoothstep(0.2, 0.9, n[:, 1])
    col = srgb([0.97, 0.95, 0.92] if natural else [1.0, 0.97, 0.92]) * ao[:, None]
    col *= (1 - smoothstep(0.1, -0.7, n[:, 1]) * (0.2 if natural else 0.14))[:, None]
    col += top[:, None] * (0.03 if natural else 0.05)
    if natural:
        stain = rg.Waves(62131, count=12, base=3.0, octaves=2)(p)
        col *= (1 - np.clip(stain, 0, None) * 0.25)[:, None]
    near_sand = smoothstep(0.25, 0.0, p[:, 1])
    col = col * (1 - near_sand[:, None] * 0.25) + near_sand[:, None] * srgb([0.85, 0.80, 0.70]) * 0.25
    return finish('Rock', 'Rock', p, f, col)


# ---------------------------------------------------------------- brain coral


def dome_points(level: int, theta_max: float) -> tuple[np.ndarray, np.ndarray]:
    """Icosphere remapped onto a cap: polar angle [0, pi] -> [0, theta_max], so no vertex is wasted
    on an underside that would be buried."""
    d, f = rg.icosphere(level)
    theta = np.arccos(np.clip(d[:, 1], -1, 1)) * theta_max / math.pi
    phi = np.arctan2(d[:, 2], d[:, 0])
    out = np.stack([np.sin(theta) * np.cos(phi), np.cos(theta), np.sin(theta) * np.sin(phi)], 1)
    return out, f


def brain(style: str) -> rg.Mesh:
    """A massive brain coral (Diploria / Platygyra form).

    One colony, not stacked lobes: a low dome whose outline is gently lobed by growth noise, with a
    flared skirt that spreads onto the sand. Meandering valleys come from the zero-crossings of
    band-limited 3D noise.
    A: ~26 narrow, deep valleys across, irregular lobing, a dead turf-covered fringe (82k tris).
    B: ~14 broad, rounded valleys, a calm symmetric dome, crisp two-tone colour (20k tris).
    """
    natural = style == 'natural'
    d, f = dome_points(6 if natural else 5, math.pi * 0.64)
    adj = rg.neighbours(len(d), f)
    theta = np.arccos(np.clip(d[:, 1], -1, 1))
    lobe = rg.Waves(62201 if natural else 62202, count=10, base=3.2, octaves=2)
    radius = 0.72 * (1 + lobe(d) * (0.22 if natural else 0.08))
    # Profile: dome above the equator, a flared skirt below it that settles onto the sand.
    height = 0.8 if natural else 0.74
    skirt = smoothstep(math.pi * 0.42, math.pi * 0.64, theta)
    y = np.cos(np.minimum(theta, math.pi / 2)) * height * (1 - skirt) - skirt * 0.06
    flare = 1 + skirt * (0.07 if natural else 0.05)
    horiz = np.sin(np.minimum(theta, math.pi / 2))
    p = np.stack([d[:, 0] / (np.linalg.norm(d[:, [0, 2]], axis=1) + 1e-9) * horiz * radius * flare,
                  y, d[:, 2] / (np.linalg.norm(d[:, [0, 2]], axis=1) + 1e-9) * horiz * radius * flare], 1)
    # An oval colony footprint, slightly higher on one shoulder (colonies are rarely symmetric).
    p[:, 0] *= 1.1 if natural else 1.06
    p[:, 2] *= 0.92 if natural else 0.96
    p[:, 1] *= 1 + (0.12 if natural else 0.05) * np.clip(p[:, 0] / 0.8, -1, 1) * smoothstep(0.0, 0.5, p[:, 1])
    p = rg.laplacian(p, adj, 1) * 0.5 + p * 0.5
    n = rg.vertex_normals(p, f)
    # Meanders.
    freq = 52.0 if natural else 24.0
    field = rg.Waves(62211 if natural else 62212, count=40, base=freq, octaves=1)(p * np.array([1, 1.15, 1]))
    field /= field.std()
    width = 0.3 if natural else 0.45
    valley = np.exp(-(field / width) ** 2)
    if not natural:
        valley = smoothstep(0.15, 0.9, valley)
    live = 1 - smoothstep(math.pi * 0.47, math.pi * 0.56, theta)
    depth = (0.045 if natural else 0.04) * live
    p -= n * (valley * depth)[:, None]
    if natural:
        p += n * (rg.Waves(62221, count=24, base=14, octaves=2)(p) * 0.004)[:, None]
    else:
        p = rg.laplacian(p, adj, 1) * 0.4 + p * 0.6
    if natural:
        ridge, groove = srgb([0.68, 0.57, 0.38]), srgb([0.58, 0.63, 0.45])
        dead = srgb([0.50, 0.50, 0.42])
    else:
        ridge, groove = srgb([0.76, 0.62, 0.38]), srgb([0.58, 0.72, 0.56])
        dead = srgb([0.68, 0.64, 0.54])
    col = ridge * (1 - valley[:, None]) + groove * valley[:, None]
    if natural:
        tone = rg.Waves(62231, count=10, base=2.5, octaves=2)(p)
        col *= (1 + tone * 0.12)[:, None]
    col = col * live[:, None] + dead * (1 - live)[:, None]
    ao = 1 - valley * (0.35 if natural else 0.18) - smoothstep(0.25, 0.0, p[:, 1]) * 0.2
    col *= ao[:, None]
    uv = np.stack([np.arctan2(p[:, 2], p[:, 0]) / TAU + 0.5, theta / math.pi], 1)
    return finish('Coral_Brain', 'Brain', p, f, col, uv)


# ---------------------------------------------------------------- branching coral


def rounded_tube(points, radii, sides, color, tip_rings=4, point=0.0):
    """Swept tube ending in a rounded (B) or slightly pointed (A) dome instead of a cone."""
    points = np.asarray(points, float)
    radii = np.asarray(radii, float)
    t = points[-1] - points[-2]
    t /= np.linalg.norm(t)
    r = radii[-1]
    extra_p, extra_r = [], []
    for i in range(1, tip_rings + 1):
        a = i / (tip_rings + 1) * math.pi / 2
        extra_p.append(points[-1] + t * r * math.sin(a) * (1 + point))
        extra_r.append(r * math.cos(a))
    if extra_p:
        points, radii = np.vstack([points, extra_p]), np.concatenate([radii, extra_r])
    m = rg.tube(points, radii, sides, color, cap=True)
    return m


def branching(style: str) -> rg.Mesh:
    """A staghorn (Acropora cervicornis) thicket, ~2 m tall at game scale.

    Staghorn branches are near-cylindrical antlers that keep their diameter and fork at wide
    angles, with a pale, slightly swollen axial corallite at each growing tip. Both styles keep that
    anatomy; they differ in regularity:
    A: seven trunks, irregular fork angles and lengths, a few broken stubs, slightly pointed tips,
       golden-brown tissue with uneven pale tips.
    B: six trunks, even fork angles with a clearance test so silhouettes never tangle, gently
       arcing branches with rounded tips, a clean ochre-to-cream gradient.
    """
    natural = style == 'natural'
    rng = np.random.default_rng(62301 if natural else 62302)
    sides = 10 if natural else 8
    parts: list[rg.Mesh] = []
    tips_seen: list[np.ndarray] = []
    base_col = srgb([0.62, 0.48, 0.30]) if natural else srgb([0.80, 0.60, 0.38])
    tip_col = srgb([0.92, 0.88, 0.78]) if natural else srgb([0.98, 0.93, 0.80])
    max_order = 2

    def grow(origin, direction, length, radius, order):
        direction = direction / np.linalg.norm(direction)
        bend = rng.standard_normal(3) * (0.14 if natural else 0.05)
        bend[1] = abs(bend[1]) * 0.3 + (0.0 if natural else 0.06)
        ctrl = [origin, origin + direction * length * 0.5 + bend * length * 0.25,
                origin + (direction + bend * 0.5) * length]
        rings = max(5, int(length / (0.035 if natural else 0.05)))
        pts = rg.curve(np.array(ctrl), rings)
        radii = np.linspace(radius, radius * 0.86, rings)
        broken = natural and order >= 1 and rng.random() < 0.1
        if broken:
            pts = pts[: max(3, rings // 2)]
            radii = radii[: len(pts)]
        m = rounded_tube(pts, radii, sides, (1, 1, 1), tip_rings=0 if broken else 4,
                         point=0.25 if natural else 0.0)
        along = np.clip(np.linalg.norm(m.positions - pts[0], axis=1) / (length + 1e-6), 0, 1)
        terminal = order >= max_order or broken
        fade = smoothstep(0.78, 1.0, along) if terminal and not broken else np.zeros(len(along))
        height = smoothstep(-0.1, 1.6, m.positions[:, 1]) * 0.35
        t = np.clip(np.maximum(fade, height), 0, 1)
        if natural:
            t *= rng.uniform(0.7, 1.0)
        m.colors[:, :3] = base_col * (1 - t[:, None]) + tip_col * t[:, None]
        if natural:
            m.colors[:, :3] *= rng.uniform(0.9, 1.06)
        parts.append(m)
        if terminal:
            tips_seen.append(pts[-1])
            return
        children = rng.integers(2, 4) if natural else 2
        for c in range(children):
            at = rng.uniform(0.35, 0.8) if natural else (0.45 + c * 0.3)
            i = min(len(pts) - 2, int(at * (len(pts) - 1)))
            tangent = pts[i + 1] - pts[i]
            tangent /= np.linalg.norm(tangent)
            side = np.cross(tangent, [0, 1, 0])
            if np.linalg.norm(side) < 1e-3:
                side = np.array([1.0, 0, 0])
            side /= np.linalg.norm(side)
            ang = rng.uniform(0, TAU) if natural else (c * math.pi + order * 1.3 + rng.uniform(-0.25, 0.25))
            axis_side = side * math.cos(ang) + np.cross(tangent, side) * math.sin(ang)
            spread = rng.uniform(0.5, 0.85) if natural else 0.68
            new_dir = tangent * math.cos(spread) + axis_side * math.sin(spread)
            new_dir[1] = max(new_dir[1], 0.3)
            child_len = length * (rng.uniform(0.55, 0.8) if natural else 0.68)
            end = pts[i] + new_dir / np.linalg.norm(new_dir) * child_len
            if not natural and any(np.linalg.norm(end - q) < 0.2 for q in tips_seen):
                continue
            grow(pts[i], new_dir, child_len, radii[i] * 0.94, order + 1)

    trunks = 7 if natural else 6
    for k in range(trunks):
        a = k / trunks * TAU + rng.uniform(-0.4, 0.4) * (1 if natural else 0.3)
        out = rng.uniform(0.25, 0.55) if natural else 0.38
        direction = np.array([math.cos(a) * out, 1.0, math.sin(a) * out])
        origin = np.array([math.cos(a) * 0.08, -0.06, math.sin(a) * 0.08])
        grow(origin, direction, rng.uniform(0.75, 1.0) if natural else 0.88,
             rng.uniform(0.05, 0.062) if natural else 0.058, 0)
    m = rg.merge('Coral_Branching', 'Branch', parts)
    # Same largest dimension as the shipped Coral_Branching_0 (~2.1 m), proportions unchanged.
    extent = (m.positions.max(0) - m.positions.min(0)).max()
    m.positions *= 2.1 / extent
    return m


# ---------------------------------------------------------------- seagrass


def seagrass(style: str, template: int) -> rg.Mesh:
    """A turtle-grass (Thalassia) clump: shoots of 2-5 strap blades rising from sheaths.

    A: varied blade width/length, broken and grazed tips, brown-green tips and epiphyte-spotted
       maps, a slight twist; B: consistent strap widths, a gentle S-curve, rounded tips and a clean
       deep-to-light green gradient.
    """
    natural = style == 'natural'
    rng = np.random.default_rng((62401 if natural else 62402) + template * 17)
    parts = []
    shoots = rng.integers(5, 8) if natural else 5
    for s in range(shoots):
        a = rng.uniform(0, TAU)
        r = rng.uniform(0.0, 0.11)
        root = np.array([math.cos(a) * r, -0.02, math.sin(a) * r])
        blades = rng.integers(2, 6) if natural else 3
        facing = rng.uniform(0, TAU)
        for b in range(blades):
            length = (rng.uniform(0.45, 1.0) if natural else rng.uniform(0.75, 0.95)) * (0.75 + b * 0.08)
            length = min(length, 1.0)
            width = rng.uniform(0.032, 0.05) if natural else 0.044
            lean_a = facing + (b - blades / 2) * 0.35 + rng.uniform(-0.2, 0.2)
            lean = rng.uniform(0.2, 0.5) if natural else 0.3
            curl = rng.uniform(-0.1, 0.3) if natural else 0.16
            rows = 14 if natural else 12
            h = np.linspace(0, 1, rows)
            bend = lean * h ** 1.6 + curl * np.sin(h * math.pi) * (0.3 if natural else 0.5)
            spine = root + np.stack([math.cos(lean_a) * bend * length, h * length,
                                     math.sin(lean_a) * bend * length], 1)
            widths = width * (0.75 + 0.25 * smoothstep(0.0, 0.12, h))
            tip = smoothstep(0.88, 1.0, h)
            broken = natural and rng.random() < 0.2
            if broken:
                widths = width * np.ones(rows) * (0.8 + 0.2 * smoothstep(0.0, 0.12, h))
            else:
                widths *= (1 - tip * (0.9 if natural else 0.8))
            twist = h * (rng.uniform(-0.6, 0.6) if natural else 0.25)
            side = np.array([-math.sin(lean_a), 0, math.cos(lean_a)])
            m = rg.ribbon(spine, widths, twist, side, (1, 1, 1), 1.0, columns=3, fold=0.08)
            hh = m.uvs[:, 1]
            if natural:
                low, mid, top = srgb([0.30, 0.38, 0.20]), srgb([0.36, 0.50, 0.24]), srgb([0.56, 0.50, 0.30])
                g = mid * (1 - smoothstep(0.0, 0.25, hh))[:, None] * 0 + mid
                col = low * (1 - smoothstep(0.0, 0.2, hh))[:, None] + g * smoothstep(0.0, 0.2, hh)[:, None]
                t = smoothstep(0.6, 1.0, hh) * rng.uniform(0.3, 0.9)
                col = col * (1 - t[:, None]) + top * t[:, None]
                col *= rng.uniform(0.88, 1.08)
            else:
                low, top = srgb([0.22, 0.40, 0.24]), srgb([0.50, 0.68, 0.34])
                t = smoothstep(0.0, 1.0, hh)
                col = low * (1 - t[:, None]) + top * t[:, None]
            m.colors[:, :3] = col
            parts.append(m)
    m = rg.merge(f'Seagrass_{template}', 'Grass', parts)
    m.uvs = m.uvs.copy()
    return m


def build_style(style: str) -> list[rg.Mesh]:
    return [rock(style), brain(style), branching(style)] + [seagrass(style, t) for t in range(3)]


if __name__ == '__main__':
    for style in STYLES:
        for m in build_style(style):
            ext = m.positions.max(0) - m.positions.min(0)
            print(style, m.name, m.triangles, np.round(ext, 2), round(float(m.positions[:, 1].min()), 3))
