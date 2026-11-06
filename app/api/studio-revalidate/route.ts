import {NextResponse} from 'next/server';
import {revalidatePath} from 'next/cache';

/**
 * On-demand cache purge for the public site.
 * The admin studio calls this after a successful create/update/delete so a newly published
 * record shows up immediately instead of waiting for the 30s data cache / 60s route cache.
 * The caller is authorised with the same session the admin API already uses (bearer token or
 * the httpOnly cookie), verified against the existing /auth/me endpoint.
 */
const API = process.env.API_URL || 'http://localhost:4000/api';

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');
  if (!authorization && !cookie) return NextResponse.json({revalidated: false, reason: 'No session'}, {status: 401});

  let role = '';
  try {
    const me = await fetch(API + '/auth/me', {
      headers: {...(authorization ? {authorization} : {}), ...(cookie ? {cookie} : {})},
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!me.ok) return NextResponse.json({revalidated: false, reason: 'Invalid session'}, {status: 401});
    role = String((await me.json())?.role || '');
  } catch {
    return NextResponse.json({revalidated: false, reason: 'API unavailable'}, {status: 503});
  }

  if (!['ADMIN', 'EDITOR'].includes(role)) return NextResponse.json({revalidated: false, reason: 'Not permitted'}, {status: 403});

  revalidatePath('/', 'layout');
  return NextResponse.json({revalidated: true, at: Date.now()});
}
