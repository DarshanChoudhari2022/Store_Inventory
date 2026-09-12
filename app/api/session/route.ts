import {createClient} from '@supabase/supabase-js';
import {NextResponse} from 'next/server';

export const runtime = 'nodejs';

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase is not configured');
  return createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {username?: string; password?: string};
    const {data, error} = await client().rpc('login_user', {p_username: body.username || '', p_password: body.password || ''});
    if (error) return NextResponse.json({error: error.message}, {status: 401});
    if (!data?.token || data.error) return NextResponse.json({error: data?.error || 'Invalid username or password'}, {status: 401});
    const response = NextResponse.json(data);
    response.cookies.set('storestock_session', String(data.token), {httpOnly:true, sameSite:'lax', secure:process.env.NODE_ENV==='production', maxAge:60*60*12, path:'/'});
    return response;
  } catch { return NextResponse.json({error:'Unable to sign in'}, {status:500}); }
}

export async function DELETE() {
  const response = NextResponse.json({ok:true});
  response.cookies.set('storestock_session','',{httpOnly:true, sameSite:'lax', secure:process.env.NODE_ENV==='production', maxAge:0, path:'/'});
  return response;
}
