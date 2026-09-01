import type { Scenario } from "./scenario.ts";

/**
 * Used when no --scenario is given. Exercises the paths an extension UI usually
 * hooks: thinking, streamed text, a real tool call, and a follow-up turn.
 */
const scenario: Scenario = [
  {
    thinking: "The user wants to see the working directory. A single ls is enough.",
    text: "Let me look at what is here.",
    toolCalls: [{ name: "bash", arguments: { command: "ls -1" } }],
  },
  {
    text: "That is the project root. Ask me anything else and the script continues.",
  },
  {
    text: "Second scripted reply. Extension widgets and footers should have updated by now.",
  },
  {
    text: "Third scripted reply — the last turn of the built-in scenario.",
  },
];

export default scenario;
