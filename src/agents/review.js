import { agent, tool } from "@21st-sdk/agent"
import { z } from "zod"

export default agent({
  model: "claude-sonnet-4-6",
  runtime: "claude-code",
  permissionMode: "default",
  maxTurns: 30,

  systemPrompt: `You are the Review Agent for a high-end web design firm.
You are an unbiased, critical design reviewer. You have NO attachment to the work.
Your only loyalty is to quality. A 6/10 build that ships damages trust more than shipping nothing.

Score every build across 5 dimensions (0–2 each, 10 total):
- Visual Sophistication: hand-crafted vs template-generated?
- Typography Mastery: intentional hierarchy, custom letter-spacing?
- Animation & Motion: considered or bolted on?
- Data Presentation: dense but legible, clear hierarchy?
- Brand Cohesion: does every element belong?

Threshold: 8/10+ to ship. Below 7 = mandatory revision.

Anti-template audit — flag immediately if present:
- Generic box-shadow cards, Bootstrap/Material defaults
- Pure black/white colors, default blue accents
- Single font family, default browser rendering
- Linear animations, transition: all 0.3s ease
- Unstyled native inputs, empty states with no message

Competitor benchmark — compare against: Bloomberg Terminal, TradingView, Linear.app, Vercel Dashboard, Raycast
Ask: "Would a Bloomberg trader feel at home?"

Output format:
## Design Review — [Version]
### Premium Feel Score: X/10 (table with 5 dimensions)
### Anti-Template Audit (FLAGGED / CLEAR items with specific selectors and fixes)
### EDGE-Specific Checks (HUD authenticity, data density, mobile ergonomics)
### Competitor Benchmark
### Verdict: APPROVED / REVISE / REJECT
### Required Changes (item — priority: high/medium/low)`,

  tools: {
    scoreDesign: tool({
      description: "Record scores for each design dimension and compute total",
      inputSchema: z.object({
        visualSophistication: z.number().min(0).max(2),
        typographyMastery: z.number().min(0).max(2),
        animationMotion: z.number().min(0).max(2),
        dataPresentation: z.number().min(0).max(2),
        brandCohesion: z.number().min(0).max(2),
        notes: z.object({
          visualSophistication: z.string(),
          typographyMastery: z.string(),
          animationMotion: z.string(),
          dataPresentation: z.string(),
          brandCohesion: z.string(),
        }),
      }),
      execute: async (scores) => {
        const total = scores.visualSophistication + scores.typographyMastery +
          scores.animationMotion + scores.dataPresentation + scores.brandCohesion
        const verdict = total >= 8 ? "APPROVED" : total >= 7 ? "REVISE" : "REJECT"
        const table = `
| Dimension | Score | Notes |
|-----------|-------|-------|
| Visual Sophistication | ${scores.visualSophistication}/2 | ${scores.notes.visualSophistication} |
| Typography Mastery | ${scores.typographyMastery}/2 | ${scores.notes.typographyMastery} |
| Animation & Motion | ${scores.animationMotion}/2 | ${scores.notes.animationMotion} |
| Data Presentation | ${scores.dataPresentation}/2 | ${scores.notes.dataPresentation} |
| Brand Cohesion | ${scores.brandCohesion}/2 | ${scores.notes.brandCohesion} |
| **Total** | **${total}/10** | **${verdict}** |`
        return { content: [{ type: "text", text: table }] }
      },
    }),

    saveReviewReport: tool({
      description: "Save the completed review report to disk",
      inputSchema: z.object({
        filename: z.string().describe("e.g. review-v5-beta1.md"),
        content: z.string().describe("Full markdown review report"),
      }),
      execute: async ({ filename, content }) => {
        const { writeFile, mkdir } = await import("fs/promises")
        await mkdir("./review-reports", { recursive: true })
        await writeFile(`./review-reports/${filename}`, content, "utf8")
        return { content: [{ type: "text", text: `Review saved to ./review-reports/${filename}` }] }
      },
    }),
  },

  onStart: async () => {
    console.log("[Review Agent] Starting design review...")
  },

  onFinish: async ({ result }) => {
    console.log("[Review Agent] Review complete.")
  },
})
