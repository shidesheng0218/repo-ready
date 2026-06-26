// AI Strategy Engine for RepoReady
//
// This is the "brain" of AI enhancement. It decides:
//   1. Whether to call AI at all (cost/benefit analysis)
//   2. Which problems deserve AI attention (triage)
//   3. Which model to use for each problem (routing)
//   4. How much budget to allocate per call (budgeting)
//   5. What order to process problems (prioritization)
//
// Architecture:
//   Rule Engine → Deep Analysis → Strategy Engine → AI Enhancer → Report
//                                      ↑
//                              User Policy (.repoready.json)
//
// Design principles:
//   - AI is a scarce resource, not a default
//   - Every AI call must have a clear ROI
//   - Budget is transparent and enforced
//   - Strategy degrades gracefully when AI is unavailable

import { estimateTokens } from "./ai-enhancer.js";

// ─── Default strategy ────────────────────────────────────────────────

const DEFAULT_STRATEGY = {
  budget: 0.01,                    // max USD per scan
  maxTokens: 4000,                 // max tokens per call
  maxCalls: 5,                     // max AI calls per scan
  enabled: true,                   // master switch

  // Module-level rules
  modules: {
    readme: {
      enabled: true,
      threshold: 60,               // only enhance if score < 60
      priority: "medium",          // critical > high > medium > low
      model: "gpt-4o-mini",        // default model
      maxTokens: 2000,
      description: "README quality enhancement"
    },
    tasks: {
      enabled: true,
      threshold: 5,                // only enhance if fewer than 5 tasks
      priority: "low",
      model: "gpt-4o-mini",
      maxTokens: 1500,
      description: "Task graph enhancement"
    },
    agentsMd: {
      enabled: true,
      threshold: 0,                // always enhance if AGENTS.md needs generation
      priority: "high",
      model: "gpt-4o-mini",
      maxTokens: 2000,
      description: "AGENTS.md customization"
    },
    safety: {
      enabled: true,
      threshold: 0,                // always enhance if safety issues found
      priority: "critical",
      model: "gpt-4o",             // use stronger model for safety
      maxTokens: 1500,
      description: "Safety boundary analysis"
    },
    dependencies: {
      enabled: true,
      threshold: 50,               // only enhance if score < 50
      priority: "low",
      model: "gpt-4o-mini",
      maxTokens: 1000,
      description: "Dependency health analysis"
    }
  },

  // Multi-model routing
  models: {
    "gpt-4o-mini": {
      provider: "openai",
      costPer1KInput: 0.00015,
      costPer1KOutput: 0.00060,
      quality: "good",
      speed: "fast",
      description: "Best for general analysis, low cost"
    },
    "gpt-4o": {
      provider: "openai",
      costPer1KInput: 0.00250,
      costPer1KOutput: 0.01000,
      quality: "excellent",
      speed: "medium",
      description: "Best for complex reasoning, safety analysis"
    },
    "claude-3-5-haiku-latest": {
      provider: "anthropic",
      costPer1KInput: 0.00080,
      costPer1KOutput: 0.00400,
      quality: "good",
      speed: "fast",
      description: "Best for documentation, language tasks"
    },
    "claude-3-5-sonnet-latest": {
      provider: "anthropic",
      costPer1KInput: 0.00300,
      costPer1KOutput: 0.01500,
      quality: "excellent",
      speed: "medium",
      description: "Best for complex code analysis"
    }
  }
};

// ─── Strategy engine ─────────────────────────────────────────────────

/**
 * Load user strategy, merging with defaults.
 * Looks for .repoready.json in cwd, then falls back to defaults.
 */
export function loadStrategy(userPolicy = null) {
  if (!userPolicy) return deepClone(DEFAULT_STRATEGY);
  return deepMerge(DEFAULT_STRATEGY, userPolicy);
}

/**
 * Evaluate: given the deep analysis results, what AI calls should we make?
 * Returns a battle plan: an ordered list of AI calls with assigned models and budgets.
 */
export function evaluateStrategy(deepAnalysis, fixes, strategy = null) {
  const config = strategy || DEFAULT_STRATEGY;
  if (!config.enabled) return { plan: [], budget: config.budget, remaining: config.budget, decisions: [] };

  const decisions = [];
  let remainingBudget = config.budget;
  let callCount = 0;

  // Phase 1: Triage — score each module for AI worthiness
  const candidates = triageModules(deepAnalysis, fixes, config);

  // Phase 2: Prioritize — sort by impact × urgency
  candidates.sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority));

  // Phase 3: Budget — allocate budget to highest-priority candidates
  const plan = [];
  for (const candidate of candidates) {
    if (callCount >= config.maxCalls) {
      decisions.push({ module: candidate.module, decision: "skipped", reason: "Max AI calls reached" });
      continue;
    }
    if (remainingBudget <= 0) {
      decisions.push({ module: candidate.module, decision: "skipped", reason: "Budget exhausted" });
      continue;
    }

    const moduleConfig = config.modules[candidate.module] || {};
    const modelKey = moduleConfig.model || "gpt-4o-mini";
    const modelInfo = config.models[modelKey];
    if (!modelInfo) {
      decisions.push({ module: candidate.module, decision: "skipped", reason: `Unknown model: ${modelKey}` });
      continue;
    }

    const maxTokens = moduleConfig.maxTokens || config.maxTokens;
    const estimatedCost = estimateCallCost(modelInfo, candidate.estimatedInputTokens, maxTokens);

    if (estimatedCost > remainingBudget) {
      decisions.push({
        module: candidate.module,
        decision: "deferred",
        reason: `Cost $${estimatedCost.toFixed(4)} exceeds remaining budget $${remainingBudget.toFixed(4)}`
      });
      continue;
    }

    plan.push({
      module: candidate.module,
      priority: candidate.priority,
      model: modelKey,
      provider: modelInfo.provider,
      maxTokens,
      estimatedCost,
      estimatedInputTokens: candidate.estimatedInputTokens,
      reason: candidate.reason,
      score: candidate.score
    });

    remainingBudget -= estimatedCost;
    callCount++;
    decisions.push({
      module: candidate.module,
      decision: "approved",
      model: modelKey,
      estimatedCost: `$${estimatedCost.toFixed(4)}`,
      priority: candidate.priority
    });
  }

  return {
    plan,
    budget: config.budget,
    remaining: parseFloat(remainingBudget.toFixed(4)),
    totalEstimatedCost: parseFloat((config.budget - remainingBudget).toFixed(4)),
    callsPlanned: plan.length,
    decisions
  };
}

/**
 * Triage: score each module for AI worthiness.
 * Returns candidates with scores and priorities.
 */
function triageModules(deepAnalysis, fixes, config) {
  const candidates = [];

  // README quality
  if (config.modules.readme?.enabled && deepAnalysis.readmeQuality) {
    const score = deepAnalysis.readmeQuality.score;
    const threshold = config.modules.readme.threshold ?? 60;
    if (score < threshold && score > 0) {
      const impact = Math.max(0, threshold - score);
      candidates.push({
        module: "readme",
        priority: config.modules.readme.priority || "medium",
        score: impact,
        reason: `README score ${score} < threshold ${threshold}`,
        estimatedInputTokens: estimateTokens(JSON.stringify(deepAnalysis.readmeQuality))
      });
    }
  }

  // Safety boundaries
  if (config.modules.safety?.enabled && deepAnalysis.safetyBoundaries) {
    const safetyScore = deepAnalysis.safetyBoundaries.score;
    const threshold = config.modules.safety.threshold ?? 0;
    if (safetyScore < threshold || deepAnalysis.safetyBoundaries.criticalFiles.length > 0) {
      candidates.push({
        module: "safety",
        priority: "critical",
        score: 100,
        reason: "Safety issues detected — mandatory AI review",
        estimatedInputTokens: estimateTokens(JSON.stringify(deepAnalysis.safetyBoundaries))
      });
    }
  }

  // Task graph
  if (config.modules.tasks?.enabled && deepAnalysis.taskGraph) {
    const taskCount = deepAnalysis.taskGraph.totalTasks;
    const threshold = config.modules.tasks.threshold ?? 5;
    if (taskCount < threshold) {
      candidates.push({
        module: "tasks",
        priority: config.modules.tasks.priority || "low",
        score: Math.max(0, threshold - taskCount) * 10,
        reason: `Only ${taskCount} tasks identified, could benefit from AI`,
        estimatedInputTokens: estimateTokens(JSON.stringify(deepAnalysis.taskGraph))
      });
    }
  }

  // AGENTS.md
  if (config.modules.agentsMd?.enabled) {
    const agentsMdChange = fixes.changes.find((c) => c.path === "AGENTS.md");
    if (agentsMdChange) {
      candidates.push({
        module: "agentsMd",
        priority: config.modules.agentsMd.priority || "high",
        score: 80,
        reason: "AGENTS.md needs generation or update",
        estimatedInputTokens: estimateTokens(agentsMdChange.content)
      });
    }
  }

  // Dependencies
  if (config.modules.dependencies?.enabled && deepAnalysis.dependencyHealth) {
    const depScore = deepAnalysis.dependencyHealth.score;
    const threshold = config.modules.dependencies.threshold ?? 50;
    if (depScore < threshold && depScore > 0) {
      candidates.push({
        module: "dependencies",
        priority: config.modules.dependencies.priority || "low",
        score: Math.max(0, threshold - depScore),
        reason: `Dependency health score ${depScore} < threshold ${threshold}`,
        estimatedInputTokens: estimateTokens(JSON.stringify(deepAnalysis.dependencyHealth))
      });
    }
  }

  return candidates;
}

/**
 * Estimate cost of a single AI call.
 */
function estimateCallCost(modelInfo, inputTokens, maxOutputTokens) {
  const inputCost = (inputTokens / 1000) * modelInfo.costPer1KInput;
  const outputCost = (maxOutputTokens / 1000) * modelInfo.costPer1KOutput;
  return inputCost + outputCost;
}

function priorityWeight(priority) {
  const weights = { critical: 100, high: 70, medium: 40, low: 10 };
  return weights[priority] || 0;
}

// ─── Strategy-aware AI execution ─────────────────────────────────────

/**
 * Execute the strategy plan: call AI for each approved module in priority order.
 * Returns enhanced results merged with the original analysis.
 */
export async function executeStrategyPlan(plan, deepAnalysis, fixes, stack, commands, enhancerFunctions) {
  if (!plan || !plan.length) return { results: {}, summary: "No AI calls in plan." };

  const results = {};
  let totalCost = 0;
  let totalTokens = 0;
  const executed = [];
  const failed = [];

  for (const item of plan) {
    try {
      const moduleFn = enhancerFunctions[item.module];
      if (!moduleFn) {
        failed.push({ module: item.module, reason: "No enhancer function" });
        continue;
      }

      const result = await moduleFn(deepAnalysis, fixes, stack, commands, item);
      if (result) {
        results[item.module] = result;
        totalCost += item.estimatedCost;
        totalTokens += item.estimatedInputTokens + item.maxTokens;
        executed.push(item.module);
      }
    } catch (error) {
      failed.push({ module: item.module, reason: error.message });
    }
  }

  return {
    results,
    executed,
    failed,
    totalEstimatedCost: parseFloat(totalCost.toFixed(4)),
    totalTokens,
    summary: `${executed.length} AI calls executed, ${failed.length} failed. Estimated cost: $${totalCost.toFixed(4)}`
  };
}

/**
 * Generate a human-readable strategy report.
 */
export function renderStrategyReport(strategyResult, lang = "en") {
  const zh = lang === "zh";
  const t = (en, cn) => (zh ? cn : en);
  const lines = [];

  lines.push(t("AI Strategy Report", "AI 策略报告"));
  lines.push(`Budget: $${strategyResult.budget} | ${t("Used", "已用")}: $${strategyResult.totalEstimatedCost} | ${t("Remaining", "剩余")}: $${strategyResult.remaining}`);
  lines.push(`Calls: ${strategyResult.callsPlanned} ${t("planned", "计划")}`);
  lines.push("");

  for (const decision of strategyResult.decisions) {
    const icon = decision.decision === "approved" ? "✓" : decision.decision === "deferred" ? "⏸" : "✗";
    const label = t(
      `${decision.module}: ${decision.decision}${decision.estimatedCost ? ` (${decision.estimatedCost})` : ""}`,
      `${decision.module}: ${decision.decision === "approved" ? "已批准" : decision.decision === "deferred" ? "已推迟" : "已跳过"}${decision.estimatedCost ? ` (${decision.estimatedCost})` : ""}`
    );
    lines.push(`  ${icon} ${label}`);
    if (decision.reason) lines.push(`    ${decision.reason}`);
  }

  return lines.join("\n");
}

// ─── Utilities ───────────────────────────────────────────────────────

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function deepMerge(base, override) {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (override[key] && typeof override[key] === "object" && !Array.isArray(override[key]) && base[key]) {
      result[key] = deepMerge(base[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

/**
 * Load user policy from .repoready.json if it exists.
 */
export async function loadUserPolicy(cwd) {
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const policyPath = path.join(cwd || process.cwd(), ".repoready.json");
    const content = await fs.readFile(policyPath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
