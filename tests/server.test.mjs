import test from 'node:test';
import assert from 'node:assert/strict';
import {createMapsServer, resolveConfig} from '../server/app.mjs';

async function withServer(options, handler) {
  const server = createMapsServer(options);
  await new Promise((resolve) => server.listen(0,'127.0.0.1',resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try { await handler(base); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}
const post = (base, path, input, headers={}) => fetch(base+path, {
  method:'POST',headers:{'Content-Type':'application/json', ...headers},
  body:JSON.stringify(input)
});

test('requires trusted HTTPS provider URLs except loopback', () => {
  assert.throws(() => resolveConfig({MAPS_ROUTER_URL:'http://bad.example'}),/HTTPS/);
  assert.throws(() => resolveConfig({MAPS_TILE_URL_TEMPLATE:'https://tile.example/img.png'}),/Tile URL/);
  assert.ok(resolveConfig({MAPS_ROUTER_URL:'http://127.0.0.1:5000/'}).router);
});
test('read-only health/config, referrer privacy and disabled providers', async () => {
  await withServer({env:{}}, async (base) => {
    const config = await fetch(base+'/api/config');
    const data = await config.json();
    assert.equal(data.search,false); assert.equal(data.routing,false);
    assert.equal(config.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
    const disabled = await post(base,'/api/search',{q:'place'});
    assert.equal(disabled.status,503);
    const health = await fetch(base+'/api/health');
    assert.deepEqual(await health.json(),{ok:true,stage:'development-preview'});
    assert.equal((await fetch(base+'/api/search?q=sensitive')).status,405);
  });
});
test('route proxy validates coordinates and strips upstream extras', async () => {
  let calledUrl;
  const provider = async (url) => {
    calledUrl = url.toString();
    return new Response(JSON.stringify({code:'Ok',routes:[{
      geometry:{coordinates:[[1,2],[3,4]]},distance:1234,duration:300,hidden:'redacted'
    }]}),{status:200});
  };
  await withServer({env:{MAPS_ROUTER_URL:'https://routing.example/'},fetchImpl:provider},async (base) => {
    assert.equal((await post(base,'/api/route',{start:'181,0',end:'1,2'})).status,400);
    const route = await post(base,'/api/route',{start:'1,2',end:'3,4'});
    assert.equal(route.status,200);
    assert.deepEqual(await route.json(),{coordinates:[[1,2],[3,4]],distance:1234,duration:300});
    assert.match(calledUrl,/route\/v1\/driving\/1,2;3,4/);
  });
});
test('geocoding uses POST input, validates and minimizes provider responses', async () => {
  let providerUrl;
  await withServer({env:{MAPS_GEOCODER_URL:'https://geocode.example/'},fetchImpl:async (url) => {
    providerUrl=url.toString();
    return new Response(JSON.stringify([
      {display_name:'First result',lon:'-86.8',lat:'33.5',private:'discard'},
      {display_name:'Bad',lon:'500',lat:'30'}
    ]),{status:200});
  }},async (base) => {
    assert.equal((await post(base,'/api/search',{q:'x'})).status,400);
    const response=await post(base,'/api/search',{q:'example search'});
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{results:[{name:'First result',lon:-86.8,lat:33.5}]});
    assert.match(providerUrl,/q=example\+search/);
  });
});
test('rejects malformed, oversized, cross-origin and query-URL API requests', async () => {
  await withServer({env:{MAPS_ROUTER_URL:'https://routing.example/'}},async (base) => {
    const malformed=await fetch(base+'/api/route',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});
    assert.equal(malformed.status,400);
    const type=await fetch(base+'/api/route',{method:'POST',headers:{'Content-Type':'text/plain'},body:'hello'});
    assert.equal(type.status,415);
    const tooLarge=await post(base,'/api/route',{padding:'x'.repeat(5000)});
    assert.equal(tooLarge.status,413);
    const cross=await post(base,'/api/route',{start:'1,2',end:'3,4'},{Origin:'https://attacker.example'});
    assert.equal(cross.status,403);
    const query=await post(base,'/api/route?start=1,2',{start:'1,2',end:'3,4'});
    assert.equal(query.status,400);
  });
});
test('upstream errors do not echo providers or sensitive locations', async () => {
  await withServer({env:{MAPS_ROUTER_URL:'https://routing.example/'},fetchImpl:async () => {
    throw new Error('secret upstream detail');
  }},async (base) => {
    const response=await post(base,'/api/route',{start:'1,2',end:'3,4'});
    assert.equal(response.status,502);
    assert.doesNotMatch(JSON.stringify(await response.json()),/secret|routing\.example|1,2/);
  });
});
