import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { buildFixPlan, buildUnifiedDiff, scanGitHubRepository } from "@repoready/core";

const CACHE_TTL_MS = Number(process.env.REPOREADY_REPORT_CACHE_TTL_MS || 6 * 60 * 60 * 1000);
const DATA_DIR = process.env.REPOREADY_DATA_DIR || path.join(process.cwd(), "data");

export function parseRepoInput(input) {
  const value = String(input || "").trim();
  const match = value.match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)|^([^/\s]+)\/([^/\s]+)$/i);
  if (!match) return null;
  const owner = (match[1] || match[3] || "").replace(/\.git$/, "");
  const repo = (match[2] || match[4] || "").replace(/\.git$/, "");
  if (!owner || !repo) return null;
  return { owner, repo, fullName: `${owner}/${repo}`, url: `https://github.com/${owner}/${repo}` };
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function reportPath(owner, repo) {
  return path.join(DATA_DIR, "reports", `${owner}__${repo}.json`);
}

export async function scanRepoCached(repoInput, options = {}) {
  const parsed = typeof repoInput === "string" ? parseRepoInput(repoInput) : repoInput;
  if (!parsed) throw new Error("Invalid GitHub repository URL. Use https://github.com/owner/repo");
  const file = reportPath(parsed.owner, parsed.repo);
  if (!options.force) {
    const cached = await readJson(file);
    if (cached?.report && Date.now() - Date.parse(cached.cachedAt || 0) < CACHE_TTL_MS) {
      await recordEvent("report_cache_hit", { repo: parsed.fullName, overall: cached.report.scores?.overall });
      return { ...cached.report, cached: true };
    }
  }
  const report = await scanGitHubRepository(parsed.url, { githubToken: process.env.GITHUB_TOKEN });
  report.repository = { ...report.repository, owner: parsed.owner, repo: parsed.repo, fullName: parsed.fullName, url: parsed.url };
  await writeJson(file, { cachedAt: new Date().toISOString(), report });
  await recordEvent("report_scanned", { repo: parsed.fullName, overall: report.scores?.overall, agentReady: report.scores?.agentReady });
  await upsertIndexEntry(report);
  return { ...report, cached: false };
}

export async function readReport(owner, repo) {
  const cached = await readJson(reportPath(owner, repo));
  return cached?.report || null;
}

export async function recordEvent(type, payload = {}) {
  const dir = path.join(DATA_DIR, "events");
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(path.join(dir, "events.jsonl"), `${JSON.stringify({ type, ...payload, at: new Date().toISOString() })}\n`, "utf8");
}

export async function upsertIndexEntry(report) {
  const file = path.join(DATA_DIR, "index", "latest.json");
  const current = (await readJson(file)) || { entries: [], updatedAt: null };
  const repo = report.repository.fullName || report.repository.name;
  const nextEntry = {
    repo,
    url: report.repository.url || `https://github.com/${repo}`,
    overall: report.scores.overall,
    agentReady: report.scores.agentReady,
    contributorReady: report.scores.contributorReady,
    contextQuality: report.scores.contextQuality,
    safety: report.scores.safety,
    codeQuality: report.scores.codeQuality,
    issues: report.issues.length,
    fixes: report.fixes.changes.length,
    hasAgentInstructions: Boolean(report.agentFiles?.any),
    hasTestCommand: Boolean(report.commands?.test),
    dangerousScripts: report.dangerousScripts.length,
    scannedAt: new Date().toISOString()
  };
  const entries = [nextEntry, ...current.entries.filter((entry) => entry.repo !== repo)]
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 1000);
  await writeJson(file, { entries, updatedAt: new Date().toISOString() });
}

export async function readIndex() {
  return (await readJson(path.join(DATA_DIR, "index", "latest.json"))) || { entries: [], updatedAt: null };
}

export function buildReportLinks(report) {
  const fullName = report.repository.fullName || report.repository.name;
  const [owner, repo] = fullName.split("/");
  const base = siteUrl();
  return {
    publicUrl: `${base}/r/${owner}/${repo}`,
    badgeUrl: `${base}/badge/${owner}/${repo}.svg`,
    shareCardUrl: `${base}/share-card/${owner}/${repo}.svg`,
    githubUrl: `https://github.com/${owner}/${repo}`
  };
}

export function buildSocialCopy(report) {
  const links = buildReportLinks(report);
  const fullName = report.repository.fullName || report.repository.name;
  return {
    x: `I scanned ${fullName} with RepoReady. Agent Ready: ${report.scores.agentReady}/100. ${links.publicUrl}`,
    hackerNews: `Show HN: RepoReady – Check if your repo is ready for AI coding agents`,
    reddit: `I built/used RepoReady to check whether ${fullName} is ready for Codex, Claude Code, Cursor, and contributors: ${links.publicUrl}`,
    zh: `我用 RepoReady 扫描了 ${fullName}，AI Agent Ready 得分 ${report.scores.agentReady}/100。报告：${links.publicUrl}`
  };
}

export function getGitHubAppInstallUrl(repoFullName) {
  if (process.env.GITHUB_APP_INSTALL_URL) return process.env.GITHUB_APP_INSTALL_URL;
  const slug = process.env.GITHUB_APP_SLUG;
  if (!slug) return null;
  const state = Buffer.from(JSON.stringify({ repo: repoFullName })).toString("base64url");
  return `https://github.com/apps/${slug}/installations/new?state=${state}`;
}

export async function createFixPullRequest({ repoInput, installationId }) {
  const parsed = parseRepoInput(repoInput);
  if (!parsed) throw new Error("Invalid repository.");
  const report = await scanRepoCached(parsed, { force: true });
  const plan = buildFixPlan(report);
  const changes = [...plan.safe, ...plan.review];
  const diff = buildUnifiedDiff(changes);
  if (!changes.length) return { ok: true, skipped: true, message: "No fixes required.", report, diff };

  if (!hasGitHubAppConfig() || !installationId) {
    return {
      ok: false,
      needsInstallation: true,
      installUrl: getGitHubAppInstallUrl(parsed.fullName),
      diff,
      report,
      message: "GitHub App is not installed or not configured. Showing patch preview instead."
    };
  }

  const token = await getInstallationToken(installationId);
  const branch = `repoready/fixes-${Date.now()}`;
  const repoApi = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
  const headers = githubHeaders(token);
  const repoMeta = await ghJson(`${repoApi}`, { headers });
  const baseBranch = repoMeta.default_branch || "main";
  const baseRef = await ghJson(`${repoApi}/git/ref/heads/${encodeURIComponent(baseBranch)}`, { headers });
  const baseSha = baseRef.object.sha;
  await ghJson(`${repoApi}/git/refs`, { method: "POST", headers, body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }) });

  const baseCommit = await ghJson(`${repoApi}/git/commits/${baseSha}`, { headers });
  const tree = await Promise.all(changes.map(async (change) => ({
    path: change.path,
    mode: "100644",
    type: "blob",
    content: change.content
  })));
  const newTree = await ghJson(`${repoApi}/git/trees`, { method: "POST", headers, body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }) });
  const commit = await ghJson(`${repoApi}/git/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: "Make repository AI-agent ready with RepoReady",
      tree: newTree.sha,
      parents: [baseSha]
    })
  });
  await ghJson(`${repoApi}/git/refs/heads/${branch}`, { method: "PATCH", headers, body: JSON.stringify({ sha: commit.sha }) });
  const pr = await ghJson(`${repoApi}/pulls`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "Make repository AI-agent ready with RepoReady",
      head: branch,
      base: baseBranch,
      body: buildPrBody(report, plan)
    })
  });
  await recordEvent("fix_pr_created", { repo: parsed.fullName, pr: pr.html_url, changes: changes.length });
  return { ok: true, pullRequestUrl: pr.html_url, branch, changes: changes.map((c) => c.path), report, diff };
}

function hasGitHubAppConfig() {
  return Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
}

async function getInstallationToken(installationId) {
  const appJwt = createAppJwt();
  const res = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: githubHeaders(appJwt)
  });
  if (!res.ok) throw new Error(`GitHub installation token failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  return body.token;
}

function createAppJwt() {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now - 60, exp: now + 9 * 60, iss: process.env.GITHUB_APP_ID };
  const header = { alg: "RS256", typ: "JWT" };
  const encoded = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const key = String(process.env.GITHUB_APP_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const signature = crypto.createSign("RSA-SHA256").update(encoded).sign(key);
  return `${encoded}.${signature.toString("base64url")}`;
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "RepoReady"
  };
}

async function ghJson(url, init = {}) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`GitHub API failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function buildPrBody(report, plan) {
  const line = (item) => `- ${item}`;
  const evidence = (report.evidence || [])
    .slice(0, 8)
    .map((item) => line(`**${item.status.toUpperCase()} / ${item.severity}** ${item.title} ? ${item.source}${item.detail ? `: ${item.detail}` : ""}`))
    .join("\n") || "- No evidence items available.";
  const risks = (report.agentFailureRisk?.topRisks || [])
    .map((risk) => line(`**${risk.title}** (${risk.level}, ${risk.score}/100): ${risk.whyAgentsFail} Mitigation: ${risk.mitigation}`))
    .join("\n") || "- No major agent failure risks detected.";
  const changeLine = (change) => line(`\`${change.path}\` ? ${change.reason || "RepoReady generated this reviewable change."}`);
  const safe = plan.safe.map(changeLine).join("\n") || "- None";
  const review = plan.review.map(changeLine).join("\n") || "- None";
  const manual = plan.manual.map((item) => line(`**${item.severity}** ${item.en}`)).join("\n") || "- None";
  const validation = [
    report.commands?.test ? `npm test / ${report.commands.test}` : null,
    report.commands?.build ? report.commands.build : null,
    report.commands?.lint ? report.commands.lint : null,
    report.commands?.typecheck ? report.commands.typecheck : null
  ].filter(Boolean).map((cmd) => `- \`${cmd}\``).join("\n") || "- No validation command detected. Please add or document one before merging.";

  return `## Why this PR exists

RepoReady detected that this repository is not fully ready for AI coding agents such as Codex, Claude Code, and Cursor.

## What RepoReady detected

${evidence}

## Agent Failure Risks

${risks}

## What this PR changes

### Safe automatic fixes
${safe}

### Review-required fixes
${review}

## What needs human review

${manual}

- Database, auth, payment, deployment, secrets, and destructive scripts remain manual-only.
- RepoReady does not execute repository scripts.
- RepoReady does not merge this PR automatically.

## Validation

Suggested commands:
${validation}

---
Generated by RepoReady. Overall score: ${report.scores.overall}/100. Agent Ready: ${report.scores.agentReady}/100.
`;
}

async function readJson(file) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return null; }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2), "utf8");
}
