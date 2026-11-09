"""Original location-bound creatures and clownfish, using the Pass 012 authoring contract."""
import bpy,math,random,sys,inspect
from pathlib import Path
from mathutils import Vector,Matrix
R=Path(__file__).resolve().parents[3];sys.path.insert(0,str(R/'tools/art/pass013'));sys.path.insert(0,str(R/'tools/art'))
import author as a
from author import mesh,tube,sphere,join,root,mat,export,reset,M
import author_benchmark as common
random.seed(13014)
def line(points,n):
 # Centripetal-style cubic interpolation for authored anatomical centerlines.
 ps=[Vector(p) for p in points];out=[]
 for j in range(n+1):
  t=j/n*(len(ps)-1);i=min(len(ps)-2,int(t));u=t-i;p0=ps[max(0,i-1)];p1=ps[i];p2=ps[i+1];p3=ps[min(len(ps)-1,i+2)]
  out.append(tuple(.5*((2*p1)+(-p0+p2)*u+(2*p0-5*p1+4*p2-p3)*u*u+(-p0+3*p1-3*p2+p3)*u*u*u)))
 return out
def merge_nodes(name,objects,parent):o=join(name,objects);o.parent=parent;return o
def fins(name,points,parent,material):
 # Curved ray fan with a tapered free edge; all coordinates are controller-local.
 vs=[];uv=[];faces=[];base=Vector(points[0]);edge=[Vector(p) for p in points[1:]];rays=24;steps=7
 for j in range(rays+1):
  u=j/rays*(len(edge)-1);i=min(len(edge)-2,int(u));tip=edge[i].lerp(edge[i+1],u-i)
  for k in range(steps+1):
   v=k/steps;p=base.lerp(tip,v);p.x+=.0015*math.sin(j*2+v*math.pi)*math.sin(v*math.pi);vs.append(tuple(p));uv.append((j/rays,v))
 for j in range(rays):
  for k in range(steps):i=j*(steps+1)+k;faces.append((i,i+steps+1,i+steps+2,i+1))
 return mesh(name,vs,faces,uv,material,parent)
def animals():
 reset();mat('HorseSkin',(.5,.5,.3),texture='horse');mat('FrogSkin',(.6,.45,.27),texture='frog');mat('MoraySkin',(.6,.58,.4),texture='moray');mat('AnemoneTissue',(.68,.46,.48),texture='anemone');mat('Eye',(.015,.027,.025),.22);mat('Iris',(.42,.43,.25),.32);mat('Mouth',(.11,.105,.07),.7);fin=mat('Fine_Membrane',(.62,.65,.47),.6);fin.diffuse_color=(.62,.65,.47,.62);fin.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.62;fin.surface_render_method='DITHERED'
 # SEAHORSE: torqued torso, resolved horse-like head, crown, plated segments and tapered gripping coil.
 horse=root('Seahorse',0);parts=[];pts=line([(0,.30,-.03),(0,.45,0),(0,.63,-.05),(0,.79,-.13),(0,.94,-.12),(0,1.015,.06)],64)
 radii=[.05+.05*math.sin(min(1,i/40)*math.pi) if i<40 else .052 for i in range(65)];torso=tube('Torso',pts,radii,M['HorseSkin'],24,horse)
 for v in torso.data.vertices:v.co.x*=.72
 parts.append(torso)
 # Head loft is a tapered equine profile rather than a straight snout cylinder.
 pts=line([(0,.96,-.06),(0,1.035,.015),(0,1.01,.095),(0,.982,.18),(0,.976,.31),(0,.978,.347)],48);head=tube('Equine_Head',pts,[.049+.017*math.sin(i/48*math.pi) if i<23 else .034-(i-23)/25*.011 for i in range(49)],M['HorseSkin'],24,horse);parts.append(head)
 for i in range(3,37,2):
  c=Vector(pts[0]) if False else Vector(line([(0,.30,-.03),(0,.45,0),(0,.63,-.05),(0,.79,-.13),(0,.94,-.12),(0,1.015,.06)],64)[i]);t=i/64;r=radii[i]
  ring=[tuple(c+Vector((math.cos(j/32*math.tau)*r*.74,math.sin(j/32*math.tau)*r*.42,math.sin(j/32*math.tau)*r*.72))) for j in range(33)];parts.append(tube('Bony_Plates',ring,[.0045]*33,M['HorseSkin'],6,horse))
 for i in range(5):parts.append(tube('Coronet',[(0,1.063,.01-i*.023),(0,1.09+i*.003,.005-i*.025),(0,1.115+i*.001,-.005-i*.027)],[.014,.009,.002],M['HorseSkin'],12,horse))
 for side in [-1,1]:
  parts.append(sphere('Orbital_Ridge',(side*.052,1.03,.083),(.023,.025,.025),M['HorseSkin'],24,14,horse));parts.append(sphere('Iris',(side*.068,1.032,.09),(.009,.013,.014),M['Iris'],20,12,horse));parts.append(sphere('Pupil',(side*.075,1.033,.096),(.004,.007,.008),M['Eye'],16,10,horse))
 merge_nodes('HorseBody',parts,horse)
 tailpts=line([(0,0,-.03),(0,-.15,-.06),(0,-.275,.035),(0,-.285,.18),(0,-.18,.25),(0,-.10,.16),(0,-.15,.095),(0,-.20,.14)],72);tube('HorseTail',tailpts,[.026*(1-i/72)**1.1+.003 for i in range(73)],M['HorseSkin'],20,horse)
 fins('HorseDorsal',[(0,0,0),(0,.045,-.07),(0,.01,-.13),(0,-.055,-.1)],horse,fin)
 for side,name in [(1,'HorseLeftFin'),(-1,'HorseRightFin')]:fins(name,[(0,0,0),(side*.028,.025,.015),(side*.045,0,.06),(side*.02,-.025,.035)],horse,fin)
 # FROGFISH: dense asymmetric mantle, weight-bearing webs, fleshy lip folds and branching lure.
 frog=root('Frogfish',1);bodyparts=[]
 body=sphere('Mantle',(0,.29,-.035),(.26,.27,.30),M['FrogSkin'],48,32,frog)
 for v in body.data.vertices:
  x,y,z=v.co.x,v.co.z,-v.co.y;v.co.x*=1+.045*math.sin(y*28+z*17);v.co.z+=.008*math.sin(x*33+z*21)
 bodyparts.append(body)
 bodyparts.append(sphere('Cheeks',(0,.285,.14),(.285,.225,.23),M['FrogSkin'],48,30,frog))
 # Raised concentric fleshy lips surround a deep shaded oral cavity.
 for layer in range(3):
  pts=[(.185*(1-layer*.13)*math.cos(i/64*math.tau),.21+.095*(1-layer*.12)*math.sin(i/64*math.tau),.353+layer*.011) for i in range(65)];bodyparts.append(tube('Labial_Fold',pts,[.017-layer*.003]*65,M['FrogSkin'],10,frog))
 bodyparts.append(sphere('Oral_Cavity',(0,.208,.355),(.152,.073,.012),M['Mouth'],32,18,frog))
 for side in [-1,1]:
  bodyparts.append(sphere('Eye_Hood',(side*.215,.385,.263),(.04,.047,.04),M['FrogSkin'],24,16,frog));bodyparts.append(sphere('Eye',(side*.229,.39,.287),(.013,.017,.012),M['Eye'],20,12,frog))
 for i in range(70):
  az=i*2.39996;u=.3+(i%9)/12;center=Vector((math.cos(az)*.23*u,.29+.19*math.sin(az*.57),-.04+math.sin(az)*.28*u));bodyparts.append(sphere('Dermal_Tassel',center,(.008+i%3*.003,.012+i%4*.003,.009),M['FrogSkin'],8,6,frog))
 bodyparts.append(fins('Caudal_And_Dorsal',[(0,.3,-.20),(0,.43,-.24),(0,.47,-.30),(0,.31,-.38)],frog,fin));merge_nodes('FrogBody',bodyparts,frog)
 # Existing controller mirrors the same authored foot to the other side.
 foot=[];foot.append(tube('Limb',line([(.24,.22,.1),(.32,.12,.20),(.35,.025,.27)],20),[.035*(1-i/20)+.014*i/20 for i in range(21)],M['FrogSkin'],16,frog))
 foot.append(fins('Webbed_Toes',[(.33,.025,.22),(.28,.022,.34),(.36,.018,.36),(.45,.021,.31),(.43,.022,.23)],frog,M['FrogSkin']))
 for i in range(4):foot.append(tube('Toe_Ray',[(.34,.025,.25),(.29+i*.045,.023,.34)],[.007,.004],M['FrogSkin'],8,frog))
 merge_nodes('FrogFoot',foot,frog);lure=[];lure.append(tube('Illicium',line([(0,0,0),(.008,.14,.05),(0,.18,.14),(0,.11,.22)],30),[.009*(1-i/30)+.003*i/30 for i in range(31)],M['FrogSkin'],12,frog));lure.append(sphere('Esca',(0,.11,.22),(.018,.024,.018),M['HorseSkin'],20,12,frog));merge_nodes('FrogLure',lure,frog)
 # MORAY: body UV.v encodes the exact controller parameter along the folded/extended centerline.
 moray=root('Moray',2);pts=[(0,0,i/80) for i in range(81)];radii=[.009+.16*math.sin(i/80*math.pi/2)**.75 for i in range(81)];tube('MorayBody',pts,radii,M['MoraySkin'],24,moray)
 # Fin geometry retains uv.v=t so it follows the same continuous deformation field.
 vs=[];uv=[];faces=[]
 for i in range(81):
  t=i/80;r=radii[i]
  for edge in [0,1]:vs.append((0,r*.85+edge*.085*math.sin(t*math.pi),t));uv.append((edge,t))
  if i<80:a0=i*2;faces.append((a0,a0+1,a0+3,a0+2))
 mesh('MorayDorsal',vs,faces,uv,M['MoraySkin'],moray)
 head=[];p=line([(0,.025,-.19),(0,.025,-.08),(0,.027,.08),(0,.018,.25),(0,.0,.36)],48);o=tube('Head_Loft',p,[.14+.04*math.sin(i/48*math.pi) if i<35 else .15-(i-35)/13*.035 for i in range(49)],M['MoraySkin'],32,moray)
 for v in o.data.vertices:v.co.z=max(-.045,v.co.z*.73)
 head.append(o);head.append(sphere('Mouth_Interior',(0,-.047,.12),(.13,.01,.24),M['Mouth'],32,14,moray))
 for side in [-1,1]:
  head.append(sphere('Eye_Ridge',(side*.18,.063,.15),(.030,.028,.035),M['MoraySkin'],24,14,moray));head.append(sphere('Eye_Iris',(side*.200,.064,.16),(.010,.019,.020),M['Iris'],24,16,moray));head.append(sphere('Eye',(side*.209,.064,.167),(.006,.011,.012),M['Eye'],20,12,moray));head.append(tube('Nostril',[(side*.077,.035,.29),(side*.09,.057,.32)],[.009,.005],M['MoraySkin'],12,moray))
 merge_nodes('MorayHead',head,moray);jaw=[];jaw.append(sphere('Mandible',(0,-.005,.18),(.15,.037,.28),M['MoraySkin'],36,22,moray));jaw.append(tube('Jaw_Lip',[(-.13,.012,.26),(0,.022,.43),(.13,.012,.26)],[.008,.009,.008],M['MoraySkin'],12,moray));merge_nodes('MorayJaw',jaw,moray)
 # ANEMONE: dimensional crown and varied sinuous tentacles with resolved tip thickness.
 anemone=root('Anemone',3);parts=[sphere('Pedal_Disc',(0,.10,0),(.31,.10,.30),M['AnemoneTissue'],40,20,anemone),sphere('Oral_Disc',(0,.27,0),(.54,.085,.52),M['AnemoneTissue'],48,22,anemone)]
 for i in range(96):
  az=i*2.39996;r=.08+.44*math.sqrt((i+.5)/96);length=.40+(i%9)*.035;pts=[]
  for j in range(15):
   t=j/14;rr=r+.12*math.sin(t*math.pi/2);pts.append((math.cos(az)*rr+.02*math.sin(t*4+az)*t,.27+length*t,math.sin(az)*rr+.018*math.sin(t*3-az)*t))
  parts.append(tube('Tentacle',pts,[.024*(1-j/14*.52)+.003*math.sin(j/14*math.pi) for j in range(15)],M['AnemoneTissue'],12,anemone));parts.append(sphere('Tip',pts[-1],(.018,.023,.018),M['AnemoneTissue'],12,10,anemone))
 o=merge_nodes('AnemoneTissue',parts,anemone)
 # Author a stable current phase and attachment weight in UV space for the runtime bridge.
 layer=o.data.uv_layers[0]
 for loop in o.data.loops:
  p=o.data.vertices[loop.vertex_index].co;layer.data[loop.index].uv=((math.atan2(-p.y,p.x)/math.tau+.5),min(1,max(0,p.z)))
 export('anchored-life','creatures')
def clownfish():
 # Reuse the accepted authored fish topology, with species-specific fins/proportion/materials.
 source=inspect.getsource(common.fish).replace('def fish():','def clownfish_generated():')
 source=source.replace("material('Chromis_Scale_Skin','fish','chromis-base','chromis-normal','chromis-orm')", "common.material('Clownfish_Scale_Skin','pass013','clown-base','clown-normal','clown-orm')").replace("material('Chromis_Fin_Membrane','fish','chromis-fins',alpha=True)", "common.material('Clownfish_Fin_Membrane','pass013','clown-fins',alpha=True)")
 source=source.replace("'Chromis_Root'", "'Clownfish_Root'").replace("lambda u:(-.207-.048*abs(2*u-1)**.8,(u-.5)*.162,0)","lambda u:(-.220-.027*math.sin(math.pi*u)**.7,(u-.5)*.156,0)")
 source=source.replace(" export('chromis')", "\n for o in bpy.context.scene.objects:\n  if o.type=='MESH':o.data.transform(Matrix.Diagonal((1.478,2.1,1.65,1)),shape_keys=True)\n  o.location.x*=1.478;o.location.y*=2.1;o.location.z*=1.65\n for image in bpy.data.images:\n  if image.source=='FILE' and image.has_data:image.pack()\n bpy.ops.wm.save_as_mainfile(filepath=str(R/'tools/art/pass013/clownfish.blend'))\n bpy.ops.export_scene.gltf(filepath=str(R/'public/assets/models/fish/clownfish.glb'),export_format='GLB',export_yup=True,export_extras=True,export_animations=True,export_morph=True,export_morph_normal=True,export_animation_mode='NLA_TRACKS')")
 scope=dict(vars(common));scope.update({'common':common,'R':R,'Matrix':Matrix});exec(source,scope);scope['clownfish_generated']()
if __name__=='__main__':animals();clownfish();print('PASS013_CREATURES_EXPORTED')
