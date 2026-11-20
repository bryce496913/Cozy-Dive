import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WATER_PROFILES, type WaterWorldId } from '../src/config/waterProfiles';
import { TANK_LIGHTING } from '../src/config/tankLighting';
import { OUTER } from '../src/config/passage';
import {
  WATER_FOG,
  installDeepFog,
  visibilityScale,
  waterVeil,
} from '../src/rendering/deepFog';
import { createLightRig } from '../src/rendering/atmosphere/lightRig';
import {
  addCaustics,
  advanceCaustics,
  causticTime,
} from '../src/rendering/atmosphere/Caustics';
import { beamMaterial } from '../src/environment/shared/LightBeam';

const WORLDS = Object.keys(WATER_PROFILES) as WaterWorldId[];
const rgb = (hex: number): [number, number, number] => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
/** The old standard exponential-squared veil. */
const exp2 = (distance: number, density: number) =>
  1 - Math.exp(-((density * distance) ** 2));

describe('V0.7 Pass 064 water atmosphere', () => {
  it('keeps every world’s half-visibility distance', () => {
    for (const id of WORLDS) {
      const p = WATER_PROFILES[id];
      const half = Math.sqrt(Math.LN2) / p.fogDensity;
      const water = rgb(p.water),
        veil = waterVeil(half, p.fogDensity, water),
        dominant = water.indexOf(Math.max(...water));
      // The water's dominant channel (absorption 1) is exactly half veiled where it used to be.
      expect(veil[dominant]).toBeCloseTo(0.5, 9);
      expect(exp2(half, p.fogDensity)).toBeCloseTo(0.5, 9);
    }
    // The outer reef's tuned visibility (by request) is untouched.
    expect(WATER_PROFILES.outer.fogDensity).toBe(OUTER.fog);
  });

  it('fades red first in blue-green water (spectral absorption)', () => {
    for (const id of WORLDS) {
      const p = WATER_PROFILES[id];
      const [r, g, b] = waterVeil(10, p.fogDensity, rgb(p.water));
      expect(r).toBeGreaterThan(Math.min(g, b));
    }
  });

  it('gives near water some substance and keeps far forms legible', () => {
    const d = WATER_PROFILES.tank.fogDensity,
      water = rgb(WATER_PROFILES.tank.water);
    const near = waterVeil(3, d, water),
      far = waterVeil(60, d, water);
    expect(Math.max(...near)).toBeGreaterThan(exp2(3, d));
    expect(Math.min(...far)).toBeLessThan(exp2(60, d) + 1e-9);
    expect(visibilityScale(0)).toBeCloseTo(1, 12);
    expect(visibilityScale(WATER_FOG.nearHaze)).toBeLessThan(1);
  });

  it('installs the water fog into the shared shader chunk once', () => {
    installDeepFog();
    const fog = THREE.ShaderChunk.fog_fragment;
    expect(fog).toContain('fogAbsorb');
    expect(fog).toContain(`${WATER_FOG.nearHaze} * fogD`);
    installDeepFog();
    expect(THREE.ShaderChunk.fog_fragment).toBe(fog);
  });

  it('defines a complete, shared-shape profile for every world', () => {
    expect(new Set(WORLDS)).toEqual(
      new Set(['tank', 'outer', 'kelp', 'wreck', 'cave', 'ice']),
    );
    for (const id of WORLDS) {
      const p = WATER_PROFILES[id];
      expect(p.fogDensity).toBeGreaterThan(0);
      expect(p.sun.intensity).toBeGreaterThan(0);
      expect(p.hemisphere.intensity).toBeGreaterThan(0);
      if (p.caustics) {
        expect(p.caustics.fullAbove).toBeGreaterThan(p.caustics.noneBelow);
        expect(p.caustics.strength).toBeLessThanOrEqual(0.4);
      }
      if (p.shafts) expect(p.shafts.intensity).toBeLessThanOrEqual(0.05);
      const rig = createLightRig(p);
      expect(rig.lights.map((l) => l.type)).toEqual([
        'HemisphereLight',
        'DirectionalLight',
        'DirectionalLight',
      ]);
      expect(rig.sun.intensity).toBe(p.sun.intensity);
      expect(rig.sun.position.toArray()).toEqual([...p.sun.position]);
    }
    // The tank profile is the tank rig (also the style benchmark's baseline).
    expect(WATER_PROFILES.tank.hemisphere).toBe(TANK_LIGHTING.hemisphere);
    // Deep, dark or ice-covered worlds have no surface caustics.
    expect(WATER_PROFILES.wreck.caustics).toBeNull();
    expect(WATER_PROFILES.ice.caustics).toBeNull();
  });

  it('runs caustics on simulation time and freezes them under reduced motion', () => {
    advanceCaustics(5, false);
    expect(causticTime()).toBe(5);
    advanceCaustics(6, true);
    advanceCaustics(9, true);
    expect(causticTime()).toBe(5);
    advanceCaustics(10, false);
    expect(causticTime()).toBe(10);
  });

  it('adds caustics to a material once, composing with its own shader hook', () => {
    const m = new THREE.MeshStandardMaterial();
    const spec = WATER_PROFILES.tank.caustics!;
    const u1 = addCaustics(m, spec),
      u2 = addCaustics(m, spec);
    expect(u2).toBe(u1);
    expect(m.customProgramCacheKey()).toContain('caustics-v1');
    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <project_vertex>',
      fragmentShader: '#include <common>\n#include <lights_fragment_end>',
    };
    m.onBeforeCompile(
      shader as unknown as THREE.WebGLProgramParametersWithUniforms,
      {} as THREE.WebGLRenderer,
    );
    expect(shader.fragmentShader).toContain('causticPattern');
    expect(shader.vertexShader).toContain('vCausticWorld');
    expect(Object.keys(shader.uniforms)).toContain('causticTime');
  });

  it('adds beam light without touching destination alpha (office portal)', () => {
    const m = beamMaterial('test');
    expect(m.blending).toBe(THREE.CustomBlending);
    expect(m.blendSrcAlpha).toBe(THREE.ZeroFactor);
    expect(m.blendDstAlpha).toBe(THREE.OneFactor);
    expect(m.fog).toBe(false);
    m.dispose();
  });
});
