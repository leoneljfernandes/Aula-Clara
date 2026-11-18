import type { ReactNode } from "react";

import { Button } from "./Button";

interface StepperProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

/** Decimales de `step` (0.1 -> 1), para que 1.7 + 0.1 dé 1.8 y no 1.7999999999999998. */
function decimals(step: number): number {
  const [, fraction = ""] = String(step).split(".");
  return fraction.length;
}

/**
 * Ajuste numérico con botones «−» y «+»: cumple WCAG 2.5.7 (no exige arrastrar) y no deja el valor
 * fuera de `min`..`max`. El valor es un `<output>` en vivo para que un lector de pantalla lo anuncie.
 */
export function Stepper({
  id,
  label,
  value,
  min,
  max,
  step,
  format = String,
  onChange,
}: StepperProps): ReactNode {
  const digits = decimals(step);
  const move = (direction: 1 | -1): void => {
    const next = Number((value + direction * step).toFixed(digits));
    onChange(Math.min(max, Math.max(min, next)));
  };
  return (
    <div role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="mb-2 block text-lg font-bold">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <Button
          onClick={() => move(-1)}
          disabled={value <= min}
          aria-label={`Bajar ${label}`}
          className="w-14 text-2xl"
        >
          −
        </Button>
        <output id={id} aria-live="polite" className="min-w-20 flex-1 text-center text-lg font-bold">
          {format(value)}
        </output>
        <Button
          onClick={() => move(1)}
          disabled={value >= max}
          aria-label={`Subir ${label}`}
          className="w-14 text-2xl"
        >
          +
        </Button>
      </div>
    </div>
  );
}
