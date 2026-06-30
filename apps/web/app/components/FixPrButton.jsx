"use client";

import { useState } from "react";

export default function FixPrButton({ repo, installationId, initialPlan }) {
  const [state, setState] = useState({ loading: false, result: null, error: null, copied: null });
  const initialChanges = [...(initialPlan?.safe || []), ...(initialPlan?.review || [])];

  async function createPr() {
    setState({ loading: true, result: null, error: null, copied: null });
    try {
      const res = await fetch("/api/fix-pr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo, installationId })
      });
      const json = await res.json();
      setState({ loading: false, result: json, error: res.ok ? null : json.error || json.message, copied: null });
    } catch (error) {
      setState({ loading: false, result: null, error: error.message, copied: null });
    }
  }

  async function copyText(label, text) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setState((current) => ({ ...current, copied: label }));
  }

  const result = state.result;
  const changes = result?.changeDetails || initialChanges;
  const diff = result?.copyablePatch || result?.diff;
  const prBody = result?.prBody;
  const downloadHref = diff ? `data:text/plain;charset=utf-8,${encodeURIComponent(diff)}` : null;

  return (
    <div className="fix-pr-box">
      <div className="notice">
        RepoReady will open a reviewable PR. It will not merge anything or execute repository scripts.
      </div>
      <button className="btn btn-primary" onClick={createPr} disabled={state.loading} style={{ width: "100%" }}>
        {state.loading ? "Preparing Fix PR..." : "Create Fix PR"}
      </button>

      {state.error && <div className="error">{state.error}</div>}

      {result?.pullRequestUrl && (
        <div className="success">
          <strong>Pull request created</strong><br />
          <a href={result.pullRequestUrl}>{result.pullRequestUrl}</a>
          {result.branch && <div style={{ marginTop: 8 }}>Branch: <code>{result.branch}</code></div>}
        </div>
      )}

      {result?.skipped && (
        <div className="success">
          <strong>No fixes required.</strong><br />
          {result.message || "RepoReady did not find any PR-ready changes for this repository."}
        </div>
      )}

      {result?.needsInstallation && (
        <div className="notice">
          <strong>GitHub App installation required.</strong>
          <p style={{ margin: "8px 0 0" }}>
            Without authorization, RepoReady will not write to the repository. You can still copy or download the patch and apply it manually.
          </p>
          <div className="copy-actions" style={{ marginTop: 12 }}>
            {result.installUrl && <a className="btn btn-secondary" href={result.installUrl}>Install GitHub App</a>}
            {diff && <button className="btn btn-secondary" onClick={() => copyText("patch", diff)}>Copy patch</button>}
            {downloadHref && <a className="btn btn-secondary" download="repoready.patch" href={downloadHref}>Download patch</a>}
            {prBody && <button className="btn btn-secondary" onClick={() => copyText("pr-body", prBody)}>Copy PR body</button>}
          </div>
        </div>
      )}

      {state.copied && <div className="copy-status">Copied {state.copied}.</div>}

      {changes?.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Change summary</h3>
          <div className="change-summary">
            {changes.map((change) => (
              <div className="change-row" key={`${change.path}-${change.risk || change.action}`}>
                <strong>{change.path}</strong>
                <span>{(change.risk || "review").toUpperCase()} · {change.reason || "RepoReady generated this reviewable change."}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result?.validationCommands?.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Validation commands</h3>
          <ul className="list">{result.validationCommands.map((cmd) => <li key={cmd}><code>{cmd}</code></li>)}</ul>
        </div>
      )}

      {diff && (
        <details className="card" open={Boolean(result?.needsInstallation)}>
          <summary style={{ cursor: "pointer", fontWeight: 800 }}>Unified diff preview</summary>
          <pre className="code" style={{ marginTop: 12, maxHeight: 360 }}>{diff}</pre>
        </details>
      )}

      {prBody && (
        <details className="card">
          <summary style={{ cursor: "pointer", fontWeight: 800 }}>PR body preview</summary>
          <pre className="code" style={{ marginTop: 12, maxHeight: 360 }}>{prBody}</pre>
        </details>
      )}
    </div>
  );
}
