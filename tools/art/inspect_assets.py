"""Inspect actual GLB containers/accessors and decode embedded PNGs; emit reproducible inventory."""
from pathlib import Path
import struct,json,hashlib,io
import numpy as np
from PIL import Image
R=Path(__file__).resolve().parents[2];rows=[]
for relative in ['fish/chromis.glb','coral/acropora.glb','ornaments/reef-props.glb','creatures/anchored-life.glb','fish/clownfish.glb']:
 p=R/'public/assets/models'/relative;b=p.read_bytes();magic,version,length=struct.unpack_from('<III',b);assert magic==0x46546c67 and version==2 and length==len(b)
 n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);offset=20+n;bn,bt=struct.unpack_from('<II',b,offset);blob=b[offset+8:offset+8+bn];assert bt==0x004e4942
 assert all('uri' not in x for x in j.get('images',[]));assert all('uri' not in x for x in j['buffers'])
 images=[]
 for image in j.get('images',[]):
  v=j['bufferViews'][image['bufferView']];raw=blob[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']];im=Image.open(io.BytesIO(raw));im.load();images.append({'name':image.get('name'),'width':im.width,'height':im.height,'mode':im.mode,'encodedBytes':len(raw)})
 geometryBytes=0;arrays=[]
 for a in j['accessors']:
  if 'bufferView' not in a:arrays.append(None);continue
  view=j['bufferViews'][a['bufferView']];types={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'};count={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];dt=np.dtype(types[a['componentType']]);start=view.get('byteOffset',0)+a.get('byteOffset',0);stride=view.get('byteStride',dt.itemsize*count)
  values=np.ndarray((a['count'],count),dtype=dt,buffer=blob,offset=start,strides=(stride,dt.itemsize));assert np.isfinite(values).all();geometryBytes+=values.nbytes;arrays.append(values.copy())
 visual=0;collision=0;meshes=0
 for node in j['nodes']:
  if 'mesh' not in node:continue
  for primitive in j['meshes'][node['mesh']]['primitives']:
   assert all(x in primitive['attributes'] for x in ['POSITION','NORMAL','TEXCOORD_0']);tri=j['accessors'][primitive['indices']]['count']//3
   if node.get('name','').startswith(('COLLIDER_','DYNAMIC_')):
    collision+=tri;points=arrays[primitive['attributes']['POSITION']].astype(float);indices=arrays[primitive['indices']].reshape(-1,3)
    # Hidden DCC collision meshes supply points. Runtime rebuilds exact convex faces
    # after glTF float32 conversion, independent of exporter cap triangulation.
    from scipy.spatial import ConvexHull
    hull=ConvexHull(points)
    assert np.max(points@hull.equations[:,:3].T+hull.equations[:,3])<1e-8
   else:visual+=tri;meshes+=1
 rows.append({'id':p.stem,'file':'assets/models/'+relative,'sha256':hashlib.sha256(b).hexdigest(),'creator':'Cozy Diver original Blender authoring; sources under tools/art/','license':'CC0-1.0','attribution':'Not required; authoring source retained','bytes':len(b),'visualPrimitives':meshes,'visualTriangles':visual,'collisionTriangles':collision,'materials':len(j.get('materials',[])),'images':images,'geometryAccessorBytes':geometryBytes,'animations':[x.get('name') for x in j.get('animations',[])],'units':'aquarium world units; library gallery root offsets are normalized at runtime','usage':'Default aquarium hero asset' if relative not in ['fish/chromis.glb','coral/acropora.glb'] else 'Development benchmark'})
out=R/'public/assets/manifest.json';out.write_text(json.dumps(rows,indent=2)+'\n');print(out);print(json.dumps(rows,indent=2))
