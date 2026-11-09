"""Export GLB structural point sets, including node transforms, for CPU collision validation."""
from pathlib import Path
import json,struct,numpy as np
from scipy.spatial.transform import Rotation
R=Path(__file__).resolve().parents[3];b=(R/'public/assets/models/ornaments/reef-props.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);blob=b[28+n:];out={}
def matrix(node):
 if 'matrix'in node:return np.array(node['matrix']).reshape(4,4).T
 m=np.eye(4);m[:3,:3]=Rotation.from_quat(node.get('rotation',[0,0,0,1])).as_matrix()@np.diag(node.get('scale',[1,1,1]));m[:3,3]=node.get('translation',[0,0,0]);return m
def visit(i,transform,rows):
 node=j['nodes'][i];m=transform@matrix(node)
 if node.get('name','').startswith(('COLLIDER_','DYNAMIC_')):
  a=j['accessors'][j['meshes'][node['mesh']]['primitives'][0]['attributes']['POSITION']];v=j['bufferViews'][a['bufferView']];p=np.ndarray((a['count'],3),dtype='<f4',buffer=blob,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',12),4));rows.append({'name':node['name'],'points':np.round((np.c_[p,np.ones(len(p))]@m.T)[:,:3],7).tolist()})
 for child in node.get('children',[]):visit(child,m,rows)
for i,node in enumerate(j['nodes']):
 if node.get('name') in ['Log','Shipwreck','Arch','Filter','Chest','Statue']:
  rows=[]
  for child in node.get('children',[]):visit(child,np.eye(4),rows)
  out[node['name']]=rows
(R/'tools/art/pass013/collisions.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
