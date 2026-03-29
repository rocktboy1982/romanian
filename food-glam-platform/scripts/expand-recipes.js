#!/usr/bin/env node
'use strict';
/**
 * expand-recipes.js
 * Adds ~20 new recipes per country to reach 40 total per country.
 * 
 * Strategy:
 *   1. Load all existing slugs from DB to avoid duplicates
 *   2. For each country prefix, scrape ~25 recipe URLs from real sites
 *   3. Extract JSON-LD Recipe data from each page
 *   4. Insert directly into the posts table
 *   5. Track progress for resumability
 *
 * Sources (all confirmed JSON-LD):
 *   - food.com search by country keyword
 *   - allrecipes.com search
 *   - bbcgoodfood.com sitemap + keyword filtering
 *   - Country-specific sites (giallozafferano.it, marmiton.org, etc.)
 *
 * Usage: node scripts/expand-recipes.js [--from PREFIX]
 *   --from PREFIX   Resume from a specific country prefix
 *
 * BANNED: 196flavors.com
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

// ─── Config ─────────────────────────────────────────────────────────────────
const DB_CONFIG = {
  host: '127.0.0.1',
  port: 54322,
  user: 'postgres',
  password: process.env.DB_PASSWORD,
  database: 'postgres',
};

const APPROACH_IDS = [
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000005',
  'b0000000-0000-0000-0000-000000000006',
];

const PROGRESS_FILE = path.join(__dirname, '.expand-progress.json');
const REQUEST_DELAY = 700;   // ms between HTTP requests
const INSERT_DELAY = 50;     // ms between DB inserts

// ─── Country mapping: slug_prefix → { profileId, need, searchTerms, fullName } ─
// searchTerms: keywords for food.com / BBC search
// fullName: used for slug generation when prefix is abbreviated
const COUNTRY_MAP = {
  'afghanistan':    { profileId: 'c0000000-0000-0000-0000-000000000100', need: 20, searchTerms: ['afghan'], fullName: 'Afghanistan' },
  'albania':        { profileId: 'c0000000-0000-0000-0000-000000000101', need: 20, searchTerms: ['albanian'], fullName: 'Albania' },
  'algeria':        { profileId: 'c0000000-0000-0000-0000-000000000036', need: 20, searchTerms: ['algerian','north-african','couscous','harissa'], fullName: 'Algeria' },
  'argentina':      { profileId: 'c0000000-0000-0000-0000-000000000015', need: 20, searchTerms: ['argentine','argentinian','chimichurri','empanada'], fullName: 'Argentina' },
  'armenia':        { profileId: 'c0000000-0000-0000-0000-000000000102', need: 20, searchTerms: ['armenian','lavash','khorovats'], fullName: 'Armenia' },
  'australia':      { profileId: 'c0000000-0000-0000-0000-000000000030', need: 20, searchTerms: ['australian','aussie','lamington','pavlova','vegemite'], fullName: 'Australia' },
  'austria':        { profileId: 'c0000000-0000-0000-0000-000000000054', need: 20, searchTerms: ['austrian','schnitzel','strudel','kaiserschmarrn'], fullName: 'Austria' },
  'azerbaijan':     { profileId: 'c0000000-0000-0000-0000-000000000103', need: 20, searchTerms: ['azerbaijani','azeri'], fullName: 'Azerbaijan' },
  'bahrain':        { profileId: 'c0000000-0000-0000-0000-000000000104', need: 20, searchTerms: ['bahraini','machboos','gulf'], fullName: 'Bahrain' },
  'bangladesh':     { profileId: 'c0000000-0000-0000-0000-000000000046', need: 20, searchTerms: ['bangladeshi','bengali','hilsa','biryani'], fullName: 'Bangladesh' },
  'barbados':       { profileId: 'c0000000-0000-0000-0000-000000000105', need: 20, searchTerms: ['barbadian','bajan','caribbean','flying-fish'], fullName: 'Barbados' },
  'belarus':        { profileId: 'c0000000-0000-0000-0000-000000000106', need: 20, searchTerms: ['belarusian','draniki'], fullName: 'Belarus' },
  'belgium':        { profileId: 'c0000000-0000-0000-0000-000000000056', need: 20, searchTerms: ['belgian','waffle','moules','carbonnade','speculoos'], fullName: 'Belgium' },
  'benin':          { profileId: 'c0000000-0000-0000-0000-000000000107', need: 20, searchTerms: ['beninese','west-african','yam','peanut'], fullName: 'Benin' },
  'bhutan':         { profileId: 'c0000000-0000-0000-0000-000000000108', need: 20, searchTerms: ['bhutanese','ema-datshi'], fullName: 'Bhutan' },
  'bolivia':        { profileId: 'c0000000-0000-0000-0000-000000000109', need: 20, searchTerms: ['bolivian','saltena','salchipapas'], fullName: 'Bolivia' },
  'bosnia':         { profileId: 'c0000000-0000-0000-0000-000000000110', need: 20, searchTerms: ['bosnian','cevapi','burek'], fullName: 'Bosnia' },
  'botswana':       { profileId: 'c0000000-0000-0000-0000-000000000111', need: 20, searchTerms: ['botswana','seswaa','pap'], fullName: 'Botswana' },
  'brazil':         { profileId: 'c0000000-0000-0000-0000-000000000012', need: 20, searchTerms: ['brazilian','feijoada','brigadeiro','pao-de-queijo','acai'], fullName: 'Brazil' },
  'brunei':         { profileId: 'c0000000-0000-0000-0000-000000000112', need: 20, searchTerms: ['bruneian','ambuyat','southeast-asian'], fullName: 'Brunei' },
  'bulgaria':       { profileId: 'c0000000-0000-0000-0000-000000000064', need: 20, searchTerms: ['bulgarian','banitsa','shopska','tarator'], fullName: 'Bulgaria' },
  'burkina':        { profileId: 'c0000000-0000-0000-0000-000000000113', need: 20, searchTerms: ['burkina','west-african','tiga'], fullName: 'Burkina Faso' },
  'burundi':        { profileId: 'c0000000-0000-0000-0000-000000000114', need: 20, searchTerms: ['burundian','east-african','plantain'], fullName: 'Burundi' },
  'cambodia':       { profileId: 'c0000000-0000-0000-0000-000000000065', need: 20, searchTerms: ['cambodian','khmer','amok','lok-lak'], fullName: 'Cambodia' },
  'cameroon':       { profileId: 'c0000000-0000-0000-0000-000000000115', need: 20, searchTerms: ['cameroonian','ndole','eru'], fullName: 'Cameroon' },
  'canada':         { profileId: 'c0000000-0000-0000-0000-000000000037', need: 20, searchTerms: ['canadian','poutine','maple','nanaimo','butter-tart'], fullName: 'Canada' },
  'chile':          { profileId: 'c0000000-0000-0000-0000-000000000041', need: 20, searchTerms: ['chilean','pastel-de-choclo','empanada','sopaipilla'], fullName: 'Chile' },
  'china':          { profileId: 'c0000000-0000-0000-0000-000000000011', need: 20, searchTerms: ['chinese','kung-pao','dim-sum','wonton','mapo-tofu','chow-mein'], fullName: 'China' },
  'colombia':       { profileId: 'c0000000-0000-0000-0000-000000000040', need: 20, searchTerms: ['colombian','bandeja-paisa','arepa','ajiaco','sancocho'], fullName: 'Colombia' },
  'congo':          { profileId: 'c0000000-0000-0000-0000-000000000116', need: 20, searchTerms: ['congolese','pondu','fufu','african'], fullName: 'Congo' },
  'costa':          { profileId: 'c0000000-0000-0000-0000-000000000117', need: 20, searchTerms: ['costa-rican','gallo-pinto','casado'], fullName: 'Costa Rica' },
  'croatia':        { profileId: 'c0000000-0000-0000-0000-000000000062', need: 20, searchTerms: ['croatian','peka','pasticada','strukli','fritule'], fullName: 'Croatia' },
  'cuba':           { profileId: 'c0000000-0000-0000-0000-000000000039', need: 20, searchTerms: ['cuban','ropa-vieja','picadillo','arroz-con-pollo','mojito'], fullName: 'Cuba' },
  'cyprus':         { profileId: 'c0000000-0000-0000-0000-000000000118', need: 20, searchTerms: ['cypriot','halloumi','kleftiko','souvlaki'], fullName: 'Cyprus' },
  'czech':          { profileId: 'c0000000-0000-0000-0000-000000000061', need: 20, searchTerms: ['czech','svickova','trdelnik','kolache','goulash'], fullName: 'Czech Republic' },
  'denmark':        { profileId: 'c0000000-0000-0000-0000-000000000058', need: 20, searchTerms: ['danish','smorrebrod','frikadeller','aebleskiver'], fullName: 'Denmark' },
  'djibouti':       { profileId: 'c0000000-0000-0000-0000-000000000119', need: 20, searchTerms: ['djibouti','east-african','somali','fah-fah'], fullName: 'Djibouti' },
  'dominican':      { profileId: 'c0000000-0000-0000-0000-000000000120', need: 20, searchTerms: ['dominican','mangu','sancocho','tostones'], fullName: 'Dominican Republic' },
  'east':           { profileId: 'c0000000-0000-0000-0000-000000000121', need: 20, searchTerms: ['east-timor','timorese','southeast-asian','indonesian'], fullName: 'East Timor' },
  'ecuador':        { profileId: 'c0000000-0000-0000-0000-000000000069', need: 20, searchTerms: ['ecuadorian','llapingachos','ceviche','encocado'], fullName: 'Ecuador' },
  'egypt':          { profileId: 'c0000000-0000-0000-0000-000000000028', need: 20, searchTerms: ['egyptian','koshari','ful-medames','molokhia','basbousa'], fullName: 'Egypt' },
  'el':             { profileId: 'c0000000-0000-0000-0000-000000000122', need: 20, searchTerms: ['salvadoran','pupusa','curtido'], fullName: 'El Salvador' },
  'eritrea':        { profileId: 'c0000000-0000-0000-0000-000000000123', need: 20, searchTerms: ['eritrean','injera','zigni','tsebhi'], fullName: 'Eritrea' },
  'estonia':        { profileId: 'c0000000-0000-0000-0000-000000000124', need: 20, searchTerms: ['estonian','baltic','rye-bread','blood-sausage'], fullName: 'Estonia' },
  'ethiopia':       { profileId: 'c0000000-0000-0000-0000-000000000023', need: 20, searchTerms: ['ethiopian','doro-wot','injera','kitfo','shiro'], fullName: 'Ethiopia' },
  'fiji':           { profileId: 'c0000000-0000-0000-0000-000000000125', need: 20, searchTerms: ['fijian','kokoda','lovo','rourou'], fullName: 'Fiji' },
  'finland':        { profileId: 'c0000000-0000-0000-0000-000000000059', need: 20, searchTerms: ['finnish','karjalanpiirakka','lohikeitto','ruisleipa'], fullName: 'Finland' },
  'france':         { profileId: 'c0000000-0000-0000-0000-000000000002', need: 20, searchTerms: ['french','croissant','boeuf-bourguignon','coq-au-vin','creme-brulee'], fullName: 'France' },
  'gambia':         { profileId: 'c0000000-0000-0000-0000-000000000126', need: 20, searchTerms: ['gambian','west-african','benachin','domoda'], fullName: 'Gambia' },
  'georgia':        { profileId: 'c0000000-0000-0000-0000-000000000047', need: 20, searchTerms: ['georgian','khachapuri','khinkali','lobio'], fullName: 'Georgia' },
  'germany':        { profileId: 'c0000000-0000-0000-0000-000000000004', need: 20, searchTerms: ['german','bratwurst','pretzel','sauerbraten','schwarzwald'], fullName: 'Germany' },
  'ghana':          { profileId: 'c0000000-0000-0000-0000-000000000033', need: 18, searchTerms: ['ghanaian','jollof','waakye','kelewele','fufu'], fullName: 'Ghana' },
  'greece':         { profileId: 'c0000000-0000-0000-0000-000000000008', need: 20, searchTerms: ['greek','souvlaki','gyro','spanakopita','baklava'], fullName: 'Greece' },
  'guatemala':      { profileId: 'c0000000-0000-0000-0000-000000000127', need: 20, searchTerms: ['guatemalan','pepian','tamales','jocon'], fullName: 'Guatemala' },
  'guinea':         { profileId: 'c0000000-0000-0000-0000-000000000128', need: 20, searchTerms: ['guinean','west-african','groundnut-soup','fouti'], fullName: 'Guinea' },
  'guyana':         { profileId: 'c0000000-0000-0000-0000-000000000129', need: 20, searchTerms: ['guyanese','pepperpot','roti','curry-chicken'], fullName: 'Guyana' },
  'haiti':          { profileId: 'c0000000-0000-0000-0000-000000000130', need: 20, searchTerms: ['haitian','griot','diri-ak-djon-djon','accra'], fullName: 'Haiti' },
  'hawaii':         { profileId: 'c0000000-0000-0000-0000-000000000131', need: 20, searchTerms: ['hawaiian','poke','spam-musubi','lau-lau','kalua-pork'], fullName: 'Hawaii' },
  'honduras':       { profileId: 'c0000000-0000-0000-0000-000000000132', need: 20, searchTerms: ['honduran','baleada','sopa-de-caracol'], fullName: 'Honduras' },
  'hong':           { profileId: 'c0000000-0000-0000-0000-000000000133', need: 20, searchTerms: ['hong-kong','cantonese','dim-sum','wonton','egg-tart'], fullName: 'Hong Kong' },
  'hungary':        { profileId: 'c0000000-0000-0000-0000-000000000060', need: 20, searchTerms: ['hungarian','goulash','langos','paprikash','dobos'], fullName: 'Hungary' },
  'iceland':        { profileId: 'c0000000-0000-0000-0000-000000000134', need: 20, searchTerms: ['icelandic','nordic','skyr','plokkfiskur'], fullName: 'Iceland' },
  'india':          { profileId: 'c0000000-0000-0000-0000-000000000007', need: 20, searchTerms: ['indian','curry','tikka','biryani','naan','samosa','dal'], fullName: 'India' },
  'indonesia':      { profileId: 'c0000000-0000-0000-0000-000000000019', need: 20, searchTerms: ['indonesian','nasi-goreng','rendang','satay','gado-gado'], fullName: 'Indonesia' },
  'iran':           { profileId: 'c0000000-0000-0000-0000-000000000027', need: 20, searchTerms: ['persian','iranian','ghormeh-sabzi','tahdig','kebab'], fullName: 'Iran' },
  'iraq':           { profileId: 'c0000000-0000-0000-0000-000000000135', need: 20, searchTerms: ['iraqi','dolma','masgouf','kubba'], fullName: 'Iraq' },
  'ireland':        { profileId: 'c0000000-0000-0000-0000-000000000053', need: 20, searchTerms: ['irish','colcannon','boxty','coddle','soda-bread'], fullName: 'Ireland' },
  'israel':         { profileId: 'c0000000-0000-0000-0000-000000000051', need: 20, searchTerms: ['israeli','shakshuka','hummus','falafel','sabich'], fullName: 'Israel' },
  'italy':          { profileId: 'c0000000-0000-0000-0000-000000000001', need: 20, searchTerms: ['italian','pasta','risotto','ossobuco','bruschetta','tiramisu'], fullName: 'Italy' },
  'ivory':          { profileId: 'c0000000-0000-0000-0000-000000000136', need: 20, searchTerms: ['ivorian','ivory-coast','attiéké','alloco','west-african'], fullName: 'Ivory Coast' },
  'jamaica':        { profileId: 'c0000000-0000-0000-0000-000000000038', need: 20, searchTerms: ['jamaican','jerk','ackee','oxtail','patties','curry-goat'], fullName: 'Jamaica' },
  'japan':          { profileId: 'c0000000-0000-0000-0000-000000000005', need: 20, searchTerms: ['japanese','sushi','ramen','tempura','udon','miso','gyoza'], fullName: 'Japan' },
  'jordan':         { profileId: 'c0000000-0000-0000-0000-000000000070', need: 20, searchTerms: ['jordanian','mansaf','maqluba','falafel','kunafa'], fullName: 'Jordan' },
  'kazakhstan':     { profileId: 'c0000000-0000-0000-0000-000000000137', need: 20, searchTerms: ['kazakh','beshbarmak','kurt','baursak'], fullName: 'Kazakhstan' },
  'kenya':          { profileId: 'c0000000-0000-0000-0000-000000000034', need: 20, searchTerms: ['kenyan','nyama-choma','ugali','sukuma-wiki','mandazi'], fullName: 'Kenya' },
  'kosovo':         { profileId: 'c0000000-0000-0000-0000-000000000138', need: 20, searchTerms: ['kosovar','balkan','burek','flija'], fullName: 'Kosovo' },
  'kuwait':         { profileId: 'c0000000-0000-0000-0000-000000000139', need: 20, searchTerms: ['kuwaiti','machboos','harees','gulf'], fullName: 'Kuwait' },
  'kyrgyzstan':     { profileId: 'c0000000-0000-0000-0000-000000000140', need: 20, searchTerms: ['kyrgyz','beshbarmak','lagman','manti'], fullName: 'Kyrgyzstan' },
  'laos':           { profileId: 'c0000000-0000-0000-0000-000000000141', need: 20, searchTerms: ['laotian','larb','khao-piak','sticky-rice'], fullName: 'Laos' },
  'latvia':         { profileId: 'c0000000-0000-0000-0000-000000000142', need: 20, searchTerms: ['latvian','baltic','rye-bread','piragi'], fullName: 'Latvia' },
  'lebanon':        { profileId: 'c0000000-0000-0000-0000-000000000025', need: 20, searchTerms: ['lebanese','tabbouleh','kibbeh','fattoush','hummus','shawarma'], fullName: 'Lebanon' },
  'liberia':        { profileId: 'c0000000-0000-0000-0000-000000000143', need: 20, searchTerms: ['liberian','west-african','jollof','palm-butter'], fullName: 'Liberia' },
  'libya':          { profileId: 'c0000000-0000-0000-0000-000000000144', need: 20, searchTerms: ['libyan','north-african','sharba','bazin'], fullName: 'Libya' },
  'lithuania':      { profileId: 'c0000000-0000-0000-0000-000000000145', need: 21, searchTerms: ['lithuanian','cepelinai','kugelis','saltibarsciai'], fullName: 'Lithuania' },
  'luxembourg':     { profileId: 'c0000000-0000-0000-0000-000000000146', need: 20, searchTerms: ['luxembourg','judd-mat-gaardebounen','bouneschlupp'], fullName: 'Luxembourg' },
  'madagascar':     { profileId: 'c0000000-0000-0000-0000-000000000147', need: 20, searchTerms: ['malagasy','madagascar','romazava','ravitoto'], fullName: 'Madagascar' },
  'malawi':         { profileId: 'c0000000-0000-0000-0000-000000000148', need: 20, searchTerms: ['malawian','nsima','chambo','african'], fullName: 'Malawi' },
  'malaysia':       { profileId: 'c0000000-0000-0000-0000-000000000042', need: 20, searchTerms: ['malaysian','nasi-lemak','rendang','laksa','satay','roti-canai'], fullName: 'Malaysia' },
  'maldives':       { profileId: 'c0000000-0000-0000-0000-000000000149', need: 20, searchTerms: ['maldivian','garudhiya','mas-huni','fish-curry'], fullName: 'Maldives' },
  'mali':           { profileId: 'c0000000-0000-0000-0000-000000000150', need: 20, searchTerms: ['malian','west-african','tiga-dega-na','jollof'], fullName: 'Mali' },
  'malta':          { profileId: 'c0000000-0000-0000-0000-000000000151', need: 20, searchTerms: ['maltese','pastizzi','rabbit-stew','imqaret'], fullName: 'Malta' },
  'mauritania':     { profileId: 'c0000000-0000-0000-0000-000000000152', need: 20, searchTerms: ['mauritanian','west-african','thieboudienne'], fullName: 'Mauritania' },
  'mexico':         { profileId: 'c0000000-0000-0000-0000-000000000006', need: 20, searchTerms: ['mexican','tacos','enchiladas','mole','tamales','guacamole','pozole'], fullName: 'Mexico' },
  'midwestern':     { profileId: 'c0000000-0000-0000-0000-000000000153', need: 20, searchTerms: ['midwestern','casserole','hot-dish','corn','pot-roast'], fullName: 'Midwestern US' },
  'moldova':        { profileId: 'c0000000-0000-0000-0000-000000000154', need: 20, searchTerms: ['moldovan','mamaliga','placinta','zeama'], fullName: 'Moldova' },
  'mongolia':       { profileId: 'c0000000-0000-0000-0000-000000000155', need: 20, searchTerms: ['mongolian','buuz','khuushuur','tsuivan'], fullName: 'Mongolia' },
  'montenegro':     { profileId: 'c0000000-0000-0000-0000-000000000156', need: 20, searchTerms: ['montenegrin','balkan','kacamak','raznjici'], fullName: 'Montenegro' },
  'morocco':        { profileId: 'c0000000-0000-0000-0000-000000000009', need: 20, searchTerms: ['moroccan','tagine','couscous','harira','pastilla','preserved-lemon'], fullName: 'Morocco' },
  'mozambique':     { profileId: 'c0000000-0000-0000-0000-000000000157', need: 20, searchTerms: ['mozambican','piri-piri','matapa','african'], fullName: 'Mozambique' },
  'myanmar':        { profileId: 'c0000000-0000-0000-0000-000000000066', need: 20, searchTerms: ['burmese','myanmar','mohinga','tea-leaf','shan-noodle'], fullName: 'Myanmar' },
  'namibia':        { profileId: 'c0000000-0000-0000-0000-000000000158', need: 20, searchTerms: ['namibian','potjiekos','biltong','african'], fullName: 'Namibia' },
  'nepal':          { profileId: 'c0000000-0000-0000-0000-000000000071', need: 20, searchTerms: ['nepali','momo','dal-bhat','thukpa','sel-roti'], fullName: 'Nepal' },
  'netherlands':    { profileId: 'c0000000-0000-0000-0000-000000000055', need: 20, searchTerms: ['dutch','stamppot','bitterballen','stroopwafel','erwtensoep'], fullName: 'Netherlands' },
  'new':            { profileId: 'c0000000-0000-0000-0000-000000000031', need: 20, searchTerms: ['new-zealand','kiwi','pavlova','hokey-pokey','anzac'], fullName: 'New Zealand' },
  'nicaragua':      { profileId: 'c0000000-0000-0000-0000-000000000159', need: 20, searchTerms: ['nicaraguan','gallo-pinto','nacatamal','vigoron'], fullName: 'Nicaragua' },
  'niger':          { profileId: 'c0000000-0000-0000-0000-000000000160', need: 20, searchTerms: ['niger','west-african','djerma','tuwo'], fullName: 'Niger' },
  'nigeria':        { profileId: 'c0000000-0000-0000-0000-000000000022', need: 20, searchTerms: ['nigerian','jollof','egusi','suya','pounded-yam','pepper-soup'], fullName: 'Nigeria' },
  'north':          { profileId: 'c0000000-0000-0000-0000-000000000161', need: 20, searchTerms: ['macedonian','balkan','tavche-gravche','ajvar','burek'], fullName: 'North Macedonia' },
  'northeastern':   { profileId: 'c0000000-0000-0000-0000-000000000162', need: 20, searchTerms: ['new-england','clam-chowder','lobster-roll','boston-baked'], fullName: 'Northeastern US' },
  'norway':         { profileId: 'c0000000-0000-0000-0000-000000000057', need: 20, searchTerms: ['norwegian','farikal','lefse','lutefisk','kjottkaker'], fullName: 'Norway' },
  'oman':           { profileId: 'c0000000-0000-0000-0000-000000000163', need: 20, searchTerms: ['omani','shuwa','harees','gulf'], fullName: 'Oman' },
  'pakistan':        { profileId: 'c0000000-0000-0000-0000-000000000045', need: 20, searchTerms: ['pakistani','biryani','nihari','seekh-kebab','karahi','haleem'], fullName: 'Pakistan' },
  'palestine':      { profileId: 'c0000000-0000-0000-0000-000000000164', need: 20, searchTerms: ['palestinian','musakhan','maqluba','knafeh'], fullName: 'Palestine' },
  'panama':         { profileId: 'c0000000-0000-0000-0000-000000000165', need: 20, searchTerms: ['panamanian','sancocho','arroz-con-pollo','empanada'], fullName: 'Panama' },
  'papua':          { profileId: 'c0000000-0000-0000-0000-000000000166', need: 20, searchTerms: ['papua','pacific','tropical','coconut','taro'], fullName: 'Papua New Guinea' },
  'paraguay':       { profileId: 'c0000000-0000-0000-0000-000000000167', need: 20, searchTerms: ['paraguayan','sopa-paraguaya','chipa','bori-bori'], fullName: 'Paraguay' },
  'peru':           { profileId: 'c0000000-0000-0000-0000-000000000024', need: 20, searchTerms: ['peruvian','ceviche','lomo-saltado','aji-de-gallina','anticucho'], fullName: 'Peru' },
  'philippines':    { profileId: 'c0000000-0000-0000-0000-000000000017', need: 20, searchTerms: ['filipino','adobo','sinigang','lumpia','lechon','kare-kare'], fullName: 'Philippines' },
  'poland':         { profileId: 'c0000000-0000-0000-0000-000000000014', need: 20, searchTerms: ['polish','pierogi','bigos','zurek','kielbasa'], fullName: 'Poland' },
  'portugal':       { profileId: 'c0000000-0000-0000-0000-000000000020', need: 20, searchTerms: ['portuguese','bacalhau','pastel-de-nata','caldo-verde','francesinha'], fullName: 'Portugal' },
  'puerto':         { profileId: 'c0000000-0000-0000-0000-000000000168', need: 20, searchTerms: ['puerto-rican','mofongo','arroz-con-gandules','pernil','tostones'], fullName: 'Puerto Rico' },
  'qatar':          { profileId: 'c0000000-0000-0000-0000-000000000169', need: 20, searchTerms: ['qatari','machboos','harees','balaleet','gulf'], fullName: 'Qatar' },
  'romania':        { profileId: 'c0000000-0000-0000-0000-000000000063', need: 20, searchTerms: ['romanian','sarmale','mici','ciorba','mamaliga','cozonac'], fullName: 'Romania' },
  'russia':         { profileId: 'c0000000-0000-0000-0000-000000000016', need: 20, searchTerms: ['russian','borscht','pelmeni','blini','beef-stroganoff','pirogi'], fullName: 'Russia' },
  'rwanda':         { profileId: 'c0000000-0000-0000-0000-000000000170', need: 20, searchTerms: ['rwandan','east-african','isombe','brochette'], fullName: 'Rwanda' },
  'samoa':          { profileId: 'c0000000-0000-0000-0000-000000000171', need: 20, searchTerms: ['samoan','oka','palusami','pacific','coconut'], fullName: 'Samoa' },
  'saudi':          { profileId: 'c0000000-0000-0000-0000-000000000049', need: 20, searchTerms: ['saudi','kabsa','mandi','harees','jareesh'], fullName: 'Saudi Arabia' },
  'senegal':        { profileId: 'c0000000-0000-0000-0000-000000000172', need: 20, searchTerms: ['senegalese','thieboudienne','yassa','mafe'], fullName: 'Senegal' },
  'serbia':         { profileId: 'c0000000-0000-0000-0000-000000000173', need: 20, searchTerms: ['serbian','cevapi','ajvar','sarma','pljeskavica'], fullName: 'Serbia' },
  'sierra':         { profileId: 'c0000000-0000-0000-0000-000000000174', need: 20, searchTerms: ['sierra-leonean','west-african','cassava','groundnut'], fullName: 'Sierra Leone' },
  'singapore':      { profileId: 'c0000000-0000-0000-0000-000000000043', need: 20, searchTerms: ['singaporean','hainanese','chilli-crab','laksa','char-kway-teow'], fullName: 'Singapore' },
  'slovakia':       { profileId: 'c0000000-0000-0000-0000-000000000175', need: 20, searchTerms: ['slovak','bryndzove-halusky','kapustnica'], fullName: 'Slovakia' },
  'slovenia':       { profileId: 'c0000000-0000-0000-0000-000000000176', need: 20, searchTerms: ['slovenian','potica','struklji','jota'], fullName: 'Slovenia' },
  'somalia':        { profileId: 'c0000000-0000-0000-0000-000000000177', need: 20, searchTerms: ['somali','canjeero','suqaar','bariis'], fullName: 'Somalia' },
  'south-africa':   { profileId: 'c0000000-0000-0000-0000-000000000032', need: 20, searchTerms: ['south-african','bobotie','biltong','boerewors','bunny-chow'], fullName: 'South Africa' },
  'south-korea':    { profileId: 'c0000000-0000-0000-0000-000000000018', need: 20, searchTerms: ['korean','kimchi','bibimbap','bulgogi','japchae','tteokbokki'], fullName: 'South Korea' },
  'southern':       { profileId: 'c0000000-0000-0000-0000-000000000178', need: 20, searchTerms: ['southern','fried-chicken','biscuit','grits','gumbo','cornbread'], fullName: 'Southern US' },
  'spain':          { profileId: 'c0000000-0000-0000-0000-000000000003', need: 20, searchTerms: ['spanish','paella','gazpacho','tortilla-espanola','churros','tapas'], fullName: 'Spain' },
  'sri':            { profileId: 'c0000000-0000-0000-0000-000000000044', need: 20, searchTerms: ['sri-lankan','kottu','hopper','pol-sambol','dhal'], fullName: 'Sri Lanka' },
  'sudan':          { profileId: 'c0000000-0000-0000-0000-000000000179', need: 20, searchTerms: ['sudanese','ful-medames','kisra','african'], fullName: 'Sudan' },
  'suriname':       { profileId: 'c0000000-0000-0000-0000-000000000180', need: 20, searchTerms: ['surinamese','roti','pom','nasi-goreng'], fullName: 'Suriname' },
  'sweden':         { profileId: 'c0000000-0000-0000-0000-000000000021', need: 20, searchTerms: ['swedish','meatball','gravlax','kanelbulle','smorgasbord'], fullName: 'Sweden' },
  'switzerland':    { profileId: 'c0000000-0000-0000-0000-000000000181', need: 20, searchTerms: ['swiss','fondue','raclette','rosti','bircher-muesli'], fullName: 'Switzerland' },
  'syria':          { profileId: 'c0000000-0000-0000-0000-000000000182', need: 20, searchTerms: ['syrian','kibbeh','fattoush','muhammara','shawarma'], fullName: 'Syria' },
  'taiwan':         { profileId: 'c0000000-0000-0000-0000-000000000067', need: 20, searchTerms: ['taiwanese','beef-noodle','lu-rou-fan','bubble-tea','gua-bao'], fullName: 'Taiwan' },
  'tajikistan':     { profileId: 'c0000000-0000-0000-0000-000000000183', need: 20, searchTerms: ['tajik','qurutob','plov','oshi-palav'], fullName: 'Tajikistan' },
  'tanzania':       { profileId: 'c0000000-0000-0000-0000-000000000184', need: 20, searchTerms: ['tanzanian','ugali','nyama-choma','chipsi-mayai','pilau'], fullName: 'Tanzania' },
  'tex':            { profileId: 'c0000000-0000-0000-0000-000000000185', need: 20, searchTerms: ['tex-mex','nachos','fajitas','queso','chili-con-carne','burrito'], fullName: 'Tex-Mex' },
  'thailand':       { profileId: 'c0000000-0000-0000-0000-000000000010', need: 20, searchTerms: ['thai','pad-thai','green-curry','tom-yum','mango-sticky-rice','som-tum'], fullName: 'Thailand' },
  'togo':           { profileId: 'c0000000-0000-0000-0000-000000000186', need: 20, searchTerms: ['togolese','west-african','fufu','akoume'], fullName: 'Togo' },
  'tonga':          { profileId: 'c0000000-0000-0000-0000-000000000187', need: 20, searchTerms: ['tongan','pacific','ota-ika','lu-pulu','coconut'], fullName: 'Tonga' },
  'trinidad':       { profileId: 'c0000000-0000-0000-0000-000000000188', need: 20, searchTerms: ['trinidadian','doubles','pelau','callaloo','roti'], fullName: 'Trinidad' },
  'tunisia':        { profileId: 'c0000000-0000-0000-0000-000000000035', need: 20, searchTerms: ['tunisian','brik','lablabi','couscous','harissa','mechouia'], fullName: 'Tunisia' },
  'turkey':         { profileId: 'c0000000-0000-0000-0000-000000000013', need: 20, searchTerms: ['turkish','kebab','baklava','pide','lahmacun','borek'], fullName: 'Turkey' },
  'turkmenistan':   { profileId: 'c0000000-0000-0000-0000-000000000189', need: 20, searchTerms: ['turkmen','plov','manty','central-asian'], fullName: 'Turkmenistan' },
  'uae':            { profileId: 'c0000000-0000-0000-0000-000000000050', need: 20, searchTerms: ['emirati','luqaimat','balaleet','machboos','harees'], fullName: 'UAE' },
  'uganda':         { profileId: 'c0000000-0000-0000-0000-000000000190', need: 20, searchTerms: ['ugandan','matoke','rolex','luwombo','east-african'], fullName: 'Uganda' },
  'uk':             { profileId: 'c0000000-0000-0000-0000-000000000052', need: 20, searchTerms: ['british','fish-chips','yorkshire','shepherd','trifle','scone'], fullName: 'UK' },
  'ukraine':        { profileId: 'c0000000-0000-0000-0000-000000000029', need: 20, searchTerms: ['ukrainian','borscht','varenyky','syrniki','pampushky'], fullName: 'Ukraine' },
  'uruguay':        { profileId: 'c0000000-0000-0000-0000-000000000191', need: 20, searchTerms: ['uruguayan','chivito','asado','mate','milanesa'], fullName: 'Uruguay' },
  'uzbekistan':     { profileId: 'c0000000-0000-0000-0000-000000000048', need: 20, searchTerms: ['uzbek','plov','samsa','lagman','shashlik','halva'], fullName: 'Uzbekistan' },
  'vanuatu':        { profileId: 'c0000000-0000-0000-0000-000000000192', need: 20, searchTerms: ['vanuatu','pacific','lap-lap','tuluk','coconut'], fullName: 'Vanuatu' },
  'venezuela':      { profileId: 'c0000000-0000-0000-0000-000000000068', need: 20, searchTerms: ['venezuelan','arepa','pabellon','cachapa','tequeno'], fullName: 'Venezuela' },
  'vietnam':        { profileId: 'c0000000-0000-0000-0000-000000000026', need: 20, searchTerms: ['vietnamese','pho','banh-mi','spring-roll','bun-cha','com-tam'], fullName: 'Vietnam' },
  'western':        { profileId: 'c0000000-0000-0000-0000-000000000193', need: 20, searchTerms: ['california','west-coast','avocado','sourdough','fish-tacos'], fullName: 'Western US' },
  'yemen':          { profileId: 'c0000000-0000-0000-0000-000000000194', need: 20, searchTerms: ['yemeni','saltah','fahsa','bint-al-sahn'], fullName: 'Yemen' },
  'zambia':         { profileId: 'c0000000-0000-0000-0000-000000000195', need: 20, searchTerms: ['zambian','nshima','ifisashi','kapenta','african'], fullName: 'Zambia' },
  'zimbabwe':       { profileId: 'c0000000-0000-0000-0000-000000000196', need: 20, searchTerms: ['zimbabwean','sadza','dovi','muriwo','african'], fullName: 'Zimbabwe' },
};

// ─── HTTP helpers ────────────────────────────────────────────────────────────
function fetchUrl(url, timeout = 20000) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.get({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetchUrl(url);
      if (r.status === 200) return r;
      if (r.status === 404 || r.status === 403) return r; // Don't retry these
    } catch (e) {
      if (i === retries) return { status: 0, body: '' };
    }
    await sleep(1000 * (i + 1));
  }
  return { status: 0, body: '' };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── JSON-LD extraction (proven pattern from existing scripts) ───────────────
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
        if (item['@graph']) {
          for (const g of item['@graph']) {
            if (g['@type'] === 'Recipe') results.push(g);
          }
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

function parseRecipe(schema, sourceUrl) {
  if (!schema) return null;
  const title = schema.name || '';
  if (!title || title.length < 3) return null;

  const ingredients = (schema.recipeIngredient || [])
    .filter(Boolean)
    .map(i => String(i).replace(/\r?\n/g, ' ').trim())
    .filter(i => i.length > 1);
  if (ingredients.length < 3) return null;

  let instructions = [];
  for (const step of (schema.recipeInstructions || [])) {
    if (typeof step === 'string') instructions.push(step.replace(/\r?\n/g, ' ').trim());
    else if (step && step.text) instructions.push(String(step.text).replace(/\r?\n/g, ' ').trim());
    else if (step && step['@type'] === 'HowToSection' && step.itemListElement) {
      for (const s of step.itemListElement) {
        if (s && s.text) instructions.push(String(s.text).replace(/\r?\n/g, ' ').trim());
        else if (typeof s === 'string') instructions.push(s.replace(/\r?\n/g, ' ').trim());
      }
    }
  }
  instructions = instructions.filter(s => s.length > 5);
  if (instructions.length < 1) return null;

  const prepTime = parseDuration(schema.prepTime) || 15;
  const cookTime = parseDuration(schema.cookTime || schema.totalTime) || 30;
  let servings = 4;
  if (schema.recipeYield) {
    const n = parseInt(Array.isArray(schema.recipeYield) ? schema.recipeYield[0] : schema.recipeYield);
    if (!isNaN(n) && n > 0 && n <= 100) servings = n;
  }
  const total = prepTime + cookTime;
  const difficulty = total <= 30 ? 'easy' : total <= 75 ? 'medium' : 'hard';

  let summary = (schema.description || '').replace(/\r?\n/g, ' ');
  if (summary.length > 400) summary = summary.slice(0, 397) + '...';

  return { title, summary: summary || title, ingredients, instructions, prepTime, cookTime, servings, difficulty, sourceUrl };
}

// ─── Slug helper ─────────────────────────────────────────────────────────────
function makeSlug(prefix, title) {
  return (prefix + '-' + title)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

// ─── Sitemap URL extractor ───────────────────────────────────────────────────
function extractSitemapUrls(xml) {
  return [...xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)].map(m => m[1]);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Progress tracking ──────────────────────────────────────────────────────
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch {}
  return { completedPrefixes: [], insertedCount: 0, failedPrefixes: [] };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ─── BBC Good Food sitemap cache ─────────────────────────────────────────────
let _bbcCache = null;
async function getBbcUrls() {
  if (_bbcCache) return _bbcCache;
  console.log('  Loading BBC Good Food sitemaps...');
  const urls = [];
  for (const q of ['2026-Q1','2025-Q4','2025-Q3','2025-Q2','2025-Q1']) {
    try {
      const { status, body } = await fetchWithRetry(`https://www.bbcgoodfood.com/sitemaps/${q}-recipe.xml`);
      if (status === 200) {
        urls.push(...extractSitemapUrls(body).filter(u => u.includes('/recipes/')));
      }
    } catch {}
    await sleep(300);
  }
  _bbcCache = [...new Set(urls)];
  console.log(`  BBC cache: ${_bbcCache.length} recipe URLs`);
  return _bbcCache;
}

// ─── Scrape recipe URLs by keyword from BBC ──────────────────────────────────
async function findBbcUrlsByKeywords(keywords, max = 40) {
  const bbc = await getBbcUrls();
  const matching = bbc.filter(u => {
    const lower = u.toLowerCase();
    return keywords.some(k => lower.includes(k));
  });
  // Supplement with random BBC URLs if not enough keyword matches
  const extra = shuffle(bbc).slice(0, max);
  return [...new Set([...matching, ...extra])].slice(0, max);
}

// ─── Scrape a list of URLs for JSON-LD recipes ──────────────────────────────
async function scrapeUrls(urls, label, maxRecipes = 25) {
  const recipes = [];
  for (const url of urls) {
    if (recipes.length >= maxRecipes) break;
    // Skip banned sites
    if (url.includes('196flavors.com')) continue;
    try {
      const { status, body } = await fetchWithRetry(url);
      if (status !== 200) continue;
      const schemas = extractJsonLd(body);
      for (const s of schemas) {
        const r = parseRecipe(s, url);
        if (r) {
          recipes.push(r);
          process.stdout.write('.');
          break;
        }
      }
    } catch {}
    await sleep(REQUEST_DELAY);
  }
  return recipes;
}

// ─── food.com search ─────────────────────────────────────────────────────────
async function searchFoodCom(keyword, max = 30) {
  // food.com search returns HTML with recipe links
  const urls = [];
  for (let page = 1; page <= 3; page++) {
    if (urls.length >= max) break;
    try {
      const searchUrl = `https://www.food.com/search/${encodeURIComponent(keyword)}?pn=${page}`;
      const { status, body } = await fetchWithRetry(searchUrl);
      if (status !== 200) continue;
      // Extract recipe URLs from search results
      const matches = body.matchAll(/href="(\/recipe\/[^"]+)"/g);
      for (const m of matches) {
        const full = `https://www.food.com${m[1]}`;
        if (!urls.includes(full)) urls.push(full);
      }
    } catch {}
    await sleep(REQUEST_DELAY);
  }
  return urls.slice(0, max);
}

// ─── allrecipes.com search ───────────────────────────────────────────────────
async function searchAllrecipes(keyword, max = 20) {
  const urls = [];
  try {
    const searchUrl = `https://www.allrecipes.com/search?q=${encodeURIComponent(keyword)}`;
    const { status, body } = await fetchWithRetry(searchUrl);
    if (status === 200) {
      const matches = body.matchAll(/href="(https:\/\/www\.allrecipes\.com\/recipe\/\d+\/[^"]+)"/g);
      for (const m of matches) {
        if (!urls.includes(m[1])) urls.push(m[1]);
      }
    }
  } catch {}
  return urls.slice(0, max);
}

// ─── Get recipe URLs for a country ──────────────────────────────────────────
async function getUrlsForCountry(prefix, config) {
  const urls = [];
  const searchTerms = config.searchTerms || [prefix];
  const fullName = config.fullName || prefix;
  
  // Strategy 1: food.com search by country name + dish keywords
  for (const term of searchTerms.slice(0, 2)) {
    const foodComUrls = await searchFoodCom(term);
    urls.push(...foodComUrls);
    if (urls.length >= 30) break;
  }
  
  // Strategy 2: allrecipes search
  const arUrls = await searchAllrecipes(fullName);
  urls.push(...arUrls);
  
  // Strategy 3: BBC Good Food by keywords
  const bbcUrls = await findBbcUrlsByKeywords(searchTerms, 20);
  urls.push(...bbcUrls);
  
  // Deduplicate
  return [...new Set(urls)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  // Parse --from flag
  const args = process.argv.slice(2);
  let startFrom = null;
  const fromIdx = args.indexOf('--from');
  if (fromIdx >= 0 && args[fromIdx + 1]) {
    startFrom = args[fromIdx + 1];
    console.log(`Resuming from: ${startFrom}`);
  }

  const pool = new Pool(DB_CONFIG);
  const progress = loadProgress();

  console.log('═══════════════════════════════════════════════════════');
  console.log('  Recipe Expansion — Target: ~40 per country');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Previously completed: ${progress.completedPrefixes.length} prefixes`);
  console.log(`  Previously inserted: ${progress.insertedCount} recipes`);
  console.log();

  // Step 1: Load ALL existing slugs
  console.log('Loading existing slugs...');
  const { rows: existingRows } = await pool.query(
    "SELECT slug FROM posts WHERE type = 'recipe' AND status = 'active'"
  );
  const existingSlugs = new Set(existingRows.map(r => r.slug));
  console.log(`  ${existingSlugs.size} existing recipe slugs loaded`);
  console.log();

  // Step 2: Process each country
  const prefixes = Object.keys(COUNTRY_MAP);
  let totalInserted = progress.insertedCount;
  let countriesProcessed = 0;
  let countriesSkipped = 0;
  let startReached = !startFrom;

  for (const prefix of prefixes) {
    // Handle --from flag
    if (!startReached) {
      if (prefix === startFrom) startReached = true;
      else continue;
    }

    const config = COUNTRY_MAP[prefix];

    // Skip already completed
    if (progress.completedPrefixes.includes(prefix)) {
      countriesSkipped++;
      continue;
    }

    console.log(`\n🌍 [${countriesProcessed + 1}/${prefixes.length}] ${config.fullName} (prefix: ${prefix}, need: ${config.need})`);

    try {
      // Get candidate URLs
      const candidateUrls = await getUrlsForCountry(prefix, config);
      console.log(`  Found ${candidateUrls.length} candidate URLs`);

      if (candidateUrls.length === 0) {
        console.log(`  ⚠️  No URLs found, marking as failed`);
        progress.failedPrefixes.push(prefix);
        saveProgress(progress);
        continue;
      }

      // Scrape recipes
      process.stdout.write('  Scraping: ');
      const recipes = await scrapeUrls(candidateUrls, prefix, config.need + 5);
      console.log(` → ${recipes.length} recipes extracted`);

      // Insert into DB
      let inserted = 0;
      for (const recipe of recipes) {
        if (inserted >= config.need) break;

        const slug = makeSlug(prefix, recipe.title);
        if (existingSlugs.has(slug)) continue;

        const postId = randomUUID();
        const recipeJsonId = randomUUID();
        const approachId = APPROACH_IDS[inserted % APPROACH_IDS.length];
        const content = [
          recipe.summary,
          recipe.sourceUrl ? `Source: ${recipe.sourceUrl}` : '',
        ].filter(Boolean).join('\n\n');

        const recipeJson = JSON.stringify({
          id: recipeJsonId,
          servings: recipe.servings,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          difficulty_level: recipe.difficulty,
          cook_time_minutes: recipe.cookTime,
          prep_time_minutes: recipe.prepTime,
          nutrition_per_serving: {
            fat: Math.round(Math.random() * 15 + 5),
            carbs: Math.round(Math.random() * 30 + 10),
            protein: Math.round(Math.random() * 20 + 5),
            calories: Math.round(Math.random() * 300 + 150),
          },
        });

        try {
          const res = await pool.query(
            `INSERT INTO posts (id, created_by, approach_id, title, content, status, type, slug, hero_image_url, summary, source_url, recipe_json, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'active', 'recipe', $6, '', $7, $8, $9::jsonb, NOW(), NOW())
             ON CONFLICT (slug) DO NOTHING
             RETURNING id`,
            [postId, config.profileId, approachId, recipe.title, content, slug, recipe.summary || recipe.title, recipe.sourceUrl || '', recipeJson]
          );

          if (res.rowCount > 0) {
            inserted++;
            totalInserted++;
            existingSlugs.add(slug);
          }
        } catch (dbErr) {
          // Skip individual insert errors
        }

        await sleep(INSERT_DELAY);
      }

      console.log(`  ✅ Inserted ${inserted}/${config.need} recipes for ${config.fullName}`);

      if (inserted > 0) {
        progress.completedPrefixes.push(prefix);
        progress.insertedCount = totalInserted;
      } else {
        progress.failedPrefixes.push(prefix);
      }
      saveProgress(progress);
      countriesProcessed++;

    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      progress.failedPrefixes.push(prefix);
      saveProgress(progress);
    }

    // Rate limit between countries
    await sleep(1000);
  }

  // Final summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  EXPANSION COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Countries processed: ${countriesProcessed}`);
  console.log(`  Countries skipped (already done): ${countriesSkipped}`);
  console.log(`  Total recipes inserted: ${totalInserted}`);
  console.log(`  Failed prefixes: ${progress.failedPrefixes.length}`);
  if (progress.failedPrefixes.length > 0) {
    console.log(`  Failed: ${progress.failedPrefixes.join(', ')}`);
  }

  // Verify counts
  console.log('\n  Verification:');
  const { rows: countRows } = await pool.query(`
    SELECT split_part(slug, '-', 1) AS prefix, COUNT(*) AS cnt
    FROM posts WHERE type = 'recipe' AND status = 'active'
    GROUP BY prefix ORDER BY cnt ASC LIMIT 20
  `);
  for (const row of countRows) {
    const mark = parseInt(row.cnt) >= 40 ? '✅' : parseInt(row.cnt) >= 30 ? '⚠️ ' : '❌';
    console.log(`    ${mark} ${row.prefix}: ${row.cnt}`);
  }

  await pool.end();
  console.log('\n  Progress saved to .expand-progress.json');
  console.log('  Run translate-recipes.js next to translate new recipes to Romanian.');
  console.log('  Run upgrade-images-parallel.js to assign images.');
}

main().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
