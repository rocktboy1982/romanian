import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import FallbackImage from '@/components/FallbackImage'
import Script from 'next/script'
import type { Metadata } from 'next'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { voteOnPost as _voteOnPost } from '@/app/actions'
import RecipeAdvancedClient from "@/components/pages/recipe-advanced-client"
import SimilarRecipesClient from "@/components/pages/similar-recipes-client"
import RecipeIngredientsClient from "@/components/pages/recipe-ingredients-client"
import RecipeActionsClient from "@/components/pages/recipe-actions-client"
import RecipeCommentsClient from "@/components/pages/recipe-comments-client"
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { MOCK_RECIPES } from '@/lib/mock-data'
import { normalizeToEmbed } from '@/lib/embed'
import FollowChefButton from '@/components/pages/follow-chef-button'
import RecipeRating, { StarDisplay } from '@/components/RecipeRating'
import { AdInArticle, AdSidebar } from '@/components/ads/ad-placements'

// Rich mock recipe details keyed by slug
const MOCK_RECIPE_DETAILS: Record<string, {
  servings: number
  total_time: string
  prep_time: string
  cook_time: string
  ingredients: string[]
  steps: string[]
  nutrition: { calories: number; protein: number; carbs: number; fat: number }
}> = {
  'classic-margherita-pizza': {
    servings: 4, total_time: '45 min', prep_time: '20 min', cook_time: '25 min',
    ingredients: ['500g pizza dough', '200ml tomato passata', '250g fresh mozzarella, torn', '10 fresh basil leaves', '3 tbsp olive oil', 'Salt and pepper to taste'],
    steps: [
      'Preheat oven to 250°C (480°F) with a pizza stone or baking tray inside.',
      'Roll out the dough on a floured surface to a 30cm circle, about 3–4mm thick.',
      'Spread the tomato passata evenly, leaving a 2cm border.',
      'Tear the mozzarella and distribute over the sauce.',
      'Slide onto the hot stone/tray and bake 12–15 min until the crust is golden and cheese is bubbling.',
      'Remove from oven, scatter fresh basil, drizzle olive oil, season and serve immediately.',
    ],
    nutrition: { calories: 480, protein: 22, carbs: 58, fat: 18 },
  },
  'pad-thai-noodles': {
    servings: 2, total_time: '30 min', prep_time: '15 min', cook_time: '15 min',
    ingredients: ['200g flat rice noodles', '200g large shrimp, peeled', '2 eggs', '3 tbsp tamarind paste', '2 tbsp fish sauce', '1 tbsp palm sugar', '3 spring onions, chopped', '100g bean sprouts', '2 tbsp vegetable oil', 'Crushed peanuts and lime to serve'],
    steps: [
      'Soak noodles in warm water 20 min; drain.',
      'Mix tamarind, fish sauce, and sugar; set aside.',
      'Heat oil in a wok over high heat. Add shrimp and cook 2 min until pink; push to one side.',
      'Crack eggs into the wok, scramble briefly, then combine with the shrimp.',
      'Add noodles and sauce; toss vigorously 2–3 min.',
      'Add spring onions and bean sprouts; toss 30 sec.',
      'Serve topped with crushed peanuts and a lime wedge.',
    ],
    nutrition: { calories: 520, protein: 32, carbs: 65, fat: 14 },
  },
  'moroccan-tagine': {
    servings: 6, total_time: '2.5 hrs', prep_time: '30 min', cook_time: '2 hrs',
    ingredients: ['1kg lamb shoulder, cubed', '2 onions, sliced', '4 garlic cloves', '2 tsp ras el hanout', '1 tsp cinnamon', '1 tsp ground ginger', '400g chickpeas', '100g dried apricots', '400ml chicken stock', '2 tbsp olive oil', 'Fresh cilantro to serve'],
    steps: [
      'Season lamb with ras el hanout, cinnamon, and ginger.',
      'Heat oil in a heavy tagine or Dutch oven. Brown the lamb in batches; set aside.',
      'Sauté onions and garlic until softened, about 8 minutes.',
      'Return lamb to the pot; add stock, chickpeas, and apricots.',
      'Cover and cook on low heat for 1.5–2 hours until lamb is tender.',
      'Garnish with fresh cilantro and serve with couscous or flatbread.',
    ],
    nutrition: { calories: 620, protein: 45, carbs: 38, fat: 28 },
  },
  'vegan-buddha-bowl': {
    servings: 2, total_time: '40 min', prep_time: '15 min', cook_time: '25 min',
    ingredients: ['200g quinoa', '1 can chickpeas, drained', '1 sweet potato, cubed', '2 cups kale, massaged', '1 avocado, sliced', '3 tbsp tahini', '2 tbsp lemon juice', '1 garlic clove, minced', 'Olive oil, salt, cumin'],
    steps: [
      'Cook quinoa per package instructions.',
      'Toss sweet potato and chickpeas with olive oil and cumin; roast at 200°C for 25 min.',
      'Make tahini dressing: whisk tahini, lemon juice, garlic, 3 tbsp water, salt.',
      'Assemble bowls: quinoa base, then arrange kale, roasted veggies, chickpeas, avocado.',
      'Drizzle generously with tahini dressing and serve.',
    ],
    nutrition: { calories: 580, protein: 22, carbs: 72, fat: 24 },
  },
  'indian-butter-chicken': {
    servings: 4, total_time: '1 hr', prep_time: '20 min', cook_time: '40 min',
    ingredients: ['800g chicken thighs, cubed', '200ml yogurt', '2 tsp garam masala', '1 tsp turmeric', '1 tsp cumin', '400g tomato puree', '200ml heavy cream', '2 onions, sliced', '4 garlic cloves', '2 tbsp butter', '1 tbsp ginger paste'],
    steps: [
      'Marinate chicken in yogurt, 1 tsp garam masala, and turmeric for 30 min (or overnight).',
      'Grill or pan-fry the marinated chicken until charred at edges; set aside.',
      'Melt butter in a pan; sauté onions until golden. Add garlic and ginger paste, cook 2 min.',
      'Add tomato puree, remaining garam masala, cumin; simmer 15 min.',
      'Add cream and chicken; simmer 10 min until sauce coats the chicken.',
      'Serve with naan or basmati rice, garnished with cilantro.',
    ],
    nutrition: { calories: 540, protein: 42, carbs: 18, fat: 32 },
  },
  'vegetarian-senegalese-mafe': {
    servings: 4, total_time: '55 min', prep_time: '15 min', cook_time: '40 min',
    ingredients: [
      '2 cups natural peanut butter (no sugar)', '400ml vegetable stock', '400g firm tofu, cubed',
      '200g oyster mushrooms, torn', '2 onions, chopped', '3 garlic cloves, minced',
      '1 tbsp dawadawa (fermented locust beans) — or 1 tsp fish-free miso', '2 tbsp tomato paste',
      '1 scotch bonnet or habanero, whole', '2 tbsp palm oil or neutral oil', 'Salt to taste',
      'Cooked rice or fonio to serve',
    ],
    steps: [
      'Press tofu between paper towels for 10 min. Cut into 2 cm cubes.',
      'Heat oil in a heavy pot. Fry tofu until golden on all sides; remove and set aside.',
      'In the same pot, sauté onions until soft, about 7 min. Add garlic, cook 2 min.',
      'Stir in tomato paste and dawadawa; cook 3 min until fragrant.',
      'Whisk peanut butter into the vegetable stock until smooth. Pour into the pot.',
      'Add the whole scotch bonnet and mushrooms. Simmer on low heat 20 min, stirring often to prevent sticking.',
      'Return tofu. Simmer 10 more minutes. Season with salt. Remove the scotch bonnet before serving.',
      'Serve over rice or fonio with a sprinkle of chopped spring onions.',
    ],
    nutrition: { calories: 380, protein: 16, carbs: 28, fat: 22 },
  },
  'simple-vegetarian-jollof-rice': {
    servings: 6, total_time: '1 hr', prep_time: '15 min', cook_time: '45 min',
    ingredients: [
      '500g long-grain parboiled rice', '4 large tomatoes, blended', '2 red bell peppers, blended',
      '2 scotch bonnets (adjust to heat preference)', '2 onions — 1 blended, 1 sliced',
      '3 tbsp tomato paste', '500ml vegetable stock', '3 tbsp vegetable oil',
      '2 bay leaves', '1 tsp dried thyme', '1 tsp ground coriander', '1 tsp smoked paprika',
      'Salt and white pepper to taste',
    ],
    steps: [
      'Blend tomatoes, red peppers, scotch bonnets, and 1 onion until smooth.',
      'Heat oil in a wide pot. Fry the sliced onion until golden, about 8 min.',
      'Add tomato paste; stir and fry 5 min until it darkens slightly.',
      'Pour in the blended tomato mixture. Cook on medium heat 20 min, stirring, until reduced and the raw smell is gone.',
      'Add stock, bay leaves, thyme, coriander, paprika, salt, and pepper. Bring to a boil.',
      'Wash the rice until the water runs clear. Add to the pot — liquid should just cover the rice.',
      'Cover tightly, reduce to the lowest heat, and cook 30 min. Do not lift the lid for the first 20 min.',
      'Check: the rice should be cooked and slightly dry. The bottom crust (kanzo) is intentional and prized.',
      'Remove bay leaves, fluff gently, and serve.',
    ],
    nutrition: { calories: 340, protein: 8, carbs: 68, fat: 6 },
  },
  'ghanaian-red-bean-stew-atidua': {
    servings: 4, total_time: '1 hr 15 min', prep_time: '15 min', cook_time: '1 hr',
    ingredients: [
      '400g dried red cowpeas (or 2 × 400g cans, drained)', '3 tbsp red palm oil',
      '2 onions, sliced', '4 garlic cloves, minced', '2 tbsp dawadawa (fermented locust beans)',
      '2 tomatoes, chopped', '1 scotch bonnet, chopped', '1 tsp ground crayfish (optional)',
      'Salt to taste', 'Cooked rice or boiled yam to serve',
    ],
    steps: [
      'If using dried cowpeas, soak overnight, drain, then simmer in fresh water 45 min until tender.',
      'Heat palm oil in a pot on medium. Add sliced onions and fry until soft and beginning to colour, 10 min.',
      'Add garlic, scotch bonnet, and dawadawa. Stir and fry 3 min.',
      'Add tomatoes and crayfish (if using). Cook 10 min until the tomatoes collapse.',
      'Add the cooked (or canned) cowpeas with a splash of their cooking liquid.',
      'Simmer 15 min, stirring occasionally, until the stew thickens and the beans have absorbed the flavours.',
      'Season generously with salt. Serve with rice or boiled yam.',
    ],
    nutrition: { calories: 290, protein: 14, carbs: 42, fat: 8 },
  },
  'mandazi-mahamri-east-african-fried-dough': {
    servings: 8, total_time: '1 hr 30 min', prep_time: '1 hr', cook_time: '30 min',
    ingredients: [
      '500g plain flour, plus extra for dusting', '2 tsp instant yeast', '2 tbsp caster sugar',
      '1 tsp ground cardamom', '½ tsp ground cinnamon', '200ml coconut milk (full-fat)',
      '60ml warm water', 'Pinch of salt', 'Vegetable oil for deep-frying',
    ],
    steps: [
      'Mix flour, yeast, sugar, cardamom, cinnamon, and salt in a large bowl.',
      'Make a well; pour in coconut milk and warm water. Mix until a soft dough forms.',
      'Knead on a lightly floured surface for 8–10 min until smooth and elastic.',
      'Place in a lightly oiled bowl, cover with a damp cloth, and rest 45 min until doubled.',
      'Divide dough into 4 portions. Roll each into a circle about 5 mm thick, then cut into quarters.',
      'Heat oil to 170°C (340°F). Fry mandazi in batches 3–4 min per side until puffed and golden.',
      'Drain on paper towels. Serve warm, ideally with chai.',
    ],
    nutrition: { calories: 195, protein: 4, carbs: 32, fat: 6 },
  },
  'spiced-sorghum-millet-porridge': {
    servings: 2, total_time: '20 min', prep_time: '5 min', cook_time: '15 min',
    ingredients: [
      '60g sorghum flour', '60g millet flour', '600ml water or oat milk',
      '1 tsp ground cinnamon', '½ tsp ground ginger', '¼ tsp ground cloves',
      '¼ tsp ground nutmeg', '2 tbsp coconut sugar or honey', 'Pinch of salt',
      'To serve: sliced banana, toasted pumpkin seeds, a drizzle of coconut cream',
    ],
    steps: [
      'Whisk sorghum and millet flours with 200ml of the liquid to form a smooth lump-free paste.',
      'Bring remaining 400ml liquid to a gentle boil in a saucepan.',
      'Pour the flour paste into the boiling liquid in a steady stream, whisking constantly.',
      'Cook on medium-low heat, stirring continuously, for 10–12 min until thick and creamy.',
      'Add cinnamon, ginger, cloves, nutmeg, sugar, and salt. Stir well and taste.',
      'Pour into bowls. Top with banana, pumpkin seeds, and a swirl of coconut cream. Serve immediately.',
    ],
    nutrition: { calories: 220, protein: 6, carbs: 44, fat: 3 },
  },
  'waakye-ghanaian-rice-and-beans': {
    servings: 6, total_time: '1 hr 30 min', prep_time: '20 min', cook_time: '1 hr 10 min',
    ingredients: [
      '400g black-eyed peas', '400g white rice (long-grain)', '6–8 dried sorghum leaf stems (or 1 tsp baking soda for colour)',
      '1.2 litres water', '1 tsp salt',
      'To serve: shito (Ghanaian black pepper sauce), fried plantain, boiled egg, gari, spaghetti',
    ],
    steps: [
      'Rinse black-eyed peas. Place in a pot with sorghum stems and 1.2 litres water. Bring to boil.',
      'Cook the peas on medium heat for 30–40 min until about 70% tender — they should still have some bite.',
      'Remove and discard the sorghum stems (the liquid will have turned dark reddish-brown — this is correct).',
      'Wash the rice until water runs clear. Add to the pot with the peas and their liquid.',
      'Add salt. If the liquid does not fully cover the rice, add a little more water.',
      'Cover tightly and cook on low heat 25–30 min until rice is cooked through and liquid is absorbed.',
      'Fluff gently and serve with your choice of shito, fried plantain, boiled egg, gari, and spaghetti.',
    ],
    nutrition: { calories: 310, protein: 11, carbs: 62, fat: 3 },
  },
}

function getMockDetail(slug: string) {
  return MOCK_RECIPE_DETAILS[slug] || {
    servings: 4, total_time: '45 min', prep_time: '15 min', cook_time: '30 min',
    ingredients: ['Fresh quality ingredients', 'Spices and seasonings to taste', 'Olive oil or butter', 'Garnishes as desired'],
    steps: [
      'Prepare all ingredients: wash, chop, and measure as needed.',
      'Follow the traditional cooking method for this dish, paying attention to heat and timing.',
      'Season generously throughout the cooking process.',
      'Plate beautifully and serve immediately.',
    ],
    nutrition: { calories: 400, protein: 18, carbs: 45, fat: 16 },
  }
}

interface IngredientSection {
  title?: string;
  ingredients: string[];
}

interface RecipeJson {
  servings?: number;
  total_time?: string;
  prep_time?: string;
  cook_time?: string;
  ingredient_sections?: IngredientSection[];
  recipeIngredient?: string[];
  steps?: string[];
  recipeInstructions?: string[];
  nutrition_per_serving?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  mood?: string;
  tools?: string[];
  presentation?: string;
  drink_pairings?: string[];
  notes?: string;
  videoUrl?: string;
  photoGallery?: string[];
}

interface RecipePageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Generate static params for all active recipes at build time
 * Enables static generation instead of dynamic rendering on every request
 */
export async function generateStaticParams() {
  const supabase = createServiceSupabaseClient()
  const { data } = await supabase
    .from('posts')
    .select('slug')
    .eq('type', 'recipe')
    .eq('status', 'active')
    .not('slug', 'is', null)
  
  return (data || []).map(post => ({
    slug: post.slug,
  }))
}

// Revalidate every hour for ISR (Incremental Static Regeneration)
export const revalidate = 3600

function VideoEmbed({ url }: { url: string }) {
  const embedUrl = normalizeToEmbed(url)
  if (!embedUrl) return null
  return (
    <div className="rounded-xl overflow-hidden border border-stone-200 shadow-sm bg-black aspect-video">
       <iframe
         src={embedUrl}
         className="w-full h-full"
         allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
         allowFullScreen
         title="Videoclip rețetă"
       />
    </div>
  )
}

function PhotoGallery({ photos }: { photos: string[] }) {
   const valid = photos.filter(Boolean)
   if (valid.length === 0) return null
   return (
     <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
       {valid.map((src, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-48 h-36 rounded-xl overflow-hidden border border-stone-200 shadow-sm snap-start relative"
          >
            <FallbackImage
              src={src}
              alt={`Photo ${i + 1}`}
              fill
              className="object-cover hover:scale-105 transition-transform duration-300"
              sizes="200px"
              fallbackEmoji="🍽️"
            />
         </div>
       ))}
     </div>
   )
 }

/**
 * Helper function to convert time string (e.g., "30 min") to ISO 8601 duration (e.g., "PT30M")
 */
function timeStringToISO8601(timeStr: string): string {
  if (!timeStr) return 'PT0M'
  const match = timeStr.match(/(\d+)\s*(min|hour|hr|h|m)?/i)
  if (!match) return 'PT0M'
  const value = parseInt(match[1], 10)
  const unit = match[2]?.toLowerCase() || 'min'
  if (unit === 'hour' || unit === 'hr' || unit === 'h') {
    return `PT${value}H`
  }
  return `PT${value}M`
}

/**
 * Generate JSON-LD structured data for Recipe schema.org
 */
function generateRecipeJsonLd(recipe: any, detail: any, slug: string) {
  const baseUrl = 'https://marechef.ro'
  const recipeUrl = `${baseUrl}/recipes/${slug}`

  // Parse times to ISO 8601 duration format
  const prepTime = timeStringToISO8601(detail.prep_time)
  const cookTime = timeStringToISO8601(detail.cook_time)
  const totalTime = timeStringToISO8601(detail.total_time)

  // Build recipeInstructions array with HowToStep
  const recipeInstructions = detail.steps.map((step: string, idx: number) => ({
    '@type': 'HowToStep',
    position: idx + 1,
    text: step,
  }))

  // Build recipeIngredient array
  const recipeIngredient = detail.ingredients || []

  // Build nutrition information
  const nutrition = detail.nutrition || {}

  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.title,
    description: recipe.summary || recipe.title,
    image: recipe.hero_image_url || `${baseUrl}/og-default.jpg`,
    author: {
      '@type': 'Person',
      name: recipe.created_by?.display_name || 'MareChef',
    },
    prepTime,
    cookTime,
    totalTime,
    recipeYield: `${detail.servings} porții`,
    recipeCategory: 'Rețetă',
    recipeCuisine: recipe.region || 'Internațional',
    recipeIngredient,
    recipeInstructions,
    nutrition: {
      '@type': 'NutritionInformation',
      calories: `${nutrition.calories || 0} calories`,
      carbohydrateContent: `${nutrition.carbs || 0}g`,
      proteinContent: `${nutrition.protein || 0}g`,
      fatContent: `${nutrition.fat || 0}g`,
    },
    url: recipeUrl,
  }

  // Add optional fields
  if (recipe.votes) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Math.min(5, Math.max(1, (recipe.votes / 20))),
      ratingCount: recipe.votes,
    }
  }

  if (recipe.created_at) {
    jsonLd.datePublished = new Date(recipe.created_at).toISOString().split('T')[0]
  }

  return jsonLd
}

/**
 * Generate metadata for recipe pages (SEO)
 * Includes title, description, OG image, Twitter card, canonical URL
 */
export async function generateMetadata({ params }: RecipePageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()
  const baseUrl = 'https://marechef.ro'

  // Try Supabase first
  const { data: post } = await supabase
    .from('posts')
    .select('title, summary, hero_image_url, votes, created_at')
    .eq('slug', slug)
    .eq('type', 'recipe')
    .single()

  // Fall back to mock data
  let recipe = post
  if (!recipe) {
    const mockRecipe = MOCK_RECIPES.find(r => r.slug === slug)
    if (!mockRecipe) {
      return {
        title: 'Rețeta nu a fost găsită | MareChef.ro',
        description: 'Rețeta pe care o cauți nu a fost găsită.',
      }
    }
    recipe = {
      title: mockRecipe.title,
      summary: mockRecipe.summary,
      hero_image_url: mockRecipe.hero_image_url,
      votes: mockRecipe.votes,
      created_at: new Date().toISOString(),
    }
  }

  const title = `${recipe.title} | MareChef.ro`
  const description = recipe.summary || `Descoperă rețeta pentru ${recipe.title} pe MareChef.ro - o platformă culinară elegantă cu rețete din toată lumea.`
  const imageUrl = recipe.hero_image_url || `${baseUrl}/og-default.jpg`
  const canonicalUrl = `${baseUrl}/recipes/${slug}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'article',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: recipe.title,
        },
      ],
      locale: 'ro_RO',
      siteName: 'MareChef.ro',
      publishedTime: recipe.created_at ? new Date(recipe.created_at).toISOString() : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    alternates: {
      canonical: canonicalUrl,
    },
  }
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Try Supabase first
  const { data: post } = await supabase
    .from('posts')
    .select(`
      *,
      approaches(name, slug),
      profiles:created_by(id, display_name, handle, avatar_url)
    `)
    .eq('slug', slug)
    .eq('type', 'recipe')
    .single()

  // Fall back to mock data if Supabase has no matching recipe
  if (!post) {
    const mockRecipe = MOCK_RECIPES.find(r => r.slug === slug)
    if (!mockRecipe) {
      notFound()
    }

    const detail = getMockDetail(slug)
    // Prefer the recipe's own nutrition over the detail fallback
    const detailNutrition = detail.nutrition.calories === 400 && MOCK_RECIPE_DETAILS[slug] === undefined
      ? { calories: mockRecipe.nutrition_per_serving?.calories ?? 400, protein: mockRecipe.nutrition_per_serving?.protein ?? 18, carbs: mockRecipe.nutrition_per_serving?.carbs ?? 45, fat: mockRecipe.nutrition_per_serving?.fat ?? 16 }
      : detail.nutrition
    const ingredientSections: IngredientSection[] = [{ ingredients: detail.ingredients }]
    const steps = detail.steps
    const heroImage = mockRecipe.hero_image_url
    const creator = mockRecipe.created_by
    const dietTags = mockRecipe.dietTags || []
    const isTested = mockRecipe.is_tested
    const votes = mockRecipe.votes

    // Generate JSON-LD for SEO
    const jsonLdData = generateRecipeJsonLd(mockRecipe, detail, slug)

    return (
      <>
        <Script
          id="recipe-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
          strategy="afterInteractive"
        />
        <main className="min-h-screen pb-24 md:pb-8" style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
          {/* Hero Section */}
         <div className="relative w-full h-[50vh] min-h-[320px] max-h-[480px] overflow-hidden">
            <FallbackImage src={heroImage} alt={mockRecipe.title} fill className="object-cover" sizes="100vw" fallbackEmoji="🍽️" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
            <div className="container mx-auto max-w-4xl">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white backdrop-blur-sm">
                  {mockRecipe.region}
                </span>
                {isTested && (
                   <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/90 text-white backdrop-blur-sm">
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                       <polyline points="20 6 9 17 4 12"/>
                     </svg>
                     Testată
                   </span>
                 )}
                {dietTags.map((tag: string) => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-white/15 text-white/90 backdrop-blur-sm">
                    {tag}
                  </span>
                ))}
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight">
                {mockRecipe.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-white/80 text-sm">
                <span className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {detail.total_time}
                </span>
                <span className="flex items-center gap-1.5">Preparare: {detail.prep_time}</span>
                <span className="flex items-center gap-1.5">Gătire: {detail.cook_time}</span>
                <span className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  </svg>
                   {detail.servings} porții
                </span>
                <span className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                  </svg>
                  <StarDisplay votes={votes} size={14} showCount={true} />
                </span>
             </div>
           </div>
         </div>
        </div>

        {/* Main Content */}
       <div className="container mx-auto max-w-4xl px-4 md:px-6 -mt-6 relative z-10">
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Summary */}
              {mockRecipe.summary && (
                <Card className="shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-muted-foreground leading-relaxed">{mockRecipe.summary}</p>
                  </CardContent>
                </Card>
              )}

              {/* Action bar */}
              <Card className="shadow-lg border-0 bg-card/95 backdrop-blur-sm">
                <CardContent className="p-5">
                  <RecipeActionsClient
                    recipeId={mockRecipe.id}
                    slug={slug}
                    title={mockRecipe.title}
                    exportData={{
                      servings: detail.servings,
                      total_time: detail.total_time,
                      prep_time: detail.prep_time,
                      cook_time: detail.cook_time,
                      ingredients: detail.ingredients,
                      steps: detail.steps,
                      nutrition: detailNutrition,
                      region: mockRecipe.region,
                      dietTags: mockRecipe.dietTags,
                      creator: `${mockRecipe.created_by.display_name} (@${mockRecipe.created_by.handle})`,
                    }}
                  />
                </CardContent>
              </Card>

               {/* Ingredients */}
               <Card className="shadow-sm">
                 <CardHeader className="pb-3">
                   <CardTitle className="flex items-center gap-2 text-lg">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                       <path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l3.58-3.58c.94-.94.94-2.48 0-3.42L9 5z"/>
                       <path d="M6 9.01V9"/>
                     </svg>
                      Ingrediente
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RecipeIngredientsClient sections={ingredientSections} showCalories />
                 </CardContent>
               </Card>

               {/* Ad: In-article between ingredients and directions */}
               <AdInArticle placement="recipe-between-ingredients-directions" />

               {/* Photo Gallery */}
              {(detail as { photoGallery?: string[] }).photoGallery && (detail as { photoGallery?: string[] }).photoGallery!.length > 0 && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                        <path d="m21 15-5-5L5 21"/>
                      </svg>
                       Galerie
                     </CardTitle>
                   </CardHeader>
                   <CardContent>
                     <PhotoGallery photos={(detail as { photoGallery?: string[] }).photoGallery!} />
                  </CardContent>
                </Card>
              )}

              {/* Steps */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                    </svg>
                     Instrucțiuni
                   </CardTitle>
                 </CardHeader>
                 <CardContent>
                   <ol className="space-y-4">
                    {steps.map((step: string, idx: number) => (
                      <li key={idx} className="flex gap-4">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <p className="text-sm leading-relaxed pt-1 flex-1">{step}</p>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>

              <RecipeAdvancedClient
                nutrition={detailNutrition}
                fasting={undefined}
                foodLog={false}
                ingredients={detail.ingredients}
              />

              <RecipeCommentsClient
                recipeId={mockRecipe.id}
                slug={slug}
              />
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Community rating */}
              <RecipeRating
                recipeId={mockRecipe.id}
                initialVotes={mockRecipe.votes}
                initialQualityScore={mockRecipe.quality_score}
              />
               {/* Tags */}
               <Card className="shadow-sm">
                 <CardContent className="p-4">
                   <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Etichete</p>
                  <div className="flex flex-wrap gap-1.5">
                    {mockRecipe.foodTags?.map((tag: string) => (
                      <span key={tag} className="px-2.5 py-1 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200">
                        {tag}
                      </span>
                    ))}
                    {dietTags.map((tag: string) => (
                      <span key={tag} className="px-2.5 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>

               {/* Creator */}
               <Card className="shadow-sm">
                 <CardContent className="p-4">
                   <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Creat de</p>
                    <div className="flex items-center gap-3">
                       {creator.avatar_url ? (
                         <FallbackImage src={creator.avatar_url} alt={creator.display_name} width={40} height={40} className="w-10 h-10 rounded-full object-cover" fallbackEmoji="👨‍🍳" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{creator.display_name.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                     <div className="flex-1 min-w-0">
                       <p className="font-medium text-sm truncate">{creator.display_name}</p>
                       <p className="text-xs text-muted-foreground">{creator.handle}</p>
                     </div>
                   </div>
                   <FollowChefButton handle={creator.handle} displayName={creator.display_name} />
                 </CardContent>
               </Card>

              {/* Nutrition */}
               {detailNutrition && (
                 <Card className="shadow-sm">
                   <CardContent className="p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Nutriție per porție</p>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { label: 'Calorii', value: detailNutrition.calories, unit: 'kcal' },
                          { label: 'Proteine',  value: detailNutrition.protein,  unit: 'g' },
                          { label: 'Carbohidrați',    value: detailNutrition.carbs,    unit: 'g' },
                          { label: 'Grăsimi',      value: detailNutrition.fat,      unit: 'g' },
                       ] as const).map(({ label, value, unit }) => (
                         <div key={label} className="bg-stone-50 rounded-lg p-2.5 text-center">
                           <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                           <p className="text-sm font-bold">{value}<span className="text-[10px] font-normal ml-0.5">{unit}</span></p>
                         </div>
                       ))}
                     </div>
                   </CardContent>
                 </Card>
               )}

               {/* Ad: Sidebar */}
               <AdSidebar placement="recipe-sidebar" />

                {/* Back to browse */}
               <Link href="/search">
                 <Button variant="outline" className="w-full">Descoperă mai multe rețete</Button>
               </Link>
           </div>
         </div>
       </div>
     </main>
      </>
    )
  }

  // --- Supabase post found ---
  // Get vote count
  const { count: voteCount } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', post.id)

  // Parse recipe JSON
  const recipeData = (post.recipe_json || {}) as RecipeJson

  // Normalize ingredients into sections
  // Supports: ingredient_sections, recipeIngredient, or ingredients (our seeded format)
  const rawIngredients: string[] =
    recipeData.recipeIngredient ||
    (recipeData as unknown as { ingredients?: string[] }).ingredients ||
    []
  const ingredientSections: IngredientSection[] = recipeData.ingredient_sections
    ? recipeData.ingredient_sections
    : rawIngredients.length > 0
      ? [{ ingredients: rawIngredients }]
      : []

  // Normalize steps
  // Supports: steps, recipeInstructions, or instructions (our seeded format)
  const steps: string[] =
    recipeData.steps ||
    recipeData.recipeInstructions ||
    (recipeData as unknown as { instructions?: string[] }).instructions ||
    []

  // Approach info
  const approach = Array.isArray(post.approaches)
    ? (post.approaches as Array<{ name: string; slug: string }>)[0]
    : (post.approaches as { name: string; slug: string } | null)

  // Creator info
  const creator = Array.isArray(post.profiles)
    ? (post.profiles as Array<{ id: string; display_name: string; handle: string; avatar_url: string | null }>)[0]
    : (post.profiles as { id: string; display_name: string; handle: string; avatar_url: string | null } | null)

  // Check if current user is the owner
  const isOwner = !!(user && creator && user.id === creator.id)

  const heroImage = post.hero_image_url || `https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=600&fit=crop`
  const imageAttribution = (post as Record<string, unknown>).image_attribution as {
    source?: string; photographer?: string; photographerUrl?: string; sourceUrl?: string
  } | null
  const servings = recipeData.servings || 4
  // Support both string times ("45 min") and numeric minutes (45)
  const seededData = recipeData as unknown as { prep_time_minutes?: number; cook_time_minutes?: number }
  const formatMin = (m: number) => m >= 60 ? `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`
  const prepTime = recipeData.prep_time || (seededData.prep_time_minutes ? formatMin(seededData.prep_time_minutes) : null)
  const cookTime = recipeData.cook_time || (seededData.cook_time_minutes ? formatMin(seededData.cook_time_minutes) : null)
  const totalTime = recipeData.total_time || (seededData.prep_time_minutes && seededData.cook_time_minutes
    ? formatMin(seededData.prep_time_minutes + seededData.cook_time_minutes) : null)
  const votes = voteCount || 0
  const dietTags = post.diet_tags || []
  const isTested = post.is_tested
  const sourceUrl = (post as Record<string, unknown>).source_url as string | null

  // Generate JSON-LD for SEO
  const jsonLdData = generateRecipeJsonLd(post, {
    servings,
    prep_time: prepTime,
    cook_time: cookTime,
    total_time: totalTime,
    ingredients: rawIngredients,
    steps,
    nutrition: recipeData.nutrition_per_serving || {},
  }, slug)

  return (
    <>
      <Script
        id="recipe-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
        strategy="afterInteractive"
      />
       <main className="min-h-screen pb-24 md:pb-8">
       {/* Hero Section */}
        <div className="relative w-full h-[50vh] min-h-[320px] max-h-[480px] overflow-hidden">
          <FallbackImage
            src={heroImage}
            alt={post.title}
            fill
            className="object-cover"
            sizes="100vw"
            fallbackEmoji="🍽️"
          />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Photo attribution (Unsplash/Pexels/Pixabay compliance) */}
        {imageAttribution?.photographer && (
          <div className="absolute top-3 right-3 z-10">
            <span className="text-[10px] text-white/70 bg-black/40 backdrop-blur-sm rounded px-2 py-1">
              Foto de{' '}
              <a href={imageAttribution.photographerUrl || '#'} target="_blank" rel="noopener noreferrer" className="underline hover:text-white/90">
                {imageAttribution.photographer}
              </a>
              {' pe '}
              <a
                href={imageAttribution.sourceUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white/90"
              >
                {imageAttribution.source === 'unsplash' ? 'Unsplash' : imageAttribution.source === 'pexels' ? 'Pexels' : imageAttribution.source === 'pixabay' ? 'Pixabay' : imageAttribution.source || ''}
              </a>
            </span>
          </div>
        )}

        {/* Content on hero */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <div className="container mx-auto max-w-4xl">
            {/* Badges row */}
            <div className="flex flex-wrap gap-2 mb-3">
              {approach && (
                <Link
                  href={`/approaches/${approach.slug}`}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
                >
                  {approach.name}
                </Link>
              )}
               {isTested && (
                 <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/90 text-white backdrop-blur-sm">
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                     <polyline points="20 6 9 17 4 12"/>
                   </svg>
                   Testată
                 </span>
               )}
              {dietTags.map((tag: string) => (
                <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-white/15 text-white/90 backdrop-blur-sm">
                  {tag}
                </span>
              ))}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight">
              {post.title}
            </h1>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 mt-3 text-white/80 text-sm">
              {totalTime && (
                <span className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {totalTime}
                </span>
              )}
               {prepTime && (
                 <span className="flex items-center gap-1.5">Preparare: {prepTime}</span>
               )}
               {cookTime && (
                 <span className="flex items-center gap-1.5">Gătire: {cookTime}</span>
               )}
               <span className="flex items-center gap-1.5">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                   <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                 </svg>
                 {servings} porții
               </span>
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                </svg>
                <StarDisplay votes={votes} size={14} showCount={true} />
              </span>
            </div>
          </div>
        </div>
       </div>

       {/* View Original Recipe Button */}
       {sourceUrl && (
         <div className="container mx-auto max-w-4xl px-4 md:px-6 -mt-4 relative z-10 mb-4">
           <a
             href={sourceUrl}
             target="_blank"
             rel="noopener noreferrer"
             className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm transition-colors"
            >
              Vezi rețeta originală
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
               <polyline points="15 3 21 3 21 9"/>
               <line x1="10" y1="14" x2="21" y2="3"/>
             </svg>
             {new URL(sourceUrl).hostname.replace('www.', '')}
           </a>
         </div>
       )}

       {/* Main Content */}
       <div className="container mx-auto max-w-4xl px-4 md:px-6 -mt-6 relative z-10">
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

           {/* Left Column - Recipe Content */}
           <div className="lg:col-span-2 space-y-6">

            {/* Action bar card */}
            <Card className="shadow-lg border-0 bg-card/95 backdrop-blur-sm">
              <CardContent className="p-5">
                <RecipeActionsClient
                  recipeId={post.id}
                  slug={slug}
                  title={post.title}
                  isOwner={isOwner}
                  exportData={{
                    servings,
                    total_time: totalTime ?? undefined,
                    prep_time: prepTime ?? undefined,
                    cook_time: cookTime ?? undefined,
                    ingredients: ingredientSections.flatMap(s => s.ingredients),
                    steps,
                    nutrition: recipeData.nutrition_per_serving as { calories: number; protein: number; carbs: number; fat: number } | undefined,
                    region: approach?.name,
                    dietTags,
                    creator: creator ? `${creator.display_name} (@${creator.handle})` : undefined,
                  }}
                />
              </CardContent>
            </Card>

            {/* Video embed */}
            {((post as Record<string, unknown>).video_url || recipeData.videoUrl) && (
              <Card className="shadow-sm overflow-hidden p-0">
                <CardHeader className="pb-2 px-5 pt-5">
                   <CardTitle className="flex items-center gap-2 text-lg">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                       <polygon points="5 3 19 12 5 21 5 3"/>
                     </svg>
                     Vizionează
                   </CardTitle>
                 </CardHeader>
                 <CardContent className="px-5 pb-5">
                   <VideoEmbed url={((post as Record<string, unknown>).video_url as string) || recipeData.videoUrl!} />
                </CardContent>
              </Card>
            )}

             {/* Ingredients */}
             <Card className="shadow-sm">
               <CardHeader className="pb-3">
                 <CardTitle className="flex items-center gap-2 text-lg">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l3.58-3.58c.94-.94.94-2.48 0-3.42L9 5z"/>
                     <path d="M6 9.01V9"/>
                   </svg>
                    Ingrediente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ingredientSections.length > 0 ? (
                    <RecipeIngredientsClient sections={ingredientSections} showCalories />
                  ) : (
                    <p className="text-sm text-muted-foreground">Nu sunt ingrediente listate.</p>
                  )}
               </CardContent>
             </Card>

             {/* Ad: In-article between ingredients and directions */}
             <AdInArticle placement="recipe-between-ingredients-directions" />

             {/* Photo Gallery */}
            {recipeData.photoGallery && recipeData.photoGallery.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                      <path d="m21 15-5-5L5 21"/>
                    </svg>
                     Galerie
                   </CardTitle>
                 </CardHeader>
                 <CardContent>
                   <PhotoGallery photos={recipeData.photoGallery} />
                </CardContent>
              </Card>
            )}

            {/* Steps */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                   Instrucțiuni
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 {steps.length > 0 ? (
                   <ol className="space-y-4">
                     {steps.map((step: string, idx: number) => (
                       <li key={idx} className="flex gap-4">
                         <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                           {idx + 1}
                         </span>
                         <p className="text-sm leading-relaxed pt-1 flex-1">{step}</p>
                       </li>
                     ))}
                   </ol>
                 ) : (
                   <p className="text-sm text-muted-foreground">Nu sunt pași listați.</p>
                 )}
              </CardContent>
            </Card>

            {/* Advanced section (gated by feature flag) */}
            <RecipeAdvancedClient
              nutrition={recipeData.nutrition_per_serving || { calories: null, protein: null, carbs: null, fat: null }}
              fasting={undefined}
              foodLog={false}
              ingredients={ingredientSections.flatMap(s => s.ingredients)}
            />

            <RecipeCommentsClient
              recipeId={post.id}
              slug={slug}
            />
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-4">

            {/* Rating card */}
            <RecipeRating
              recipeId={post.id}
              initialVotes={votes}
              initialQualityScore={Math.min(5, Math.max(1, 1 + (votes / Math.max(votes, 50)) * 4))}
            />

            {/* Creator card */}
             {creator && (
               <Card className="shadow-sm">
                 <CardContent className="p-4">
                   <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Creat de</p>
                    <div className="flex items-center gap-3">
                       {creator.avatar_url ? (
                         <FallbackImage
                           src={creator.avatar_url}
                           alt={creator.display_name}
                           width={40}
                           height={40}
                           className="w-10 h-10 rounded-full object-cover"
                           fallbackEmoji="👨‍🍳"
                         />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">
                            {creator.display_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                     <div className="flex-1 min-w-0">
                       <p className="font-medium text-sm truncate">{creator.display_name}</p>
                       <p className="text-xs text-muted-foreground">@{creator.handle}</p>
                     </div>
                   </div>
                   <FollowChefButton handle={creator.handle} displayName={creator.display_name} />
                 </CardContent>
               </Card>
             )}

             {/* Quick Nutrition */}
             {recipeData.nutrition_per_serving && (
               <Card className="shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Nutriție per porție</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Calorii', value: (recipeData.nutrition_per_serving as Record<string, number>).calories, unit: 'kcal' },
                        { label: 'Proteine', value: (recipeData.nutrition_per_serving as Record<string, number>).protein, unit: 'g' },
                        { label: 'Carbohidrați', value: (recipeData.nutrition_per_serving as Record<string, number>).carbs, unit: 'g' },
                        { label: 'Grăsimi', value: (recipeData.nutrition_per_serving as Record<string, number>).fat, unit: 'g' },
                      ].map((item) => (
                        <div key={item.label} className="text-center p-2 rounded-lg bg-muted/50">
                          <p className="text-lg font-bold">{item.value ?? '—'}</p>
                          <p className="text-[10px] text-muted-foreground">{item.unit} {item.label.toLowerCase()}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 text-center">
                      Per porție ({servings} porții în total)
                    </p>
                 </CardContent>
               </Card>
             )}

             {/* Ad: Sidebar */}
             <AdSidebar placement="recipe-sidebar" />

             {/* Source link */}
            {sourceUrl && (
              <Card className="shadow-sm">
               <CardContent className="p-4">
                   <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Rețeta originală</p>
                   <a
                     href={sourceUrl}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 hover:underline transition-colors break-all"
                   >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    {new URL(sourceUrl).hostname.replace('www.', '')}
                  </a>
                </CardContent>
              </Card>
            )}

             {/* Similar Recipes */}
             <Card className="shadow-sm">
               <CardHeader className="pb-3">
                 <CardTitle className="text-base">Rețete similare</CardTitle>
              </CardHeader>
              <CardContent>
                <SimilarRecipesClient id={post.id} />
              </CardContent>
            </Card>
           </div>
         </div>
       </div>
     </main>
      </>
    )
  }
