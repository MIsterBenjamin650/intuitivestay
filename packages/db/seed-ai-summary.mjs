/**
 * Seed: Insert a dummy AI summary for The Bistro
 * Run: node packages/db/seed-ai-summary.mjs
 */

import pg from "pg"
import { randomUUID } from "crypto"

const { Client } = pg
const DB_URL = "postgresql://postgres:FunkyMOnkey12!@db.rknlnelrmrhorsijigtc.supabase.co:5432/postgres"

const BISTRO_ID = "8f447da9-1dda-483d-bd39-fb0d5f514f1d"

const NARRATIVE = `This week The Bistro continued its upward trajectory, reaching an average GCS of 8.1 — your strongest 7-day period to date. Guests are consistently noting warmth and attentiveness from your team, with Anticipation scoring highest across all service periods. Dinner service is your standout, with a 94% positive response rate. The most frequently used guest words this week were "welcoming", "attentive", and "delightful", reflecting a team that is performing at a high level. Staff member Sarah received 11 named mentions, the most of any team member. One area to watch: a small cluster of lunch-time feedback flagged wait times as slightly above expectation — this may be worth reviewing with your midday crew. Overall, momentum is strong heading into the weekend.`

const FOCUS_POINTS = [
  {
    pillar: "Anticipation",
    action: "Introduce a brief pre-service briefing at the start of each lunch shift to align the team on expected covers and any guest notes, reducing reactive service moments."
  },
  {
    pillar: "Resilience",
    action: "When wait times extend beyond 10 minutes, train staff to proactively acknowledge the guest and offer a small gesture — a complimentary amuse-bouche or a drink on the house goes a long way."
  },
  {
    pillar: "Recognition",
    action: "Consider introducing a simple end-of-week staff spotlight based on named guest mentions — recognising Sarah and others publicly reinforces the behaviour guests are already rewarding."
  },
  {
    pillar: "Empathy",
    action: "Review the seating layout near the window, which was flagged in two pieces of feedback this week. A small adjustment could noticeably improve the guest experience without operational disruption."
  }
]

async function main() {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  console.log("Connected")

  // Remove any existing summary for today
  await client.query(
    `DELETE FROM ai_daily_summaries WHERE property_id = $1 AND date = CURRENT_DATE`,
    [BISTRO_ID]
  )

  await client.query(
    `INSERT INTO ai_daily_summaries (id, property_id, date, narrative, focus_points, generated_at)
     VALUES ($1, $2, CURRENT_DATE, $3, $4, NOW())`,
    [randomUUID(), BISTRO_ID, NARRATIVE, JSON.stringify(FOCUS_POINTS)]
  )

  console.log("✓ AI summary inserted for The Bistro")
  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
