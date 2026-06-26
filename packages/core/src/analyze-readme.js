// README structural quality analysis
// Beyond keyword matching: evaluates structure, readability, completeness, target audience, and maintenance signals.

export function analyzeReadmeQuality(content) {
  if (!content || !content.trim()) {
    return {
      score: 0,
      sections: [],
      missingSections: [
        "title",
        "description",
        "install",
        "usage",
        "testing",
        "contributing",
        "license"
      ],
      issues: [
        {
          severity: "high",
          category: "completeness",
          en: "README is missing or empty.",
          zh: "README 缺失或为空。"
        }
      ],
      audience: "unknown",
      grade: "F",
      summary: {
        en: "README is missing or empty. Add install, usage, testing, and contribution sections.",
        zh: "README 缺失或为空。建议补充安装、使用、测试和贡献说明。"
      }
    };
  }

  const sections = detectSections(content);
  const readability = analyzeReadability(content);
  const audience = detectAudience(content);
  const maintenance = detectMaintenance(content);
  const issues = [];

  // Section completeness scoring
  const expectedSections = [
    { key: "title", weight: 10, patterns: [/^#\s+\S+/m] },
    { key: "description", weight: 10, patterns: [/^#\s+\S+[\s\S]{20,}/m] },
    { key: "badges", weight: 5, patterns: [/!\[.*?\]\(.*?\)|img\.shields\.io/] },
    { key: "install", weight: 15, patterns: [/##\s*(Install|安装|Setup|Getting Started|Quick Start)/i, /```(bash|sh|shell|powershell|zsh)[\s\S]*?```/] },
    { key: "usage", weight: 15, patterns: [/##\s*(Usage|用法|Example|Quick Start)/i, /##\s*(API|Configuration|Config)/i] },
    { key: "demo", weight: 8, patterns: [/!\[.*?\]\(.*?(png|gif|jpg|svg|webp)/i, /(demo|screenshot|preview|演示|截图)/i] },
    { key: "testing", weight: 10, patterns: [/##\s*(Test|Testing|测试)/i, /```[^`]*(test|spec|pytest|go test)[^`]*```/i] },
    { key: "contributing", weight: 8, patterns: [/##\s*(Contribut|贡献|参与)/i, /(pull request|PR|issue|贡献)/i] },
    { key: "license", weight: 5, patterns: [/##\s*(License|许可证)/i, /(MIT|Apache|GPL|BSD|license)/i] },
    { key: "roadmap", weight: 4, patterns: [/##\s*(Roadmap|路线图|TODO|Changelog)/i, /-\s*\[[ x]\]/] },
    { key: "contact", weight: 3, patterns: [/(twitter|discord|slack|email|mailto|联系)/i] },
    { key: "acknowledgments", weight: 2, patterns: [/(acknowledg|sponsor|thanks|致谢|赞助)/i] }
  ];

  let sectionScore = 0;
  let maxScore = 0;
  const foundSections = [];
  const missingSections = [];

  for (const section of expectedSections) {
    maxScore += section.weight;
    const found = section.patterns.some((p) => p.test(content));
    if (found) {
      sectionScore += section.weight;
      foundSections.push(section.key);
    } else {
      missingSections.push(section.key);
    }
  }

  // Deductions for poor quality
  if (readability.fleschScore < 30) {
    issues.push({ severity: "medium", category: "readability", en: "README is very dense and hard to read.", zh: "README 过于密集，可读性较差。" });
    sectionScore -= 5;
  }
  if (readability.avgParagraphLength > 200) {
    issues.push({ severity: "low", category: "readability", en: "Long paragraphs reduce scannability.", zh: "段落过长，降低可扫读性。" });
    sectionScore -= 3;
  }
  if (content.length < 200) {
    issues.push({ severity: "high", category: "completeness", en: "README is too short to be useful.", zh: "README 过短，实用性不足。" });
    sectionScore -= 10;
  }
  if (content.length > 20000) {
    issues.push({ severity: "low", category: "completeness", en: "README is very long. Consider moving details to docs.", zh: "README 过长，建议将细节移至文档。" });
  }
  if (!maintenance.recentUpdate) {
    issues.push({ severity: "low", category: "maintenance", en: "No recent version or changelog signal found.", zh: "未发现近期版本或更新日志信号。" });
    sectionScore -= 3;
  }

  const finalScore = Math.max(0, Math.min(100, Math.round((sectionScore / maxScore) * 100)));
  const grade = scoreToGrade(finalScore);

  return {
    score: finalScore,
    grade,
    sections: foundSections,
    missingSections,
    readability,
    audience,
    maintenance,
    issues,
    summary: {
      en: gradeSummary(finalScore, sectionScore, "en"),
      zh: gradeSummary(finalScore, sectionScore, "zh")
    }
  };
}

function detectSections(content) {
  const headings = [...content.matchAll(/^#{1,3}\s+(.+)$/gm)];
  return headings.map((m) => m[1].trim());
}

function analyzeReadability(content) {
  const sentences = content.split(/[.!?。！？]+/).filter(Boolean);
  const words = content.split(/\s+/).filter(Boolean);
  const paragraphs = content.split(/\n{2,}/).filter(Boolean);
  const avgSentenceLength = sentences.length ? Math.round(words.length / sentences.length) : 0;
  const avgParagraphLength = paragraphs.length ? Math.round(content.length / paragraphs.length) : 0;
  const codeBlockRatio = (content.match(/```/g) || []).length / 2 / Math.max(1, paragraphs.length);
  const linkDensity = (content.match(/\[.*?\]\(.*?\)/g) || []).length / Math.max(1, paragraphs.length);
  const fleschScore = Math.max(0, Math.min(100, 206.835 - 1.015 * (words.length / Math.max(1, sentences.length)) - 84.6 * (1)));

  return {
    sentences: sentences.length,
    words: words.length,
    paragraphs: paragraphs.length,
    avgSentenceLength,
    avgParagraphLength,
    codeBlockRatio: parseFloat(codeBlockRatio.toFixed(2)),
    linkDensity: parseFloat(linkDensity.toFixed(2)),
    fleschScore: Math.round(fleschScore)
  };
}

function detectAudience(content) {
  const signals = [];
  if (/developer|dev|programmer|engineer|开发者|工程师|程序员/i.test(content)) signals.push("developers");
  if (/end.user|user|customer|client|用户|客户/i.test(content)) signals.push("end-users");
  if (/beginner|newcomer|novice|simple|easy|新手|入门|简单/i.test(content)) signals.push("beginners");
  if (/advanced|expert|internal|内部|高级/i.test(content)) signals.push("advanced");
  if (/api|cli|sdk|library|package|库|包|接口/i.test(content)) signals.push("api-consumers");
  if (/open.source|community|开源|社区/i.test(content)) signals.push("open-source");
  const language = /[\u4e00-\u9fff]/.test(content) ? "mixed" : "english";
  return { signals: signals.length ? signals : ["general"], language };
}

function detectMaintenance(content) {
  const hasVersion = /v?\d+\.\d+\.\d+/.test(content);
  const hasChangelog = /changelog|release|更新日志|发版/i.test(content);
  const hasNpmVersion = /npm\s+(install|i)\s+\S+@\d/.test(content);
  const hasRecentUpdate = /(202[4-9]|202\d)/.test(content);
  return { hasVersion, hasChangelog, hasNpmVersion, recentUpdate: hasRecentUpdate || hasVersion };
}

function scoreToGrade(score) {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

function gradeSummary(score, raw, lang) {
  if (lang === "zh") {
    if (score >= 90) return "README 结构完整，可读性好，维护信号清晰。";
    if (score >= 70) return "README 基本可用，但缺少部分关键章节。";
    if (score >= 50) return "README 存在明显缺失，建议补充核心章节。";
    return "README 严重不足，几乎无法为新用户提供有效指引。";
  }
  if (score >= 90) return "README is well-structured, readable, and well-maintained.";
  if (score >= 70) return "README is usable but missing some key sections.";
  if (score >= 50) return "README has notable gaps. Add core sections to improve it.";
  return "README is severely inadequate. Add essential sections.";
}
