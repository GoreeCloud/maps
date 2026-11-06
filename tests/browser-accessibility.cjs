/** Synthetic keyboard and forced-colors checks for GoreeCloud Maps. */
const assert = require('node:assert/strict');
const {mkdir} = require('node:fs/promises');
const {resolve} = require('node:path');
const {chromium} = require('playwright');
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+FQAAAABJRU5ErkJggg==','base64');
const evidence = resolve(process.env.MAPS_BROWSER_EVIDENCE || 'browser-evidence');

async function journey(browser, base, name, width, height, contrast) {
  const context = await browser.newContext({
    viewport:{width,height},
    forcedColors:contrast ? 'active' : 'none',
    reducedMotion:'reduce',
    permissions:[],
    colorScheme:'dark'
  });
  const page = await context.newPage();
  const exceptions = [];
  const unexpected = [];
  page.on('pageerror', (err) => exceptions.push(err.message));
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (!['127.0.0.1','tile.openstreetmap.org'].includes(url.hostname)) unexpected.push(url.hostname);
  });
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({
    status:200,contentType:'image/png',body:tinyPng
  }));
  try {
    await page.goto(base,{waitUntil:'networkidle'});
    assert.equal(await page.locator('#map-consent').isVisible(),true);
    assert.equal(await page.evaluate(() => matchMedia('(forced-colors: active)').matches),contrast);
    await page.screenshot({path:resolve(evidence,name+'-consent-before-scroll.png')});
    // The consent link must remain reachable inside the map region, including at phone size.
    const consentLink = page.locator('#map-consent a');
    await consentLink.scrollIntoViewIfNeeded();
    const consentBounds = await page.evaluate(() => {
      const panel = document.querySelector('#map-consent').getBoundingClientRect();
      const link = document.querySelector('#map-consent a').getBoundingClientRect();
      return {panelTop:panel.top,panelBottom:panel.bottom,linkTop:link.top,linkBottom:link.bottom};
    });
    assert.ok(consentBounds.linkTop >= consentBounds.panelTop - 1 &&
              consentBounds.linkBottom <= consentBounds.panelBottom + 1,
              'consent attribution link must be scrollable into view');
    await page.screenshot({path:resolve(evidence,name+'-consent-link.png')});

    // Enter activates the search form without pointer input or remote geocoding.
    await page.locator('#search-input').focus();
    await page.keyboard.type('-86.801,33.518');
    await page.keyboard.press('Enter');
    await page.locator('#selection-card').filter({hasText:'Coordinates'}).waitFor();
    await page.locator('#search-results').filter({hasText:'No geocoding request sent'}).waitFor();

    // Tab traversal exposes a keyboard-focus indicator on a native control.
    await page.locator('#search-input').focus();
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => ({
      label: document.activeElement?.getAttribute('aria-label'),
      outline: getComputedStyle(document.activeElement).outlineStyle
    }));
    assert.equal(focused.label,'Search');
    assert.notEqual(focused.outline,'none');

    // Native keyboard activation of navigation and local route point fields.
    await page.locator('[data-view="route"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-panel="route"]').isVisible(),true);
    await page.locator('#start-coordinates').focus();
    await page.keyboard.type('-86.801,33.518');
    await page.locator('#end-coordinates').focus();
    await page.keyboard.type('-86.9,33.6');
    await page.locator('#apply-route-coordinates').focus();
    await page.keyboard.press('Enter');
    await page.locator('#status').filter({hasText:'without device location'}).waitFor();

    // On mobile a long route panel can scroll; switching tabs must expose the new heading.
    await page.locator('.sidebar-scroll').evaluate((element) => {element.scrollTop=element.scrollHeight;});
    await page.locator('[data-view="saved"]').focus();
    await page.keyboard.press('Enter');
    const heading = await page.locator('[data-panel="saved"] h1').boundingBox();
    const sidebar = await page.locator('.sidebar-scroll').boundingBox();
    assert.ok(heading && sidebar && heading.y >= sidebar.y - 1 &&
      heading.y < sidebar.y + sidebar.height, 'new tab heading must not be clipped');
    assert.equal(await page.locator('.sidebar-scroll').evaluate((element) => element.scrollTop),0);
    await page.locator('[data-view="route"]').focus();
    await page.keyboard.press('Enter');

    // Load map only after consent; map center can then be pinned using keyboard.
    await page.locator('#load-map').focus();
    await page.keyboard.press('Enter');
    await page.locator('.maplibregl-canvas').waitFor({state:'visible',timeout:15000});
    await page.locator('#pin-center').focus();
    await page.keyboard.press('Enter');
    // The persistent destination is authoritative; transient status text may change
    // when map tiles load or report errors after the keyboard activation.
    await page.locator('#end-label').filter({hasText:'Map center'}).waitFor();
    // Selection card is in Explore and remains hidden while Routes is active.
    assert.match(await page.locator('#selection-card').textContent(), /Map center/);
    assert.equal(await page.locator('#pin-center').isEnabled(),true);
    if (width <= 700) {
      const positions = await page.evaluate(() => {
        const label = document.querySelector('.map-topline').getBoundingClientRect();
        const controls = document.querySelector('.map-controls').getBoundingClientRect();
        return {labelRight:label.right,controlsLeft:controls.left};
      });
      assert.ok(positions.labelRight + 4 <= positions.controlsLeft,
        'mobile map status label must not overlap map controls');
    }
    await page.screenshot({path:resolve(evidence,name+'-map.png')});

    // The app must not create horizontal document scroll at the tested viewport.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(overflow,false,'unexpected horizontal page overflow');
    assert.deepEqual(unexpected,[]);
    assert.deepEqual(exceptions,[]);
    console.log('PASS',name);
  } catch (err) {
    await page.screenshot({path:resolve(evidence,name+'-failed.png')}).catch(()=>{});
    throw new Error(name+': '+err.message + (exceptions.length ? ' '+exceptions.join('; '):''));
  } finally { await context.close(); }
}

(async () => {
  const {createMapsServer} = await import('../server/app.mjs');
  await mkdir(evidence,{recursive:true});
  const server = createMapsServer({env:{},distDir:resolve('dist')});
  await new Promise((done) => server.listen(0,'127.0.0.1',done));
  const base = 'http://127.0.0.1:'+server.address().port;
  let browser;
  try {
    browser = await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
    await journey(browser,base,'keyboard-desktop',1280,800,false);
    await journey(browser,base,'keyboard-phone',390,844,false);
    await journey(browser,base,'forced-colors-desktop',1280,800,true);
    await journey(browser,base,'forced-colors-phone',390,844,true);
    console.log('PASS: keyboard and forced-colors synthetic smoke checks');
  } finally {
    if (browser) await browser.close();
    await new Promise((done) => server.close(done));
  }
})().catch((err)=>{console.error(err);process.exitCode=1;});
