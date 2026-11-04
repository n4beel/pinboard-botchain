import React from "react";
import { NoticeInfo, TOPIC_NAMES } from "@/lib/pinboard";
import NoteCard from "./NoteCard";

export interface CorkboardProps {
  notices: NoticeInfo[];
  nowSecs: bigint;
  userAddress?: string;
  selectedTopic: number | null;
  onSelectTopic: (topic: number | null) => void;
  onSweep?: (id: bigint) => void;
  onUnpin?: (id: bigint) => void;
  sweepingId?: bigint | null;
  unpinningId?: bigint | null;
}

export function Corkboard({
  notices,
  nowSecs,
  userAddress,
  selectedTopic,
  onSelectTopic,
  onSweep,
  onUnpin,
  sweepingId,
  unpinningId,
}: CorkboardProps) {
  // Topic pins strip (§3.1)
  const pinColors = [
    "#D90429", // 0
    "#2B9348", // 1
    "#0077B6", // 2
    "#E85D04", // 3
    "#7209B7", // 4
    "#3A0CA3", // 5
    "#0096C7", // 6
    "#555555", // 7
  ];

  const filtered = selectedTopic === null
    ? notices
    : notices.filter((n) => n.topic === selectedTopic);

  return (
    <div className="space-y-6">
      {/* Topic Filter Pins Header Bar */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-3 rounded-sm shadow-xs flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
          <span className="text-[var(--text-muted)] uppercase tracking-wider text-[11px] mr-1">
            Filter:
          </span>
          <button
            onClick={() => onSelectTopic(null)}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              selectedTopic === null
                ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                : "hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
            }`}
          >
            All Notices ({notices.length})
          </button>
          {TOPIC_NAMES.map((name, idx) => {
            const count = notices.filter((n) => n.topic === idx).length;
            return (
              <button
                key={name}
                onClick={() => onSelectTopic(idx)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  selectedTopic === idx
                    ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                    : "hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: pinColors[idx] }}
                  aria-hidden="true"
                />
                <span>{name}</span>
                <span className="text-[10px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* The Corkboard Notice Grid */}
      {filtered.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border-2 border-dashed border-[var(--border-default)] p-12 text-center rounded-sm">
          <p className="font-sans font-bold text-lg text-[var(--text-primary)]">The board is empty</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {selectedTopic !== null
              ? "No notices pinned under this category."
              : "No notices have been pinned yet. Be the first to post a notice!"}
          </p>
        </div>
      ) : (
        <>
          {/* Grid reflows to 2 columns at 360px (§8 checklist 4) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-2">
            {filtered.map((notice) => (
              <NoteCard
                key={notice.id.toString()}
                notice={notice}
                nowSecs={nowSecs}
                userAddress={userAddress}
                onSweep={onSweep}
                onUnpin={onUnpin}
                sweeping={sweepingId === notice.id}
                unpinning={unpinningId === notice.id}
              />
            ))}
          </div>

          {/* Accessible Table Equivalent for Screen Readers (§8 checklist 3) */}
          <details className="mt-6 bg-[var(--bg-surface)] border border-[var(--border-default)] p-3 text-xs rounded-sm">
            <summary className="cursor-pointer font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              View accessible notices table ({filtered.length})
            </summary>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-default)] font-semibold">
                    <th className="py-1 px-2">ID</th>
                    <th className="py-1 px-2">Topic</th>
                    <th className="py-1 px-2">Text</th>
                    <th className="py-1 px-2">Author</th>
                    <th className="py-1 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((n) => (
                    <tr key={n.id.toString()} className="border-b border-[var(--border-subtle)]">
                      <td className="py-1 px-2 font-mono">#{n.id.toString()}</td>
                      <td className="py-1 px-2">{String(TOPIC_NAMES[n.topic as number] || "Notice")}</td>
                      <td className="py-1 px-2 max-w-xs truncate">{n.text || "text unavailable"}</td>
                      <td className="py-1 px-2 font-mono">{n.author}</td>
                      <td className="py-1 px-2">{n.open ? "Open" : "Archived"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

export default Corkboard;
