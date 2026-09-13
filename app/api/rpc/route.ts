import {NextResponse,type NextRequest} from 'next/server';
import {cacheId,cookieName,cookieOptions,database,jsonBody,sameOrigin,sessionToken} from '../session/security';

export const runtime='nodejs';
const allowed=new Set(['list_shops','owner_summary','get_shop_dashboard','create_shop','reset_shop_password','admin_update_shop','retail_workspace','retail_workspace_scoped','retail_report','retail_report_export_page','retail_accounting_export','retail_contact_aging','retail_product_lookup','retail_feature_flags','retail_feature_flag_set','retail_workspace_page','retail_action','retail_contact_update','retail_split_checkout','retail_hold','retail_counter_checkout','retail_schedule','delete_item_confirmed','manage_shop_staff','retail_delivery_settings','retail_delivery_list','retail_quote_action','retail_quote_list','add_item','edit_item','set_stock_checked','update_stock','record_sale','record_sale_v2']);
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:NextRequest){
 const started=performance.now(); let operation='unknown';
 if(!sameOrigin(request))return reply({error:{code:'ORIGIN',message:'Request origin rejected'}},403);
 const token=sessionToken(request);if(!token)return reply({error:{code:'SESSION',message:'Session expired. Sign in again.'}},401);
 let body:Record<string,unknown>;
 try{body=await jsonBody(request);}catch{return reply({error:{code:'VALIDATION',message:'Invalid request'}},400);}
 if(typeof body.name!=='string'||!allowed.has(body.name)||!body.args||typeof body.args!=='object'||Array.isArray(body.args))return reply({error:{code:'VALIDATION',message:'Unknown operation'}},400);
 operation=body.name;
 // A second tab may have signed into another account. Never replay the first
 // tab's draft under a different cookie session, even for the same shop.
 if(body.cacheId!==cacheId(token))return reply({error:{code:'SESSION',message:'Account changed in another tab. Sign in again.'}},401);
 try{
  const client=database();
  const profile=await client.rpc('retail_session_profile',{p_token:token});
  if(profile.error)return reply({error:{message:'Service temporarily unavailable'}},503);
  if(!profile.data)return reply({error:{code:'SESSION',message:'Session expired. Sign in again.'}},401);
  const args=body.args as Record<string,unknown>;
  if(args.p_shop_id!==undefined && (typeof args.p_shop_id!=='string'||!/^[0-9a-f-]{36}$/i.test(args.p_shop_id)))return reply({error:{code:'VALIDATION',message:'Invalid shop'}},400);
  const limit=await client.rpc('retail_request_limit',{p_token:token,p_shop_id:args.p_shop_id??null});
  if(limit.error)return reply({error:{code:limit.error.code,message:'Could not authorize request'}},400);
  if(!limit.data?.allowed)return NextResponse.json({error:{code:'RATE_LIMIT',message:'This shop is busy. Wait a moment and retry.'}},{status:429,headers:{'Retry-After':String(limit.data?.retryAfter??60),'Cache-Control':'no-store'}});
  const {data,error,status}=await client.rpc(body.name,{...body.args,p_token:token});
  if(error){ console.error(JSON.stringify({event:'rpc_error',operation,status:status>=400?status:400,code:error.code||'RPC',latencyMs:Math.round(performance.now()-started)})); return reply({error:{code:error.code,message:error.message}},status>=400?status:400); }
  const response=reply({data});
  // Active use renews the browser's idle window, never the database hard expiry.
  const remaining=Math.floor((Date.parse(profile.data.expiresAt)-Date.now())/1000);
  if(remaining>0)response.cookies.set(cookieName,token,{...cookieOptions,maxAge:Math.min(12*60*60,remaining)});
  console.info(JSON.stringify({event:'rpc_success',operation,latencyMs:Math.round(performance.now()-started)}));
  return response;
 }catch(error){ console.error(JSON.stringify({event:'rpc_unavailable',operation,latencyMs:Math.round(performance.now()-started),errorClass:error instanceof Error?error.name:'UnknownError'})); return reply({error:{message:'Service temporarily unavailable'}},503);}
}
