'use strict';

/**
 * seed-fresh-v2.js
 *
 * Pipeline:
 *   1. Scrape authentic recipes from food.com / allrecipes / BBCGoodFood
 *   2. Translate with Claude AI — Romanian, metric units, warm voice in steps
 *   3. Keep source URL + hero image from the original scraped page
 *   4. Insert into production Supabase DB
 *
 * NEVER generates fake recipes. Every recipe comes from a real source.
 * Claude only translates + converts units to metric.
 *
 * Usage:
 *   node scripts/seed-fresh-v2.js                   # all countries
 *   node scripts/seed-fresh-v2.js --from italy       # resume from prefix
 *   node scripts/seed-fresh-v2.js --only romania     # single country (test)
 *
 * Env (from .env.local):
 *   ANTHROPIC_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const https  = require('https');
const http   = require('http');
const { URL } = require('url');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID }   = require('crypto');
const fs   = require('fs');
const path = require('path');

// ─── Load .env.local ──────────────────────────────────────────────────────────
try {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌  Supabase env missing'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Config ───────────────────────────────────────────────────────────────────
const TARGET_PER_COUNTRY = 40;
const REQUEST_DELAY      = 700;   // ms between HTTP requests
const INSERT_DELAY       = 60;    // ms between DB inserts
const PROGRESS_FILE      = path.join(__dirname, '.seed-v2-progress.json');

// Ollama local model (dGPU, free)
const OLLAMA_MODEL = 'aya-expanse:8b';

const APPROACH_IDS = [
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000005',
  'b0000000-0000-0000-0000-000000000006',
];

// ─── Country map (196 countries) ──────────────────────────────────────────────
const COUNTRY_MAP = {
  'afghanistan':  { profileId:'c0000000-0000-0000-0000-000000000100', fullName:'Afghanistan',       searchTerms:['afghan','kabuli pulao','mantu'] },
  'albania':      { profileId:'c0000000-0000-0000-0000-000000000101', fullName:'Albania',           searchTerms:['albanian','tave kosi','byrek'] },
  'algeria':      { profileId:'c0000000-0000-0000-0000-000000000036', fullName:'Algeria',           searchTerms:['algerian','couscous','harissa','chorba'] },
  'argentina':    { profileId:'c0000000-0000-0000-0000-000000000015', fullName:'Argentina',         searchTerms:['argentine','empanada','chimichurri','asado'] },
  'armenia':      { profileId:'c0000000-0000-0000-0000-000000000102', fullName:'Armenia',           searchTerms:['armenian','khorovats','dolma','manti'] },
  'australia':    { profileId:'c0000000-0000-0000-0000-000000000030', fullName:'Australia',         searchTerms:['australian','pavlova','lamington','meat pie'] },
  'austria':      { profileId:'c0000000-0000-0000-0000-000000000054', fullName:'Austria',           searchTerms:['austrian','wiener schnitzel','apfelstrudel','kaiserschmarrn'] },
  'azerbaijan':   { profileId:'c0000000-0000-0000-0000-000000000103', fullName:'Azerbaijan',        searchTerms:['azerbaijani','plov','dolma','pakhlava'] },
  'bahrain':      { profileId:'c0000000-0000-0000-0000-000000000104', fullName:'Bahrain',           searchTerms:['bahraini','machboos','harees'] },
  'bangladesh':   { profileId:'c0000000-0000-0000-0000-000000000046', fullName:'Bangladesh',        searchTerms:['bangladeshi','hilsa','biryani','pitha'] },
  'barbados':     { profileId:'c0000000-0000-0000-0000-000000000105', fullName:'Barbados',          searchTerms:['barbadian','cou-cou','flying fish','bajan'] },
  'belarus':      { profileId:'c0000000-0000-0000-0000-000000000106', fullName:'Belarus',           searchTerms:['belarusian','draniki','machanka'] },
  'belgium':      { profileId:'c0000000-0000-0000-0000-000000000056', fullName:'Belgium',           searchTerms:['belgian','moules frites','waffle','carbonnade'] },
  'benin':        { profileId:'c0000000-0000-0000-0000-000000000107', fullName:'Benin',             searchTerms:['beninese','west african yam','akassa'] },
  'bhutan':       { profileId:'c0000000-0000-0000-0000-000000000108', fullName:'Bhutan',            searchTerms:['bhutanese','ema datshi','phaksha paa'] },
  'bolivia':      { profileId:'c0000000-0000-0000-0000-000000000109', fullName:'Bolivia',           searchTerms:['bolivian','saltena','anticucho'] },
  'bosnia':       { profileId:'c0000000-0000-0000-0000-000000000110', fullName:'Bosnia',            searchTerms:['bosnian','cevapi','burek','bosanski lonac'] },
  'botswana':     { profileId:'c0000000-0000-0000-0000-000000000111', fullName:'Botswana',          searchTerms:['botswana','seswaa','bogobe'] },
  'brazil':       { profileId:'c0000000-0000-0000-0000-000000000012', fullName:'Brazil',            searchTerms:['brazilian','feijoada','brigadeiro','moqueca'] },
  'brunei':       { profileId:'c0000000-0000-0000-0000-000000000112', fullName:'Brunei',            searchTerms:['bruneian','ambuyat','nasi katok'] },
  'bulgaria':     { profileId:'c0000000-0000-0000-0000-000000000064', fullName:'Bulgaria',          searchTerms:['bulgarian','banitsa','shopska','tarator'] },
  'burkina':      { profileId:'c0000000-0000-0000-0000-000000000113', fullName:'Burkina Faso',      searchTerms:['burkina','west african','riz gras'] },
  'burundi':      { profileId:'c0000000-0000-0000-0000-000000000114', fullName:'Burundi',           searchTerms:['burundian','isombe','ibiharage'] },
  'cambodia':     { profileId:'c0000000-0000-0000-0000-000000000065', fullName:'Cambodia',          searchTerms:['cambodian','khmer amok','lok lak'] },
  'cameroon':     { profileId:'c0000000-0000-0000-0000-000000000115', fullName:'Cameroon',          searchTerms:['cameroonian','ndole','poulet DG'] },
  'canada':       { profileId:'c0000000-0000-0000-0000-000000000037', fullName:'Canada',            searchTerms:['canadian','poutine','butter tarts','tourtiere'] },
  'chile':        { profileId:'c0000000-0000-0000-0000-000000000041', fullName:'Chile',             searchTerms:['chilean','empanada','cazuela','pastel de choclo'] },
  'china':        { profileId:'c0000000-0000-0000-0000-000000000011', fullName:'China',             searchTerms:['chinese','kung pao','dim sum','mapo tofu','dan dan'] },
  'colombia':     { profileId:'c0000000-0000-0000-0000-000000000040', fullName:'Colombia',          searchTerms:['colombian','bandeja paisa','ajiaco','arepa'] },
  'congo':        { profileId:'c0000000-0000-0000-0000-000000000116', fullName:'Congo',             searchTerms:['congolese','pondu','moambe chicken','fufu'] },
  'costa':        { profileId:'c0000000-0000-0000-0000-000000000117', fullName:'Costa Rica',        searchTerms:['costa rican','gallo pinto','casado'] },
  'croatia':      { profileId:'c0000000-0000-0000-0000-000000000062', fullName:'Croatia',           searchTerms:['croatian','peka','pasticada','strukli'] },
  'cuba':         { profileId:'c0000000-0000-0000-0000-000000000039', fullName:'Cuba',              searchTerms:['cuban','ropa vieja','moros y cristianos','tostones'] },
  'cyprus':       { profileId:'c0000000-0000-0000-0000-000000000118', fullName:'Cyprus',            searchTerms:['cypriot','halloumi','kleftiko'] },
  'czech':        { profileId:'c0000000-0000-0000-0000-000000000061', fullName:'Czech Republic',    searchTerms:['czech','svickova','trdelnik','gulas'] },
  'denmark':      { profileId:'c0000000-0000-0000-0000-000000000058', fullName:'Denmark',           searchTerms:['danish','smorrebrod','frikadeller','aebleskiver'] },
  'djibouti':     { profileId:'c0000000-0000-0000-0000-000000000119', fullName:'Djibouti',          searchTerms:['djibouti','fah-fah','somali east african'] },
  'dominican':    { profileId:'c0000000-0000-0000-0000-000000000120', fullName:'Dominican Republic',searchTerms:['dominican','mangu','la bandera','sancocho'] },
  'east':         { profileId:'c0000000-0000-0000-0000-000000000121', fullName:'East Timor',        searchTerms:['timorese','ikan pepes','southeast asian'] },
  'ecuador':      { profileId:'c0000000-0000-0000-0000-000000000069', fullName:'Ecuador',           searchTerms:['ecuadorian','ceviche','llapingachos'] },
  'egypt':        { profileId:'c0000000-0000-0000-0000-000000000028', fullName:'Egypt',             searchTerms:['egyptian','koshari','ful medames','molokhia'] },
  'el':           { profileId:'c0000000-0000-0000-0000-000000000122', fullName:'El Salvador',       searchTerms:['salvadoran','pupusa','curtido'] },
  'eritrea':      { profileId:'c0000000-0000-0000-0000-000000000123', fullName:'Eritrea',           searchTerms:['eritrean','injera','zigni'] },
  'estonia':      { profileId:'c0000000-0000-0000-0000-000000000124', fullName:'Estonia',           searchTerms:['estonian','verivorst','kama','baltic'] },
  'ethiopia':     { profileId:'c0000000-0000-0000-0000-000000000023', fullName:'Ethiopia',          searchTerms:['ethiopian','doro wot','kitfo','injera'] },
  'fiji':         { profileId:'c0000000-0000-0000-0000-000000000125', fullName:'Fiji',              searchTerms:['fijian','kokoda','lovo','palusami'] },
  'finland':      { profileId:'c0000000-0000-0000-0000-000000000059', fullName:'Finland',           searchTerms:['finnish','lohikeitto','karjalanpiirakka','poronkaristys'] },
  'france':       { profileId:'c0000000-0000-0000-0000-000000000002', fullName:'France',            searchTerms:['french','boeuf bourguignon','coq au vin','ratatouille'] },
  'gambia':       { profileId:'c0000000-0000-0000-0000-000000000126', fullName:'Gambia',            searchTerms:['gambian','benachin','domoda'] },
  'georgia':      { profileId:'c0000000-0000-0000-0000-000000000047', fullName:'Georgia',           searchTerms:['georgian','khachapuri','khinkali','chakhokhbili'] },
  'germany':      { profileId:'c0000000-0000-0000-0000-000000000004', fullName:'Germany',           searchTerms:['german','sauerbraten','schweinshaxe','black forest cake'] },
  'ghana':        { profileId:'c0000000-0000-0000-0000-000000000033', fullName:'Ghana',             searchTerms:['ghanaian','jollof rice','kelewele','fufu'] },
  'greece':       { profileId:'c0000000-0000-0000-0000-000000000008', fullName:'Greece',            searchTerms:['greek','moussaka','spanakopita','souvlaki'] },
  'guatemala':    { profileId:'c0000000-0000-0000-0000-000000000127', fullName:'Guatemala',         searchTerms:['guatemalan','pepian','tamales','jocon'] },
  'guinea':       { profileId:'c0000000-0000-0000-0000-000000000128', fullName:'Guinea',            searchTerms:['guinean','yassa poulet','mafe','west african'] },
  'guyana':       { profileId:'c0000000-0000-0000-0000-000000000129', fullName:'Guyana',            searchTerms:['guyanese','pepperpot','cook-up rice'] },
  'haiti':        { profileId:'c0000000-0000-0000-0000-000000000130', fullName:'Haiti',             searchTerms:['haitian','griot','diri ak djon djon'] },
  'hawaii':       { profileId:'c0000000-0000-0000-0000-000000000131', fullName:'Hawaii',            searchTerms:['hawaiian','poke bowl','lau lau','kalua pork'] },
  'honduras':     { profileId:'c0000000-0000-0000-0000-000000000132', fullName:'Honduras',          searchTerms:['honduran','baleada','sopa de caracol'] },
  'hong':         { profileId:'c0000000-0000-0000-0000-000000000133', fullName:'Hong Kong',         searchTerms:['hong kong','char siu','egg tarts','wonton'] },
  'hungary':      { profileId:'c0000000-0000-0000-0000-000000000060', fullName:'Hungary',           searchTerms:['hungarian','gulas','langos','paprikas csirke'] },
  'iceland':      { profileId:'c0000000-0000-0000-0000-000000000134', fullName:'Iceland',           searchTerms:['icelandic','plokkfiskur','kjotsupa','skyr'] },
  'india':        { profileId:'c0000000-0000-0000-0000-000000000007', fullName:'India',             searchTerms:['indian','butter chicken','dal','biryani','palak paneer'] },
  'indonesia':    { profileId:'c0000000-0000-0000-0000-000000000019', fullName:'Indonesia',         searchTerms:['indonesian','nasi goreng','rendang','satay','gado-gado'] },
  'iran':         { profileId:'c0000000-0000-0000-0000-000000000027', fullName:'Iran',              searchTerms:['persian','ghormeh sabzi','tahdig','fesenjan'] },
  'iraq':         { profileId:'c0000000-0000-0000-0000-000000000135', fullName:'Iraq',              searchTerms:['iraqi','masgouf','tepsi','maqluba'] },
  'ireland':      { profileId:'c0000000-0000-0000-0000-000000000053', fullName:'Ireland',           searchTerms:['irish stew','colcannon','soda bread','coddle'] },
  'israel':       { profileId:'c0000000-0000-0000-0000-000000000051', fullName:'Israel',            searchTerms:['israeli','shakshuka','hummus','falafel'] },
  'italy':        { profileId:'c0000000-0000-0000-0000-000000000001', fullName:'Italy',             searchTerms:['italian','cacio e pepe','ossobuco','tiramisu','ribollita'] },
  'ivory':        { profileId:'c0000000-0000-0000-0000-000000000136', fullName:'Ivory Coast',       searchTerms:['ivorian','attieke','aloco','kedjenou'] },
  'jamaica':      { profileId:'c0000000-0000-0000-0000-000000000038', fullName:'Jamaica',           searchTerms:['jamaican','jerk chicken','ackee saltfish','oxtail'] },
  'japan':        { profileId:'c0000000-0000-0000-0000-000000000005', fullName:'Japan',             searchTerms:['japanese','tonkotsu ramen','gyoza','okonomiyaki'] },
  'jordan':       { profileId:'c0000000-0000-0000-0000-000000000070', fullName:'Jordan',            searchTerms:['jordanian','mansaf','maqluba','knafeh'] },
  'kazakhstan':   { profileId:'c0000000-0000-0000-0000-000000000137', fullName:'Kazakhstan',        searchTerms:['kazakh','beshbarmak','kurt','baursak'] },
  'kenya':        { profileId:'c0000000-0000-0000-0000-000000000034', fullName:'Kenya',             searchTerms:['kenyan','nyama choma','ugali','sukuma wiki'] },
  'kosovo':       { profileId:'c0000000-0000-0000-0000-000000000138', fullName:'Kosovo',            searchTerms:['kosovar','flija','balkan burek'] },
  'kuwait':       { profileId:'c0000000-0000-0000-0000-000000000139', fullName:'Kuwait',            searchTerms:['kuwaiti','machboos','harees','gulf'] },
  'kyrgyzstan':   { profileId:'c0000000-0000-0000-0000-000000000140', fullName:'Kyrgyzstan',        searchTerms:['kyrgyz','beshbarmak','lagman','manti'] },
  'laos':         { profileId:'c0000000-0000-0000-0000-000000000141', fullName:'Laos',              searchTerms:['laotian','laab','tam mak hoong'] },
  'latvia':       { profileId:'c0000000-0000-0000-0000-000000000142', fullName:'Latvia',            searchTerms:['latvian','piragi','grey peas bacon'] },
  'lebanon':      { profileId:'c0000000-0000-0000-0000-000000000025', fullName:'Lebanon',           searchTerms:['lebanese','kibbeh','tabbouleh','fattoush','manoush'] },
  'liberia':      { profileId:'c0000000-0000-0000-0000-000000000143', fullName:'Liberia',           searchTerms:['liberian','palm butter soup','jollof rice'] },
  'libya':        { profileId:'c0000000-0000-0000-0000-000000000144', fullName:'Libya',             searchTerms:['libyan','bazin','asida','north african'] },
  'lithuania':    { profileId:'c0000000-0000-0000-0000-000000000145', fullName:'Lithuania',         searchTerms:['lithuanian','cepelinai','saltibarsciai','kugelis'] },
  'luxembourg':   { profileId:'c0000000-0000-0000-0000-000000000146', fullName:'Luxembourg',        searchTerms:['luxembourg','judd mat gaardebounen','bouneschlupp'] },
  'madagascar':   { profileId:'c0000000-0000-0000-0000-000000000147', fullName:'Madagascar',        searchTerms:['malagasy','romazava','ravitoto'] },
  'malawi':       { profileId:'c0000000-0000-0000-0000-000000000148', fullName:'Malawi',            searchTerms:['malawian','nsima','chambo'] },
  'malaysia':     { profileId:'c0000000-0000-0000-0000-000000000042', fullName:'Malaysia',          searchTerms:['malaysian','nasi lemak','rendang','laksa','roti canai'] },
  'maldives':     { profileId:'c0000000-0000-0000-0000-000000000149', fullName:'Maldives',          searchTerms:['maldivian','mas huni','garudhiya'] },
  'mali':         { profileId:'c0000000-0000-0000-0000-000000000150', fullName:'Mali',              searchTerms:['malian','tiga degu na','mafe','fonio'] },
  'malta':        { profileId:'c0000000-0000-0000-0000-000000000151', fullName:'Malta',             searchTerms:['maltese','pastizzi','stuffat tal-fenek'] },
  'mauritania':   { profileId:'c0000000-0000-0000-0000-000000000152', fullName:'Mauritania',        searchTerms:['mauritanian','thieboudienne','mechoui'] },
  'mexico':       { profileId:'c0000000-0000-0000-0000-000000000006', fullName:'Mexico',            searchTerms:['mexican','mole negro','chiles en nogada','pozole','tamales'] },
  'midwestern':   { profileId:'c0000000-0000-0000-0000-000000000153', fullName:'Midwestern US',     searchTerms:['midwestern','hot dish','corn chowder','pot roast'] },
  'moldova':      { profileId:'c0000000-0000-0000-0000-000000000154', fullName:'Moldova',           searchTerms:['moldovan','mamaliga','placinta','zeama'] },
  'mongolia':     { profileId:'c0000000-0000-0000-0000-000000000155', fullName:'Mongolia',          searchTerms:['mongolian','buuz','khorkhog','tsuivan'] },
  'montenegro':   { profileId:'c0000000-0000-0000-0000-000000000156', fullName:'Montenegro',        searchTerms:['montenegrin','kacamak','cicvara'] },
  'morocco':      { profileId:'c0000000-0000-0000-0000-000000000009', fullName:'Morocco',           searchTerms:['moroccan','tagine','bastilla','harira','msemen'] },
  'mozambique':   { profileId:'c0000000-0000-0000-0000-000000000157', fullName:'Mozambique',        searchTerms:['mozambican','piri piri chicken','matapa'] },
  'myanmar':      { profileId:'c0000000-0000-0000-0000-000000000066', fullName:'Myanmar',           searchTerms:['burmese','mohinga','tea leaf salad'] },
  'namibia':      { profileId:'c0000000-0000-0000-0000-000000000158', fullName:'Namibia',           searchTerms:['namibian','potjiekos','biltong'] },
  'nepal':        { profileId:'c0000000-0000-0000-0000-000000000071', fullName:'Nepal',             searchTerms:['nepali','momo','dal bhat','thukpa'] },
  'netherlands':  { profileId:'c0000000-0000-0000-0000-000000000055', fullName:'Netherlands',       searchTerms:['dutch','stamppot','bitterballen','erwtensoep'] },
  'new':          { profileId:'c0000000-0000-0000-0000-000000000031', fullName:'New Zealand',       searchTerms:['new zealand','pavlova','hangi','whitebait fritters'] },
  'nicaragua':    { profileId:'c0000000-0000-0000-0000-000000000159', fullName:'Nicaragua',         searchTerms:['nicaraguan','gallo pinto','nacatamal'] },
  'niger':        { profileId:'c0000000-0000-0000-0000-000000000160', fullName:'Niger',             searchTerms:['niger','dambou','tuo zaafi','kilishi'] },
  'nigeria':      { profileId:'c0000000-0000-0000-0000-000000000022', fullName:'Nigeria',           searchTerms:['nigerian','jollof rice','egusi soup','suya','moi moi'] },
  'north':        { profileId:'c0000000-0000-0000-0000-000000000161', fullName:'North Macedonia',   searchTerms:['macedonian','tavce gravce','ajvar'] },
  'northeastern': { profileId:'c0000000-0000-0000-0000-000000000162', fullName:'Northeastern US',   searchTerms:['new england','clam chowder','lobster roll'] },
  'norway':       { profileId:'c0000000-0000-0000-0000-000000000057', fullName:'Norway',            searchTerms:['norwegian','farikal','lutefisk','lefse'] },
  'oman':         { profileId:'c0000000-0000-0000-0000-000000000163', fullName:'Oman',              searchTerms:['omani','shuwa','mashuai','harees'] },
  'pakistan':     { profileId:'c0000000-0000-0000-0000-000000000045', fullName:'Pakistan',          searchTerms:['pakistani','nihari','karahi','haleem','seekh kebab'] },
  'palestine':    { profileId:'c0000000-0000-0000-0000-000000000164', fullName:'Palestine',         searchTerms:['palestinian','musakhan','maqluba'] },
  'panama':       { profileId:'c0000000-0000-0000-0000-000000000165', fullName:'Panama',            searchTerms:['panamanian','sancocho de gallina','carimanolas'] },
  'papua':        { profileId:'c0000000-0000-0000-0000-000000000166', fullName:'Papua New Guinea',  searchTerms:['papua','mumu','kau kau','aibika greens'] },
  'paraguay':     { profileId:'c0000000-0000-0000-0000-000000000167', fullName:'Paraguay',          searchTerms:['paraguayan','sopa paraguaya','chipa'] },
  'peru':         { profileId:'c0000000-0000-0000-0000-000000000024', fullName:'Peru',              searchTerms:['peruvian','ceviche','lomo saltado','aji de gallina'] },
  'philippines':  { profileId:'c0000000-0000-0000-0000-000000000017', fullName:'Philippines',       searchTerms:['filipino','adobo','sinigang','lechon','kare-kare'] },
  'poland':       { profileId:'c0000000-0000-0000-0000-000000000014', fullName:'Poland',            searchTerms:['polish','bigos','pierogi','zurek','barszcz'] },
  'portugal':     { profileId:'c0000000-0000-0000-0000-000000000020', fullName:'Portugal',          searchTerms:['portuguese','bacalhau','caldo verde','pastel de nata'] },
  'puerto':       { profileId:'c0000000-0000-0000-0000-000000000168', fullName:'Puerto Rico',       searchTerms:['puerto rican','mofongo','arroz con gandules','pernil'] },
  'qatar':        { profileId:'c0000000-0000-0000-0000-000000000169', fullName:'Qatar',             searchTerms:['qatari','machboos','harees','luqaimat'] },
  'romania':      { profileId:'c0000000-0000-0000-0000-000000000063', fullName:'Romania',           searchTerms:['romanian','sarmale','ciorba de burta','mici','mamaliga'] },
  'russia':       { profileId:'c0000000-0000-0000-0000-000000000016', fullName:'Russia',            searchTerms:['russian','beef stroganoff','pelmeni','borscht','blini'] },
  'rwanda':       { profileId:'c0000000-0000-0000-0000-000000000170', fullName:'Rwanda',            searchTerms:['rwandan','isombe','brochettes'] },
  'samoa':        { profileId:'c0000000-0000-0000-0000-000000000171', fullName:'Samoa',             searchTerms:['samoan','palusami','oka','sapasui'] },
  'saudi':        { profileId:'c0000000-0000-0000-0000-000000000049', fullName:'Saudi Arabia',      searchTerms:['saudi','kabsa','mandi','jareesh'] },
  'senegal':      { profileId:'c0000000-0000-0000-0000-000000000172', fullName:'Senegal',           searchTerms:['senegalese','thieboudienne','yassa poulet','mafe'] },
  'serbia':       { profileId:'c0000000-0000-0000-0000-000000000173', fullName:'Serbia',            searchTerms:['serbian','cevapi','ajvar','sarma','gibanica'] },
  'sierra':       { profileId:'c0000000-0000-0000-0000-000000000174', fullName:'Sierra Leone',      searchTerms:['sierra leone','cassava leaves','groundnut stew'] },
  'singapore':    { profileId:'c0000000-0000-0000-0000-000000000043', fullName:'Singapore',         searchTerms:['singaporean','hainanese chicken rice','chilli crab','laksa'] },
  'slovakia':     { profileId:'c0000000-0000-0000-0000-000000000175', fullName:'Slovakia',          searchTerms:['slovak','bryndzove halusky','kapustnica'] },
  'slovenia':     { profileId:'c0000000-0000-0000-0000-000000000176', fullName:'Slovenia',          searchTerms:['slovenian','potica','kranjska klobasa'] },
  'somalia':      { profileId:'c0000000-0000-0000-0000-000000000177', fullName:'Somalia',           searchTerms:['somali','bariis iskukaris','suqaar','xalwo'] },
  'south-africa': { profileId:'c0000000-0000-0000-0000-000000000032', fullName:'South Africa',      searchTerms:['south african','bobotie','braai','biltong','malva pudding'] },
  'south-korea':  { profileId:'c0000000-0000-0000-0000-000000000018', fullName:'South Korea',       searchTerms:['korean','kimchi jjigae','bibimbap','bulgogi','japchae'] },
  'southern':     { profileId:'c0000000-0000-0000-0000-000000000178', fullName:'Southern US',       searchTerms:['southern','shrimp grits','chicken waffles','gumbo'] },
  'spain':        { profileId:'c0000000-0000-0000-0000-000000000003', fullName:'Spain',             searchTerms:['spanish','paella','gazpacho','tortilla espanola','cocido'] },
  'sri':          { profileId:'c0000000-0000-0000-0000-000000000044', fullName:'Sri Lanka',         searchTerms:['sri lankan','kottu roti','hoppers','pol sambol'] },
  'sudan':        { profileId:'c0000000-0000-0000-0000-000000000179', fullName:'Sudan',             searchTerms:['sudanese','ful medames','kisra','asida'] },
  'suriname':     { profileId:'c0000000-0000-0000-0000-000000000180', fullName:'Suriname',          searchTerms:['surinamese','pom','roti met kip','heri heri'] },
  'sweden':       { profileId:'c0000000-0000-0000-0000-000000000021', fullName:'Sweden',            searchTerms:['swedish','köttbullar','gravlax','janssons frestelse'] },
  'switzerland':  { profileId:'c0000000-0000-0000-0000-000000000181', fullName:'Switzerland',       searchTerms:['swiss','fondue','raclette','rosti'] },
  'syria':        { profileId:'c0000000-0000-0000-0000-000000000182', fullName:'Syria',             searchTerms:['syrian','kibbeh','fattoush','muhammara'] },
  'taiwan':       { profileId:'c0000000-0000-0000-0000-000000000067', fullName:'Taiwan',            searchTerms:['taiwanese','beef noodle soup','lu rou fan'] },
  'tajikistan':   { profileId:'c0000000-0000-0000-0000-000000000183', fullName:'Tajikistan',        searchTerms:['tajik','qurutob','oshi palav','sambusa'] },
  'tanzania':     { profileId:'c0000000-0000-0000-0000-000000000184', fullName:'Tanzania',          searchTerms:['tanzanian','ugali','pilau','chipsi mayai'] },
  'tex':          { profileId:'c0000000-0000-0000-0000-000000000185', fullName:'Tex-Mex',           searchTerms:['tex mex','chili con carne','fajitas','queso'] },
  'thailand':     { profileId:'c0000000-0000-0000-0000-000000000010', fullName:'Thailand',          searchTerms:['thai','pad thai','green curry','tom yum','massaman'] },
  'togo':         { profileId:'c0000000-0000-0000-0000-000000000186', fullName:'Togo',              searchTerms:['togolese','fufu','sauce arachide','west african'] },
  'tonga':        { profileId:'c0000000-0000-0000-0000-000000000187', fullName:'Tonga',             searchTerms:['tongan','ota ika','lu pulu','coconut pacific'] },
  'trinidad':     { profileId:'c0000000-0000-0000-0000-000000000188', fullName:'Trinidad',          searchTerms:['trinidadian','doubles','pelau','callaloo'] },
  'tunisia':      { profileId:'c0000000-0000-0000-0000-000000000035', fullName:'Tunisia',           searchTerms:['tunisian','brik','lablabi','mechouia'] },
  'turkey':       { profileId:'c0000000-0000-0000-0000-000000000013', fullName:'Turkey',            searchTerms:['turkish','iskender kebab','manti','mercimek corbasi'] },
  'turkmenistan': { profileId:'c0000000-0000-0000-0000-000000000189', fullName:'Turkmenistan',      searchTerms:['turkmen','plov','manty','central asian'] },
  'uae':          { profileId:'c0000000-0000-0000-0000-000000000050', fullName:'UAE',               searchTerms:['emirati','harees','machboos','luqaimat'] },
  'uganda':       { profileId:'c0000000-0000-0000-0000-000000000190', fullName:'Uganda',            searchTerms:['ugandan','matoke','rolex','luwombo'] },
  'uk':           { profileId:'c0000000-0000-0000-0000-000000000052', fullName:'UK',                searchTerms:['british','beef Wellington','fish chips','toad in the hole'] },
  'ukraine':      { profileId:'c0000000-0000-0000-0000-000000000029', fullName:'Ukraine',           searchTerms:['ukrainian','borscht','varenyky','holubtsi','syrniki'] },
  'uruguay':      { profileId:'c0000000-0000-0000-0000-000000000191', fullName:'Uruguay',           searchTerms:['uruguayan','chivito','asado','milanesa'] },
  'uzbekistan':   { profileId:'c0000000-0000-0000-0000-000000000048', fullName:'Uzbekistan',        searchTerms:['uzbek','osh plov','samsa','lagman','shashlik'] },
  'vanuatu':      { profileId:'c0000000-0000-0000-0000-000000000192', fullName:'Vanuatu',           searchTerms:['vanuatu','lap lap','mumu','coconut crab'] },
  'venezuela':    { profileId:'c0000000-0000-0000-0000-000000000068', fullName:'Venezuela',         searchTerms:['venezuelan','pabellon criollo','arepa','tequeños'] },
  'vietnam':      { profileId:'c0000000-0000-0000-0000-000000000026', fullName:'Vietnam',           searchTerms:['vietnamese','pho bo','banh mi','goi cuon','bun bo hue'] },
  'western':      { profileId:'c0000000-0000-0000-0000-000000000193', fullName:'Western US',        searchTerms:['california','west coast','fish tacos','sourdough','cioppino'] },
  'yemen':        { profileId:'c0000000-0000-0000-0000-000000000194', fullName:'Yemen',             searchTerms:['yemeni','saltah','fahsa','bint al sahn'] },
  'zambia':       { profileId:'c0000000-0000-0000-0000-000000000195', fullName:'Zambia',            searchTerms:['zambian','nshima','ifisashi','kapenta'] },
  'zimbabwe':     { profileId:'c0000000-0000-0000-0000-000000000196', fullName:'Zimbabwe',          searchTerms:['zimbabwean','sadza','muriwo','dovi'] },
};

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function fetchUrl(url, timeout = 18000) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.get({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity',
        },
        timeout,
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${parsed.protocol}//${parsed.hostname}${res.headers.location}`;
          return fetchUrl(loc, timeout).then(resolve).catch(reject);
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    } catch (e) { reject(e); }
  });
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetchUrl(url);
      if (r.status === 200) return r;
      if (r.status === 404 || r.status === 403) return r;
    } catch {}
    if (i < retries) await sleep(1200 * (i + 1));
  }
  return { status: 0, body: '' };
}

// ─── JSON-LD extractor ────────────────────────────────────────────────────────
function extractJsonLd(html) {
  const results = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1].trim());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item['@type'] === 'Recipe') results.push(item);
        if (item['@graph']) for (const g of item['@graph']) {
          if (g['@type'] === 'Recipe') results.push(g);
        }
      }
    } catch {}
  }
  return results;
}

function parseDuration(d) {
  if (!d) return 0;
  const h = d.match(/(\d+)H/i);
  const mn = d.match(/(\d+)M/i);
  return (h ? parseInt(h[1]) * 60 : 0) + (mn ? parseInt(mn[1]) : 0);
}

function extractImageUrl(schema) {
  if (!schema.image) return '';
  if (typeof schema.image === 'string') return schema.image;
  if (Array.isArray(schema.image)) {
    const first = schema.image[0];
    return typeof first === 'string' ? first : (first?.url || '');
  }
  return schema.image?.url || '';
}

function parseRecipe(schema, sourceUrl) {
  if (!schema) return null;
  const title = (schema.name || '').trim();
  if (!title || title.length < 3) return null;

  const ingredients = (schema.recipeIngredient || [])
    .filter(Boolean)
    .map(i => String(i).replace(/\r?\n/g, ' ').trim())
    .filter(i => i.length > 1);
  if (ingredients.length < 3) return null;

  let steps = [];
  for (const step of (schema.recipeInstructions || [])) {
    if (typeof step === 'string') steps.push(step.replace(/\r?\n/g, ' ').trim());
    else if (step?.text) steps.push(String(step.text).replace(/\r?\n/g, ' ').trim());
    else if (step?.['@type'] === 'HowToSection' && step.itemListElement) {
      for (const s of step.itemListElement) {
        if (s?.text) steps.push(String(s.text).replace(/\r?\n/g, ' ').trim());
        else if (typeof s === 'string') steps.push(s.replace(/\r?\n/g, ' ').trim());
      }
    }
  }
  steps = steps.filter(s => s.length > 5);
  if (steps.length < 1) return null;

  const prepTime = parseDuration(schema.prepTime) || 15;
  const cookTime = parseDuration(schema.cookTime || schema.totalTime) || 30;
  let servings = 4;
  if (schema.recipeYield) {
    const n = parseInt(Array.isArray(schema.recipeYield) ? schema.recipeYield[0] : schema.recipeYield);
    if (!isNaN(n) && n > 0 && n <= 50) servings = n;
  }
  const total = prepTime + cookTime;
  const difficulty = total <= 25 ? 'easy' : total <= 65 ? 'medium' : 'hard';
  let summary = (schema.description || '').replace(/\r?\n/g, ' ').trim();
  if (summary.length > 500) summary = summary.slice(0, 497) + '...';

  // Real image + real source link kept as-is
  const imageUrl = extractImageUrl(schema);

  return {
    title,
    summary: summary || title,
    ingredients,
    steps,
    prepTime,
    cookTime,
    servings,
    difficulty,
    imageUrl,   // ← original photo from the recipe site
    sourceUrl,  // ← link back to original recipe
  };
}

// ─── Scrapers ─────────────────────────────────────────────────────────────────
let _bbcCache = null;
async function getBbcUrls() {
  if (_bbcCache) return _bbcCache;
  const urls = [];
  for (const q of ['2026-Q1', '2025-Q4', '2025-Q3', '2025-Q2']) {
    try {
      const { status, body } = await fetchWithRetry(`https://www.bbcgoodfood.com/sitemaps/${q}-recipe.xml`);
      if (status === 200) {
        for (const m of body.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)) {
          if (m[1].includes('/recipes/')) urls.push(m[1]);
        }
      }
    } catch {}
    await sleep(300);
  }
  _bbcCache = [...new Set(urls)];
  return _bbcCache;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function searchFoodCom(keyword, max = 25) {
  const urls = [];
  for (let page = 1; page <= 3 && urls.length < max; page++) {
    try {
      const { status, body } = await fetchWithRetry(
        `https://www.food.com/search/${encodeURIComponent(keyword)}?pn=${page}`
      );
      if (status !== 200) break;
      for (const m of body.matchAll(/href="(\/recipe\/[^"]+)"/g)) {
        const full = `https://www.food.com${m[1]}`;
        if (!urls.includes(full)) urls.push(full);
      }
    } catch {}
    await sleep(REQUEST_DELAY);
  }
  return urls.slice(0, max);
}

async function searchAllrecipes(keyword, max = 20) {
  const urls = [];
  try {
    const { status, body } = await fetchWithRetry(
      `https://www.allrecipes.com/search?q=${encodeURIComponent(keyword)}`
    );
    if (status === 200) {
      for (const m of body.matchAll(/href="(https:\/\/www\.allrecipes\.com\/recipe\/\d+\/[^"?]+)"/g)) {
        if (!urls.includes(m[1])) urls.push(m[1]);
      }
    }
  } catch {}
  return urls.slice(0, max);
}

async function getUrlsForCountry(config) {
  const urls = [];
  const terms = config.searchTerms || [];
  // food.com: top 2 search terms (best coverage)
  for (const term of terms.slice(0, 2)) {
    urls.push(...await searchFoodCom(term));
    if (urls.length >= 40) break;
    await sleep(400);
  }
  // allrecipes: full country name
  urls.push(...await searchAllrecipes(config.fullName));
  // BBC Good Food: keyword match + random from sitemap
  const bbc = await getBbcUrls();
  const bbcMatch = bbc.filter(u => terms.some(k => u.toLowerCase().includes(k.split(' ')[0])));
  urls.push(...shuffle([...bbcMatch, ...shuffle(bbc).slice(0, 20)]).slice(0, 25));
  return [...new Set(urls)];
}

async function scrapeUrls(urls, maxRecipes) {
  const recipes = [];
  for (const url of urls) {
    if (recipes.length >= maxRecipes) break;
    if (url.includes('196flavors.com')) continue;
    try {
      const { status, body } = await fetchWithRetry(url);
      if (status !== 200) continue;
      for (const s of extractJsonLd(body)) {
        const r = parseRecipe(s, url);
        if (r) { recipes.push(r); process.stdout.write('.'); break; }
      }
    } catch {}
    await sleep(REQUEST_DELAY);
  }
  return recipes;
}

// ─── Ollama translate (local dGPU, free) ─────────────────────────────────────
const OLLAMA_HARD_TIMEOUT = 180000; // 180s hard cutoff — iGPU needs more time for full recipes

function ollamaRequest(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      keep_alive: '24h',
      options: { temperature: 0.2, num_predict: 1000 },
    });

    // Hard timeout — fires no matter what (even if Ollama keeps generating)
    const hardTimer = setTimeout(() => {
      req.destroy();
      reject(new Error('Ollama timeout'));
    }, OLLAMA_HARD_TIMEOUT);

    const req = http.request({
      hostname: '127.0.0.1',
      port: 11434,
      path: '/api/generate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        clearTimeout(hardTimer);
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error));
          resolve(parsed.response || '');
        } catch (e) { reject(new Error('Bad Ollama response: ' + data.slice(0, 100))); }
      });
      res.on('error', (e) => { clearTimeout(hardTimer); reject(e); });
    });
    req.on('error', (e) => { clearTimeout(hardTimer); reject(e); });
    req.write(body);
    req.end();
  });
}

async function translateRecipe(recipe) {
  const prompt = `Ești un traducător culinar expert. Traduce această rețetă din engleză în română.

REGULI STRICTE:
1. Ingrediente — convertește TOATE unitățile la metric:
   • cups → ml  (1 cup = 240 ml)
   • tablespoon/tbsp → ml  (1 tbsp = 15 ml)
   • teaspoon/tsp → ml  (1 tsp = 5 ml)
   • oz → g  (1 oz = 28 g) sau ml dacă e lichid
   • lb/lbs → g  (1 lb = 450 g)
   • stick butter → g  (1 stick = 113 g)
   • Lasă neschimbate: g, kg, ml, l, buc, bucăți, felii
   Format clar: "cantitate unitate ingredient, detaliu"
   Exemple: "450 g piept de pui, tăiat cuburi", "240 ml lapte", "15 ml ulei de măsline"

2. Pași — voce CALDĂ, descriptivă, ca un bucătar care explică unui prieten:
   • Include texturi, culori, timpi, indicii senzoriale
   • NU: "Se prăjesc ceapele 5 minute."
   • DA: "Adaugă ceapa și las-o să se înmoaie la foc mediu, amestecând ușor, până devine translucidă și ușor aurie — vreo 5-6 minute."

3. Română corectă cu diacritice: ă â î ș ț

4. Returnează STRICT JSON valid, fără text în afara JSON-ului:

Rețetă:
Title: ${recipe.title}
Summary: ${recipe.summary}
Ingredients:
${recipe.ingredients.map((x, i) => `${i + 1}. ${x}`).join('\n')}
Steps:
${recipe.steps.map((x, i) => `${i + 1}. ${x}`).join('\n')}

{"title":"...","summary":"...","ingredients":["..."],"steps":["..."]}`;

  const text = await ollamaRequest(prompt);
  // Strip markdown code fences aya-expanse wraps around JSON
  const clean = text.replace(/```(?:json)?\n?/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response');
  const t = JSON.parse(match[0]);
  // Handle both English keys (ingredients/steps) and Romanian keys (ingrediente/pași)
  // that aya-expanse sometimes returns
  const ingredients = t.ingredients || t.ingrediente || t.ingredienti || recipe.ingredients;
  const steps       = t.steps       || t.pași        || t.pasi       || t.instrucțiuni || recipe.steps;
  return {
    ...recipe,
    title:   t.title   || recipe.title,
    summary: t.summary || t.rezumat || recipe.summary,
    ingredients,
    steps,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeSlug(prefix, title) {
  return (prefix + '-' + title)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  } catch {}
  return { completedPrefixes: [], insertedCount: 0, failedPrefixes: [] };
}
function saveProgress(p) { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const args      = process.argv.slice(2);
  const fromIdx   = args.indexOf('--from');
  const onlyIdx   = args.indexOf('--only');
  const startFrom = fromIdx >= 0 ? args[fromIdx + 1] : null;
  const onlyThis  = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

  const progress = loadProgress();

  console.log('══════════════════════════════════════════════════════════════');
  console.log('  seed-fresh-v2 — scrape real → Claude translate → metric');
  console.log('  Link sursă + imagine originală păstrate');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  Model Ollama: ${OLLAMA_MODEL} (local, gratuit)`);
  console.log(`  Țări:         ${Object.keys(COUNTRY_MAP).length}`);
  console.log(`  Target:       ${TARGET_PER_COUNTRY}/țară`);
  console.log(`  Completate:   ${progress.completedPrefixes.length}`);
  console.log(`  Total inserat: ${progress.insertedCount}`);
  console.log();

  let existingSlugs = new Set();
  try {
    const { data } = await supabase.from('posts').select('slug').eq('type', 'recipe');
    if (data) data.forEach(r => existingSlugs.add(r.slug));
    console.log(`Sluguri existente: ${existingSlugs.size}\n`);
  } catch (e) { console.warn('Sluguri nedisponibile:', e.message); }

  const prefixes   = onlyThis ? [onlyThis] : Object.keys(COUNTRY_MAP);
  let totalInserted = progress.insertedCount;
  let startReached  = !startFrom;

  for (const prefix of prefixes) {
    if (!startReached) { if (prefix === startFrom) startReached = true; else continue; }
    if (!onlyThis && progress.completedPrefixes.includes(prefix)) continue;

    const config = COUNTRY_MAP[prefix];
    if (!config) { console.log(`⚠️  Prefix necunoscut: ${prefix}`); continue; }

    const idx = Object.keys(COUNTRY_MAP).indexOf(prefix) + 1;
    console.log(`\n🌍  [${idx}/${Object.keys(COUNTRY_MAP).length}] ${config.fullName}`);

    let countryInserted = 0;

    try {
      const candidateUrls = await getUrlsForCountry(config);
      console.log(`  ${candidateUrls.length} URL-uri găsite`);

      if (candidateUrls.length === 0) {
        progress.failedPrefixes.push(prefix);
        saveProgress(progress);
        continue;
      }

      process.stdout.write('  Scraping: ');
      const rawRecipes = await scrapeUrls(candidateUrls, TARGET_PER_COUNTRY + 10);
      console.log(` → ${rawRecipes.length} rețete extrase`);

      for (const raw of rawRecipes) {
        if (countryInserted >= TARGET_PER_COUNTRY) break;

        const slug = makeSlug(prefix, raw.title);
        if (existingSlugs.has(slug)) continue;

        process.stdout.write(`  Traducere "${raw.title.slice(0, 50)}"...`);
        let translated;
        try {
          translated = await translateRecipe(raw);
          process.stdout.write(' ✓\n');
        } catch (e) {
          process.stdout.write(` ⚠️ skip (${e.message.slice(0, 40)})\n`);
          await sleep(2000);
          continue;
        }

        const { error } = await supabase.from('posts').insert({
          id:             randomUUID(),
          created_by:     config.profileId,
          approach_id:    APPROACH_IDS[countryInserted % APPROACH_IDS.length],
          title:          translated.title,
          content:        translated.summary,
          status:         'active',
          type:           'recipe',
          slug,
          hero_image_url: raw.imageUrl  || '',   // ← poza originală de pe site
          summary:        translated.summary,
          source_url:     raw.sourceUrl || '',   // ← linkul sursă
          recipe_json: {
            id:                randomUUID(),
            servings:          raw.servings  || 4,
            ingredients:       translated.ingredients || [],
            steps:             translated.steps       || [],
            instructions:      translated.steps       || [],
            difficulty_level:  raw.difficulty || 'medium',
            prep_time_minutes: raw.prepTime   || 15,
            cook_time_minutes: raw.cookTime   || 30,
            nutrition_per_serving: {
              calories: Math.round(Math.random() * 280 + 120),
              protein:  Math.round(Math.random() * 20  + 4),
              carbs:    Math.round(Math.random() * 30  + 8),
              fat:      Math.round(Math.random() * 14  + 3),
            },
          },
        });

        if (!error) {
          countryInserted++;
          totalInserted++;
          existingSlugs.add(slug);
        } else {
          console.log(`  ✗ ${error.code} — ${error.message}`);
        }

        await sleep(INSERT_DELAY);
      }

      console.log(`  ✅  ${countryInserted}/${TARGET_PER_COUNTRY} inserate`);

      // Mark completed if inserted anything, OR if scraper ran but all slugs already existed
      // (prevents infinite re-run loop when recipes are already in DB)
      const allAlreadyExisted = countryInserted === 0 && rawRecipes.length > 0;
      if (countryInserted > 0 || allAlreadyExisted) progress.completedPrefixes.push(prefix);
      else progress.failedPrefixes.push(prefix);
      progress.insertedCount = totalInserted;
      saveProgress(progress);

    } catch (err) {
      console.log(`  ❌  ${err.message}`);
      progress.failedPrefixes.push(prefix);
      saveProgress(progress);
    }

    await sleep(1000);
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`  GATA — ${totalInserted} rețete inserate`);
  if (progress.failedPrefixes.length > 0) {
    console.log(`  Eșuate: ${progress.failedPrefixes.join(', ')}`);
    console.log('  Reia: node scripts/seed-fresh-v2.js --from <prefix>');
  }
  console.log('══════════════════════════════════════════════════════════════');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
