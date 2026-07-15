import config from '@payload-config';
import { getPayload } from 'payload';
import { NextResponse } from 'next/server';

export async function authenticatePayloadRequest(request: Request) {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: request.headers });

  if (!user) {
    return null;
  }

  return { payload, user };
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}
