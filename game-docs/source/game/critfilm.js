const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 800 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));page.on('console',m=>{if(m.type()==='error')console.log('[c]',m.text())});
  await page.addInitScript(() => { window.KIDTEST = true; });
  await page.goto('file:///home/claude/splat-town/index.html');
  await page.waitForFunction('window.__ready===true || /Could not/.test(document.getElementById("loadmsg").textContent)', null, { timeout: 180000 });
  console.log('bake', await page.evaluate('document.getElementById("loadmsg").textContent+" "+CRIT.length+" "+N+" maxU="+gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)'));
  await page.evaluate(`(()=>{window.__state.pixel=false;window.__state.pitch=0.12;SC.dist=7.5;window.__perf.hold=1e9;window.__state.cut=false;const P=window.__player;P.x=-8;P.z=-2;
    stepCrits=function(){};stepPlayer=function(){return false;};const _p=poseCrits;poseCrits=function(t){if(window.__T!==undefined)tNow=window.__T;_p(tNow);};
    CRIT[0].x=-9.6;CRIT[0].z=-2;CRIT[1].x=-6.5;CRIT[1].z=-2;if(CRIT[2]){CRIT[2].x=-8;CRIT[2].z=-4.6;}})()`);
  const Z={amt:0,phase:0,gz:0,al:0,yaw:1.5708,w:0,turn:0,joy:0};
  const sets={walk:[0,1,2,3,4,5,6,7].map(k=>[{...Z,amt:1,phase:k/8},20,0]),
    alert:[4.05,4.3,4.6,4.9,5.0,5.1,5.35,5.6,5.9,6.2].map(t=>[{...Z,al:1,yaw:0.9},20+t,0]),
    stomp:[4.05,4.4,4.6,4.75,4.9,4.97,5.03,5.15,5.4,5.55,5.7,5.9].map(t=>[{...Z,al:1,yaw:-1.5708},20+t,0]),
    all:[[{...Z,amt:1,phase:.15,yaw:1.2},24.2,0],[{...Z,amt:1,phase:.55,yaw:1.2},24.4,0],[{...Z,al:1,yaw:0.5},24.6,0],[{...Z,al:1,yaw:0.5},25.3,0]],
    acts:[0,.14,.3,.45,.56,.63,.72,.86].map(u=>[{...Z,al:1,yaw:1.25,__u:u},30+u,0]),
    gait:[0,.125,.25,.375,.5,.625,.75,.875].map(u=>[{...Z,amt:1,phase:u,yaw:1.35,__g:1},40,0]),
    rest:[.03,.07,.11,.5,.93,.97].map(u=>[{...Z,yaw:1.1,__r:u},41,0]),
    misc:[[{...Z,gz:1},20,0],[{...Z,turn:1,w:1.5,phase:.3},20,0],[{...Z,turn:1,w:-1.5,phase:.8,yaw:0},20,0],[{...Z,al:1,joy:.75,yaw:0.9},20.2,0],[{...Z,al:1,joy:.5,yaw:0.9},20.3,0],[{...Z,al:1,joy:.2,yaw:0.9},20.4,0],[{...Z,yaw:2.6},21,0],[{...Z,yaw:-0.6},23.3,0]]};
  if(['all','acts','gait','rest'].includes(process.argv[2]))await page.evaluate('SC.dist=10;window.__state.pitch=0.25;');
  if(process.argv[2]==='stomp')await page.evaluate('CRIT[1].x=-6.0;');
  for(const name of (process.argv[2]||'walk,alert,misc').split(',')){let i=0;
    for(const [pose,T,camyaw] of sets[name]){
      await page.evaluate(`for(const c of CRIT)Object.assign(c,${JSON.stringify(pose)});if(${pose.__g===1}){CRIT[1].run=1;CRIT[1].amt=1;CRIT[0].run=1;CRIT[2].run=0;for(const c of CRIT)c.A=null;}if(${pose.__r!==undefined}){for(const c of CRIT){c.run=0;c.A={id:'rest',t:${pose.__r||0}*10,d:10,sd:1};}}if(${pose.__u!==undefined}){const u=${pose.__u||0};CRIT[0].A={id:'bow',t:u,d:1,sd:1};CRIT[1].sl=1;CRIT[1].A={id:'stomp',t:u,d:1,sd:1};CRIT[1].snort=u>.63?(u-.63)*1.6:9;CRIT[2].A={id:'slam',t:u,d:1,sd:1};CRIT[2].snort=u>.69?(u-.69)*2.3:9;}window.__T=${T};window.__state.yaw=${camyaw}+0.0001;window.__state.yawV=0`);await page.waitForTimeout(i===0?3000:900);
      await page.screenshot({path:`cf_${name}${i}.png`,clip:['all','acts','gait','rest'].includes(name)?{x:60,y:100,width:1200,height:600}:name==='stomp'?{x:640,y:230,width:620,height:440}:{x:60,y:230,width:1200,height:440}});i++;}
    console.log(name,i);}
  await browser.close();
})();
