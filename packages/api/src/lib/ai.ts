import Anthropic from "@anthropic-ai/sdk"
import { env } from "@intuitive-stay/env/server"

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

export type DailySummaryResult = {
  narrative: string
  focus: Array<{ pillar: string; action: string }>
}

export async function generatePropertySummary(input: {
  propertyName: string
  date: string
  submissionCount: number
  avgGcs: number | null
  avgResilience: number | null
  avgEmpathy: number | null
  avgAnticipation: number | null
  avgRecognition: number | null
  ventTexts: string[]
  staffMentions: string[]
}): Promise<DailySummaryResult> {
  const prompt = `You are a hospitality performance advisor. Generate a brief daily summary for a property manager.

Property: ${input.propertyName}
Date: ${input.date}
Submissions yesterday: ${input.submissionCount}
Overall GCS: ${input.avgGcs?.toFixed(1) ?? "N/A"}/10
Pillar scores: Resilience ${input.avgResilience?.toFixed(1) ?? "N/A"}, Empathy ${input.avgEmpathy?.toFixed(1) ?? "N/A"}, Anticipation ${input.avgAnticipation?.toFixed(1) ?? "N/A"}, Recognition ${input.avgRecognition?.toFixed(1) ?? "N/A"}
${input.ventTexts.length > 0 ? `Guest comments: ${input.ventTexts.slice(0, 3).join(" | ")}` : "No guest comments yesterday."}
${input.staffMentions.length > 0 ? `Staff mentioned: ${[...new Set(input.staffMentions)].join(", ")}` : ""}

Respond with valid JSON only, no markdown:
{
  "narrative": "3-4 sentence summary of performance",
  "focus": [
    { "pillar": "PillarName", "action": "Short actionable tip for today" },
    { "pillar": "PillarName", "action": "Short actionable tip for today" },
    { "pillar": "PillarName", "action": "Short actionable tip for today" }
  ]
}`

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  })

  const raw = message.content[0]?.type === "text" ? message.content[0].text : ""
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim()
  const parsed = JSON.parse(text) as DailySummaryResult
  return parsed
}

export type PillarAnalysisResult = {
  resilience: number
  empathy: number
  anticipation: number
  recognition: number
}

export async function analyseReviewsForPillars(
  reviews: string[],
): Promise<PillarAnalysisResult> {
  if (reviews.length === 0) {
    return { resilience: 5, empathy: 5, anticipation: 5, recognition: 5 }
  }

  const sample = reviews.slice(0, 50)
  const prompt = `You are a hospitality performance analyst. Analyse these ${sample.length} guest reviews and score the property on 4 service pillars from 1-10 based purely on what the reviews say.

Pillar definitions:
- Resilience: How well do staff handle problems, complaints, or unexpected situations?
- Empathy: How warm, caring and attentive are staff to individual guest needs?
- Anticipation: Do staff anticipate guest needs before being asked?
- Recognition: Do guests feel personally recognised, remembered, or special?

If a pillar is not mentioned in the reviews, score it 5 (neutral).

Reviews:
${sample.map((r, i) => `${i + 1}. "${r.replace(/"/g, "'").slice(0, 300)}"`).join("\n")}

Respond with valid JSON only, no markdown:
{
  "resilience": 7.5,
  "empathy": 8.2,
  "anticipation": 6.9,
  "recognition": 7.8
}`

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  })

  const raw = message.content[0]?.type === "text" ? message.content[0].text : ""
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim()
  const parsed = JSON.parse(text) as PillarAnalysisResult
  return {
    resilience: Math.min(10, Math.max(1, Number(parsed.resilience))),
    empathy: Math.min(10, Math.max(1, Number(parsed.empathy))),
    anticipation: Math.min(10, Math.max(1, Number(parsed.anticipation))),
    recognition: Math.min(10, Math.max(1, Number(parsed.recognition))),
  }
}
