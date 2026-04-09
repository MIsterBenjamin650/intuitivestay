# PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Export PDF" button to the property dashboard that generates and downloads a branded PDF report containing all dashboard data for the selected date range.

**Architecture:** Client-side PDF generation using `@react-pdf/renderer`. The PDF component reuses data already loaded by the dashboard's existing tRPC queries — no new API endpoints needed. The PDF document is built as a separate React-PDF component tree (not CSS — react-pdf has its own styling) and downloaded via blob URL. Dynamic import ensures the library is never loaded server-side.

**Tech Stack:** `@react-pdf/renderer`, TanStack React Router, tRPC (existing queries), TypeScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/portal-web/src/components/property-pdf-document.tsx` | Create | React-PDF document layout — all PDF pages and sections |
| `apps/portal-web/src/components/export-pdf-button.tsx` | Create | Button component that triggers client-side PDF generation and download |
| `apps/portal-web/src/routes/_portal.properties.$propertyId.dashboard.tsx` | Modify | Import and render `<ExportPdfButton>` with dashboard data props |
| `apps/portal-web/package.json` | Modify | Add `@react-pdf/renderer` dependency |

---

## Task 1: Install dependency

**Files:**
- Modify: `apps/portal-web/package.json`

- [ ] **Step 1: Add @react-pdf/renderer to portal-web**

Run from the repo root:
```bash
pnpm --filter @intuitive-stay/portal-web add @react-pdf/renderer
pnpm --filter @intuitive-stay/portal-web add -D @types/react-pdf
```

- [ ] **Step 2: Verify install**

```bash
pnpm --filter @intuitive-stay/portal-web list @react-pdf/renderer
```
Expected: version shown, no errors

- [ ] **Step 3: Commit**

```bash
git add apps/portal-web/package.json pnpm-lock.yaml
git commit -m "feat: add @react-pdf/renderer for dashboard PDF export"
```

---

## Task 2: Create the PDF document component

**Files:**
- Create: `apps/portal-web/src/components/property-pdf-document.tsx`

This component uses react-pdf's own layout primitives (`Document`, `Page`, `View`, `Text`, `StyleSheet`). It receives all dashboard data as props.

- [ ] **Step 1: Create the file**

Create `apps/portal-web/src/components/property-pdf-document.tsx` with this content:

```tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"

const ORANGE = "#C97B1A"
const DARK = "#1a1a1a"
const MUTED = "#666666"
const LIGHT_BG = "#f9f9f9"
const BORDER = "#e5e5e5"

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: DARK,
    padding: 40,
    backgroundColor: "#ffffff",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: ORANGE,
    borderBottomStyle: "solid",
    paddingBottom: 12,
    marginBottom: 20,
  },
  brandName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: ORANGE,
  },
  propertyName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    marginTop: 4,
  },
  meta: {
    fontSize: 9,
    color: MUTED,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    marginBottom: 8,
    marginTop: 16,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: LIGHT_BG,
    borderRadius: 4,
    padding: 10,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: "solid",
  },
  statLabel: {
    fontSize: 8,
    color: MUTED,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: DARK,
  },
  table: {
    width: "100%",
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: ORANGE,
    padding: 6,
    borderRadius: 3,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderBottomStyle: "solid",
    padding: 5,
  },
  tableRowAlt: {
    backgroundColor: LIGHT_BG,
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
    color: DARK,
  },
  chip: {
    backgroundColor: "#f0e6d3",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 4,
  },
  chipText: {
    fontSize: 8,
    color: ORANGE,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  aiBox: {
    backgroundColor: LIGHT_BG,
    borderRadius: 4,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: ORANGE,
    borderLeftStyle: "solid",
    marginBottom: 10,
  },
  aiNarrative: {
    fontSize: 9,
    color: DARK,
    lineHeight: 1.5,
  },
  focusPoint: {
    flexDirection: "row",
    marginBottom: 4,
  },
  focusBullet: {
    fontSize: 9,
    color: ORANGE,
    marginRight: 4,
  },
  focusText: {
    fontSize: 9,
    color: DARK,
    flex: 1,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderTopStyle: "solid",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: MUTED,
  },
  tierBadge: {
    alignSelf: "flex-start",
    backgroundColor: ORANGE,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  tierText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
})

export interface PdfDashboardData {
  propertyName: string
  days: number
  exportedAt: string
  stats: { totalFeedback: number; avgGcs: number } | null
  tier: { currentTier: string | null } | null
  recentFeedback: Array<{
    id: string
    resilience: number
    empathy: number
    anticipation: number
    recognition: number
    gcs: number
    mealTime: string | null
    namedStaffMember: string | null
    ventText: string | null
    submittedAt: string
  }>
  wordCloud: Array<{ word: string; count: number }>
  staffBubbles: Array<{ name: string; count: number; sentiment: string }>
  aiSummary: { narrative: string; focusPoints: Array<{ pillar: string; action: string }> } | null
  gcsHistory: Array<{ bucket: string; gcs: number; resilience: number; empathy: number; anticipation: number; recognition: number }>
}

export function PropertyPdfDocument({ data }: { data: PdfDashboardData }) {
  const gcs = data.stats?.avgGcs ?? 0
  const gcsDisplay = (gcs * 10).toFixed(1)
  const tierLabel = data.tier?.currentTier
    ? data.tier.currentTier.charAt(0).toUpperCase() + data.tier.currentTier.slice(1)
    : "Unranked"

  const pillars = data.gcsHistory.length > 0
    ? {
        resilience: (data.gcsHistory.reduce((s, r) => s + r.resilience, 0) / data.gcsHistory.length).toFixed(1),
        empathy: (data.gcsHistory.reduce((s, r) => s + r.empathy, 0) / data.gcsHistory.length).toFixed(1),
        anticipation: (data.gcsHistory.reduce((s, r) => s + r.anticipation, 0) / data.gcsHistory.length).toFixed(1),
        recognition: (data.gcsHistory.reduce((s, r) => s + r.recognition, 0) / data.gcsHistory.length).toFixed(1),
      }
    : null

  return (
    <Document title={`${data.propertyName} — IntuitivStay Report`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brandName}>IntuitivStay</Text>
          <Text style={styles.propertyName}>{data.propertyName}</Text>
          <Text style={styles.meta}>
            Guest Experience Report · Last {data.days} days · Exported {data.exportedAt}
          </Text>
        </View>

        {/* Tier + GCS */}
        {data.tier?.currentTier && (
          <View style={styles.tierBadge}>
            <Text style={styles.tierText}>{tierLabel} Tier</Text>
          </View>
        )}

        {/* Stats row */}
        <View style={styles.row}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Guest Confidence Score</Text>
            <Text style={styles.statValue}>{gcsDisplay}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Feedback</Text>
            <Text style={styles.statValue}>{data.stats?.totalFeedback ?? 0}</Text>
          </View>
          {pillars && (
            <>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Resilience</Text>
                <Text style={styles.statValue}>{pillars.resilience}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Empathy</Text>
                <Text style={styles.statValue}>{pillars.empathy}</Text>
              </View>
            </>
          )}
        </View>

        {pillars && (
          <View style={styles.row}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Anticipation</Text>
              <Text style={styles.statValue}>{pillars.anticipation}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Recognition</Text>
              <Text style={styles.statValue}>{pillars.recognition}</Text>
            </View>
            <View style={{ flex: 2 }} />
          </View>
        )}

        {/* AI Summary */}
        {data.aiSummary && (
          <>
            <Text style={styles.sectionTitle}>AI Daily Insight</Text>
            <View style={styles.aiBox}>
              <Text style={styles.aiNarrative}>{data.aiSummary.narrative}</Text>
            </View>
            {data.aiSummary.focusPoints.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Focus Points</Text>
                {data.aiSummary.focusPoints.map((fp, i) => (
                  <View key={i} style={styles.focusPoint}>
                    <Text style={styles.focusBullet}>▸</Text>
                    <Text style={styles.focusText}>
                      <Text style={{ fontFamily: "Helvetica-Bold" }}>{fp.pillar}: </Text>
                      {fp.action}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* Top adjectives */}
        {data.wordCloud.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top Guest Adjectives</Text>
            <View style={styles.chipRow}>
              {data.wordCloud.slice(0, 20).map((w) => (
                <View key={w.word} style={styles.chip}>
                  <Text style={styles.chipText}>{w.word} ({w.count})</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>IntuitivStay — Confidential</Text>
          <Text style={styles.footerText}>{data.propertyName}</Text>
        </View>
      </Page>

      {/* Page 2: Recent feedback */}
      {data.recentFeedback.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.brandName}>IntuitivStay</Text>
            <Text style={styles.propertyName}>{data.propertyName} — Recent Feedback</Text>
          </View>

          <Text style={styles.sectionTitle}>Recent Feedback Entries</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>GCS</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Res</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Emp</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Ant</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Rec</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Staff</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Meal</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Comment</Text>
            </View>
            {data.recentFeedback.map((fb, i) => (
              <View key={fb.id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCell, { flex: 0.6 }]}>{(fb.gcs * 10).toFixed(0)}</Text>
                <Text style={[styles.tableCell, { flex: 0.6 }]}>{fb.resilience}</Text>
                <Text style={[styles.tableCell, { flex: 0.6 }]}>{fb.empathy}</Text>
                <Text style={[styles.tableCell, { flex: 0.6 }]}>{fb.anticipation}</Text>
                <Text style={[styles.tableCell, { flex: 0.6 }]}>{fb.recognition}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{fb.namedStaffMember ?? "—"}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{fb.mealTime ?? "—"}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{fb.ventText ? fb.ventText.slice(0, 60) + (fb.ventText.length > 60 ? "…" : "") : "—"}</Text>
              </View>
            ))}
          </View>

          {/* Staff mentions */}
          {data.staffBubbles.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Staff Mentions</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderCell}>Name</Text>
                  <Text style={styles.tableHeaderCell}>Mentions</Text>
                  <Text style={styles.tableHeaderCell}>Sentiment</Text>
                </View>
                {data.staffBubbles.map((s, i) => (
                  <View key={s.name} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                    <Text style={styles.tableCell}>{s.name}</Text>
                    <Text style={styles.tableCell}>{s.count}</Text>
                    <Text style={styles.tableCell}>{s.sentiment.charAt(0).toUpperCase() + s.sentiment.slice(1)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>IntuitivStay — Confidential</Text>
            <Text style={styles.footerText}>{data.propertyName}</Text>
          </View>
        </Page>
      )}
    </Document>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/portal-web/src/components/property-pdf-document.tsx
git commit -m "feat: add PropertyPdfDocument react-pdf component"
```

---

## Task 3: Create the export button component

**Files:**
- Create: `apps/portal-web/src/components/export-pdf-button.tsx`

This component dynamically imports `@react-pdf/renderer` (client-side only) to avoid SSR issues, generates the PDF blob, and triggers a browser download.

- [ ] **Step 1: Create the file**

Create `apps/portal-web/src/components/export-pdf-button.tsx` with this content:

```tsx
import { useState } from "react"
import { Download } from "lucide-react"
import type { PdfDashboardData } from "./property-pdf-document"

interface ExportPdfButtonProps {
  data: PdfDashboardData
  disabled?: boolean
}

export function ExportPdfButton({ data, disabled }: ExportPdfButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    if (loading || disabled) return
    setLoading(true)
    try {
      // Dynamic import — runs client-side only, never on the server
      const { pdf } = await import("@react-pdf/renderer")
      const { PropertyPdfDocument } = await import("./property-pdf-document")

      const blob = await pdf(<PropertyPdfDocument data={data} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      const safeName = data.propertyName.replace(/[^a-z0-9]/gi, "-").toLowerCase()
      link.href = url
      link.download = `${safeName}-report-${data.days}d.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("PDF export failed:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading || disabled}
      className="flex items-center gap-2 rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-medium text-orange-700 shadow-sm transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download className="h-4 w-4" />
      {loading ? "Generating…" : "Export PDF"}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/portal-web/src/components/export-pdf-button.tsx
git commit -m "feat: add ExportPdfButton component with dynamic react-pdf import"
```

---

## Task 4: Wire button into the dashboard

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.properties.$propertyId.dashboard.tsx`

- [ ] **Step 1: Read the current dashboard file top section**

Read `apps/portal-web/src/routes/_portal.properties.$propertyId.dashboard.tsx` lines 1-60 to find the imports and the top-level return JSX.

- [ ] **Step 2: Add import**

Find the existing import block at the top of the file. Add these two imports after the existing component imports:

```tsx
import { ExportPdfButton } from "@/components/export-pdf-button"
import type { PdfDashboardData } from "@/components/property-pdf-document"
```

- [ ] **Step 3: Build the data object and add the button**

Find the main return statement in the dashboard component. Locate the top bar area — it contains the property name heading and the `<DateRangeTabs>` component.

Add the following just before or after the `<DateRangeTabs>` element:

```tsx
{/* PDF Export */}
{(() => {
  const pdfData: PdfDashboardData = {
    propertyName: property.name,
    days,
    exportedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    stats: stats ?? null,
    tier: tierStatus ?? null,
    recentFeedback: (recentFeedback ?? []).map((fb) => ({
      id: fb.id,
      resilience: fb.resilience,
      empathy: fb.empathy,
      anticipation: fb.anticipation,
      recognition: fb.recognition,
      gcs: Number(fb.gcs),
      mealTime: fb.mealTime ?? null,
      namedStaffMember: fb.namedStaffMember ?? null,
      ventText: fb.ventText ?? null,
      submittedAt: fb.submittedAt,
    })),
    wordCloud: wordCloud ?? [],
    staffBubbles: staffBubbles ?? [],
    aiSummary: aiSummary
      ? { narrative: aiSummary.narrative, focusPoints: aiSummary.focusPoints as Array<{ pillar: string; action: string }> }
      : null,
    gcsHistory: gcsHistory ?? [],
  }
  return <ExportPdfButton data={pdfData} disabled={!stats || stats.totalFeedback === 0} />
})()}
```

- [ ] **Step 4: Check variable names match**

Read the dashboard file and confirm the variable names used above (`property`, `days`, `stats`, `tierStatus`, `recentFeedback`, `wordCloud`, `staffBubbles`, `aiSummary`, `gcsHistory`) match what the file actually uses. If any names differ, update the mapping to match the real names.

- [ ] **Step 5: Commit**

```bash
git add apps/portal-web/src/routes/_portal.properties.$propertyId.dashboard.tsx
git commit -m "feat: add PDF export button to property dashboard"
```

---

## Task 5: Build and verify

- [ ] **Step 1: Run TypeScript check**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
pnpm --filter @intuitive-stay/portal-web exec tsc --noEmit
```
Expected: No errors

- [ ] **Step 2: Push to Railway**

```bash
git push origin main
```

Expected: Railway build succeeds, portal-web deploys green.

- [ ] **Step 3: Verify in browser**

1. Log in to portal.intuitivestay.com
2. Navigate to a property dashboard
3. Click "Export PDF"
4. Verify a PDF downloads with correct property name in filename
5. Open the PDF and verify: property name, GCS score, stats, AI summary, feedback table all present

---

## Self-Review

**Spec coverage:**
- ✅ Export button on dashboard — Task 4
- ✅ Branded PDF with IntuitivStay orange — Task 2 (ORANGE constant)
- ✅ GCS score and tier — Task 2 (stats row + tier badge)
- ✅ All four pillar averages — Task 2 (pillar stat boxes)
- ✅ AI summary and focus points — Task 2 (AI section)
- ✅ Recent feedback table — Task 2 (Page 2)
- ✅ Word cloud — Task 2 (adjective chips)
- ✅ Staff mentions — Task 2 (Page 2 staff table)
- ✅ Date range respected — data passed from dashboard queries which already filter by `days`
- ✅ Client-side only (no SSR breakage) — dynamic import in Task 3
- ✅ Disabled when no data — `disabled={!stats || stats.totalFeedback === 0}`

**Placeholder scan:** No TBDs, TODOs, or vague steps found. All code is complete.

**Type consistency:** `PdfDashboardData` interface defined in Task 2, imported and used identically in Tasks 3 and 4.
