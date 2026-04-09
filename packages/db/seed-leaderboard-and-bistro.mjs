/**
 * Seed: 10 London competitor properties + rich Bistro dashboard data (3 months)
 * Run: node packages/db/seed-leaderboard-and-bistro.mjs
 */

import pg from "pg"
import { randomUUID } from "crypto"

const { Client } = pg
const DB_URL = "postgresql://postgres:FunkyMOnkey12!@db.rknlnelrmrhorsijigtc.supabase.co:5432/postgres"

const BISTRO_ID    = "8f447da9-1dda-483d-bd39-fb0d5f514f1d"
const ORG_ID       = "517d6c3f-d059-41ab-adf3-e0fb719d341e"
const CITY         = "London"

// ── Competitor properties ─────────────────────────────────────────────────────
// Each has a target avg GCS (0-10) and submission count for 3 months
const COMPETITORS = [
  { name: "The Langham Brasserie",  type: "restaurant", targetGcs: 9.1, count: 214 },
  { name: "Ember Rooftop Bar",      type: "restaurant", targetGcs: 8.7, count: 178 },
  { name: "Foxglove Hotel",         type: "hotel",      targetGcs: 8.4, count: 302 },
  { name: "Salt & Slate",           type: "restaurant", targetGcs: 8.1, count: 143 },
  // Bistro will sit around 8.0 — ranked ~5th
  { name: "The Harbourside Inn",    type: "hotel",      targetGcs: 7.6, count: 89  },
  { name: "Copper Kettle Cafe",     type: "restaurant", targetGcs: 7.3, count: 67  },
  { name: "Meridian Hotel",         type: "hotel",      targetGcs: 7.1, count: 118 },
  { name: "The Quayside",           type: "restaurant", targetGcs: 6.8, count: 54  },
  { name: "Bluebell Guest House",   type: "hotel",      targetGcs: 6.4, count: 41  },
  { name: "Grange Park Kitchen",    type: "restaurant", targetGcs: 5.9, count: 29  },
]

// ── Bistro-specific data ──────────────────────────────────────────────────────
const BISTRO_STAFF  = ["Sarah", "James", "Maria", "Tom", "Priya", "Leo", "Chloe", "Ravi"]
const ADJECTIVES    = ["welcoming","attentive","warm","exceptional","friendly","professional","charming","efficient","delightful","memorable","genuine","impressive"]
const MEAL_TIMES    = ["morning","lunch","dinner","dinner","dinner","lunch","dinner"]
const VENT_TEXTS    = [
  "Waiting time was a little long but the food made up for it.",
  "Could do with more seating near the window.",
  "Service was excellent but the music was a touch loud.",
  null, null, null, null, null, null, null,
]

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick(arr) { return arr[rand(0, arr.length - 1)] }

// Generate a score centred on a target with natural spread
function scoreAround(target, spread = 1.2) {
  return Math.min(10, Math.max(4, Math.round(target + (Math.random() - 0.5) * spread * 2)))
}

function randomAdj() {
  const count = rand(1, 3)
  return [...ADJECTIVES].sort(() => Math.random() - 0.5).slice(0, count).join(",")
}

// Linear upward trend: earlier entries score lower, recent ones higher
function trendedScore(dayIndex, totalDays, targetAvg) {
  const progress  = dayIndex / totalDays
  const trended   = (targetAvg - 0.8) + progress * 1.6  // ±0.8 across the period
  return scoreAround(trended, 0.8)
}

async function main() {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  console.log("Connected\n")

  const NOW     = Date.now()
  const DAYS_90 = 90 * 24 * 60 * 60 * 1000

  // ── 1. Create 10 competitor properties ───────────────────────────────────────
  console.log("Creating competitor properties…")
  const competitorIds = []

  for (const c of COMPETITORS) {
    const id = randomUUID()
    competitorIds.push({ id, ...c })
    await client.query(
      `INSERT INTO properties (
        id, organisation_id, name, city, country, type,
        status, payment_status, owner_email, owner_name
      ) VALUES ($1,$2,$3,$4,'United Kingdom',$5,'approved','paid',$6,$7)
      ON CONFLICT (id) DO NOTHING`,
      [id, ORG_ID, c.name, CITY, c.type, "demo@intuitivestay.com", "Demo Owner"]
    )
  }
  console.log(`✓ ${competitorIds.length} competitor properties created`)

  // ── 2. Insert feedback for each competitor ────────────────────────────────────
  console.log("Inserting competitor feedback…")
  let totalCompetitorFeedback = 0

  for (const comp of competitorIds) {
    for (let i = 0; i < comp.count; i++) {
      const dayIndex   = Math.floor((i / comp.count) * 90)
      const jitter     = rand(0, 23 * 3600 * 1000)
      const submittedAt = new Date(NOW - DAYS_90 + dayIndex * 86400000 + jitter)

      const r   = trendedScore(dayIndex, 90, comp.targetGcs)
      const e   = trendedScore(dayIndex, 90, comp.targetGcs)
      const a   = trendedScore(dayIndex, 90, comp.targetGcs)
      const rec = trendedScore(dayIndex, 90, comp.targetGcs)
      const gcs = ((r + e + a + rec) / 4).toFixed(2)

      await client.query(
        `INSERT INTO feedback (
          id, property_id, resilience, empathy, anticipation, recognition, gcs,
          meal_time, source, is_uniform_score, seen_by_owner, submitted_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'qr_form',$9,true,$10)`,
        [randomUUID(), comp.id, r, e, a, rec, gcs,
          pick(MEAL_TIMES), r===e&&e===a&&a===rec, submittedAt]
      )
      totalCompetitorFeedback++
    }
  }
  console.log(`✓ ${totalCompetitorFeedback} competitor feedback entries inserted`)

  // ── 3. Insert rich Bistro dashboard data ─────────────────────────────────────
  // Get the Bistro QR code
  const { rows: qrRows } = await client.query(
    `SELECT id FROM qr_codes WHERE property_id = $1 LIMIT 1`, [BISTRO_ID]
  )
  const qrCodeId = qrRows[0]?.id ?? null

  console.log("\nInserting Bistro feedback (90 days, ~110 entries)…")

  // Target: GCS avg ~8.0, trending from ~7.2 → ~8.6
  const BISTRO_COUNT = 110
  for (let i = 0; i < BISTRO_COUNT; i++) {
    const dayIndex    = Math.floor((i / BISTRO_COUNT) * 90)
    const jitter      = rand(0, 20 * 3600 * 1000)
    const submittedAt = new Date(NOW - DAYS_90 + dayIndex * 86400000 + jitter)

    const r   = trendedScore(dayIndex, 90, 8.0)
    const e   = trendedScore(dayIndex, 90, 7.8)
    const a   = trendedScore(dayIndex, 90, 8.3)
    const rec = trendedScore(dayIndex, 90, 7.9)
    const gcs = ((r + e + a + rec) / 4).toFixed(2)
    const allSame = r===e&&e===a&&a===rec

    // 40% of entries name a staff member, cycling through all 8
    const namedStaff = i % 3 !== 0 ? null : BISTRO_STAFF[i % BISTRO_STAFF.length]
    // 70% include adjectives
    const adjectives  = Math.random() < 0.7 ? randomAdj() : null
    // Vent text only on lower scores
    const ventText    = Number(gcs) < 6.5 ? pick(VENT_TEXTS) : null

    await client.query(
      `INSERT INTO feedback (
        id, property_id, qr_code_id,
        resilience, empathy, anticipation, recognition, gcs,
        meal_time, source, named_staff_member, vent_text,
        adjectives, is_uniform_score, seen_by_owner, submitted_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'qr_form',$10,$11,$12,$13,true,$14)`,
      [randomUUID(), BISTRO_ID, qrCodeId,
        r, e, a, rec, gcs,
        pick(MEAL_TIMES), namedStaff, ventText,
        adjectives, allSame, submittedAt]
    )
  }
  console.log(`✓ ${BISTRO_COUNT} Bistro feedback entries inserted`)

  // ── 4. Clear caches so dashboard recomputes from fresh data ──────────────────
  await client.query(`DELETE FROM dashboard_cache WHERE property_id = $1`, [BISTRO_ID])
  await client.query(`DELETE FROM leaderboard_cache WHERE city = $1`, [CITY])
  console.log("✓ Caches cleared")

  // ── 5. Summary ───────────────────────────────────────────────────────────────
  const { rows: bistroStats } = await client.query(
    `SELECT COUNT(*) as count, ROUND(AVG(gcs)::numeric, 2) as avg_gcs
     FROM feedback WHERE property_id = $1`, [BISTRO_ID]
  )
  console.log(`\nBistro: ${bistroStats[0].count} entries, avg GCS ${bistroStats[0].avg_gcs}/10`)
  console.log(`Leaderboard: ${COMPETITORS.length + 1} London properties`)
  console.log("\nAll done — ready to screenshot!")

  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
