/**
 * Map-first visual composition acceptance in synthetic Chromium.
 * A local illustrative street image must not be confused with live tiles.
 */
const assert=require('node:assert/strict');
const {mkdir}=require('node:fs/promises');
const {resolve}=require('node:path');
const {chromium}=require('playwright');
const evidence=resolve(process.env.MAPS_BROWSER_EVIDENCE||'browser-evidence');
const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+FQAAAABJRU5ErkJggg==','base64');
const sizes=[
  {name:'desktop',width:1440,height:900},
  {name:'tablet',width:820,height:1180},
  {name:'phone',width:390,height:844},
  {name:'small-phone',width:320,height:640}
];
function inViewport(r,width,label){
  assert.ok(r&&r.width>0&&r.height>0,label+' must have dimensions');
  assert.ok(r.x>=-1&&r.x+r.width<=width+1,label+' must fit viewport horizontally');
}
(async()=>{
  const {createMapsServer}=await import('../server/app.mjs');
  await mkdir(evidence,{recursive:true});
  const server=createMapsServer({env:{},distDir:resolve('dist')});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const base='http://127.0.0.1:'+server.address().port;
  let browser;
  try{
    browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
    for(const {name,width,height} of sizes){
      const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',permissions:[]});
      const page=await context.newPage(),errors=[],external=[];
      page.on('pageerror',err=>errors.push(err.message));
      page.on('request',req=>{if(new URL(req.url()).hostname!=='127.0.0.1')external.push(req.url())});
      await page.route('https://tile.openstreetmap.org/**',route=>route.fulfill({status:200,contentType:'image/png',body:tinyPng}));
      try{
        await page.goto(base,{waitUntil:'networkidle'});
        const map=await page.locator('.map-area').boundingBox();
        assert.ok(map.width>=width-2&&map.height>=height-2,
          name+': map canvas should dominate the entire application viewport');
        const input=await page.locator('#search-form').boundingBox();
        inViewport(input,width,name+' floating search');
        assert.ok(input.y<height*.25,name+': search should be at top of map');
        const nav=await page.locator('.app-nav').boundingBox();
        inViewport(nav,width,name+' primary navigation dock');
        assert.ok(nav.y>=-1&&nav.y+nav.height<=height+1,
          name+': navigation dock must be visible within the screen');
        const sheet=await page.locator('.sidebar').boundingBox();
        inViewport(sheet,width,name+' floating tools');
        if(width<=700){
          assert.ok(sheet.width<width-14,name+': bottom sheet should leave side margins');
          assert.ok(sheet.y>height*.47,name+': bottom sheet should leave the top map exposed');
        }else{
          assert.ok(sheet.width<=375,name+': floating sidebar must not dominate map canvas');
        }
        const consent=await page.locator('#map-consent').boundingBox();
        assert.ok(consent.width>=width-1&&consent.height>=height-1);
        const card=await page.locator('.consent-card').boundingBox();
        inViewport(card,width,name+' consent card');
        assert.ok(card.height<map.height*.55,name+': consent should not dominate the map canvas');
        if(width<=700){
          assert.ok(card.y+card.height<=sheet.y+5,
            name+': compact consent must not be hidden behind the tools sheet');
        }else{
          assert.ok(card.x>=sheet.x+sheet.width-8,
            name+': desktop map consent must not obstruct the sidebar');
        }
        assert.equal(await page.locator('#map-preview-note').isVisible(),true,
          'Offline street illustration must be explicitly labeled');
        const bg=await page.locator('#map').evaluate(el=>getComputedStyle(el).backgroundImage);
        assert.match(bg,/map-preview[.]svg/,'visible pre-consent background must be the local street illustration');
        assert.deepEqual(external,[],name+': must not contact tile provider before explicit consent');
        await page.screenshot({path:resolve(evidence,'map-first-'+name+'.png'),animations:'disabled'});
        await page.locator('[data-view="saved"]').click();
        await page.locator('#search-input').fill('-86.801,33.518');
        await page.locator('#search-form button[type=submit]').click();
        assert.equal(await page.locator('[data-panel="explore"]').isVisible(),true,
          name+': search from another tab must reveal Explore results');
        assert.match(await page.locator('#selection-card').textContent(),/Coordinates/);
        const overflow=await page.evaluate(()=>({
          html:document.documentElement.scrollWidth-innerWidth,
          body:document.body.scrollWidth-innerWidth
        }));
        assert.ok(overflow.html<=1&&overflow.body<=1,name+': no horizontal document overflow');
        if(name==='phone'){
          await page.locator('#load-map').click();
          await page.locator('.maplibregl-canvas').waitFor({state:'visible',timeout:15000});
          assert.equal(await page.locator('#map-consent').isVisible(),false);
          assert.equal(await page.locator('#map-preview-note').isVisible(),false);
          const liveBg=await page.locator('#map').evaluate(el=>getComputedStyle(el).backgroundImage);
          assert.equal(liveBg,'none','Illustrative background must disappear when the live map loads');
          await page.locator('[data-view="privacy"]').click();
          await page.locator('#reload-tiles').click();
          assert.equal(await page.locator('#map-preview-note').isVisible(),true);
          assert.equal(await page.locator('#map-consent').isVisible(),true);
        }
        assert.deepEqual(errors,[],name+' JavaScript errors');
        console.log('PASS map-first '+name+' '+width+'x'+height);
      }catch(err){
        await page.screenshot({path:resolve(evidence,'map-first-'+name+'-failed.png')}).catch(()=>{});
        throw new Error(name+': '+err.message);
      }finally{await context.close();}
    }
  }finally{
    if(browser)await browser.close();
    await new Promise(done=>server.close(done));
  }
})().catch(err=>{console.error(err);process.exitCode=1});
