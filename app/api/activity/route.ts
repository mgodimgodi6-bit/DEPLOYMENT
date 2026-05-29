import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const repo = searchParams.get("repo");
  const headers = { Authorization: `Bearer ${GITHUB_TOKEN}` };

  // ── DIAGNOSTIC MODE ──
  if (searchParams.get("debug") === "1") {
    return NextResponse.json({
      hasToken: !!GITHUB_TOKEN,
      tokenLength: GITHUB_TOKEN?.length || 0,
      tokenPrefix: GITHUB_TOKEN?.slice(0, 4) || "none",
      hasUsername: !!GITHUB_USERNAME,
      username: GITHUB_USERNAME || "none",
    });
  }

  if (!repo) {
    try {
      const res = await fetch(
        `https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=50&sort=updated`,
        { headers }
      );
      const status = res.status;
      const repos = await res.json();
      return NextResponse.json({
        status,
        repos: Array.isArray(repos) ? repos.map((r: any) => ({
          id: r.name.toLowerCase().replace(/\s+/g, "-"),
          name: r.name,
          repo: r.full_name,
          description: r.description || "No description",
          color: "#6366f1",
          private: r.private,
          stars: r.stargazers_count,
          updatedAt: r.updated_at,
        })) : [],
        errorMessage: Array.isArray(repos) ? null : repos.message,
      });
    } catch (err: any) {
      return NextResponse.json({ repos: [], error: err.message }, { status: 500 });
    }
  }

  try {
    const [commitsRes, prsRes, runsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${repo}/commits?per_page=10`, { headers }),
      fetch(`https://api.github.com/repos/${repo}/pulls?state=all&per_page=10`, { headers }),
      fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=10`, { headers }),
    ]);
    const commits = await commitsRes.json();
    const prs = await prsRes.json();
    const runsData = await runsRes.json();
    return NextResponse.json({
      commits: Array.isArray(commits) ? commits : [],
      prs: Array.isArray(prs) ? prs : [],
      runs: Array.isArray(runsData.workflow_runs) ? runsData.workflow_runs : [],
    });
  } catch (err) {
    return NextResponse.json({ commits: [], prs: [], runs: [] }, { status: 500 });
  }
}