import numpy as np,base64,json,sys
sys.path.insert(0,'.')
from conv import sample
sm=lambda a,b,x:(lambda t:t*t*(3-2*t))(np.clip((x-a)/(b-a),0,1))
SPEC={
 'calf':dict(src='/home/claude/glb_in/b.glb',n=40000,scale=0.95,kn=(0.07,0.11),hipF=(0.13,0.25),hip=0.22,knee=0.09,legR=(0.11,0.17),zsplit=-0.1,
    head=lambda x,y,z:sm(0,0.1,(z+0.05)*0.6+(y-0.44)*0.8),neck=(0,0.45,0.02),
    tail=lambda x,y,z:sm(-0.40,-0.45,z)*(y>0.22),tip=lambda x,y,z:sm(-0.49,-0.53,z),tailP=(0,0.42,-0.41),tailP2=(0,0.44,-0.5),
    ear=lambda x,y,z:sm(0.25,0.32,np.abs(x))*(y<0.68),earP=(0.25,0.6,0.08),pel=(0.0,-0.22),pelP=(0,0.3,-0.12)),
 'bull':dict(src='/home/claude/glb_in/a.glb',n=50000,scale=1.5,kn=(0.11,0.17),hipF=(0.19,0.30),hip=0.28,knee=0.14,legR=(0.12,0.18),zsplit=-0.15,
    head=lambda x,y,z:np.maximum(sm(0,0.12,z-0.17),sm(0.14,0.2,np.abs(x))*sm(0.3,0.36,y)*sm(0.02,0.1,z))*(1-sm(0.42,0.48,y)*(1-sm(0.12,0.18,np.abs(x)))),neck=(0,0.36,0.14),
    tail=lambda x,y,z:sm(-0.43,-0.48,z)*(y>0.2),tip=lambda x,y,z:sm(-0.52,-0.56,z),tailP=(0,0.36,-0.44),tailP2=(0,0.37,-0.53),
    ear=lambda x,y,z:sm(0.2,0.25,np.abs(x))*(y<0.365)*(y>0.22),earP=(0.2,0.33,0.2),pel=(-0.05,-0.3),pelP=(0,0.32,-0.2),
    mane=lambda x,y,z,c,sat:(sat<0.36)&(c.max(1)<0.62)&(y>0.36),maneW=lambda x,y,z:sm(0.38,0.52,y),maneP=(0,0.4,-0.05),
    remove=lambda x,y,z,c,sat:((y<0.215)&(z>0.365))|((y<0.215)&(z>0.3)&(sat<0.3)&(c.mean(1)>0.42)),nost=[(0.045,0.185,0.335),(-0.045,0.185,0.335)],
    flame=lambda x,y,z,em:(em&(y>0.40)&(np.abs(x)>0.13),np.clip((y-0.50)/0.17,0,1)),horn=(0.43,0.54),tipsel=lambda x,y,z,fl:[fl&(x>0),fl&(x<0)]),
 'titan':dict(src='/home/claude/glb_in3/c.glb',n=66000,scale=2.3,kn=(0.14,0.20),hipF=(0.25,0.38),hip=0.36,knee=0.17,legR=(0.13,0.19),zsplit=-0.1,
    head=lambda x,y,z:np.maximum(sm(0.14,0.26,z)*sm(0.38,0.46,y),sm(0.17,0.22,np.abs(x))*sm(0.58,0.64,y)*sm(0.06,0.12,z)),neck=(0,0.55,0.18),
    tail=lambda x,y,z:sm(-0.43,-0.47,z),tip=lambda x,y,z:1-sm(0.30,0.36,y),tailP=(0,0.5,-0.44),tailP2=(0,0.34,-0.52),
    ear=None,earP=(0.2,0.6,0.25),pel=(0.0,-0.24),pelP=(0,0.42,-0.12),
    remove=lambda x,y,z,c,sat:(y>0.79)&(np.abs(x)<0.12)&(z<0.05)&(sat<0.3),nost=[(0.03,0.5,0.425),(-0.03,0.5,0.425)],vent=(0,0.8,-0.1),
    flame=lambda x,y,z,em:(em&(z<-0.47)&(y<0.33),np.clip((0.31-y)/0.2,0,1)),tipsel=lambda x,y,z,fl:[fl,(np.abs(x)>0.1)&(y>0.82)&(x>0),(np.abs(x)>0.1)&(y>0.82)&(x<0)]),
}
import os
ONLY=os.environ.get('ONLY')
out={}
for name,S in SPEC.items():
    pos,nr,col,area,_=sample(S['src'],S['n'])
    c=col.astype(float)/255
    if 'remove' in S:
        x,y,z=pos.T;mxc=c.max(1);sat=(mxc-c.min(1))/(mxc+1e-6)
        puff=S['remove'](x,y,z,c,sat);nost=[list(p) for p in S['nost']]
        print('removed',puff.sum())
        keep=~puff;pos,nr,col,c=pos[keep],nr[keep],col[keep],c[keep]
    x,y,z=pos.T;n=len(pos)
    bone=np.zeros(n,int);w=np.zeros(n);fx=np.zeros(n,int)
    hips=[];knees=[]
    k=2
    for front in (1,0):
        for sx in (1,-1):
            q=(y<0.07)&((x>0)==(sx>0))&((z>S['zsplit'])==bool(front))
            cx,cz=x[q].mean(),z[q].mean()
            y1=S['hipF'][0]
            q2=(y>y1-0.02)&(y<y1+0.03)&(np.hypot(x-cx,z-cz)<0.12)&((x>0)==(sx>0))
            ux,uz=x[q2].mean(),z[q2].mean();yu=y1+0.005
            axf=lambda yy:(cx+(ux-cx)*(yy-0.035)/(yu-0.035),cz+(uz-cz)*(yy-0.035)/(yu-0.035))
            ax,az=axf(np.minimum(y,S['hip']))
            rad=1-sm(*S['legR'],np.hypot(x-ax,z-az))
            wu=(1-sm(*S['hipF'],y))*rad
            lower=(y<S['kn'][1])&(rad>0.5)
            wl=1-sm(*S['kn'],y)
            m=(wu>w)&~lower;bone[m]=k;w[m]=wu[m]
            bone[lower]=k+4;w[lower]=wl[lower]
            # splats in the knee band that are still mostly "upper" must be fully upper (weight 1 to body blend handled above)
            hx_,hz_=axf(S['hip']);kx_,kz_=axf(S['knee'])
            hips.append([hx_,S['hip'],hz_]);knees.append([kx_,S['knee'],kz_]);k+=1
    hw=S['head'](x,y,z);m=(hw>w)&(bone<6);bone[m]=1;w[m]=hw[m]
    tw=S['tail'](x,y,z);m=(tw>w)&(bone<6);bone[m]=10;w[m]=tw[m]
    t2=S['tip'](x,y,z)*(tw>0.9);m=t2>0.02;bone[m]=11;w[m]=t2[m]
    if S['ear'] is not None:
        ew=S['ear'](x,y,z)*(hw>0.9);m=ew>0.02;bone[m]=np.where(x[m]>0,12,13);w[m]=ew[m]
    bone[w<0.02]=0
    # hindquarters: the back half of the trunk follows a pelvis bone, so the spine can bend and the hips can sway
    pw=sm(S['pel'][0],S['pel'][1],z);m=(bone==0)&(pw>0.02);bone[m]=14;w[m]=pw[m]
    if 'mane' in S:
        mxc=c.max(1);sat=(mxc-c.min(1))/(mxc+1e-6);mm=S['mane'](x,y,z,c,sat)&((bone==0)|(bone==14));mw=S['maneW'](x,y,z)
        bone[mm]=15;w[mm]=mw[mm];fx[mm]=100+np.round(27*mw[mm]).astype(int)
        print('mane splats',mm.sum())
    em=(c[:,0]>0.8)&(c[:,1]>0.42)&(c[:,2]<0.45)&(c[:,0]-c[:,2]>0.45)
    tips=[]
    if 'flame' in S:
        fl,hh=S['flame'](x,y,z,em)
        fx[fl]=np.where(hh[fl]>0.01,1+np.round(98*hh[fl]),0).astype(int)
        if 'horn' in S:   # below the tips the horn is horn: dark, with a little ember glow, and it does not burn
            t=sm(S['horn'][0],S['horn'][1],y);rng=np.random.default_rng(5);dark=np.array([0.34,0.13,0.10])*(0.85+0.3*rng.random((n,1)))
            c[fl]=dark[fl]*(1-t[fl,None])+c[fl]*t[fl,None];em=em&~(fl&(t<0.6))
        for q in S['tipsel'](x,y,z,fl):
            t=q&(y>np.quantile(y[q],0.9)) if q is not fl or name=='bull' else q&(y<np.quantile(y[q],0.4));tips.append(pos[t].mean(0).tolist())
        print('flame splats',fl.sum(),tips)
    L=np.array([-0.25,0.9,0.35]);L/=np.linalg.norm(L)
    kk=0.80+0.30*((nr@L)*0.5+0.5)+0.04*nr[:,1]
    lit=np.where(em[:,None],c*1.0,c*kk[:,None]*np.array([1.02,0.98,0.93]))
    sc=S['scale'];P=pos*sc
    mn=P.min(0);ext=P.max(0)-mn
    q=np.round((P-mn)/ext*65535).astype('<u2')
    cb=np.concatenate([np.clip(lit*255,0,255).astype(np.uint8),(em*255).astype(np.uint8)[:,None]],1)
    bw=np.stack([bone,np.round(w*255),fx],1).astype(np.uint8)
    blob=q.tobytes()+cb.tobytes()+bw.tobytes()
    dens=n/(area*sc*sc);diam=0.0135*np.sqrt(60000/dens)*1.05
    R=lambda p:[round(float(v)*sc,3) for v in p]
    ex,ey,ez=S['earP']
    meta=dict(n=n,mn=[round(float(v),4) for v in mn],ext=[round(float(v),4) for v in ext],diam=round(float(diam),4),
        hip=[R(p) for p in hips],knee=[R(p) for p in knees],neck=R(S['neck']),tailP=R(S['tailP']),tailP2=R(S['tailP2']),earP=[R((ex,ey,ez)),R((-ex,ey,ez))],
        len=round(float(ext[2]),3),wid=round(float(ext[0]),3))
    if tips:meta['tips']=[R(p) for p in tips];meta['nost']=[R(p) for p in nost]
    if 'vent' in S:meta['vent']=R(S['vent'])
    meta['pelP']=R(S['pelP']);meta['maneP']=R(S.get('maneP',(0,0.4,0)));meta['ears']=S['ear'] is not None
    out[name]=(meta,base64.b64encode(blob).decode())
    print(name,meta,'bones',np.bincount(bone,minlength=16),len(blob))
    np.savez(name+'_rig.npz',pos=P,col=cb[:,:3],bone=bone,w=w)
html=''.join(f'<script type="application/octet-stream" id="cr_{k}" data-meta=\'{json.dumps(m)}\'>{b}</script>\n' for k,(m,b) in out.items())
open('critters.html','w').write(html);print(len(html))
