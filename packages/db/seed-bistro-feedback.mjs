/**
 * Seed script: inserts 100 realistic dummy feedback entries for The Bistro
 * Spread across the last 90 days with a slight upward trend
 * Run: node scripts/seed-bistro-feedback.mjs
 */

import pg from "pg"
import { randomUUID } from "crypto"

const { Client } = pg

const DB_URL = "postgresql://postgres:FunkyMOnkey12!@db.rknlnelrmrhorsijigtc.supabase.co:5432/postgres"

const STAFF_NAMES = ["Sarah", "James", "Maria", "Tom", "Priya", "Leo", "Chloe", "Ravi"]
const ADJECTIVES = [
  "welcoming", "attentive", "warm", "exceptional", "friendly", "cosy",
  "professional", "charming", "efficient", "delightful", "memorable", "genuine"
]
const MEAL_TIMES = ["morning", "lunch", "dinner", "dinner", "lunch", "dinner"] // dinner-weighted
const VENT_TEXTS = [
  "Waiting time was a bit long but the food made up for it.",
  "Could do with more seating options near the window.",
  "Service was excellent but the music was a little loud.",
  null, null, null, null, null, null, null, // mostly no vent text
]

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function weightedScore(dayIndex, totalDays) {
  // Early days: slightly lower scores (6-9). Later days: slightly higher (7-10)
  const progress = dayIndex / totalDays
  const base = 6 + Math.round(progress * 1.5) // 6→7.5 over time
  const jitter = rand(-1, 2)
  return Math.min(10, Math.max(5, base + jitter))
}

function randomAdjectives() {
  const count = rand(1, 3)
  const shuffled = [...ADJECTIVES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).join(",")
}

async function main() {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  console.log("Connected to database")

  // Find the bistro property
  const { rows: props } = await client.query(
    `SELECT id, name FROM properties WHERE LOWER(name) LIKE '%bistro%' LIMIT 5`
  )

  if (props.length === 0) {
    console.error("No property found with 'bistro' in the name")
    await client.end()
    process.exit(1)
  }

  console.log("Found properties:")
  props.forEach((p, i) => console.log(`  [${i}] ${p.name} — ${p.id}`))

  const property = props[0]
  console.log(`\nUsing: ${property.name} (${property.id})`)

  // Find a QR code for this property (optional)
  const { rows: qrRows } = await client.query(
    `SELECT id FROM qr_codes WHERE property_id = $1 LIMIT 1`,
    [property.id]
  )
  const qrCodeId = qrRows[0]?.id ?? null
  console.log(`QR code: ${qrCodeId ?? "none — will insert without"}`)

  // Generate 100 feedback records
  const NOW = Date.now()
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
  const records = []

  for (let i = 0; i < 100; i++) {
    // Spread evenly but with some randomness
    const dayIndex = Math.floor((i / 100) * 90)
    const jitterMs = rand(0, 24 * 60 * 60 * 1000) // up to 1 day jitter
    const submittedAt = new Date(NOW - NINETY_DAYS_MS + dayIndex * 24 * 60 * 60 * 1000 + jitterMs)

    const resilience = weightedScore(dayIndex, 90)
    const empathy = weightedScore(dayIndex, 90)
    const anticipation = weightedScore(dayIndex, 90)
    const recognition = weightedScore(dayIndex, 90)
    const gcs = ((resilience + empathy + anticipation + recognition) / 4).toFixed(2)

    const allSame = resilience === empathy && empathy === anticipation && anticipation === recognition

    const includeStaff = Math.random() < 0.35
    const includeAdj = Math.random() < 0.7
    const ventText = VENT_TEXTS[rand(0, VENT_TEXTS.length - 1)]

    records.push({
      id: randomUUID(),
      propertyId: property.id,
      qrCodeId,
      resilience,
      empathy,
      anticipation,
      recognition,
      gcs,
      mealTime: MEAL_TIMES[rand(0, MEAL_TIMES.length - 1)],
      source: "qr_form",
      namedStaffMember: includeStaff ? STAFF_NAMES[rand(0, STAFF_NAMES.length - 1)] : null,
      ventText: Number(gcs) < 7 ? ventText : null, // only include vent text on lower scores
      adjectives: includeAdj ? randomAdjectives() : null,
      guestEmail: null,
      isUniformScore: allSame,
      seenByOwner: true, // mark as seen so they don't flood the alert badge
      submittedAt,
    })
  }

  // Insert all at once
  console.log(`\nInserting ${records.length} feedback records...`)

  for (const r of records) {
    await client.query(
      `INSERT INTO feedback (
        id, property_id, qr_code_id,
        resilience, empathy, anticipation, recognition, gcs,
        meal_time, source, named_staff_member, vent_text,
        adjectives, guest_email, is_uniform_score, seen_by_owner,
        submitted_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16, $17
      )`,
      [
        r.id, r.propertyId, r.qrCodeId,
        r.resilience, r.empathy, r.anticipation, r.recognition, r.gcs,
        r.mealTime, r.source, r.namedStaffMember, r.ventText,
        r.adjectives, r.guestEmail, r.isUniformScore, r.seenByOwner,
        r.submittedAt,
      ]
    )
  }

  const avgGcs = (records.reduce((s, r) => s + Number(r.gcs), 0) / records.length).toFixed(2)
  console.log(`Done. Inserted 100 records.`)
  console.log(`Average GCS: ${avgGcs} — spread from ${new Date(NOW - NINETY_DAYS_MS).toDateString()} to today`)

  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
