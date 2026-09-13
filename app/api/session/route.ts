import {NextResponse,type NextRequest} from 'next/server';
import {cacheId,cookieName,cookieOptions,database,jsonBody,sameOrigin,sessionToken} from './security';

export const runtime='nodejs';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:NextRequest){
 if(!sameOrigin(request))return reply({error:'Request origin rejected'},403);
 let body:Record<string,unknown>;
 try{body=await jsonBody(request);}catch{return reply({error:'Invalid request'},400);}
 if(typeof body.username!=='string'||typeof body.password!=='string'||body.username.length>120||body.password.length>72)return reply({error:'Invalid credentials'},400);
 try{
  const client=database();
  const {data,error}=await client.rpc('login_user',{p_username:body.username,p_password:body.password});
  if(error||!data?.token||data.error)return reply({error:data?.error||'Invalid username or password'},401);
  const token=String(data.token);
  const profile=await client.rpc('retail_session_profile',{p_token:token});
  if(profile.error||!profile.data){await client.rpc('logout_user',{p_token:token});return reply({error:'Unable to establish session'},503);}
  const previous=sessionToken(request);
  if(previous&&previous!==token)await client.rpc('logout_user',{p_token:previous});
  const response=reply({...profile.data,cacheId:cacheId(token)});
  response.cookies.set(cookieName,token,{...cookieOptions,maxAge:12*60*60});
  return response;
 }catch{return reply({error:'Unable to sign in'},503);}
}
export async function GET(request:NextRequest){
 const token=sessionToken(request);if(!token)return reply({error:'Sign in required'},401);
 try{
  const {data,error}=await database().rpc('retail_session_profile',{p_token:token});
  if(error)return reply({error:'Service temporarily unavailable'},503);
  if(!data)return reply({error:'Session expired. Sign in again.'},401);
  return reply({...data,cacheId:cacheId(token)});
 }catch{return reply({error:'Service temporarily unavailable'},503);}
}
export async function DELETE(request:NextRequest){
 if(!sameOrigin(request))return reply({error:'Request origin rejected'},403);
 const token=sessionToken(request);
 try{if(token){const {error}=await database().rpc('logout_user',{p_token:token});if(error)return reply({error:'Could not revoke session. Retry logout.'},503);}}
 catch{return reply({error:'Could not revoke session. Retry logout.'},503);}
 const response=reply({ok:true});response.cookies.set(cookieName,'',{...cookieOptions,maxAge:0});return response;
}
