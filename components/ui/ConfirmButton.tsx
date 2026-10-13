"use client";

import { useState } from "react";
import { btnDanger } from "./styles";

/** Przycisk usuwania w dwóch krokach: pierwsze dotknięcie pyta, drugie wykonuje. */
export function ConfirmButton({ label, confirmLabel = "Na pewno? Dotknij ponownie", disabled, onConfirm }: { label: string; confirmLabel?: string; disabled?: boolean; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
      className={`${btnDanger} ${armed ? "bg-danger text-bg" : ""}`}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
