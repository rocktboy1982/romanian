-- fix-cocktail-grammar.sql
-- Fix Romanian grammar and diacritics in cocktail titles
-- Applied: 2026-03-26
-- Total fixes: 52

-- ============================================================
-- SECTION 1: FIX CEDILLA DIACRITICS (ş→ș, ţ→ț, Ş→Ș, Ţ→Ț)
-- Romanian standard requires comma-below (ș ț), NOT cedilla (ş ţ)
-- All 7 fixed.
-- ============================================================

UPDATE posts SET title = 'Șapte și Șapte'
WHERE id = '5ebaeb79-cb6b-4562-bd56-9e148ddb0aaa';
-- Was: "Şapte şi Şapte" — cedilla Ş/ş → comma-below Ș/ș; si → și

UPDATE posts SET title = 'Șurubelniță'
WHERE id = '32cbaee0-c2f0-4c67-b110-eac8495d4edb';
-- Was: "Şurubelniţă" — cedilla Ş/ţ → comma-below Ș/ț

UPDATE posts SET title = 'Împușcătură'
WHERE id = '59b2f6c7-789f-4c2b-b5e9-ab7df457546e';
-- Was: "împuşcătură" — cedilla ş→ș + lowercase start → uppercase Î

UPDATE posts SET title = 'Nisipuri Mișcătoare'
WHERE id = '95585619-34d9-49d7-a9fa-cba2950eecb4';
-- Was: "Nisipuri mişcătoare" — cedilla ş→ș; Mișcătoare capitalized (Quicksand cocktail)

UPDATE posts SET title = 'Nașul'
WHERE id = '0652cdec-40ac-404f-8eee-61c06fd5fda1';
-- Was: "naşul" — cedilla ş→ș; lowercase start → uppercase (The Godfather cocktail)

UPDATE posts SET title = 'Avalanșă'
WHERE id = '6422c4c5-6ab2-4464-842d-c6fe04b517a1';
-- Was: "Avalanşă" — cedilla ş→ș

UPDATE posts SET title = 'Aviație'
WHERE id = 'c76a4cb7-334d-4fdd-9ed5-4246cd8fa367';
-- Was: "Aviaţie" — cedilla ţ→ț (Aviation cocktail)

-- ============================================================
-- SECTION 2: FIX LOWERCASE STARTS (21 fixes)
-- All cocktail titles should start with uppercase
-- ============================================================

UPDATE posts SET title = 'Algonquin'
WHERE id = '7e25fda5-30e0-44cd-834b-2e4925b515c9';
-- Was: "algonchin" — lowercase + misspelling; the Algonquin is a classic rye cocktail

UPDATE posts SET title = 'Arțar Afumat la Modă Veche'
WHERE id = '479c007e-ed2a-4cba-ac30-510465d00d21';
-- Was: "arțar afumat la modă veche" — all lowercase start

UPDATE posts SET title = 'Bambus (Clasic)'
WHERE id = '951dd4ce-6f51-4a1b-b313-f85f9ec69132';
-- Was: "bambus (clasic)" — lowercase start; Bamboo Classic cocktail

UPDATE posts SET title = 'Brigadier'
WHERE id = '5a1c4de6-963a-4fb4-8eef-aecb87eb6ad8';
-- Was: "brigadier" — lowercase start

UPDATE posts SET title = 'Cafea Kioki'
WHERE id = '2ecfc314-40ee-4675-b857-91a36a4b86a6';
-- Was: "cafea Kioki" — lowercase start (Kioki Coffee)

UPDATE posts SET title = 'Francesa 75'
WHERE id = '4a21a3db-6a8d-458b-9842-06d6708b791f';
-- Was: "franceza 75" — lowercase start; French 75 → Francesa 75

UPDATE posts SET title = 'Francesa 76'
WHERE id = '34c4b0eb-0819-4902-897b-459ebca74a1c';
-- Was: "franceza 76" — lowercase start; French 76 → Francesa 76

UPDATE posts SET title = 'Irlandez Nebun'
WHERE id = '832ac1d2-a4e1-4a69-8d67-26ac7c8ee3df';
-- Was: "irlandez nebun" — lowercase start; Crazy Irish cocktail

UPDATE posts SET title = 'Mexican 55'
WHERE id = 'a2de3c10-f94f-4975-8c84-bd76bf39f62c';
-- Was: "mexican 55" — lowercase start

UPDATE posts SET title = 'Grenadă'
WHERE id = '93893dcc-bd31-4d17-84d2-f029ec1ca37e';
-- Was: "nade" — very odd fragment; this is a Grenade shot (vodka + amaretto + cream)

UPDATE posts SET title = 'Nașă'
WHERE id = '07e565d4-bc2c-4b2c-8122-69ccff5d710e';
-- Was: "nașă" — lowercase start (Godmother cocktail: vodka + amaretto)

UPDATE posts SET title = 'Negroni Olandez'
WHERE id = 'c1883403-7dcf-45d2-ace0-57176640e4ef';
-- Was: "olandez Negroni" — lowercase start + word order fix (Dutch Negroni → Negroni Olandez)

UPDATE posts SET title = 'Partea de Sud'
WHERE id = 'f34b9eb7-0d53-4226-976b-fd8cf7314d71';
-- Was: "partea de sud" — lowercase start (Southside cocktail)

UPDATE posts SET title = 'Prezbiterian'
WHERE id = 'a70f1912-3c45-4816-85a4-bd62e115bef8';
-- Was: "prezbiterian" — lowercase start (Presbyterian cocktail)

UPDATE posts SET title = 'Prezbiterian (Clasic)'
WHERE id = '3975ef21-9be9-4b59-9c55-1c2d747b11e5';
-- Was: "prezbiterian (clasic)" — lowercase start

UPDATE posts SET title = 'Rusă Albă'
WHERE id = '43f13e09-cda3-4c62-96b3-330cb9f6d742';
-- Was: "rusă albă" — lowercase start (White Russian)

UPDATE posts SET title = 'Rusă Irlandeză'
WHERE id = 'd0edd204-4dbd-4081-a913-e1d365f9b234';
-- Was: "rusă irlandeză" — lowercase start (Irish Russian)

UPDATE posts SET title = 'Rusă Neagră'
WHERE id = '79386609-eb97-49df-9cb3-e2a35cc76b54';
-- Was: "rusă neagră" — lowercase start (Black Russian)

UPDATE posts SET title = 'Smoking'
WHERE id = '830bb045-1d8c-468d-bf08-0b2db91914b0';
-- Was: "smoking" — lowercase start; this IS the Smoking cocktail (gin, vermouth, etc.)

UPDATE posts SET title = 'Vagon'
WHERE id = 'e47d7dda-af3e-446d-8d64-c5367c745fc5';
-- Was: "vagon" — lowercase start (Wagon cocktail)

UPDATE posts SET title = 'Vechi Cubanez'
WHERE id = '31311ee6-1c39-446d-bc28-85e9a85f3089';
-- Was: "vechi cubanez" — lowercase start (Old Cuban cocktail)

-- ============================================================
-- SECTION 3: FIX MISSING DIACRITICS (12 fixes)
-- ============================================================

UPDATE posts SET title = 'Acvariul Național'
WHERE id = 'ccd751e1-126d-4af7-81ba-de6382e067af';
-- Was: "Acvariul National" — missing ț: National → Național

UPDATE posts SET title = 'Armata și Marina'
WHERE id = 'aca33c32-119d-49dc-a896-0b3e0915393d';
-- Was: "Armata si Marina" — missing diacritic: si → și

UPDATE posts SET title = 'Dulceață Gogoașă'
WHERE id = '76cf2fb2-1cb2-4fe4-a91e-93a3e001877b';
-- Was: "Dulceata gogoasa" — missing diacritics throughout (Donut cocktail)

UPDATE posts SET title = 'Lapte de Ciocolată'
WHERE id = 'ec920474-b27e-4d61-886e-eabf76ea9986';
-- Was: "Lapte de ciocolata" — missing diacritic: ciocolata → Ciocolată

UPDATE posts SET title = 'Ciocolată Caldă cu Parfum de Portocale'
WHERE id = 'fc1b45f9-e0db-4b7d-8ee6-16306278cf07';
-- Was: "Ciocolata calda cu parfum de portocale" — missing diacritics: Ciocolata→Ciocolată, calda→Caldă

UPDATE posts SET title = 'Limonadă de Căpșuni cu Busuioc'
WHERE id = '7fa63a5d-8049-49d6-9f66-ca1cf529e7aa';
-- Was: "Limonada de capsuni busuioc" — missing diacritics + grammar fix

UPDATE posts SET title = 'Limonadă cu Fructul Pasiunii'
WHERE id = 'badff04d-f2de-4f87-9e60-fa75a2e792b1';
-- Was: "Limonada cu fructul pasiunii" — missing diacritic: Limonada→Limonadă

UPDATE posts SET title = 'Limonadă de Lavandă'
WHERE id = 'c4836761-da6b-4f23-a8f4-7bc5dc2b72a1';
-- Was: "Limonada de lavandă" — missing diacritic: Limonada→Limonadă

UPDATE posts SET title = 'Limonadă de Salvie de Mure'
WHERE id = '11238b45-2f59-4f05-86b7-66883e31156e';
-- Was: "Limonada de salvie de mure" — missing diacritic: Limonada→Limonadă

UPDATE posts SET title = 'Limonadă de Trandafiri'
WHERE id = '46e79f57-b7f4-4dc2-8b1b-752f073b55c7';
-- Was: "Limonada de trandafiri" — missing diacritic: Limonada→Limonadă

UPDATE posts SET title = 'Margarita cu Căpșuni'
WHERE id = '37a9810c-c524-4ee1-8c46-522de04694f3';
-- Was: "Margarita cu capsuni" — missing diacritics: capsuni → Căpșuni

UPDATE posts SET title = 'Egg Nog - Sănătoasă'
WHERE id = '01406edf-10b4-47bd-8e92-81ab5de4ec5a';
-- Was: "Egg Nog - Sanatoasa" — missing diacritics: Sanatoasa→Sănătoasă

UPDATE posts SET title = 'Domnul și Doamna'
WHERE id = 'b0363aba-8985-4737-8902-fb35fec0ec43';
-- Was: "Domnul Si Doamna" — Si → și (Romanian conjunction)

UPDATE posts SET title = 'Ciocolată Caldă Nuked'
WHERE id = 'dc416edb-3a3b-41d5-acf7-30e0be2a273f';
-- Was: "Ciocolată caldă nuked" — caldă should be Caldă (title case)

UPDATE posts SET title = 'Ciocolată Caldă pentru care Să Mori'
WHERE id = '4551c52f-d752-4218-bc5d-5b323e71739a';
-- Was: "Ciocolată caldă pentru care să mori" — caldă→Caldă (title case)

-- ============================================================
-- SECTION 4: FIX WHITESPACE/ENCODING ISSUES (1 fix)
-- ============================================================

UPDATE posts SET title = 'Hanky Panky'
WHERE id = 'f62a0505-307e-45c5-93a7-e682c3baccb0';
-- Was: "Hanky ​​Panky" — zero-width spaces between words removed

-- ============================================================
-- SECTION 5: FIX TRANSLATION ERRORS / WRONG NAMES (5 fixes)
-- ============================================================

UPDATE posts SET title = '410 Gone'
WHERE id = 'ada6b0c7-3cda-4ec7-8549-b66ce0f5bd8c';
-- Was: "410 A plecat" — bad translation of HTTP 410 Gone; keep English name

UPDATE posts SET title = 'Smoothie de Ananas și Ghimbir'
WHERE id = '33cfd06a-f715-4e82-85da-bb8a1b82c04c';
-- Was: "Smoothie de ananas și ghimbiră" — "ghimbiră" is wrong form; correct: ghimbir

UPDATE posts SET title = 'Benton''s Old Fashioned'
WHERE id = 'a2e7130f-59b6-4254-979a-d551923a0b8b';
-- Was: "Benton e de modă veche" — mangled possessive; Benton's Old Fashioned is a proper cocktail name

UPDATE posts SET title = 'Monkey Wrench'
WHERE id = 'fb384c3e-4c30-4748-a633-cd7b87a8ce8e';
-- Was: "Monkey Cheie" — "Cheie"=Key but this is "Monkey Wrench" cocktail (rum+grapefruit)

UPDATE posts SET title = 'Brain Fart'
WHERE id = 'd90c71f1-5346-4809-a56c-bd6e6725137b';
-- Was: "Creierul Fart" — mixed English/Romanian; keep English name "Brain Fart"

-- ============================================================
-- SUMMARY OF ALL CHANGES
-- ============================================================
-- Section 1 - Cedilla diacritics fixed: 7
--   Aviație, Avalanșă, Nașul, Nisipuri Mișcătoare, Împușcătură, Șurubelniță, Șapte și Șapte
-- Section 2 - Lowercase starts fixed: 21
--   Algonquin, Arțar Afumat la Modă Veche, Bambus (Clasic), Brigadier, Cafea Kioki,
--   Francesa 75, Francesa 76, Grenadă, Irlandez Nebun, Mexican 55, Nașă, Negroni Olandez,
--   Partea de Sud, Prezbiterian, Prezbiterian (Clasic), Rusă Albă, Rusă Irlandeză,
--   Rusă Neagră, Smoking, Vagon, Vechi Cubanez
-- Section 3 - Missing diacritics: 15
--   Acvariul Național, Armata și Marina, Dulceață Gogoașă, Lapte de Ciocolată,
--   Ciocolată Caldă cu Parfum de Portocale, Limonadă de Căpșuni cu Busuioc,
--   Limonadă cu Fructul Pasiunii, Limonadă de Lavandă, Limonadă de Salvie de Mure,
--   Limonadă de Trandafiri, Margarita cu Căpșuni, Egg Nog - Sănătoasă,
--   Domnul și Doamna, Ciocolată Caldă Nuked, Ciocolată Caldă pentru care Să Mori
-- Section 4 - Whitespace/encoding: 1
--   Hanky Panky (zero-width spaces)
-- Section 5 - Translation errors: 5
--   410 Gone, Smoothie de Ananas și Ghimbir, Benton's Old Fashioned,
--   Monkey Wrench, Brain Fart
-- TOTAL: 49 changes applied to 986 cocktail titles

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================
-- SELECT id, title FROM posts WHERE type = 'cocktail'
-- AND id IN (
--   '5ebaeb79-cb6b-4562-bd56-9e148ddb0aaa', -- Șapte și Șapte
--   '32cbaee0-c2f0-4c67-b110-eac8495d4edb', -- Șurubelniță
--   '59b2f6c7-789f-4c2b-b5e9-ab7df457546e', -- Împușcătură
--   '95585619-34d9-49d7-a9fa-cba2950eecb4', -- Nisipuri Mișcătoare
--   '0652cdec-40ac-404f-8eee-61c06fd5fda1', -- Nașul
--   '6422c4c5-6ab2-4464-842d-c6fe04b517a1', -- Avalanșă
--   'c76a4cb7-334d-4fdd-9ed5-4246cd8fa367', -- Aviație
--   '7e25fda5-30e0-44cd-834b-2e4925b515c9', -- Algonquin
--   'a2e7130f-59b6-4254-979a-d551923a0b8b', -- Benton''s Old Fashioned
--   'fb384c3e-4c30-4748-a633-cd7b87a8ce8e', -- Monkey Wrench
--   'ada6b0c7-3cda-4ec7-8549-b66ce0f5bd8c', -- 410 Gone
--   'f62a0505-307e-45c5-93a7-e682c3baccb0', -- Hanky Panky
--   'd90c71f1-5346-4809-a56c-bd6e6725137b'  -- Brain Fart
-- ) ORDER BY title;
