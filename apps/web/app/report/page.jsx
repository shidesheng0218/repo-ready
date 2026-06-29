import { redirect } from "next/navigation";

export default function LegacyReportPage({ searchParams }) {
  const repo = String(searchParams?.repo || "").trim();
  const match = repo.match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)|^([^/\s]+)\/([^/\s]+)$/i);
  if (!match) redirect("/");
  const owner = match[1] || match[3];
  const name = (match[2] || match[4]).replace(/\.git$/, "");
  redirect(`/r/${owner}/${name}`);
}
