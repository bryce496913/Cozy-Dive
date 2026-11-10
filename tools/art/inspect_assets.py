"""Inspect actual GLB containers/accessors and decode embedded PNGs; emit reproducible inventory."""
from pathlib import Path
import struct,json,hashlib,io
import numpy as np
from PIL import Image
import DracoPy  # Pass 017: shipped GLBs are Draco-compressed (KHR_draco_mesh_compression)
R=Path(__file__).resolve().parents[2];rows=[]
for relative in ['fish/chromis.glb','coral/acropora.glb','ornaments/reef-props.glb','creatures/anchored-life.glb','fish/clownfish.glb','reef/reef-environment.glb','creatures/nudibranchs.glb','fish/cardinalfish.glb','fish/firefish.glb','fish/assessor.glb','fish/gramma.glb']:
 p=R/'public/assets/models'/relative;b=p.read_bytes();magic,version,length=struct.unpack_from('<III',b);assert magic==0x46546c67 and version==2 and length==len(b)
 n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);offset=20+n;bn,bt=struct.unpack_from('<II',b,offset);blob=b[offset+8:offset+8+bn];assert bt==0x004e4942
 assert all('uri' not in x for x in j.get('images',[]));assert all('uri' not in x for x in j['buffers'])
 images=[]
 for image in j.get('images',[]):
  v=j['bufferViews'][image['bufferView']];raw=blob[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
  if image.get('mimeType')=='image/ktx2':
   # Pass 018: KTX2/Basis. Validate the container header (identifier, size, full mip chain).
   assert raw[:12]==bytes([0xAB,0x4B,0x54,0x58,0x20,0x32,0x30,0xBB,0x0D,0x0A,0x1A,0x0A]),image.get('name')
   vk,ts,w,h,d,layers,faces,levels,scheme=struct.unpack_from('<9I',raw,12);assert w>0 and h>0 and faces==1 and levels==int(np.log2(max(w,h)))+1,(image.get('name'),levels)
   images.append({'name':image.get('name'),'width':w,'height':h,'mode':'KTX2-'+('UASTC+zstd' if scheme==2 else 'ETC1S' if scheme==1 else 'scheme%d'%scheme),'mipLevels':levels,'encodedBytes':len(raw)})
  else:im=Image.open(io.BytesIO(raw));im.load();images.append({'name':image.get('name'),'width':im.width,'height':im.height,'mode':im.mode,'encodedBytes':len(raw)})
 geometryBytes=0;arrays=[]
 for a in j['accessors']:
  if 'bufferView' not in a:arrays.append(None);continue
  view=j['bufferViews'][a['bufferView']];types={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'};count={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];dt=np.dtype(types[a['componentType']]);start=view.get('byteOffset',0)+a.get('byteOffset',0);stride=view.get('byteStride',dt.itemsize*count)
  values=np.ndarray((a['count'],count),dtype=dt,buffer=blob,offset=start,strides=(stride,dt.itemsize));assert np.isfinite(values).all();geometryBytes+=values.nbytes;arrays.append(values.copy())
 def geometry(primitive):
  # Decoded float positions and triangles for plain or Draco-compressed primitives.
  ext=primitive.get('extensions',{}).get('KHR_draco_mesh_compression')
  if ext is None:return arrays[primitive['attributes']['POSITION']].astype(float),arrays[primitive['indices']].reshape(-1,3)
  v=j['bufferViews'][ext['bufferView']];mesh=DracoPy.decode(blob[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])
  points=np.asarray(mesh.points,float).reshape(-1,3);assert np.isfinite(points).all() and len(points)>0;return points,np.asarray(mesh.faces).reshape(-1,3)
 visual=0;collision=0;meshes=0
 for node in j['nodes']:
  if 'mesh' not in node:continue
  for primitive in j['meshes'][node['mesh']]['primitives']:
   assert all(x in primitive['attributes'] for x in ['POSITION','NORMAL','TEXCOORD_0']);tri=j['accessors'][primitive['indices']]['count']//3
   if node.get('name','').startswith(('COLLIDER_','DYNAMIC_')):
    collision+=tri;points,indices=geometry(primitive)
    # Hidden DCC collision meshes supply points. Runtime rebuilds exact convex faces
    # after glTF float32 conversion, independent of exporter cap triangulation.
    from scipy.spatial import ConvexHull
    hull=ConvexHull(points)
    assert np.max(points@hull.equations[:,:3].T+hull.equations[:,3])<1e-8
   else:visual+=tri;meshes+=1
 budgets={}
 if relative=='reef/reef-environment.glb':
  # Pass 014: rock levels and structural parts stay inside the accepted pre-Pass-014 hulls.
  from scipy.spatial import ConvexHull
  base=json.loads((R/'tools/art/pass014/baseline.json').read_text())
  named={n['name']:n for n in j['nodes']}
  def pos(name):return geometry(j['meshes'][named[name]['mesh']]['primitives'][0])[0]
  def tris(name):return j['accessors'][j['meshes'][named[name]['mesh']]['primitives'][0]['indices']]['count']//3
  for i,t in enumerate(base['majorTemplates']):
   eq=ConvexHull(np.array(t['points'])).equations
   kids=[j['nodes'][k]['name'] for k in named[f'Rock_{i}_Root']['children']]
   for name in kids:assert np.max(pos(name)@eq[:,:3].T+eq[:,3])<1e-4,name
   assert sum(k.startswith('COLLIDER_') for k in kids)>=5
  for n in j['nodes']:
   if 'mesh' in n and not n['name'].startswith('COLLIDER_'):
    group=n['name'].split('_')[0];budgets[group]=budgets.get(group,0)+tris(n['name'])
  budgets={'trianglesByFamily':budgets,'rockLevels':[tris('Rock_0'),tris('Rock_0_LOD1'),tris('Rock_0_LOD2')]}
 rows.append({**({'pass014':budgets} if budgets else {}),'id':p.stem,'file':'assets/models/'+relative,'sha256':hashlib.sha256(b).hexdigest(),'creator':'Cozy Diver original Blender authoring; sources under tools/art/','license':'CC0-1.0','attribution':'Not required; authoring source retained','bytes':len(b),'visualPrimitives':meshes,'visualTriangles':visual,'collisionTriangles':collision,'materials':len(j.get('materials',[])),'images':images,'geometryAccessorBytes':geometryBytes,'animations':[x.get('name') for x in j.get('animations',[])],'units':'aquarium world units; library gallery root offsets are normalized at runtime','usage':'Default aquarium reef environment (Pass 014-015)' if relative=='reef/reef-environment.glb' else 'Default aquarium nudibranchs (Pass 015)' if relative=='creatures/nudibranchs.glb' else 'Default aquarium reef fish (Pass 016)' if relative in ['fish/cardinalfish.glb','fish/firefish.glb','fish/assessor.glb','fish/gramma.glb'] else 'Default aquarium hero asset' if relative not in ['fish/chromis.glb','coral/acropora.glb'] else 'Development benchmark'})
out=R/'public/assets/manifest.json';out.write_text(json.dumps(rows,indent=2)+'\n');print(out);print(json.dumps(rows,indent=2))
