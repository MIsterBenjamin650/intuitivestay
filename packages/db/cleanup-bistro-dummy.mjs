/**
 * Cleanup script: removes all dummy data seeded for The Bistro
 * Run: node packages/db/cleanup-bistro-dummy.mjs
 */

import pg from "pg"

const { Client } = pg
const DB_URL = "postgresql://postgres:FunkyMOnkey12!@db.rknlnelrmrhorsijigtc.supabase.co:5432/postgres"

async function main() {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  console.log("Connected")

  const { rows: props } = await client.query(
    `SELECT id, name, city FROM properties WHERE LOWER(name) LIKE '%bistro%' LIMIT 1`
  )
  if (!props.length) { console.error("Bistro not found"); process.exit(1) }
  const property = props[0]
  console.log(`Property: ${property.name} (${property.id}) — city: ${property.city}`)

  // 1. Delete all feedback for The Bistro
  const { rowCount: feedbackDeleted } = await client.query(
    `DELETE FROM feedback WHERE property_id = $1`, [property.id]
  )
  console.log(`✓ Deleted ${feedbackDeleted} feedback entries`)

  // 2. Delete feedback fingerprints for The Bistro
  const { rowCount: fingerprintsDeleted } = await client.query(
    `DELETE FROM feedback_fingerprints WHERE property_id = $1`, [property.id]
  )
  console.log(`✓ Deleted ${fingerprintsDeleted} fingerprints`)

  // 3. Clear the leaderboard cache for this city
  const { rowCount: cacheDeleted } = await client.query(
    `DELETE FROM leaderboard_cache WHERE city = $1`, [property.city]
  )
  console.log(`✓ Cleared leaderboard cache for ${property.city}`)

  // 4. Clear dashboard cache for The Bistro
  const { rowCount: dashDeleted } = await client.query(
    `DELETE FROM dashboard_cache WHERE property_id = $1`, [property.id]
  )
  console.log(`✓ Cleared ${dashDeleted} dashboard cache entries`)

  // 5. Delete AI daily summaries for The Bistro
  const { rowCount: aiDeleted } = await client.query(
    `DELETE FROM ai_daily_summaries WHERE property_id = $1`, [property.id]
  )
  console.log(`✓ Deleted ${aiDeleted} AI summary entries`)

  // 6. Delete property tier data so it resets cleanly
  const { rowCount: tierDeleted } = await client.query(
    `DELETE FROM property_tiers WHERE property_id = $1`, [property.id]
  )
  console.log(`✓ Cleared ${tierDeleted} tier records`)

  console.log(`\nAll dummy data removed. The Bistro is clean for testing.`)
  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
