import re
s=open('index.v23.html').read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(a[:60],s.count(a)); s=s.replace(a,b)
# fresh creature data
a=s.index('<script type="application/octet-stream" id="cr_calf"');b=s.index('<script>\n',a)
s=s[:a]+open('/home/claude/conv/critters.html').read()+s[b:]
# ---- shader ----
rep("uniform vec2 uMill,uWalk;uniform vec4 uPlayer;","uniform vec2 uMill,uWalk;uniform vec4 uPlayer;uniform vec4 uShA[4],uShB[4];uniform float uSnort[3];")
rep("  else if(g==12.){p+=vec3(uPlayer.x,uGround,uPlayer.z);}","  else if(g==12.){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=1.;return;}")
a=s.index("      if(fx>191.5){float a=fract(uTime*.75+ph)");b=s.index("      vec3 q2=(uBone[b]*vec4(p,1.)).xyz;")
s=s[:a]+r"""      if(fx>191.5){float a=fract(uTime*.28+ph);p+=vec3(sin(ph*40.+a*4.)*.07*a,a*.42,cos(ph*33.+a*3.)*.07*a);size*=(1.-a)*smoothstep(0.,.15,a);c.rgb*=1.-.5*a;wt=1.;}
      else if(fx>159.5){float a=fract(uTime*.2+ph),q=ph*61.;p+=vec3(sin(q+a*4.)*.16*a-.25*a*a,a*1.5,cos(q*1.3+a*3.)*.16*a);size*=(.5+2.2*a)*smoothstep(1.,.45,a)*smoothstep(0.,.1,a);wt=1.;}
      else if(fx>127.5){float a=(uSnort[(b-14)/14]-ph*.3)/.8;if(a<0.||a>1.){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=1.;return;}
        float sd=sign(p.x),q=ph*61.,e=1.-(1.-a)*(1.-a);p+=vec3(sd*(.05+.3*e)+sin(q)*.1*e,-.07*e+.2*a*a+cos(q*1.7)*.09*e,.18*e+sin(q*2.3)*.1*e);size*=(.5+1.9*a)*smoothstep(1.,.5,a)*smoothstep(0.,.08,a);wt=1.;}
      else if(fx>.5){float h=fx/127.,h2=h*h;p.x+=h2*(.06*sin(uTime*2.3+p.y*9.)+.02*sin(uTime*4.1+p.y*19.+p.z*6.));p.z+=h2*.05*sin(uTime*1.9+p.y*8.+1.7);p.y+=h*.04*sin(uTime*3.1+p.x*14.+p.z*11.);
        size*=1.-.35*h*(.5+.5*sin(uTime*3.7+p.x*25.+p.y*17.));c.rgb*=.94+.1*sin(uTime*2.6+p.y*12.);}
      else if(c.a>.5)c.rgb*=.93+.07*sin(uTime*1.8+p.x*17.+p.z*13.);
"""+s[b:]
# soft contact shadows: darken the ground (and grass) under the player and each creature
rep("  vec4 vc=uV*vec4(p,1.);float R=.5*size*uSize*uLod;vec3 vn=vec3(0.);",
r"""  if(g<20.&&c.a<.5)for(int i=0;i<4;i++){if(uShB[i].z>0.){vec2 d=p.xz-uShA[i].xy;float s=sin(uShA[i].w),co=cos(uShA[i].w),hh=p.y-uShA[i].z;d=vec2(co*d.x-s*d.y,s*d.x+co*d.y)/uShB[i].xy;float k=dot(d,d);
    if(k<1.&&hh<.75&&hh>-.6)c.rgb*=1.-uShB[i].z*(1.-smoothstep(.1,1.,k))*(1.-smoothstep(.25,.75,hh));}}
  vec4 vc=uV*vec4(p,1.);float R=.5*size*uSize*uLod;vec3 vn=vec3(0.);""")
rep("gl.uniform2f(U(p,'uWalk'),player.phase,player.amt);","gl.uniform2f(U(p,'uWalk'),player.phase,player.amt);gl.uniform4fv(U(p,'uShA[0]'),shA);gl.uniform4fv(U(p,'uShB[0]'),shB);gl.uniform1fv(U(p,'uSnort[0]'),snortU);")
# ---- creature code ----
a=s.index("/* ---------- creatures made from 3D models ----------");b=s.index("/* ---------- palette (k-means over baked splat colours) ---------- */")
code=r'''/* ---------- creatures made from 3D models ----------
   Splats are scattered over the mesh. Each belongs to one of 14 bones and carries a weight that blends it toward the parent bone, so joints bend instead of tearing.
   Bones: 0 body, 1 head, 2-5 upper legs (FL FR BL BR), 6-9 lower legs, 10 tail, 11 tail tip, 12-13 ears. Flames, steam and embers move in the vertex shader.
   Motion is layered: a walk cycle, always-on idle drift, and one-shot actions picked at random with random gaps. Two actions can run at once (a body action and a
   secondary one such as a snort or a tail lash), and every action eases in and out, so nothing pops. */
const CB=14,CRIT=[],shA=new Float32Array(16),shB=new Float32Array(16),snortU=new Float32Array(3).fill(9);
const CALF={kind:'calf',speed:0.85,ST:0.5,off:[0,.5,.5,0],F:0.6,K:1.1,range:3,notice:3.6,grazeP:0.5,grazeA:0.42,rad:0.42,bob:0.03},
      TITAN={kind:'titan',speed:0.62,ST:0.66,off:[.25,.75,0,.5],F:0.3,K:0.85,range:3.5,notice:5,grazeP:0.15,grazeA:0.12,rad:1.05,bob:0.03,bull:1},
      BULL={kind:'bull',speed:0.72,ST:0.62,off:[.25,.75,0,.5],F:0.36,K:0.95,range:3.5,notice:3.8,grazeP:0.3,grazeA:0.16,rad:0.62,bob:0.018,bull:1};
function loadCrit(id){const el=document.getElementById('cr_'+id);if(!el)return null;const m=JSON.parse(el.dataset.meta),t=atob(el.textContent.trim()),b=new Uint8Array(t.length);
  for(let i=0;i<t.length;i++)b[i]=t.charCodeAt(i);m.q=new Uint16Array(b.buffer,0,m.n*3);m.c=b.subarray(m.n*6,m.n*10);m.bw=b.subarray(m.n*10,m.n*13);return m;}
function spawnCrit(id,x,z,o){
  const M=loadCrit(id);if(!M||CRIT.length>=3)return;const base=20+NB+CRIT.length*CB;curObj=0;
  for(let i=0;i<M.n;i++)push(M.mn[0]+M.q[i*3]/65535*M.ext[0],M.mn[1]+M.q[i*3+1]/65535*M.ext[1],M.mn[2]+M.q[i*3+2]/65535*M.ext[2],M.c[i*4]/255,M.c[i*4+1]/255,M.c[i*4+2]/255,M.c[i*4+3],M.bw[i*3+2]/255,base+M.bw[i*3],M.diam,M.bw[i*3+1]/255);
  if(M.nost)for(const p of M.nost)for(let n=0;n<44;n++){const g=0.78+rnd()*0.17;push(p[0],p[1],p[2],g,g*0.98,g*0.95,0,140/255,base+1,0.05+rnd()*0.03,rnd());}   // steam, let out when it snorts
  if(M.vent)for(let n=0;n<70;n++){const g=0.7+rnd()*0.2;push(M.vent[0]+(rnd()-.5)*.2,M.vent[1],M.vent[2]+(rnd()-.5)*.2,g,g*0.97,g*0.94,0,176/255,base,0.07+rnd()*0.05,rnd());}   // smoke rising off the hump
  if(M.tips)for(const p of M.tips)for(let n=0;n<6;n++)push(p[0]+(rnd()-.5)*.06,p[1]-rnd()*.08,p[2]+(rnd()-.5)*.06,1,0.62,0.16,1,224/255,base+1,0.04,rnd()); // a few slow embers
  CRIT.push(Object.assign({M,x,z,hx:x,hz:z,y:0,yaw:rnd()*6.28,phase:0,amt:0,v:0,w:0,turn:0,t:1+rnd()*2,mode:'idle',tx:x,tz:z,gz:0,al:0,stuck:0,seed:rnd()*10,
    A:null,B:null,nA:1+rnd()*3,nB:1+rnd()*3,aw:1,snort:9,sl:0,stride:2*M.hip[0][1]*sin(o.F)/o.ST},o));
}
// curve through keys [place 0..1, value], eased between them
const cv=(u,K)=>{if(u<=K[0][0])return K[0][1];for(let i=1;i<K.length;i++)if(u<=K[i][0]){const a=K[i-1],b=K[i],t=(u-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*t*t*(3-2*t);}return K[K.length-1][1];};
const bell=u=>{const q=sin(PI*clamp(u,0,1));return q*q;},edge=(u,i,o)=>sm(0,i,u)*(1-sm(1-o,1,u));
const drift=(t,s)=>sin(t+s)*0.5+sin(t*0.37+s*2.1)*0.3+sin(t*0.131+s*5.3)*0.2;   // slow, never-repeating wander in -1..1
// One-shot actions. Each writes offsets into the pose channels h (u runs 0..1 over the action; c.sd is a random sign picked when it starts).
const ACT={
  // --- young bull ---
  stomp:{d:[1.35,1.7],hit:0.63,f(u,c,h){const k=c.sl,L=h.L[k];   // shift weight, rear the leg, hold, slam, settle
    L[0]+=cv(u,[[0,0],[.14,.1],[.45,-.9],[.56,-.95],[.63,-.04],[.72,.04],[1,0]]);L[1]+=cv(u,[[0,0],[.14,0],[.42,1.5],[.56,1.3],[.63,0],[1,0]]);
    h.dy+=cv(u,[[0,0],[.16,-.015],[.5,.02],[.63,-.045],[.76,.01],[1,0]]);h.pitch+=cv(u,[[0,0],[.5,-.04],[.64,.07],[.8,-.012],[1,0]]);
    h.hx+=cv(u,[[0,0],[.5,-.16],[.66,.3],[.84,.06],[1,0]]);h.roll+=(k?-1:1)*cv(u,[[0,0],[.3,.04],[.58,.04],[.7,0],[1,0]]);h.tx+=cv(u,[[0,0],[.5,.3],[.7,.1],[1,0]]);}},
  scrape:{d:[1.5,2.1],f(u,c,h){const e=edge(u,.18,.2),L=h.L[c.sl],n=2+(c.sd>0?1:0),q=2*PI*n*u;   // paw the ground
    L[0]+=e*(-.22+.5*sin(q));L[1]+=e*(.45+.4*cos(q));h.hx+=e*.2;h.dy-=e*.01;h.roll+=(c.sl?-1:1)*e*.025;h.tx+=e*.25;}},
  toss:{d:[1.0,1.3],f(u,c,h){h.hx+=cv(u,[[0,0],[.3,.3],[.55,-.42],[.76,-.08],[1,0]]);h.hz+=c.sd*cv(u,[[0,0],[.5,.2],[1,0]]);h.pitch+=cv(u,[[0,0],[.55,-.03],[1,0]]);}},
  // --- lava bull ---
  slam:{d:[2.1,2.6],hit:0.69,f(u,c,h){   // rear up on the hind legs and crash down on both forelegs
    const th=cv(u,[[0,0],[.5,-.5],[.61,-.5],[.69,0],[1,0]]),kn=cv(u,[[0,0],[.45,1.1],[.6,.9],[.69,0],[1,0]]);h.L[0][0]+=th;h.L[1][0]+=th;h.L[0][1]+=kn;h.L[1][1]+=kn;
    h.pitch+=cv(u,[[0,0],[.14,.03],[.5,-.2],[.6,-.21],[.7,.06],[.83,-.012],[1,0]]);h.dy+=cv(u,[[0,0],[.14,-.03],[.55,.03],[.7,-.08],[.84,.015],[1,0]]);
    h.hx+=cv(u,[[0,0],[.5,-.2],[.72,.36],[.88,.08],[1,0]]);h.tx+=cv(u,[[0,0],[.5,.45],[.75,.1],[1,0]]);h.L[2][1]+=cv(u,[[0,0],[.5,.25],[.7,0],[1,0]]);h.L[3][1]+=cv(u,[[0,0],[.5,.25],[.7,0],[1,0]]);}},
  sway:{d:[3.2,4.4],f(u,c,h){const e=edge(u,.2,.2);h.hx+=e*.16;h.hy+=e*.36*sin(2*PI*u)*c.sd;h.roll+=e*.02*sin(2*PI*u)*c.sd;}},   // slow, low swing of the head
  rumble:{d:[1.3,1.7],hit:0.3,f(u,c,h){const e=bell(u);h.roll+=e*.012*sin(u*46);h.sq+=e*.02*sin(u*23);h.hx+=e*.1;h.dy-=e*.012;}},
  // --- calf ---
  hop:{d:[.6,.75],f(u,c,h){const a=sin(PI*u);h.dy+=.2*a;h.pitch-=.12*cos(PI*u)*a;h.hx-=.18*a;for(let k=0;k<4;k++){h.L[k][1]+=.95*a;h.L[k][0]+=(k<2?-.4:.45)*a;}h.tx+=.5*a;h.ear-=.6*cos(PI*u)*a;}},
  bow:{d:[1.6,2.2],f(u,c,h){const e=edge(u,.22,.25);h.pitch+=.26*e;h.dy-=.03*e;h.hx-=.42*e;h.L[0][0]-=.5*e;h.L[1][0]-=.5*e;h.wag+=e;h.tx+=.35*e;h.ear+=.25*e;}},   // play bow: chest down, rump up, tail going
  tilt:{d:[1.6,2.4],f(u,c,h){const e=edge(u,.2,.25);h.hz+=c.sd*.36*e;h.hx-=.08*e;h.ear+=.2*e;}},
  sniff:{d:[2.0,2.8],f(u,c,h){const e=edge(u,.2,.2);h.hx+=.4*e+.03*e*sin(u*40);h.hy+=.14*e*sin(u*9)*c.sd;}},
  // --- shared ---
  shake:{d:[.8,1.0],f(u,c,h){const e=bell(u),q=2*PI*3.5*u;h.hy+=e*.22*sin(q);h.hz+=e*.16*sin(q+1);h.roll+=e*.02*sin(q+.5);h.ear+=e*.35*sin(q*1.0+2);}},
  look:{d:[2.2,4.0],f(u,c,h){const e=edge(u,.16,.2);h.hy+=c.sd*.5*e;h.hx-=.05*e;}},
  shift:{d:[2.4,3.4],f(u,c,h){const e=edge(u,.3,.3),k=c.sd>0?2:3;h.roll+=c.sd*.03*e;h.L[k][1]+=.4*e;h.L[k][0]-=.12*e;h.dy-=.006*e;}},   // rest a hind leg
  // --- secondary: can play on top of any of the above ---
  snort:{d:[.9,1.2],f(u,c,h){h.hx+=cv(u,[[0,0],[.15,-.06],[.3,.12],[.6,.03],[1,0]]);h.sq+=cv(u,[[0,0],[.15,.012],[.35,-.012],[1,0]]);}},
  lash:{d:[1.0,1.5],f(u,c,h){const e=bell(u);h.ty+=e*.75*sin(2*PI*2*u)*c.sd;h.tx+=e*.25;}},
  flick:{d:[.35,.5],f(u,c,h){h['e'+(c.sd>0?'L':'R')]+=bell(u)*.5;}},
  wag:{d:[1.2,2.0],f(u,c,h){h.wag+=edge(u,.2,.3);}}
};
const PICK={
  calf:{calm:{A:[['look',3],['tilt',2],['sniff',3],['shake',1],['shift',2],['hop',.6]],B:[['flick',4],['wag',2]]},alert:{A:[['hop',3],['bow',3],['tilt',3],['shake',1]],B:[['flick',2],['wag',3]]}},
  bull:{calm:{A:[['look',3],['shift',3],['shake',1.5],['scrape',1],['toss',1]],B:[['lash',3],['snort',2]]},alert:{A:[['stomp',4],['scrape',3],['toss',2],['shake',1]],B:[['snort',3],['lash',3]]}},
  titan:{calm:{A:[['look',2],['sway',3],['shift',3],['rumble',1]],B:[['lash',3],['snort',2]]},alert:{A:[['slam',3],['rumble',2],['sway',2],['scrape',2]],B:[['snort',3],['lash',2]]}}
};
function startAct(c,slot,id){const a=ACT[id];c[slot]={id,t:0,d:a.d[0]+rnd()*(a.d[1]-a.d[0]),hit:false,sd:rnd()<0.5?-1:1};if(id==='stomp'||id==='scrape')c.sl^=1;if(id==='snort')c.snort=0;}
function pickAct(c,slot){const L=PICK[c.kind][c.al>0.5?'alert':'calm'][slot];let tot=0;for(const e of L)tot+=e[1]*(e[0]===c['last'+slot]?0.25:1);let r=rnd()*tot;
  for(const e of L){r-=e[1]*(e[0]===c['last'+slot]?0.25:1);if(r<=0){c['last'+slot]=e[0];startAct(c,slot,e[0]);return;}}}
function stepCrits(dt){
  if(!SC.crit)return;
  for(const c of CRIT){
    const dxp=player.x-c.x,dzp=player.z-c.z,dp=Math.hypot(dxp,dzp),near=dp<c.notice&&!cut.active;
    c.t-=dt;let want=0,tyaw=c.yaw;
    if(near){if(c.mode!=='watch'){if(c.kind==='calf'&&c.amt<0.3)startAct(c,'A','hop');c.nA=min(c.nA,0.6+rnd()*0.8);}c.mode='watch';c.t=max(c.t,1.2);}
    if(c.mode==='watch'){tyaw=atan2(dxp,dzp);if(!c.bull&&dp>1.75&&!c.A)want=c.speed;if(!near&&c.t<=0){c.mode='idle';c.t=1+rnd()*2;}}   // the calf trots up to you; the bulls hold their ground
    else if(c.mode==='walk'){const dx=c.tx-c.x,dz=c.tz-c.z;if(Math.hypot(dx,dz)<0.25||c.t<=0||c.stuck>0.6){c.mode=rnd()<c.grazeP?'graze':'idle';c.t=c.mode==='graze'?3+rnd()*4:4+rnd()*7;c.stuck=0;}else{want=c.speed;tyaw=atan2(dx,dz);}}
    else if(c.t<=0&&!c.A){const a=rnd()*PI*2,r=1+rnd()*c.range;c.tx=c.hx+cos(a)*r;c.tz=c.hz+sin(a)*r;c.mode='walk';c.t=9;}
    // turn first, then go: speed only builds once it is facing roughly the right way
    let da=tyaw-c.yaw;da=atan2(sin(da),cos(da));const mt=dt*(c.kind==='titan'?1.1:c.bull?1.7:3),dy=clamp(da*min(1,dt*4),-mt,mt);c.yaw+=dy;
    c.w+=(dy/max(dt,1e-3)-c.w)*min(1,dt*7);c.turn+=(min(1,abs(c.w)/1.1)-c.turn)*min(1,dt*6);
    c.v+=(want*sm(0.55,0.95,cos(da))-c.v)*min(1,dt*(want?2.5:4));
    if(c.v>0.02){let [nx,nz]=collide(c.x+sin(c.yaw)*c.v*dt,c.z+cos(c.yaw)*c.v*dt);
      if(SC.blocked(nx,nz)||Math.hypot(nx-player.x,nz-player.z)<c.rad+0.32){nx=c.x;nz=c.z;}
      if(Math.hypot(nx-c.x,nz-c.z)<c.v*dt*0.4)c.stuck+=dt;else c.stuck=0;c.x=nx;c.z=nz;}
    c.amt+=(min(1,c.v/c.speed)-c.amt)*min(1,dt*6);c.phase+=dt*(c.v/c.stride+c.turn*(1-c.amt)*1.15);
    c.gz+=((c.mode==='graze'?1:0)-c.gz)*min(1,dt*2);c.al+=((c.mode==='watch'?1:0)-c.al)*min(1,dt*2.5);c.snort+=dt;
    // actions: body slot A only while standing; secondary slot B any time. Random gaps, shorter when it is watching you
    const still=c.amt<0.1&&c.v<0.06&&c.gz<0.3&&abs(c.w)<0.4;c.aw+=((c.amt<0.2?1:0)-c.aw)*min(1,dt*5);
    for(const slot of ['A','B']){const cur=c[slot],nk='n'+slot;
      if(cur){cur.t+=dt;const a=ACT[cur.id];if(a.hit&&!cur.hit&&cur.t/cur.d>=a.hit){cur.hit=true;if(rnd()<0.75)startAct(c,'B','snort');}
        if(cur.t>=cur.d){c[slot]=null;c[nk]=c.al>0.5?0.7+rnd()*2.4:(slot==='A'?2+rnd()*5.5:1.5+rnd()*5);}}
      else{c[nk]-=dt;if(c[nk]<=0&&(slot==='B'||still))pickAct(c,slot);}}
    const m=c.rad+0.3;if(dp<m&&dp>1e-4&&!cut.active){player.x=c.x+dxp/dp*m;player.z=c.z+dzp/dp*m;}
  }
}
// one leg over its cycle: planted and pushing back until ST, then it folds at the knee, lifts and reaches forward
function legAt(cc,c,a){
  if(cc<c.ST){const u=cc/c.ST;return [a*c.F*(2*u-1),a*0.1*sin(u*PI)];}
  const u=(cc-c.ST)/(1-c.ST),e=u*u*(3-2*u);return [a*c.F*(1-2*e)-a*0.14*sin(u*PI),a*c.K*sin(PI*pow(u,0.75))];
}
function poseCrits(t){
  shA.fill(0);shB.fill(0);
  shA.set([player.x,player.z,player.y,player.yaw],0);shB.set([0.36/(1+player.jy*0.4),0.3/(1+player.jy*0.4),0.42/(1+player.jy*1.5),0],0);
  for(let i=0;i<CRIT.length;i++){
    const c=CRIT[i],M=c.M,o=(NB+i*CB)*16;
    if(!SC.crit){boneU.fill(0,o,o+CB*16);snortU[i]=9;continue;}
    c.y=SC.h(c.x,c.z);snortU[i]=min(9,c.snort);
    shA.set([c.x-sin(c.yaw)*M.len*0.04,c.z-cos(c.yaw)*M.len*0.04,c.y,c.yaw],(i+1)*4);shB.set([M.wid*0.4,M.len*0.44,0.45,0],(i+1)*4);
    const a=c.amt,s=c.seed,turn=c.turn*(1-a),st=max(a,0.55*turn),cyc=fract(c.phase),al=c.al,gz=c.gz,calm=(1-a)*(1-gz),TAU=2*PI,breath=sin(t*1.5+s)+0.3*sin(t*0.4+s*2);
    // gather the one-shot actions into pose offsets
    const h={hx:0,hy:0,hz:0,pitch:0,roll:0,dy:0,tx:0,ty:0,ear:0,eL:0,eR:0,wag:0,sq:0,L:[[0,0],[0,0],[0,0],[0,0]]};
    if(c.A){c.sd=c.A.sd;ACT[c.A.id].f(c.A.t/c.A.d,c,h);}
    if(c.aw<0.999){for(const k of ['hx','hy','hz','pitch','roll','dy','tx','sq'])h[k]*=c.aw;for(const L of h.L){L[0]*=c.aw;L[1]*=c.aw;}}
    if(c.B){c.sd=c.B.sd;ACT[c.B.id].f(c.B.t/c.B.d,c,h);}
    const bob=st*c.bob*(0.5-0.5*cos(2*TAU*cyc))+0.004*breath+h.dy;
    const pitch=st*0.02*sin(2*TAU*cyc+1)+gz*0.03+h.pitch,
          roll=a*(c.bull?0.03:0.014)*sin(TAU*cyc)-clamp(c.w,-2,2)*0.04*(a+0.35)+calm*0.014*drift(t*0.45,s)+h.roll;
    const root=M4.mul(M4.T(c.x,c.y+bob,c.z),M4.mul(M4.Y(c.yaw),M4.mul(M4.X(pitch),M4.mul(M4.Z(roll),M4.S(1+0.006*breath-h.sq*0.5,1+0.011*breath+h.sq,1+h.sq*0.3)))));
    const B=[root];
    // head: nods with each step, leads into turns, drops to graze, drifts a little when idle; bulls carry it low when they are watching you
    const hx=gz*(c.grazeA+0.04*sin(t*3.1+s))+a*0.05*sin(2*TAU*cyc+0.5)+0.012*breath+calm*0.03*drift(t*0.4,s+3)+al*(c.bull?0.16:-0.12)+h.hx,
          hy=calm*0.07*drift(t*0.5,s)+clamp(c.w*0.28,-0.5,0.5)+gz*0.07*sin(t*2.3+s)+h.hy,hz=calm*0.02*drift(t*0.3,s+7)+h.hz;
    B[1]=joint(root,M.neck[0],M.neck[1],M.neck[2],hx,hy,hz);
    for(let k=0;k<4;k++){
      const lg=legAt(fract(cyc+c.off[k]),c,st),th=lg[0]+h.L[k][0],kn=max(0,lg[1]+h.L[k][1]);
      // a leg that already slants would dig into the ground as it swings through vertical, and a dipping body pushes its feet down: lift the leg by that much
      const H=M.hip[k],Kn=M.knee[k],phi=atan2(H[2]-Kn[2],H[1]-Kn[1]),Lr=H[1]/cos(phi),sink=max(0,Lr*(cos(phi+th)-cos(phi))),lift=sink+max(0,pitch*H[2]-bob);
      const up=joint(lift?M4.mul(root,M4.T(0,lift,0)):root,H[0],H[1],H[2],th,0,0);B[2+k]=up;B[6+k]=joint(up,Kn[0],Kn[1],Kn[2],kn,0,0);
    }
    // tail: a lazy swish whose size wanders; the calf wags fast when happy. The tip follows a beat behind
    const fast=c.bull?0:clamp(al*0.7+h.wag,0,1),ws=mix(c.kind==='titan'?1.5:2.3,11.5,fast),wa=mix(0.1+0.22*max(0,drift(t*0.33,s+1)),0.7,fast),wp=c.bull?t*ws+s:(c.wp=(c.wp||0)+ws*(t-(c.pt||t)));c.pt=t;
    B[10]=joint(root,M.tailP[0],M.tailP[1],M.tailP[2],0.08*drift(t*0.8,s+4)+al*(c.bull?0.35:0.25)-a*0.15+h.tx,wa*sin(wp)+a*0.2*sin(TAU*cyc)+h.ty,0);
    B[11]=joint(B[10],M.tailP2[0],M.tailP2[1],M.tailP2[2],0.1*drift(t*0.8,s+4.6),wa*0.9*sin(wp-0.9)+h.ty*0.8,0);
    // ears: flop with each step, perk up when alert, flick now and then
    const ev=0.05*drift(t*1.1,s+9)+al*0.26-st*0.24*sin(2*TAU*cyc-0.9)-gz*0.2+h.ear;
    B[12]=joint(B[1],M.earP[0][0],M.earP[0][1],M.earP[0][2],0,0,ev+h.eL);B[13]=joint(B[1],M.earP[1][0],M.earP[1][1],M.earP[1][2],0,0,-(ev+h.eR));
    for(let k=0;k<CB;k++)boneU.set(B[k],o+k*16);
  }
}

'''
s=s[:a]+code+s[b:]
open('index.html','w').write(s);print(len(s))
