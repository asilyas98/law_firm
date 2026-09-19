import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { apiError, requireFirmUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'attorney');
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, actor_email, action, matter_id, matter_name, prompt, output_preview, metadata, created_at')
      .eq('firm_id', user.firmId)
      .order('created_at', { ascending: false })
      .limit(75);
    if (error) throw error;
    return NextResponse.json({ logs: data || [] });
  } catch (error: unknown) {
    return apiError(error);
  }
}
