import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

// aria-disabled se ve igual que disabled (lo usa quien necesita que el botón conserve el foco).
const BASE =
  "inline-flex items-center justify-center gap-2 min-h-12 px-4 rounded-xl font-bold border-2 text-[17px] leading-tight transition-colors disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:cursor-not-allowed large-ui:min-h-16 large-ui:px-6 large-ui:text-xl large-ui:border-[3px]";
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
