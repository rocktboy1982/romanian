#!/usr/bin/env node
const { Client } = require('pg');
const { randomUUID } = require('crypto');

const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });

async function main() {
  await client.connect();

  const cuisineRow = await client.query("SELECT id FROM cuisines WHERE name = 'Lithuania'");
  const cuisineId = cuisineRow.rows[0].id;
  const profileId = 'c0000000-0000-0000-0000-000000000145';
  const recipeId = randomUUID();
  const postId = randomUUID();
  const approachId = 'b0000000-0000-0000-0000-000000000001';

  const ingredients = [
    '300g plain biscuits, crushed',
    '100g butter, melted',
    '4 tbsp cocoa powder',
    '1/2 cup sugar',
    '1/2 cup milk',
    '1 tsp vanilla extract',
    '1/2 cup walnuts, chopped'
  ];
  const instructions = [
    'Crush biscuits into coarse crumbs in a large bowl.',
    'Heat milk and sugar in a saucepan until sugar dissolves. Add butter and cocoa powder, stir until smooth.',
    'Remove from heat, stir in vanilla. Pour mixture over crushed biscuits and mix well.',
    'Fold in chopped walnuts.',
    'Transfer mixture onto a sheet of cling film, shape into a log and wrap tightly.',
    'Refrigerate for at least 3 hours until firm. Slice and serve cold.'
  ];

  const rr = await client.query(
    `INSERT INTO recipes (id, title, slug, summary, description, ingredients, instructions,
      prep_time_minutes, cook_time_minutes, servings, difficulty_level, image_url, approach_id, created_by, cuisine_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (slug) DO NOTHING RETURNING id`,
    [
      recipeId, 'Tinginys', 'lithuania-tinginys',
      'Lithuanian no-bake chocolate biscuit log',
      "Tinginys (meaning 'lazy man') is Lithuania's beloved no-bake dessert of crushed biscuits, cocoa and butter set into a log and sliced cold.",
      ingredients, instructions,
      15, 0, 10, 'easy', '', approachId, profileId, cuisineId
    ]
  );
  console.log('Recipe inserted:', rr.rowCount);

  const pr = await client.query(
    `INSERT INTO posts (id, title, slug, content, type, created_by, quality_score, status)
     VALUES ($1,$2,$3,$4,'recipe',$5,10,'published')
     ON CONFLICT (slug) DO NOTHING RETURNING id`,
    [postId, 'Tinginys', 'lithuania-tinginys', "Lithuanian no-bake chocolate biscuit log.", profileId]
  );
  console.log('Post inserted:', pr.rowCount);

  const verify = await client.query(
    "SELECT COUNT(*) FROM recipes r JOIN cuisines c ON r.cuisine_id = c.id WHERE c.name = 'Lithuania'"
  );
  console.log('Lithuania recipes now:', verify.rows[0].count);

  await client.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
