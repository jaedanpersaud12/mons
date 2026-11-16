s=open('index.v25.html').read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(a[:70],s.count(a)); s=s.replace(a,b)
# sculpted greenery builders
rep("function bush(cx,cy,cz,s,flower){",r'''// ---- sculpted greenery: grass, flowers and reeds built as solid shapes, so they are lit and clumped the same way the trees and bushes are ----
function tuft(seed,R,H,n,lean){   // a clump of grass: tapered blades leaning out from one root, fused at the base
  const Lb=[];for(let i=0;i<n;i++){const a=i*2.399+h3(seed,i,1)*0.9,q=sqrt((i+0.5)/n),l=lean*(0.25+0.9*q)*(0.8+0.4*h3(seed,i,2)),hh=H*(1.05-0.45*q)*(0.8+0.4*h3(seed,i,3)),bx=cos(a)*R*0.55*q,bz=sin(a)*R*0.55*q;
    Lb.push([bx,bz,bx+cos(a)*sin(l)*hh,cos(l)*hh,bz+sin(a)*sin(l)*hh,0.05+0.035*h3(seed,i,4)]);}
  P((x,y,z)=>{let d=sdEll(x,y,z,R*0.75,H*0.22,R*0.75);for(const b of Lb)d=smin(d,sdCap(x,y,z,b[0],0,b[1],b[2],b[3],b[4],b[5],0.012),0.035);return d*0.8;},M.LEAF,0,H*0.5,0,max(R,H)*1.3+0.1,
    {sway:0.4,paint:(x,y,z,nx,ny,nz)=>{const u=clamp(y/H,0,1),t=clamp(pow(u,0.75)*0.9+0.12*ny+(n2(x*9+seed,z*9)-0.5)*0.18,0,1);if(t>0.86)mixc(K.TF_L,K.TF_T,(t-0.86)/0.14);else mixc(K.TF_D,K.TF_L,t/0.86);}});
}
function flowerClump(col,seed){   // a leafy base with a handful of blossoms on short stems
  const S=[];for(let i=0;i<6;i++){const a=i*2.4+h3(seed,i,5),r=0.06+0.2*h3(seed,i,6);S.push([cos(a)*r,0.17+0.2*h3(seed,i,7),sin(a)*r]);}
  P((x,y,z)=>sdEll(x,y-0.03,z,0.3,0.1,0.3)+0.02*sin(x*20)*sin(z*20),M.LEAF,0,0.03,0,0.4,{sway:0.2,paint:(x,y,z,nx,ny)=>mixc(K.TF_D,K.TF_L,clamp(0.3+0.5*ny,0,1))});
  for(const q of S){P((x,y,z)=>sdCap(x,y,z,q[0]*0.6,0.04,q[2]*0.6,q[0],q[1],q[2],0.016,0.013),M.VINE,q[0],q[1]*0.5,q[2],q[1]*0.6+0.06,{sway:0.5,paint:()=>setc(K.TF_D,1.15)});
    P((x,y,z)=>sdEll(x-q[0],y-q[1],z-q[2],0.065,0.048,0.065),M.CLOTH,q[0],q[1],q[2],0.11,{sway:0.6,paint:(x,y,z)=>{const d=Math.hypot(x-q[0],z-q[2]);setc(d<0.024&&y>q[1]?(col===K.YELLOW?K.WHITE:K.YELLOW):col,1.05);}});}
}
function reedClump(seed){   // tall stems at the water's edge, some with brown heads
  for(let i=0;i<7;i++){const a=i*2.4+h3(seed,i,1),r=0.05+0.16*h3(seed,i,2),hh=0.7+0.5*h3(seed,i,3),lx=(h3(seed,i,4)-.5)*0.25,lz=(h3(seed,i,5)-.5)*0.25,bx=cos(a)*r,bz=sin(a)*r;
    P((x,y,z)=>sdCap(x,y,z,bx,0,bz,bx+lx,hh,bz+lz,0.03,0.013),M.VINE,bx,hh/2,bz,hh/2+0.12,{sway:0.6,paint:(x,y,z)=>mixc(K.TF_D,K.TF_L,clamp(y/hh*0.7,0,1))});
    if(i%2===0)P((x,y,z)=>sdCap(x,y,z,bx+lx*0.8,hh*0.8,bz+lz*0.8,bx+lx,hh,bz+lz,0.042,0.036),M.CLOTH,bx+lx,hh*0.9,bz+lz,0.18,{sway:0.6,paint:()=>setc(K.BARK,1.15)});}
}
function bush(cx,cy,cz,s,flower){''')
# colours
a=s.index("const K={");b=s.index("};",a)+2
s=s[:b]+"\nK.TF_D=C(0x44853c);K.TF_L=C(0xa2d45a);K.TF_T=C(0xc8e470);K.GR1=C(0x5aa043);K.GR2=C(0x7fbf50);K.GTIP=C(0xbfe26a);"+s[b:]
# per-instance colour multiplier
rep("    if(A.fl[i*4+2])push(q.x+sc*(c*x+s*z),q.y+sc*y,q.z+sc*(-s*x+c*z),cr,cg,cb,em,A.sw[i],A.fl[i*4+3],A.dm[i]*sc*1.25,rnd(),undefined,0,0,2);",
    "    if(q.mul){cr*=q.mul[0];cg*=q.mul[1];cb*=q.mul[2];}\n    if(A.fl[i*4+2])push(q.x+sc*(c*x+s*z),q.y+sc*y,q.z+sc*(-s*x+c*z),cr,cg,cb,em,A.sw[i],A.fl[i*4+3],A.dm[i]*sc*1.25,rnd(),undefined,0,0,2);")
# darker, broader-patched ground under the tufts
rep("  mixc(K.GRASS_D,K.GRASS_L,clamp(n2(x*0.4,z*0.4)*1.3-0.15+(n2(x*1.7+3,z*1.7+9)-0.5)*0.5,0,1));",
    "  if(WILD)mixc(K.GR1,K.GR2,clamp(0.5+1.1*(n2(x*0.09+5,z*0.09+9)-0.5)+0.3*(n2(x*0.33,z*0.33)-0.5),0,1));\n  else mixc(K.GRASS_D,K.GRASS_L,clamp(n2(x*0.4,z*0.4)*1.3-0.15+(n2(x*1.7+3,z*1.7+9)-0.5)*0.5,0,1));")
# assets
rep("  if(WILD)jobs=jobs.filter(j=>['oak','pine','bush0','bush1','bush2','rocks','kid'].includes(j[0]));",
'''  if(WILD){jobs=jobs.filter(j=>['oak','pine','bush0','bush1','bush2','rocks','kid'].includes(j[0]));const Fo={G:0.03,dens:900,diam:0.05};
    jobs.unshift(
      ['flw0','Growing flowers',()=>flowerClump(K.WHITE,4),[-0.45,-0.08,-0.45],[0.45,0.5,0.45],Fo],['flw1','Growing flowers',()=>flowerClump(K.YELLOW,5),[-0.45,-0.08,-0.45],[0.45,0.5,0.45],Fo],['flw2','Growing flowers',()=>flowerClump(K.PINK,6),[-0.45,-0.08,-0.45],[0.45,0.5,0.45],Fo],
      ['reed','Growing reeds',()=>reedClump(7),[-0.5,-0.1,-0.5],[0.5,1.4,0.5],{G:0.035,dens:700,diam:0.06}]);}''')
# scatter them in the meadow, in place of the loose blades, dots and sticks
rep("  for(let n=0;n<95000;n++){\n","""  if(WILD){
    // Stylised grass, the way games do it: one dense, even field. Every blade takes its root colour from the ground under it and fades to a lighter tip,
    // and is lit by the slope it stands on instead of on its own, so the whole field shades as one soft surface. Length varies smoothly; nothing is on or off.
    const E=(A,x,z,sc,rot,y)=>{const h=y===undefined?terrH(x,z)-0.02:y;worldShade(x,h,z);const k=0.5+0.5*WSH;emit({A,x,y:h,z,rot,sc,flat:1,mul:[k,k,k]});};
    curObj=0;const q=0.2,NB2=190000;
    for(let n=0;n<NB2;n++){if((n&16383)===16383){progress('Growing grass',0.88+0.08*n/NB2);await tick();}
      const x=(rnd()*2-1)*IA,z=(rnd()*2-1)*IB;if(rimF(x,z)>0.97)continue;const h=terrH(x,z);if(h<WATER+0.03)continue;
      if(groundCol(x,z)===1)continue;const b0=cr,b1=cg,b2=cb,tall=inTall(x,z),hg=tall?0.42+0.3*rnd():0.11+0.2*n2(x*0.13+40,z*0.13+7)+0.07*rnd(),ph=rnd(),jit=0.97+0.06*rnd();
      worldShade(x,h,z);const gx=-(terrH(x+q,z)-terrH(x-q,z))/(2*q),gz=-(terrH(x,z+q)-terrH(x,z-q))/(2*q),gl=sqrt(gx*gx+1+gz*gz),ao=max(WAO,0.82),sh=0.42+0.58*WSH,la=rnd()*6.28,lr=0.05+0.08*rnd();
      for(let s2=0;s2<3;s2++){const u=s2/2,t=u*0.6;cr=(b0+(K.GTIP[0]-b0)*t)*jit;cg=(b1+(K.GTIP[1]-b1)*t)*jit;cb=(b2+(K.GTIP[2]-b2)*t)*jit;
        shade(gx/gl,1/gl,gz/gl,ao,sh,false,LD[0],LD[1],LD[2]);push(x+cos(la)*lr*u,h+0.03+hg*u,z+sin(la)*lr*u,cr,cg,cb,0,0.12+0.55*u,0,max(0.2,hg*0.8+0.07),ph,undefined,0,0,1);}}
    for(let b=0;b<42;b++){const bx=(rnd()*2-1)*IA*0.88,bz=(rnd()*2-1)*IB*0.88,kind=b%3,cn=4+((rnd()*6)|0);
      for(let q=0;q<cn;q++){const a=rnd()*6.28,r=sqrt(rnd())*1.3,x=bx+cos(a)*r,z=bz+sin(a)*r;if(rimF(x,z)>0.93||pondF(x,z)<1.3)continue;E(AS['flw'+(rnd()<0.8?kind:(kind+1)%3)],x,z,0.8+rnd()*0.5,rnd()*6.28);}}
    for(let n=0;n<54;n++){const a=rnd()*PI*2,r=sqrt(0.99+rnd()*0.2),x=POND[0]+cos(a)*POND[2]*r,z=POND[1]+sin(a)*POND[3]*r;E(AS.reed,x,z,0.8+rnd()*0.5,rnd()*6.28,max(terrH(x,z),WATER)-0.03);}
  }
  for(let n=0;n<(WILD?0:95000);n++){
""")
rep("  for(let n=0;n<26000;n++){const x=(rnd()<0.5?-1:1)*(1.6+rnd()*5.7)","  for(let n=0;n<(WILD?0:26000);n++){const x=(rnd()<0.5?-1:1)*(1.6+rnd()*5.7)")
rep("  for(let n=0;n<7000;n++){\n    const b=beds[","  for(let n=0;n<(WILD?0:7000);n++){\n    const b=beds[")
rep("  for(let n=0;n<420;n++){const a=rnd()*PI*2,r=sqrt(0.98+rnd()*0.2)","  for(let n=0;n<(WILD?0:420);n++){const a=rnd()*PI*2,r=sqrt(0.98+rnd()*0.2)")
rep("    groundCol(x,z);shade(nx,ny,nz,WAO,WSH,false,LD[0],LD[1],LD[2]);warm(x,z);push(x,h,z,cr,cg,cb,0,0,0,0.17,rnd(),nx,ny,nz);",
    "    groundCol(x,z);if(WILD)shade(nx,ny,nz,max(WAO,0.82),0.42+0.58*WSH,false,LD[0],LD[1],LD[2]);else shade(nx,ny,nz,WAO,WSH,false,LD[0],LD[1],LD[2]);warm(x,z);push(x,h,z,cr,cg,cb,0,0,0,0.17,rnd(),nx,ny,nz);")
# wind passing over the field lightens and darkens it in moving bands
rep("    p.x+=sw*w*.09;","    p.x+=sw*w*.09;c.rgb*=1.+sw*w*.07;")
# loose blades that remain take the tuft colours
rep("    blade(x,z,0.1+0.17*rnd(),K.GRASS_D,K.GRASS_L,0.45,2);","    if(WILD)blade(x,z,0.1+0.2*rnd(),K.TF_D,K.TF_L,0.45,2);else blade(x,z,0.1+0.17*rnd(),K.GRASS_D,K.GRASS_L,0.45,2);")
rep('float w=exp(-7.*r2);gl_FragDepth=dz(zv);','float w=exp(-7.*r2)+.006;gl_FragDepth=dz(zv);')
rep('>=3.){s=a+b+e+g;em=0.;}}','>=2.){s=a+b+e+g;em=0.;}}')
open('index.html','w').write(s)
w=s.replace('<script type="application/octet-stream" id="cr_calf"','<script>window.WILD=true</script>\n<script type="application/octet-stream" id="cr_calf"',1).replace('<title>Fernhollow Splat Town</title>','<title>Test Meadow</title>',1)
open('/home/claude/meadow/index.html','w').write(w);print(len(s),len(w))
