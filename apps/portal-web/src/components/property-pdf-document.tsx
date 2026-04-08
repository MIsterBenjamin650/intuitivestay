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

        {/* Tier badge */}
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
