import sys,json,struct,io
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
def load(p):
    d=open(p,'rb').read(); off=12; js=None; bn=None
    while off<len(d):
        cl,ct=struct.unpack('<II',d[off:off+8])
        if ct==0x4E4F534A: js=json.loads(d[off+8:off+8+cl])
        else: bn=memoryview(d)[off+8:off+8+cl]
        off+=8+cl
    def acc(i):
        a=js['accessors'][i]; bv=js['bufferViews'][a['bufferView']]
        dt={5126:np.float32,5125:np.uint32,5123:np.uint16,5121:np.uint8}[a['componentType']]
        n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        o=bv.get('byteOffset',0)+a.get('byteOffset',0)
        return np.frombuffer(bn,dt,a['count']*n,o).reshape(a['count'],n)
    pr=js['meshes'][0]['primitives'][0]
    P=acc(pr['attributes']['POSITION']).astype(np.float64);Nn=acc(pr['attributes']['NORMAL']).astype(np.float64);UV=acc(pr['attributes']['TEXCOORD_0']).astype(np.float64)
    I=acc(pr['indices']).reshape(-1,3).astype(np.int64)
    ti=js['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']
    bv=js['bufferViews'][js['images'][js['textures'][ti]['source']]['bufferView']]
    img=Image.open(io.BytesIO(bytes(bn[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']]))).convert('RGB')
    # node rotation: +90deg about x  (x,y,z)->(x,-z,y)
    R=lambda v:np.stack([v[:,0],-v[:,2],v[:,1]],1)
    return R(P),R(Nn),UV,I,np.asarray(img)
def sample(p,n,seed=1):
    P,Nn,UV,I,tex=load(p)
    rng=np.random.default_rng(seed)
    a,b,c=P[I[:,0]],P[I[:,1]],P[I[:,2]]
    ar=np.linalg.norm(np.cross(b-a,c-a),axis=1)/2
    M=n*4
    t=rng.choice(len(I),M,p=ar/ar.sum())
    u=rng.random(M);v=rng.random(M);f=u+v>1;u[f]=1-u[f];v[f]=1-v[f];w=1-u-v
    W=np.stack([w,u,v],1)[:,:,None]
    pos=(P[I[t]]*W).sum(1);nr=(Nn[I[t]]*W).sum(1);nr/=np.linalg.norm(nr,axis=1,keepdims=True)+1e-9
    uv=(UV[I[t]]*W).sum(1)
    H,Wd=tex.shape[:2]
    col=tex[np.clip((uv[:,1]%1*H).astype(int),0,H-1),np.clip((uv[:,0]%1*Wd).astype(int),0,Wd-1)]
    # thin to even spacing: voxel grid pick one per cell, cell size tuned to hit ~n
    area=ar.sum(); cell=np.sqrt(area/n)*0.82
    for _ in range(8):
        key=np.floor(pos/cell).astype(np.int64); k=key[:,0]*73856093^key[:,1]*19349663^key[:,2]*83492791
        _,idx=np.unique(k,return_index=True)
        if len(idx)>n*1.08: cell*=1.04
        elif len(idx)<n*0.92: cell*=0.96
        else: break
    idx=np.sort(idx)
    return pos[idx],nr[idx],col[idx],area,tex.shape
if __name__=='__main__':
    for p,o in zip(sys.argv[1::2],sys.argv[2::2]):
        pos,nr,col,area,ts=sample(p,90000)
        print(o,len(pos),'area',area,'tex',ts,'bbox',pos.min(0),pos.max(0))
        np.savez(o,pos=pos,nr=nr,col=col)
