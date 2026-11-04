import React from "react";

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  heading?: React.ReactNode;
  action?: React.ReactNode;
  paper?: boolean;
}

export function Panel({
  heading,
  action,
  paper = true,
  children,
  className = "",
  ...props
}: PanelProps) {
  return (
    <section
      className={`bg-[var(--bg-surface)] text-[var(--text-primary)] ${
        paper ? "border border-[var(--border-default)] shadow-[2px_3px_8px_rgba(46,13,24,0.12)] rounded-sm" : ""
      } p-5 ${className}`}
      {...props}
    >
      {(heading || action) && (
        <header className="flex items-center justify-between gap-4 pb-3 mb-4 border-b border-[var(--border-subtle)]">
          {heading && <div className="text-base font-bold font-sans tracking-tight">{heading}</div>}
          {action && <div className="text-xs">{action}</div>}
        </header>
      )}
      <div>{children}</div>
    </section>
  );
}

export default Panel;
