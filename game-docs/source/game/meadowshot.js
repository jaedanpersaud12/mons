const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));page.on('console',m=>{if(m.type()==='error')console.log('[c]',m.text())});
  await page.goto('file:///home/claude/meadow/index.html');
  await page.waitForFunction('window.__ready===true || /Could not/.test(document.getElementById("loadmsg").textContent)', null, { timeout: 500000 });
  console.log('bake', await page.evaluate('window.__bakeMs+" "+document.getElementById("loadmsg").textContent+" crit="+CRIT.length+" N="+SCN.town.N+" cut="+cut.active'));
  console.log(await page.evaluate(`JSON.stringify(CRIT.map(c=>[c.kind,c.x.toFixed(1),c.z.toFixed(1),SC.h(c.x,c.z).toFixed(2),SC.blocked(c.x,c.z)]))`));
  await page.evaluate('window.__perf.hold=1e9;stepCrits=function(){};');
  const shots=[[-6,-2,2.4,26],[-1.5,2.5,0.7,13]];let i=0;
  for(const [x,z,yaw,d] of shots){
    await page.evaluate(`Object.assign(player,{x:${x},z:${z},vx:0,vz:0});player.y=SC.h(player.x,player.z);cam.tx=player.x;cam.tz=player.z;cam.ty=player.y+0.9;SC.dist=${d};cam.dist=${d};window.__state.yaw=${yaw};`);
    await page.waitForTimeout(9000);await page.screenshot({path:`mw${i++}.png`,clip:{x:0,y:0,width:1060,height:800},timeout:200000});}
  await browser.close();
})();
