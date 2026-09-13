import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import type {NextRequest} from 'next/server';

export const cookieName='storestock_session';
export const cookieOptions={httpOnly:true,sameSite:'strict' as const,secure:process.env.NODE_ENV==='production',path:'/'};
export const cacheId=(token:string)=>createHash('sha256').update('storestock-cache:'+token).digest('hex');
export function sameOrigin(request:Request){return request.headers.get('origin')===new URL(request.url).origin;}
export function sessionToken(request:NextRequest){const value=request.cookies.get(cookieName)?.value;return value&&/^[a-f0-9-]{36}$/i.test(value)?value:null;}
export function database(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Database unavailable');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function jsonBody(request:Request):Promise<Record<string,unknown>>{
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error('JSON required');
 if(!request.body)throw new Error('Body required');
 const reader=request.body.getReader(),decoder=new TextDecoder();let text='',bytes=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;
   if(bytes>1_000_000){await reader.cancel();throw new Error('Request too large');}
   text+=decoder.decode(value,{stream:true});
  }
  text+=decoder.decode();
 }finally{reader.releaseLock();}
 const value:unknown=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Object required');
 return value as Record<string,unknown>;
}
