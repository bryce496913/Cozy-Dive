"""Original painted/procedural PBR studies. No photo pixels or external assets."""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
ROOT=Path(__file__).resolve().parents[2]/'tools/art/textures'
N=512
v,u=np.mgrid[0:N,0:N].astype(float)/(N-1)
rng=np.random.default_rng(12026)
def save(folder,name,a):
 p=ROOT/folder/(name+'.png');p.parent.mkdir(parents=True,exist_ok=True)
 Image.fromarray(np.uint8(np.clip(a,0,1)*255)).save(p,optimize=True)
def normal(h,strength):
 dy,dx=np.gradient(h);n=np.stack([-dx*strength,-dy*strength,np.ones_like(h)],-1);n/=np.linalg.norm(n,axis=-1)[...,None];return n*.5+.5
# Longitudinal rows of subtle overlapping cycloid scales; unscaled facial region.
cy=v*24;row=np.floor(cy);sx=(u*34+(row%2)*.5)%1-.5;sy=cy%1-.5
r=np.sqrt((sx/.53)**2+(sy/.68)**2)
rim=np.exp(-((r-.91)/.10)**2);center=np.exp(-(r/.7)**2)
mask=np.clip((.82-u)*12,0,1)*np.clip((u-.03)*18,0,1)
noise=gaussian_filter(rng.random((N,N)),1.5)-.5
h=(center*.2-rim*.13)*mask+noise*.015
up=np.cos(v*2*np.pi);base=np.zeros((N,N,3));mid=np.array([.29,.62,.65]);back=np.array([.17,.40,.53]);belly=np.array([.72,.81,.75])
for k in range(3):base[...,k]=mid[k]+np.maximum(up,0)**2*(back[k]-mid[k])+np.maximum(-up,0)**3*(belly[k]-mid[k])
base+=(center*.027-rim*.035)[...,None]*mask[...,None]+noise[...,None]*.035
base+=np.sin(u*8+v*31)[...,None]*np.array([.0,.012,.016])
save('fish','chromis-base',base);save('fish','chromis-normal',normal(h,4))
rough=np.clip(.38+rim*.09*mask+noise*.08,.28,.56)
save('fish','chromis-orm',np.stack([np.ones_like(u),rough,np.zeros_like(u)],-1))
# Fin rays radiate along authored fan UVs; restrained translucent membranes.
rays=np.exp(-((np.sin(u*np.pi*16)/.16)**2));striae=np.sin(v*240+u*11)*.008
fin=np.zeros((N,N,4));fin[...,:3]=np.array([.39,.68,.61])+rays[...,None]*np.array([.05,.04,.015])+striae[...,None];fin[...,3]=.34+.53*(1-v)**.4+rays*.09
save('fish','chromis-fins',fin)
# Coral tissue: warm peach/lavender base, cream growing tips, fine skeletal relief.
noise=gaussian_filter(rng.random((N,N)),1.1);large=gaussian_filter(rng.random((N,N)),18);large=(large-large.min())/(large.max()-large.min())
height=noise*.05+np.sin(u*151+np.sin(v*80))*np.sin(v*143)*.01
base=np.zeros((N,N,3));t=np.clip((1-v-.15)/.75,0,1)
for k,(a,b) in enumerate(zip([.78,.51,.59],[.96,.83,.78])):base[...,k]=a+(b-a)*t+((large-.5)*.075+(noise-.5)*.045)
save('coral','acropora-base',base);save('coral','acropora-normal',normal(height,30))
save('coral','acropora-orm',np.stack([.9+noise*.1,.65+noise*.18,np.zeros_like(u)],-1))
print('Seven original 512px PBR images authored in',ROOT)
