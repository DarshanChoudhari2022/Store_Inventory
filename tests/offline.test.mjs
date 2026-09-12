import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {isNetworkFailure,readLocal,writeLocal,listLocal,removeLocal,recoverShopPending,clearLocalSession} from '../app/retail/offline.ts';
test('offline bills retain request identity across reauthentication and stay shop isolated',async()=>{
 const a={id:crypto.randomUUID(),shopId:'a',created:new Date().toISOString(),data:{lines:[{id:'tea',qty:2,price:10}],paid:5,contactId:'customer'}};
 const b={...a,id:crypto.randomUUID(),shopId:'b'};
 await writeLocal('old:a:sale:'+a.id,a);await writeLocal('old:b:sale:'+b.id,b);
 await writeLocal('old:a:cart',{cart:a.data.lines,paid:'5',contactId:'customer'});
 await recoverShopPending('a','new:a');
 assert.deepEqual(await listLocal('new:a:sale:'),[a]);
 assert.deepEqual(await listLocal('old:a:sale:'),[]);
 assert.deepEqual(await listLocal('old:b:sale:'),[b]);
 assert.equal((await readLocal('old:a:cart')).paid,'5');
 await recoverShopPending('a','new:a');assert.equal((await listLocal('new:a:sale:')).length,1);
 await clearLocalSession('old');assert.deepEqual(await listLocal('new:a:sale:'),[a]);
 await removeLocal('new:a:sale:'+a.id);assert.deepEqual(await listLocal('new:a:sale:'),[]);
});

test('network fallback never masks authentication or database validation failures',()=>{
 for(const error of [new TypeError('Failed to fetch'),{message:'TypeError: NetworkError when attempting to fetch resource.'},new Error('Load failed'),{status:502,code:'',message:'Bad gateway'}]) assert.equal(isNetworkFailure(error),true);
 for(const error of [null,{message:'Shop access denied',code:'P0001'},new Error('Session expired'),new Error('Insufficient stock'),{status:500,code:'XX000',message:'Database error'}]) assert.equal(isNetworkFailure(error),false);
});
