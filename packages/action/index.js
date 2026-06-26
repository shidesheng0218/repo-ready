import fs from "node:fs";
import { renderReport, scanRepository, VERSION } from "../core/src/index.js";

const lang = process.env.INPUT_LANGUAGE || "en";
const minScore = Number(process.env.INPUT_MIN_SCORE || 0);
const baseRef = process.env.INPUT_BASE_REF || "main";
const compareMode = process.env.INPUT_COMPARE || "false";
const report = await scanRepository({ cwd: process.cwd() });
const markdown = renderReport(report, { lang, format: "markdown" });

let summary = markdown;

if (compareMode === "true") {
  const diffNote = buildScoreDiff(report, baseRef);
  summary = `${markdown}\n\n${diffNote}`;
}

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`, "utf8");
} else {
  console.log(summary);
}

if (report.scores.overall < minScore) {
  console.error(`RepoReady score ${report.scores.overall}/100 is below required minimum ${minScore}/100.`);
  process.exit(1);
}

function buildScoreDiff(report, base) {
  const prev = readPreviousScore();
  if (!prev) return `> No previous RepoReady score found for base \`${base}\`. Run RepoReady on the base branch to enable score diff.`;
  const delta = report.scores.overall - prev.overall;
  const sign = delta > 0 ? "+" : "";
  const emoji = delta > 0 ? "✅" : delta < 0 ? "⚠️" : "➖";
  const lines = [
    `## Score Change vs ${base}`,
    "",
    `| | Before | After | Δ |`,
    `| --- | ---: | ---: | ---: |`,
    `| Overall | ${prev.overall} | ${report.scores.overall} | ${emoji} ${sign}${delta} |`,
    `| Agent Ready | ${prev.agentReady} | ${report.scores.agentReady} | |`,
    `| Contributor Ready | ${prev.contributorReady} | ${report.scores.contributorReady} | |`,
    `| Context Quality | ${prev.contextQuality} | ${report.scores.contextQuality} | |`,
    `| Safety | ${prev.safety} | ${report.scores.safety} | |`,
    "",
    delta < 0 ? "⚠️ **Score decreased.** Review the changes that may have affected agent readiness." : "✅ Score is stable or improved."
  ];
  return lines.join("\n");
}

function readPreviousScore() {
  const path = process.env.REPOREADY_BASELINE || ".repoready-baseline.json";
  try {
    const raw = fs.readFileSync(path, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

if (process.env.REPOREADY_STORE_BASELINE === "true") {
  const baseline = {
    version: VERSION,
    overall: report.scores.overall,
    agentReady: report.scores.agentReady,
    contributorReady: report.scores.contributorReady,
    contextQuality: report.scores.contextQuality,
    safety: report.scores.safety,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(".repoready-baseline.json", JSON.stringify(baseline, null, 2), "utf8");
}
