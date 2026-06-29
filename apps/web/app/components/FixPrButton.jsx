"use client";

import { useState } from "react";

export default function FixPrButton({ repo, installationId }) {
  const [state, setState] = useState({ loading: false, result: null, error: null });

  async function createPr() {
    setState({ loading: true, result: null, error: null });
    try {
      const res = await fetch("/api/fix-pr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo, installationId })
      });
      const json = await res.json();
      setState({ loading: false, result: json, error: res.ok ? null : json.error || json.message });
    } catch (error) {
      setState({ loading: false, result: null, error: error.message });
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <button className="btn btn-primary" onClick={createPr} disabled={state.loading} style={{ width: "100%" }}>
        {state.loading ? "Creating Fix PR..." : "Create Fix PR"}
      </button>
      {state.error && <div className="error">{state.error}</div>}
      {state.result?.pullRequestUrl && (
        <div className="success">
          Pull request created: <a href={state.result.pullRequestUrl}>{state.result.pullRequestUrl}</a>
        </div>
      )}
      {state.result?.needsInstallation && (
        <div className="notice">
          GitHub App installation is required before RepoReady can open a PR.
          {state.result.installUrl && <div style={{ marginTop: 10 }}><a className="btn btn-secondary" href={state.result.installUrl}>Install GitHub App</a></div>}
        </div>
      )}
      {state.result?.diff && (
        <details className="card" open={state.result.needsInstallation}>
          <summary style={{ cursor: "pointer", fontWeight: 800 }}>Patch preview</summary>
          <pre className="code" style={{ marginTop: 12, maxHeight: 360 }}>{state.result.diff}</pre>
        </details>
      )}
    </div>
  );
}
