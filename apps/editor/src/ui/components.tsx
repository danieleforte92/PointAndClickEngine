import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  variant?: ButtonVariant;
}

export function Button({
  children,
  className,
  icon,
  variant = "secondary",
  ...props
}: PropsWithChildren<ButtonProps>) {
  const classes = ["pc-button", `pc-button-${variant}`, className].filter(Boolean).join(" ");
  return (
    <button className={classes} type="button" {...props}>
      {icon}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function IconButton({ children, className, label, title, ...props }: PropsWithChildren<IconButtonProps>) {
  return (
    <button
      aria-label={label}
      className={["pc-icon-button", className].filter(Boolean).join(" ")}
      title={title ?? label}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

interface BadgeProps {
  children: ReactNode;
  className?: string;
  tone?: "good" | "warn" | "error" | "muted";
}

export function Badge({ children, className, tone = "muted" }: BadgeProps) {
  return <span className={["pc-badge", "capability-badge", tone, className].filter(Boolean).join(" ")}>{children}</span>;
}

interface PanelProps {
  children: ReactNode;
  className?: string;
}

export function Panel({ children, className }: PanelProps) {
  return <section className={["pc-panel", className].filter(Boolean).join(" ")}>{children}</section>;
}

export function EmptyState({ children, className }: PanelProps) {
  return <div className={["empty-inspector", "pc-empty-state", className].filter(Boolean).join(" ")}>{children}</div>;
}
