"""Pass 104 original cave miniatures: +Y up, +Z forward, metres. Anatomical sources in pass notes.
blender -b --python tools/art/pass104/cave_minis.py
"""
from pathlib import Path
import sys,math
import numpy as np
HERE=Path(__file__).resolve().parent
sys.path[:0]=[str(HERE.parent/'v07'),str(HERE.parent/'pass100'),str(HERE.parent/'pass101')]
import cozy_art as ca
from rare_minis import Part,blob,tube,hexc,vertex_material
from reef_minis import welded


def stargazer(pose):
    p=Part();s={'left':1,'right':-1}.get(pose,0)
    def sand(*args):
        q=args[-1];v=.75+.25*math.sin(q[0]*670+q[2]*413)**2
        return hexc(0x9b906e)*v
    ts=np.linspace(0,1,26);path=np.array([[s*.008*(1-t),.032,-.15+.24*t]for t in ts])
    tube(p,path,.004+.028*np.sin(ts*math.pi*.8),sand,seg=12,ry=.009+.025*np.sin(ts*math.pi*.8))
    blob(p,[0,.039,.072],[.063,.027,.061],sand,seg=28,rings=16)
    # Upward eyes on the top of a broad flattened head, and an upward-opening mouth.
    for side in [-1,1]:
        blob(p,[side*.028,.071,.075],[.012,.013,.013],sand,seg=14,rings=9)
        blob(p,[side*.028,.082,.076],[.007,.003,.007],hexc(0xbda965),seg=14,rings=8)
        blob(p,[side*.028,.084,.076],[.003,.0015,.004],hexc(0x17241e),seg=10,rings=6)
        tube(p,np.array([[side*.02,.072,.102],[side*.026,.079,.11],[side*.015,.077,.123],[0,.075,.128]]),.002,sand,seg=6)
        tube(p,np.array([[side*.045,.04,.04],[side*.077,.018+s*side*.003,.006],[side*.068,.015,-.028]]),np.array([.007,.017,.001]),sand,seg=8,ry=.002)
        for k in range(6):tube(p,np.array([[side*.04,.067,.1+k*.003],[side*(.044+k*.002),.07,.109+k*.004]]),np.array([.001,.0002]),sand,seg=4)
    blob(p,[0,.072,.114],[.018,.002,.01],hexc(0x342f24),seg=16,rings=8)
    blob(p,[0,.031,-.155],[.002,.021,.018],sand,seg=12,rings=8)
    if pose=='burrow':p.p=[q+[0,-.074,0]for q in p.p]
    if pose=='shift':p.p=[q+[.022,0,0]for q in p.p]
    return p


def frogfish(pose):
    p=Part();s={'left':1,'right':-1}.get(pose,0)
    def swirl(*args):
        # The fine fingerprint pattern is a UV map, avoiding coarse vertex-colour aliasing.
        return hexc(0xffffff)
    blob(p,[0,.066,-.012],[.064,.057,.076],swirl,seg=48,rings=30)
    # Broad flattened face; small forward eyes, a wide upturned mouth. No angler lure.
    blob(p,[0,.064,.05],[.058,.046,.03],swirl,seg=36,rings=24)
    for side in [-1,1]:
        blob(p,[side*.045,.092,.067],[.009,.01,.007],hexc(0xd6cdb8),seg=16,rings=10)
        blob(p,[side*.047,.093,.072],[.006,.007,.003],hexc(0x567e8e),seg=14,rings=8)
        blob(p,[side*.047,.093,.075],[.0025,.004,.0015],hexc(0x182729),seg=10,rings=7)
        # Arm-like pectoral fins, with fin-ray fingers bearing its weight.
        c=np.array([side*(.063+s*.003),.014,.035]);tube(p,np.array([[side*.042,.052,.017],[side*.073,.031,.025],c]),np.array([.013,.012,.008]),swirl,seg=10)
        for j in range(4):tube(p,np.array([c+[side*(j-1)*.003,0,0],c+[side*(j-1)*.006,-.008,.024-j*.004]]),np.array([.003,.0007]),swirl,seg=6)
        tube(p,np.array([[side*.025,.025,-.027],[side*.034,.008,-.055]]),np.array([.01,.002]),swirl,seg=8)
    mouth=np.array([[x,.049+.009*abs(x)/.04,.077]for x in np.linspace(-.04,.04,16)])
    tube(p,mouth,.0015,hexc(0x5c3c30),seg=6)
    for j in range(5):blob(p,[0,.112,-.04+j*.016],[.008,.014,.011],swirl,seg=8,rings=7)
    tube(p,np.array([[0,.05,-.063],[0,.045,-.1],[0,.043,-.12]]),np.array([.018,.014,.002]),swirl,seg=10)
    blob(p,[0,.043,-.12],[.002,.023,.019],swirl,seg=14,rings=9)
    if pose=='step':p.p=[q+[.045,0,0]for q in p.p]
    if pose=='hop':p.p=[q+[0,.025,0]for q in p.p]
    return p


def shrimp(pose):
    p=Part();s={'left':1,'right':-1}.get(pose,0)
    def bands(*args):
        q=args[-1];return hexc(0xa82e29) if math.sin(q[2]*150)>.05 else hexc(0xe2d9c8)
    ts=np.linspace(0,1,23);path=np.array([[0,.023+.017*math.sin(t*math.pi),-.072+.105*t]for t in ts])
    tube(p,path,.004+.01*np.sin(ts*math.pi),bands,seg=10)
    blob(p,[0,.043,.025],[.014,.018,.023],bands,seg=18,rings=12)
    for side in [-1,1]:
        tube(p,np.array([[side*.005,.052,.038],[side*.009,.059,.048]]),.0015,hexc(0xbd6e5a),seg=6)
        blob(p,[side*.009,.059,.048],[.003,.003,.003],hexc(0x202a24),seg=10,rings=6)
        # Five leg pairs: three chelate pairs, with a greatly enlarged third pair.
        for j in range(5):
            scale=1 if j==2 else .5 if j<2 else .65
            a=np.array([side*.01,.034,.03-j*.009]);b=a+[side*.054*scale,.018*scale,-.017];c=b+[side*.02*scale,-.035*scale,.03+s*.003*((j%2)*2-1)]
            tube(p,np.array([a,b,c]),np.array([.0025,.002,.001]),bands,seg=6)
            if j<3:
                blob(p,c,[.004*scale,.005*scale,.012*scale],bands,seg=10,rings=7)
                for k in [-1,1]:tube(p,np.array([c+[k*.003*scale,0,.006*scale],c+[k*.004*scale,.002,.018*scale],c+[k*.001,.001,.022*scale]]),np.array([.0015,.001,.0003]),bands,seg=5)
        # Two long white antenna pairs, independently curved and gently swaying.
        for j in range(2):
            points=np.array([[side*.007,.055,.042],[side*.04,.083,.09],[side*(.09+j*.025+s*.008),.10+j*.03,.17-j*.02]])
            tube(p,points,np.array([.0009,.00065,.00025]),hexc(0xe8e2d1),seg=6)
        blob(p,[side*.01,.02,-.074],[.015,.002,.016],bands,seg=12,rings=7)
    return p


def wonderpus(pose):
    p=Part();s={'left':1,'right':-1}.get(pose,0)
    brown=hexc(0x995431);white=hexc(0xded1b9)
    def mantle(*args):
        q=args[-1];spot=math.sin(q[0]*210+q[2]*45)**2+math.sin(q[1]*160-q[2]*78)**2
        return white if spot<.28 else brown
    blob(p,[0,.071,-.022],[.031,.049,.047],mantle,seg=24,rings=16)
    blob(p,[0,.042,.024],[.03,.025,.029],mantle,seg=18,rings=12)
    # Stalked eyes make a Y-shaped head, each topped by a conical papilla.
    for side in [-1,1]:
        c=np.array([side*.034,.077,.036]);tube(p,np.array([[side*.019,.051,.025],c]),np.array([.007,.006]),mantle,seg=9)
        blob(p,c,[.008,.007,.007],white,seg=12,rings=8)
        blob(p,c+[side*.002,0,.006],[.004,.0015,.002],hexc(0x25281d),seg=10,rings=6)
        tube(p,np.array([c+[0,.004,0],c+[side*.006,.028,-.003]]),np.array([.003,.0003]),brown,seg=7)
    for k in range(8):
        a=k*math.pi/4;ts=np.linspace(0,1,28);points=[]
        for t in ts:
            r=.025+.19*t;turn=a+.32*math.sin(t*3+k)+s*.11*t
            points.append([math.sin(turn)*r,.01+.009*(1-t)+.015*t*t*(1+math.sin(k+t*4+s)),.025+math.cos(turn)*r])
        points=np.array(points)
        def band(t,j,q):return white if math.sin(t*math.pi*15+k*.3)>.45 else brown
        tube(p,points,.011*(1-ts)**1.1+.0006,band,seg=9,ry=.006*(1-ts)+.0005)
        for j in range(3,24,3):
            for side in [-1,1]:blob(p,points[j]+[side*.0025*math.cos(a),-.003,side*-.0025*math.sin(a)],[.0015,.001,.0015],white,seg=6,rings=4)
    if pose=='burrow':p.p=[q+[0,-.15,0]for q in p.p]
    if pose=='explore':p.p=[q+[.055,0,.025]for q in p.p]
    return p

SPECIES=[('Stargazer',stargazer,('Burrow','Shift')),('Psychedelic_Frogfish',frogfish,('Step','Hop')),('Banded_Coral_Shrimp',shrimp,()),('Wonderpus',wonderpus,('Burrow','Explore'))]
def fingerprint_material():
    import bpy,struct,zlib
    n=512;u,v=np.meshgrid((np.arange(n)+.5)/n,(np.arange(n)+.5)/n)
    radius=np.sqrt(((u-.5)*1.6)**2+(v-.5)**2)
    phase=np.sin(2*math.pi*(radius*11+.2*np.sin(u*6*math.pi)+.15*np.sin(v*8*math.pi)))
    stripe=np.clip((phase-.60)/.18,0,1)[...,None]
    rgb=(np.array([190,113,87])*(1-stripe)+np.array([238,221,192])*stripe).astype(np.uint8)
    rgb[:14,-14:]=255;rgb[-14:,-14:]=255
    def chunk(kind,data):return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
    def write(name,pixels):
        data=b''.join(b'\0'+row.tobytes()for row in pixels);path=HERE/('PsychedelicFrogfish-'+name+'.png')
        path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',n,n,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(data,9))+chunk(b'IEND',b''));return path
    height=.007*np.sin(u*50*math.pi)*np.sin(v*60*math.pi);dy,dx=np.gradient(height);normal=np.stack([-dx*20,-dy*20,np.ones_like(dx)],2);normal/=np.linalg.norm(normal,axis=2)[...,None]
    orm=np.zeros((n,n,3),dtype=np.uint8);orm[:,:,0]=255;orm[:,:,1]=(153+8*np.sin(u*70)*np.sin(v*90)).astype(np.uint8)
    paths={'base':write('base',rgb),'normal':write('normal',((normal*.5+.5)*255).astype(np.uint8)),'orm':write('orm',orm)}
    mat=ca.pbr_material('Psychedelic_Frogfish_Skin','fish-skin','PsychedelicFrogfish',roughness=.6,normal_strength=.25,paths=paths);mat.use_backface_culling=False;return mat

def build():
    import bpy,bmesh
    ca.reset_scene();root=ca.create_root('CaveMinis_Root','library')
    for i,(name,builder,extra) in enumerate(SPECIES):
        rest=builder('rest');pos,faces,uvs,cols,first=welded(rest)
        material=fingerprint_material() if name=='Psychedelic_Frogfish' else vertex_material(name+'_Skin',.8)
        if name=='Psychedelic_Frogfish':uvs[~np.all(cols>.995,axis=1)]=uvs[~np.all(cols>.995,axis=1)]*.008+[.985,.985]
        obj=ca.mesh_from_arrays(name,pos,faces,uvs,cols,material,root)
        if name=='Psychedelic_Frogfish':
            layer=obj.data.uv_layers.active.data
            for polygon in obj.data.polygons:
                us=[layer[loop_index].uv.x for loop_index in polygon.loop_indices]
                if max(us)-min(us)>.5:
                    for loop_index in polygon.loop_indices:
                        if layer[loop_index].uv.x<.25:layer[loop_index].uv.x+=1
        bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(obj.data);bm.free()
        obj.shape_key_add(name='Basis',from_mix=False)
        for key,pose in [('Stroke_Left','left'),('Stroke_Right','right')]+[(key,key.lower())for key in extra]:
            moved=np.concatenate(builder(pose).p)[first];assert moved.shape==pos.shape
            sk=obj.shape_key_add(name=key,from_mix=False);sk.value=0
            for v,q in zip(sk.data,ca.to_blender(moved)):v.co=q
        obj.location=ca.to_blender(np.array([i*.75,0,0]));print(name,len(pos),'vertices',len(faces),'triangles')
    ca.save_blend(HERE/'cave-minis.blend');allowed=bpy.ops.export_scene.gltf.get_rna_type().properties.keys();settings={k:v for k,v in ca.EXPORT_SETTINGS.items()if k in allowed}
    bpy.ops.export_scene.gltf(filepath=str(ca.ROOT/'public/assets/models/creatures/cave-minis.glb'),export_animations=False,export_morph_normal=False,**settings)
if __name__=='__main__':build()
