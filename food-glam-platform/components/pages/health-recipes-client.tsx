'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useTheme } from '@/components/theme-provider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealthRecipe {
  id: string
  user_id: string
  category: 'food' | 'drink'
  title: string
  description: string | null
  ingredients: string[]
  preparation: string | null
  calories_estimated: number | null
  tags: string[]
  is_public: boolean
  created_at: string
}

// ─── Tags per category ────────────────────────────────────────────────────────

const FOOD_TAGS = [
  'disociat', 'proteină', 'amidon', 'vitamine', 'detox', 'raw', 'fiert', 'copt', 'salată',
  'probiotic', 'fermentat', 'fier', 'gustare', 'energizant', 'omega-3', 'rapid', 'vegan',
  'antioxidant', 'grăsimi sănătoase', 'dimineață',
]
const DRINK_TAGS = [
  'ceai', 'smoothie', 'suc', 'infuzie', 'matcha', 'detox', 'energizant', 'calmant',
  'dimineață', 'seară', 'antioxidant', 'antiinflamator', 'digestiv', 'somn', 'stres',
  'cardiovascular', 'cognitiv', 'hormonal', 'imunitate', 'respirator', 'probiotic',
  'fermentat', 'hidratare', 'sport', 'fără lactoză', 'hepatic', 'antidepresiv',
  'hipertensiune', 'febră', 'minerale', 'fier',
]

// ─── Seed suggestions ─────────────────────────────────────────────────────────

const FOOD_SEED: Omit<HealthRecipe, 'id' | 'user_id' | 'created_at'>[] = [
  // ── Legume preparate simplu ──────────────────────────────────────────────
  {
    category: 'food',
    title: 'Broccoli la abur',
    description: 'Broccoli gătit la abur, păstrând toți nutrienții și vitaminele.',
    ingredients: ['300g broccoli', 'sare', 'ulei de măsline (opțional)'],
    preparation: 'Împarte broccoli în buchete. Gătește la abur 5-7 minute până devine fraged dar crocant. Asezonează cu sare și un fir de ulei.',
    calories_estimated: 55,
    tags: ['vitamine', 'fiert', 'detox'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Spanac sote cu usturoi',
    description: 'Spanac proaspăt sotat cu usturoi, bogat în fier și vitamine.',
    ingredients: ['200g spanac proaspăt', '2 căței de usturoi', '1 lingură ulei de măsline', 'sare'],
    preparation: 'Călește usturoiul tocat în ulei 30 de secunde. Adaugă spanacul și sotează 2 minute până se ofilește. Sărează și servește imediat.',
    calories_estimated: 70,
    tags: ['vitamine', 'fiert', 'fier'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Morcovi baby la abur',
    description: 'Morcovi baby fierți la abur, dulci natural și bogați în beta-caroten.',
    ingredients: ['200g morcovi baby', 'sare', 'pătrunjel proaspăt'],
    preparation: 'Gătește morcovii la abur 8-10 minute. Presară puțin pătrunjel tocat și sare înainte de servire.',
    calories_estimated: 45,
    tags: ['vitamine', 'fiert'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Conopidă la cuptor',
    description: 'Conopidă coaptă în cuptor cu condimente, caramelizată natural.',
    ingredients: ['1 conopidă medie', '2 linguri ulei de măsline', 'sare', 'piper', 'turmeric (opțional)'],
    preparation: 'Taie conopida în buchete, amestecă cu ulei și condimente. Coace la 200°C timp de 25-30 minute, întorcând la jumătate.',
    calories_estimated: 80,
    tags: ['amidon', 'copt'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Dovlecei la grătar',
    description: 'Dovlecei tăiați felii și grillați, cu ierburi aromatice.',
    ingredients: ['2 dovlecei medii', 'ulei de măsline', 'sare', 'oregano', 'busuioc'],
    preparation: 'Taie dovleceii în felii de 1 cm. Unge cu ulei, condimentează. Grilează 3-4 minute pe fiecare parte.',
    calories_estimated: 40,
    tags: ['vitamine', 'raw'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Sfeclă roșie coaptă',
    description: 'Sfeclă roșie coaptă în cuptor, dulce și bogată în antioxidanți.',
    ingredients: ['3 sfecle roșii medii', 'ulei de măsline', 'sare', 'cimbru'],
    preparation: 'Curăță sfecla și taie-o în cuburi. Amestecă cu ulei, sare și cimbru. Coace la 200°C timp de 35-40 minute.',
    calories_estimated: 90,
    tags: ['vitamine', 'detox', 'copt'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Varză murată',
    description: 'Varză murată tradițională, bogată în probiotice și vitamina C.',
    ingredients: ['varză murată (250g)', 'ulei de floarea soarelui', 'ceapă (opțional)'],
    preparation: 'Scurge varza murată, stoarce excesul de saramură. Adaugă puțin ulei și ceapă tocată. Servește ca garnitură sau salată.',
    calories_estimated: 25,
    tags: ['probiotic', 'raw', 'fermentat'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Fasole verde fiartă',
    description: 'Fasole verde fiartă simplu, cu lămâie și ulei de măsline.',
    ingredients: ['300g fasole verde', 'zeamă de lămâie', 'ulei de măsline', 'sare', 'usturoi (opțional)'],
    preparation: 'Fierbe fasolea verde în apă cu sare 5-6 minute (să rămână crocantă). Scurge și asezonează cu lămâie și ulei.',
    calories_estimated: 55,
    tags: ['vitamine', 'fiert'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Sparanghel la grătar',
    description: 'Sparanghel grilat, cu lămâie și sare de mare.',
    ingredients: ['1 legătură sparanghel', 'ulei de măsline', 'sare de mare', 'lămâie'],
    preparation: 'Curăță capetele sparanghelului. Unge cu ulei și grilează 3-4 minute pe fiecare parte. Stropește cu zeamă de lămâie.',
    calories_estimated: 40,
    tags: ['vitamine', 'detox'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Ciuperci sotate',
    description: 'Ciuperci champignon sotate cu usturoi și ierburi aromatice.',
    ingredients: ['300g ciuperci champignon', '2 căței usturoi', 'ulei de măsline', 'pătrunjel', 'sare', 'piper'],
    preparation: 'Curăță și taie ciupercile. Sotează în ulei fierbinte cu usturoi 5-6 minute. Adaugă pătrunjel, sare și piper.',
    calories_estimated: 60,
    tags: ['proteină', 'fiert'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Roșii cherry cu busuioc',
    description: 'Salată simplă de roșii cherry cu busuioc proaspăt și ulei de măsline.',
    ingredients: ['250g roșii cherry', 'busuioc proaspăt', 'ulei de măsline extravirgin', 'sare', 'piper'],
    preparation: 'Taie roșiile în jumătate. Amestecă cu frunze de busuioc, ulei, sare și piper. Servește imediat.',
    calories_estimated: 30,
    tags: ['vitamine', 'raw', 'salată'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Castraveți cu mărar și iaurt',
    description: 'Salată de castraveți cu iaurt grecesc și mărar, răcoritoare și probiotică.',
    ingredients: ['2 castraveți', 'iaurt grecesc (100g)', 'mărar proaspăt', 'sare', '1 cățel usturoi'],
    preparation: 'Taie castraveții felii subțiri. Amestecă cu iaurtul, mărarul tocat și usturoiul ras. Sărează și lasă 10 minute la frigider.',
    calories_estimated: 45,
    tags: ['vitamine', 'raw', 'probiotic'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Ardei copți',
    description: 'Ardei copți în cuptor sau pe grătar, dulci și bogați în vitamina C.',
    ingredients: ['4 ardei roșii sau grași', 'ulei de măsline', 'usturoi', 'sare'],
    preparation: 'Coace ardeii la 220°C timp de 20-25 minute până se carbonizează ușor coaja. Pune în pungă 10 minute, decojește și curăță semințele. Asezonează cu ulei și usturoi.',
    calories_estimated: 50,
    tags: ['vitamine', 'copt'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Vinete la cuptor',
    description: 'Vinete coapte în cuptor, moi și aromate, cu ierburi mediteraneene.',
    ingredients: ['2 vinete medii', 'ulei de măsline', 'sare', 'usturoi', 'oregano', 'rozmarin'],
    preparation: 'Taie vinetele în rondele de 1 cm. Unge cu ulei, condimentează. Coace la 200°C, 20-25 minute, întorcând la jumătate.',
    calories_estimated: 65,
    tags: ['vitamine', 'copt'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Țelină rasă cu lămâie',
    description: 'Salată crudă de țelină rădăcină, rasă fin cu zeamă de lămâie.',
    ingredients: ['1/2 rădăcină de țelină', 'zeamă de lămâie', 'ulei de măsline', 'sare', 'pătrunjel'],
    preparation: 'Curăță și rade țelina fin. Amestecă imediat cu zeama de lămâie pentru a nu se oxida. Adaugă ulei, sare și pătrunjel.',
    calories_estimated: 35,
    tags: ['vitamine', 'raw', 'detox'],
    is_public: true,
  },
  // ── Fructe și gustări din fructe ─────────────────────────────────────────
  {
    category: 'food',
    title: 'Măr verde cu scorțișoară',
    description: 'Măr verde tăiat felii cu scorțișoară, gustare sățioasă și aromată.',
    ingredients: ['1 măr verde', '1/4 linguriță scorțișoară', 'zeamă de lămâie (opțional)'],
    preparation: 'Taie mărul în felii. Stropește cu puțină zeamă de lămâie pentru a nu se oxida. Presară scorțișoară.',
    calories_estimated: 80,
    tags: ['vitamine', 'raw', 'gustare'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Banană cu unt de arahide',
    description: 'Banană coaptă cu unt de arahide natural, bogată în potasiu și proteine.',
    ingredients: ['1 banană coaptă', '1 lingură unt de arahide natural', 'semințe de chia (opțional)'],
    preparation: 'Taie banana în rondele. Adaugă untul de arahide deasupra. Presară semințe de chia dacă dorești.',
    calories_estimated: 200,
    tags: ['proteină', 'energizant', 'gustare'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Smoothie de fructe de pădure',
    description: 'Smoothie bogat în antioxidanți cu afine, zmeură și căpșuni.',
    ingredients: ['100g afine', '100g zmeură', '50g căpșuni', '150ml lapte de migdale', '1 linguriță miere'],
    preparation: 'Pune toate ingredientele în blender și mixează 1 minut. Servește imediat sau răcit.',
    calories_estimated: 120,
    tags: ['vitamine', 'smoothie', 'antioxidant'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Grapefruit cu miere',
    description: 'Grapefruit proaspăt cu miere, ideal dimineața pentru detox și vitamina C.',
    ingredients: ['1 grapefruit', '1 linguriță miere de albine'],
    preparation: 'Taie grapefruitull în jumătate, desparte segmentele cu un cuțit. Picură miere deasupra și servește imediat.',
    calories_estimated: 70,
    tags: ['vitamine', 'detox', 'dimineață'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Pere coapte cu nucă',
    description: 'Pere coapte în cuptor cu nuci și scorțișoară, desert sănătos și aromat.',
    ingredients: ['2 pere', '30g nuci', '1 linguriță scorțișoară', '1 linguriță miere'],
    preparation: 'Taie perele în jumătate, scoate miezul. Umple cu nuci tocate și miere. Coace la 180°C timp de 20 minute.',
    calories_estimated: 150,
    tags: ['vitamine', 'copt', 'gustare'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Salată de fructe tropicale',
    description: 'Amestec colorat de fructe tropicale proaspete cu mentă.',
    ingredients: ['1/4 mango', '1/4 ananas', '1 kiwi', '1/2 papaya', 'mentă proaspătă', 'zeamă de lime'],
    preparation: 'Taie toate fructele în cuburi egale. Amestecă, adaugă zeamă de lime și frunze de mentă. Servește rece.',
    calories_estimated: 100,
    tags: ['vitamine', 'raw'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Avocado cu lămâie și sare',
    description: 'Avocado copt tăiat în jumătate, stropit cu lămâie și sare de mare.',
    ingredients: ['1 avocado copt', 'zeamă de lămâie', 'sare de mare', 'piper negru', 'fulgi de ardei (opțional)'],
    preparation: 'Taie avocado în jumătate, scoate sâmburele. Stropește cu lămâie, sărează și piperează.',
    calories_estimated: 160,
    tags: ['grăsimi sănătoase', 'raw'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Kiwi și portocală feliate',
    description: 'Platou simplu de kiwi și portocală, bogat în vitamina C.',
    ingredients: ['2 kiwi', '1 portocală mare'],
    preparation: 'Curăță kiwi și portocala. Taie în rondele sau segmente. Aranjează pe o farfurie.',
    calories_estimated: 65,
    tags: ['vitamine', 'raw'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Afine cu iaurt grecesc',
    description: 'Afine proaspete cu iaurt grecesc, bogat în proteine și antioxidanți.',
    ingredients: ['150g afine', '150g iaurt grecesc 2%', '1 linguriță miere', 'granola (opțional)'],
    preparation: 'Pune iaurtul în bol. Adaugă afinele deasupra, picură miere și opțional granola.',
    calories_estimated: 130,
    tags: ['probiotic', 'antioxidant', 'gustare'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Piersici la grătar',
    description: 'Piersici tăiate în jumătate și grillate, caramelizate natural.',
    ingredients: ['2 piersici coapte', 'puțin ulei de cocos', 'scorțișoară', 'miere (opțional)'],
    preparation: 'Taie piersicile în jumătate și scoate sâmburii. Unge cu ulei de cocos. Grilează 3-4 minute pe fiecare parte. Stropește cu miere.',
    calories_estimated: 70,
    tags: ['vitamine', 'gustare'],
    is_public: true,
  },
  // ── Proteine simple ──────────────────────────────────────────────────────
  {
    category: 'food',
    title: 'Ouă fierte moi (6 minute)',
    description: 'Ouă fierte moi, perfecte pentru o masă ușoară bogată în proteine.',
    ingredients: ['2 ouă', 'apă', 'sare de mare'],
    preparation: 'Fierbe apa. Adaugă ouăle cu grijă și lasă exact 6 minute. Răcește imediat sub jet de apă rece, decojește și sărează.',
    calories_estimated: 140,
    tags: ['proteină', 'disociat'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Piept de pui la grătar',
    description: 'Piept de pui simplu la grătar, sursa ideală de proteine slabe.',
    ingredients: ['1 piept de pui (150g)', 'sare', 'piper', 'boia dulce', 'usturoi pudră', 'ulei de măsline'],
    preparation: 'Condimentează pieptul pe ambele părți. Grilează 6-7 minute pe fiecare parte la foc mediu-înalt. Lasă 5 minute înainte de tăiere.',
    calories_estimated: 165,
    tags: ['proteină', 'disociat'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Somon la cuptor cu lămâie',
    description: 'Fileu de somon copt în cuptor cu lămâie și ierburi, bogat în omega-3.',
    ingredients: ['1 fileu somon (180g)', 'zeamă de lămâie', 'mărar proaspăt', 'ulei de măsline', 'sare', 'piper'],
    preparation: 'Pune somonul pe hârtie de copt. Stropește cu lămâie și ulei, condimentează. Coace la 200°C timp de 12-15 minute.',
    calories_estimated: 230,
    tags: ['proteină', 'omega-3'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Ton în apă (conservă)',
    description: 'Ton din conservă în apă, sursă rapidă de proteine cu calorii reduse.',
    ingredients: ['1 conservă ton în apă (120g)', 'zeamă de lămâie', 'sare', 'piper', 'capere (opțional)'],
    preparation: 'Scurge bine apa din conservă. Pune tonul pe o farfurie, stropește cu lămâie, sărează și piperează.',
    calories_estimated: 120,
    tags: ['proteină', 'rapid'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Brânză de vaci cu semințe',
    description: 'Brânză de vaci proaspătă cu semințe de floarea soarelui și in.',
    ingredients: ['150g brânză de vaci slabă', '1 lingură semințe de floarea soarelui', '1 lingură semințe de in', 'sare', 'mărar'],
    preparation: 'Pune brânza de vaci în bol. Adaugă semințele, sare și mărar tocat. Amestecă ușor.',
    calories_estimated: 150,
    tags: ['proteină', 'gustare'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Hummus cu legume crude',
    description: 'Hummus de casă sau cumpărat servit cu legume crude pentru dipuit.',
    ingredients: ['100g hummus', 'morcovi baby', 'țelină', 'castraveți', 'ardei gras', 'broccoli crud'],
    preparation: 'Taie legumele în bețe sau buchete potrivite pentru dipuit. Aranjează în jurul vasului cu hummus.',
    calories_estimated: 180,
    tags: ['proteină', 'raw', 'gustare'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Tofu la grătar cu sos de soia',
    description: 'Tofu extra-ferm grilat cu sos de soia și usturoi, proteină vegană completă.',
    ingredients: ['200g tofu extra-ferm', '2 linguri sos de soia', '1 cățel usturoi', '1 linguriță ulei de susan', 'ghimbir'],
    preparation: 'Taie tofuul în felii de 1 cm. Marinează 15 minute în sos de soia, usturoi și ghimbir. Grilează 4-5 minute pe fiecare parte.',
    calories_estimated: 130,
    tags: ['proteină', 'vegan'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Edamame cu sare de mare',
    description: 'Boabe de edamame fierte, presărate cu sare de mare, gustare vegană bogată în proteine.',
    ingredients: ['200g edamame (congelat sau proaspăt)', 'sare de mare', 'fulgi de ardei (opțional)'],
    preparation: 'Fierbe edamamele 5 minute în apă cu sare. Scurge și presară sare de mare grunjoasă. Servește cald sau rece.',
    calories_estimated: 120,
    tags: ['proteină', 'gustare', 'vegan'],
    is_public: true,
  },
  // ── Amidon/Carbohidrați simpli ───────────────────────────────────────────
  {
    category: 'food',
    title: 'Cartof copt simplu',
    description: 'Cartof copt în cuptor, fără grăsimi adăugate, sursă curată de carbohidrați.',
    ingredients: ['1 cartof mare (250g)', 'sare de mare'],
    preparation: 'Învelește cartoful în folie de aluminiu. Coace la 200°C timp de 45-60 minute. Taie în cruce și servește cu sare.',
    calories_estimated: 160,
    tags: ['amidon', 'disociat'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Orez integral fiert',
    description: 'Orez integral fiert, bogat în fibre și carbohidrați complecși cu eliberare lentă.',
    ingredients: ['100g orez integral', 'apă (300ml)', 'sare'],
    preparation: 'Clătește orezul. Fierbe în apă dublă față de cantitate, la foc mic cu capac, 35-40 minute. Lasă să absoarbă 5 minute.',
    calories_estimated: 215,
    tags: ['amidon', 'disociat'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Quinoa cu lămâie',
    description: 'Quinoa fiartă și asezonată cu lămâie și ierburi, sursă completă de proteine și carbohidrați.',
    ingredients: ['100g quinoa', 'apă (200ml)', 'zeamă de lămâie', 'ulei de măsline', 'sare', 'pătrunjel'],
    preparation: 'Clătește quinoa sub apă rece. Fierbe în apă dublu cantitate, 15 minute. Asezonează cu lămâie, ulei și pătrunjel.',
    calories_estimated: 185,
    tags: ['amidon', 'proteină'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Paste integrale cu ulei de măsline',
    description: 'Paste integrale fierte simplu, cu ulei de măsline extravirgin și usturoi.',
    ingredients: ['100g paste integrale', 'ulei de măsline (2 linguri)', '2 căței usturoi', 'sare', 'piper', 'parmezan (opțional)'],
    preparation: 'Fierbe pastele conform instrucțiunilor. Sotează usturoiul în ulei. Amestecă pastele scurse cu uleiul aromat.',
    calories_estimated: 250,
    tags: ['amidon'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Ovăz cu fructe (overnight oats)',
    description: 'Fulgi de ovăz înmuiați peste noapte cu fructe și semințe, micul dejun ideal.',
    ingredients: ['60g fulgi de ovăz', '200ml lapte de migdale', '1 banană', '30g afine', '1 linguriță semințe chia', '1 linguriță miere'],
    preparation: 'Amestecă ovăzul cu laptele și semințele chia seara. Lasă la frigider peste noapte. Dimineața adaugă fructele și mierea.',
    calories_estimated: 280,
    tags: ['amidon', 'dimineață'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Pâine integrală cu avocado',
    description: 'Toast de pâine integrală cu pastă de avocado, semințe și lămâie.',
    ingredients: ['2 felii pâine integrală', '1 avocado copt', 'zeamă de lămâie', 'sare de mare', 'piper roșu', 'semințe de dovleac'],
    preparation: 'Prăjește pâinea. Pisează avocado cu lămâie și sare. Întinde pe pâine, presară semințe și piper.',
    calories_estimated: 220,
    tags: ['amidon', 'gustare'],
    is_public: true,
  },
  {
    category: 'food',
    title: 'Batate coapte',
    description: 'Cartofi dulci copți în cuptor, bogați în beta-caroten și vitamine.',
    ingredients: ['2 batate medii', 'ulei de cocos', 'sare', 'scorțișoară (opțional)'],
    preparation: 'Înțeapă batatele cu furculița. Unge cu ulei de cocos și sare. Coace la 200°C timp de 40-45 minute.',
    calories_estimated: 140,
    tags: ['amidon', 'copt', 'vitamine'],
    is_public: true,
  },
]

const DRINK_SEED: Omit<HealthRecipe, 'id' | 'user_id' | 'created_at'>[] = [
  // ── Ceaiuri cu explicații medicale ───────────────────────────────────────
  {
    category: 'drink',
    title: 'Ceai verde cu lămâie',
    description: 'Bogat în antioxidanți (catechine). Accelerează metabolismul, reduce riscul de boli cardiovasculare. Vitamina C din lămâie crește absorbția antioxidanților cu 80%.',
    ingredients: ['1 plic ceai verde de calitate', 'apă la 80°C (250ml)', 'zeamă de la 1/4 lămâie', '1 linguriță miere (opțional)'],
    preparation: 'Infuzează ceaiul verde 3 minute la 80°C (nu fierbe apa complet — distruge catechinele). Adaugă zeama de lămâie și miere.',
    calories_estimated: 25,
    tags: ['ceai', 'detox', 'dimineață', 'antioxidant'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Ceai de mentă',
    description: 'Ameliorează digestia, reduce balonarea și crampele abdominale. Mentolul relaxează mușchii tractului digestiv. Recomandat după mese copioase.',
    ingredients: ['1 pumn de mentă proaspătă (sau 1 plic)', 'apă fierbinte (250ml)', 'miere (opțional)'],
    preparation: 'Infuzează menta în apă fierbinte 5-7 minute. Acoperă vasul pentru a reține uleiurile esențiale. Filtrează și adaugă miere dacă dorești.',
    calories_estimated: 5,
    tags: ['ceai', 'digestiv', 'calmant', 'seară'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Ceai de mușețel',
    description: 'Proprietăți sedative ușoare datorită apigeninei. Reduce anxietatea, îmbunătățește somnul. Antiinflamator natural. Recomandat seara, cu 30 min înainte de culcare.',
    ingredients: ['2 lingurițe mușețel uscat (sau 1 plic)', 'apă fierbinte (250ml)', 'miere de tei (opțional)'],
    preparation: 'Infuzează mușețelul 5-10 minute în apă fierbinte (nu clocotită). Filtrează, adaugă miere și bea cald înainte de somn.',
    calories_estimated: 5,
    tags: ['ceai', 'calmant', 'seară', 'somn'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Ceai de ghimbir',
    description: 'Puternic antiinflamator și antiemetic. Ameliorează greața (inclusiv de sarcină), reduce durerea musculară. Gingerolii stimulează termogeneza și metabolismul.',
    ingredients: ['3-4 cm ghimbir proaspăt (feliat)', 'apă fierbinte (300ml)', 'zeamă de lămâie', '1 linguriță miere', 'piper negru (vârf de cuțit, opțional)'],
    preparation: 'Fierbe ghimbirul feliat în apă 10 minute. Filtrează, adaugă lămâia și mierea. Piperul negru amplifică efectul antiinflamator.',
    calories_estimated: 10,
    tags: ['ceai', 'antiinflamator', 'dimineață', 'energizant'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Ceai de turmeric (Golden Milk)',
    description: 'Curcumina este un antiinflamator puternic. Reduce durerea articulară, îmbunătățește funcția hepatică. Piperina (piperul negru) crește absorbția curcuminei cu 2000%.',
    ingredients: ['250ml lapte vegetal (cocos sau migdale)', '1 linguriță turmeric pudră', '1/4 linguriță piper negru', '1/2 linguriță scorțișoară', '1 linguriță miere'],
    preparation: 'Încălzește laptele la foc mic (nu fierbe). Adaugă turmericul, piperul și scorțișoara. Amestecă bine, adaugă miere și bea cald.',
    calories_estimated: 60,
    tags: ['ceai', 'antiinflamator', 'seară', 'detox'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Ceai de hibiscus',
    description: 'Reduce tensiunea arterială (studii clinice: -7mmHg sistolic). Bogat în vitamina C și antocianine. Poate scădea colesterolul LDL. Contraindicat cu medicamente hipotensive.',
    ingredients: ['2 lingurițe flori de hibiscus uscate', 'apă fierbinte (300ml)', '1 linguriță miere', 'felie de lămâie (opțional)'],
    preparation: 'Infuzează florile de hibiscus 5-10 minute în apă fierbinte. Culoarea va deveni roșu intens. Filtrează, îndulcește cu miere și adaugă lămâie.',
    calories_estimated: 5,
    tags: ['ceai', 'cardiovascular', 'detox', 'hipertensiune'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Ceai de rozmarin',
    description: 'Îmbunătățește memoria și concentrarea (acidul carnosic). Stimulează circulația cerebrală. Antioxidant puternic. Recomandat dimineața pentru claritate mentală.',
    ingredients: ['2 crenguțe rozmarin proaspăt (sau 1 linguriță uscat)', 'apă fierbinte (250ml)', 'miere (opțional)'],
    preparation: 'Infuzează rozmarinul 5-7 minute în apă fierbinte. Filtrează și bea dimineața. Nu consuma seara — poate tulbura somnul.',
    calories_estimated: 5,
    tags: ['ceai', 'cognitiv', 'dimineață', 'energizant'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Ceai de lavandă',
    description: 'Reduce stresul și anxietatea. Linaloolul are efect sedativ dovedit. Ameliorează insomnia ușoară. Recomandat seara cu miere de lavandă.',
    ingredients: ['1 linguriță flori de lavandă uscate', 'apă fierbinte (250ml)', 'miere de lavandă', 'felie de lămâie (opțional)'],
    preparation: 'Infuzează lavanda 5 minute în apă fierbinte (nu clocotită pentru a păstra uleiurile esențiale). Filtrează și adaugă miere.',
    calories_estimated: 5,
    tags: ['ceai', 'calmant', 'seară', 'stres'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Ceai de urzică',
    description: 'Bogat în fier, calciu și vitaminele A, C, K. Diuretic natural, ajută la eliminarea toxinelor. Recomandat în anemie feriprivă și retenție de apă.',
    ingredients: ['2 lingurițe urzică uscată', 'apă fierbinte (300ml)', 'zeamă de lămâie', 'miere (opțional)'],
    preparation: 'Infuzează urzica 7-10 minute. Filtrează, adaugă lămâie. Bea 1-2 căni pe zi, dimineața sau la prânz.',
    calories_estimated: 5,
    tags: ['ceai', 'detox', 'fier', 'minerale'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Ceai de păpădie',
    description: 'Stimulează funcția hepatică și producția de bilă. Diuretic natural fără pierdere de potasiu. Prebiotic (inulina hrănește bacteriile benefice). Detoxifiant hepatic.',
    ingredients: ['1 linguriță rădăcină de păpădie uscată', 'apă fierbinte (300ml)', 'zeamă de lămâie'],
    preparation: 'Fierbe rădăcina de păpădie 10 minute. Lasă să se infuzeze încă 5 minute. Filtrează și adaugă lămâie.',
    calories_estimated: 5,
    tags: ['ceai', 'detox', 'hepatic', 'digestiv'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Ceai de sunătoare',
    description: 'Antidepresiv natural ușor (hipericina). Eficacitate dovedită în depresie ușoară-moderată. ATENȚIE: interacționează cu anticoagulante, anticoncepționale și antidepresive ISRS.',
    ingredients: ['1 linguriță sunătoare uscată', 'apă fierbinte (250ml)', 'miere (opțional)'],
    preparation: 'Infuzează sunătoarea 5-7 minute în apă fierbinte. Filtrează și consumă. Nu depăși 3 căni pe zi. Consultă medicul dacă iei medicamente.',
    calories_estimated: 5,
    tags: ['ceai', 'antidepresiv', 'calmant'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Ceai de cimbrișor (cimbru)',
    description: 'Antiseptic natural puternic (timolul). Eficient în infecții respiratorii, tuse și bronșită. Expectorant natural. Recomandat în sezonul rece.',
    ingredients: ['1 linguriță cimbrișor uscat', 'apă fierbinte (250ml)', 'miere', 'zeamă de lămâie'],
    preparation: 'Infuzează cimbrișorul 7-10 minute în apă fierbinte, acoperind vasul. Filtrează și adaugă miere și lămâie. Bea de 3 ori pe zi în caz de răceală.',
    calories_estimated: 5,
    tags: ['ceai', 'imunitate', 'respirator'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Ceai de salvie',
    description: 'Antiseptic bucal natural. Reduce transpirația excesivă. Ameliorează simptomele menopauzei (bufeuri). Îmbunătățește memoria la vârstnici.',
    ingredients: ['1 linguriță frunze de salvie uscate', 'apă fierbinte (250ml)', 'miere (opțional)'],
    preparation: 'Infuzează salvia 5-7 minute în apă fierbinte. Filtrează și consumă. Nu depăși 3 căni pe zi. Contraindicată în sarcină.',
    calories_estimated: 5,
    tags: ['ceai', 'hormonal', 'cognitiv'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Ceai de tei',
    description: 'Calmant natural și anxiolitic ușor. Reduce tensiunea arterială. Proprietăți antipiretice (reduce febra). Recomandat în stări de agitație și răceli.',
    ingredients: ['2 lingurițe flori de tei uscate', 'apă fierbinte (300ml)', 'miere de tei'],
    preparation: 'Infuzează florile de tei 10 minute în apă fierbinte, acoperit. Filtrează și îndulcește cu miere de tei.',
    calories_estimated: 5,
    tags: ['ceai', 'calmant', 'seară', 'febră'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Ceai rooibos',
    description: 'Fără cofeină, bogat în antioxidanți (aspalatina). Sigur pentru gravide și copii. Reduce alergiile și eczemele. Protejează sănătatea osoasă (calciu, mangan).',
    ingredients: ['1 plic sau 1 linguriță rooibos', 'apă fierbinte (300ml)', 'lapte (opțional)', 'miere (opțional)'],
    preparation: 'Infuzează rooibos 5-7 minute în apă clocotită. Poți adăuga lapte pentru un rooibos latte. Îndulcește cu miere dacă dorești.',
    calories_estimated: 5,
    tags: ['ceai', 'antioxidant', 'dimineață', 'seară'],
    is_public: true,
  },
  // ── Smoothie-uri și băuturi energizante ─────────────────────────────────
  {
    category: 'drink',
    title: 'Smoothie de spanac și banană',
    description: 'Combinația ideală de fier (spanac) + potasiu (banană). Fibră, vitamina K, magneziu. Perfect pentru dimineață sau post-antrenament.',
    ingredients: ['60g spanac proaspăt', '1 banană coaptă (congelată pentru textură)', '200ml lapte de migdale', '1 linguriță miere', 'gheață (opțional)'],
    preparation: 'Pune toate ingredientele în blender și mixează 60-90 secunde până obții o textură complet omogenă. Servește imediat.',
    calories_estimated: 180,
    tags: ['smoothie', 'energizant', 'dimineață'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Matcha Latte',
    description: '10x mai mulți antioxidanți decât ceaiul verde obișnuit. L-teanina oferă energie calmă fără agitația cafelei. Accelerează metabolismul.',
    ingredients: ['1 linguriță pudră matcha ceremonial grade', 'apă fierbinte la 75°C (50ml)', 'lapte de ovăz (200ml)', '1 linguriță miere'],
    preparation: 'Dizolvă matcha în puțin apă caldă (nu fierbinte) folosind un tel sau shaker. Încălzește laptele de ovăz. Amestecă cele două și adaugă miere.',
    calories_estimated: 120,
    tags: ['matcha', 'energizant', 'dimineață', 'antioxidant'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Smoothie de sfeclă și măr',
    description: 'Nitrații din sfeclă îmbunătățesc performanța fizică și oxigenarea musculară. Ideal pre-antrenament, cu 2 ore înainte.',
    ingredients: ['1 sfeclă roșie medie (crudă sau coaptă)', '1 măr verde', '1/2 lămâie (zeamă)', '200ml apă', '2cm ghimbir proaspăt'],
    preparation: 'Dacă sfecla e crudă, curăță și taie. Pune toate ingredientele în blender cu apă și mixează bine. Filtrează dacă preferi.',
    calories_estimated: 140,
    tags: ['smoothie', 'energizant', 'sport'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Apă cu lămâie și ghimbir',
    description: 'Stimulează digestia dimineața pe stomacul gol. Vitamina C + gingeroli. Alcalinizează organismul. Hidratare cu beneficii.',
    ingredients: ['500ml apă caldă (nu fierbinte)', 'zeamă de la 1/2 lămâie', '1 linguriță ghimbir proaspăt ras', '1 linguriță miere (opțional)'],
    preparation: 'Amestecă apa caldă cu zeama de lămâie și ghimbirul. Adaugă miere dacă dorești. Bea dimineața pe stomacul gol, cu 20 minute înainte de masă.',
    calories_estimated: 15,
    tags: ['infuzie', 'detox', 'dimineață'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Smoothie tropical cu turmeric',
    description: 'Mango + ananas + turmeric + piper negru. Antiinflamator, digestiv, bogat în vitamina C și bromelină.',
    ingredients: ['100g mango (congelat)', '100g ananas', '200ml lapte de cocos diluat', '1/2 linguriță turmeric', 'vârf piper negru', 'ghimbir proaspăt (1cm)'],
    preparation: 'Mixează toate ingredientele în blender până obții un smoothie omogen și cremos. Piperul negru este esențial pentru absorbția curcuminei.',
    calories_estimated: 200,
    tags: ['smoothie', 'antiinflamator', 'vitamine'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Lapte de migdale cu scorțișoară',
    description: 'Fără lactoză, scăzut caloric. Scorțișoara stabilizează glicemia. Ideal seara sau pentru cei cu intoleranță la lactoză.',
    ingredients: ['250ml lapte de migdale neîndulcit', '1/4 linguriță scorțișoară', 'vanilie (vârf de cuțit)', '1 linguriță miere (opțional)'],
    preparation: 'Încălzește laptele de migdale la foc mic. Adaugă scorțișoara și vanilia, amestecă bine. Bea cald seara înainte de culcare.',
    calories_estimated: 80,
    tags: ['detox', 'seară', 'fără lactoză'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Kombucha',
    description: 'Ceai fermentat bogat în probiotice. Susține flora intestinală, îmbunătățește digestia. Conține vitamine B și enzime. Limitează la 250ml/zi.',
    ingredients: ['250ml kombucha comercial (sau de casă)', 'gheață', 'felii de fructe (opțional)'],
    preparation: 'Kombucha se consumă rece, direct din sticlă sau turnat în pahar cu gheață. Poți adăuga felii de citrice sau ghimbir pentru plus de aromă.',
    calories_estimated: 30,
    tags: ['probiotic', 'fermentat', 'digestiv'],
    is_public: true,
  },
  {
    category: 'drink',
    title: 'Apă cu castraveți și mentă',
    description: 'Hidratare optimă cu beneficii: castraveții conțin siliciu (piele sănătoasă), mentă pentru digestie. Zero calorii practic.',
    ingredients: ['1L apă plată', '1/2 castravete (feliat)', 'mână de mentă proaspătă', 'felii de lime (opțional)'],
    preparation: 'Taie castraveții felii subțiri. Adaugă menta și castraveții în apa rece. Lasă la frigider minim 2 ore. Servește cu gheață.',
    calories_estimated: 5,
    tags: ['detox', 'hidratare'],
    is_public: true,
  },
]

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const backup = localStorage.getItem('marechef-session')
    if (backup) {
      const parsed = JSON.parse(backup)
      if (parsed?.access_token) { h['Authorization'] = `Bearer ${parsed.access_token}`; return h }
    }
  } catch { /* ignore */ }
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) h['Authorization'] = `Bearer ${session.access_token}`
  return h
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  title: string
  description: string
  ingredientsRaw: string
  preparation: string
  calories_estimated: string
  tags: string[]
  is_public: boolean
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  ingredientsRaw: '',
  preparation: '',
  calories_estimated: '',
  tags: [],
  is_public: false,
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HealthRecipesClient() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [activeTab, setActiveTab] = useState<'food' | 'drink'>('food')
  const [recipes, setRecipes] = useState<HealthRecipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Form
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Deletion
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Resolve current user ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem('marechef-session')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.user?.id) { setUserId(parsed.user.id); return }
      }
    } catch { /* ignore */ }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setUserId(session.user.id)
    })
  }, [])

  // ── Fetch recipes ─────────────────────────────────────────────────────────
  const fetchRecipes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/health/recipes?category=${activeTab}`, { headers })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Eroare la încărcarea rețetelor')
      }
      const data = await res.json()
      setRecipes(data.recipes ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Eroare necunoscută')
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    fetchRecipes()
  }, [fetchRecipes])

  // ── Open form (add) ───────────────────────────────────────────────────────
  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setSaveError(null)
    setFormOpen(true)
    setTimeout(() => {
      document.getElementById('hr-title-input')?.focus()
    }, 50)
  }

  // ── Open form (edit) ──────────────────────────────────────────────────────
  function openEdit(recipe: HealthRecipe) {
    setEditingId(recipe.id)
    setForm({
      title: recipe.title,
      description: recipe.description ?? '',
      ingredientsRaw: (recipe.ingredients ?? []).join('\n'),
      preparation: recipe.preparation ?? '',
      calories_estimated: recipe.calories_estimated != null ? String(recipe.calories_estimated) : '',
      tags: recipe.tags ?? [],
      is_public: recipe.is_public,
    })
    setSaveError(null)
    setFormOpen(true)
  }

  // ── Close form ────────────────────────────────────────────────────────────
  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setSaveError(null)
  }

  // ── Toggle tag ────────────────────────────────────────────────────────────
  function toggleTag(tag: string) {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }))
  }

  // ── Submit form ───────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaveError(null)

    if (!form.title.trim()) {
      setSaveError('Titlul este obligatoriu.')
      return
    }

    setSaving(true)
    try {
      const headers = await getAuthHeaders()
      const ingredients = form.ingredientsRaw
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)

      const body = {
        category: activeTab,
        title: form.title.trim(),
        description: form.description.trim() || null,
        ingredients,
        preparation: form.preparation.trim() || null,
        calories_estimated: form.calories_estimated ? Number(form.calories_estimated) : null,
        tags: form.tags,
        is_public: form.is_public,
      }

      if (editingId) {
        // DELETE old + POST new (no PATCH endpoint, keep it simple)
        await fetch(`/api/health/recipes?id=${editingId}`, { method: 'DELETE', headers })
      }

      const res = await fetch('/api/health/recipes', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Eroare la salvare')
      }

      closeForm()
      await fetchRecipes()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Eroare necunoscută')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('Ștergi această rețetă de sănătate?')) return
    setDeletingId(id)
    try {
      const headers = await getAuthHeaders()
      await fetch(`/api/health/recipes?id=${id}`, { method: 'DELETE', headers })
      setRecipes(rs => rs.filter(r => r.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  // ── Copy suggestion ───────────────────────────────────────────────────────
  async function copySuggestion(seed: Omit<HealthRecipe, 'id' | 'user_id' | 'created_at'>) {
    const headers = await getAuthHeaders()
    const res = await fetch('/api/health/recipes', {
      method: 'POST',
      headers,
      body: JSON.stringify(seed),
    })
    if (res.ok) await fetchRecipes()
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const seeds = activeTab === 'food' ? FOOD_SEED : DRINK_SEED
  const availableTags = activeTab === 'food' ? FOOD_TAGS : DRINK_TAGS
  const ownRecipes = recipes.filter(r => r.user_id === userId)
  const publicFromOthers = recipes.filter(r => r.user_id !== userId && r.is_public)

  // ─── Styles ──────────────────────────────────────────────────────────────
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#fff'
  const cardBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)'
  const inputSt: React.CSSProperties = {
    background: isDark ? 'rgba(255,255,255,0.06)' : '#f8f8f8',
    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)',
    color: 'hsl(var(--foreground))',
    borderRadius: 8,
    padding: '8px 12px',
    width: '100%',
    fontSize: 14,
    outline: 'none',
  }
  const labelSt: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 4,
    display: 'block',
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28" style={{ color: 'hsl(var(--foreground))' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Rețete de Sănătate</h1>
          <p className="text-sm opacity-60 mt-0.5">Alimente și băuturi pentru stilul tău de viață sănătos</p>
        </div>
        {!formOpen && (
          <button
            onClick={openAdd}
            className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
            style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}
          >
            + Adaugă
          </button>
        )}
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div
        className="flex rounded-xl overflow-hidden mb-6"
        style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0' }}
      >
        {(['food', 'drink'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setFormOpen(false) }}
            className="flex-1 py-2.5 text-sm font-semibold transition-all"
            style={activeTab === tab
              ? { background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff', borderRadius: 10 }
              : { color: isDark ? '#999' : '#666', background: 'transparent' }
            }
          >
            {tab === 'food' ? '🥗 Alimente' : '🍵 Băuturi'}
          </button>
        ))}
      </div>

      {/* ── Inline form ─────────────────────────────────────────────────── */}
      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-5 mb-6 flex flex-col gap-4"
          style={{ background: cardBg, border: cardBorder }}
        >
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-base">
              {editingId ? 'Editează rețeta' : `Rețetă nouă — ${activeTab === 'food' ? 'Aliment' : 'Băutură'}`}
            </h2>
            <button type="button" onClick={closeForm} style={{ opacity: 0.5, fontSize: 18 }}>✕</button>
          </div>

          {/* Title */}
          <div>
            <label style={labelSt}>Titlu *</label>
            <input
              id="hr-title-input"
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="ex. Ouă fierte moi"
              style={inputSt}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label style={labelSt}>Descriere</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="O scurtă descriere a rețetei..."
              rows={2}
              style={{ ...inputSt, resize: 'vertical' }}
            />
          </div>

          {/* Ingredients */}
          <div>
            <label style={labelSt}>Ingrediente (câte unul pe linie)</label>
            <textarea
              value={form.ingredientsRaw}
              onChange={e => setForm(f => ({ ...f, ingredientsRaw: e.target.value }))}
              placeholder={'2 ouă\napă\nsare'}
              rows={4}
              style={{ ...inputSt, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
            />
          </div>

          {/* Preparation */}
          <div>
            <label style={labelSt}>Preparare</label>
            <textarea
              value={form.preparation}
              onChange={e => setForm(f => ({ ...f, preparation: e.target.value }))}
              placeholder="Pași de preparare..."
              rows={3}
              style={{ ...inputSt, resize: 'vertical' }}
            />
          </div>

          {/* Calories */}
          <div>
            <label style={labelSt}>Calorii estimate (kcal)</label>
            <input
              type="number"
              min={0}
              max={9999}
              value={form.calories_estimated}
              onChange={e => setForm(f => ({ ...f, calories_estimated: e.target.value }))}
              placeholder="ex. 140"
              style={{ ...inputSt, width: 160 }}
            />
          </div>

          {/* Tags */}
          <div>
            <label style={labelSt}>Etichete</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                  style={form.tags.includes(tag)
                    ? { background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }
                    : { background: isDark ? 'rgba(255,255,255,0.08)' : '#eee', color: isDark ? '#ccc' : '#444' }
                  }
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Public */}
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={form.is_public}
              onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <span>Disponibil pentru toți utilizatorii</span>
          </label>

          {saveError && (
            <p className="text-sm" style={{ color: '#ff4d6d' }}>{saveError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-full text-sm font-semibold transition-all"
              style={{ background: saving ? '#555' : 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}
            >
              {saving ? 'Se salvează...' : editingId ? 'Actualizează' : 'Adaugă rețeta'}
            </button>
            <button type="button" onClick={closeForm} className="px-4 py-2 rounded-full text-sm" style={{ opacity: 0.6 }}>
              Anulează
            </button>
          </div>
        </form>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="text-sm text-center py-4" style={{ color: '#ff4d6d' }}>
          {error}
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading && (
        <div className="text-sm text-center py-8 opacity-50">Se încarcă rețetele...</div>
      )}

      {/* ── Own recipes ──────────────────────────────────────────────────── */}
      {!loading && (
        <>
          {ownRecipes.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-3">
                Rețetele mele
              </h2>
              <div className="flex flex-col gap-3">
                {ownRecipes.map(r => (
                  <RecipeCard
                    key={r.id}
                    recipe={r}
                    isOwn={true}
                    isDark={isDark}
                    cardBg={cardBg}
                    cardBorder={cardBorder}
                    deleting={deletingId === r.id}
                    onEdit={() => openEdit(r)}
                    onDelete={() => handleDelete(r.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Public from others ───────────────────────────────────────── */}
          {publicFromOthers.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-3">
                De la comunitate
              </h2>
              <div className="flex flex-col gap-3">
                {publicFromOthers.map(r => (
                  <RecipeCard
                    key={r.id}
                    recipe={r}
                    isOwn={false}
                    isDark={isDark}
                    cardBg={cardBg}
                    cardBorder={cardBorder}
                    deleting={false}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Suggestions (shown when user has no own recipes) ─────────── */}
          {ownRecipes.length === 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-3">
                Sugestii recomandate
              </h2>
              <p className="text-sm opacity-60 mb-4">
                Nu ai rețete de sănătate încă. Adaugă una dintre sugestiile de mai jos sau creează una proprie.
              </p>
              <div className="flex flex-col gap-3">
                {seeds.map((seed, idx) => (
                  <SuggestionCard
                    key={idx}
                    seed={seed}
                    isDark={isDark}
                    cardBg={cardBg}
                    cardBorder={cardBorder}
                    onAdd={() => copySuggestion(seed)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ─── RecipeCard ───────────────────────────────────────────────────────────────

interface RecipeCardProps {
  recipe: HealthRecipe
  isOwn: boolean
  isDark: boolean
  cardBg: string
  cardBorder: string
  deleting: boolean
  onEdit: () => void
  onDelete: () => void
}

function RecipeCard({ recipe, isOwn, isDark, cardBg, cardBorder, deleting, onEdit, onDelete }: RecipeCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: cardBorder }}>
      <button
        type="button"
        className="w-full text-left px-4 pt-4 pb-3"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">{recipe.title}</h3>
              {recipe.is_public && !isOwn && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                  público
                </span>
              )}
              {recipe.is_public && isOwn && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                  public
                </span>
              )}
            </div>
            {recipe.description && (
              <p className="text-xs opacity-60 mt-0.5 line-clamp-1">{recipe.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              {recipe.calories_estimated != null && (
                <span className="text-xs font-medium" style={{ color: '#ff9500' }}>
                  {recipe.calories_estimated} kcal
                </span>
              )}
              {recipe.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {recipe.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#eee', color: isDark ? '#aaa' : '#555' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <span className="text-xs opacity-40 flex-shrink-0 mt-1">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
          {recipe.ingredients.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-bold uppercase tracking-wide opacity-40 mb-1.5">Ingrediente</p>
              <ul className="flex flex-col gap-0.5">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="text-sm flex items-center gap-2">
                    <span style={{ color: '#ff9500', fontSize: 10 }}>●</span>
                    {ing}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {recipe.preparation && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide opacity-40 mb-1.5">Preparare</p>
              <p className="text-sm leading-relaxed opacity-80">{recipe.preparation}</p>
            </div>
          )}

          {isOwn && (
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onEdit}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#eee', color: isDark ? '#ccc' : '#444' }}
              >
                ✏️ Editează
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{ background: 'rgba(255,77,109,0.12)', color: '#ff4d6d' }}
              >
                {deleting ? 'Se șterge...' : '🗑️ Șterge'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── SuggestionCard ───────────────────────────────────────────────────────────

interface SuggestionCardProps {
  seed: Omit<HealthRecipe, 'id' | 'user_id' | 'created_at'>
  isDark: boolean
  cardBg: string
  cardBorder: string
  onAdd: () => void
}

function SuggestionCard({ seed, isDark, cardBg, cardBorder, onAdd }: SuggestionCardProps) {
  const [adding, setAdding] = useState(false)
  const [done, setDone] = useState(false)

  async function handleAdd() {
    if (adding || done) return
    setAdding(true)
    try {
      await onAdd()
      setDone(true)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="rounded-2xl px-4 py-3 flex items-start gap-3"
      style={{ background: isDark ? 'rgba(255,149,0,0.05)' : 'rgba(255,149,0,0.04)', border: isDark ? '1px solid rgba(255,149,0,0.15)' : '1px solid rgba(255,149,0,0.2)' }}>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{seed.title}</p>
        {seed.description && <p className="text-xs opacity-60 mt-0.5">{seed.description}</p>}
        <div className="flex items-center gap-3 mt-1.5">
          {seed.calories_estimated != null && (
            <span className="text-xs font-medium" style={{ color: '#ff9500' }}>{seed.calories_estimated} kcal</span>
          )}
          <div className="flex flex-wrap gap-1">
            {seed.tags.map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#eee', color: isDark ? '#aaa' : '#555' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={adding || done}
        className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
        style={done
          ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }
          : { background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }
        }
      >
        {done ? '✓ Adăugat' : adding ? '...' : 'Adaugă la rețetele mele'}
      </button>
    </div>
  )
}
