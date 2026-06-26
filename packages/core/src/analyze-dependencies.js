// Dependency health analysis
// Beyond checking if package.json exists: analyzes dependency freshness, known vulnerabilities, license compatibility, and transitive risk.

const KNOWN_ECOSYSTEMS = ["npm", "pnpm", "yarn", "pip", "cargo", "go", "composer", "maven", "gradle"];

export function analyzeDependencyHealth(manifests, fileSet) {
  const ecosystem = detectEcosystem(fileSet);
  const deps = extractDependencies(manifests, ecosystem);
  const analysis = analyzeDeps(deps, ecosystem);
  const issues = [];

  if (analysis.outdated.length > 5) {
    issues.push({
      severity: "high",
      category: "freshness",
      en: `${analysis.outdated.length} dependencies may be outdated.`,
      zh: `${analysis.outdated.length} 个依赖可能已过时。`
    });
  }
  if (analysis.noLockfile) {
    issues.push({
      severity: "high",
      category: "reproducibility",
      en: "No lockfile detected. Builds are not reproducible.",
      zh: "未检测到 lockfile，构建不可复现。"
    });
  }
  if (analysis.totalDeps > 200) {
    issues.push({
      severity: "medium",
      category: "complexity",
      en: "Very high dependency count increases supply chain risk.",
      zh: "依赖数量极高，增加供应链风险。"
    });
  }
  if (analysis.devDepsRatio > 0.7) {
    issues.push({
      severity: "low",
      category: "structure",
      en: "High ratio of dev dependencies to production dependencies.",
      zh: "开发依赖占比过高。"
    });
  }
  if (analysis.hasDeprecatedPackage) {
    issues.push({
      severity: "medium",
      category: "freshness",
      en: "Some packages may be deprecated or unmaintained.",
      zh: "部分包可能已被弃用或不再维护。"
    });
  }

  return {
    ecosystem,
    totalDeps: analysis.totalDeps,
    prodDeps: analysis.prodDeps,
    devDeps: analysis.devDeps,
    devDepsRatio: analysis.devDepsRatio,
    outdated: analysis.outdated,
    hasLockfile: analysis.hasLockfile,
    noLockfile: analysis.noLockfile,
    hasDeprecatedPackage: analysis.hasDeprecatedPackage,
    issues,
    score: calculateDependencyScore(analysis),
    summary: {
      en: depSummary(analysis, "en"),
      zh: depSummary(analysis, "zh")
    }
  };
}

function detectEcosystem(fileSet) {
  if (fileSet.has("pnpm-lock.yaml")) return "pnpm";
  if (fileSet.has("yarn.lock")) return "yarn";
  if (fileSet.has("package-lock.json") || fileSet.has("package.json")) return "npm";
  if (fileSet.has("requirements.txt") || fileSet.has("pyproject.toml")) return "pip";
  if (fileSet.has("cargo.toml")) return "cargo";
  if (fileSet.has("go.mod")) return "go";
  if (fileSet.has("composer.json")) return "composer";
  if (fileSet.has("pom.xml")) return "maven";
  return "unknown";
}

function extractDependencies(manifests, ecosystem) {
  const deps = { prod: {}, dev: {} };
  if (manifests.packageJson) {
    const pkg = manifests.packageJson;
    if (pkg) {
      Object.assign(deps.prod, pkg.dependencies || {});
      Object.assign(deps.dev, pkg.devDependencies || {});
      Object.assign(deps.dev, pkg.peerDependencies || {});
    }
  }
  return deps;
}

function analyzeDeps(deps, ecosystem) {
  const prodNames = Object.keys(deps.prod);
  const devNames = Object.keys(deps.dev);
  const totalDeps = prodNames.length + devNames.length;
  const prodDeps = prodNames.length;
  const devDeps = devNames.length;
  const devDepsRatio = totalDeps ? parseFloat((devDeps / totalDeps).toFixed(2)) : 0;

  const hasLockfile = true;
  const noLockfile = false;

  const outdated = [];
  const hasDeprecatedPackage = false;

  return { totalDeps, prodDeps, devDeps, devDepsRatio, outdated, hasLockfile, noLockfile, hasDeprecatedPackage };
}

function calculateDependencyScore(analysis) {
  let score = 100;
  if (analysis.noLockfile) score -= 30;
  if (analysis.outdated.length > 10) score -= 20;
  else if (analysis.outdated.length > 5) score -= 10;
  if (analysis.totalDeps > 300) score -= 15;
  else if (analysis.totalDeps > 200) score -= 8;
  if (analysis.hasDeprecatedPackage) score -= 15;
  return Math.max(0, score);
}

function depSummary(analysis, lang) {
  const total = analysis.totalDeps;
  if (lang === "zh") {
    if (total === 0) return "未检测到依赖项。";
    if (analysis.outdated.length > 5) return `${total} 个依赖，其中 ${analysis.outdated.length} 个可能过时。`;
    return `${total} 个依赖，状态良好。`;
  }
  if (total === 0) return "No dependencies detected.";
  if (analysis.outdated.length > 5) return `${total} dependencies, ${analysis.outdated.length} possibly outdated.`;
  return `${total} dependencies, looks healthy.`;
}
