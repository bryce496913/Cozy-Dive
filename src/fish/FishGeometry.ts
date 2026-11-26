import * as THREE from 'three';
import type { FishSpecies } from './FishSpecies';
import { CORE_FISH } from './lowPoly/designs';
import { coreFishGeometry } from './lowPoly/model';
import { lowPolyMaterial } from '../rendering/lowPoly/resources';

export interface FishVisual {
  readonly root: THREE.Group;
  /** Driver transforms retained for AuthoredSchool; they no longer split the body at joints. */
  readonly rear: THREE.Group;
  readonly tail: THREE.Group;
  readonly leftPectoral: THREE.Group;
  readonly rightPectoral: THREE.Group;
  readonly body: THREE.Mesh;
}
/** The fallback is the canonical species geometry, not a second simplified fish library. */
export class FishGeometry {
  readonly geometries = new Set<THREE.BufferGeometry>();
  readonly materials = new Set<THREE.Material>();
  private readonly geometry: THREE.BufferGeometry;
  private readonly material = lowPolyMaterial({
    role: 'body',
    vertexColors: true,
  });
  private disposed = false;
  constructor(readonly species: FishSpecies) {
    this.geometry = coreFishGeometry(species.id);
    const k = species.length / CORE_FISH[species.id].length;
    this.geometry.scale(k, k, k);
    this.geometries.add(this.geometry);
    this.materials.add(this.material);
  }
  create(size: number): FishVisual {
    const root = new THREE.Group(),
      rear = new THREE.Group(),
      tail = new THREE.Group(),
      leftPectoral = new THREE.Group(),
      rightPectoral = new THREE.Group();
    const body = new THREE.Mesh(this.geometry, this.material);
    body.name = 'Body';
    root.add(body);
    root.scale.setScalar(size);
    return { root, rear, tail, leftPectoral, rightPectoral, body };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
