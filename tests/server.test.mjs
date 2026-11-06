import test from 'node:test';
import assert from 'node:assert/strict';
import {createMapsServer, resolveConfig} from '../server/app.mjs';

async function withServer(options, handler) {
  const server = createMapsServer(options);
  await new Promise((resolve) => server.listen(0,'127.0.0.1',resolve));
  const address = 'http://127.0.0.1:' + server.address().port;
  try { await handler(address); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}
test('restricts provider URLs to HTTPS or local loopback', () => {
  assert.throws(() => resolveConfig({MAPS_ROUTER_URL:'http://untrusted.example'}),/HTTPS/);
  assert.throws(() => resolveConfig({MAPS_TILE_URL_TEMPLATE:'https://a.example/tiles.png'}),/Tile URL/);
  assert.ok(resolveConfig({MAPS_ROUTER_URL:'http://127.0.0.1:5000/'}).router);
});
test('health and disabled providers expose explicit status with privacy headers', async () => {
  await withServer({env:{}}, async (base) => {
    const config = await fetch(base+'/api/config');
    const data = await config.json();
    assert.equal(data.search,false); assert.equal(data.routing,false);
    assert.equal(config.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
    const disabled = await fetch(base+'/api/search?q=test');
    assert.equal(disabled.status,503);
    const health = await fetch(base+'/api/health');
    assert.deepEqual(await health.json(),{ok:true,stage:'development-preview'});
  });
});
test('route proxy validates points and sanitizes the result', async () => {
  let calledUrl;
  const provider = async (url) => {
    calledUrl = url.toString();
    return new Response(JSON.stringify({code:'Ok',routes:[{geometry:{coordinates:[[1,2],[3,4]]},distance:1234,duration:300,unwanted:'redacted'}]}),{status:200});
  };
  await withServer({env:{MAPS_ROUTER_URL:'https://routing.example/'},fetchImpl:provider},async (base) => {
    const invalid = await fetch(base+'/api/route?start=181,0&end=1,2');
    assert.equal(invalid.status,400);
    const result = await fetch(base+'/api/route?start=1,2&end=3,4');
    assert.equal(result.status,200);
    assert.deepEqual(await result.json(),{coordinates:[[1,2],[3,4]],distance:1234,duration:300});
    assert.match(calledUrl,/route\/v1\/driving\/1,2;3,4/);
  });
});
test('provider errors do not leak URLs or coordinates to the response', async () => {
  await withServer({env:{MAPS_ROUTER_URL:'https://routing.example/'},fetchImpl:async()=>{throw new Error('secret upstream data');}},async (base) => {
    const response = await fetch(base+'/api/route?start=1,2&end=3,4');
    assert.equal(response.status,502);
    assert.doesNotMatch(JSON.stringify(await response.json()),/secret|routing\.example|1,2/);
  });
});
