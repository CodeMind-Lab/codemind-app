import assert from 'node:assert/strict';
import { normalizeConnection,verifyConnection } from '../dist/js/services/connection.js?v=65';
const config={url:'  https://test-project.supabase.co/  ',key:' sb_publishable_test_public_key '};
assert.deepEqual(normalizeConnection(config),{url:'https://test-project.supabase.co',key:'sb_publishable_test_public_key'});
assert.throws(()=>normalizeConnection({...config,url:'postgresql://user:password@db.test.co'}));
assert.throws(()=>normalizeConnection({...config,key:'sb_secret_test'}));
const jwt='header.'+btoa(JSON.stringify({role:'anon'}))+'.signature';
assert.equal(normalizeConnection({...config,key:jwt}).key,jwt);
assert.throws(()=>normalizeConnection({...config,key:'header.'+btoa(JSON.stringify({role:'service_role'}))+'.signature'}));
let calls=0;
await verifyConnection(config,async(url,options)=>{calls++;assert.equal(url,'https://test-project.supabase.co/auth/v1/settings');assert.equal(options.headers.apikey,'sb_publishable_test_public_key');return {ok:true,status:200,json:async()=>({external:{email:true}})};});
assert.equal(calls,1);
await assert.rejects(()=>verifyConnection(config,async()=>({ok:false,status:401})),/chiave/);
await assert.rejects(()=>verifyConnection(config,async()=>{throw new TypeError('Failed to fetch')}),/raggiungere/);
console.log('PASS: URL/key normalization, public key validation, secret rejection, connection check and network/auth errors.');

assert.equal(normalizeConnection({...config,url:"https://supabase.com/dashboard/project/fjhqwjgannbxfzpxjcpq"}).url,"https://fjhqwjgannbxfzpxjcpq.supabase.co");
