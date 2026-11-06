/** Narrow CSS-viewport reflow checks corresponding to 1280px content at 200%/400% zoom.
 * These are viewport equivalents, NOT native browser zoom or screen-reader acceptance.
 */
const assert = require('node:assert/strict');
const {mkdir} = require('node:fs/promises');
const {resolve} = require('node:path');
const {chromium} = require('playwright');

const evidence = resolve(process.env.MAPS_BROWSER_EVIDENCE || 'browser-evidence');
const profiles = [
  {name:'reflow-200pct-equivalent',width:640,height:800},
  {name:'reflow-400pct-equivalent',width:320,height:640}
];

function insideHorizontalBounds(rect, width, label) {
  assert.ok(rect && rect.width > 0 && rect.height > 0,label+' must have nonzero dimensions');
  assert.ok(rect.x >= -1 && rect.x + rect.width <= width + 1,
    label+' must fit inside the viewport horizontally');
}

async function checkProfile(browser, base, profile) {
  const context = await browser.newContext({
    viewport:{width:profile.width,height:profile.height},
    reducedMotion:'reduce',
    permissions:[],
    colorScheme:'light'
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror',error=>errors.push(error.message));
  let anyThirdParty = false;
  page.on('request',request=>{
    if (new URL(request.url()).hostname!=='127.0.0.1') anyThirdParty=true;
  });
  try {
    await page.goto(base,{waitUntil:'networkidle'});
    assert.equal(anyThirdParty,false,'no third-party requests before explicit map consent');
    const viewport = profile.width;
    async function checkReflow(label) {
      const result = await page.evaluate(()=>{
        const nav = document.querySelector('.app-nav')?.getBoundingClientRect();
        const sidebar = document.querySelector('.sidebar-scroll')?.getBoundingClientRect();
        return {
          viewport:innerWidth,
          docScrollWidth:document.documentElement.scrollWidth,
          bodyScrollWidth:document.body.scrollWidth,
          nav:nav&&{x:nav.x,y:nav.y,width:nav.width,height:nav.height},
          sidebar:sidebar&&{x:sidebar.x,y:sidebar.y,width:sidebar.width,height:sidebar.height}
        };
      });
      assert.equal(result.viewport,viewport);
      assert.ok(result.docScrollWidth<=viewport+1,
        label+': document horizontal overflow ('+result.docScrollWidth+'px)');
      assert.ok(result.bodyScrollWidth<=viewport+1,
        label+': body horizontal overflow ('+result.bodyScrollWidth+'px)');
      insideHorizontalBounds(result.nav,viewport,label+' navigation');
      insideHorizontalBounds(result.sidebar,viewport,label+' sidebar');
    }
    await checkReflow('initial');
    for(const view of ['explore','route','saved','privacy']) {
      const tab = page.locator('[data-view="'+view+'"]');
      await tab.focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('[data-panel="'+view+'"]').isVisible(),true);
      await checkReflow(view);
      const focused = await page.evaluate(()=>document.activeElement?.dataset?.view);
      assert.equal(focused,view,'tab must remain focused after activation');
      if(view==='explore') {
        await page.locator('#search-input').scrollIntoViewIfNeeded();
        insideHorizontalBounds(await page.locator('#search-input').boundingBox(),viewport,'place search');
      }
      if(view==='route') {
        await page.locator('#start-coordinates').scrollIntoViewIfNeeded();
        insideHorizontalBounds(await page.locator('#start-coordinates').boundingBox(),viewport,'route start');
        await page.locator('#end-coordinates').scrollIntoViewIfNeeded();
        insideHorizontalBounds(await page.locator('#end-coordinates').boundingBox(),viewport,'route end');
      }
      if(view==='saved') {
        await page.locator('#import-places-button').scrollIntoViewIfNeeded();
        insideHorizontalBounds(await page.locator('#import-places-button').boundingBox(),viewport,'saved place import');
      }
    }
    const consentLink=page.locator('#map-consent a');
    await consentLink.scrollIntoViewIfNeeded();
    insideHorizontalBounds(await consentLink.boundingBox(),viewport,'map attribution');
    await page.screenshot({path:resolve(evidence,profile.name+'.png')});
    assert.deepEqual(errors,[],'no frontend JS errors');
    console.log('PASS',profile.name);
  }catch(error){
    await page.screenshot({path:resolve(evidence,profile.name+'-failure.png')}).catch(()=>{});
    throw new Error(profile.name+': '+error.message+(errors.length ? '\nPage errors: '+errors.join(' | '):''));
  }finally{
    await context.close();
  }
}

(async()=>{
  const {createMapsServer}=await import('../server/app.mjs');
  await mkdir(evidence,{recursive:true});
  const server=createMapsServer({env:{},distDir:resolve('dist')});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const base='http://127.0.0.1:'+server.address().port;
  let browser;
  try{
    browser=await chromium.launch({headless:true});
    for(const profile of profiles) await checkProfile(browser,base,profile);
    console.log('PASS synthetic narrow-viewport reflow checks; native zoom not tested');
  }finally{
    if(browser)await browser.close();
    await new Promise(done=>server.close(done));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
