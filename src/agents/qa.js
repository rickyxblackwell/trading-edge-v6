import { agent, tool } from "@21st-sdk/agent"
import { z } from "zod"

export default agent({
  model: "claude-sonnet-4-6",
  runtime: "claude-code",
  permissionMode: "default",
  maxTurns: 60,

  systemPrompt: `You are the QA Agent for a high-end web design firm.
You test every aspect of a build before it ships. You are detail-obsessed and merciless.

Your test scope for every build:
1. VISUAL — layout, design token compliance, typography, no hardcoded colors
2. INTERACTIONS — tab nav, forms, checklist, canvas charts, coach page, modals
3. DATA INTEGRITY — localStorage read/write, trade schema, coaching history cap (30)
4. EDGE CASES — zero trades, 1 trade, all losses, missing API key, malformed localStorage
5. iOS SAFARI — viewport height (100dvh), safe area insets, tap target sizes (44px min), no bounce scroll
6. PERFORMANCE — no jank on tab switch, canvas redraws, no memory leaks

After testing, output a QA Report:
## QA Report — [Version]
### PASS ✓ (list all passing items)
### FAIL ✗ (item — description — reproduction steps)
### WARNINGS ⚠ (non-blocking issues)
### Verdict: SHIP / HOLD / NEEDS FIX

Only mark SHIP if zero FAIL items.`,

  tools: {
    readHtmlFile: tool({
      description: "Read the current HTML app file for static analysis",
      inputSchema: z.object({
        filepath: z.string().describe("Path to the HTML file to audit"),
      }),
      execute: async ({ filepath }) => {
        const { readFile } = await import("fs/promises")
        const content = await readFile(filepath, "utf8")
        return { content: [{ type: "text", text: content }] }
      },
    }),

    checkHardcodedColors: tool({
      description: "Scan HTML/CSS for hardcoded color values that should be CSS variables",
      inputSchema: z.object({
        htmlContent: z.string().describe("Full HTML file content to scan"),
      }),
      execute: async ({ htmlContent }) => {
        const hexPattern = /#([0-9a-fA-F]{3,8})\b(?![^'"\)]*var)/g
        const matches = []
        let match
        const lines = htmlContent.split("\n")
        lines.forEach((line, i) => {
          if (hexPattern.test(line) && !line.trim().startsWith("/*") && !line.includes("--")) {
            matches.push(`Line ${i + 1}: ${line.trim()}`)
          }
          hexPattern.lastIndex = 0
        })
        const result = matches.length === 0
          ? "✓ No hardcoded colors found"
          : `✗ ${matches.length} hardcoded color(s) found:\n${matches.slice(0, 20).join("\n")}`
        return { content: [{ type: "text", text: result }] }
      },
    }),

    saveQaReport: tool({
      description: "Save the completed QA report to disk",
      inputSchema: z.object({
        filename: z.string().describe("e.g. qa-report-v5-beta1.md"),
        content: z.string().describe("Full markdown QA report"),
      }),
      execute: async ({ filename, content }) => {
        const { writeFile, mkdir } = await import("fs/promises")
        await mkdir("./qa-reports", { recursive: true })
        await writeFile(`./qa-reports/${filename}`, content, "utf8")
        return { content: [{ type: "text", text: `QA report saved to ./qa-reports/${filename}` }] }
      },
    }),
  },

  onStart: async () => {
    console.log("[QA Agent] Starting quality audit...")
  },

  onFinish: async ({ result }) => {
    console.log("[QA Agent] Audit complete.")
  },
})
