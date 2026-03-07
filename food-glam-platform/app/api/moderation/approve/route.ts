import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { SubmissionResponse } from '@/types/submission';

interface ModerationPayload {
  recipeId: string;
  action: 'approve' | 'reject';
  reason?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse<SubmissionResponse>> {
  try {
    // Auth + moderator check
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }
    const { data: roles } = await supabase.from('app_roles').select('role').eq('user_id', user.id).in('role', ['moderator', 'admin']).limit(1);
    if (!roles || roles.length === 0) {
      return NextResponse.json({ success: false, message: 'Moderator access required' }, { status: 403 });
    }

    const body: ModerationPayload = await req.json();

    if (!body.recipeId) {
      return NextResponse.json(
        { success: false, message: 'Recipe ID is required' },
        { status: 400 }
      );
    }

    if (!body.action || !['approve', 'reject'].includes(body.action)) {
      return NextResponse.json(
        { success: false, message: 'Action must be approve or reject' },
        { status: 400 }
      );
    }

    // Verify the post exists (reuse supabase client from auth check above)
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('id, status')
      .eq('id', body.recipeId)
      .single();

    if (fetchError || !post) {
      return NextResponse.json(
        { success: false, message: 'Recipe not found' },
        { status: 404 }
      );
    }

    // Map action to status
    const newStatus = body.action === 'approve' ? 'active' : 'rejected';

    const updatePayload: Record<string, string> = { status: newStatus };
    if (body.action === 'reject' && body.reason) {
      updatePayload.rejection_reason = body.reason;
    }

    const { error: updateError } = await supabase
      .from('posts')
      .update(updatePayload)
      .eq('id', body.recipeId);

    if (updateError) {
      console.error('Moderation update error:', updateError);
      return NextResponse.json(
        { success: false, message: 'Failed to update recipe status' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        id: body.recipeId,
        status: body.action === 'approve' ? 'approved' : 'rejected',
        message: `Recipe ${body.action}d successfully`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Moderation error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to process moderation' },
      { status: 500 }
    );
  }
}
