import { agent, tool } from "@21st-sdk/agent"
import { z } from "zod"

export default agent({
  model: "claude-sonnet-4-6",
  runtime: "claude-code",
  permissionMode: "default",
  maxTurns: 40,

  systemPrompt: `You are the Research Agent for a high-end web design firm.
Your job is to gather visual and technical intelligence BEFORE any UI/UX build begins.
You do not write application code — you investigate, extract, and deliver a structured design brief.

When given reference URLs:
1. Use the chrome-devtools MCP to navigate, screenshot, and extract CSS/fonts/animations
2. Use WebSearch to find component libraries or design systems used
3. Use WebFetch or firecrawl MCP for deep HTML/CSS extraction if needed
4. Identify: color palette, fonts, layout system, animation style, depth system, component patterns
5. Flag any anti-template patterns to AVOID
6. Deliver a structured Research Brief (markdown) — no code, no implementation

Output format:
## Reference Analysis: [Site Name]
### Visual Identity
### Key Patterns to Adopt
### Patterns to Avoid
### Recommended Component Sources
### V5 Design Token Proposals (CSS custom properties)
### Implementation Notes`,

  tools: {
    saveResearchBrief: tool({
      description: "Save the completed research brief to disk for the build team",
      inputSchema: z.object({
        filename: z.string().describe("e.g. brief-linear-app.md"),
        content: z.string().describe("Full markdown research brief"),
      }),
      execute: async ({ filename, content }) => {
        const { writeFile } = await import("fs/promises")
        const path = `./research-briefs/${filename}`
        const { mkdir } = await import("fs/promises")
        await mkdir("./research-briefs", { recursive: true })
        await writeFile(path, content, "utf8")
        return { content: [{ type: "text", text: `Brief saved to ${path}` }] }
      },
    }),

    extractDesignTokens: tool({
      description: "Extract and format CSS custom properties from raw CSS text into a clean token set",
      inputSchema: z.object({
        rawCss: z.string().describe("Raw CSS :root block text from the target site"),
        siteName: z.string(),
      }),
      execute: async ({ rawCss, siteName }) => {
        const matches = rawCss.match(/--[\w-]+:\s*[^;]+/g) || []
        const tokens = matches.map(t => t.trim()).join("\n  ")
        return {
          content: [{
            type: "text",
            text: `/* ${siteName} design tokens */\n:root {\n  ${tokens}\n}`,
          }],
        }
      },
    }),
  },

  onStart: async () => {
    console.log("[Research Agent] Starting reference analysis...")
  },

  onFinish: async ({ result }) => {
    console.log("[Research Agent] Brief complete.")
  },
})
