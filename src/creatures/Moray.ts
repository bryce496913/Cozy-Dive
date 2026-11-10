import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MorayBehavior, morayCenter, MORAY_GLSL } from './MorayBehavior';
import { PlantClock } from '../environment/PlantAnimation';
import type { CreatureAnchor } from './CreatureAnchor';
import type { ConvexCollider } from '../player/collision';
import { findMorayDen, type MorayDen } from './MorayDen';
import { MORAY_JAW_HINGE, morayHeadParts } from './MorayHead';
import type { FishHabitat } from '../fish/FishHabitat';
import { safeFishPosition } from '../fish/FishHabitat';
import type { PlayerPresence } from '../fish/FishDiverReaction';

function mottled(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = g.attributes.position,
    c = new Float32Array(p.count * 3),
    color = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const patch =
      Math.sin(z * 79 + Math.sin(x * 48 + y * 31) * 2) *
      Math.cos(x * 41 - y * 37 + z * 23);
    color.setHex(patch > 0.2 ? 0x454a46 : patch > -0.05 ? 0x8e8f7b : 0xcec8aa);
    color.toArray(c, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute(
    'moraySkinMask',
    new THREE.BufferAttribute(new Float32Array(p.count).fill(1), 1),
  );
  return g;
}
function mergeOwned(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const ns = gs.map((g) => {
    g.deleteAttribute('uv');
    return g.index ? g.toNonIndexed() : g;
  });
  const out = mergeGeometries(ns)!;
  gs.forEach((g) => g.dispose());
  ns.forEach((g, i) => {
    if (g !== gs[i]) g.dispose();
  });
  return out;
}
/** Small procedural skin field keeps pale/dark mottling crisp without a texture or CPU deformation. */
function skinShader(
  shader: { vertexShader: string; fragmentShader: string },
  body: boolean,
): void {
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
varying vec3 vMoraySkin;
varying float vMorayMask;
attribute float moraySkinMask;`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vMoraySkin=vec3(position.xy,${body ? 'morayT*2.6' : 'position.z'});vMorayMask=${body ? '1.' : 'moraySkinMask'};`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
varying vec3 vMoraySkin;
varying float vMorayMask;`,
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
    float mottling=sin(vMoraySkin.x*65.+2.*sin(vMoraySkin.z*39.+vMoraySkin.y*27.))*cos(vMoraySkin.z*55.+sin(vMoraySkin.y*65.));
    float mark=smoothstep(.08,.25,mottling);
    vec3 skin=mix(vec3(.60,.57,.43),vec3(.055,.07,.055),mark);
    diffuseColor.rgb=mix(diffuseColor.rgb,skin,vMorayMask);`,
    );
}
/** GPU-deformed tapered body + a tiny head/jaw rig. Soft retreat replaces an oversized hiding-site collider. */
export class Moray {
  readonly root = new THREE.Group();
  readonly behavior = new MorayBehavior();
  readonly clock = new PlantClock();
  readonly head = new THREE.Group();
  readonly jaw = new THREE.Group();
  readonly anchor: CreatureAnchor;
  readonly geometry: THREE.BufferGeometry;
  readonly headGeometry: THREE.BufferGeometry;
  readonly headSkinGeometry: THREE.BufferGeometry;
  readonly jawSkinGeometry: THREE.BufferGeometry;
  /** Head and jaw skin surfaces (UV mapped); authored assets give them the body's skin. */
  readonly skinMeshes: readonly THREE.Mesh[];
  readonly jawGeometry: THREE.BufferGeometry;
  readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.78,
    side: THREE.DoubleSide,
  });
  readonly headMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.78,
  });
  readonly extensionUniform = { value: 0 };
  readonly phaseUniform = { value: 0 };
  private readonly probe = new THREE.Vector3();
  private readonly headWorld = new THREE.Vector3();
  private readonly nextPoint = new THREE.Vector3();
  private readonly forward = new THREE.Vector3(0, 0, 1);
  private disposed = false;
  private accumulator = 0;
  /** Pass 019: the hole in a reef rock the moray lives in. */
  readonly den: MorayDen;
  constructor(h: FishHabitat, supports: readonly ConvexCollider[]) {
    this.root.name = 'Reef-den snowflake-inspired moray';
    this.den = findMorayDen(h, supports);
    this.root.position.copy(this.den.mouth);
    this.root.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      this.den.axis,
    );
    this.root.updateMatrixWorld(true);
    // The exposed head and neck (outside the mouth) stay clear of every solid at every pose; the
    // rest of the body lies inside the rock by design.
    const ring = new THREE.Vector3(),
      others = {
        bounds: h.bounds,
        rocks: h.rocks.filter((r) => r !== this.den.support),
      };
    for (let extension = 0; extension <= 1.0001; extension += 0.1)
      for (let phase = 0; phase < Math.PI * 2; phase += Math.PI / 4)
        for (let i = 0; i <= 24; i++) {
          const u = i / 24,
            r = 0.009 + 0.16 * Math.sin(u * Math.PI * 0.5) ** 0.75;
          morayCenter(u, extension, phase, this.probe);
          if (this.probe.z < 0.05) continue;
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            ring
              .set(
                Math.cos(a) * (i === 24 ? 0.2 : r),
                Math.sin(a) * (i === 24 ? 0.1 : r * 0.85),
                0,
              )
              .add(this.probe)
              .applyMatrix4(this.root.matrixWorld);
            if (!safeFishPosition(ring, 0.01, others))
              throw new Error('Unsafe moray den head envelope.');
          }
        }
    this.anchor = {
      id: 'moray-shelter',
      sourceId: `reef-den/${this.den.supportIndex}`,
      position: {
        x: this.den.mouth.x,
        y: this.den.mouth.y,
        z: this.den.mouth.z,
      },
      orientation: { x: this.den.axis.x, y: 0, z: this.den.axis.z },
      homeRadius: 2.8,
      habitatKind: 'sheltered-crevice',
    };
    const p: number[] = [],
      n: number[] = [],
      t: number[] = [],
      ix: number[] = [];
    const rows = 44,
      columns = 14;
    for (let i = 0; i <= rows; i++)
      for (let j = 0; j <= columns; j++) {
        const u = i / rows,
          a = (j / columns) * Math.PI * 2,
          r = 0.009 + 0.16 * Math.sin(u * Math.PI * 0.5) ** 0.75;
        p.push(Math.cos(a) * r, Math.sin(a) * r * 0.85, u);
        n.push(Math.cos(a), Math.sin(a), 0);
        t.push(u);
      }
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < columns; j++) {
        const a = i * (columns + 1) + j,
          b = a + columns + 1;
        ix.push(a, a + 1, b, a + 1, b + 1, b);
      }
    const body = new THREE.BufferGeometry();
    body.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    body.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    body.setAttribute('morayT', new THREE.Float32BufferAttribute(t, 1));
    body.setIndex(ix);
    mottled(body);
    const finP: number[] = [],
      finT: number[] = [],
      finN: number[] = [],
      finI: number[] = [];
    for (let i = 0; i <= rows; i++) {
      const u = i / rows,
        r = 0.009 + 0.16 * Math.sin(u * Math.PI * 0.5) ** 0.75;
      for (const edge of [0, 1]) {
        finP.push(0, r * 0.82 + edge * 0.085 * Math.sin(Math.PI * u), u);
        finT.push(u);
        finN.push(1, 0, 0);
      }
      if (i < rows) {
        const a = i * 2;
        finI.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const fin = new THREE.BufferGeometry();
    fin.setAttribute('position', new THREE.Float32BufferAttribute(finP, 3));
    fin.setAttribute('normal', new THREE.Float32BufferAttribute(finN, 3));
    fin.setAttribute('morayT', new THREE.Float32BufferAttribute(finT, 1));
    fin.setIndex(finI);
    mottled(fin);
    this.geometry = mergeOwned([body, fin]);
    this.geometry.boundingBox = new THREE.Box3(
      new THREE.Vector3(-0.4, -0.4, -1.9),
      new THREE.Vector3(0.4, 0.4, 1),
    );
    this.geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, 0, -0.45),
      1.6,
    );
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.morayExtension = this.extensionUniform;
      shader.uniforms.morayPhase = this.phaseUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + MORAY_GLSL)
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
        vec3 mt=normalize(morayCenter(min(1.,morayT+.002))-morayCenter(max(0.,morayT-.002)));
        vec3 ms=normalize(cross(vec3(0.,1.,0.),mt));vec3 mu=normalize(cross(mt,ms));
        objectNormal=ms*normal.x+mu*normal.y+mt*normal.z;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
        transformed=morayCenter(morayT)+ms*position.x+mu*position.y;`,
        );
    };
    const deform = this.material.onBeforeCompile;
    this.material.onBeforeCompile = (shader, renderer) => {
      deform.call(this.material, shader, renderer);
      skinShader(shader, true);
    };
    this.headMaterial.onBeforeCompile = (shader) => skinShader(shader, false);
    this.headMaterial.customProgramCacheKey = () => 'moray-head-mottle-v2';
    this.material.customProgramCacheKey = () => 'moray-unfold-v2';
    this.root.add(new THREE.Mesh(this.geometry, this.material));
    // Pass 019 hotfix: a sculpted moray head (snout, brow, eyes, nostrils, teeth, hinged jaw).
    // Skin surfaces are separate meshes so the authored body skin can be applied to them.
    const parts = morayHeadParts();
    this.headSkinGeometry = parts.headSkin;
    this.jawSkinGeometry = parts.jawSkin;
    this.headGeometry = mergeOwned(parts.head);
    this.jawGeometry = mergeOwned(parts.jaw);
    const headSkin = new THREE.Mesh(parts.headSkin, this.headMaterial),
      jawSkin = new THREE.Mesh(parts.jawSkin, this.headMaterial);
    headSkin.name = 'Moray head skin';
    jawSkin.name = 'Moray jaw skin';
    this.skinMeshes = [headSkin, jawSkin];
    this.head.add(
      headSkin,
      new THREE.Mesh(this.headGeometry, this.headMaterial),
    );
    this.jaw.add(jawSkin, new THREE.Mesh(this.jawGeometry, this.headMaterial));
    this.jaw.position.copy(MORAY_JAW_HINGE);
    this.head.add(this.jaw);
    this.root.add(this.head);
    this.pose();
  }
  private pose(): void {
    this.extensionUniform.value = this.behavior.extension;
    this.phaseUniform.value = this.clock.time;
    morayCenter(
      1,
      this.behavior.extension,
      this.clock.time,
      this.head.position,
    );
    morayCenter(
      0.998,
      this.behavior.extension,
      this.clock.time,
      this.nextPoint,
    );
    this.nextPoint.subVectors(this.head.position, this.nextPoint).normalize();
    this.head.quaternion.setFromUnitVectors(this.forward, this.nextPoint);
    // Slow rhythmic gape, as morays breathe by pumping water through the mouth.
    this.jaw.rotation.x =
      0.08 + 0.09 * (0.5 + 0.5 * Math.sin(this.clock.time * 0.7));
  }
  update(
    dt: number,
    active: boolean,
    reduced: boolean,
    player?: PlayerPresence,
  ): void {
    if (this.disposed || !active || !Number.isFinite(dt) || dt <= 0) return;
    this.head.getWorldPosition(this.headWorld);
    let nearby = false;
    if (player?.active) {
      this.probe.set(player.position.x, player.position.y, player.position.z);
      nearby =
        this.probe.distanceTo(this.headWorld) < 1.8 ||
        this.probe.distanceTo(this.root.position) < 1.4;
    }
    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator + 1e-10 >= 1 / 30) {
      this.behavior.update(1 / 30, true, nearby);
      this.clock.update(1 / 30, true, reduced);
      this.accumulator -= 1 / 30;
    }
    this.pose();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.geometry.dispose();
    this.headGeometry.dispose();
    this.headSkinGeometry.dispose();
    this.jawSkinGeometry.dispose();
    this.jawGeometry.dispose();
    this.material.dispose();
    this.headMaterial.dispose();
  }
}
