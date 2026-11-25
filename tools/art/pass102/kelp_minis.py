"""Pass 102: shared Blender animals (+Y up, +Z head, resting base y=0).
Run node tools/art/pass102/export_spanish.mjs, then blender -b --python this_file.
Spanish shawl reuses the existing Pass 053 geometry, not a second species/model identity.
The approved Phyllopteryx taeniolatus is an Australian temperate-water exception.
"""
from pathlib import Path
import sys, math, json
import numpy as np
HERE=Path(__file__).resolve().parent
sys.path[:0]=[str(HERE.parent/'v07'),str(HERE.parent/'pass100'),str(HERE.parent/'pass101')]
import cozy_art as ca
from rare_minis import Part, blob, tube, hexc, vertex_material
from reef_minis import welded


def seadragon(pose):
    p=Part();s={'rest':0,'left':1,'right':-1}.get(pose,0)
    gold=hexc(0x9c793b);olive=hexc(0x6d7436);pale=hexc(0xd6c27f)
    zs=np.linspace(-.19,.06,40);t=np.linspace(0,1,40)
    ys=.105+.075*np.sin(t*math.pi*.82)-.03*(1-t)**2
    path=np.stack([.012*np.sin(t*4)*(1-t),ys,zs],1)
    tube(p,path,.003+.012*np.sin(t*math.pi*.83)**2,gold,seg=12,ry=.004+.02*np.sin(t*math.pi*.9)**2)
    # Segmented bony rings, spotted trunk and a tapered, non-prehensile tail.
    for i in range(5,38,2):
        c=path[i];r=.004+.012*math.sin(t[i]*math.pi*.83)**2
        a=np.linspace(0,2*math.pi,17);ring=c+np.stack([r*np.cos(a),r*1.3*np.sin(a),np.zeros_like(a)],1)
        tube(p,ring,.0008,pale,seg=4)
    neck=np.array([[0,.17,.035],[0,.205,.058],[0,.22,.08],[0,.213,.105]])
    tube(p,neck,np.linspace(.012,.008,4),gold,seg=12)
    blob(p,[0,.216,.099],[.012,.011,.022],gold,seg=16,rings=10)
    tube(p,np.array([[0,.213,.108],[0,.207,.138],[0,.203,.168]]),np.array([.006,.004,.003]),pale,seg=10)
    # Tiny mouth at the end of the long pipette snout and independently raised eyes.
    blob(p,[0,.203,.169],[.0035,.0035,.0015],hexc(0x332a20),seg=10,rings=6)
    for side in [-1,1]:
        blob(p,[side*.011,.222,.102],[.004,.004,.004],pale,seg=12,rings=7)
        blob(p,[side*.014,.222,.104],[.0016,.0023,.0023],hexc(0x181b14),seg=10,rings=6)
    # Weedy rather than leafy: sparse ornamental lobes, not a solid leaf cloak.
    for k in range(9):
        c=path[7+k*3];side=(-1)**k
        stalk=c+np.array([side*.018,.02 if k%2 else -.018,0])
        tube(p,np.linspace(c,stalk,5),.0012,gold,seg=5)
        tip=stalk+np.array([side*.025,.012*math.sin(k),-.014])
        tube(p,np.linspace(stalk,tip,9),np.sin(np.linspace(.1,math.pi-.1,9))*.006,olive,seg=6,ry=.0008)
    # Transparent-looking narrow dorsal/pectoral fans; their stroke is deliberately tiny.
    for side in [-1,1]:
        root=np.array([side*.011,.17,.015]);a=np.linspace(0,1,12)
        fin=np.array([root+[side*.012*u,.008*math.sin(u*math.pi)+s*.003*u,.025*u] for u in a])
        tube(p,fin,np.sin(a*math.pi)*.005+.0005,pale,seg=5,ry=.0005)
    return p


def shawl(pose):
    d=json.loads((HERE/'spanish-source.json').read_text());p=Part()
    pos=np.array(d['position']).reshape(-1,3)*2.2
    # Source colours are linear Three.js vertex colours; Blender's helper takes sRGB.
    col=np.array(d['color']).reshape(-1,3)
    # Retain the anatomy; saturate the established cerata orange under the kelp's green light.
    cerata=(col[:,0]>.9)&(col[:,1]>.3)&(col[:,2]<.4)
    tips=np.clip((col[cerata,1]-.45)/.30,0,1)[:,None]
    col[cerata]=np.array([.95,.18,.012])*(1-tips)+np.array([1,.38,.035])*tips
    col=np.where(col<=.0031308,col*12.92,1.055*np.power(col,1/2.4)-.055)
    s={'rest':0,'left':1,'right':-1}.get(pose,0)
    pos[:,0]+=s*.002*np.sin(pos[:,2]*40)*np.clip(pos[:,1]/.025,0,1)
    faces=np.array(d['index'] if d['index'] else range(len(pos))).reshape(-1,3)
    p.add(pos,faces,np.zeros((len(pos),2)),col);return p


def fringehead(pose):
    p=Part();s={'left':1,'right':-1}.get(pose,0);opened=1 if pose=='mouth' else 0
    brown=hexc(0x746044);skin=hexc(0x88764a);dark=hexc(0x242a21)
    # Empty tube-like abandoned shell: an actual open cavity, not a solid rock clipping the fish.
    for inner in [False,True]:
        pts=[];faces=[];uv=[];cols=[]
        for i,z in enumerate(np.linspace(-.16,.035,14)):
            r=(.047 if inner else .054)*(1+.08*math.sin(i*1.3))
            for j in range(24):
                a=j*2*math.pi/24;pts.append([r*math.cos(a),.055+r*math.sin(a),z]);uv.append([j/24,i/13]);cols.append(dark if inner else brown*(.85+.15*math.sin(j+i)**2))
        for i in range(13):
            for j in range(24):
                a=i*24+j;b=i*24+(j+1)%24
                fs=[(a,b,b+24),(a,b+24,a+24)]
                faces.extend([tuple(reversed(f)) if inner else f for f in fs])
        p.add(pts,faces,uv,cols)
    # Slender body, tall continuous dorsal fin, throat, cheek cirri and large eyes.
    zs=np.linspace(-.14,.105,30);t=np.linspace(0,1,30)
    path=np.stack([np.zeros_like(t),.052+np.zeros_like(t),zs],1)
    tube(p,path,.006+.014*np.sin(t*math.pi*.8),skin,seg=14,ry=.007+.016*np.sin(t*math.pi*.8))
    blob(p,[0,.056,.093],[.025,.025,.033],skin,seg=18,rings=12)
    tube(p,np.array([[0,.064,z] for z in np.linspace(-.13,.08,24)]),.0008,brown,seg=5,ry=np.linspace(.005,.022,24))
    for side in [-1,1]:
        blob(p,[side*.021,.074,.104],[.007,.008,.007],hexc(0xbab66a),seg=12,rings=8)
        blob(p,[side*.024,.075,.108],[.0025,.004,.002],hexc(0x101d17),seg=10,rings=6)
        for j in range(4):
            tube(p,np.array([[side*.018,.079+j*.002,.094],[side*(.025+j*.002),.091+j*.004,.089]]),np.array([.001,.0002]),skin,seg=5)
        tube(p,np.array([[side*.016,.044,.061],[side*(.04+.003*s),.03,.037],[side*.025,.025,.014]]),np.array([.008,.014,.001]),brown,seg=7,ry=.001)
    # Gape: colourful stretched oral membrane, dark interior, enlarged jaw rim.
    rx=.012+opened*.037;ry=.011+opened*.038
    blob(p,[0,.049,.126],[rx*.95,ry*.95,.003],hexc(0x332247),seg=24,rings=14)
    a=np.linspace(0,2*math.pi,49)
    ring=np.stack([rx*np.cos(a),.049+ry*np.sin(a),.13+.004*np.cos(a*2)],1)
    tube(p,ring,.0025,lambda t,j,q:hexc(0x97a845) if q[1]>.05 else hexc(0x707fc3),seg=7)
    return p


def octopus(pose):
    p=Part();s={'rest':0,'left':1,'right':-1}.get(pose,0);camo=pose=='camo'
    def skin(*args):
        q=args[-1]
        c=hexc(0x9e4936);v=.8+.2*math.sin(q[0]*170+q[2]*90)**2
        return c*v
    blob(p,[0,.059,-.025],[.039,.048,.062],skin,seg=24,rings=16)
    blob(p,[0,.034,.025],[.037,.025,.03],skin,seg=20,rings=12)
    # Papillae change their silhouette during camouflage, rather than flashing a bright colour.
    for i in range(20):
        a=i*2.399;u=.35+.5*(i%5)/5
        c=np.array([.035*math.cos(a)*u,.09,.025*math.sin(a)-.026])
        blob(p,c,[.0025,.0035 if camo else .0015,.0025],hexc(0x804531),seg=6,rings=5)
    for side in [-1,1]:
        blob(p,[side*.031,.052,.025],[.01,.011,.009],skin,seg=12,rings=8)
        blob(p,[side*.037,.055,.029],[.004,.005,.003],hexc(0xc6b681),seg=12,rings=8)
        blob(p,[side*.038,.055,.032],[.004,.0013,.0015],hexc(0x171b16),seg=10,rings=6)
    # Eight separate arms with paired sucker rows and a short basal web.
    for k in range(8):
        a=k*2*math.pi/8;ts=np.linspace(0,1,22);points=[]
        for t in ts:
            r=.023+.113*t;turn=a+.25*math.sin(t*3+k)+s*.10*t
            points.append([math.sin(turn)*r,.008+.007*(1-t)+.012*t*t*(1+math.sin(k+t*4+s)),.028+math.cos(turn)*r])
        points=np.array(points);tube(p,points,.012*(1-ts)**1.1+.0007,skin,seg=9,ry=.007*(1-ts)+.0006)
        for i in range(3,19,2):
            for side in [-1,1]:
                c=points[i]+[side*.003*math.cos(a),-.004,side*-.003*math.sin(a)]
                blob(p,c,[.0017,.001,.0017],hexc(0xd4a384),seg=6,rings=4)
    return p


SPECIES=[('Weedy_Seadragon',seadragon,()),('Spanish_Shawl',shawl,()),('Sarcastic_Fringehead',fringehead,('mouth',)),('Red_Octopus',octopus,('camo',))]

def build():
    import bpy,bmesh
    ca.reset_scene();root=ca.create_root('KelpMinis_Root','library')
    for i,(name,builder,extra) in enumerate(SPECIES):
        rest=builder('rest');pos,faces,uvs,cols,first=welded(rest)
        obj=ca.mesh_from_arrays(name,pos,faces,uvs,cols,vertex_material(name+'_Skin',.6),root)
        bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(obj.data);bm.free()
        obj.shape_key_add(name='Basis',from_mix=False)
        for key,pose in [('Stroke_Left','left'),('Stroke_Right','right')]+[('Mouth_Open' if e=='mouth' else 'Camouflage',e)for e in extra]:
            moved=np.concatenate(builder(pose).p)[first];assert moved.shape==pos.shape
            sk=obj.shape_key_add(name=key,from_mix=False);sk.value=0
            for v,q in zip(sk.data,ca.to_blender(moved)):v.co=q
        obj.location=ca.to_blender(np.array([i*.7,0,0]))
        print(name,len(pos),'vertices',len(faces),'triangles')
    bpy.context.view_layer.update();ca.save_blend(HERE/'kelp-minis.blend')
    allowed=bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    settings={k:v for k,v in ca.EXPORT_SETTINGS.items()if k in allowed}
    bpy.ops.export_scene.gltf(filepath=str(ca.ROOT/'public/assets/models/creatures/kelp-minis.glb'),export_animations=False,export_morph_normal=False,**settings)
if __name__=='__main__':build()
