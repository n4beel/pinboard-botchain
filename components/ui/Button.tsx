import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const isBusy = loading;

  const padStyle = size === "sm"
    ? "px-2.5 py-1 text-xs"
    : size === "lg"
    ? "px-5 py-2.5 text-base"
    : "px-3.5 py-1.5 text-sm";

  let colorStyle = "bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90";
  if (variant === "secondary") {
    colorStyle = "bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-elevated)]";
  } else if (variant === "danger") {
    colorStyle = "bg-[var(--danger)] text-white hover:opacity-90";
  } else if (variant === "ghost") {
    colorStyle = "bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]";
  }

  return (
    <button
      disabled={disabled || isBusy}
      className={`inline-flex items-center justify-center gap-1.5 font-semibold tracking-tight transition rounded-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${padStyle} ${colorStyle} ${className}`}
      {...props}
    >
      {isBusy && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      <span>{children}</span>
    </button>
  );
}

export default Button;
