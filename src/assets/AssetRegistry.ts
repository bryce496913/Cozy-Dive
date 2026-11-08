export const ASSET_REGISTRY = {
  chromis: {
    path: 'assets/models/fish/chromis.glb',
    requiredNodes: [
      'Chromis_Root',
      'Body',
      'Median_Fins',
      'Pectoral_Left',
      'Pectoral_Right',
    ],
    maxDimension: 0.55,
    minDimension: 0.4,
    requireMorphs: true,
  },
  acropora: {
    path: 'assets/models/coral/acropora.glb',
    requiredNodes: [
      'Acropora_Root',
      'Living_Tissue',
      'Radial_And_Axial_Corallites',
    ],
    maxDimension: 2.2,
    minDimension: 1.4,
    requireMorphs: false,
  },
} as const;
export type AssetId = keyof typeof ASSET_REGISTRY;
