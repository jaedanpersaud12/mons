/* ---------- creatures made from 3D models ----------
   Splats are scattered over the mesh. Each belongs to one of 16 bones and carries a weight that blends it toward the parent bone, so joints bend instead of tearing.
   Bones: 0 chest, 1 head, 2-5 upper legs (FL FR BL BR), 6-9 lower legs, 10 tail, 11 tail tip, 12-13 ears, 14 hindquarters, 15 mane.
   Flames, steam, smoke and embers move in the vertex shader.
   Motion is layered: a gait that changes with speed, always-on idle drift, and one-shot actions picked at random with random gaps. A body action and a
   secondary one (snort, tail lash, ear flick) can run together, and every action eases in and out.
   Behaviour: each creature becomes aware of you gradually, looks before it turns, and then reacts in its own way. */
const CB=16,CRIT=[],shA=new Float32Array(16),shB=new Float32Array(16),snortU=new Float32Array(3).fill(9),GAL=[.45,.57,0,.12];
const CALF={kind:'calf',speed:0.85,runSpeed:2.7,ST:0.5,off:[0,.5,.5,0],F:0.6,K:1.1,range:3.5,notice:4.2,grazeP:0.4,grazeA:0.42,rad:0.42,bob:0.03,sway:0.03},
      TITAN={kind:'titan',speed:0.62,runSpeed:1.3,ST:0.66,off:[.25,.75,0,.5],F:0.32,K:0.95,range:4,notice:5.5,grazeP:0.3,grazeA:0.14,rad:1.05,bob:0.035,sway:0.055,bull:1},
      BULL={kind:'bull',speed:0.75,runSpeed:3.3,ST:0.62,off:[.25,.75,0,.5],F:0.4,K:1.05,range:4,notice:5,grazeP:0.35,grazeA:0.2,rad:0.62,bob:0.026,sway:0.05,bull:1};
function loadCrit(id){const el=document.getElementById('cr_'+id);if(!el)return null;const m=JSON.parse(el.dataset.meta),t=atob(el.textContent.trim()),b=new Uint8Array(t.length);
  for(let i=0;i<t.length;i++)b[i]=t.charCodeAt(i);m.q=new Uint16Array(b.buffer,0,m.n*3);m.c=b.subarray(m.n*6,m.n*10);m.bw=b.subarray(m.n*10,m.n*13);return m;}
function spawnCrit(id,x,z,o){
  const M=loadCrit(id);if(!M||CRIT.length>=3)return;const base=20+NB+CRIT.length*CB;curObj=0;
  for(let i=0;i<M.n;i++)push(M.mn[0]+M.q[i*3]/65535*M.ext[0],M.mn[1]+M.q[i*3+1]/65535*M.ext[1],M.mn[2]+M.q[i*3+2]/65535*M.ext[2],M.c[i*4]/255,M.c[i*4+1]/255,M.c[i*4+2]/255,M.c[i*4+3],M.bw[i*3+2]/255,base+M.bw[i*3],M.diam,M.bw[i*3+1]/255);
  if(M.nost)for(const p of M.nost)for(let n=0;n<44;n++){const g=0.78+rnd()*0.17;push(p[0],p[1],p[2],g,g*0.98,g*0.95,0,140/255,base+1,0.05+rnd()*0.03,rnd());}   // steam, let out when it snorts
  if(M.vent)for(let n=0;n<70;n++){const g=0.7+rnd()*0.2;push(M.vent[0]+(rnd()-.5)*.2,M.vent[1],M.vent[2]+(rnd()-.5)*.2,g,g*0.97,g*0.94,0,176/255,base,0.07+rnd()*0.05,rnd());}   // smoke rising off the hump
  if(M.tips)for(const p of M.tips)for(let n=0;n<6;n++)push(p[0]+(rnd()-.5)*.06,p[1]-rnd()*.08,p[2]+(rnd()-.5)*.06,1,0.62,0.16,1,224/255,base+1,0.04,rnd()); // a few slow embers
  CRIT.push(Object.assign({M,x,z,hx:x,hz:z,y:0,yaw:rnd()*6.28,phase:0,amt:0,run:0,v:0,w:0,turn:0,t:1+rnd()*2,mode:'idle',tx:x,tz:z,gz:0,al:0,stuck:0,seed:rnd()*10,pace:1,
    aware:0,look:0,anger:0,ign:0,fleeCD:0,sp:0,sr:0,wp:0,A:null,B:null,nA:1+rnd()*3,nB:1+rnd()*3,aw:1,snort:9,sl:0,L:M.hip[0][1]},o));
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
    h.hx+=cv(u,[[0,0],[.5,-.16],[.66,.3],[.84,.06],[1,0]]);h.roll+=(k?-1:1)*cv(u,[[0,0],[.3,.04],[.58,.04],[.7,0],[1,0]]);h.tx+=cv(u,[[0,0],[.5,.3],[.7,.1],[1,0]]);h.hip-=(k?-1:1)*cv(u,[[0,0],[.4,.05],[.7,0],[1,0]]);}},
  scrape:{d:[1.5,2.1],f(u,c,h){const e=edge(u,.18,.2),L=h.L[c.sl],n=2+(c.sd>0?1:0),q=2*PI*n*u;   // paw the ground
    L[0]+=e*(-.22+.5*sin(q));L[1]+=e*(.45+.4*cos(q));h.hx+=e*.2;h.dy-=e*.01;h.roll+=(c.sl?-1:1)*e*.025;h.tx+=e*.25;}},
  toss:{d:[1.0,1.3],f(u,c,h){h.hx+=cv(u,[[0,0],[.3,.3],[.55,-.42],[.76,-.08],[1,0]]);h.hz+=c.sd*cv(u,[[0,0],[.5,.2],[1,0]]);h.pitch+=cv(u,[[0,0],[.55,-.03],[1,0]]);h.ear+=cv(u,[[0,0],[.55,-.4],[.8,.2],[1,0]]);}},
  // --- lava bull ---
  slam:{d:[2.1,2.6],hit:0.69,f(u,c,h){   // rear up on the hind legs and crash down on both forelegs
    const th=cv(u,[[0,0],[.5,-.5],[.61,-.5],[.69,0],[1,0]]),kn=cv(u,[[0,0],[.45,1.1],[.6,.9],[.69,0],[1,0]]);h.L[0][0]+=th;h.L[1][0]+=th;h.L[0][1]+=kn;h.L[1][1]+=kn;
    h.pitch+=cv(u,[[0,0],[.14,.03],[.5,-.2],[.6,-.21],[.7,.06],[.83,-.012],[1,0]]);h.dy+=cv(u,[[0,0],[.14,-.03],[.55,.03],[.7,-.08],[.84,.015],[1,0]]);h.prx-=cv(u,[[0,0],[.5,-.12],[.7,.03],[1,0]]);
    h.hx+=cv(u,[[0,0],[.5,-.2],[.72,.36],[.88,.08],[1,0]]);h.tx+=cv(u,[[0,0],[.5,.45],[.75,.1],[1,0]]);h.L[2][1]+=cv(u,[[0,0],[.5,.25],[.7,0],[1,0]]);h.L[3][1]+=cv(u,[[0,0],[.5,.25],[.7,0],[1,0]]);}},
  sway:{d:[3.2,4.4],f(u,c,h){const e=edge(u,.2,.2);h.hx+=e*.16;h.hy+=e*.36*sin(2*PI*u)*c.sd;h.roll+=e*.02*sin(2*PI*u)*c.sd;h.hip-=e*.03*sin(2*PI*u)*c.sd;}},   // slow, low swing of the head
  rumble:{d:[1.3,1.7],hit:0.3,f(u,c,h){const e=bell(u);h.roll+=e*.012*sin(u*46);h.sq+=e*.02*sin(u*23);h.hx+=e*.1;h.dy-=e*.012;}},
  // --- calf ---
  hop:{d:[.6,.75],f(u,c,h){const a=sin(PI*u);h.dy+=.2*a;h.pitch-=.12*cos(PI*u)*a;h.hx-=.18*a;for(let k=0;k<4;k++){h.L[k][1]+=.95*a;h.L[k][0]+=(k<2?-.4:.45)*a;}h.tx+=.5*a;h.ear-=.6*cos(PI*u)*a;}},
  bow:{d:[1.6,2.2],f(u,c,h){const e=edge(u,.22,.25);h.pitch+=.26*e;h.dy-=.03*e;h.hx-=.42*e;h.L[0][0]-=.5*e;h.L[1][0]-=.5*e;h.wag+=e;h.tx+=.35*e;h.ear+=.25*e;}},   // play bow: chest down, rump up, tail going
  tilt:{d:[1.6,2.4],f(u,c,h){const e=edge(u,.2,.25);h.hz+=c.sd*.36*e;h.hx-=.08*e;h.ear+=.2*e;}},
  sniff:{d:[2.0,2.8],f(u,c,h){const e=edge(u,.2,.2);h.hx+=.4*e+.03*e*sin(u*40);h.hy+=.14*e*sin(u*9)*c.sd;}},
  // --- shared ---
  shake:{d:[.8,1.0],f(u,c,h){const e=bell(u),q=2*PI*3.5*u;h.hy+=e*.22*sin(q);h.hz+=e*.16*sin(q+1);h.roll+=e*.02*sin(q+.5);h.hip+=e*.03*sin(q-1);h.ear+=e*.35*sin(q+2);}},
  look:{d:[2.2,4.0],f(u,c,h){const e=edge(u,.16,.2);h.hy+=c.sd*.5*e;h.hx-=.05*e;h.ear+=.12*e;}},
  shift:{d:[2.4,3.4],f(u,c,h){const e=edge(u,.3,.3),k=c.sd>0?2:3;h.roll+=c.sd*.02*e;h.hip+=c.sd*.05*e;h.L[k][1]+=.45*e;h.L[k][0]-=.14*e;h.dy-=.006*e;}},   // rest a hind leg, hip dropped
  rest:{d:[9,15],f(u,c,h){const e=edge(u,.11,.1),br=sin(u*c.A.d*1.3);   // lie down: fold the legs under, sink onto the belly, breathe slowly, get back up
    h.dy-=c.L*0.56*e;h.nolift=e;for(let k=0;k<4;k++){h.L[k][0]-=(k<2?0.95:0.7)*e;h.L[k][1]+=(k<2?2.0:1.75)*e;}
    h.hx+=e*(0.1+0.03*br);h.sq+=e*0.012*br;h.pitch+=cv(u,[[0,0],[.06,.09],[.11,0],[.9,0],[.95,-.07],[1,0]]);h.tx-=e*.1;h.ear-=e*.1;h.calm=e;}},
  // --- secondary: can play on top of any of the above ---
  snort:{d:[.9,1.2],f(u,c,h){h.hx+=cv(u,[[0,0],[.15,-.06],[.3,.12],[.6,.03],[1,0]]);h.sq+=cv(u,[[0,0],[.15,.012],[.35,-.012],[1,0]]);}},
  lash:{d:[1.0,1.5],f(u,c,h){const e=bell(u);h.ty+=e*.75*sin(2*PI*2*u)*c.sd;h.tx+=e*.25;}},
  flick:{d:[.35,.5],f(u,c,h){h['e'+(c.sd>0?'L':'R')]+=bell(u)*.5;}},
  wag:{d:[1.2,2.0],f(u,c,h){h.wag+=edge(u,.2,.3);}}
};
const PICK={
  calf:{calm:{A:[['look',3],['tilt',2],['sniff',3],['shake',1],['shift',2],['hop',.6]],B:[['flick',4],['wag',2]]},alert:{A:[['hop',3],['bow',3],['tilt',3],['shake',1]],B:[['flick',2],['wag',3]]}},
  bull:{calm:{A:[['look',3],['shift',3],['shake',1.5],['scrape',1],['toss',1]],B:[['lash',3],['snort',2],['flick',3]]},alert:{A:[['stomp',4],['scrape',3],['toss',2],['shake',1]],B:[['snort',3],['lash',3],['flick',2]]}},
  titan:{calm:{A:[['look',2],['sway',3],['shift',3],['rumble',1]],B:[['lash',3],['snort',2]]},alert:{A:[['rumble',2],['sway',2],['scrape',2]],B:[['snort',3],['lash',2]]}}
};
function startAct(c,slot,id){const a=ACT[id];c[slot]={id,t:0,d:a.d[0]+rnd()*(a.d[1]-a.d[0]),hit:false,sd:rnd()<0.5?-1:1};if(id==='stomp'||id==='scrape')c.sl^=1;if(id==='snort')c.snort=0;}
function pickAct(c,slot){const L=PICK[c.kind][c.al>0.5?'alert':'calm'][slot];let tot=0;for(const e of L)tot+=e[1]*(e[0]===c['last'+slot]?0.25:1);let r=rnd()*tot;
  for(const e of L){r-=e[1]*(e[0]===c['last'+slot]?0.25:1);if(r<=0){c['last'+slot]=e[0];startAct(c,slot,e[0]);return;}}}
function stepCrits(dt){
  if(!SC.crit)return;
  const psp=Math.hypot(player.vx,player.vz);
  for(const c of CRIT){
    const dxp=player.x-c.x,dzp=player.z-c.z,dp=Math.hypot(dxp,dzp),toP=atan2(dxp,dzp);
    // awareness builds over a moment (faster if you are close or running) and fades slowly; it looks at you before it does anything else
    const seen=!cut.active&&dp<c.notice*(1+0.3*min(1,psp/5));
    c.aware+=((seen?1:0)-c.aware)*min(1,dt*(seen?0.9+2.2*sm(c.notice,1.2,dp)+psp*0.25:0.45));
    c.ign=max(0,c.ign-dt);c.fleeCD=max(0,c.fleeCD-dt);
    const engaged=c.aware>0.55&&(c.kind!=='titan'||(dp<3.4&&c.ign<=0)),lying=c.A&&c.A.id==='rest';
    if(lying&&c.aware>0.75&&c.kind!=='titan'&&c.A.t<c.A.d*0.86)c.A.t=c.A.d*0.9;   // get up if you come close
    c.t-=dt;let want=0,tyaw=c.yaw,fast=false;
    if(engaged&&!lying&&c.mode!=='watch'&&c.mode!=='charge'&&c.mode!=='flee'){
      if(c.kind==='calf'&&c.amt<0.3)startAct(c,'A','hop');
      if(c.kind==='titan'){startAct(c,'A',rnd()<0.6?'slam':'rumble');c.t=4.5;}else c.t=max(c.t,1.5);
      c.mode='watch';c.nA=min(c.nA,0.8+rnd());}
    if(c.mode==='watch'){
      tyaw=toP;
      if(c.kind==='calf'){   // friendly: trots up and keeps you company, but bolts a few steps if you rush it
        const closing=dp>1e-3?-(player.vx*dxp+player.vz*dzp)/dp:0;
        if(closing>4.2&&dp<2.8&&c.fleeCD<=0){c.mode='flee';c.t=0.9+rnd()*0.4;c.fleeCD=7;c.A=null;}
        else if(dp>1.75&&!c.A)want=c.speed*(dp>3.2?1.5:1);
        if(!engaged&&c.t<=0){c.mode='idle';c.t=1+rnd()*2;}
      }else if(c.kind==='bull'){   // territorial: squares up at a distance, gets angrier the longer you stay, then bluff-charges
        if(dp>3.3&&!c.A)want=c.speed*0.85;
        c.anger=clamp(c.anger+dt*(dp<3.8?0.35+0.5*sm(3.8,1.6,dp):-0.4),0,3);
        if(c.anger>2.2&&!c.A&&dp<4.5&&dp>1.9){c.mode='charge';c.t=1.5;c.anger=0.5;}
        if(!engaged&&c.t<=0){c.mode='idle';c.t=1+rnd()*2;}
      }else if(c.t<=0||(!c.A&&c.t<3)){c.mode='idle';c.ign=9;c.t=1.5+rnd()*2;}   // lava bull: one warning, then it goes back to what it was doing
    }
    else if(c.mode==='charge'){tyaw=toP;want=c.runSpeed;fast=true;if(dp<1.7||c.t<=0||c.stuck>0.3){c.mode='watch';c.t=2.5;startAct(c,'A','toss');if(rnd()<0.7)startAct(c,'B','snort');}}
    else if(c.mode==='flee'){tyaw=toP+PI;want=c.runSpeed;fast=true;if(c.t<=0){c.mode='watch';c.t=2;}}
    else{c.anger=max(0,c.anger-dt*0.3);
      if(c.mode==='walk'){const dx=c.tx-c.x,dz=c.tz-c.z;if(Math.hypot(dx,dz)<0.3||c.t<=0||c.stuck>0.6){c.mode=rnd()<c.grazeP?'graze':'idle';c.t=c.mode==='graze'?3+rnd()*5:2+rnd()*5;c.stuck=0;}else{want=c.speed*c.pace;tyaw=atan2(dx,dz);}}
      else if(c.t<=0&&!c.A){   // nothing to do: wander somewhere, or lie down for a while
        if(c.mode==='idle'&&rnd()<(c.kind==='titan'?0.3:0.16)&&c.aware<0.2){startAct(c,'A','rest');c.t=c.A.d+1+rnd()*2;}
        else{const a=rnd()*PI*2,r=1.2+rnd()*c.range;c.tx=c.hx+cos(a)*r;c.tz=c.hz+sin(a)*r;c.mode='walk';c.t=10;c.pace=0.65+rnd()*0.4;}}}
    // turn first, then go: speed only builds once it is facing roughly the right way
    let da=tyaw-c.yaw;da=atan2(sin(da),cos(da));const still0=c.A&&!fast?0.35:1,mt=dt*(c.kind==='titan'?1.1:c.bull?(fast?3.2:1.7):(fast?5:3))*still0,dy=clamp(da*min(1,dt*4),-mt,mt);c.yaw+=dy;
    c.w+=(dy/max(dt,1e-3)-c.w)*min(1,dt*7);c.turn+=(min(1,abs(c.w)/1.1)-c.turn)*min(1,dt*6);
    c.v+=(want*sm(fast?0.2:0.55,0.95,cos(da))-c.v)*min(1,dt*(fast?3.5:want?2.2:4));
    if(c.v>0.02){let [nx,nz]=collide(c.x+sin(c.yaw)*c.v*dt,c.z+cos(c.yaw)*c.v*dt);
      if(SC.blocked(nx,nz)||SC.h(nx,nz)<WATER+0.04||Math.hypot(nx-player.x,nz-player.z)<c.rad+0.32){nx=c.x;nz=c.z;}
      if(Math.hypot(nx-c.x,nz-c.z)<c.v*dt*0.4)c.stuck+=dt;else c.stuck=0;c.x=nx;c.z=nz;}
    c.run+=(sm(c.speed*1.3,c.runSpeed*0.8,c.v)-c.run)*min(1,dt*6);
    const F=mix(c.F,c.F*1.25+0.12,c.run),ST=mix(c.ST,0.42,c.run),stride=2*c.L*sin(F)/ST*(1+0.9*c.run);
    c.amt+=(min(1,c.v/c.speed)-c.amt)*min(1,dt*6);c.phase+=dt*(c.v/stride+c.turn*(1-c.amt)*1.15);
    c.gz+=((c.mode==='graze'?1:0)-c.gz)*min(1,dt*2);c.al+=((c.mode==='watch'||c.mode==='charge'?1:0)-c.al)*min(1,dt*2.5);c.snort+=dt;
    let lk=c.aware>0.2&&!lying?clamp(atan2(sin(toP-c.yaw),cos(toP-c.yaw)),-1.05,1.05)*min(1,c.aware*1.6):0;c.look+=(lk-c.look)*min(1,dt*4.5);
    // actions: body slot A only while standing; secondary slot B any time. Random gaps, shorter when it is watching you
    const still=c.amt<0.1&&c.v<0.06&&c.gz<0.3&&abs(c.w)<0.4&&c.mode!=='charge'&&c.mode!=='flee';c.aw+=((c.amt<0.2?1:0)-c.aw)*min(1,dt*5);
    for(const slot of ['A','B']){const cur=c[slot],nk='n'+slot;
      if(cur){cur.t+=dt;const a=ACT[cur.id];if(a.hit&&!cur.hit&&cur.t/cur.d>=a.hit){cur.hit=true;if(rnd()<0.75)startAct(c,'B','snort');}
        if(cur.t>=cur.d){c[slot]=null;c[nk]=c.al>0.5?0.7+rnd()*2.4:(slot==='A'?2+rnd()*5.5:1.5+rnd()*5);}}
      else{c[nk]-=dt;if(c[nk]<=0&&(slot==='B'||still))pickAct(c,slot);}}
    const m=c.rad+0.3;if(dp<m&&dp>1e-4&&!cut.active){player.x=c.x+dxp/dp*m;player.z=c.z+dzp/dp*m;}
  }
}
// one leg over its cycle: planted and pushing back until ST, then it folds at the knee, lifts and reaches forward
function legAt(cc,ST,F,K,a){
  if(cc<ST){const u=cc/ST;return [a*F*(2*u-1),a*0.1*sin(u*PI)];}
  const u=(cc-ST)/(1-ST),e=u*u*(3-2*u);return [a*F*(1-2*e)-a*0.14*sin(u*PI),a*K*sin(PI*pow(u,0.75))];
}
function poseCrits(t){
  shA.fill(0);shB.fill(0);
  shA.set([player.x,player.z,player.y,player.yaw],0);shB.set([0.36/(1+player.jy*0.4),0.3/(1+player.jy*0.4),0.42/(1+player.jy*1.5),0],0);
  for(let i=0;i<CRIT.length;i++){
    const c=CRIT[i],M=c.M,o=(NB+i*CB)*16;
    if(!SC.crit){boneU.fill(0,o,o+CB*16);snortU[i]=9;continue;}
    const sy=sin(c.yaw),cy=cos(c.yaw);c.y=SC.h(c.x,c.z);snortU[i]=min(9,c.snort);
    // stand square on a slope: tip the body to match the ground under its front and back, left and right
    {const dl=M.len*0.3,dw=M.wid*0.25,hf=SC.h(c.x+sy*dl,c.z+cy*dl),hb=SC.h(c.x-sy*dl,c.z-cy*dl),hl=SC.h(c.x+cy*dw,c.z-sy*dw),hr=SC.h(c.x-cy*dw,c.z+sy*dw);
      c.sp+=(atan2(hb-hf,2*dl)-c.sp)*0.12;c.sr+=(atan2(hl-hr,2*dw)-c.sr)*0.12;c.y=max(c.y,(hf+hb)*0.5);}
    shA.set([c.x-sy*M.len*0.04,c.z-cy*M.len*0.04,c.y,c.yaw],(i+1)*4);shB.set([M.wid*0.4,M.len*0.44,0.45,0],(i+1)*4);
    const a=c.amt,run=c.run,s=c.seed,turn=c.turn*(1-a),st=max(a,0.55*turn),cyc=fract(c.phase),al=c.al,gz=c.gz,TAU=2*PI,breath=sin(t*1.5+s)+0.3*sin(t*0.4+s*2);
    // gather the one-shot actions into pose offsets
    const h={hx:0,hy:0,hz:0,pitch:0,roll:0,dy:0,tx:0,ty:0,ear:0,eL:0,eR:0,wag:0,sq:0,hip:0,prx:0,nolift:0,calm:0,L:[[0,0],[0,0],[0,0],[0,0]]};
    if(c.A){c.sd=c.A.sd;ACT[c.A.id].f(c.A.t/c.A.d,c,h);}
    if(c.aw<0.999){for(const k of ['hx','hy','hz','pitch','roll','dy','tx','sq','hip','prx','nolift'])h[k]*=c.aw;for(const L of h.L){L[0]*=c.aw;L[1]*=c.aw;}}
    if(c.B){c.sd=c.B.sd;ACT[c.B.id].f(c.B.t/c.B.d,c,h);}
    const calm=(1-a)*(1-gz)*(1-h.calm),relax=c.kind==='bull'?(1-al)*(1-run):0;
    // gait: walk (or trot) blends toward a gallop as it speeds up: shorter ground contact, longer reach, legs gathered, the back flexing
    const F=mix(c.F,c.F*1.25+0.12,run),ST=mix(c.ST,0.42,run),K=mix(c.K,1.45,run),gal=sin(TAU*cyc+1.2);
    const bob=st*c.bob*(1+2.4*run)*(0.5-0.5*cos(2*TAU*cyc))+0.004*breath+h.dy;
    const dyn=st*0.022*sin(2*TAU*cyc+1)*(1-run)+run*0.085*gal+gz*0.03+h.pitch,pitch=dyn+c.sp,
          rollD=a*c.sway*0.6*sin(TAU*cyc)*(1-run)-clamp(c.w,-2.5,2.5)*(0.04+0.05*run)*(a+0.35)+calm*0.014*drift(t*0.45,s)+h.roll,roll=rollD+c.sr;
    const root=M4.mul(M4.T(c.x,c.y+bob,c.z),M4.mul(M4.Y(c.yaw),M4.mul(M4.X(pitch),M4.mul(M4.Z(roll),M4.S(1+0.006*breath-h.sq*0.5,1+0.011*breath+h.sq,1+h.sq*0.3)))));
    const B=[root];
    // hindquarters: hips sway opposite the shoulders as it walks, the spine curves into a turn, flexes in a gallop, and one hip drops when it rests a leg
    B[14]=joint(root,M.pelP[0],M.pelP[1],M.pelP[2],-run*0.13*gal+h.prx,-clamp(c.w,-2.5,2.5)*0.11+st*0.05*sin(TAU*cyc+PI)*(1-run),-a*c.sway*sin(TAU*cyc+0.5)*(1-run)+calm*0.02*drift(t*0.31,s+11)+h.hip);
    // head: looks at you before the body turns, nods with each step, leads into turns, drops to graze, drifts when idle; a calm bull carries it higher
    const hx=gz*(c.grazeA+0.04*sin(t*3.1+s))+st*0.055*sin(2*TAU*cyc+0.5)*(1-run)-run*0.07*gal+0.012*breath+calm*0.03*drift(t*0.4,s+3)+al*(c.bull?0.16:-0.12)-relax*0.13-(c.bull?0:abs(c.look)*0.08)+h.hx,
          hy=calm*0.07*drift(t*0.5,s)+clamp(c.w*0.28,-0.5,0.5)+gz*0.07*sin(t*2.3+s)+c.look*(1-gz*0.6)+h.hy,hz=calm*0.02*drift(t*0.3,s+7)+c.look*0.12+h.hz;
    B[1]=joint(root,M.neck[0],M.neck[1],M.neck[2],hx,hy,hz);
    for(let k=0;k<4;k++){
      const off=mix(c.off[k],GAL[k],run),lg=legAt(fract(cyc+off),ST,F,K,st),th=lg[0]+h.L[k][0]+(k<2?relax*0.15:0),kn=max(0,lg[1]+h.L[k][1]);
      // a leg that already slants would dig into the ground as it swings through vertical, and a dipping body pushes its feet down: lift the leg by that much
      const H=M.hip[k],Kn=M.knee[k],phi=atan2(H[2]-Kn[2],H[1]-Kn[1]),Lr=H[1]/cos(phi),sink=max(0,Lr*(cos(phi+th)-cos(phi))),lift=(sink+max(0,dyn*H[2]-bob))*(1-h.nolift);
      const par=k<2?root:B[14],up=joint(lift?M4.mul(par,M4.T(0,lift,0)):par,H[0],H[1],H[2],th,0,0);B[2+k]=up;B[6+k]=joint(up,Kn[0],Kn[1],Kn[2],kn,0,0);
    }
    // tail: a lazy swish whose size wanders; the calf wags fast when happy, a running animal streams it out behind. The tip follows a beat behind
    const fastW=c.bull?0:clamp(al*0.7+h.wag,0,1),ws=mix(c.kind==='titan'?1.5:2.3,11.5,fastW),wa=mix(0.1+0.22*max(0,drift(t*0.33,s+1)),0.7,fastW)*(1-0.6*run);c.wp+=ws*min(0.1,max(0,t-(c.pt||t)));c.pt=t;
    B[10]=joint(B[14],M.tailP[0],M.tailP[1],M.tailP[2],0.08*drift(t*0.8,s+4)+al*(c.bull?0.35:0.25)-a*0.15+run*0.55+h.tx,wa*sin(c.wp)+a*0.2*sin(TAU*cyc)+clamp(c.w,-2,2)*0.2+h.ty,0);
    B[11]=joint(B[10],M.tailP2[0],M.tailP2[1],M.tailP2[2],0.1*drift(t*0.8,s+4.6)+run*0.2,wa*0.9*sin(c.wp-0.9)+h.ty*0.8+clamp(c.w,-2,2)*0.15,0);
    // ears: flop with each step, perk up when alert, pin back in a run, flick now and then
    const ev=0.05*drift(t*1.1,s+9)+al*0.26-st*0.24*sin(2*TAU*cyc-0.9)-gz*0.2-run*0.35+h.ear;
    B[12]=joint(B[1],M.earP[0][0],M.earP[0][1],M.earP[0][2],0,0,ev+h.eL);B[13]=joint(B[1],M.earP[1][0],M.earP[1][1],M.earP[1][2],0,0,-(ev+h.eR));
    // mane: trails a little behind the body's own motion
    B[15]=joint(root,M.maneP[0],M.maneP[1],M.maneP[2],-dyn*1.3+0.02*breath-run*0.06,0,-rollD*1.3);
    for(let k=0;k<CB;k++)boneU.set(B[k],o+k*16);
  }
}
