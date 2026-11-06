/**
 * Synthetic browser acceptance checks. No real device coordinates or place searches.
 * Map tile requests are intercepted and fulfilled with an in-memory image.
 * Requires a built ./dist and the pinned, CI-installed playwright package.
 */
const assert = require('node:assert/strict');
const {mkdir} = require('node:fs/promises');
const {resolve} = require('node:path');
const {chromium} = require('playwright');

const profiles = [
  {name:'desktop', width:1440,height:900},
  {name:'tablet', width:820,height:1180},
  {name:'phone', width:390,height:844}
];
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+FQAAAABJRU5ErkJggg==',
  'base64'
);
const evidence = resolve(process.env.MAPS_BROWSER_EVIDENCE || 'browser-evidence');
const config = {
  MAPS_GEOCODER_URL:'https://example.test/geocode/',
  MAPS_ROUTER_URL:'https://example.test/osrm/'
};
const fakeProvider = async (url) => {
  const path = new URL(url).pathname;
  if (path.endsWith('/search')) {
    return new Response(JSON.stringify([
      {display_name:'Synthetic community library', lon:'-86.801', lat:'33.518'}
    ]), {headers:{'Content-Type':'application/json'}});
  }
  if (path.includes('/route/v1/driving/')) {
    if (path.includes('-87.2,33.7')) {
      await new Promise((done) => setTimeout(done, 900));
    }
    return new Response(JSON.stringify({
      code:'Ok',
      routes:[{geometry:{coordinates:[[-86.801,33.518],[-86.9,33.6]]},distance:16000,duration:1200}]
    }), {headers:{'Content-Type':'application/json'}});
  }
  throw new Error('Unexpected provider request: ' + path);
};

async function runProfile(browser, base, profile) {
  const context = await browser.newContext({
    viewport:{width:profile.width,height:profile.height},
    acceptDownloads:true,
    geolocation:undefined,
    permissions:[],
    colorScheme:'dark',
    reducedMotion:'reduce'
  });
  const page = await context.newPage();
  const errors = [];
  const unintendedExternal = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const target = new URL(request.url());
    if (!['127.0.0.1','tile.openstreetmap.org'].includes(target.hostname)) {
      unintendedExternal.push(target.origin);
    }
  });
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({
    status:200, body:tinyPng, contentType:'image/png'
  }));
  try {
    await page.goto(base, {waitUntil:'networkidle'});
    await page.locator('#search-hint').filter({hasText:'configured geocoder'}).waitFor();
    assert.equal(await page.locator('#map-consent').isVisible(), true,
      'map should require an explicit loading action');
    await page.screenshot({path:resolve(evidence,profile.name+'-consent.png')});

    await page.locator('#search-input').fill('-86.801,33.518');
    await page.locator('#search-form button[type=submit]').click();
    await page.locator('#search-results').filter({hasText:'No geocoding request sent'}).waitFor();
    assert.match(await page.locator('#selection-card').innerText(), /Coordinates/);

    page.once('dialog', (dialog) => dialog.accept('Synthetic saved point'));
    await page.locator('#save-selection').click();
    await page.locator('[data-view="saved"]').click();
    await page.getByText('Synthetic saved point',{exact:true}).waitFor();

    const incoming = JSON.stringify({
      type:'FeatureCollection',
      features:[{
        type:'Feature',geometry:{type:'Point',coordinates:[-87,33.6]},
        properties:{name:'Second synthetic point'}
      }]
    });
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#import-places').setInputFiles({
      name:'synthetic.geojson',mimeType:'application/geo+json',buffer:Buffer.from(incoming)
    });
    await page.getByText('Second synthetic point',{exact:true}).waitFor();
    const [download] = await Promise.all([
      page.waitForEvent('download'),page.locator('#export-places').click()
    ]);
    assert.match(download.suggestedFilename(),/\.geojson$/);
    await page.screenshot({path:resolve(evidence,profile.name+'-saved.png')});

    await page.locator('[data-view="route"]').click();
    await page.locator('#start-coordinates').fill('-86.801,33.518');
    await page.locator('#end-coordinates').fill('-86.9,33.6');
    await page.locator('#apply-route-coordinates').click();
    await page.locator('#status').filter({hasText:'without device location'}).waitFor();
    await page.locator('#route-button').click();
    await page.locator('#route-summary').filter({hasText:'20 min'}).waitFor();
    await page.screenshot({path:resolve(evidence,profile.name+'-route.png')});

    // A late response from an obsolete route must never restore old directions.
    await page.locator('#end-coordinates').fill('-87.2,33.7');
    await page.locator('#apply-route-coordinates').click();
    assert.doesNotMatch(await page.locator('#route-summary').innerText(), /20 min/);
    await page.locator('#route-button').click();
    await page.locator('#route-summary').filter({hasText:'Calculating driving route'}).waitFor();
    await page.locator('#end-coordinates').fill('-86.7,33.4');
    await page.locator('#apply-route-coordinates').click();
    await page.waitForFunction(() => !document.querySelector('#route-button').disabled);
    assert.match(await page.locator('#route-summary').innerText(), /Points set/);
    assert.doesNotMatch(await page.locator('#route-summary').innerText(), /20 min/);

    await page.locator('[data-view="explore"]').click();
    await page.locator('#search-input').fill('library');
    await page.locator('#search-form button[type=submit]').click();
    await page.getByText('Synthetic community library',{exact:true}).waitFor();
    await page.locator('#search-results button').first().click();
    assert.match(await page.locator('#selection-card').innerText(),/Synthetic community library/);

    await page.locator('#theme-toggle').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.reload({waitUntil:'networkidle'});
    assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.locator('[data-view="saved"]').click();
    await page.getByText('Synthetic saved point',{exact:true}).waitFor();
    await page.screenshot({path:resolve(evidence,profile.name+'-saved-light.png')});

    await page.locator('[data-view="explore"]').click();
    await page.locator('#load-map').click();
    await page.locator('#map-consent').waitFor({state:'hidden', timeout:15000});
    await page.locator('.maplibregl-canvas').waitFor({state:'visible', timeout:15000});
    await page.screenshot({path:resolve(evidence,profile.name+'-map.png')});
    assert.deepEqual(unintendedExternal,[], 'unexpected external browser fetch');
    assert.deepEqual(errors,[], 'uncaught frontend exceptions');
    console.log('PASS',profile.name,'synthetic browser journey');
  } catch (error) {
    await page.screenshot({path:resolve(evidence,profile.name+'-failure.png')}).catch(()=>{});
    throw new Error(profile.name+': '+error.message+
      (errors.length ? '; page errors='+errors.join(' | '):''));
  } finally {
    await context.close();
  }
}

(async () => {
  const {createMapsServer} = await import('../server/app.mjs');
  await mkdir(evidence,{recursive:true});
  const server = createMapsServer({env:config,fetchImpl:fakeProvider,distDir:resolve('dist')});
  await new Promise((done) => server.listen(0,'127.0.0.1',done));
  const base = 'http://127.0.0.1:'+server.address().port;
  let browser;
  try {
    browser = await chromium.launch({
      headless:true,
      args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']
    });
    for (const profile of profiles) await runProfile(browser,base,profile);
    console.log('PASS: all three synthetic viewport checks completed.');
  } finally {
    if (browser) await browser.close();
    await new Promise((done) => server.close(done));
  }
})().catch((err) => {console.error(err);process.exitCode=1;});
