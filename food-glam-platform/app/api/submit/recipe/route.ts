import { NextRequest, NextResponse } from 'next/server';
import { validateRecipe } from '@/lib/recipe-validator';
import { rateLimit } from '@/lib/rate-limit';
import { SubmissionResponse, RecipeSubmission } from '@/types/submission';

// In-memory store for dev (resets on server restart)
// In production this would be Supabase
const submissionsStore: RecipeSubmission[] = [];

const MAX_POSTS_PER_DAY = 1;

/** Check if a submission was made in the last 24 hours (dev in-memory) */
function hasSubmittedTodayDev(): boolean {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return submissionsStore.some((s) => s.createdAt > oneDayAgo);
}

export async function POST(req: NextRequest): Promise<NextResponse<SubmissionResponse>> {
  try {
    // Rate limit: 5 submissions per hour per IP
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const { success } = rateLimit(`submit:recipe:${ip}`, 5, 60 * 60 * 1000);
    if (!success) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();

    // Rate limit: 1 post per day
    if (hasSubmittedTodayDev()) {
      return NextResponse.json(
        {
          success: false,
          message: `You can only submit ${MAX_POSTS_PER_DAY} recipe per day. Try again tomorrow.`,
        },
        { status: 429 }
      );
    }

    // Validate input
    const validation = validateRecipe(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Validation failed',
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Create submission object
    const submission: RecipeSubmission = {
      id: `recipe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: body.title,
      description: body.description,
      ingredients: body.ingredients,
      instructions: body.instructions,
      prepTime: body.prepTime,
      cookTime: body.cookTime,
      servings: body.servings,
      difficulty: body.difficulty,
      tags: body.tags,
      cuisine: body.cuisine,
      coverImage: body.coverImage,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to in-memory store (dev) — swap for Supabase insert when ready
    submissionsStore.push(submission);

    console.log(`[submit/recipe] Saved submission: ${submission.id} — "${submission.title}"`);
    console.log(`[submit/recipe] Total submissions in store: ${submissionsStore.length}`);

    return NextResponse.json(
      {
        success: true,
        id: submission.id,
        status: submission.status,
        message: 'Recipe submitted successfully and is pending approval',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Recipe submission error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to submit recipe',
      },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  // Dev endpoint to inspect submitted recipes
  return NextResponse.json({ submissions: submissionsStore, count: submissionsStore.length });
}
