// Agent safety boundary detection
// Beyond regex matching: identifies files/directories that should NEVER be modified by AI agents,
// and evaluates the overall safety posture of the repository.

const CRITICAL_FILES = [
  { pattern: /^\.env$/, reason: "environment secrets", severity: "critical" },
  { pattern: /^\.env\.(?!example$|sample$)/, reason: "environment secrets", severity: "critical" },
  { pattern: /(^|\/)\.git\/?$/, reason: "git internals", severity: "critical" },
  { pattern: /(^|\/)\.git\//, reason: "git internals", severity: "critical" },
  { pattern: /(^|\/)\.(htaccess|htpasswd)$/, reason: "server access control", severity: "critical" },
  { pattern: /(^|\/)credentials\./, reason: "credential file", severity: "critical" },
  { pattern: /(^|\/)secrets\./, reason: "secret file", severity: "critical" },
  { pattern: /(^|\/)\.npmrc$/, reason: "npm auth token", severity: "high" },
  { pattern: /(^|\/)\.docker\/config\.json$/, reason: "docker registry auth", severity: "high" },
  { pattern: /(^|\/)(id_rsa|id_ed25519|id_ecdsa)/, reason: "SSH private key", severity: "critical" },
  { pattern: /(^|\/)\.pem$/, reason: "certificate or private key", severity: "critical" },
  { pattern: /(^|\/)\.aws\/credentials/, reason: "AWS credentials", severity: "critical" },
  { pattern: /(^|\/)\.gcloud\/credentials/, reason: "GCP credentials", severity: "critical" },
  { pattern: /(^|\/)service-account\.json/, reason: "service account key", severity: "critical" }
];

const RISKY_PATHS = [
  { pattern: /(^|\/)(deploy|release|publish)(\.sh|\.ps1|\.bash)?$/i, reason: "deployment scripts", severity: "high" },
  { pattern: /(^|\/)(migrate|migration|seed)(\.sh|\.js|\.ts|\.py)?$/i, reason: "database migration", severity: "high" },
  { pattern: /(^|\/)(backup|restore)(\.sh|\.js|\.ts|\.py)?$/i, reason: "backup/restore", severity: "high" },
  { pattern: /(^|\/)(terraform|\.tf|\.tfvars)/, reason: "infrastructure as code", severity: "high" },
  { pattern: /(^|\/)(k8s|kubernetes|helm)/, reason: "kubernetes config", severity: "high" }
];

export function analyzeSafetyBoundaries(fileSet, dangerousScripts, repoHealth) {
  const criticalFiles = [];
  const riskyPaths = [];
  const issues = [];

  // Detect critical files that should never be modified
  for (const file of fileSet) {
    const normalized = file.toLowerCase();
    for (const rule of CRITICAL_FILES) {
      if (rule.pattern.test(normalized)) {
        criticalFiles.push({ file, reason: rule.reason, severity: rule.severity });
      }
    }
    for (const rule of RISKY_PATHS) {
      if (rule.pattern.test(normalized)) {
        riskyPaths.push({ file, reason: rule.reason, severity: rule.severity });
      }
    }
  }

  if (criticalFiles.length > 0) {
    issues.push({
      severity: "critical",
      category: "secrets",
      en: `${criticalFiles.length} critical file(s) found that should never be exposed to AI agents.`,
      zh: `发现 ${criticalFiles.length} 个关键文件，绝不应暴露给 AI agent。`
    });
  }
  if (riskyPaths.length > 3) {
    issues.push({
      severity: "high",
      category: "infrastructure",
      en: `${riskyPaths.length} risky path(s) detected. AI agents should not modify these without review.`,
      zh: `检测到 ${riskyPaths.length} 个高风险路径，AI agent 不应在未经审查时修改。`
    });
  }
  if (repoHealth.envFiles.length > 0) {
    issues.push({
      severity: "critical",
      category: "env",
      en: "Environment files committed to repository. Remove immediately.",
      zh: "环境变量文件已提交到仓库，请立即移除。"
    });
  }
  if (dangerousScripts.length > 0) {
    issues.push({
      severity: "high",
      category: "scripts",
      en: `${dangerousScripts.length} dangerous script(s) detected. Document safe usage.`,
      zh: `检测到 ${dangerousScripts.length} 个危险脚本，请说明安全使用方式。`
    });
  }

  const score = calculateSafetyScore(criticalFiles, riskyPaths, dangerousScripts, repoHealth);

  // Generate agent safety boundary recommendations
  const boundaries = generateBoundaries(criticalFiles, riskyPaths);

  return {
    score,
    criticalFiles,
    riskyPaths,
    issues,
    boundaries,
    summary: {
      en: safetySummary(score, "en"),
      zh: safetySummary(score, "zh")
    }
  };
}

function calculateSafetyScore(criticalFiles, riskyPaths, dangerousScripts, repoHealth) {
  let score = 100;
  if (criticalFiles.length > 0) score -= criticalFiles.length * 20;
  if (riskyPaths.length > 5) score -= 15;
  else if (riskyPaths.length > 3) score -= 8;
  if (dangerousScripts.length > 3) score -= 20;
  else if (dangerousScripts.length > 0) score -= dangerousScripts.length * 5;
  if (repoHealth.envFiles.length > 0) score -= 30;
  return Math.max(0, score);
}

function generateBoundaries(criticalFiles, riskyPaths) {
  const boundaries = [];
  if (criticalFiles.length > 0) {
    boundaries.push({
      en: "Never modify these files: " + criticalFiles.map((f) => f.file).join(", "),
      zh: "绝不要修改这些文件：" + criticalFiles.map((f) => f.file).join("、")
    });
  }
  if (riskyPaths.length > 0) {
    boundaries.push({
      en: "Review before modifying: " + riskyPaths.slice(0, 5).map((f) => f.file).join(", "),
      zh: "修改前需审查：" + riskyPaths.slice(0, 5).map((f) => f.file).join("、")
    });
  }
  return boundaries;
}

function safetySummary(score, lang) {
  if (lang === "zh") {
    if (score >= 90) return "安全态势良好，未发现关键风险。";
    if (score >= 70) return "存在一些需注意的风险点。";
    if (score >= 50) return "存在高风险文件或脚本，建议立即修复。";
    return "安全态势严重，存在关键文件暴露或危险脚本。";
  }
  if (score >= 90) return "Strong safety posture. No critical risks detected.";
  if (score >= 70) return "Some risk points to address.";
  if (score >= 50) return "High-risk files or scripts detected. Fix immediately.";
  return "Critical safety issues. Secrets or dangerous scripts are exposed.";
}
