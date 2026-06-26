// Repository task graph generation
// Beyond generic suggestions: analyzes project structure and generates concrete, repository-specific agent tasks.

export function analyzeTaskGraph(stack, commands, fileSet, readmeSignals, agentFiles, issues) {
  const tasks = [];
  const language = stack.languages[0] || "Unknown";

  // Documentation tasks
  if (!agentFiles.agentsMd) {
    tasks.push({
      priority: "high",
      category: "documentation",
      en: `Create AGENTS.md with ${language} project structure, ${stack.packageManager} commands, and safety rules.`,
      zh: `创建 AGENTS.md，说明 ${language} 项目结构、${stack.packageManager} 命令和安全规则。`,
      estimatedMinutes: 15
    });
  }
  if (!readmeSignals.hasInstall) {
    tasks.push({
      priority: "high",
      category: "documentation",
      en: "Add Installation section to README with exact commands for this project.",
      zh: "在 README 中添加安装章节，包含本项目的具体命令。",
      estimatedMinutes: 10
    });
  }
  if (!readmeSignals.hasDemo) {
    tasks.push({
      priority: "medium",
      category: "documentation",
      en: "Add a screenshot or terminal recording demo to README.",
      zh: "在 README 中添加截图或终端录屏演示。",
      estimatedMinutes: 20
    });
  }

  // Testing tasks
  if (!commands.test) {
    tasks.push({
      priority: "high",
      category: "testing",
      en: `Add a test command and at least one test file for the ${language} project.`,
      zh: `为 ${language} 项目添加测试命令和至少一个测试文件。`,
      estimatedMinutes: 30
    });
  } else {
    tasks.push({
      priority: "medium",
      category: "testing",
      en: `Increase test coverage. Current test command: ${commands.test}.`,
      zh: `提高测试覆盖率。当前测试命令：${commands.test}。`,
      estimatedMinutes: 45
    });
  }

  // CI tasks
  if (!fileSet.has(".github/workflows/repoready.yml")) {
    tasks.push({
      priority: "medium",
      category: "ci",
      en: "Add GitHub Actions workflow with test and RepoReady checks.",
      zh: "添加包含测试和 RepoReady 检查的 GitHub Actions 工作流。",
      estimatedMinutes: 15
    });
  }

  // Language-specific tasks
  if (stack.languages.includes("JavaScript/TypeScript")) {
    tasks.push({
      priority: "medium",
      category: "code-quality",
      en: "Add type coverage improvements. Enable strict TypeScript if applicable.",
      zh: "改进类型覆盖。如适用，启用 TypeScript strict 模式。",
      estimatedMinutes: 60
    });
  }
  if (stack.languages.includes("Python")) {
    tasks.push({
      priority: "medium",
      category: "code-quality",
      en: "Add type hints to public functions and run Ruff for linting.",
      zh: "为公共函数添加类型标注，并运行 Ruff 进行 lint 检查。",
      estimatedMinutes: 45
    });
  }
  if (stack.languages.includes("Rust")) {
    tasks.push({
      priority: "medium",
      category: "code-quality",
      en: "Run cargo clippy and fix warnings. Add documentation tests.",
      zh: "运行 cargo clippy 并修复警告。添加文档测试。",
      estimatedMinutes: 30
    });
  }

  // Safety-related tasks
  if (issues.some((i) => i.id === "dangerous-scripts")) {
    tasks.push({
      priority: "high",
      category: "safety",
      en: "Document dangerous scripts: what they do, when to run them, and who can run them.",
      zh: "文档化危险脚本：说明其作用、运行时机和授权人员。",
      estimatedMinutes: 20
    });
  }
  if (issues.some((i) => i.id === "committed-env-file")) {
    tasks.push({
      priority: "critical",
      category: "safety",
      en: "Remove committed .env files, rotate exposed secrets, and add .env.example.",
      zh: "移除已提交的 .env 文件，轮换暴露的密钥，并添加 .env.example。",
      estimatedMinutes: 15
    });
  }

  // Code quality tasks
  if (!commands.lint) {
    tasks.push({
      priority: "low",
      category: "code-quality",
      en: "Add a lint command and fix existing lint issues.",
      zh: "添加 lint 命令并修复现有 lint 问题。",
      estimatedMinutes: 30
    });
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const totalMinutes = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

  return {
    tasks,
    totalTasks: tasks.length,
    totalEstimatedMinutes: totalMinutes,
    summary: {
      en: `${tasks.length} concrete agent tasks identified, estimated ${totalMinutes} minutes total.`,
      zh: `识别出 ${tasks.length} 个具体 agent 任务，预计共需 ${totalMinutes} 分钟。`
    }
  };
}
