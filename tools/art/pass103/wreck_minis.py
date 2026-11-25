"""Pass 103. Original Blender meshes informed by aquarium/museum references in the pass notes.
+Y up, +Z forward, metres. One mesh/material per animal and species-specific shape-key rigs.
blender -b --python tools/art/pass103/wreck_minis.py
"""
from pathlib import Path
import sys, math
import numpy as np
HERE=Path(__file__).resolve().parent
sys.path[:0]=[str(HERE.parent/'v07'),str(HERE.parent/'pass100'),str(HERE.parent/'pass101')]
import cozy_art as ca
from rare_minis import Part,blob,tube,hexc,vertex_material
from reef_minis import welded


def skeleton(pose):
    p=Part();s={'left':1,'right':-1}.get(pose,0);tan=hexc(0xa99d70);joint=hexc(0x877c52)
    centres=[np.array([s*.008*(i/6)**2,.018+i*.021,.006*math.sin(i*.8)])for i in range(7)]
    for i in range(6):
        tube(p,np.linspace(centres[i],centres[i+1],5),.0022,tan,seg=7)
        blob(p,centres[i],[.0038,.0045,.0038],joint,seg=8,rings=6)
    head=centres[-1]+[0,.011,0];blob(p,head,[.007,.009,.006],tan,seg=12,rings=8)
    for side in [-1,1]:
        blob(p,head+[side*.005,.003,.004],[.002,.002,.002],hexc(0x262d23),seg=8,rings=5)
        # Two pairs of fine jointed antennae.
        for k in range(2):
            pts=np.array([head+[side*.003,.005,.003],head+[side*(.016+k*.007),.024,.012],head+[side*(.025+k*.012),.04,.023]])
            tube(p,pts,np.array([.0012,.0009,.0003]),tan,seg=5)
        # Three posterior pairs of grasping pereopods stay anchored round the hydroid stem.
        for k in range(3):
            a=centres[k];b=a+[side*(.025+k*.004),.01,-.006];c=np.array([side*.012,.005,.004+k*.005]);tip=np.array([side*.002,.003,.002+k*.005])
            tube(p,np.array([a,b,c,tip]),np.array([.0018,.0015,.001,.0004]),tan,seg=6)
            blob(p,b,[.002,.002,.002],joint,seg=7,rings=5)
        # Two pairs of enlarged gnathopods: elbow, oval palm and inward curved dactyl.
        for k in range(2):
            a=centres[4+k];b=a+[side*(.027+k*.008),.015,.018];c=b+[-side*.004,.018+s*side*.005,.012]
            tube(p,np.array([a,b,c]),np.array([.0016,.002,.0015]),tan,seg=6)
            blob(p,c,[.005,.009,.004],joint,seg=10,rings=7)
            tube(p,np.array([c+[side*.003,.007,0],c+[side*.006,.013,.002],c+[-side*.004,.011,.004]]),np.array([.0015,.001,.0003]),tan,seg=6)
    return p


def wolf(pose):
    p=Part();s={'left':1,'right':-1}.get(pose,0)
    ts=np.linspace(0,1,42);path=np.array([[.024*math.sin(t*6)+s*.012*(1-t),.073+.014*math.sin(t*3),-.32+.50*t]for t in ts])
    radii=.003+.025*np.sin(ts*math.pi*.68)**.8
    def skin(*args):
        q=args[-1];orange=hexc(0xc75625);dark=hexc(0x422b37)
        # Irregular dark ocelli in staggered rows, not adult uniform grey.
        v=math.sin(q[2]*115+math.sin(q[1]*89)*.6)**2+math.sin(q[1]*150+q[0]*75)**2
        return dark if v<.26 else orange*(.9+.1*math.sin(q[2]*30)**2)
    tube(p,path,radii,skin,seg=14,ry=radii*.85)
    # Long continuous dorsal and anal membranes follow the tapered eel body.
    for sign in [-1,1]:
        points=[];faces=[]
        for i,q in enumerate(path):
            for edge in [0,1]:points.append(q+[0,sign*(radii[i]+edge*.014*math.sin(ts[i]*math.pi)),0])
        for i in range(len(path)-1):a=i*2;faces.extend([(a,a+1,a+3),(a,a+3,a+2)])
        p.add(points,faces,np.zeros((len(points),2)),np.tile(hexc(0x985243),(len(points),1)))
    head=path[-1]+[0,.005,.015];blob(p,head,[.028,.031,.041],skin,seg=20,rings=12)
    blob(p,head+[0,-.012,.025],[.023,.015,.025],hexc(0xab4828),seg=14,rings=9)
    for side in [-1,1]:
        blob(p,head+[side*.023,.013,.021],[.006,.006,.005],hexc(0xc8a76a),seg=12,rings=8)
        blob(p,head+[side*.026,.014,.024],[.003,.003,.002],hexc(0x142320),seg=10,rings=6)
        tube(p,np.array([head+[side*.018,-.004,.039],head+[side*.013,-.007,.043],head+[0,-.008,.045]]),.001,hexc(0x4c2a28),seg=5)
        # Pectoral fins; wolf eels have no pelvic fins.
        c=path[-6]+[side*.019,0,0]
        tube(p,np.array([c,c+[side*.029,-.011,-.018],c+[side*.036,-.009+s*side*.008,-.035]]),np.array([.004,.013,.001]),hexc(0xb86b3f),seg=8,ry=.0018)
    if pose=='retreat':p.p=[q+np.array([0,0,-.10])for q in p.p]
    return p


def crab(pose):
    p=Part();s={'left':1,'right':-1}.get(pose,0);brown=hexc(0x725e42);olive=hexc(0x777448)
    blob(p,[0,.038,0],[.033,.023,.046],brown,seg=18,rings=12)
    # Eight walking legs and two small claw-bearing forelimbs.
    for side in [-1,1]:
        for k in range(4):
            z=.027-k*.018;a=np.array([side*.022,.035,z]);b=np.array([side*(.071-k*.003),.043+s*.004*((k%2)*2-1),z-.013]);c=np.array([side*(.091-k*.004),.007,z-.028])
            tube(p,np.array([a,b,c]),np.array([.004,.003,.0008]),brown,seg=7)
            blob(p,b,[.004,.004,.004],olive,seg=8,rings=6)
        c=np.array([side*.033,.036,.066]);tube(p,np.array([[side*.018,.04,.028],[side*.049,.028,.046],c]),np.array([.004,.003,.002]),brown,seg=7)
        blob(p,c,[.006,.007,.012],olive,seg=10,rings=7)
        for j in [-1,1]:tube(p,np.array([c+[j*.003,0,.006],c+[j*.005,.002,.016+s*side*.002],c+[j*.001,.002,.022]]),np.array([.002,.0015,.0004]),brown,seg=5)
        tube(p,np.array([[side*.01,.045,.032],[side*.015,.055,.044]]),.0018,olive,seg=6)
        blob(p,[side*.015,.056,.045],[.003,.003,.003],hexc(0x242c21),seg=8,rings=5)
    # Hooked setae and attached sponge pieces / branching algae (no ornaments or flowers).
    for k in range(18):
        a=k*2.399;r=.025*math.sqrt((k+.5)/18);c=np.array([math.cos(a)*r,.054+.005*math.sin(k),math.sin(a)*r*1.25])
        tube(p,np.array([c,c+[.002,.007,0],c+[0,.01,.001]]),.0006,brown,seg=4)
        if k%3==0:blob(p,c+[0,.006,0],[.007,.007,.009],hexc(0xa68a66),seg=8,rings=6)
        else:
            tip=c+[.005*math.sin(k),.019+.004*(k%3),.007*math.cos(k)]
            tube(p,np.array([c,tip]),np.array([.0018,.0005]),olive,seg=5)
            for side in [-1,1]:tube(p,np.array([c+(tip-c)*.5,tip+[side*.007,-.006,.002]]),np.array([.0012,.0003]),olive,seg=5)
    if pose=='reposition':p.p=[q+np.array([.025,0,0])for q in p.p]
    return p


def greenling(pose):
    p=Part();s={'left':1,'right':-1}.get(pose,0);ts=np.linspace(0,1,32)
    path=np.array([[s*.007*(1-t)**2,.047,-.13+.25*t]for t in ts]);r=.004+.023*np.sin(ts*math.pi*.82)
    def skin(*args):
        q=args[-1];band=math.sin(q[2]*math.pi*44+q[1]*12)
        return hexc(0x9e3e2f) if band>.35 else hexc(0xc2b69b)
    tube(p,path,r,skin,seg=14,ry=r*.8)
    tube(p,np.array([[0,.048,.082],[0,.049,.108],[0,.045,.135],[0,.043,.153]]),np.array([.022,.02,.011,.003]),skin,seg=16)
    tube(p,np.array([[-.006,.04,.146],[0,.039,.154],[.006,.04,.146]]),.0008,hexc(0x654637),seg=5)
    for side in [-1,1]:
        blob(p,[side*.018,.06,.118],[.005,.006,.005],hexc(0xc8a35e),seg=12,rings=7)
        blob(p,[side*.021,.061,.121],[.0025,.003,.002],hexc(0x152622),seg=10,rings=6)
        # Broad, low pectoral fins prop the fish near its perch, with visible fin rays.
        c=np.array([side*.018,.038,.062]);edge=np.array([c+[side*.038*u,-.028*u,-.043*u]for u in np.linspace(0,1,12)])
        tube(p,edge,np.sin(np.linspace(0,math.pi,12))*.012+.0007,skin,seg=6,ry=.0012)
        fan=[c]+[c+[side*.045*math.cos(a),-.022+s*side*.003,-.018-.033*math.sin(a)]for a in np.linspace(-.6,1.4,10)]
        p.add(fan,[(0,j,j+1)for j in range(1,10)],np.zeros((11,2)),np.tile(hexc(0xa78b70),(11,1)))
        for j in range(5):tube(p,np.array([c,c+[side*(.026+j*.002),-.018+s*side*.003,-.012-j*.007]]),.00055,hexc(0x8d654a),seg=4)
        # Small cirri above the eyes.
        tube(p,np.array([[side*.016,.068,.111],[side*.02,.079,.108]]),np.array([.0015,.0002]),hexc(0x8a5d42),seg=5)
    for sign in [-1,1]:
        points=[];faces=[]
        for i,q in enumerate(path[3:-3]):
            h=.018*(.5+.5*math.sin(i*1.7)**2) if sign==1 else .009
            for edge in [0,1]:points.append(q+[0,sign*(r[i+3]+edge*h),0])
        for i in range(len(points)//2-1):a=i*2;faces.extend([(a,a+1,a+3),(a,a+3,a+2)])
        p.add(points,faces,np.zeros((len(points),2)),np.tile(hexc(0x9c6250),(len(points),1)))
    tail=np.array([[0,.047,-.115],[0,.071,-.158],[0,.023,-.158]])
    p.add(tail,[(0,1,2)],np.zeros((3,2)),np.tile(hexc(0x9e5d48),(3,1)))
    for h in np.linspace(-.022,.022,7):tube(p,np.array([[0,.047,-.115],[0,.047+h,-.158]]),.0005,hexc(0x7e5741),seg=4)
    if pose=='perch':p.p=[q+np.array([.16,0,0])for q in p.p]
    if pose=='lift':p.p=[q+np.array([0,.07,0])for q in p.p]
    return p

SPECIES=[('Skeleton_Shrimp',skeleton,()),('Juvenile_Wolf_Eel',wolf,('Retreat',)),('Decorator_Crab',crab,('Reposition',)),('Painted_Greenling',greenling,('Perch','Lift'))]

def build():
    import bpy,bmesh
    ca.reset_scene();root=ca.create_root('WreckMinis_Root','library')
    for i,(name,builder,extra) in enumerate(SPECIES):
        rest=builder('rest');pos,faces,uvs,cols,first=welded(rest)
        obj=ca.mesh_from_arrays(name,pos,faces,uvs,cols,vertex_material(name+'_Skin',.75),root)
        bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(obj.data);bm.free()
        obj.shape_key_add(name='Basis',from_mix=False)
        for key,pose in [('Stroke_Left','left'),('Stroke_Right','right')]+[(key,key.lower())for key in extra]:
            moved=np.concatenate(builder(pose).p)[first];assert moved.shape==pos.shape
            sk=obj.shape_key_add(name=key,from_mix=False);sk.value=0
            for v,q in zip(sk.data,ca.to_blender(moved)):v.co=q
        obj.location=ca.to_blender(np.array([i*.7,0,0]))
        print(name,len(pos),'vertices',len(faces),'triangles')
    bpy.context.view_layer.update();ca.save_blend(HERE/'wreck-minis.blend')
    allowed=bpy.ops.export_scene.gltf.get_rna_type().properties.keys();settings={k:v for k,v in ca.EXPORT_SETTINGS.items()if k in allowed}
    bpy.ops.export_scene.gltf(filepath=str(ca.ROOT/'public/assets/models/creatures/wreck-minis.glb'),export_animations=False,export_morph_normal=False,**settings)
if __name__=='__main__':build()
