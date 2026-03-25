-- ============================================================
-- fix-grammar.sql
-- Romanian grammar and translation fixes for posts.title
-- Generated: 2026-03-26
-- Total fixes: ~80 UPDATE statements
-- ============================================================

-- ============================================================
-- RULE 1: "Orz" (barley) used where "Orez" (rice) is correct
-- Arroz = rice = orez. These are rice dishes mistranslated as barley.
-- NOTE: Lines where "orz" legitimately means barley are NOT changed
--   (e.g. Orz cu Spanac și Paneer, Salată de orz italian,
--         Houbový Kuba which uses actual barley)
-- ============================================================

-- Arroz Apastelado Costeño: Arroz = rice (not barley), "Adesiv" → "Lipicios"
UPDATE posts SET title = 'Arroz Apastelado Costeño (Orez Lipicios de pe Coastă)' WHERE id = '05792efc-4743-482a-ae13-d48af699a3ba';

-- Arroz cu Gandules: rice + pigeon peas (not barley + bird lentils)
UPDATE posts SET title = 'Arroz cu Gandules (Orez cu Mazăre de Porumbel)' WHERE id = '38897ee9-c103-44d5-a07a-9d18554783f3';

-- Gallo Pinto: classic rice-and-beans Costa Rican dish, not barley
UPDATE posts SET title = 'Gallo Pinto din Costa Rica (Orez și Fasole)' WHERE id = '920d4c5e-7c45-444d-8c28-872f4cd2420d';

-- Pui Shawarma cu Pilaf de Orez (shawarma is served with rice pilaf, not barley)
UPDATE posts SET title = 'Pui Shawarma la Cuptor și Pilaf de Orez' WHERE id = '4c8c3dfd-edeb-41e3-aa2a-f26bfcde8a93';

-- ============================================================
-- RULE 2: "Maie" → "Porumb" (maize/corn)
-- ============================================================

-- "Arepas din Maie Peto" — "Maie" is not a word; "Maiz Peto" = Hominy (corn)
UPDATE posts SET title = 'Arepas din Porumb Peto (Hominy)' WHERE id = 'a27a502d-af9a-42b0-9c0c-c0baac9f0271';

-- ============================================================
-- RULE 3: "Arăpe" / "Arădeți" — nonsense words from bad translation
-- ============================================================

-- "Arădeți de Miel Mongol" — nonsense. Mongolian lamb dish.
UPDATE posts SET title = 'Miel Mongol la Grătar' WHERE id = 'f6466e8e-6579-45a6-bc21-afeec31ca674';

-- "Arepas de Maiz Peto (Arăpe din Porumb Hominy Colombian)" — keep Arepas, fix parenthetical
UPDATE posts SET title = 'Arepas de Maiz Peto (Arepas din Porumb Hominy Columbian)' WHERE id = 'd82c446f-26d1-4799-9eb0-19784f660bcb';

-- ============================================================
-- RULE 4: "Coacere" used as noun (dish name)
-- ============================================================

-- "Akwadu - Coacere de Banane și Nuci de Cocos" — baked banana dessert
UPDATE posts SET title = 'Akwadu - Banane Coapte cu Nucă de Cocos' WHERE id = 'f125deac-be29-4009-84cd-d41e73363508';

-- "Sochniki (Coacere cu Brânză Ucrainene)" — Ukrainian baked cheese pastries
UPDATE posts SET title = 'Sochniki (Prăjituri cu Brânză Ucrainene)' WHERE id = 'f8471f1e-3d9d-4879-ab90-99f2904f047e';

-- "Verguny (Coacere tradiționale ucrainene)" — traditional Ukrainian fried pastries
UPDATE posts SET title = 'Verguny (Prăjituri Tradiționale Ucrainene)' WHERE id = 'ca872605-64a0-4eec-a24b-706cce7e0f1d';

-- ============================================================
-- RULE 5: "Fripturi" — incorrect for "fries"
-- ============================================================

-- "Fripturi de cartofi la aer cu sare și piper"
UPDATE posts SET title = 'Cartofi Prăjiți la Aer cu Sare și Piper' WHERE id = 'fe3b77ab-fef1-4b55-882f-f497649efbea';

-- "Fripturi de Plantain Verde"
UPDATE posts SET title = 'Plantain Verde Prăjit' WHERE id = '981479bd-b92c-43a1-bf28-22bd8f970e51';

-- "Fripturi Grecești" — Greek fries
UPDATE posts SET title = 'Cartofi Prăjiți Grecești' WHERE id = '98c088e5-f76a-4c0c-b98c-c04201821635';

-- "Salchipapas (Fripturi de cartofi cu cârnați și sosuri)"
UPDATE posts SET title = 'Salchipapas (Cartofi Prăjiți cu Cârnați și Sosuri)' WHERE id = 'f7a71844-0e67-4cda-8a56-5e34a8b8bca5';

-- "Salchipapas (Fripturi de cartofi și hot dog-uri)"
UPDATE posts SET title = 'Salchipapas (Cartofi Prăjiți și Hot Dog-uri)' WHERE id = 'de878a9e-e6bd-43b6-9735-b278b5338308';

-- ============================================================
-- RULE 6: "Caramelizare" as adjective → "Caramelizate"
-- ============================================================

-- "Arepa Dulce cu Mere Caramelizare (Arepas Dulces con Manzanas)"
UPDATE posts SET title = 'Arepa Dulce cu Mere Caramelizate (Arepas Dulces con Manzanas)' WHERE id = 'e05b4c06-37a7-4fd7-8e59-e2aa71fa0db9';

-- ============================================================
-- RULE 7: "Turciele" — nonsense word
-- ============================================================

-- "Turciele de Pui cu Umplutură de Carne" (x2 duplicate IDs)
UPDATE posts SET title = 'Rulouri de Pui cu Umplutură de Carne' WHERE id = '94f99b2f-7a9a-4917-8b03-c5c6bed3c8d5';
UPDATE posts SET title = 'Rulouri de Pui cu Umplutură de Carne' WHERE id = '7611a910-61fb-4c31-af8d-a17229cf7e1f';

-- ============================================================
-- RULE 8: "Nouă cu Sos" — "Nouă" makes no sense; should be "Tăiței"
-- ============================================================

-- "Nouă cu Sos de Curry din Singapore" (x2 duplicate IDs)
UPDATE posts SET title = 'Tăiței cu Sos de Curry din Singapore' WHERE id = '41578d44-9b14-4483-90fe-9d18950dd5b5';
UPDATE posts SET title = 'Tăiței cu Sos de Curry din Singapore' WHERE id = '58d2d28d-c6ab-46d2-a1df-071679027711';

-- "Nouă vietnameze cu piept de pui și lemongrass"
UPDATE posts SET title = 'Tăiței Vietnamezi cu Piept de Pui și Lemongrass' WHERE id = '1a014d42-cebf-44c1-9d39-9ea2f73ccf5e';

-- "Bihon Pancit (Nouă Fierte Filipineze)" — Bihon = rice noodles
UPDATE posts SET title = 'Bihon Pancit (Tăiței Fierți Filipinezi)' WHERE id = 'cc38dd74-7d3c-47e4-825d-e4a388b2c6f2';

-- "Idiyappam (Nouă din făină de orez)" — Idiyappam = string hoppers (rice noodles)
UPDATE posts SET title = 'Idiyappam (Tăiței din Făină de Orez)' WHERE id = 'fb0f1105-cf89-452d-9304-f32c9fe97fb9';

-- "Jajangmyeon (Nouă Coreene cu Sos de Fasole Neagră)"
UPDATE posts SET title = 'Jajangmyeon (Tăiței Coreeni cu Sos de Fasole Neagră)' WHERE id = '0af2199f-2d26-4242-94e0-b21dc4c228eb';

-- "Mie Goreng (Nouă Goreng)" — Mie Goreng = fried noodles
UPDATE posts SET title = 'Mie Goreng (Tăiței Prăjiți)' WHERE id = 'daa7670e-9ee3-4e97-a918-92dc60a84844';

-- "Spicy Tsukemen (Nouă de Înmuiat)"
UPDATE posts SET title = 'Spicy Tsukemen (Tăiței de Înmuiat)' WHERE id = '8693de87-980b-4dfb-ba1c-2adf9f0fa9c3';

-- ============================================================
-- RULE 9: "Măruri" — not a word; "Mere" = apples
-- ============================================================

-- "Pecheni Yabalki (Măruri coapte cu umplutură de nuci)"
UPDATE posts SET title = 'Pecheni Yabalki (Mere Coapte cu Umplutură de Nuci)' WHERE id = 'ab314ad3-4d1f-4cf0-a786-9437e9f9a5fc';

-- "Pecheni Yabalki (Mărci Coapte)" — "Mărci" = brands/stamps, clearly wrong for apples
UPDATE posts SET title = 'Pecheni Yabalki (Mere Coapte)' WHERE id = '5089137c-2264-4e97-9bda-53d1f6fe17d5';

-- ============================================================
-- RULE 10: "Patate din Hominy" — "Patate" → "Chiftele/Turte"
-- ============================================================

-- "Llapingachos de Mote - Patate din Hominy cu Umplutură de Carne de Porc sau Brânză"
-- Llapingachos are potato cakes/patties; Mote = hominy
UPDATE posts SET title = 'Llapingachos de Mote - Turte din Hominy cu Umplutură de Carne de Porc sau Brânză' WHERE id = '38d0f8fc-e3ab-478f-b86b-e97dec82efba';

-- ============================================================
-- RULE 11: "Stridii" for clams — stridii = oysters, scoici = clams
-- ============================================================

-- "Almejas a la Marinera (Stridii în stil marin)" — Almejas = clams
UPDATE posts SET title = 'Almejas a la Marinera (Scoici în Stil Marin)' WHERE id = '661bba0c-0ca9-490d-b32b-7c24695c4abd';

-- "Spaghetti alle Vongole (Spaghete cu Stridii)" — Vongole = clams
UPDATE posts SET title = 'Spaghetti alle Vongole (Spaghete cu Scoici)' WHERE id = 'e0603902-d59f-4add-b919-31a585da721e';

-- ============================================================
-- RULE 12: "Linte de Păsări" — nonsense; Gandules = mazăre de porumbel
-- (already fixed in RULE 1 for Arroz cu Gandules)
-- ============================================================

-- ============================================================
-- RULE 13: "Cuburi de ciuperci" — wrong for Houbový Kuba
-- Houbový Kuba = Czech mushroom barley dish (not cubes)
-- ============================================================

UPDATE posts SET title = 'Houbový Kuba (Mâncare de Ciuperci cu Orz și Condimente)' WHERE id = '7085a2d0-fdd5-44bc-896b-9b5bf0874d3d';

-- ============================================================
-- RULE 14: "Adăpostite" — nonsense adjective
-- ============================================================

-- "Aripi de Pui Stil Chinezesc Adăpostite" → Glazed/Chinese style wings
UPDATE posts SET title = 'Aripi de Pui Glazurate în Stil Chinezesc' WHERE id = 'aeebb211-a133-4098-af9b-408d092c8867';

-- ============================================================
-- RULE 15: "Frituri" — non-standard; context-dependent fix
-- ============================================================

-- "Frituri de Dovlecel Grec (Kolokithokeftedes)" — these are fritters/patties
UPDATE posts SET title = 'Chifteluțe de Dovlecel Grecești (Kolokithokeftedes)' WHERE id = 'a4ab8a10-a71e-4da0-b052-d7358fec374b';

-- "Frituri de Mazăre și Ricotta" — fritters
UPDATE posts SET title = 'Chifteluțe de Mazăre și Ricotta' WHERE id = 'bf8a77ce-2d1c-44b1-bcfe-67e933e0c5f6';

-- "Accras de Morue (Frituri de Cod Sărat)" — Accras are fritters
UPDATE posts SET title = 'Accras de Morue (Chifteluțe de Cod Sărat)' WHERE id = '222a3274-b616-474e-9e28-72cfeb6f8e27';

-- "Buñuelos de Bacalao (Frituri de Cod Sărat)" — Buñuelos are fritters
UPDATE posts SET title = 'Buñuelos de Bacalao (Chifteluțe de Cod Sărat)' WHERE id = '5a3a1e10-a3b5-4374-adb2-5240c903d999';

-- "Mandocas Venezuelene (Frituri din Plantain Coapte și Făină de Porumb)"
UPDATE posts SET title = 'Mandocas Venezuelene (Gogolași din Plantain Copt și Făină de Porumb)' WHERE id = '5bff76d1-0495-461d-8f6c-1d3482e75c5a';

-- ============================================================
-- RULE 16: Untranslated English words
-- ============================================================

-- "Beef Rendang"
UPDATE posts SET title = 'Rendang de Vită' WHERE id = '3323b9cb-5006-4e4f-acd7-c928a801aefe';

-- "Beef Stroganoff"
UPDATE posts SET title = 'Stroganoff de Vită' WHERE id = 'dce7a44c-2075-4a2f-a530-b9134b971c38';

-- "Beef Stroganoff cu Slow Cooker"
UPDATE posts SET title = 'Stroganoff de Vită la Slow Cooker' WHERE id = '74934979-00fd-42d7-ad2f-f8b9522556e6';

-- "Chicken Bhuna Masala"
UPDATE posts SET title = 'Pui Bhuna Masala' WHERE id = 'a25301f8-64b9-4ead-b604-3b29df57ae77';

-- "CHICKEN CHOW MEIN" (also fix all-caps)
UPDATE posts SET title = 'Pui Chow Mein' WHERE id = '43c506c7-6adc-4188-ad7f-b9cbdecf70bd';

-- "Chicken Karela"
UPDATE posts SET title = 'Pui Karela' WHERE id = 'ef61ee8a-3036-4d0f-a7c6-cd2137496923';

-- "Chicken Shahi"
UPDATE posts SET title = 'Pui Shahi' WHERE id = '871980e1-45ef-446d-ac29-78f3aa6d6bf0';

-- "Chicken Tikka Masala"
UPDATE posts SET title = 'Pui Tikka Masala' WHERE id = '192ec4e0-9e1c-40c3-9965-80dd7508289b';

-- "Pork Lomo Saltado (Stir-Fry de Porc Peruan)"
UPDATE posts SET title = 'Lomo Saltado de Porc (Stir-Fry de Porc Peruan)' WHERE id = '15961822-4269-45a8-b57d-84a71d946683';

-- "Rețetă de Chicken Adobo"
UPDATE posts SET title = 'Rețetă de Pui Adobo' WHERE id = '86dbfe40-eaf0-4202-9bca-35d517523228';

-- "Kadhai Chicken Chargha"
UPDATE posts SET title = 'Pui Kadhai Chargha' WHERE id = '904916b4-d096-4ec5-b6fb-9b7a88dc43c8';

-- "Muffin Tin Chicken Tostadas Picante"
UPDATE posts SET title = 'Tostadas Picante cu Pui la Tăvițe' WHERE id = '054756d5-dd8f-462d-a0df-8d3fcefbf5bf';

-- "Supă de Albondigas Mexicane (Mexican Meatball Soup)"
UPDATE posts SET title = 'Supă de Albondigas Mexicane (Supă Mexicană cu Chifteluțe)' WHERE id = 'bfce3d0e-0ee2-4c47-8c2d-b679a4ea5418';

-- "Tandoori Chicken King Kebab cu Turmeric și Biryani de Fasole Verde"
UPDATE posts SET title = 'Tandoori Pui King Kebab cu Turmeric și Biryani de Fasole Verde' WHERE id = 'ab1e4dbf-72c1-498a-9672-6d20b4954abf';

-- ============================================================
-- RULE 18 & 19: "Pavo"/"Pavă" = curcan (turkey), not pui (chicken)
-- ============================================================

-- "(Pavo a lo criollo) Pavă afumată în stil latin de Crăciun sau Ziua Recunoștinței"
UPDATE posts SET title = '(Pavo a lo criollo) Curcan Afumat în Stil Creol de Crăciun sau Ziua Recunoștinței' WHERE id = '3479290c-cf8b-40d9-ae0e-c2c1871f843f';

-- "Pavo Asado Navideño (Pui de Crăciun și Umplutură Stil Latin)" — Pavo = turkey
UPDATE posts SET title = 'Pavo Asado Navideño (Curcan Fript de Crăciun în Stil Latin)' WHERE id = '23a9eaf1-91f5-420b-9365-d677603e4eab';

-- "Relleno de Pavo sau Turkey Stuffing în Stil Ecuadorian/Latin"
UPDATE posts SET title = 'Relleno de Pavo sau Umplutură de Curcan în Stil Ecuadorian/Latin' WHERE id = '7e669fbe-3b37-4b66-b034-8f82f5efc92a';

-- ============================================================
-- RULE 21: "Platanii" — should be "Plantain" or "Plátani"
-- ============================================================

-- "Platanii cojiți prăjiți" — plantains fried in their peel
UPDATE posts SET title = 'Plátani Cojiți Prăjiți' WHERE id = '869db3e2-e25c-474c-a367-faf1355a1e27';

-- ============================================================
-- ADDITIONAL FIXES: "Băuturi" used for solid foods (balls/meatballs)
-- "Băuturi" = drinks/beverages — these are clearly food items
-- ============================================================

-- "Köttbullar (Băuturi suedeze de carne)" — Köttbullar = Swedish meatballs
UPDATE posts SET title = 'Köttbullar (Chiftele Suedeze)' WHERE id = '3301d067-6f5b-4b60-817d-6f43d868e70c';

-- "Băuturi germane cu rom (Rumkugeln)" — Rumkugeln = rum balls
UPDATE posts SET title = 'Biluțe Germane cu Rom (Rumkugeln)' WHERE id = '6e0bfada-bb96-4cc4-810a-434494c5eb79';

-- "Băuturi suedeze (bală de carne Ikea homemade)" — Swedish meatballs
UPDATE posts SET title = 'Chiftele Suedeze (Bale de Carne Ikea Homemade)' WHERE id = '1766c7c9-795d-4c1b-9eb8-248f74b5a8c0';

-- "Băuturi de pui cu sos de roșii și spaghete" — chicken dish with tomato sauce
UPDATE posts SET title = 'Chiftele de Pui cu Sos de Roșii și Spaghete' WHERE id = '5066bfc0-5bc7-4d17-bdd1-456bce78d380';

-- "Băuturi italienești cu piept de pui" — Italian chicken breast dish
UPDATE posts SET title = 'Rulouri Italienești cu Piept de Pui' WHERE id = 'd99cf726-d3ea-4d13-b171-e571c1abaaac';

-- "Băuturi de dovleac cu curry și cocos" — pumpkin curry dish
UPDATE posts SET title = 'Tocăniță de Dovleac cu Curry și Cocos' WHERE id = 'db220a2e-f9e4-4dc0-ac86-6185c8d97462';

-- "Băuturi de ciocolată din Dubai, mai sănătoase" — Dubai chocolate (viral dessert = bars/bites)
UPDATE posts SET title = 'Dulciuri de Ciocolată din Dubai, Mai Sănătoase' WHERE id = 'e5fed1ba-bb79-49a3-a13b-fd75a74e2450';

-- "Polpette al Sugo (Băițe de carne în sos de roșii)" — Polpette = meatballs, "Băițe" is not standard
UPDATE posts SET title = 'Polpette al Sugo (Chiftele în Sos de Roșii)' WHERE id = '53933293-7ca0-405d-8f24-01a4bc76417f';

-- ============================================================
-- ADDITIONAL FIXES: "Riz" (French) / "Riță" — not Romanian for rice
-- ============================================================

-- "Riz mexican prăjit" — "Riz" is French, not Romanian
UPDATE posts SET title = 'Orez Mexican Prăjit' WHERE id = '1ae25168-bcd6-492a-a43c-9a597d002256';

-- "Riz prăjit chinezesc cu creveți"
UPDATE posts SET title = 'Orez Prăjit Chinezesc cu Creveți' WHERE id = 'da2ce6c0-92c0-4fa2-8095-5af496496f68';

-- "Nasi Goreng (Riță prăjită indoneziană)" — "Riță" is not Romanian
UPDATE posts SET title = 'Nasi Goreng (Orez Prăjit Indonezian)' WHERE id = 'df7a50b5-f58f-4908-9254-c82b6b28d147';

-- "Riță prăjită Indo-Chineză"
UPDATE posts SET title = 'Orez Prăjit Indo-Chinez' WHERE id = '559721ce-92b9-4a61-967e-680316ea0cd7';

-- ============================================================
-- ADDITIONAL FIXES: Various translation errors
-- ============================================================

-- "Fiept de porc la cuptor cu chimichurri de ierburi și usturoi" — "Fiept" → "Piept"
UPDATE posts SET title = 'Piept de Porc la Cuptor cu Chimichurri de Ierburi și Usturoi' WHERE id = '75ee28a8-d041-4085-a05e-65a3d12cf6fc';

-- "Gachas de Alforfón (Orez Sărac Kazah)" — Alforfón = buckwheat, this is a buckwheat porridge
UPDATE posts SET title = 'Gachas de Alforfón (Terci de Hrișcă Kazah)' WHERE id = '9f0c6cff-2caf-49a8-9741-7db39afa2454';

-- "Bob Chorba (Supă de Haricotii)" — "Haricotii" is wrong; should be "Fasole"
UPDATE posts SET title = 'Bob Chorba (Supă de Fasole)' WHERE id = 'b117340c-a92a-49b6-8433-cb373fb4c22c';

-- "Snert (Supă de Erwturi)" — "Erwturi" is erroneous; Snert = Dutch split pea soup
UPDATE posts SET title = 'Snert (Supă de Mazăre Uscată)' WHERE id = 'f377a941-1012-418a-b715-6657c29896d4';

-- "Sopa de Linte cu Plăinite Verde" — "Plăinite" doesn't exist; Plátano = plantain
UPDATE posts SET title = 'Sopa de Linte cu Plantain Verde' WHERE id = '10967cf4-6256-46dd-af59-63b5c93adcfb';

-- "Supă Cremă de Pui cu Turmă de Ziua Recunostinței" — "Turmă" = herd/flock; this is a turkey soup
UPDATE posts SET title = 'Supă Cremă de Curcan de Ziua Recunoștinței' WHERE id = '4491108c-fefb-4c06-b974-1625582a6c4e';

-- "Tagine cu Pui și Datelor" — "Datelor" (genitive of "data") wrong; dates = curmale
UPDATE posts SET title = 'Tagine cu Pui și Curmale' WHERE id = '0b8268cf-18ae-40db-9073-0326090302a6';

-- "Tajine de Pui cu Fructe Seche" — "Seche" is French, not Romanian; should be "Uscate"
UPDATE posts SET title = 'Tajine de Pui cu Fructe Uscate' WHERE id = '4cacdb3f-b64f-49ac-8cf4-4e0e52b3cd05';

-- "Djaj Mqualli (Tajine de Pollo) cu Fructe Secuțe" — "Secuțe" is nonsense
UPDATE posts SET title = 'Djaj Mqualli (Tajine de Pollo) cu Fructe Uscate' WHERE id = '1d66c8e4-cf43-4880-859c-fd9da3ab1a90';

-- "Vispipuuro: Porumbel de Semolină cu Afine Roșii"
-- Vispipuuro is Finnish whipped semolina pudding; "Porumbel" = pigeon (completely wrong)
UPDATE posts SET title = 'Vispipuuro: Budincă de Griș cu Afine Roșii' WHERE id = 'b7a99e23-b0a5-4188-96e9-a569c89c75b9';

-- "Supă de Champiioni" — typo ("Champiioni" has extra 'i')
UPDATE posts SET title = 'Supă de Ciuperci' WHERE id = '3440a9ab-8846-4e4b-9893-fef97c5ac645';

-- "Curry de Ouă de Păsăr și Inginer" — "Inginer" = engineer (nonsense); likely "Ghimbir" (ginger)
UPDATE posts SET title = 'Curry de Ouă cu Ghimbir' WHERE id = '79887006-208f-4109-83e4-45d5a17c5765';

-- "San Choy Bow (Făclii de varză chinezești)" — "Făclii" = torches; San Choy Bow = lettuce cups
UPDATE posts SET title = 'San Choy Bow (Rulouri de Salată Chinezești)' WHERE id = '681bf214-1e2e-46be-9f32-847d80f2b68f';

-- "Pui Masala la Aeroprenor" — "Aeroprenor" is not a word; should be "Aerogril" (air fryer)
UPDATE posts SET title = 'Pui Masala la Aerogril' WHERE id = 'db5d9cb3-d5aa-41af-907f-899e41141384';

-- "Pui Pulte cu Sos Piri Piri la Slow Cooker" — "Pulte" is not a word; likely "Pulled"
UPDATE posts SET title = 'Pui Desfăcut cu Sos Piri Piri la Slow Cooker' WHERE id = 'e5dee1ba-957e-413e-8839-59a800f655ec';

-- "Pineapple caramelizat în rom cu cremă de cocos" — "Pineapple" untranslated
UPDATE posts SET title = 'Ananas Caramelizat în Rom cu Cremă de Cocos' WHERE id = '784299a1-8342-419e-932c-34a0e8472596';

-- "Escalivada (Rece Spanish Prăjit Vegetables)" — mixed English in parenthetical
UPDATE posts SET title = 'Escalivada (Legume Spaniole la Grătar, Reci)' WHERE id = '922b1c39-a012-452a-b527-59bf5a1f85d1';

-- "Shakshuka (Ouă Poate sau Coapte din Orientul Mijlociu)" — "Ouă Poate" = "Eggs maybe" (wrong)
-- "Poate" is "maybe/perhaps", not "poached". Should be "Pochate" or "Fierte în Sos"
UPDATE posts SET title = 'Shakshuka (Ouă Pochate din Orientul Mijlociu)' WHERE id = '6a022925-1ba4-40b6-8ec2-db8578ed3843';

-- "Cipsuri de Kumara (Pătate Dulci)" — "Pătate" is not standard Romanian; "Cartofi dulci"
UPDATE posts SET title = 'Cipsuri de Kumara (Cartofi Dulci)' WHERE id = 'a8a58af8-268b-4ef4-abcf-27192d404b08';

-- "Eierkoeken (Căni olandeze cu ouă)" — "Căni" = cups/mugs; Eierkoeken = egg cakes/cookies
UPDATE posts SET title = 'Eierkoeken (Prăjiturele Olandeze cu Ouă)' WHERE id = 'b6f26d32-93a3-4f23-9a24-fbb6af37ce36';

-- "Crocant Porc Belly Banh Mi" — mixed English; should be Romanian main descriptor
UPDATE posts SET title = 'Banh Mi cu Burtă de Porc Crocantă' WHERE id = '417ab2bd-2f2a-414c-80af-cfe9b4f81795';

-- "Crocant red mullet orez cu aioli safranat și salsa de lămâie și măsline"
UPDATE posts SET title = 'Barbun Crocant cu Orez, Aioli Șofrănat și Salsa de Lămâie cu Măsline' WHERE id = '09422077-ed34-4a23-b9dd-acca71361fa6';

-- "Crocant Shredded Pui Noodle Stir Fry" — mostly English
UPDATE posts SET title = 'Stir Fry cu Pui Crocant Tocat și Tăiței' WHERE id = 'b511c5ba-70e0-4cc3-b82b-32ba0dc71683';

-- "Bun Cha - Mingi de Carne de Porc Vietnamiene" — "Mingi" = balls (sport balls), not standard for meatballs
UPDATE posts SET title = 'Bun Cha - Chiftele de Porc Vietnamiene' WHERE id = '118edafb-7678-4671-b57c-441e947a59b1';

-- "Fajitas cu Pui și Turmuri River Hill Farms" — "Turmuri" is nonsense (possible mistranslation of "Turme")
UPDATE posts SET title = 'Fajitas cu Pui de la River Hill Farms' WHERE id = '3c6f9767-5650-4e37-91a3-841f9d5f3dc3';

-- "Sofritu Spaniol" — "Sofritu" is a misspelling of "Sofrito"
UPDATE posts SET title = 'Sofrito Spaniol' WHERE id = '06a67911-897a-4245-9521-ba91d54c0e3f';

-- "Mâncărură tradițională Maldiviană" — "Mâncărură" is non-standard (should be "Mâncare")
UPDATE posts SET title = 'Mas Huni - Mâncare Tradițională Maldiviană' WHERE id = '08a12f36-509d-4a34-9776-8d54d60ffd08';

-- "Tave Me Presh (Mâncărură Albaneză cu Carne de Vită și Praz)"
UPDATE posts SET title = 'Tave Me Presh (Mâncare Albaneză cu Carne de Vită și Praz)' WHERE id = 'd594ac16-256d-48c1-8438-b55fee60e846';

-- "Carpaccio de Nepe" — "Nepe" is not a word; likely "Nap" (turnip) or typo
UPDATE posts SET title = 'Carpaccio de Nap' WHERE id = '99c5ee77-2682-4fe5-bbb7-d097a0719aac';

-- "Pimientos Rellenos Bulari (Ardei Umpluți Bulgari)" — "Bulari" is wrong Spanish (Búlgaros)
UPDATE posts SET title = 'Pimientos Rellenos Búlgaros (Ardei Umpluți Bulgari)' WHERE id = 'feb399cc-0b12-41c3-a525-d52b206aae73';

-- "Chimișuri de creveți Quesadillas" — "Chimișuri" is not a word, redundant with Quesadillas
UPDATE posts SET title = 'Quesadillas cu Creveți' WHERE id = 'a16004cd-4c08-42ad-b00a-a55079f0959b';

-- ============================================================
-- DUPLICATE TITLES — flagged for review (same title, different IDs)
-- These are likely recipe duplicates to investigate and potentially merge
-- ============================================================

-- Albănișori cu carne de pui și sos de guava (2 identical recipes)
-- IDs: a82b3c70-48e8-43a8-a630-b1d335fd053b, 36929e7c-12b3-4505-84dd-d4ad246f0e43

-- Arroz con Pollo (2 identical recipes)
-- IDs: 14bc92a5-bac4-4f20-95a0-fff9fed9c51a, 234a8f6d-a79c-4d48-8e02-544360081c7f

-- Biscuiți ANZAC (2 identical recipes)
-- IDs: f69369c8-a462-4cbb-b50f-50af4a826292, 3848c6e2-3b6c-46b6-9282-5b76a753f4cc

-- Kibbeh (2 identical recipes)
-- IDs: 117e829c-2b88-4ba0-9923-9e189137bd80, 96e97a3a-acaa-4470-8c26-bcad1e6690ed

-- Supă de Dovleac (3 identical recipes)
-- IDs: 3446bb3b-96bf-459b-a8c9-143366edadf6, 5a4870fd-83c1-4dcb-add8-9cd9c21d4480, de49c538-c985-4efc-bb82-6d937f9f3a12

-- Turciele de Pui cu Umplutură de Carne (already fixed to Rulouri above, both IDs)
-- IDs: 94f99b2f-7a9a-4917-8b03-c5c6bed3c8d5, 7611a910-61fb-4c31-af8d-a17229cf7e1f
