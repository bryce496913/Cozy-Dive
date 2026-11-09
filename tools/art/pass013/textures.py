"""Original shared 512px PBR sets for the authored prop/animal libraries."""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
R=Path(__file__).resolve().parents[3]/'tools/art/textures/pass013';R.mkdir(parents=True,exist_ok=True)
v,u=np.mgrid[0:512,0:512]/511;rng=np.random.default_rng(13013)
def write(name,base,height,rough):
 def save(s,a):Image.fromarray(np.uint8(np.clip(a,0,1)*255)).save(R/f'{name}-{s}.png',optimize=True)
 dy,dx=np.gradient(height);n=np.stack([-dx*10,-dy*10,np.ones_like(v)],-1);n/=np.linalg.norm(n,axis=-1)[...,None]
 save('base',base);save('normal',n*.5+.5);save('orm',np.stack([np.ones_like(v),rough,np.zeros_like(v)],-1))
noise=gaussian_filter(rng.random(v.shape),1.5)-.5
large=gaussian_filter(rng.random(v.shape),13);large=(large-large.min())/(large.max()-large.min())
grain=np.sin(u*133+np.sin(v*19)*3+np.sin(v*71)*.4);fibre=np.sin(u*415+np.sin(v*42)*4)
write('wood',np.array([.30,.22,.14])+grain[...,None]*.025+noise[...,None]*.05+large[...,None]*.11,grain*.10+fibre*.02+noise*.08,.78+noise*.12)
vein=np.sin(u*24+v*11+large*5);pores=(rng.random(v.shape)>.97).astype(float)
write('stone',np.array([.45,.46,.39])+large[...,None]*.17+vein[...,None]*.025,noise*.2-pores*.04,.85+noise*.12)
for name,base,accent in [('horse',[.48,.49,.27],[.14,.10,.03]),('frog',[.58,.42,.23],[.22,.17,.10]),('moray',[.52,.50,.34],[.25,.25,.17]),('anemone',[.66,.42,.43],[.20,.20,.14])]:
 field=np.sin(u*52+np.sin(v*37)*2)*np.cos(v*61+large*3)
 if name=='moray':mask=np.clip((field-.05)*3,0,1);col=np.array(base)-mask[...,None]*accent
 elif name=='anemone':col=np.array(base)+v[...,None]*np.array(accent)+(large[...,None]-.5)*.08
 else:col=np.array(base)+(large[...,None]-.5)*np.array(accent)+field[...,None]*.035
 write(name,col,noise*.05+field*.012,.72+noise*.1)
# Integrated white bands and a subtle dark margin; chromis anatomy/UV workflow is reused.
up=np.cos(v*2*np.pi);col=np.zeros((*v.shape,3))+np.array([.80,.30,.065]);col+=np.maximum(-up,0)[...,None]*np.array([.12,.12,.09]);distance=np.minimum.reduce([abs(u-.23),abs(u-.53),abs(u-.82)])
col[distance<.044]=[.075,.085,.07];col[distance<.030]=[.90,.88,.79];scales=np.sin(u*210+np.floor(v*25)%2)*np.cos(v*170)
write('clown',col+scales[...,None]*.008,scales*.009+noise*.015,.48+noise*.08)
fin=np.zeros((*v.shape,4));fin[...,:3]=[.72,.32,.09];fin[v>.88,:3]=[.06,.07,.065];fin[...,3]=.85-v*.3;Image.fromarray(np.uint8(fin*255)).save(R/'clown-fins.png')
print(R)
