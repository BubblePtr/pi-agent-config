import { uuidv7 } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// Demo: naming model is fixed to GPT-5.3 Codex Spark via the openai-codex provider.
const PROVIDER = "openai-codex";
const MODEL_ID = "gpt-5.3-codex-spark";
const MAX_SOURCE_CHARS = 2000;
const MAX_NAME_LENGTH = 50;

const extractText = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const part of content) {
    if (part?.type === "text" && typeof part.text === "string") {
      parts.push(part.text);
    }
  }
  return parts.join("\n");
};

// Models tend to wrap titles in quotes or add trailing punctuation; the session
// selector wants a bare single-line label.
const sanitizeName = (raw: string): string =>
  raw
    .split("\n")[0]
    .trim()
    .replace(/^["'“”「『]+|["'“”」』]+$/g, "")
    .replace(/[.!?:;，。！？：；]+$/, "")
    .slice(0, MAX_NAME_LENGTH)
    .trim();

const buildPrompt = (source: string): string =>
  [
    "Generate a short title for this coding session based on the user's request.",
    "Rules: max 8 words, same language as the request, no quotes, no trailing punctuation.",
    "Reply with the title only.",
    "",
    "<request>",
    source.slice(0, MAX_SOURCE_CHARS),
    "</request>",
  ].join("\n");

export default function (pi: ExtensionAPI) {
  let named = false;

  pi.on("session_start", () => {
    named = Boolean(pi.getSessionName());
  });

  const generateName = async (
    ctx: ExtensionContext,
    source: string,
  ): Promise<string | null> => {
    const model = ctx.modelRegistry.find(PROVIDER, MODEL_ID);
    if (!model || !ctx.modelRegistry.hasConfiguredAuth(model)) return null;

    const response = await ctx.modelRegistry.complete(
      model,
      {
        messages: [
          {
            role: "user" as const,
            content: [{ type: "text" as const, text: buildPrompt(source) }],
            timestamp: Date.now(),
          },
        ],
      },
      { reasoningEffort: "low", cacheRetention: "none", sessionId: uuidv7() },
    );

    const text = response.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join(" ");
    return sanitizeName(text) || null;
  };

  // Name the session from the first user message so the selector shows a
  // readable title as early as possible.
  pi.on("message_end", async (event, ctx) => {
    if (named || event.message.role !== "user") return;
    const source = extractText(event.message.content).trim();
    if (!source) return;
    // Mark before awaiting so a second user message during the call doesn't
    // fire another naming request.
    named = true;
    try {
      const name = await generateName(ctx, source);
      if (name) {
        pi.setSessionName(name);
        ctx.ui.notify(`Session named: ${name}`, "info");
      }
    } catch {
      // Naming is best-effort; ignore provider failures.
    }
  });

  pi.registerCommand("auto-name", {
    description: "Regenerate the session name from the conversation",
    handler: async (_args, ctx) => {
      const source = ctx.sessionManager
        .getBranch()
        .filter((e) => e.type === "message" && e.message?.role === "user")
        .map((e) => extractText(e.message.content))
        .filter(Boolean)
        .join("\n\n")
        .trim();

      if (!source) {
        ctx.ui.notify("No conversation to name from", "warning");
        return;
      }

      try {
        const name = await generateName(ctx, source);
        if (name) {
          pi.setSessionName(name);
          named = true;
          ctx.ui.notify(`Session named: ${name}`, "info");
        } else {
          ctx.ui.notify(
            `Model ${PROVIDER}/${MODEL_ID} unavailable or not authenticated`,
            "warning",
          );
        }
      } catch (error) {
        ctx.ui.notify(`Auto-name failed: ${(error as Error).message}`, "error");
      }
    },
  });
}
