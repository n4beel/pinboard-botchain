import React from "react";
import Link from "next/link";
import ConnectButton from "../ui/ConnectButton";
import BuiltOnBotChain from "../botchain/BuiltOnBotChain";
import { footerLinks } from "@/lib/botchain/chain";

export interface PageShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  activeTab?: "board" | "pin" | "me";
}

export function PageShell({
  children,
  title,
  subtitle,
  badge,
  action,
  activeTab = "board",
}: PageShellProps) {
  const { site, explorer } = footerLinks();

  return (
    <div className="min-h-screen flex flex-col text-[var(--text-primary)]">
      {/* Top Banner Navigation Bar */}
      <header className="border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 sm:px-6 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-7 h-7 rounded-full bg-[var(--accent)] text-[var(--accent-ink)] flex items-center justify-center font-bold text-xs shadow-sm">
                📌
              </span>
              <span className="font-sans font-black text-xl tracking-tight text-[var(--text-primary)]">
                Pinboard
              </span>
            </Link>
            <nav className="hidden sm:flex items-center gap-2 text-sm font-semibold">
              <Link
                href="/"
                className={`px-3 py-1 rounded transition-colors ${
                  activeTab === "board"
                    ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                }`}
              >
                The Board
              </Link>
              <Link
                href="/pin"
                className={`px-3 py-1 rounded transition-colors ${
                  activeTab === "pin"
                    ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                }`}
              >
                Pin a Notice
              </Link>
              <Link
                href="/me"
                className={`px-3 py-1 rounded transition-colors ${
                  activeTab === "me"
                    ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                }`}
              >
                My Notices
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Header bar if provided */}
      {(title || subtitle || action) && (
        <section className="bg-[var(--bg-surface)] border-b border-[var(--border-default)] px-4 py-5 sm:px-6">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                {title && <h1 className="text-2xl font-bold font-sans tracking-tight">{title}</h1>}
                {badge}
              </div>
              {subtitle && <p className="text-xs text-[var(--text-muted)] mt-1">{subtitle}</p>}
            </div>
            {action && <div className="flex items-center gap-2">{action}</div>}
          </div>
        </section>
      )}

      {/* Main Board Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 sm:px-6">{children}</main>

      {/* Shared UI Contract Footer: exactly 3 links */}
      <footer className="border-t border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)] text-xs px-4 py-4 sm:px-6 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BuiltOnBotChain />
          </div>
          <div className="flex items-center gap-6 font-medium">
            <a
              href={site}
              target="_blank"
              rel="noreferrer"
              className="hover:underline text-[var(--text-secondary)]"
            >
              botchain.ai
            </a>
            <a
              href={explorer}
              target="_blank"
              rel="noreferrer"
              className="hover:underline text-[var(--text-secondary)]"
            >
              BOT Chain Explorer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PageShell;
