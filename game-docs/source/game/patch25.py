s=open('index.v24.html').read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(a[:70],s.count(a)); s=s.replace(a,b)
a=s.index('<script type="application/octet-stream" id="cr_calf"');b=s.index('<script>\n',a)
s=s[:a]+open('/home/claude/conv/critters.html').read()+s[b:]
# ---------- shader: 16 bones per creature, pelvis as parent of hind legs and tail, mane billow ----------
rep("uniform mat4 uBone[56];","uniform mat4 uBone[62];")
rep("int l=(b-14)%14,r=b-l;","int l=(b-14)%16,r=b-l;")
rep("uSnort[(b-14)/14]","uSnort[(b-14)/16]")
rep("      else if(fx>.5){float h=fx/127.,h2=h*h;","      else if(fx>99.5){float h=(fx-100.)/27.;p+=h*vec3(.05*sin(uTime*1.1+p.z*5.+p.y*3.),.035*sin(uTime*1.4+p.x*6.+p.z*4.),.04*sin(uTime*.9+p.y*5.+p.x*3.));}\n      else if(fx>.5){float h=fx/99.,h2=h*h;")
rep("int par=(l>=6&&l<=9)?b-4:(l==11?b-1:(l>=12?r+1:r));","int par=(l>=6&&l<=9)?b-4:(l==11?b-1:((l==12||l==13)?r+1:((l==4||l==5||l==10)?r+14:r)));")
rep("NBT=56","NBT=62")
# ---------- test meadow ----------
rep("const IA=24,IB=20,IN=3.2,WATER=-0.2,POND=[-7,13.5,5.5,3.8];","const WILD=!!window.WILD;const IA=24,IB=20,IN=3.2,WATER=-0.2,POND=WILD?[7,6,7.5,5]:[-7,13.5,5.5,3.8];")
rep("function terrH(x,z){let h=1.7*exp(","""function terrH(x,z){
  if(WILD){const g=(cx,cz,a,q)=>a*exp(-((x-cx)**2+(z-cz)**2)/q);   // test meadow: rolling hills, one steeper knoll, a lake
    let h=g(-12,-7,3.4,46)+g(13,-10,2.6,38)+g(-10,12,1.7,30)+g(17,9,2.0,26)+g(1,-15,1.3,60)+g(3.5,-6.5,1.5,7)+0.45*(n2(x*0.16+3,z*0.16+7)-0.5)+0.12*(n2(x*0.6,z*0.6)-0.5);
    const p=pondF(x,z);if(p<1.5)h=mix(h,-0.75,sm(1.5,0.55,p));return h;}
  let h=1.7*exp(""")
rep("function pathD(x,z){let d=","function pathD(x,z){if(WILD)return 9;let d=")
rep("const inPatch=(x,z)=>x>-4.7","const inPatch=(x,z)=>!WILD&&x>-4.7")
rep("function layout(){\n","""function wildLayout(){let k=0;const ok=(x,z)=>rimF(x,z)<0.8&&pondF(x,z)>1.7;
  for(let n=0;n<500&&k<44;n++){const x=(h3(n,1,77)*2-1)*IA*0.92,z=(h3(n,2,77)*2-1)*IB*0.92;if(!ok(x,z)||Math.hypot(x,z)<3.5)continue;const r=h3(n,3,77),sc=0.8+h3(n,4,77)*0.4;
    if(r<0.3){place(AS.rocks,x,z,r*20,sc);circ(x,z,0.65*sc);}else if(r<0.48){place(AS.oak,x,z,r*20,0.7+0.25*h3(n,5,77));circ(x,z,0.45);}
    else if(r<0.6){place(AS.pine,x,z,r*20,sc,{tint:TINT.pine});circ(x,z,0.4*sc);}else{place(AS['bush'+(n%3)],x,z,r*20,sc);circ(x,z,0.55*sc);}k++;}
}
function layout(){
  if(WILD){wildLayout();return;}
""")
rep("  const jobs=[","  let jobs=[")
rep("  for(let i=0;i<jobs.length;i++){const j=jobs[i];progress(j[1],0.02+0.5*i/jobs.length);","  if(WILD)jobs=jobs.filter(j=>['oak','pine','bush0','bush1','bush2','rocks','kid'].includes(j[0]));\n  for(let i=0;i<jobs.length;i++){const j=jobs[i];progress(j[1],0.02+0.5*i/jobs.length);")
rep("emitKid();spawnCrit('calf',-5.2,3.6,CALF);spawnCrit('bull',4.2,-8.6,BULL);spawnCrit('titan',-12.5,-11.5,TITAN);",
    "emitKid();{const SP=WILD?[[-3,3.5],[12.5,-9.5],[-11.5,-7]]:[[-5.2,3.6],[4.2,-8.6],[-12.5,-11.5]];spawnCrit('calf',SP[0][0],SP[0][1],CALF);spawnCrit('bull',SP[1][0],SP[1][1],BULL);spawnCrit('titan',SP[2][0],SP[2][1],TITAN);}")
rep("  SCN.town=snapshot({name:'Fernhollow'","  if(WILD){SCN.town=snapshot({name:'Test meadow',sub:'Grass, hills and a lake. The three bulls live here. You can wade the shallows.',h:terrH,blocked:(x,z)=>rimF(x,z)>0.9||terrH(x,z)<WATER-0.3,dist:22,pitch:0.58,exits:[]});return;}\n  SCN.town=snapshot({name:'Fernhollow'")
rep("  SCN.town.crit=true;setupGL();activate('town');","  SCN.town.crit=true;if(WILD){player.x=0;player.z=0;$('replay').style.display='none';}setupGL();activate('town');")
rep("  if(!window.KIDTEST)intro();","  if(!window.KIDTEST&&!WILD)intro();")
rep("for(let s=0;s<nseg;s++){const u=s/(nseg-1);mixc(cd,cl,u);shade(0,1,0,WAO,WSH,false,LD[0],LD[1],LD[2]);",
    "const q=0.2,gx=-(terrH(x+q,z)-terrH(x-q,z))/(2*q),gz=-(terrH(x,z+q)-terrH(x,z-q))/(2*q),gl2=sqrt(gx*gx+1+gz*gz);   // grass takes the light of the slope it grows on, so hills read as hills\n    for(let s=0;s<nseg;s++){const u=s/(nseg-1);mixc(cd,cl,u);shade(gx/gl2,1/gl2,gz/gl2,WAO,WSH,false,LD[0],LD[1],LD[2]);")
# ---------- creatures ----------
a=s.index("/* ---------- creatures made from 3D models ----------");b=s.index("/* ---------- palette (k-means over baked splat colours) ---------- */")
s=s[:a]+open('crit3.js').read()+"\n"+s[b:]
open('index.html','w').write(s)
w=s.replace('<script type="application/octet-stream" id="cr_calf"','<script>window.WILD=true</script>\n<script type="application/octet-stream" id="cr_calf"',1).replace('<title>Fernhollow Splat Town</title>','<title>Test Meadow</title>',1)
open('/home/claude/meadow/index.html','w').write(w);print(len(s),len(w))
