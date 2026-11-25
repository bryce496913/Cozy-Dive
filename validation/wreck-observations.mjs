/** Focused CPU visibility profile on the actual static wreck, without rendering or traversal. */
import { createServer } from 'vite';
import * as THREE from 'three';
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
});
try {
  const { ShipwreckModel } = await server.ssrLoadModule(
    '/src/environment/wreck/ShipwreckModel.ts',
  );
  const { WreckMinis, WRECK_MINI_NODES, WRECK_MINI_TUNING, wreckMiniSolids } =
    await server.ssrLoadModule('/src/environment/wreck/WreckMinis.ts');
  const { WreckMiniOcclusion } = await server.ssrLoadModule(
    '/src/environment/wreck/WreckMiniOcclusion.ts',
  );
  const ship = new ShipwreckModel(),
    minis = new WreckMinis({ ship }),
    model = new THREE.Group(),
    fixtures = [];
  // Geometry here only satisfies the lease interface. Visibility always uses the real steel.
  for (const name of Object.values(WRECK_MINI_NODES)) {
    const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1),
      material = new THREE.MeshStandardMaterial(),
      mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    model.add(mesh);
    fixtures.push({ geometry, material });
  }
  const solids = wreckMiniSolids({ ship }),
    crop = new WreckMiniOcclusion(solids, minis.homes, WRECK_MINI_TUNING.reach);
  try {
    await minis.load({
      acquire: async () => ({ model, animations: [], release() {} }),
      evictUnused() {},
    });
    const result = {
      sourceTriangles: solids.reduce(
        (n, m) =>
          n +
          (m.geometry.index?.count ??
            m.geometry.getAttribute('position').count) /
            3,
        0,
      ),
      homes: {},
    };
    for (const [i, kind] of Object.keys(WRECK_MINI_NODES).entries()) {
      const eye = minis.homes[kind].view,
        sight = minis.sightings[i];
      for (let j = 0; j < 10; j++) sight.visibleFrom(eye);
      const ray = new THREE.Raycaster(),
        hits = [],
        direction = new THREE.Vector3(
          sight.position.x - eye.x,
          sight.position.y - eye.y,
          sight.position.z - eye.z,
        );
      ray.far = direction.length() - 0.025;
      ray.set(eye, direction.normalize());
      const full = () => {
        hits.length = 0;
        ray.intersectObjects(solids, false, hits);
      };
      for (let j = 0; j < 10; j++) full();
      const fullStart = performance.now();
      for (let j = 0; j < 100; j++) full();
      const fullMs = (performance.now() - fullStart) / 100;
      const start = performance.now();
      for (let j = 0; j < 100; j++) sight.visibleFrom(eye);
      result.homes[kind] = {
        msPerQuery: (performance.now() - start) / 100,
        fullMeshMsPerQuery: fullMs,
        nearbyTriangles: crop.triangleCount(kind),
      };
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    crop.dispose();
    minis.dispose();
    ship.dispose();
    fixtures.forEach((f) => {
      f.geometry.dispose();
      f.material.dispose();
    });
  }
} finally {
  await server.close();
}
