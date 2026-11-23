import * as THREE from 'three';

/**
 * V0.8 Pass 089: light seeping in from beyond a passage, as a landmark through dense water.
 *
 * With the outer reef's murk shared by the shipwreck and the sea cave (`DENSE_WATER_FOG`), a tunnel
 * mouth or the shaft home is lost in the water from more than about 10 m away. Rather than thin the
 * approved murk, each passage carries a soft glow a little way inside it: a disc of additive light,
 * brightest at its centre and fading to nothing at its rim, which the fog does not veil (like the
 * cave's sunbeam), so it reads from across the water as daylight or cold water beyond the passage.
 *
 * Up close the passage itself is plainly visible, so the glow fades out within `near` m and is gone
 * before the swimmer reaches it (no flash on swimming through). It does not move or flicker, so it
 * needs nothing under reduced motion. One small mesh per passage; owns its geometry and material.
 */
export interface PassageGlowSpec {
  readonly name: string;
  /** The disc's centre and the way it faces (towards the water it is seen from). */
  readonly at: THREE.Vector3Like;
  readonly facing: THREE.Vector3Like;
  readonly radius: number;
  /** The light's colour, and its brightness at the centre (additive, 0..1). */
  readonly tint: readonly [number, number, number];
  readonly peak: number;
}

/** Fully faded within `near` m of the eye, full from `far` m away. */
export const PASSAGE_GLOW = { near: 4, far: 10, rings: 8, sides: 32 } as const;

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How strongly a glow shows at `distance` m from the eye (0..1). */
export function passageGlowStrength(distance: number): number {
  return smooth(PASSAGE_GLOW.near, PASSAGE_GLOW.far, distance);
}

export class PassageGlow {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly centre = new THREE.Vector3();
  private readonly peak: number;

  constructor(spec: PassageGlowSpec) {
    const { rings, sides } = PASSAGE_GLOW,
      pos: number[] = [0, 0, 0],
      col: number[] = [...spec.tint],
      idx: number[] = [];
    for (let i = 1; i <= rings; i++) {
      const u = i / rings,
        // Soft falloff: bright core, long faint skirt, zero at the rim.
        k = (1 - u) ** 2;
      for (let j = 0; j < sides; j++) {
        const a = (j / sides) * Math.PI * 2;
        pos.push(
          Math.cos(a) * spec.radius * u,
          Math.sin(a) * spec.radius * u,
          0,
        );
        col.push(spec.tint[0] * k, spec.tint[1] * k, spec.tint[2] * k);
      }
    }
    for (let j = 0; j < sides; j++) idx.push(0, 1 + j, 1 + ((j + 1) % sides));
    for (let i = 1; i < rings; i++)
      for (let j = 0; j < sides; j++) {
        const a = 1 + (i - 1) * sides + j,
          b = 1 + (i - 1) * sides + ((j + 1) % sides);
        idx.push(a, a + sides, b, b, a + sides, b + sides);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    this.material = new THREE.MeshBasicMaterial({
      name: `${spec.name} material`,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      // Additive colour, destination alpha untouched (as `beamMaterial`, Pass 064).
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.name = spec.name;
    this.mesh.renderOrder = 2;
    this.centre.set(spec.at.x, spec.at.y, spec.at.z);
    this.mesh.position.copy(this.centre);
    this.mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(
        spec.facing.x,
        spec.facing.y,
        spec.facing.z,
      ).normalize(),
    );
    this.mesh.updateMatrix();
    this.mesh.matrixAutoUpdate = false;
    this.peak = spec.peak;
  }

  /** Fade with the eye's distance (allocation-free). */
  update(eye: THREE.Vector3Like): void {
    const dx = eye.x - this.centre.x,
      dy = eye.y - this.centre.y,
      dz = eye.z - this.centre.z,
      s = passageGlowStrength(Math.sqrt(dx * dx + dy * dy + dz * dz));
    this.material.opacity = this.peak * s;
    this.mesh.visible = s > 0.001;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
