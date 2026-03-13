import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PrintButtonClient from '@/components/pages/print-button-client'
import { MOCK_RECIPES } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

interface IngredientSection {
  title?: string;
  ingredients: string[];
}

interface RecipeJson {
  servings?: number;
  total_time?: string;
  prep_time?: string;
  cook_time?: string;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  ingredient_sections?: IngredientSection[];
  ingredients?: string[];
  recipeIngredient?: string[];
  steps?: string[];
  instructions?: string[];
  recipeInstructions?: string[];
  nutrition_per_serving?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  notes?: string;
  tools?: string[];
  mood?: string;
  presentation?: string;
  drink_pairings?: string[];
}

interface PrintPageProps {
  params: Promise<{ slug: string }>;
}

// Mock detail data for print (subset matching recipe page mock data)
const MOCK_PRINT_DETAILS: Record<string, {
  servings: number; total_time: string; prep_time: string; cook_time: string;
  ingredients: string[]; steps: string[];
  nutrition: { calories: number; protein: number; carbs: number; fat: number };
}> = {
  'classic-margherita-pizza': {
    servings: 4, total_time: '45 min', prep_time: '20 min', cook_time: '25 min',
    ingredients: ['500g pizza dough', '200ml tomato passata', '250g fresh mozzarella, torn', '10 fresh basil leaves', '3 tbsp olive oil', 'Salt and pepper to taste'],
    steps: ['Preheat oven to 250°C (480°F) with a pizza stone or baking tray inside.', 'Roll out the dough on a floured surface to a 30cm circle, about 3–4mm thick.', 'Spread the tomato passata evenly, leaving a 2cm border.', 'Tear the mozzarella and distribute over the sauce.', 'Slide onto the hot stone/tray and bake 12–15 min until the crust is golden and cheese is bubbling.', 'Remove from oven, scatter fresh basil, drizzle olive oil, season and serve immediately.'],
    nutrition: { calories: 480, protein: 22, carbs: 58, fat: 18 },
  },
  'pad-thai-noodles': {
    servings: 2, total_time: '30 min', prep_time: '15 min', cook_time: '15 min',
    ingredients: ['200g flat rice noodles', '200g large shrimp, peeled', '2 eggs', '3 tbsp tamarind paste', '2 tbsp fish sauce', '1 tbsp palm sugar', '3 spring onions, chopped', '100g bean sprouts', '2 tbsp vegetable oil', 'Crushed peanuts and lime to serve'],
    steps: ['Soak noodles in warm water 20 min; drain.', 'Mix tamarind, fish sauce, and sugar; set aside.', 'Heat oil in a wok over high heat. Add shrimp and cook 2 min until pink; push to one side.', 'Crack eggs into the wok, scramble briefly, then combine with the shrimp.', 'Add noodles and sauce; toss vigorously 2–3 min.', 'Add spring onions and bean sprouts; toss 30 sec.', 'Serve topped with crushed peanuts and a lime wedge.'],
    nutrition: { calories: 520, protein: 32, carbs: 65, fat: 14 },
  },
  'moroccan-tagine': {
    servings: 6, total_time: '2.5 hrs', prep_time: '30 min', cook_time: '2 hrs',
    ingredients: ['1kg lamb shoulder, cubed', '2 onions, sliced', '4 garlic cloves', '2 tsp ras el hanout', '1 tsp cinnamon', '400g chickpeas', '100g dried apricots', '400ml chicken stock', '2 tbsp olive oil'],
    steps: ['Season lamb with ras el hanout, cinnamon, and ginger.', 'Heat oil in a heavy tagine or Dutch oven. Brown the lamb in batches; set aside.', 'Sauté onions and garlic until softened, about 8 minutes.', 'Return lamb to the pot; add stock, chickpeas, and apricots.', 'Cover and cook on low heat for 1.5–2 hours until lamb is tender.', 'Garnish with fresh cilantro and serve with couscous or flatbread.'],
    nutrition: { calories: 620, protein: 45, carbs: 38, fat: 28 },
  },
}

function getMockPrintDetail(slug: string) {
  return MOCK_PRINT_DETAILS[slug] || {
    servings: 4, total_time: '45 min', prep_time: '15 min', cook_time: '30 min',
    ingredients: ['Fresh quality ingredients', 'Spices and seasonings to taste', 'Olive oil or butter', 'Garnishes as desired'],
    steps: ['Prepare all ingredients: wash, chop, and measure as needed.', 'Follow the traditional cooking method for this dish, paying attention to heat and timing.', 'Season generously throughout the cooking process.', 'Plate beautifully and serve immediately.'],
    nutrition: { calories: 400, protein: 18, carbs: 45, fat: 16 },
  }
}

const PRINT_STYLES = `
  /* ── Screen styles ── */
  @media screen {
    html, body { background: #fff !important; color: #111 !important; }
    .print-page { background: #fff; color: #111; }
    .no-print-btn { position: fixed; bottom: 24px; right: 24px; z-index: 50; }
  }

  /* ── Print styles ── */
  @media print {
    nav, footer, header[data-nav], .no-print { display: none !important; }

    html, body {
      margin: 0;
      padding: 0;
      font-size: 13pt;
      line-height: 1.6;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    @page {
      size: A4;
      margin: 1.8cm 2.2cm;
    }

    /* Make page fill full print width */
    .print-page {
      max-width: 100% !important;
      width: 100% !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    h1 { font-size: 24pt !important; margin-bottom: 6pt !important; }
    h2 { font-size: 16pt !important; margin-bottom: 8pt !important; }
    h3 { font-size: 12pt !important; }

    .recipe-meta { font-size: 11pt; }
    .ingredient-item { font-size: 12pt; line-height: 1.7; }
    .step-text { font-size: 12pt; line-height: 1.7; }

    .print-cols {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 2cm;
    }

    .step-block { break-inside: avoid; margin-bottom: 10pt; }
    .section-break { break-before: auto; }

    a { text-decoration: none; color: #000; }
    img { max-width: 100%; height: auto; }

    .divider { border-color: #999 !important; }
  }

  /* ── Screen layout (generous, readable) ── */
  @media screen {
    .print-page {
      max-width: 860px;
      margin: 0 auto;
      padding: 40px 48px 80px;
    }

    h1 { font-size: 2rem; font-weight: 800; margin: 0 0 8px; line-height: 1.2; }
    h2 { font-size: 1.25rem; font-weight: 700; margin: 0 0 12px; }
    h3 { font-size: 0.95rem; font-weight: 700; margin: 0 0 6px; }

    .recipe-meta { font-size: 0.95rem; color: #555; }
    .ingredient-item { font-size: 1rem; line-height: 1.7; }
    .step-text { font-size: 1rem; line-height: 1.7; }

    .print-cols {
      display: grid;
      grid-template-columns: 260px 1fr;
      gap: 48px;
      margin-top: 32px;
    }

    .step-block { margin-bottom: 16px; }
    .divider { border-color: #ddd !important; }
  }

  @media screen and (max-width: 680px) {
    .print-page { padding: 24px 20px 80px; }
    .print-cols { grid-template-columns: 1fr; gap: 32px; }
  }
`

function RecipeBody({
  title, region, creatorName, creatorHandle,
  totalTime, prepTime, cookTime, servings, dietTags,
  ingredientSections, steps, nutrition, notes, tools, drinkPairings,
  slug,
}: {
  title: string
  region?: string
  creatorName?: string
  creatorHandle?: string
  totalTime?: string | null
  prepTime?: string | null
  cookTime?: string | null
  servings: number
  dietTags?: string[]
  ingredientSections: IngredientSection[]
  steps: string[]
  nutrition?: { calories?: number; protein?: number; carbs?: number; fat?: number } | null
  notes?: string | null
  tools?: string[] | null
  drinkPairings?: string[] | null
  slug: string
}) {
  const metaParts = [
    region,
    totalTime && `Total: ${totalTime}`,
    prepTime && `Prep: ${prepTime}`,
    cookTime && `Cook: ${cookTime}`,
    `${servings} servings`,
    ...(dietTags ?? []),
  ].filter(Boolean) as string[]

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      <main className="print-page">
        <PrintButtonClient />

        {/* Back link — screen only */}
        <div className="no-print" style={{ marginBottom: 24 }}>
          <a
            href={`/recipes/${slug}`}
            style={{ fontSize: '0.875rem', color: '#666', textDecoration: 'none' }}
          >
            ← Back to recipe
          </a>
        </div>

        {/* Header */}
        <header style={{ marginBottom: 24 }}>
          <h1>{title}</h1>

          {metaParts.length > 0 && (
            <p className="recipe-meta" style={{ margin: '0 0 6px' }}>
              {metaParts.join(' · ')}
            </p>
          )}

          {creatorName && (
            <p style={{ fontSize: '0.85rem', color: '#888', margin: 0 }}>
              By {creatorName}{creatorHandle ? ` (@${creatorHandle})` : ''}
            </p>
          )}

          <hr className="divider" style={{ marginTop: 16, border: 'none', borderTop: '1.5px solid #ddd' }} />
        </header>

        {/* Two-column body */}
        <div className="print-cols">
          {/* Ingredients */}
          <section>
            <h2>Ingredients</h2>
            {ingredientSections.map((section, sIdx) => (
              <div key={sIdx} style={sIdx > 0 ? { marginTop: 20 } : {}}>
                {section.title && (
                  <h3 style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: '#666', fontSize: '0.8rem', marginBottom: 6 }}>
                    {section.title}
                  </h3>
                )}
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {section.ingredients.map((ing, iIdx) => (
                    <li key={iIdx} className="ingredient-item" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingBottom: 4 }}>
                      <span style={{
                        flexShrink: 0,
                        display: 'inline-block',
                        width: 14,
                        height: 14,
                        marginTop: 4,
                        border: '1.5px solid #aaa',
                        borderRadius: 3,
                      }} />
                      {ing}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          {/* Directions */}
          <section className="section-break">
            <h2>Directions</h2>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {steps.map((step, idx) => (
                <li key={idx} className="step-block" style={{ display: 'flex', gap: 14 }}>
                  <span style={{
                    flexShrink: 0,
                    fontWeight: 800,
                    fontSize: '1.1rem',
                    color: '#bbb',
                    width: 28,
                    paddingTop: 1,
                    textAlign: 'right',
                    lineHeight: 1.6,
                  }}>
                    {idx + 1}
                  </span>
                  <span className="step-text">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Optional extras */}
        {(nutrition || notes || tools || drinkPairings) && (
          <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1.5px solid #ddd' }}>
            {nutrition && (nutrition.calories || nutrition.protein) && (
              <div style={{ marginBottom: 16 }}>
                <h3>Nutrition per serving</h3>
                <p style={{ fontSize: '0.95rem', color: '#555', margin: 0 }}>
                  {[
                    nutrition.calories && `${nutrition.calories} kcal`,
                    nutrition.protein && `${nutrition.protein}g protein`,
                    nutrition.carbs && `${nutrition.carbs}g carbs`,
                    nutrition.fat && `${nutrition.fat}g fat`,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
            )}

            {tools && tools.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3>Tools needed</h3>
                <p style={{ fontSize: '0.95rem', color: '#555', margin: 0 }}>{tools.join(', ')}</p>
              </div>
            )}

            {drinkPairings && drinkPairings.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3>Drink pairings</h3>
                <p style={{ fontSize: '0.95rem', color: '#555', margin: 0 }}>{drinkPairings.join(', ')}</p>
              </div>
            )}

            {notes && (
              <div style={{ marginBottom: 16 }}>
                <h3>Notes</h3>
                <p style={{ fontSize: '0.95rem', color: '#555', margin: 0 }}>{notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <footer style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #eee', fontSize: '0.75rem', color: '#aaa' }}>
          <p style={{ margin: 0 }}>Printat de pe MareChef.ro — marechef.ro/recipes/{slug}</p>
        </footer>
      </main>
    </>
  )
}

export default async function PrintRecipePage({ params }: PrintPageProps) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: post } = await supabase
    .from('posts')
    .select(`
      *,
      approaches(name),
      profiles:created_by(display_name, handle)
    `)
    .eq('slug', slug)
    .eq('type', 'recipe')
    .single()

  // Mock fallback when Supabase is not available
  if (!post) {
    const mockRecipe = MOCK_RECIPES.find(r => r.slug === slug)
    if (!mockRecipe) notFound()

    const detail = getMockPrintDetail(slug)

    return (
      <RecipeBody
        title={mockRecipe!.title}
        region={mockRecipe!.region}
        creatorName={mockRecipe!.created_by.display_name}
        creatorHandle={mockRecipe!.created_by.handle}
        totalTime={detail.total_time}
        prepTime={detail.prep_time}
        cookTime={detail.cook_time}
        servings={detail.servings}
        dietTags={mockRecipe!.dietTags}
        ingredientSections={[{ ingredients: detail.ingredients }]}
        steps={detail.steps}
        nutrition={detail.nutrition}
        slug={slug}
      />
    )
  }

  const recipeData = (post.recipe_json || {}) as RecipeJson

  const ingredientSections: IngredientSection[] = recipeData.ingredient_sections
    ? recipeData.ingredient_sections
    : recipeData.ingredients
      ? [{ ingredients: recipeData.ingredients }]
      : recipeData.recipeIngredient
        ? [{ ingredients: recipeData.recipeIngredient }]
        : []

  const steps: string[] = recipeData.instructions || recipeData.steps || recipeData.recipeInstructions || []

  const approach = Array.isArray(post.approaches)
    ? (post.approaches as Array<{ name: string }>)[0]
    : (post.approaches as { name: string } | null)

  const creator = Array.isArray(post.profiles)
    ? (post.profiles as Array<{ display_name: string; handle: string }>)[0]
    : (post.profiles as { display_name: string; handle: string } | null)

  return (
    <RecipeBody
      title={post.title}
      region={approach?.name}
      creatorName={creator?.display_name}
      creatorHandle={creator?.handle}
      totalTime={recipeData.total_time || (recipeData.prep_time_minutes && recipeData.cook_time_minutes ? `${recipeData.prep_time_minutes + recipeData.cook_time_minutes} min` : null)}
      prepTime={recipeData.prep_time || (recipeData.prep_time_minutes ? `${recipeData.prep_time_minutes} min` : null)}
      cookTime={recipeData.cook_time || (recipeData.cook_time_minutes ? `${recipeData.cook_time_minutes} min` : null)}
      servings={recipeData.servings ?? 4}
      dietTags={post.diet_tags ?? []}
      ingredientSections={ingredientSections}
      steps={steps}
      nutrition={recipeData.nutrition_per_serving}
      notes={recipeData.notes}
      tools={recipeData.tools}
      drinkPairings={recipeData.drink_pairings}
      slug={slug}
    />
  )
}
