/**
 * Mock chef profiles and blog posts.
 * Used as fallback when Supabase is unavailable.
 */

import type { ChefTier } from '@/components/TierStar'

export interface ChefProfile {
  id: string
  handle: string        // without @, e.g. "chef_mario"
  display_name: string
  tier: ChefTier
  avatar_url: string
  banner_url: string
  bio: string
  follower_count: number
  following_count: number
  post_count: number
  is_following: boolean
  is_own_profile: boolean
}

export interface ChefBlogPost {
  id: string
  chef_handle: string   // without @
  title: string
  slug: string
  hero_image_url: string
  description: string   // chef's own words / story
  created_at: string
  votes: number
  comments: number
}

/* ─── Profiles ──────────────────────────────────────────────────────────── */

export const MOCK_CHEF_PROFILES: ChefProfile[] = [
  {
    id: 'mock-user-1',
    handle: 'chef_mario',
    display_name: 'Chef Mario',
    tier: 'pro',
    avatar_url: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=200&q=80',
    banner_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    bio: 'Chef cu stea Michelin, cu 20 de ani de experiență în bucătăriile italiene. Obsedat de simplitate și de crusta perfectă de pizza.',
    follower_count: 12400,
    following_count: 87,
    post_count: 34,
    is_following: false,
    is_own_profile: false,
  },
  {
    id: 'mock-user-2',
    handle: 'thai_kitchen',
    display_name: 'Thai Kitchen',
    tier: 'pro',
    avatar_url: 'https://images.unsplash.com/photo-1595273670150-bd0c3c392e46?auto=format&fit=crop&w=200&q=80',
    banner_url: 'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=1200&q=80',
    bio: 'Născut în Bangkok. Purist al mâncării de stradă. Dacă n-ai mâncat pad thai la 2 noaptea pe un scaun de plastic, n-ai trăit.',
    follower_count: 38700,
    following_count: 142,
    post_count: 51,
    is_following: false,
    is_own_profile: false,
  },
  {
    id: 'mock-user-3',
    handle: 'sahara_spice',
    display_name: 'Sahara Spice',
    tier: 'amateur',
    avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
    banner_url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=1200&q=80',
    bio: 'Food blogger din Marrakech. Împărtășesc secretele bunicii, un tagine pe rând. 500k urmăritori pe TikTok.',
    follower_count: 9100,
    following_count: 318,
    post_count: 22,
    is_following: false,
    is_own_profile: false,
  },
  {
    id: 'mock-user-4',
    handle: 'sushi_master',
    display_name: 'Sushi Master',
    tier: 'pro',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    banner_url: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=1200&q=80',
    bio: 'Itamae format la Tokyo. 15 ani de omakase. Fiecare bob de orez contează.',
    follower_count: 54200,
    following_count: 23,
    post_count: 19,
    is_following: false,
    is_own_profile: false,
  },
  {
    id: 'mock-user-5',
    handle: 'plant_power',
    display_name: 'Plant Power',
    tier: 'amateur',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    banner_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80',
    bio: 'Creator de mâncare vegană. Demonstrez că plantele pot fi glamour. 1.2M pe Instagram.',
    follower_count: 21300,
    following_count: 204,
    post_count: 67,
    is_following: false,
    is_own_profile: false,
  },
  {
    id: 'mock-user-6',
    handle: 'parisian_baker',
    display_name: 'Parisian Baker',
    tier: 'pro',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    banner_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=1200&q=80',
    bio: 'Brutar în arondismentul 6 din Paris. Croissantele durează 3 zile. Merită.',
    follower_count: 67800,
    following_count: 58,
    post_count: 28,
    is_following: false,
    is_own_profile: false,
  },
  {
    id: 'mock-user-9',
    handle: 'spice_route',
    display_name: 'Spice Route',
    tier: 'pro',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80',
    banner_url: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=1200&q=80',
    bio: 'Bucătar șef la The Spice Route, Delhi. Puiul cu unt este poezie. Am rețeta.',
    follower_count: 22100,
    following_count: 91,
    post_count: 41,
    is_following: false,
    is_own_profile: false,
  },
  {
    id: 'mock-user-kwame',
    handle: 'kwamecooks',
    display_name: 'Kwame Mensah',
    tier: 'pro',
    avatar_url: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?auto=format&fit=crop&w=200&q=80',
    banner_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    bio: 'Bucătar vest-african din a treia generație și istoric culinar, stabilit în Accra, Ghana. Peste 12 ani de specializare în bucătăria autentică ghaneză și senegaleză. Pasionat de conservarea moștenirii culinare, făcând preparatele tradiționale accesibile bucătarilor casnici moderni.',
    follower_count: 21300,
    following_count: 94,
    post_count: 6,
    is_following: false,
    is_own_profile: false,
  },
]

/* ─── Blog posts ─────────────────────────────────────────────────────────── */

export const MOCK_CHEF_POSTS: ChefBlogPost[] = [
  {
    id: 'post-1',
    chef_handle: 'chef_mario',
    title: 'Pizza Margherita Clasică',
    slug: 'classic-margherita-pizza',
    hero_image_url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80',
    description: 'Aceasta e pizza cu care am crescut în Napoli. Trei ingrediente. Fără compromisuri. Secretul e o fermentare la rece de 72 de ore — dă aluatului acel miez ușor acru și pufos pe care nu-l obții altfel. Folosește roșii San Marzano și mozzarella proaspătă de bivoliță, dacă găsești. Nu folosi busuioc uscat. Niciodată.',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    votes: 42,
    comments: 8,
  },
  {
    id: 'post-2',
    chef_handle: 'thai_kitchen',
    title: 'Pad Thai Autentic',
    slug: 'pad-thai-noodles',
    hero_image_url: 'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=800&q=80',
    description: 'Pad thai-ul adevărat nu seamănă deloc cu ce găsești în majoritatea restaurantelor occidentale. Cheia este tamarindul — coloana vertebrală acră, ușor dulce a acestui preparat. Eu îl iau sub formă de pastă proaspătă de la piața locală. Dacă folosești varianta din borcan, gustă-o întâi și ajustează. Wok-ul trebuie să fie încins la maxim. Totul se întâmplă în mai puțin de 3 minute.',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    votes: 67,
    comments: 15,
  },
  {
    id: 'post-3',
    chef_handle: 'sahara_spice',
    title: 'Tagine Marocan de Miel',
    slug: 'moroccan-tagine',
    hero_image_url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80',
    description: 'Bunica mea pregătea asta în fiecare vineri. Nu măsura niciodată nimic — doar miros și simț. Am privit-o 20 de ani înainte să îndrăznesc să notez rețeta. Ras el hanout este totul. Prăjește condimentele întregi, dacă poți. Caisele uscate nu sunt opționale — echilibrează perfect mielul.',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    votes: 28,
    comments: 6,
  },
  {
    id: 'post-4',
    chef_handle: 'sushi_master',
    title: 'California Roll',
    slug: 'california-sushi-roll',
    hero_image_url: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=800&q=80',
    description: 'Da, fac California rolls. Nu totul trebuie să fie omakase. A fost inventat în Los Angeles în anii \'70 — o adaptare pentru un public nou — și asta cere măiestrie. Asezonarea orezului face diferența între un roll bun și unul ușor de uitat. Folosește orez japonez cu bob scurt. Lasă-l să se răcească la temperatura corpului înainte de a rula.',
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    votes: 53,
    comments: 12,
  },
  {
    id: 'post-5',
    chef_handle: 'plant_power',
    title: 'Buddha Bowl Curcubeu',
    slug: 'vegan-buddha-bowl',
    hero_image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    description: 'Acest bol este modul în care mi-am convins familia că mâncarea vegană nu e tristă. Prăjește legumele la foc mare ca să se caramelizeze. Dressingul cu tahini este cea mai cerută rețetă a mea — lămâie, usturoi, tahini, un strop de sirop de arțar. Face totul mai gustos. Eu îl pun pe orice.',
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    votes: 89,
    comments: 22,
  },
  {
    id: 'post-6',
    chef_handle: 'parisian_baker',
    title: 'Croissante Franțuzești cu Unt',
    slug: 'french-croissants',
    hero_image_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80',
    description: 'Trei zile. Atât durează un croissant cum trebuie. Ziua 1: pregătești détrempe-ul. Ziua 2: laminezi cu beurre de tourage rece — 84% grăsime, vă rog, nu unt de supermarket. Ziua 3: dospești lent, apoi coci la 200°C. Trosnitul acela când muști — asta e laminarea. Nu există scurtături și nu-mi cer scuze pentru asta.',
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    votes: 71,
    comments: 18,
  },
  {
    id: 'post-7',
    chef_handle: 'spice_route',
    title: 'Butter Chicken Cremos',
    slug: 'indian-butter-chicken',
    hero_image_url: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=800&q=80',
    description: 'Butter chicken — murgh makhani — a fost inventat din întâmplare în Delhi, în anii 1950. Resturi de pui tandoori aruncate într-un sos de roșii cu unt. Uneori accidentele sunt geniale. Versiunea mea folosește o marinare de 24 de ore și o notă finală de kasuri methi (frunze uscate de schinduf) pe care majoritatea o ignoră. Nu o ignora.',
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    votes: 112,
    comments: 35,
  },
  {
    id: 'post-kwame-1',
    chef_handle: 'kwamecooks',
    title: 'Mafé Senegalez Vegetarian',
    slug: 'vegetarian-senegalese-mafe',
    hero_image_url: 'https://eatwithafia.com/wp-content/uploads/2025/03/DSC09821-scaled-1.jpg',
    description: 'Mafé este preparatul pe care-l gătesc când vreau să duc pe cineva într-o călătorie culinară. Baza de arahide este totul — bogată, pământească, ușor amăruie. Adăugăm boabe de roșcove fermentate (dawadawa) pentru o profunzime pe care nu o poți replica cu nimic altceva. Această versiune vegetariană folosește ciuperci și tofu ferm pentru a imita consistența mielului tradițional. Servește peste orez sau fonio.',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    votes: 44,
    comments: 11,
  },
  {
    id: 'post-kwame-2',
    chef_handle: 'kwamecooks',
    title: 'Orez Jollof Vegetarian Simplu',
    slug: 'simple-vegetarian-jollof-rice',
    hero_image_url: 'https://eatwithafia.com/wp-content/uploads/2022/12/DSC_0019.jpg',
    description: 'Nu există preparat care să stârnească mai multe controverse în Africa de Vest decât orezul jollof. Ghana versus Nigeria — o dezbatere fără sfârșit și fără răspuns greșit. Versiunea mea e ghaneză, evident. Orez parboiled cu bob lung, o bază de roșii și ardei mixate, și răbdare. Nu amesteca prea des. Crusta de la fund — o numim kanzo în Ghana — nu e o greșeală. Este premiul.',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    votes: 89,
    comments: 23,
  },
  {
    id: 'post-kwame-3',
    chef_handle: 'kwamecooks',
    title: 'Waakye',
    slug: 'waakye-ghanaian-rice-and-beans',
    hero_image_url: 'https://eatwithafia.com/wp-content/uploads/2021/06/DSC_1283-1.jpg',
    description: 'Waakye este marea mâncare de stradă a Ghanei. Orez și fasole cu ochi negri gătite împreună cu tulpini uscate de sorg — tulpinile dau preparatului culoarea distinctivă purpurie-maro și o aromă minerală subtilă. Îl vei găsi vândut din oale mari pe colțurile străzilor în zori. Aceasta este rețeta pe care am rafinat-o de-a lungul anilor, mâncând waakye pe aceleași colțuri de stradă.',
    created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    votes: 63,
    comments: 17,
  },
]

/** Latest posts across all chefs, sorted by date, for the homepage strip */
export const MOCK_LATEST_CHEF_POSTS = [...MOCK_CHEF_POSTS]
  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  .slice(0, 6)
