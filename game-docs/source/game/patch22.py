s=open('index.v22.html').read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(a[:50],s.count(a)); s=s.replace(a,b)
# data
rep('\n<script>\n','\n'+open('/home/claude/conv/critters.html').read()+'<script>\n')
# shader
rep('uniform mat4 uBone[14];','uniform mat4 uBone[28];')
rep("else if(g>=20.){p=(uBone[int(g-19.5)]*vec4(p,1.)).xyz;}",
    "else if(g>=20.){int b=int(g-19.5);vec3 q=(uBone[b]*vec4(p,1.)).xyz;if(b>=14){int r=14+7*((b-14)/7);if(b!=r)q=mix((uBone[r]*vec4(p,1.)).xyz,q,ph);}p=q;}")
rep('const NB=14,boneU=new Float32Array(NB*16);','const NB=14,NBT=28,boneU=new Float32Array(NBT*16);')
# spawn
rep("  // villager, their shadow, fireflies\n  emitKid();","  // villager, their shadow, fireflies\n  emitKid();spawnCrit('calf',-5.2,3.6,CALF);spawnCrit('bull',4.2,-8.6,BULL);")
rep("    emitKid();SCN.town=snapshot({name:'Hero'","    emitKid();spawnCrit('calf',-7.2,-3.4,CALF);spawnCrit('bull',-5.6,-5.2,BULL);SCN.town=snapshot({name:'Hero'")
rep("  setupGL();activate('town');","  SCN.town.crit=true;setupGL();activate('town');")
rep("const moving=busy||player.frozen?false:stepPlayer(dt,mx,mz,go&&!!keys.shift,go&&!!keys[' ']);","const moving=busy||player.frozen?false:stepPlayer(dt,mx,mz,go&&!!keys.shift,go&&!!keys[' ']);stepCrits(dt);")
rep("poseKid(tNow);cull(","poseKid(tNow);poseCrits(tNow);cull(")
code=r'''
/* ---------- creatures made from 3D models: splats scattered over the mesh, each tied to one of 7 bones with a blend weight ---------- */
const CB=7,CRIT=[];
const CALF={speed:1.1,stride:13,bob:0.03,A:0.5,lift:0.045,range:3,notice:3.2,grazeP:0.5,grazeA:0.42,rad:0.42},
      BULL={speed:0.8,stride:10,bob:0.03,A:0.3,lift:0.06,range:3.5,notice:3.4,grazeP:0.25,grazeA:0.16,rad:0.62,bull:1};
function loadCrit(id){const el=document.getElementById('cr_'+id);if(!el)return null;const m=JSON.parse(el.dataset.meta),t=atob(el.textContent.trim()),b=new Uint8Array(t.length);
  for(let i=0;i<t.length;i++)b[i]=t.charCodeAt(i);m.q=new Uint16Array(b.buffer,0,m.n*3);m.c=b.subarray(m.n*6,m.n*10);m.bw=b.subarray(m.n*10,m.n*12);return m;}
function spawnCrit(id,x,z,o){
  const M=loadCrit(id);if(!M||CRIT.length>=2)return;const base=20+NB+CRIT.length*CB;curObj=0;
  for(let i=0;i<M.n;i++)push(M.mn[0]+M.q[i*3]/65535*M.ext[0],M.mn[1]+M.q[i*3+1]/65535*M.ext[1],M.mn[2]+M.q[i*3+2]/65535*M.ext[2],M.c[i*4]/255,M.c[i*4+1]/255,M.c[i*4+2]/255,M.c[i*4+3],0,base+M.bw[i*2],M.diam,M.bw[i*2+1]/255);
  for(let n=0;n<90;n++){const a=rnd()*PI*2,r=sqrt(rnd());push(cos(a)*r*M.wid*0.36,0.035,sin(a)*r*M.len*0.36-0.05,0.16,0.16,0.14,0,0,base,0.1,0);}
  CRIT.push(Object.assign({M,x,z,hx:x,hz:z,y:0,yaw:rnd()*6.28,phase:0,amt:0,v:0,t:1+rnd()*2,mode:'idle',tx:x,tz:z,gz:0,al:0,stuck:0,seed:rnd()*10},o));
}
function stepCrits(dt){
  if(!SC.crit)return;
  for(const c of CRIT){
    const dxp=player.x-c.x,dzp=player.z-c.z,dp=Math.hypot(dxp,dzp),near=dp<c.notice&&!cut.active;
    c.t-=dt;let want=0,tyaw=c.yaw;
    if(near){c.mode='watch';c.t=max(c.t,1.2);}
    if(c.mode==='watch'){tyaw=atan2(dxp,dzp);if(!near&&c.t<=0){c.mode='idle';c.t=1+rnd()*2;}}
    else if(c.mode==='walk'){const dx=c.tx-c.x,dz=c.tz-c.z;if(Math.hypot(dx,dz)<0.25||c.t<=0||c.stuck>0.6){c.mode=rnd()<c.grazeP?'graze':'idle';c.t=2+rnd()*4;c.stuck=0;}else{want=c.speed;tyaw=atan2(dx,dz);}}
    else if(c.t<=0){const a=rnd()*PI*2,r=1+rnd()*c.range;c.tx=c.hx+cos(a)*r;c.tz=c.hz+sin(a)*r;c.mode='walk';c.t=9;}
    let da=tyaw-c.yaw;da=atan2(sin(da),cos(da));c.yaw+=da*min(1,dt*3.5);
    c.v+=(want*max(0,cos(da))-c.v)*min(1,dt*5);
    if(c.v>0.02){let [nx,nz]=collide(c.x+sin(c.yaw)*c.v*dt,c.z+cos(c.yaw)*c.v*dt);
      if(SC.blocked(nx,nz)||Math.hypot(nx-player.x,nz-player.z)<c.rad+0.32){nx=c.x;nz=c.z;}
      if(Math.hypot(nx-c.x,nz-c.z)<c.v*dt*0.4)c.stuck+=dt;else c.stuck=0;c.x=nx;c.z=nz;}
    c.y=SC.h(c.x,c.z);
    c.amt+=(min(1,c.v/c.speed)-c.amt)*min(1,dt*8);c.phase+=dt*c.v*c.stride;
    c.gz+=((c.mode==='graze'?1:0)-c.gz)*min(1,dt*2.5);c.al+=((c.mode==='watch'?1:0)-c.al)*min(1,dt*4);
    // solid: the player is pushed out rather than walking through
    const m=c.rad+0.3;if(dp<m&&dp>1e-4&&!cut.active){player.x=c.x+dxp/dp*m;player.z=c.z+dzp/dp*m;}
  }
}
function poseCrits(t){
  for(let i=0;i<CRIT.length;i++){
    const c=CRIT[i],M=c.M,o=(NB+i*CB)*16,a=c.amt,ph=c.phase,s=c.seed,idle=(1-a)*(1-c.gz)*(1-c.al);
    if(!SC.crit){boneU.fill(0,o,o+CB*16);continue;}
    const bob=a*c.bob*(0.5+0.5*cos(2*ph))+sin(t*1.7+s)*0.005;
    const root=M4.mul(M4.T(c.x,c.y+bob,c.z),M4.mul(M4.Y(c.yaw),M4.mul(M4.X(a*sin(2*ph+0.6)*0.025),M4.Z(a*sin(ph)*0.03))));
    const B=[root];
    // head: nods with the stride, drops to graze, looks about when idle; the calf tilts its head at you, the bull lowers its horns
    const hx=c.gz*c.grazeA+a*sin(2*ph)*0.05+sin(t*1.7+s)*0.015+c.al*(c.bull?0.2:-0.12),
          hy=idle*0.4*sin(t*0.55+s)*sm(0.2,0.8,sin(t*0.23+s*2)*0.5+0.5),hz=c.bull?0:c.al*0.24*sin(t*1.1+s);
    B[1]=joint(root,M.neck[0],M.neck[1],M.neck[2],hx,hy,hz);
    // legs: a trot, diagonal pairs together. Each leg swings from the hip and lifts while it travels forward
    const paw=c.bull?c.al*sm(0.2,0.6,sin(t*0.8+s))*max(0,sin(t*7)):0;
    for(let k=0;k<4;k++){const p=ph+((k===0||k===3)?0:PI),ang=-c.A*a*sin(p)-(k===0?paw*0.7:0),lift=a*c.lift*max(0,cos(p))+(k===0?paw*0.05:0),pv=M.piv[k];
      B[2+k]=joint(M4.mul(root,M4.T(0,lift,0)),pv[0],pv[1],pv[2],ang,0,0);}
    B[6]=joint(root,M.tailP[0],M.tailP[1],M.tailP[2],0.12*sin(t*2.1+s)-a*0.2,0.5*sin(t*3.3+s)*(0.35+0.65*sm(0.3,0.9,sin(t*0.7+s))),0);
    for(let k=0;k<CB;k++)boneU.set(B[k],o+k*16);
  }
}
'''
rep("\n/* ---------- palette (k-means over baked splat colours) ---------- */",code+"\n/* ---------- palette (k-means over baked splat colours) ---------- */")
open('index.html','w').write(s);print(len(s))
