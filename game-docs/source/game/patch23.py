s=open('index.v22.html').read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(a[:50],s.count(a)); s=s.replace(a,b)
rep('\n<script>\n','\n'+open('/home/claude/conv/critters.html').read()+'<script>\n')
rep('uniform mat4 uBone[14];','uniform mat4 uBone[56];')
rep("else if(g>=20.){p=(uBone[int(g-19.5)]*vec4(p,1.)).xyz;}\n  float sw=aMisc.x;",
r"""else if(g>=20.){int b=int(g-19.5);
    if(b>=14){int l=(b-14)%14,r=b-l;float fx=floor(aMisc.x*255.+.5),wt=ph;
      if(fx>191.5){float a=fract(uTime*.75+ph);p+=vec3(sin(ph*40.+a*7.)*.06,a*.5,cos(ph*33.+a*5.)*.06);size*=1.-a;c.rgb*=1.-.5*a;wt=1.;}
      else if(fx>159.5){float a=fract(uTime*.2+ph),q=ph*61.;p+=vec3(sin(q+a*4.)*.16*a-.25*a*a,a*1.5,cos(q*1.3+a*3.)*.16*a);size*=(.5+2.2*a)*smoothstep(1.,.45,a)*smoothstep(0.,.1,a);wt=1.;}
      else if(fx>127.5){float cy=fract(uTime*.4),a=(cy-.02-ph*.2)/.42;if(a<0.||a>1.){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=1.;return;}
        float sd=sign(p.x),q=ph*61.;p+=vec3(sd*(.05+.3*a)+sin(q)*.1*a,-.07*a+.24*a*a+cos(q*1.7)*.09*a,.16*a+sin(q*2.3)*.1*a);size*=(.5+1.9*a)*smoothstep(1.,.55,a)*smoothstep(0.,.08,a);wt=1.;}
      else if(fx>.5){float h=fx/127.,h2=h*h;p.x+=h2*(.07*sin(uTime*7.3+p.y*14.)+.03*sin(uTime*13.1+p.y*31.+p.z*9.));p.z+=h2*.06*sin(uTime*5.9+p.y*11.+1.7);p.y+=h*.05*sin(uTime*10.7+p.x*23.+p.z*17.);
        size*=1.-.45*h*(.5+.5*sin(uTime*12.+p.x*40.+p.y*27.));c.rgb*=.9+.2*sin(uTime*9.+p.y*20.);}
      else if(c.a>.5)c.rgb*=.9+.1*sin(uTime*5.+p.x*17.+p.z*13.);
      vec3 q2=(uBone[b]*vec4(p,1.)).xyz;
      if(l>0&&wt<.999){int par=(l>=6&&l<=9)?b-4:(l==11?b-1:(l>=12?r+1:r));q2=mix((uBone[par]*vec4(p,1.)).xyz,q2,wt);}
      p=q2;}
    else p=(uBone[b]*vec4(p,1.)).xyz;}
  float sw=g>=34.?0.:aMisc.x;""")
rep('const NB=14,boneU=new Float32Array(NB*16);','const NB=14,NBT=56,boneU=new Float32Array(NBT*16);')
rep("if(nx!==undefined&&(group===0||group===4||group===5||group===12))","if(nx!==undefined&&(group===0||group===4||group===5||group===12||group>=34))")
rep("  // villager, their shadow, fireflies\n  emitKid();","  // villager, their shadow, fireflies\n  emitKid();spawnCrit('calf',-5.2,3.6,CALF);spawnCrit('bull',4.2,-8.6,BULL);spawnCrit('titan',-12.5,-11.5,TITAN);")
rep("    emitKid();SCN.town=snapshot({name:'Hero'","    emitKid();spawnCrit('calf',-7.2,-3.4,CALF);spawnCrit('bull',-5.6,-5.2,BULL);spawnCrit('titan',-9,-6,TITAN);SCN.town=snapshot({name:'Hero'")
rep("  setupGL();activate('town');","  SCN.town.crit=true;setupGL();activate('town');")
rep("const moving=busy||player.frozen?false:stepPlayer(dt,mx,mz,go&&!!keys.shift,go&&!!keys[' ']);","const moving=busy||player.frozen?false:stepPlayer(dt,mx,mz,go&&!!keys.shift,go&&!!keys[' ']);stepCrits(dt);")
rep("poseKid(tNow);cull(","poseKid(tNow);poseCrits(tNow);cull(")
code=r'''
/* ---------- creatures made from 3D models ----------
   Splats are scattered over the mesh. Each belongs to one of 14 bones and carries a weight that blends it toward the parent bone, so joints bend instead of tearing.
   Bones: 0 body, 1 head, 2-5 upper legs (FL FR BL BR), 6-9 lower legs, 10 tail, 11 tail tip, 12-13 ears. Flames, steam and embers move in the vertex shader. */
const CB=14,CRIT=[];
const CALF={speed:0.85,ST:0.5,off:[0,.5,.5,0],F:0.6,K:1.1,range:3,notice:3.6,grazeP:0.5,grazeA:0.42,rad:0.42,bob:0.03},
      TITAN={speed:0.62,ST:0.66,off:[.25,.75,0,.5],F:0.3,K:0.85,range:3.5,notice:5,grazeP:0.15,grazeA:0.12,rad:1.05,bob:0.03,bull:1},
      BULL={speed:0.72,ST:0.62,off:[.25,.75,0,.5],F:0.36,K:0.95,range:3.5,notice:3.8,grazeP:0.3,grazeA:0.16,rad:0.62,bob:0.018,bull:1};
function loadCrit(id){const el=document.getElementById('cr_'+id);if(!el)return null;const m=JSON.parse(el.dataset.meta),t=atob(el.textContent.trim()),b=new Uint8Array(t.length);
  for(let i=0;i<t.length;i++)b[i]=t.charCodeAt(i);m.q=new Uint16Array(b.buffer,0,m.n*3);m.c=b.subarray(m.n*6,m.n*10);m.bw=b.subarray(m.n*10,m.n*13);return m;}
function spawnCrit(id,x,z,o){
  const M=loadCrit(id);if(!M||CRIT.length>=3)return;const base=20+NB+CRIT.length*CB;curObj=0;
  for(let i=0;i<M.n;i++)push(M.mn[0]+M.q[i*3]/65535*M.ext[0],M.mn[1]+M.q[i*3+1]/65535*M.ext[1],M.mn[2]+M.q[i*3+2]/65535*M.ext[2],M.c[i*4]/255,M.c[i*4+1]/255,M.c[i*4+2]/255,M.c[i*4+3],M.bw[i*3+2]/255,base+M.bw[i*3],M.diam,M.bw[i*3+1]/255);
  for(let n=0;n<90;n++){const a=rnd()*PI*2,r=sqrt(rnd());push(cos(a)*r*M.wid*0.36,0.035,sin(a)*r*M.len*0.36-0.05,0.16,0.16,0.14,0,0,base,0.1,0,0,1,0);}
  if(M.nost)for(const p of M.nost)for(let n=0;n<44;n++){const g=0.78+rnd()*0.17;push(p[0],p[1],p[2],g,g*0.98,g*0.95,0,140/255,base+1,0.05+rnd()*0.03,rnd());}   // steam, breathed out in snorts
  if(M.vent)for(let n=0;n<70;n++){const g=0.7+rnd()*0.2;push(M.vent[0]+(rnd()-.5)*.2,M.vent[1],M.vent[2]+(rnd()-.5)*.2,g,g*0.97,g*0.94,0,176/255,base,0.07+rnd()*0.05,rnd());}   // smoke rising off the hump
  if(M.tips)for(const p of M.tips)for(let n=0;n<12;n++)push(p[0]+(rnd()-.5)*.06,p[1]-rnd()*.1,p[2]+(rnd()-.5)*.06,1,0.62,0.16,1,224/255,base+1,0.045,rnd()); // embers off the horn flames
  CRIT.push(Object.assign({M,x,z,hx:x,hz:z,y:0,yaw:rnd()*6.28,phase:0,amt:0,v:0,w:0,turn:0,joy:0,t:1+rnd()*2,mode:'idle',tx:x,tz:z,gz:0,al:0,stuck:0,seed:rnd()*10,stride:2*M.hip[0][1]*sin(o.F)/o.ST},o));
}
function stepCrits(dt){
  if(!SC.crit)return;
  for(const c of CRIT){
    const dxp=player.x-c.x,dzp=player.z-c.z,dp=Math.hypot(dxp,dzp),near=dp<c.notice&&!cut.active;
    c.t-=dt;let want=0,tyaw=c.yaw;
    if(near){if(c.mode!=='watch'&&!c.bull)c.joy=1;c.mode='watch';c.t=max(c.t,1.2);}
    if(c.mode==='watch'){tyaw=atan2(dxp,dzp);if(!c.bull&&dp>1.75&&c.joy<=0)want=c.speed;if(!near&&c.t<=0){c.mode='idle';c.t=1+rnd()*2;}}   // the calf trots up to you; the bull holds its ground
    else if(c.mode==='walk'){const dx=c.tx-c.x,dz=c.tz-c.z;if(Math.hypot(dx,dz)<0.25||c.t<=0||c.stuck>0.6){c.mode=rnd()<c.grazeP?'graze':'idle';c.t=2+rnd()*4;c.stuck=0;}else{want=c.speed;tyaw=atan2(dx,dz);}}
    else if(c.t<=0){const a=rnd()*PI*2,r=1+rnd()*c.range;c.tx=c.hx+cos(a)*r;c.tz=c.hz+sin(a)*r;c.mode='walk';c.t=9;}
    // turn first, then go: speed only builds once it is facing roughly the right way
    let da=tyaw-c.yaw;da=atan2(sin(da),cos(da));const dy=clamp(da*min(1,dt*4),-dt*(c.bull?1.7:3),dt*(c.bull?1.7:3));c.yaw+=dy;
    c.w+=(dy/max(dt,1e-3)-c.w)*min(1,dt*7);c.turn+=(min(1,abs(c.w)/1.1)-c.turn)*min(1,dt*6);
    c.v+=(want*sm(0.55,0.95,cos(da))-c.v)*min(1,dt*4);
    if(c.v>0.02){let [nx,nz]=collide(c.x+sin(c.yaw)*c.v*dt,c.z+cos(c.yaw)*c.v*dt);
      if(SC.blocked(nx,nz)||Math.hypot(nx-player.x,nz-player.z)<c.rad+0.32){nx=c.x;nz=c.z;}
      if(Math.hypot(nx-c.x,nz-c.z)<c.v*dt*0.4)c.stuck+=dt;else c.stuck=0;c.x=nx;c.z=nz;}
    c.amt+=(min(1,c.v/c.speed)-c.amt)*min(1,dt*8);c.phase+=dt*(c.v/c.stride+c.turn*(1-c.amt)*1.15);
    c.gz+=((c.mode==='graze'?1:0)-c.gz)*min(1,dt*2.5);c.al+=((c.mode==='watch'?1:0)-c.al)*min(1,dt*4);c.joy=max(0,c.joy-dt/0.55);
    const m=c.rad+0.3;if(dp<m&&dp>1e-4&&!cut.active){player.x=c.x+dxp/dp*m;player.z=c.z+dzp/dp*m;}
  }
}
// one leg over its cycle: planted and pushing back until ST, then it folds at the knee, lifts and reaches forward
function legAt(cc,c,a){
  if(cc<c.ST){const u=cc/c.ST;return [a*c.F*(2*u-1),a*0.1*sin(u*PI)];}
  const u=(cc-c.ST)/(1-c.ST),e=u*u*(3-2*u);return [a*c.F*(1-2*e)-a*0.14*sin(u*PI),a*c.K*sin(PI*pow(u,0.75))];
}
function poseCrits(t){
  for(let i=0;i<CRIT.length;i++){
    const c=CRIT[i],M=c.M,o=(NB+i*CB)*16;
    if(!SC.crit){boneU.fill(0,o,o+CB*16);continue;}
    c.y=SC.h(c.x,c.z);
    const a=c.amt,s=c.seed,turn=c.turn*(1-a),st=max(a,0.55*turn),cyc=fract(c.phase),al=c.al,gz=c.gz,idle=(1-a)*(1-gz)*(1-al),TAU=2*PI,breath=sin(t*1.6+s);
    // bull: rear a foreleg, slam it down, then scrape the ground twice. The clock is shared with the steam, so each stomp ends in a snort
    let raise=0,slam=0,scr=0,shake=0,sleg=-1;
    if(c.bull){const u=fract(t*0.4),still=al*(1-a);sleg=floor(t*0.4+0.38)&1;raise=still*sm(0.6,0.84,u)*(1-sm(0.93,1,u));slam=still*exp(-u*12)*(u<0.55?1:0);
      scr=still*max(0,sin((u-0.12)/0.4*TAU*2))*(u>0.12&&u<0.52?1:0);shake=al*sin(t*17)*exp(-u*5)*(u<0.6?0.12:0);}
    // calf: a happy jump when it first spots you, then small bounces while it watches
    const air=c.bull?0:(c.joy>0?sin(PI*(1-c.joy)):0),hopB=c.bull?0:al*(1-a)*pow(max(0,sin(t*5.2+s)),2)*0.022;
    const bob=st*c.bob*(0.5-0.5*cos(2*TAU*cyc))+0.004*breath+air*0.2+hopB-slam*0.035;
    const pitch=st*0.02*sin(2*TAU*cyc+1)+slam*0.07-air*0.12*cos(PI*(1-c.joy))+gz*0.03,
          roll=a*(c.bull?0.03:0.014)*sin(TAU*cyc)-clamp(c.w,-2,2)*0.04*(a+0.35)+idle*0.012*sin(t*0.5+s);
    const root=M4.mul(M4.T(c.x,c.y+bob,c.z),M4.mul(M4.Y(c.yaw),M4.mul(M4.X(pitch),M4.mul(M4.Z(roll),M4.S(1+0.006*breath,1+0.011*breath,1)))));
    const B=[root];
    // head: nods with each step, leads into turns, drops to graze, looks about when idle
    const hx=gz*(c.grazeA+0.04*sin(t*3.1+s))+a*0.05*sin(2*TAU*cyc+0.5)+0.015*breath+al*(c.bull?0.2:-0.14)+slam*0.3-raise*0.12-air*0.18,
          hy=idle*0.42*sin(t*0.55+s)*sm(0.2,0.8,sin(t*0.23+s*2)*0.5+0.5)+clamp(c.w*0.28,-0.5,0.5)+shake+gz*0.07*sin(t*2.3+s),
          hz=c.bull?shake*0.6:al*0.26*sin(t*1.1+s);
    B[1]=joint(root,M.neck[0],M.neck[1],M.neck[2],hx,hy,hz);
    for(let k=0;k<4;k++){
      let [th,kn]=legAt(fract(cyc+c.off[k]),c,st);
      if(k===sleg){th+=-0.85*raise+0.5*scr;kn+=1.55*raise+0.3*scr;}
      if(air){kn+=0.95*air;th+=(k<2?-0.4:0.45)*air;}
      // a leg that already slants would dig into the ground as it swings through vertical, so lift it by that much
      const H=M.hip[k],Kn=M.knee[k],phi=atan2(H[2]-Kn[2],H[1]-Kn[1]),Lr=H[1]/cos(phi),sink=max(0,Lr*(cos(phi+th)-cos(phi)));
      const lift=sink+max(0,pitch*H[2]-bob);
      const up=joint(lift?M4.mul(root,M4.T(0,lift,0)):root,H[0],H[1],H[2],th,0,0);B[2+k]=up;B[6+k]=joint(up,M.knee[k][0],M.knee[k][1],M.knee[k][2],kn,0,0);
    }
    // tail: the calf wags hard when it sees you; the bull lifts its tail and lashes it. The tip follows half a beat behind
    const gate=sm(0.25,0.85,sin(t*0.7+s)),ws=c.bull?3.3:(2.6+10.5*al),wa=c.bull?(0.25+0.3*gate+0.35*al):(0.2+0.25*gate+0.55*al),wp=t*ws+s;
    B[10]=joint(root,M.tailP[0],M.tailP[1],M.tailP[2],0.1*sin(t*2.1+s)+(c.bull?0.55*al:0.3*al)-a*0.15+air*0.5,wa*sin(wp)+a*0.2*sin(TAU*cyc),0);
    B[11]=joint(B[10],M.tailP2[0],M.tailP2[1],M.tailP2[2],0.12*sin(t*2.1+s-0.8),wa*0.9*sin(wp-0.9),0);
    // ears: flop with the bounce of each step, perk up when alert, twitch now and then
    const ev=k=>0.06*sin(t*1.3+s+k*2)+0.45*pow(max(0,sin(t*0.83+s*3+k*1.9)),40)+al*0.28-st*0.24*sin(2*TAU*cyc-0.9)-air*0.6*cos(PI*(1-c.joy))-gz*0.2;
    B[12]=joint(B[1],M.earP[0][0],M.earP[0][1],M.earP[0][2],0,0,ev(0));B[13]=joint(B[1],M.earP[1][0],M.earP[1][1],M.earP[1][2],0,0,-ev(1));
    for(let k=0;k<CB;k++)boneU.set(B[k],o+k*16);
  }
}
'''
rep("\n/* ---------- palette (k-means over baked splat colours) ---------- */",code+"\n/* ---------- palette (k-means over baked splat colours) ---------- */")
open('index.html','w').write(s);print(len(s))
