import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEEP_FOG, installDeepFog } from '../src/rendering/deepFog';

describe('Pass 026 playtest: the deep gets darker', () => {
  it('installs once, keeping the standard fog above the deep and for linear fog', () => {
    installDeepFog();
    const fragment = THREE.ShaderChunk.fog_fragment;
    installDeepFog();
    expect(THREE.ShaderChunk.fog_fragment).toBe(fragment);
    // Every surface carries its world height to the fog.
    expect(THREE.ShaderChunk.fog_vertex).toContain('vFogWorldY');
    expect(THREE.ShaderChunk.fog_pars_vertex).toContain('vFogWorldY');
    expect(THREE.ShaderChunk.fog_pars_fragment).toContain('vFogWorldY');
    // Exponential fog darkens below `from`; linear fog is untouched.
    expect(fragment).toContain(`${DEEP_FOG.from}.0 - vFogWorldY`);
    expect(fragment).toContain(
      'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );',
    );
  });
  it('never reaches the tank, which stays above the deep', () => {
    // The tank's floor is at y 0; the deep begins below `from`.
    expect(DEEP_FOG.from).toBeLessThan(0);
    expect(DEEP_FOG.to).toBeLessThan(DEEP_FOG.from);
    expect(DEEP_FOG.darkest).toBeGreaterThan(0);
    expect(DEEP_FOG.veil).toBeLessThan(1);
  });
});
