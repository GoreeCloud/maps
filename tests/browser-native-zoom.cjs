/**
 * Genuine Chromium 200% and 400% browser zoom QA on an isolated Linux Xvfb.
 * Method adapted from GoreeCloud/gc-ui/scripts/qa-real-browser-zoom.mjs (Apache-2.0).
 * NOT screen-reader, Firefox, Safari, Android, iOS, or manual zoom acceptance.
 */
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {mkdir,stat}=require('node:fs/promises');
const {resolve}=require('node:path');
const {chromium}=require('playwright');
const evidence=resolve(process.env.MAPS_BROWSER_EVIDENCE||'browser-evidence');
if(process.platform!=='linux'||!process.env.DISPLAY||process.env.GC_MAPS_ISOLATED_DISPLAY!=='1'){
  throw new Error('Native zoom QA requires GC_MAPS_ISOLATED_DISPLAY=1 in a dedicated Linux Xvfb session');
}
const helper=resolve(__dirname,'qa-x11-zoom.py');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+FQAAAABJRU5ErkJggg==','base64');

async function main(){
  const {createMapsServer}=await import('../server/app.mjs');
  await mkdir(evidence,{recursive:true});
  const server=createMapsServer({env:{},distDir:resolve('dist')});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const base='http://127.0.0.1:'+server.address().port;
  let browser=null;
  try{
    browser=await chromium.launch({headless:false,args:['--window-size=1280,800','--ozone-platform=x11']});
    const context=await browser.newContext({viewport:null,reducedMotion:'reduce',permissions:[]});
    const page=await context.newPage();
    const unexpected=[],errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    page.on('request',req=>{
      const host=new URL(req.url()).hostname;
      if(!['127.0.0.1','tile.openstreetmap.org'].includes(host))unexpected.push(host);
    });
    await page.route('https://tile.openstreetmap.org/**',route=>route.fulfill({status:200,contentType:'image/png',body:png}));
    await page.goto(base,{waitUntil:'networkidle'});
    await page.waitForTimeout(200);
    const output=execFileSync('xwininfo',['-root','-tree'],{encoding:'utf8'});
    const match=output.match(/(0x[0-9a-f]+) "GoreeCloud Maps[^"\n]*"/i);
    assert.ok(match,'Could not find GoreeCloud Maps window on isolated X11 display');
    const windowId=match[1];
    const metrics=()=>page.evaluate(()=>{
      const html=document.documentElement,body=document.body;
      return {dpr:devicePixelRatio,width:innerWidth,height:innerHeight,
        htmlOverflow:html.scrollWidth-html.clientWidth,
        bodyOverflow:body.scrollWidth-body.clientWidth,
        totalPageHeight:html.scrollHeight,
        mapConsentVisible:getComputedStyle(document.querySelector('#map-consent')).display!=='none'};
    });
    const initial=await metrics();
    assert.ok(Math.abs(initial.dpr-1)<.025,'Initial Chromium page zoom must be 100%');
    assert.ok(initial.width>900,'Expected desktop-sized unzoomed viewport');
    console.log('BASELINE '+JSON.stringify(initial));
    async function setRealZoom(target){
      for(let attempt=0;attempt<30;attempt++){
        const observed=(await metrics()).dpr;
        if(Math.abs(observed-target)<.025)return;
        assert.ok(observed<target,'Browser zoom overshot target '+target+': '+observed);
        execFileSync('python3',[helper,windowId,'plus'],{env:process.env});
        await page.waitForTimeout(120);
      }
      throw new Error('Genuine browser zoom did not reach '+target+'00%');
    }
    for(const scale of [2,4]){
      await setRealZoom(scale);
      const state=await metrics();
      assert.ok(Math.abs(state.dpr-scale)<.025,'Did not verify genuine '+scale*100+'% browser zoom');
      assert.ok(Math.abs(state.width-initial.width/scale)<3,
        'Browser viewport did not truly reflow at '+scale*100+'%');
      assert.ok(state.htmlOverflow<=1,'HTML horizontal overflow at native zoom '+scale*100+'%: '+state.htmlOverflow);
      assert.ok(state.bodyOverflow<=1,'Body horizontal overflow at native zoom '+scale*100+'%: '+state.bodyOverflow);
      assert.ok(state.totalPageHeight>state.height+100,
        'Document must allow vertical scrolling at high zoom rather than trap all content behind overlays');
      const layout=await page.evaluate(()=>({
        header:getComputedStyle(document.querySelector('.app-header')).position,
        nav:getComputedStyle(document.querySelector('.app-nav')).position
      }));
      assert.notEqual(layout.header,'absolute','Header must not obscure content at high zoom');
      assert.notEqual(layout.nav,'absolute','Navigation must not obscure content at high zoom');
      // Keyboard navigation at genuine browser zoom, before any map or location consent.
      for(const view of ['explore','route','saved','privacy']){
        const tab=page.locator('[data-view="'+view+'"]');
        await tab.focus();
        await tab.press('Enter');
        assert.equal(await page.locator('[data-panel="'+view+'"]').isVisible(),true);
        const name=await page.evaluate(()=>document.activeElement?.dataset?.view);
        assert.equal(name,view,'Keyboard focus must remain on selected tab at '+scale*100+'%');
      }
      const tab=page.locator('[data-view="saved"]');
      await tab.focus();await tab.press('Enter');
      await page.locator('#import-places-button').scrollIntoViewIfNeeded();
      const rect=await page.locator('#import-places-button').boundingBox();
      assert.ok(rect&&rect.width>20&&rect.x>=-1&&rect.x+rect.width<=state.width+1 &&
        rect.y>=-1 && rect.y+rect.height<=state.height+1,
        'GeoJSON import control must be reachable within the visible viewport at '+scale*100+'%');
      const targetHit=await page.evaluate(()=>{
        const element=document.querySelector('#import-places-button');
        const r=element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
      });
      assert.ok(targetHit,'GeoJSON import button must not be visually blocked by an overlay');
      // Verify that the attribution can be reached without loading any external map service.
      const attribution=page.locator('#map-consent a');
      await attribution.scrollIntoViewIfNeeded();
      const license=await attribution.boundingBox();
      assert.ok(license && license.y>=-1 && license.y+license.height<=state.height+1,
        'Map data attribution must remain reachable at '+scale*100+'%');
      // External map tiles must not load when the map has not been explicitly requested.
      assert.equal((await metrics()).mapConsentVisible,true);
      try{
        const screenshotFile=resolve(evidence,'native-browser-zoom-'+scale*100+'.png');
        await page.screenshot({path:screenshotFile,animations:'disabled',timeout:12000});
        if((await stat(screenshotFile)).size<2048){
          console.warn('WARN: native zoom screenshot has little image detail; do not count as visual acceptance');
        }
      }catch(err){
        console.warn('Screenshot unsupported on this Xvfb/GPU combination: '+err.message.split('\n')[0]);
      }
      console.log('PASS true Chromium '+scale*100+'% browser zoom '+JSON.stringify(state));
    }
    execFileSync('python3',[helper,windowId,'reset'],{env:process.env});
    await page.waitForTimeout(160);
    assert.ok(Math.abs((await metrics()).dpr-1)<.025,'Browser zoom failed to reset to 100%');
    assert.deepEqual(unexpected,[],'No network request to unapproved external host');
    assert.deepEqual(errors,[],'No JavaScript errors during native zoom checks');
    console.log('PASS genuine native Chromium zoom and keyboard navigation checks');
    await context.close();
  }finally{
    if(browser)await browser.close();
    await new Promise(done=>server.close(done));
  }
}
main().catch(err=>{console.error(err);process.exitCode=1;});
