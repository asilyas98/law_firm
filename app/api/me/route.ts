import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { apiError, requireFirmUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'viewer');
    const supabase = getSupabaseAdmin();
    const { data: firm } = await supabase.from('firms').select('id, name, slug, allowed_email_domain').eq('id', user.firmId).maybeSingle();
    return NextResponse.json({ user, firm });
  } catch (error: unknown) {
    return apiError(error);
  }
}
