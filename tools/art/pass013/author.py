"""Original Blender prop/anchored libraries, Pass 013. Game X-right, Y-up, Z-front.
Packed .blend sources use Blender Z-up; exports bake conversion into vertices.
"""
import bpy,bmesh,math,json,random,sys,inspect
from pathlib import Path
from mathutils import Vector,Matrix
R=Path(__file__).resolve().parents[3];sys.path.insert(0,str(R/'tools/art'))
import author_benchmark as common
from author_benchmark import mesh,tube,sphere,join,plain,xyz
random.seed(13013);BASE=json.loads((R/'tools/art/pass013/baseline.json').read_text());M={};MODEL_ROOTS=[]
def reset():
 common.reset()
 for image in list(bpy.data.images):
  if image.source=='FILE' and image.users==0:bpy.data.images.remove(image)
 MODEL_ROOTS.clear();M.clear()
def mat(name,color,rough=.75,metal=0,texture=None):
 m=plain(name,color,rough,metal)
 if texture:
  p=m.node_tree.nodes.get('Principled BSDF');nodes=m.node_tree.nodes;links=m.node_tree.links
  for channel in ['base','normal','orm']:
   n=nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(R/f'tools/art/textures/pass013/{texture}-{channel}.png'),check_existing=True)
   if channel=='base':links.new(n.outputs['Color'],p.inputs['Base Color'])
   else:
    n.image.colorspace_settings.name='Non-Color'
    if channel=='normal':a=nodes.new('ShaderNodeNormalMap');a.inputs['Strength'].default_value=.3;links.new(n.outputs['Color'],a.inputs['Color']);links.new(a.outputs['Normal'],p.inputs['Normal'])
    else:a=nodes.new('ShaderNodeSeparateColor');links.new(n.outputs['Color'],a.inputs['Color']);links.new(a.outputs['Green'],p.inputs['Roughness'])
 M[name]=m;return m
def root(name,index):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location.x=index*7;MODEL_ROOTS.append(o);return o
def box(name,size,p,material,parent,bevel=.02):
 x,y,z=size;cx,cy,cz=p;vs=[(cx+a*x/2,cy+b*y/2,cz+c*z/2) for a,b,c in [(-1,-1,-1),(-1,-1,1),(-1,1,1),(-1,1,-1),(1,-1,-1),(1,-1,1),(1,1,1),(1,1,-1)]];faces=[(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7),(1,5,6,2),(0,3,7,4)]
 o=mesh(name,vs,faces,[(a[0]*2,a[1]*2) for a in vs],material,parent)
 if bevel:
  bpy.context.view_layer.objects.active=o;b=o.modifiers.new('Resolved edges','BEVEL');b.width=bevel;b.segments=3;bpy.ops.object.modifier_apply(modifier=b.name)
 return o
def convex(name,points,parent):
 # Structural support samples bound convex proxy complexity independently of visible bevel/sculpt density.
 # Keep extrema along a uniform sphere and all box diagonals; fine bark/pores remain visual detail.
 if name.startswith('COLLIDER_') and len(points)>64:
  directions=[Vector((math.cos(i*2.399963)*(1-(1-2*(i+.5)/80)**2)**.5,1-2*(i+.5)/80,math.sin(i*2.399963)*(1-(1-2*(i+.5)/80)**2)**.5)) for i in range(80)]
  directions += [Vector((x,y,z)) for x in [-1,0,1] for y in [-1,0,1] for z in [-1,0,1] if x or y or z]
  selected={max(range(len(points)),key=lambda i:Vector(points[i]).dot(d)) for d in directions}
  points=[points[i] for i in sorted(selected)]
 o=mesh(name,points,[],[],M['Proxy'],parent);bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.convex_hull(bm,input=list(bm.verts),use_existing_faces=False);bm.to_mesh(o.data);bm.free()
 if not o.data.uv_layers:o.data.uv_layers.new(name='UVMap')
 o['collision_points']=True;return o
def proxy_object(o,parent,name=None):
 return convex('COLLIDER_'+(name or o.name),[(v.co.x,v.co.z,-v.co.y) for v in o.data.vertices],parent)
def merge_materials(parent,prefix):
 groups={}
 for o in list(parent.children):
  if o.type=='MESH' and not o.name.startswith(('COLLIDER_','DYNAMIC_')):groups.setdefault(o.data.materials[0].name,[]).append(o)
 for key,objects in groups.items():
  if len(objects)>1:o=join(prefix+'_'+key,objects);o.parent=parent
 # Each visible family keeps a small number of render primitives.
def growth(parent,at,scale=1,seed=0):
 rng=random.Random(seed);material=M['Growth']
 for i in range(5):
  a=i*2.399+seed;start=Vector(at)+Vector((math.cos(a)*.04,0,math.sin(a)*.04))*scale;end=start+Vector((math.cos(a)*.1,.15+rng.random()*.11,math.sin(a)*.1))*scale
  pts=[tuple(start.lerp(end,t/6)+Vector((math.sin(t/6*math.pi)*.025*scale,0,0))) for t in range(7)];tube('Attached_Coral',pts,[scale*(.015*(1-t/6)+.006*t/6) for t in range(7)],material,8,parent)
  b=Vector(pts[3]);tip=b+Vector((.06*math.cos(a+.6),.09,.06*math.sin(a+.6)))*scale;tube('Coral_Fork',[tuple(b),tuple(b.lerp(tip,.5)),tuple(tip)],[.009*scale,.007*scale,.003*scale],material,7,parent)
def export(filename,folder):
 for image in bpy.data.images:
  if image.source=='FILE' and image.has_data:image.pack()
 bpy.ops.wm.save_as_mainfile(filepath=str(R/'tools/art/pass013'/f'{filename}.blend'))
 # Bake Blender Z-up to game Y-up, retaining simple controller-local mesh frames.
 C=Matrix.Rotation(-math.pi/2,4,'X')
 for o in bpy.context.scene.objects:
  o.location=C@o.location
  if o.type=='MESH':o.data.transform(C,shape_keys=True)
 out=R/f'public/assets/models/{folder}/{filename}.glb';out.parent.mkdir(parents=True,exist_ok=True)
 bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_yup=False,export_extras=True,export_animations=False)
def authored_stone(points,parent,name,protected=[]):
 o=convex(name,points,parent);o.name=name;o.data.materials.clear();o.data.materials.append(M['Stone']);o['collision_points']=False
 bpy.context.view_layer.objects.active=o;bev=o.modifiers.new('Weathered edges','BEVEL');bev.width=.045;bev.segments=3;bpy.ops.object.modifier_apply(modifier=bev.name)
 sub=o.modifiers.new('Sculpt surface topology','SUBSURF');sub.subdivision_type='SIMPLE';sub.levels=2;bpy.ops.object.modifier_apply(modifier=sub.name)
 for v in o.data.vertices:
  x,y,z=v.co.x,v.co.z,-v.co.y
  if all((Vector((x,y,z))-Vector(p)).length>.37 for p in protected):
   # Surface breakup stays shallow; large forms and passage are authored, not random noise.
   v.co.y-=math.sin(x*12+y*9)*math.cos(y*13+z*3)*.012
 layer=o.data.uv_layers[0] if o.data.uv_layers else o.data.uv_layers.new(name='UVMap')
 for loop in o.data.loops:
  p=o.data.vertices[loop.vertex_index].co;layer.data[loop.index].uv=(p.x*.7+p.y*.25,p.z*.7)
 for face in o.data.polygons:face.use_smooth=True
 return o

def props():
 reset();mat('Proxy',(.1,.1,.1));mat('Wood',(.35,.25,.14),texture='wood');mat('Cut_Wood',(.48,.34,.19),texture='wood');mat('Stone',(.48,.49,.43),texture='stone');mat('Equipment',(.065,.11,.115),.43);mat('Dark',(.025,.04,.036),.72);mat('Metal',(.36,.31,.19),.48,.25);mat('Growth',(.52,.57,.45),.82)
 # LOG: continuous uneven bark shell and shaped inner bore, not polygonal sectors.
 log=root('Log',0);vs=[];uv=[];fs=[];N=72;L=40
 def logpoint(a,z,inside):
  shift=z*z*.055;radius=(1.045+.012*math.sin(a*3+z)) if inside else 1.27+.042*math.sin(a*5+z*.8)+.018*math.sin(a*17-z*2)
  return (math.cos(a)*radius+shift,1.28+math.sin(a)*radius+.035*math.sin(z*1.5),z+(abs(z)/1.6)**8*.105*math.sin(a*3+.6))
 for side in [False,True]:
  for j in range(L+1):
   z=-1.6+3.2*j/L
   for i in range(N+1):a=i/N*math.tau;vs.append(logpoint(a,z,side));uv.append((i/N*4,j/L*2))
 stride=N+1;layer=(L+1)*stride
 for s in range(2):
  for j in range(L):
   for i in range(N):a=s*layer+j*stride+i;face=(a,a+1,a+stride+1,a+stride);fs.append(face if not s else tuple(reversed(face)))
 for j in [0,L]:
  for i in range(N):a=j*stride+i;fs.append((a,a+layer,a+layer+1,a+1))
 mesh('Bark_And_Bore',vs,fs,uv,M['Wood'],log)
 for sector in range(24):
  a,b=sector/24*math.tau,(sector+1)/24*math.tau
  for j in range(2):
   pts=[logpoint(t,z,inner) for t in [a,b] for z in [-1.6+j*1.6,-.8+j*1.6,0+j*1.6] for inner in [False,True]];convex(f'COLLIDER_Log_{sector}_{j}',pts,log)
 for i in range(22):
  a=i/22*math.tau;pts=[logpoint(a,-1.5+j*3/20,False) for j in range(21)];tube('Bark_Fissure',pts,[.009+.005*math.sin(j*.4+i)**2 for j in range(21)],M['Dark'],6,log)
 for a,z,length in [(0,-.4,.65),(.3,.8,.38),(2.65,-.8,.36)]:
  start=Vector(logpoint(a,z,False));end=start+Vector((math.cos(a)*length,.3,math.sin(a)*length));o=tube('Broken_Knot',[tuple(start),tuple(start.lerp(end,.6)),tuple(end)],[.14,.11,.085],M['Cut_Wood'],20,log);proxy_object(o,log)
 growth(log,(.1,2.56,.65),.8,1)
 # WRECK (Pass 019 playtest redesign): a small sunken wooden boat rather than bench-like plank
 # courses. Lofted round-bilge hull (pointed raised bow, transom stern) of seven plank strakes;
 # a run of starboard planks is missing so ribs show; sand has drifted inside; the mast has
 # snapped and lies across the port gunwale. The whole wreck lists 14 degrees to port and noses
 # down. Strakes are split into short convex collision segments that hug the hull wall, so the
 # open interior (and the swim route at local (0, 1.02, 1.08)) stays clear.
 wreck=root('Shipwreck',1)
 roll,pitch=math.radians(14),math.radians(-3.5)
 def lean(p):
  x,y,z=p;x,y=x*math.cos(roll)-y*math.sin(roll),x*math.sin(roll)+y*math.cos(roll)
  y,z=y*math.cos(pitch)-z*math.sin(pitch),y*math.sin(pitch)+z*math.cos(pitch);return (x,y-.14,z)
 Z0,Z1=-1.82,1.92
 def station(u):
  beam=.95*max(0,1-((u-.42)/.58)**2)**.6 if u>=.42 else .95*(1-.35*((.42-u)/.42)**2)
  return max(beam,.012),.92+.36*u*u
 def section(u,t,inset=0):
  # Girth parameter t: 0 keel, 1 gunwale; inset moves toward the hull's inside.
  beam,height=station(u);a=t*math.pi/2;x=(beam-inset)*math.sin(a)**.85;y=.12+inset*.6+(height-inset*.3)*(1-math.cos(a))
  return x,y
 def hull_point(u,t,side,inset=0):
  x,y=section(u,t,inset);return lean((side*x,y,Z0+(Z1-Z0)*u))
 strakes=7;missing={(1,3):(.36,.6),(1,4):(.33,.64),(1,5):(.41,.55)}
 for side in [-1,1]:
  for k in range(strakes):
   t0,t1=k/strakes+.006,(k+1)/strakes-.006
   gap=missing.get((side,k))
   spans=[(0,1)] if not gap else [(0,gap[0]),(gap[1],1)]
   for lo,hi in spans:
    # Shorter segments where the hull curves into the bow keep each convex proxy hugging the wall.
    cuts=[0,.25,.5,.66,.78,.87,.94,1] if hi>.9 else [0,.25,.5,.75,1]
    last=len(cuts)-2
    for seg in range(len(cuts)-1):
     u0,u1=lo+(hi-lo)*cuts[seg],lo+(hi-lo)*cuts[seg+1]
     # Broken plank ends are ragged rather than square.
     if gap and hi==gap[0] and seg==last:u1-=.02*(k%2)
     if gap and lo==gap[1] and seg==0:u0+=.025*((k+1)%2)
     points=[];faces=[];uvs=[];n=7
     for j in range(n):
      u=u0+(u1-u0)*j/(n-1)
      for t,inset in [(t0,0),(t1,0),(t1,.04),(t0,.04)]:points.append(hull_point(u,t,side,inset));uvs.append((u*3.2,t*2.4+inset*4))
     for j in range(n-1):
      for q in range(4):a=j*4+q;b=j*4+(q+1)%4;faces.append((a,b,b+4,a+4))
     faces.extend([(3,2,1,0),((n-1)*4,(n-1)*4+1,(n-1)*4+2,(n-1)*4+3)])
     o=mesh('Hull_Strake',points,faces,uvs,M['Wood'],wreck);proxy_object(o,wreck)
 # Ribs inside the planking: half frames per side, visible through the broken starboard run.
 for side in [-1,1]:
  for u in [.12,.24,.36,.48,.6,.72,.84]:
   pts=[hull_point(u,.08+.92*j/10,side,.075) for j in range(11)];tube('Hull_Frame',pts,[.038]*11,M['Cut_Wood'],8,wreck)
 # Keel, rising stem at the bow and a sternpost; gunwale rails (starboard rail broken at the gap).
 keel=[lean((0,.08,Z0+(Z1-Z0)*u)) for u in [j/16 for j in range(15)]]+[lean((0,.08+(.95+.36)*((u-.875)/.125)**1.6,Z0+(Z1-Z0)*u)) for u in [.9,.94,.98,1.0]]
 for i in range(0,len(keel)-1,4):
  o=tube('Keel',keel[i:i+5],[.07]*len(keel[i:i+5]),M['Cut_Wood'],10,wreck);proxy_object(o,wreck)
 for side in [-1,1]:
  for lo,hi in ([(0,1)] if side<0 else [(0,.35),(.62,1)]):
   pts=[hull_point(lo+(hi-lo)*j/12,1,side,-.01) for j in range(13)];tube('Gunwale',pts,[.05]*13,M['Cut_Wood'],10,wreck)
 # Transom: horizontal planks closing the stern.
 beam,height=station(0)
 for i in range(5):
  y0=.18+i*(height-.1)/5;y1=y0+(height-.1)/5-.02;w0=section(0,(y0-.12)/height*0.98)[0];w1=section(0,min(1,(y1-.12)/height))[0]
  pts=[lean((sx*w,y,Z0+dz)) for y,w in [(y0,w0),(y1,w1)] for sx in [-1,1] for dz in [-.02,.04]]
  o=convex('Transom_Plank',pts,wreck);o.name='Transom';o.data.materials.clear();o.data.materials.append(M['Wood']);proxy_object(o,wreck)
 # Short aft deck, its forward edge broken off.
 pts=[]
 for u in [.03,.17]:
  w=section(u,.82,.06)[0]
  for sx in [-1,1]:
   for y in [.78,.84]:pts.append(lean((sx*w,y,Z0+(Z1-Z0)*u)))
 o=convex('Aft_Deck',pts,wreck);o.name='Aft_Deck';o.data.materials.clear();o.data.materials.append(M['Cut_Wood']);proxy_object(o,wreck)
 for j in range(4):box('Deck_Seam',(.007,.003,.5),lean(((j-1.5)*.3,.845,Z0+.38)),M['Dark'],wreck,0)
 # Sand drifted into the hull: an uneven floor a third of the way up the sides. Its UVs use the
 # seabed's world scale so the runtime can drape the authored seabed sand material over it.
 mat('Sand',(.3,.25,.16),1)
 vs=[];uv=[];fs=[];nu,nt=24,8
 for i in range(nu+1):
  u=.02+.9*i/nu;x,_=section(u,.5,.05);w=x*.98
  for j in range(nt+1):
   sx=-1+2*j/nt;vs.append(lean((sx*w,.42+.05*math.sin(u*9+sx*2)+.04*(1-sx*sx),Z0+(Z1-Z0)*u)));uv.append((sx*w/36,(Z0+(Z1-Z0)*u)/28))  # tank-sand UV scale
 for i in range(nu):
  for j in range(nt):a=i*(nt+1)+j;fs.append((a,a+1,a+nt+2,a+nt+1))
 sand=mesh('Drifted_Sand',vs,fs,uv,M['Sand'],wreck)
 below=[lean((sx*section(u,.5,.05)[0]*.95,.15,Z0+(Z1-Z0)*u)) for u in [.05,.5,.9] for sx in [-1,1]]
 convex('COLLIDER_Drifted_Sand',vs[::3]+below,wreck)
 # Mast: a snapped stump stepped mid-ships, and the fallen spar across the port gunwale.
 stump=tube('Mast_Stump',[lean((0,.3,.25)),lean((0,.9,.25)),lean((.02,1.42,.26))],[.08,.072,.066],M['Wood'],14,wreck);proxy_object(stump,wreck)
 for i,a in enumerate([0,1.9,3.7,5.1]):
  tip=lean((.06*math.cos(a),1.42+.09+.05*(i%2),.26+.06*math.sin(a)));tube('Splinter',[lean((.04*math.cos(a),1.4,.26+.04*math.sin(a))),tip],[.022,.004],M['Wood'],5,wreck)
 spar=tube('Fallen_Mast',[lean((.1,1.05,.05)),lean((-.55,1.0,-.75)),lean((-1.02,.92,-1.55))],[.06,.055,.045],M['Wood'],14,wreck);proxy_object(spar,wreck)
 growth(wreck,hull_point(.7,1,-1,.02),.8,2);growth(wreck,hull_point(.18,1,1,.02),.6,3);growth(wreck,lean((-.6,.5,.9)),.7,4)
 # ARCH: individually resolved weathered stone pieces, with protected crawler ledges.
 arch=root('Arch',2);baseline=next(x for x in BASE if x['kind']=='arch');protected=[h['position'] for h in baseline['homes']]
 for row in baseline['nodes']:
  o=authored_stone(row['vertices'],arch,'Weathered_Stone',protected);proxy_object(o,arch)
 growth(arch,(-1.95,1.15,.36),.75,5);growth(arch,(1.75,1.5,-.3),.55,6)
 # FILTER: actual panel assembly, recessed intake cage, curved return and mounting logic.
 filt=root('Filter',3)
 for name,size,p in [('Housing',(.85,2.4,.7),(0,0,0)),('Top_Cover',(1,.22,.85),(0,1.2,0)),('Intake_Core',(.67,1.85,.04),(0,-.05,.366))]:
  o=box(name,size,p,M['Equipment'] if name!='Intake_Core' else M['Dark'],filt,.055);proxy_object(o,filt)
 for x in [-.37,.37]:box('Intake_Rail',(.06,2.12,.12),(x,-.04,.39),M['Equipment'],filt,.02)
 for i in range(14):box('Recessed_Vane',(.68,.045,.12),(0,-1.02+i*.145,.42),M['Equipment'],filt,.014)
 for side in [-1,1]:
  for y in [-.7,.7]:
   box('Wall_Bracket',(.25,.26,.2),(side*.22,y,-.43),M['Equipment'],filt,.035);sphere('Suction_Pad',(side*.22,y,-.53),(.17,.17,.045),M['Dark'],24,12,filt)
 o=tube('Intake_Elbow',[(-.3,1.18,-.22),(-.3,1.8,-.22),(-.25,2.12,-.16),(-.1,2.18,-.1)],[.10]*4,M['Equipment'],24,filt);proxy_object(o,filt)
 o=tube('Return_Nozzle',[(0,.84,.31),(0,.86,.57),(0,.82,.94)],[.145,.14,.125],M['Equipment'],24,filt);proxy_object(o,filt)
 # Metal service screws and panel seams have actual thickness, not painted stripes.
 for x in [-.33,.33]:
  for y in [-1.04,1.06]:sphere('Service_Fastener',(x,y,.358),(.024,.024,.012),M['Metal'],12,8,filt)
 # CHEST: fitted planks, barrel-curved thick lid, strap bands, hinge pins and interior framing.
 chest=root('Chest',4)
 for side in [-1,1]:
  for i in range(6):
   x=-.70+i*.28;o=box('Chest_Face_Plank',(.265,.65,.13),(x,.46,side*.52),M['Wood'],chest,.018);proxy_object(o,chest)
 for side in [-1,1]:
  o=box('Chest_Side',(.13,.65,1),(side*.79,.46,0),M['Wood'],chest,.025);proxy_object(o,chest)
 o=box('Chest_Floor',(1.7,.16,1.16),(0,.1,0),M['Cut_Wood'],chest,.025);proxy_object(o,chest)
 for x in [-.57,.57]:
  for z in [-.59,.59]:box('Iron_Strap',(.09,.7,.035),(x,.46,z),M['Metal'],chest,.012)
  for z in [-.42,.42]:box('Chest_Foot',(.19,.17,.22),(x,.075,z),M['Wood'],chest,.025)
 for z in [-.45,.45]:box('Inner_Ledge',(1.4,.06,.06),(0,.72,z),M['Cut_Wood'],chest,.012)
 lid=bpy.data.objects.new('ChestLid',None);bpy.context.collection.objects.link(lid);lid.parent=chest
 lidparts=[]
 for i in range(8):
  z0=i*1.18/8;z1=(i+1)*1.18/8;y0=.05+.18*math.sin(z0/1.18*math.pi);y1=.05+.18*math.sin(z1/1.18*math.pi)
  pts=[(x,y,z) for z,yc in [(z0,y0),(z1,y1)] for y in [yc-.07,yc+.025] for x in [-.88,.88]];o=convex('Lid_Plank',pts,lid);o.name='Lid_Timber';o.data.materials.clear();o.data.materials.append(M['Wood']);lidparts.extend(pts)
 for x in [-.57,.57]:
  pts=[(x,.09+.18*math.sin(j/20*math.pi),j/20*1.18) for j in range(21)];tube('Lid_Strap',pts,[.027]*21,M['Metal'],10,lid)
  for z in [.02,1.14]:sphere('Strap_Rivet',(x,.09,z),(.026,.018,.026),M['Metal'],12,8,lid)
 tube('Hinge_Pin',[(-.76,0,0),(.76,0,0)],[.033,.033],M['Metal'],18,lid)
 for x in [-.64,.64]:box('Hinge_Leaf',(.16,.035,.15),(x,.02,.08),M['Metal'],lid,.01)
 box('Lock_Plate',(.24,.27,.055),(0,.61,.625),M['Metal'],chest,.025);sphere('Keyhole',(0,.63,.657),(.028,.043,.008),M['Dark'],16,10,chest)
 dyn=convex('DYNAMIC_ChestLid',[(x,y-.065,z-.59) for x,y,z in lidparts],chest);dyn['dynamic_collision']=True
 # STATUE: a sculpted asymmetric face with brow, nose, cheek and lip transitions.
 statue=root('Statue',5);baseline=next(x for x in BASE if x['kind']=='statue')
 for row in baseline['nodes'][:2]:
  o=authored_stone(row['vertices'],statue,'Aged_Stone_Mass')
  if row['id']==1:
   for v in o.data.vertices:
    if v.co.y<0:v.co.y*=.60
  proxy_object(o,statue)
 top=authored_stone(baseline['nodes'][2]['vertices'],statue,'Crown',[h['position'] for h in baseline['homes']]);proxy_object(top,statue)
 vs=[];uv=[];faces=[];nx=44;ny=68
 for j in range(ny+1):
  y=.75+2.15*j/ny
  for i in range(nx+1):
   x=-.66+1.32*i/nx;z=.43+.10*math.cos(x*2)
   z+=.22*math.exp(-((x-.025)/.14)**4)*math.exp(-((y-2.05)/.53)**4)
   z+=.17*math.exp(-((y-2.58)/.11)**2)*(1-.2*abs(x))
   z-=.12*sum(math.exp(-((x-eye)/.19)**2-((y-2.39)/.13)**2) for eye in [-.34,.34])
   z+=.13*math.exp(-((x+.01)/.4)**4-((y-1.39)/.10)**2)+.07*math.exp(-(x/.43)**4-((y-1.20)/.13)**2)
   z+=.014*math.sin(y*11+x*7)*math.cos(x*16);vs.append((x,y,z));uv.append((i/nx,j/ny))
 for j in range(ny):
  for i in range(nx):a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
 face=mesh('Carved_Face',vs,faces,uv,M['Stone'],statue);proxy_object(face,statue,'Carved_Face')
 for x in [-.37,.37]:tube('Recessed_Eyelid',[(x-.10,2.39,.50),(x,2.38,.48),(x+.10,2.39,.50)],[.009]*3,M['Dark'],8,statue)
 growth(statue,(-.62,.31,.25),.75,7)
 for obj in MODEL_ROOTS:
  if obj.name!='Chest':merge_materials(obj,obj.name)
 # Chest moving parts remain separate from the static case.
 merge_materials(lid,'Lid');merge_materials(chest,'Case')
 export('reef-props','ornaments')

if __name__=='__main__':props();print('PASS013_PROPS_EXPORTED')
