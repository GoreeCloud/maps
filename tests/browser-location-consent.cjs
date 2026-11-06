/**
 * Consent-epoch browser regression for simulated, delayed device geolocation.
 * No physical coordinates, permission prompts, or external provider calls.
 */
const assert = require('node:assert/strict');
const {mkdir} = require('node:fs/promises');
const {resolve} = require('node:path');
const {chromium} = require('playwright');

const evidence = resolve(process.env.MAPS_BROWSER_EVIDENCE || 'browser-evidence');
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+FQAAAABJRU5ErkJggg==','base64');

(async () => {
  const {createMapsServer} = await import('../server/app.mjs');
  await mkdir(evidence,{recursive:true});
  const server = createMapsServer({env:{},distDir:resolve('dist')});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const base = 'http://127.0.0.1:'+server.address().port;
  let browser,context;
  try{
    browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
    context=await browser.newContext({viewport:{width:820,height:900},permissions:[],reducedMotion:'reduce'});
    const page=await context.newPage();
    const errors=[],unexpected=[];
    page.on('pageerror',err=>errors.push(err.message));
    page.on('request',req=>{
      const host=new URL(req.url()).hostname;
      if (!['127.0.0.1','tile.openstreetmap.org'].includes(host)) unexpected.push(host);
    });
    await page.route('https://tile.openstreetmap.org/**',route=>route.fulfill({
      status:200,body:tinyPng,contentType:'image/png'
    }));
    await page.addInitScript(()=>{
      // Intentionally defer callbacks; this is a deterministic stand-in for a
      // real browser permission/GPS operation, NOT physical GPS acceptance.
      window.__geoRequests=[];
      Object.defineProperty(navigator,'geolocation',{
        configurable:true,
        value:{getCurrentPosition(success,error,options){
          window.__geoRequests.push({success,error,options});
        }}
      });
    });
    await page.goto(base,{waitUntil:'networkidle'});
    async function loadMap(){
      await page.locator('#load-map').click();
      await page.locator('.maplibregl-canvas').waitFor({state:'visible',timeout:15000});
      await page.locator('[data-view="route"]').click();
    }
    async function requestLocation(index){
      await page.locator('#use-location').click();
      await page.waitForFunction(i=>window.__geoRequests.length===i+1,index);
      assert.equal(await page.locator('#use-location').getAttribute('aria-busy'),'true');
      assert.equal(await page.locator('#use-location').isDisabled(),true);
    }
    async function release(index,lon,lat){
      await page.evaluate(({index,lon,lat})=>{
        window.__geoRequests[index].success({coords:{longitude:lon,latitude:lat}});
      },{index,lon,lat});
    }
    async function revoke(){
      await page.locator('[data-view="privacy"]').click();
      await page.locator('#reload-tiles').click();
      assert.equal(await page.locator('#map-consent').isVisible(),true);
      assert.match(await page.locator('#status').textContent(),/Map requests stopped/);
    }
    // 1. Geolocation result may arrive after the user withdraws map consent.
    await loadMap();
    await requestLocation(0);
    await revoke();
    await release(0,-86.8,33.5);
    assert.equal((await page.locator('#start-label').textContent()).trim(),'Choose on map');
    assert.match(await page.locator('#status').textContent(),/Map requests stopped/);
    assert.equal(await page.locator('#use-location').getAttribute('aria-busy'),null);
    // 2. A new map consent enables a separate, current geolocation operation.
    await loadMap();
    await requestLocation(1);
    await release(1,-87.1,33.7);
    await page.locator('#start-label').filter({hasText:'My current location'}).waitFor();
    assert.equal(await page.locator('#use-location').isEnabled(),true);
    await revoke();
    assert.equal((await page.locator('#start-label').textContent()).trim(),'Choose on map',
      'Revoke must erase a device-derived route start from session state');
    // 3. Explicit manual points take precedence over a pending GPS callback.
    await loadMap();
    await requestLocation(2);
    await page.locator('#start-coordinates').fill('-87.2,33.6');
    await page.locator('#end-coordinates').fill('-86.8,33.5');
    await page.locator('#apply-route-coordinates').click();
    const manualStart=await page.locator('#start-label').textContent();
    assert.match(manualStart,/33\.60000/);
    await release(2,-85.5,34.2);
    assert.equal(await page.locator('#start-label').textContent(),manualStart,
      'Delayed geolocation must not override explicit manual start');
    // 4. A late error callback cannot replace the revocation message.
    await requestLocation(3);
    await revoke();
    await page.evaluate(()=>window.__geoRequests[3].error({code:1,message:'blocked'}));
    assert.match(await page.locator('#status').textContent(),/Map requests stopped/);
    await page.screenshot({path:resolve(evidence,'consent-revoked-with-delayed-gps.png')});
    assert.deepEqual(unexpected,[],'Unexpected external network destination');
    assert.deepEqual(errors,[],'No frontend JS errors including map.flyTo after revoke');
    console.log('PASS revoked, new, manually superseded and error geolocation callbacks');
  }finally{
    if(context)await context.close();
    if(browser)await browser.close();
    await new Promise(done=>server.close(done));
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
