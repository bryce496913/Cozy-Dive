"""Blender 4.3 authoring source. Run blender -b --factory-startup --python this_file.
All geometry/maps original to Cozy Diver; game frame X forward, Y up, Z flank.
"""
import bpy, math, random, json, bmesh
from mathutils import Vector
from pathlib import Path
R=Path(__file__).resolve().parents[2];OUT=R/'public/assets/models';TEX=R/'public/assets/textures';random.seed(12012)
def xyz(p):return (p[0],-p[2],p[1])
def reset():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for d in list(bpy.data.materials):bpy.data.materials.remove(d)
def material(name,folder,base,normal=None,orm=None,alpha=False):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;p=n.get('Principled BSDF');p.inputs['Roughness'].default_value=.42 if folder=='fish' else .77;p.inputs['Metallic'].default_value=0
 image=n.new('ShaderNodeTexImage');image.image=bpy.data.images.load(str(TEX/folder/(base+'.png')),check_existing=True);m.node_tree.links.new(image.outputs['Color'],p.inputs['Base Color'])
 if alpha:
  m.surface_render_method='DITHERED';m.node_tree.links.new(image.outputs['Alpha'],p.inputs['Alpha'])
 if normal:
  im=n.new('ShaderNodeTexImage');im.image=bpy.data.images.load(str(TEX/folder/(normal+'.png')),check_existing=True);im.image.colorspace_settings.name='Non-Color';nm=n.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.20 if folder=='fish' else .38;m.node_tree.links.new(im.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],p.inputs['Normal'])
 if orm:
  im=n.new('ShaderNodeTexImage');im.image=bpy.data.images.load(str(TEX/folder/(orm+'.png')),check_existing=True);im.image.colorspace_settings.name='Non-Color';sep=n.new('ShaderNodeSeparateColor');m.node_tree.links.new(im.outputs['Color'],sep.inputs['Color']);m.node_tree.links.new(sep.outputs['Green'],p.inputs['Roughness']);m.node_tree.links.new(sep.outputs['Blue'],p.inputs['Metallic'])
 return m
def plain(name,color,rough=.4,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
def mesh(name,verts,faces,uv,mat,parent=None):
 g=bpy.data.meshes.new(name);g.from_pydata([xyz(p) for p in verts],[],faces);g.update();o=bpy.data.objects.new(name,g);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
 if parent:o.parent=parent
 if uv:
  layer=g.uv_layers.new(name='UVMap')
  for loop in g.loops:layer.data[loop.index].uv=uv[loop.vertex_index]
 bm=bmesh.new();bm.from_mesh(g);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(g);bm.free()
 for p in g.polygons:p.use_smooth=True
 return o
def join(name,objects):
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=name;return objects[0]
def sphere(name,center,scale,mat,segments=24,rings=14,parent=None):
 vs=[];uv=[];fs=[]
 for i in range(rings+1):
  a=math.pi*i/rings
  for j in range(segments+1):
   b=math.tau*j/segments;vs.append((center[0]+scale[0]*math.sin(a)*math.cos(b),center[1]+scale[1]*math.cos(a),center[2]+scale[2]*math.sin(a)*math.sin(b)));uv.append((j/segments,i/rings))
 for i in range(rings):
  for j in range(segments):
   a=i*(segments+1)+j;fs.append((a,a+1,a+segments+2,a+segments+1))
 return mesh(name,vs,fs,uv,mat,parent)
def tube(name,points,radii,mat,sides=10,parent=None):
 vs=[];fs=[];uv=[]
 for i,p in enumerate(points):
  p=Vector(p);t=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)]);t.normalize();a=t.cross(Vector((0,0,1)))
  if a.length<.01:a=t.cross(Vector((1,0,0)))
  a.normalize();b=t.cross(a).normalized()
  for j in range(sides+1):
   q=p+(a*math.cos(j/sides*math.tau)+b*math.sin(j/sides*math.tau))*radii[i];vs.append(tuple(q));uv.append((j/sides,i/(len(points)-1)))
 for i in range(len(points)-1):
  for j in range(sides):
   a=i*(sides+1)+j;fs.append((a,a+1,a+sides+2,a+sides+1))
 fs.extend([tuple(range(sides-1,-1,-1)),tuple((len(points)-1)*(sides+1)+j for j in range(sides))]);return mesh(name,vs,fs,uv,mat,parent)
def export(name):
 for image in bpy.data.images:
  if image.source=='FILE' and image.has_data:image.pack()
 bpy.ops.wm.save_as_mainfile(filepath=str(R/'tools/art'/f'{name}.blend'))
 bpy.ops.export_scene.gltf(filepath=str(OUT/('fish' if name=='chromis' else 'coral')/(name+'.glb')),export_format='GLB',export_yup=True,export_extras=True,export_animations=True,export_morph=True,export_morph_normal=True,export_animation_mode='NLA_TRACKS')
def fish():
 reset();skin=material('Chromis_Scale_Skin','fish','chromis-base','chromis-normal','chromis-orm');fin=material('Chromis_Fin_Membrane','fish','chromis-fins',alpha=True);eye=plain('Chromis_Eye_And_Anatomy',(.13,.25,.21),.3)
 root=bpy.data.objects.new('Chromis_Root',None);bpy.context.collection.objects.link(root)
 # Hand-drawn cross-section schedule, interpolated with cubic Bezier tangents.
 profile=[(-.170,.006,.004),(-.145,.015,.008),(-.110,.032,.014),(-.070,.058,.025),(-.015,.080,.033),(.045,.089,.038),(.095,.083,.035),(.140,.064,.028),(.174,.037,.019),(.195,.018,.011),(.205,.005,.003)]
 def section(x,k):
  i=next((i for i in range(len(profile)-1) if x<=profile[i+1][0]),len(profile)-2);a,b=profile[i],profile[i+1];t=(x-a[0])/(b[0]-a[0]);lo=profile[max(0,i-1)];hi=profile[min(len(profile)-1,i+2)];m0=(b[k]-lo[k])/(b[0]-lo[0])*(b[0]-a[0]);m1=(hi[k]-a[k])/(hi[0]-a[0])*(b[0]-a[0]);return max(.002,(2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*m0+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*m1)
 vs=[];uv=[];fs=[];rows=64;cols=40
 for i in range(rows+1):
  x=-.17+.375*i/rows
  for j in range(cols+1):
   a=math.tau*j/cols;y=math.cos(a)*section(x,1);z=math.sin(a)*section(x,2);y-=max(0,(x-.12)/.085)*.007;vs.append((x,y,z));uv.append((i/rows,j/cols))
 for i in range(rows):
  for j in range(cols):
   a=i*(cols+1)+j;fs.append((a,a+cols+1,a+cols+2,a+1))
 fs.extend([tuple(range(cols-1,-1,-1)),tuple(rows*(cols+1)+j for j in range(cols))]);body=mesh('Body',vs,fs,uv,skin,root)
 # Curved fan grids: rays are modelled as fine shallow ridges in each membrane.
 def fan(name,base,edge,rays,side=0,parent=root):
  vs=[];uv=[];fs=[];steps=8
  for j in range(rays*3+1):
   u=j/(rays*3);b=Vector(base(u));e=Vector(edge(u))
   for i in range(steps+1):
    v=i/steps;p=b.lerp(e,v);p.z+=math.sin(u*math.pi)*math.sin(v*math.pi)*.003+math.cos(u*math.tau*rays)*.0005*v;vs.append(tuple(p));uv.append((u,v))
  for j in range(rays*3):
   for i in range(steps):
    a=j*(steps+1)+i;fs.append((a,a+steps+1,a+steps+2,a+1))
  return mesh(name,vs,fs,uv,fin,parent)
 dorsal=fan('Dorsal',lambda u:(.114-.258*u,section(.114-.258*u,1)*.96,0),lambda u:(.114-.277*u,.06+math.sin(math.pi*u)**.7*.069+.0012*math.sin(u*math.pi*24),0),18)
 anal=fan('Anal',lambda u:(.005-.145*u,-section(.005-.145*u,1)*.95,0),lambda u:(.012-.187*u,-.065-math.sin(math.pi*u)**.8*.045,0),13)
 caudal=fan('Caudal',lambda u:(-.162,(u-.5)*.012,0),lambda u:(-.207-.048*abs(2*u-1)**.8,(u-.5)*.162,0),17)
 pelvic=[]
 for side in [-1,1]:pelvic.append(fan('Pelvic',lambda u:(.036,-.074,side*.012),lambda u:(.015-u*.057,-.083-u*.025,side*(.015+u*.012)),5))
 fins=join('Median_Fins',[dorsal,anal,caudal,*pelvic]);fins.parent=root
 pectorals=[]
 for side,name in [(1,'Pectoral_Left'),(-1,'Pectoral_Right')]:
  p=fan(name,lambda u:(0,0,0),lambda u:(-.007-u*.058,-.006-math.sin(u*math.pi)*.022,side*(.009+math.sin(u*math.pi*.8)*.034)),10);p.location=xyz((.065,-.015,side*.029));p.parent=root;pectorals.append(p)
 # Integrated modest eyes, an iris rim and curved gill edge, all shaded as dimensional anatomy.
 details=[]
 iris=plain('Iris',(.36,.48,.31),.25);pupil=plain('Pupil',(.008,.018,.022),.19);mouthmat=plain('Gill_Recess',(.055,.19,.19),.6)
 for side in [-1,1]:
  details.append(sphere('Eye_Socket',(.133,.027,side*.025),(.015,.014,.0065),skin,20,12))
  details.append(sphere('Iris',(.134,.028,side*.0297),(.0108,.0108,.0035),iris,24,14))
  details.append(sphere('Pupil',(.135,.028,side*.032),(.0068,.0075,.002),pupil,24,12))
  pts=[]
  for i in range(21):
   a=-1.05+2.15*i/20;x=.084-.026*math.cos(a);y=.002+.056*math.sin(a);z=side*(section(x,2)*math.sqrt(max(.1,1-(y/section(x,1))**2))+.0003);pts.append((x,y,z))
  details.append(tube('Operculum_Recess',pts,[.0008]*len(pts),mouthmat,6))
  pts=[(.200,-.009,side*.005),(.191,-.013,side*.012),(.177,-.012,side*.015)];details.append(tube('Mouth_Fold',pts,[.0009,.0008,.0003],mouthmat,6))
  pts=[(.094,.012,side*.035),(.073,.018,side*.035),(.04,.022,side*.034),(-.005,.023,side*.031),(-.065,.015,side*.023)];details.append(tube('Lateral_Line',pts,[.0004]*len(pts),skin,5))
 detail=join('Eyes_Gills_Mouth',details);detail.parent=root
 # One continuous rear-body bend field, shared by skin, peduncle and median membranes.
 for o in [body,fins]:
  o.shape_key_add(name='Basis')
  for sign,name in [(1,'Stroke_Left'),(-1,'Stroke_Right')]:
   key=o.shape_key_add(name=name)
   for i,v in enumerate(o.data.vertices):
    x=v.co.x;weight=min(1,max(0,(.035-x)/.29));key.data[i].co.y-=sign*.036*weight*weight;key.data[i].co.x+=.003*weight*weight
  for f in range(1,34,4):
   phase=(f-1)/32*math.tau
   for sign,name in [(1,'Stroke_Left'),(-1,'Stroke_Right')]:
    k=o.data.shape_keys.key_blocks[name];k.value=max(0,math.sin(phase)*sign);k.keyframe_insert('value',frame=f)
  action=o.data.shape_keys.animation_data.action;track=o.data.shape_keys.animation_data.nla_tracks.new();track.name='SwimPreview';track.strips.new(action.name,1,action);o.data.shape_keys.animation_data.action=None
 for p in pectorals:
  for f in range(1,34,4):p.rotation_euler.z=.12*math.sin((f-1)/32*math.tau);p.keyframe_insert('rotation_euler',frame=f)
  action=p.animation_data.action;track=p.animation_data.nla_tracks.new();track.name='SwimPreview';track.strips.new(action.name,1,action);p.animation_data.action=None
 bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=33;bpy.context.scene.frame_set(1)
 export('chromis')
def coral():
 reset();tissue=material('Acropora_Peach_Tissue','coral','acropora-base','acropora-normal','acropora-orm');root=bpy.data.objects.new('Acropora_Root',None);bpy.context.collection.objects.link(root);branches=[];paths=[]
 # Deliberately asymmetric hand-selected scaffold, then deterministic secondary growth.
 specs=[((0,0,0),(.02,1.48,.04),.12),((.01,.25,0),(-.50,1.23,.23),.095),((.01,.45,0),(.54,1.68,-.18),.09),((-.23,.75,.1),(-.51,1.75,.34),.061),((.27,1.0,-.1),(.72,1.43,.22),.056),((-.12,.6,.03),(-.64,1.12,-.31),.07),((.04,.7,-.03),(.14,1.37,-.52),.072),((-.17,.65,.08),(-.16,1.35,.65),.06)]
 for idx,(a,b,r) in enumerate(specs):
  a=Vector(a);b=Vector(b);pts=[];rs=[]
  for j in range(17):
   t=j/16;p=a.lerp(b,t);p.x+=math.sin(t*math.pi)*(.025*math.sin(idx*1.7));p.z+=math.sin(t*math.pi)*.025*math.cos(idx*2);pts.append(tuple(p));rs.append(r*(1-t)**.7+.021*t)
  paths.append((pts,rs));branches.append(tube('Scaffold',pts,rs,tissue,12))
  # Branchlets are attached to the growing scaffold, not disconnected cloned cylinders.
  for j in [5,8,11,14]:
   if idx>4 and j==14:continue
   p=Vector(pts[j]);ang=idx*2.1+j*1.7;length=.18+.12*random.random();end=p+Vector((math.cos(ang)*length*.62,length,math.sin(ang)*length*.62));ps=[tuple(p.lerp(end,t/7)+Vector((.01*math.sin(t/7*math.pi),0,.005*math.sin(t)))) for t in range(8)];rr=[rs[j]*(.70*(1-t/7)+.35*t/7) for t in range(8)];paths.append((ps,rr));branches.append(tube('Branchlet',ps,rr,tissue,10))
 # Finer tertiary forks give the colony a varied crown rather than a bare scaffold.
 for idx,(pts,rs) in list(enumerate(paths))[8:]:
  if idx%2:continue
  p=Vector(pts[4]);ang=idx*1.73;end=p+Vector((math.cos(ang)*.12,.16+random.random()*.09,math.sin(ang)*.12));ps=[tuple(p.lerp(end,t/6)) for t in range(7)];rr=[rs[4]*(.8*(1-t/6)+.18*t/6) for t in range(7)];paths.append((ps,rr));branches.append(tube('TertiaryFork',ps,rr,tissue,8))
 foot=sphere('Scaffold_Base',(0,-.015,0),(.24,.075,.21),tissue,32,12);branches.append(foot)
 fineBranches=[o for o in branches if o.name.startswith(('Branchlet','TertiaryFork'))]
 skeleton=join('Living_Tissue',[o for o in branches if o.name.startswith('Scaffold')]);skeleton.parent=root
 # Fuse branch junctions in Blender, then reduce only the uniformly oversampled volume.
 bpy.context.view_layer.objects.active=skeleton;rem=skeleton.modifiers.new('Fused biological growth','REMESH');rem.mode='VOXEL';rem.voxel_size=.008;bpy.ops.object.modifier_apply(modifier=rem.name);sm=skeleton.modifiers.new('Tissue smoothing','SMOOTH');sm.factor=.65;sm.iterations=3;bpy.ops.object.modifier_apply(modifier=sm.name);dec=skeleton.modifiers.new('Surface budget','DECIMATE');dec.ratio=.20;bpy.ops.object.modifier_apply(modifier=dec.name)
 skeleton=join('Living_Tissue',[skeleton,*fineBranches]);skeleton.parent=root
 g=skeleton.data;layer=g.uv_layers.new(name='UVMap') if not g.uv_layers else g.uv_layers[0]
 for loop in g.loops:
  p=g.vertices[loop.vertex_index].co;layer.data[loop.index].uv=((math.atan2(p.y,p.x)/math.tau+.5)*3,(p.z/1.85)*.94+.03)
 for p in g.polygons:p.use_smooth=True
 # Raised flared radial corallite cups; recessed center and an axial cup at each living tip.
 cups=[]
 def cup(center,axis,radius,axial=False):
  axis=Vector(axis).normalized();a=axis.cross(Vector((0,1,0)))
  if a.length<.01:a=axis.cross(Vector((1,0,0)))
  a.normalize();b=axis.cross(a);vs=[];uv=[];faces=[];sides=6
  profile=[(1,0),(1.04,.004),(.78,.009),(.40,.003)]
  for k,(rad,up) in enumerate(profile):
   for j in range(sides+1):
    angle=j/sides*math.tau;v=Vector(center)+(a*math.cos(angle)+b*math.sin(angle))*radius*rad+axis*up*(1.5 if axial else 1);vs.append(tuple(v));uv.append((j/sides,.87 if k==2 else .04 if k==4 else .45))
  for k in range(len(profile)-1):
   for j in range(sides):
    i=k*(sides+1)+j;faces.append((i,i+1,i+sides+2,i+sides+1))
  faces.append(tuple((len(profile)-1)*(sides+1)+j for j in range(sides)));return mesh('Corallite',vs,faces,uv,tissue)
 for idx,(pts,rs) in enumerate(paths):
  stride=1 if idx<8 else 2
  for j in range(2,len(pts)-1,stride):
   tangent=Vector(pts[min(j+1,len(pts)-1)])-Vector(pts[max(j-1,0)]);tangent.normalize();a=tangent.cross(Vector((0,0,1))).normalized();b=tangent.cross(a)
   for k in range(9 if idx<8 else 5):
    angle=k*2.39996+j*.71+idx;out=a*math.cos(angle)+b*math.sin(angle);center=Vector(pts[j])+out*rs[j]*.87;axis=(out*.8+tangent*.5).normalized();cups.append(cup(center,axis,.0105 if idx<8 else min(.006,rs[j]*.45)))
  cups.append(cup(pts[-1],Vector(pts[-1])-Vector(pts[-2]),rs[-1]*.95,True))
 calices=join('Radial_And_Axial_Corallites',cups);calices.parent=root
 # Convex components derive from those same branch paths. Fine calyx tissue remains passable.
 colliderMat=plain('Collision_Only',(.1,.1,.1))
 for idx,(pts,rs) in enumerate(paths):
  if idx>=8 and max(rs)<.016:continue
  for part,(start,end) in enumerate([(0,len(pts)//2),(len(pts)//2,len(pts)-1)]):
   o=tube(f'COLLIDER_{idx:02d}_{part}',pts[start:end+1],[r+.004 for r in rs[start:end+1]],colliderMat,8,root);bm=bmesh.new();[bm.verts.new(v.co) for v in o.data.vertices];bmesh.ops.convex_hull(bm,input=list(bm.verts),use_existing_faces=False);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));center=sum((v.co for v in bm.verts),Vector())/len(bm.verts);
   for face in bm.faces:
    if face.normal.dot(face.calc_center_median()-center)<0:face.normal_flip()
   bm.to_mesh(o.data);bm.free();
   if not o.data.uv_layers:o.data.uv_layers.new(name='UVMap')
   o['collision']=True
 export('acropora')
if __name__ == '__main__':
 fish();coral();print('COZY_AUTHORING_COMPLETE')
