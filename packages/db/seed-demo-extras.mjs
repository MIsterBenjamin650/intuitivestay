/**
 * Seed script: adds today's feedback (24h visible), leaderboard competitors, and fixes AI summary
 * Run: node packages/db/seed-demo-extras.mjs
 */

import pg from "pg"
import { randomUUID } from "crypto"

const { Client } = pg
const DB_URL = "postgresql://postgres:FunkyMOnkey12!@db.rknlnelrmrhorsijigtc.supabase.co:5432/postgres"

const STAFF_NAMES = ["Sarah", "James", "Maria", "Tom", "Priya", "Leo", "Chloe", "Ravi"]
const MEAL_TIMES = ["morning", "lunch", "dinner", "dinner", "dinner", "lunch"]
const ADJECTIVES_POOL = [
  "welcoming", "attentive", "warm", "exceptional", "friendly", "cosy",
  "professional", "charming", "efficient", "delightful", "memorable", "genuine"
]

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick(arr) { return arr[rand(0, arr.length - 1)] }

function score(base) {
  return Math.min(10, Math.max(6, base + rand(-1, 2)))
}

function randomAdj() {
  const count = rand(1, 3)
  return [...ADJECTIVES_POOL].sort(() => Math.random() - 0.5).slice(0, count).join(",")
}

async function main() {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  console.log("Connected")

  // Find The Bistro
  const { rows: props } = await client.query(
    `SELECT id, name, city FROM properties WHERE LOWER(name) LIKE '%bistro%' LIMIT 1`
  )
  if (!props.length) { console.error("Bistro not found"); process.exit(1) }
  const property = props[0]
  console.log(`Property: ${property.name} (${property.id}) — city: ${property.city}`)

  const { rows: qrRows } = await client.query(
    `SELECT id FROM qr_codes WHERE property_id = $1 LIMIT 1`, [property.id]
  )
  const qrCodeId = qrRows[0]?.id ?? null

  // ── 1. Insert 25 feedback entries from last 24h ──────────────────────────────
  console.log("\nInserting 25 feedback entries for last 24h...")
  const NOW = Date.now()
  const DAY_MS = 24 * 60 * 60 * 1000

  for (let i = 0; i < 25; i++) {
    // Spread across last 23 hours so they're all within 24h window
    const submittedAt = new Date(NOW - rand(0, DAY_MS - 3600000))

    // Make sure we get all 8 staff names represented
    const namedStaffMember = STAFF_NAMES[i % STAFF_NAMES.length]

    const r = score(8), e = score(8), a = score(9), rec = score(8)
    const gcs = ((r + e + a + rec) / 4).toFixed(2)
    const allSame = r === e && e === a && a === rec

    await client.query(
      `INSERT INTO feedback (
        id, property_id, qr_code_id,
        resilience, empathy, anticipation, recognition, gcs,
        meal_time, source, named_staff_member, vent_text,
        adjectives, guest_email, is_uniform_score, seen_by_owner,
        submitted_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        randomUUID(), property.id, qrCodeId,
        r, e, a, rec, gcs,
        pick(MEAL_TIMES), "qr_form", namedStaffMember, null,
        randomAdj(), null, allSame, true,
        submittedAt,
      ]
    )
  }
  console.log("✓ 25 feedback entries inserted")

  // ── 2. Update AI summary to include Recognition ──────────────────────────────
  console.log("\nUpdating AI summary to include Recognition...")
  const { rows: summaryRows } = await client.query(
    `SELECT id, focus_points FROM ai_daily_summaries
     WHERE property_id = $1
     ORDER BY date DESC LIMIT 1`,
    [property.id]
  )

  if (summaryRows.length) {
    const existingPoints = summaryRows[0].focus_points
    const hasRecognition = existingPoints.some(p => p.pillar.toLowerCase() === "recognition")

    if (!hasRecognition) {
      const updatedPoints = [
        ...existingPoints,
        {
          pillar: "Recognition",
          action: "Celebrate standout moments publicly — a brief team shout-out at shift start reinforces the behaviours guests are noticing."
        }
      ]
      await client.query(
        `UPDATE ai_daily_summaries SET focus_points = $1 WHERE id = $2`,
        [JSON.stringify(updatedPoints), summaryRows[0].id]
      )
      console.log("✓ Recognition added to AI summary focus points")
    } else {
      console.log("✓ Recognition already present in AI summary")
    }
  } else {
    console.log("No AI summary found to update")
  }

  // ── 3. Inject leaderboard competitors ────────────────────────────────────────
  console.log("\nInjecting leaderboard competitors...")

  const city = property.city || "Bristol"

  // Create 6 dummy competitor entries with plausible GCS scores
  const competitors = [
    { avgGcs: 8.9, submissions: 143, rank: 1 },
    { avgGcs: 8.6, submissions: 97, rank: 2 },
    { avgGcs: 8.2, submissions: 211, rank: 3 },
    // Bistro will slot in here at rank 4 (its avg ~7.1)
    { avgGcs: 6.8, submissions: 54, rank: 5 },
    { avgGcs: 6.4, submissions: 38, rank: 6 },
    { avgGcs: 5.9, submissions: 22, rank: 7 },
  ]

  const fakeIds = competitors.map(() => randomUUID())

  const allRows = [
    ...competitors.slice(0, 3).map((c, i) => ({
      propertyId: fakeIds[i],
      avgGcs: c.avgGcs,
      avgResilience: c.avgGcs - 0.2 + Math.random() * 0.4,
      avgEmpathy: c.avgGcs - 0.3 + Math.random() * 0.5,
      avgAnticipation: c.avgGcs + Math.random() * 0.3,
      avgRecognition: c.avgGcs - 0.1 + Math.random() * 0.3,
      submissions: c.submissions,
      rank: c.rank,
    })),
    {
      propertyId: property.id,
      avgGcs: 7.15,
      avgResilience: 7.2,
      avgEmpathy: 6.9,
      avgAnticipation: 7.4,
      avgRecognition: 7.1,
      submissions: 125,
      rank: 4,
    },
    ...competitors.slice(3).map((c, i) => ({
      propertyId: fakeIds[3 + i],
      avgGcs: c.avgGcs,
      avgResilience: c.avgGcs - 0.2 + Math.random() * 0.4,
      avgEmpathy: c.avgGcs - 0.3 + Math.random() * 0.5,
      avgAnticipation: c.avgGcs + Math.random() * 0.3,
      avgRecognition: c.avgGcs - 0.1 + Math.random() * 0.3,
      submissions: c.submissions,
      rank: c.rank,
    })),
  ]

  const cityAvg = allRows.reduce((s, r) => s + r.avgGcs, 0) / allRows.length
  const payload = { rows: allRows, cityAvg, totalCount: allRows.length }

  await client.query(
    `INSERT INTO leaderboard_cache (city, data, cached_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (city) DO UPDATE SET data = $2, cached_at = $3`,
    [city, JSON.stringify(payload), new Date(Date.now() + 23 * 60 * 60 * 1000)] // expire in 23h so it stays cached
  )
  console.log(`✓ Leaderboard cache updated — ${allRows.length} properties, city avg ${cityAvg.toFixed(2)}, Bistro ranked #4`)

  await client.end()
  console.log("\nAll done!")
}

main().catch(e => { console.error(e); process.exit(1) })
