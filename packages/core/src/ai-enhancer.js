// AI enhancer for RepoReady
// Optional AI enhancement layer. Users configure their own API key.
// Without a key, all analysis uses pure rule engines.
// With a key, AI enhances existing analysis results — it never replaces them.

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_TOKENS = 2000;
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

/**
 * Check if AI enhancement is available.
 * Returns true only if the user has explicitly configured an API key.
 */
export function isAiAvailable() {
  return !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.REPOREADY_AI_KEY);
}

/**
 * Get the configured AI provider and key.
 * Priority: REPOREADY_AI_KEY > OPENAI_API_KEY > ANTHROPIC_API_KEY
 */
export function getAiConfig() {
  if (process.env.REPOREADY_AI_KEY) {
    const [provider, key] = process.env.REPOREADY_AI_KEY.split(":");
    return {
      provider: provider || "openai",
      apiKey: key || process.env.REPOREADY_AI_KEY,
      baseUrl: process.env.REPOREADY_AI_BASE_URL || DEFAULT_BASE_URL,
      model: process.env.REPOREADY_AI_MODEL || DEFAULT_MODEL,
      maxTokens: parseInt(process.env.REPOREADY_AI_MAX_TOKENS || String(DEFAULT_MAX_TOKENS), 10)
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL,
      model: process.env.REPOREADY_AI_MODEL || DEFAULT_MODEL,
      maxTokens: parseInt(process.env.REPOREADY_AI_MAX_TOKENS || String(DEFAULT_MAX_TOKENS), 10)
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1",
      model: process.env.REPOREADY_AI_MODEL || "claude-3-5-haiku-latest",
      maxTokens: parseInt(process.env.REPOREADY_AI_MAX_TOKENS || String(DEFAULT_MAX_TOKENS), 10)
    };
  }
  return null;
}

/**
 * Estimate token count for a given text (rough approximation).
 * ~4 characters per token for English, ~2 for Chinese.
 */
export function estimateTokens(text) {
  const en = (text.match(/[a-zA-Z0-9\s]/g) || []).length;
  const cn = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  return Math.ceil(en / 4 + cn / 2);
}

/**
 * Enhance README quality analysis with AI suggestions.
 * Input: structured analysis result (no source code)
 */
export async function enhanceReadmeQuality(readmeQuality, config) {
  if (!config) return null;
  const prompt = buildReadmePrompt(readmeQuality);
  const tokens = estimateTokens(prompt);
  if (tokens > config.maxTokens) return null;
  return callAi(config, prompt, "You are a technical documentation expert. Give concise, actionable advice.");
}

function buildReadmePrompt(quality) {
  const lines = [
    "Analyze this README quality report and suggest 3-5 specific improvements.",
    `Current grade: ${quality.grade} (${quality.score}/100)`,
    `Missing sections: ${quality.missingSections.join(", ") || "none"}`,
    `Found sections: ${quality.sections.join(", ") || "none"}`,
    `Readability: ${quality.readability.fleschScore} Flesch score, ${quality.readability.paragraphs} paragraphs`,
    `Audience signals: ${quality.audience.signals.join(", ")}`,
    "Return a JSON array of suggestions: [{\"priority\":\"high|medium|low\",\"en\":\"suggestion\",\"zh\":\"建议\"}]"
  ];
  return lines.join("\n");
}

/**
 * Enhance task graph with AI-generated repository-specific tasks.
 */
export async function enhanceTaskGraph(taskGraph, stack, config) {
  if (!config) return null;
  const prompt = buildTaskPrompt(taskGraph, stack);
  const tokens = estimateTokens(prompt);
  if (tokens > config.maxTokens) return null;
  return callAi(config, prompt, "You are a senior software engineer. Suggest concrete, actionable agent tasks.");
}

function buildTaskPrompt(taskGraph, stack) {
  const lines = [
    "Based on this repository analysis, suggest 3 additional concrete tasks for an AI coding agent.",
    `Language: ${stack.languages.join(", ") || "Unknown"}`,
    `Frameworks: ${stack.frameworks.join(", ") || "Unknown"}`,
    `Package manager: ${stack.packageManager}`,
    `Existing tasks: ${taskGraph.totalTasks} tasks, estimated ${taskGraph.totalEstimatedMinutes} minutes`,
    "Return a JSON array: [{\"priority\":\"high|medium|low\",\"category\":\"documentation|testing|ci|safety|code-quality\",\"en\":\"task description\",\"zh\":\"任务描述\",\"estimatedMinutes\":number}]"
  ];
  return lines.join("\n");
}

/**
 * Enhance AGENTS.md generation with AI customization.
 */
export async function enhanceAgentsMd(baseAgentsMd, stack, commands, config) {
  if (!config) return null;
  const prompt = buildAgentsPrompt(baseAgentsMd, stack, commands);
  const tokens = estimateTokens(prompt);
  if (tokens > config.maxTokens) return null;
  return callAi(config, prompt, "You are a technical writer specializing in AI agent instructions. Improve the instructions while keeping the same structure.");
}

function buildAgentsPrompt(base, stack, commands) {
  return [
    "Improve this AGENTS.md template for a specific project. Keep the same structure but make it more specific and actionable.",
    `Language: ${stack.languages.join(", ") || "Unknown"}`,
    `Frameworks: ${stack.frameworks.join(", ") || "Unknown"}`,
    `Package manager: ${stack.packageManager}`,
    `Test command: ${commands.test || "none"}`,
    `Build command: ${commands.build || "none"}`,
    "--- CURRENT TEMPLATE ---",
    base,
    "--- END ---",
    "Return the improved AGENTS.md as plain text. Do not add explanations."
  ].join("\n");
}

/**
 * Unified AI call with provider-agnostic interface.
 */
async function callAi(config, prompt, systemPrompt) {
  if (config.provider === "anthropic") {
    return callAnthropic(config, prompt, systemPrompt);
  }
  return callOpenAI(config, prompt, systemPrompt);
}

async function callOpenAI(config, prompt, systemPrompt) {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      max_tokens: config.maxTokens,
      temperature: 0.3
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function callAnthropic(config, prompt, systemPrompt) {
  const res = await fetch(`${config.baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || null;
}

/**
 * Estimate cost of an AI call (approximate, for transparency).
 */
export function estimateCost(provider, model, inputTokens, outputTokens) {
  const pricing = {
    openai: {
      "gpt-4o-mini": { input: 0.15, output: 0.60 }, // per 1M tokens
      "gpt-4o": { input: 2.50, output: 10.00 }
    },
    anthropic: {
      "claude-3-5-haiku-latest": { input: 0.80, output: 4.00 },
      "claude-3-5-sonnet-latest": { input: 3.00, output: 15.00 }
    }
  };
  const rates = (pricing[provider] || {})[model];
  if (!rates) return null;
  const cost = (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
  return parseFloat(cost.toFixed(4));
}
