/**
 * Cleanup: delete ALL properties and all associated data
 * Keeps organisations and user accounts intact.
 * Run: node packages/db/cleanup-all-properties.mjs
 */

import pg from "pg"

const { Client } = pg
const DB_URL = "postgresql://postgres:FunkyMOnkey12!@db.rknlnelrmrhorsijigtc.supabase.co:5432/postgres"

async function main() {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  console.log("Connected\n")

  const { rows: props } = await client.query(`SELECT id, name FROM properties`)
  console.log(`Found ${props.length} properties to remove:`)
  props.forEach(p => console.log(`  - ${p.name} (${p.id})`))
  console.log()

  // Delete in FK-safe order
  const { rowCount: fb } = await client.query(`DELETE FROM feedback`)
  console.log(`✓ Deleted ${fb} feedback entries`)

  const { rowCount: fp } = await client.query(`DELETE FROM feedback_fingerprints`)
  console.log(`✓ Deleted ${fp} fingerprints`)

  const { rowCount: ai } = await client.query(`DELETE FROM ai_daily_summaries`)
  console.log(`✓ Deleted ${ai} AI summaries`)

  const { rowCount: dc } = await client.query(`DELETE FROM dashboard_cache`)
  console.log(`✓ Deleted ${dc} dashboard cache entries`)

  const { rowCount: lc } = await client.query(`DELETE FROM leaderboard_cache`)
  console.log(`✓ Deleted ${lc} leaderboard cache entries`)

  const { rowCount: pt } = await client.query(`DELETE FROM property_tiers`)
  console.log(`✓ Deleted ${pt} tier records`)

  // online_reviews_cache — ignore if table doesn't exist
  try {
    const { rowCount: orc } = await client.query(`DELETE FROM online_reviews_cache`)
    console.log(`✓ Deleted ${orc} online reviews cache entries`)
  } catch { console.log("  (no online_reviews_cache table — skipped)") }

  const { rowCount: qr } = await client.query(`DELETE FROM qr_codes`)
  console.log(`✓ Deleted ${qr} QR codes`)

  const { rowCount: pr } = await client.query(`DELETE FROM properties`)
  console.log(`✓ Deleted ${pr} properties`)

  console.log("\nDatabase is clean. Organisations and users untouched.")
  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
