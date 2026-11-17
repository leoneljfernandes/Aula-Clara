import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const BASE =
  "inline-flex items-center justify-center gap-2 min-h-12 px-4 rounded-xl font-bold border-2 text-[17px] leading-tight transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-[var(--accent)] text-[var(--onAccent)] border-[var(--accent)] hover:brightness-110",
  secondary: "bg-[var(--bg)] text-[var(--fg)] border-[var(--border)] hover:bg-[var(--soft)]",
  ghost: "bg-transparent text-[var(--fg)] border-transparent hover:bg-[var(--soft)]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: ButtonProps): ReactNode {
  return <button type={type} className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}
