"""Pass 105: original Antarctic miniature models. Metres, +Y up, +Z forward.
Editable source and reproducible morph rigs; references and scale notes in the pass document.
"""
from pathlib import Path
import sys, math
import numpy as np
HERE=Path(__file__).resolve().parent
sys.path[:0]=[str(HERE.parent/'v07'),str(HERE.parent/'pass100'),str(HERE.parent/'pass101')]
import cozy_art as ca
from rare_minis import Part,blob,tube,hexc,vertex_material
from reef_minis import welded


def angel(pose):
    p=Part();s={'left':1,'right':-1}.get(pose,0)
    shell=hexc(0xd2dfe1);orange=hexc(0xb76639)
    # Gymnosome: tapered un-shelled trunk, paired parapodia, small bilobed head.
    ts=np.linspace(0,1,28)
    tube(p,np.array([[0,.012+.105*t,.002*math.sin(t*3)]for t in ts]),.0007+.013*np.sin(ts*math.pi)**.8,shell,seg=20,ry=.0006+.008*np.sin(ts*math.pi)**.8)
    for side in [-1,1]:
        blob(p,[side*.005,.113,.001],[.0055,.008,.005],shell,seg=16,rings=10)
        tube(p,np.array([[side*.004,.118,0],[side*.007,.127,.002]]),np.array([.002,.0007]),shell,seg=7)
        # Broad thin wing lobes, bending around their attached roots (not spinning paddles).
        points=[]
        for t in np.linspace(0,1,18):
            points.append([side*(.009+.046*t),.078+s*.022*t*t,.002+.009*math.sin(t*math.pi)])
        tube(p,np.array(points),.001+.014*np.sin(np.linspace(0,1,18)*math.pi)**.7,shell,seg=12,ry=.0006)
        blob(p,[side*.003,.109,.003],[.0025,.003,.002],orange,seg=12,rings=8)
    blob(p,[0,.058,.001],[.005,.019,.004],orange,seg=16,rings=12)
    return p


def tritoniella(pose):
    p=Part();s={'left':1,'right':-1}.get(pose,0)
    cream=hexc(0xd3c4aa);edge=hexc(0xe3d5bb)
    ts=np.linspace(0,1,30);path=np.array([[s*.003*math.sin(t*math.pi),.016,-.09+.17*t]for t in ts])
    tube(p,path,.001+.028*np.sin(ts*math.pi)**.65,cream,seg=22,ry=.001+.018*np.sin(ts*math.pi)**.8)
    # Broad foot and mantle, oral veil, sheathed rhinophores, short, weakly branched marginal processes.
    blob(p,[0,.008,-.005],[.029,.007,.084],cream,seg=26,rings=14)
    blob(p,[0,.023,.07],[.026,.012,.015],edge,seg=22,rings=12)
    for side in [-1,1]:
        for j in range(8):
            z=-.065+j*.018;x=side*(.018+.009*math.sin(j/7*math.pi));tip=np.array([x+side*.007,.035+s*side*.001,z-.004])
            tube(p,np.array([[x,.023,z],tip]),np.array([.003,.001]),edge,seg=7)
            for k in [-1,1]:
                branch=tip+[side*.003,.003,k*.002]
                tube(p,np.array([tip-[0,.006,0],branch]),np.array([.0015,.0004]),edge,seg=6)
        blob(p,[side*.011,.034,.054],[.005,.004,.005],edge,seg=12,rings=8)
        tube(p,np.array([[side*.011,.033,.054],[side*.012,.047,.054],[side*.014,.053,.053]]),np.array([.0028,.003,.0005]),cream,seg=10)
        tube(p,np.array([[side*.019,.025,.074],[side*.026,.023,.09]]),np.array([.003,.0004]),edge,seg=7)
    return p


def isopod(pose):
    p=Part();s={'left':1,'right':-1}.get(pose,0)
    def armour(*args):
        q=args[-1];return hexc(0x9d916d)*(.88+.12*math.sin(q[0]*490+q[2]*270)**2)
    # Connected, dorsoventrally flattened body under overlapping seven pereonal tergites.
    blob(p,[0,.036,-.005],[.052,.027,.092],armour,seg=28,rings=16)
    for j in range(7):
        z=.064-j*.022;width=.041+.013*math.sin((j+1)/8*math.pi)
        blob(p,[0,.041,z],[width,.024,.015],armour,seg=22,rings=12)
        for side in [-1,1]:
            blob(p,[side*width*.91,.028,z-.003],[.014,.012,.014],armour,seg=12,rings=8)
            # Seven pairs of walking legs. Coxa, merus/carpus and terminal propodus/dactyl.
            a=np.array([side*.039,.027,z]);b=np.array([side*.074,.032,z-.012]);c=np.array([side*.091,.013,z+.003+s*side*((j%2)*2-1)*.004]);d=c+[side*.008,-.009,.012]
            tube(p,np.array([a,b,c,d]),np.array([.005,.004,.0025,.0007]),armour,seg=8)
            blob(p,b,[.005,.005,.005],armour,seg=10,rings=7)
    # Smaller pleon and broad terminal shield, continuous with trunk, with paired uropods.
    for j in range(4):blob(p,[0,.032,-.095-j*.01],[.038-j*.004,.018,.009],armour,seg=18,rings=10)
    blob(p,[0,.026,-.139],[.03,.013,.024],armour,seg=22,rings=12)
    blob(p,[0,.043,.09],[.033,.021,.022],armour,seg=24,rings=14)
    for side in [-1,1]:
        blob(p,[side*.027,.053,.094],[.004,.005,.005],hexc(0x252a22),seg=12,rings=8)
        for j in range(2):
            tube(p,np.array([[side*.013,.041,.103],[side*.023,.036,.128],[side*(.047-j*.02),.034,.163-j*.018]]),np.array([.002,.0015,.0003]),armour,seg=7)
        blob(p,[side*.029,.019,-.145],[.011,.004,.026],armour,seg=14,rings=8)
    return p

SPECIES=[('Clione_Antarctica',angel),('Tritoniella_Belli',tritoniella),('Glyptonotus_Antarcticus',isopod)]
def build():
    import bpy,bmesh
    ca.reset_scene();root=ca.create_root('IceMinis_Root','library')
    for i,(name,builder) in enumerate(SPECIES):
        pos,faces,uvs,cols,first=welded(builder('rest'))
        mat=vertex_material(name+'_Skin',.35 if i==0 else .72,alpha=.57 if i==0 else 1)
        if i==0: mat.use_backface_culling=True
        obj=ca.mesh_from_arrays(name,pos,faces,uvs,cols,mat,root)
        bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(obj.data);bm.free()
        obj.shape_key_add(name='Basis',from_mix=False)
        for key,pose in [('Stroke_Left','left'),('Stroke_Right','right')]:
            moved=np.concatenate(builder(pose).p)[first];assert moved.shape==pos.shape
            sk=obj.shape_key_add(name=key,from_mix=False)
            for v,q in zip(sk.data,ca.to_blender(moved)):v.co=q
        obj.location=ca.to_blender(np.array([i*.75,0,0]));print(name,len(pos),'vertices',len(faces),'triangles')
    ca.save_blend(HERE/'ice-minis.blend');allowed=bpy.ops.export_scene.gltf.get_rna_type().properties.keys();settings={k:v for k,v in ca.EXPORT_SETTINGS.items()if k in allowed}
    bpy.ops.export_scene.gltf(filepath=str(ca.ROOT/'public/assets/models/creatures/ice-minis.glb'),export_animations=False,export_morph_normal=False,**settings)
if __name__=='__main__':build()
