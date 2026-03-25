-- ============================================================
-- fix-grammar-corrections.sql
-- Re-corrections after verifying all 99 grammar fixes applied via fix-grammar.sql
-- Generated: 2026-03-26
-- Verified by: querying recipe_json (ingredients + steps) for all 99 recipes
-- ============================================================
--
-- SUMMARY OF VERIFICATION:
--   99 corrections applied in fix-grammar.sql
--   94 verified correct (title accurately describes the dish)
--    5 need re-correction (title is factually wrong based on recipe content)
--
-- ISSUES FOUND:
--
-- 1. f6466e8e — "Miel Mongol la Grătar": recipe uses WOK stir-fry technique
--    (hoisin sauce, sambal oelak, cornstarch coating, "Gătiți ... într-o wok").
--    "la Grătar" = grilled. Correct: "la Wok".
--
-- 2. 94f99b2f and 7611a910 — "Rulouri de Pui cu Umplutură de Carne": both
--    recipes use pastry dough ("aluat de turcie") and are baked as a covered pie.
--    Steps say "Pregătiți aluatul de turcie ... Acoperiți turciele cu restul de aluat".
--    These are CHICKEN POT PIES, not rolls. "Turciele" was likely a mistranslation
--    of "turnovers" or "turkey pie". Correct: "Plăcintă de Pui cu Umplutură de Carne".
--
-- 3. 3479290c — "(Pavo a lo criollo) Curcan Afumat în Stil Creol de Crăciun sau
--    Ziua Recunoștinței": recipe is entirely oven-roasted (cuptorul la 200°C, coaceți).
--    No smoking involved. "Afumat" = smoked (factually wrong).
--    Correct: "Curcan Fript în Stil Creol de Crăciun sau Ziua Recunoștinței".
--
-- 4. e5dee1ba — "Pui Desfăcut cu Sos Piri Piri la Slow Cooker": ingredients list
--    "4 kg pulpă de porc (picnic șuncă)"; steps say "Se asezonează carnea de porc".
--    It is PORK, not chicken (pui). Correct: "Porc Desfăcut cu Sos Piri Piri la Slow Cooker".
--
-- 5. d99cf726 — "Rulouri Italienești cu Piept de Pui": steps explicitly say
--    "Formează chiftele de aproximativ 2,5 cm diametru" and they are pan-fried then
--    simmered in tomato sauce. These are MEATBALLS, not rolls (rulouri).
--    Correct: "Chiftele Italienești cu Piept de Pui".
--
-- NOTE ON 98c088e5 ("Cartofi Prăjiți Grecești"):
--    The recipe is oven-baked (cuptorul la 220°C), not pan-fried. "Prăjiți" is
--    technically imprecise. However, the original "Fripturi Grecești" was clearly
--    wrong. "Cartofi Prăjiți Grecești" is an acceptable colloquial term in Romanian
--    for oven-cooked potato wedges/fries. No re-correction applied.
-- ============================================================

-- 1. Miel Mongol: stir-fried in wok, NOT grilled
UPDATE posts SET title = 'Miel Mongol la Wok' WHERE id = 'f6466e8e-6579-45a6-bc21-afeec31ca674';

-- 2a. Rulouri de Pui #1: actually a chicken pot pie with pastry dough
UPDATE posts SET title = 'Plăcintă de Pui cu Umplutură de Carne' WHERE id = '94f99b2f-7a9a-4917-8b03-c5c6bed3c8d5';

-- 2b. Rulouri de Pui #2: same issue — pastry-covered pie, not rolls
UPDATE posts SET title = 'Plăcintă de Pui cu Umplutură de Carne' WHERE id = '7611a910-61fb-4c31-af8d-a17229cf7e1f';

-- 3. Pavo a lo criollo: oven-roasted (coaceți), NOT smoked (afumat)
UPDATE posts SET title = '(Pavo a lo criollo) Curcan Fript în Stil Creol de Crăciun sau Ziua Recunoștinței' WHERE id = '3479290c-cf8b-40d9-ae0e-c2c1871f843f';

-- 4. Piri Piri slow cooker: ingredients and steps confirm PORK (pulpă de porc), not chicken
UPDATE posts SET title = 'Porc Desfăcut cu Sos Piri Piri la Slow Cooker' WHERE id = 'e5dee1ba-957e-413e-8839-59a800f655ec';

-- 5. Italian "rolls" with chicken: steps say "Formează chiftele" — these are MEATBALLS
UPDATE posts SET title = 'Chiftele Italienești cu Piept de Pui' WHERE id = 'd99cf726-d3ea-4d13-b171-e571c1abaaac';
