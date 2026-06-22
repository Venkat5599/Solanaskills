import Link from "next/link";
import AgentConsole from "../components/AgentConsole";

export const metadata = {
  title: "Console — Confidential Compliance",
};

export default function Dashboard() {
  return (
    <div className="dash">
      <header className="dash-bar">
        <Link href="/" className="wordmark">
          Confidential<span className="green">Audit</span>
        </Link>
        <div className="dash-bar-mid lab">solana-confidential-skill · auditor console</div>
        <div className="right">
          <Link href="/" className="ghost">
            ← Home
          </Link>
          <a className="ghost" href="https://github.com/Venkat5599/Solanaskills" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <span className="mark">||</span>
        </div>
      </header>
      <AgentConsole />
    </div>
  );
}
