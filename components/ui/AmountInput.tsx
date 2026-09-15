"use client";

import { cn } from "@/lib/cn";

interface AmountInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix: string;
  helper?: string;
  error?: string;
  onMax?: () => void;
  disabled?: boolean;
  className?: string;
}

export function AmountInput({
  id,
  label,
  value,
  onChange,
  suffix,
  helper,
  error,
  onMax,
  disabled,
  className,
}: AmountInputProps) {
  const describedBy = error ? `${id}-error` : helper ? `${id}-helper` : undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="label-mono">
        {label}
      </label>

      <div
        className={cn(
          "flex items-center gap-2 rounded-sm border bg-floor-950 px-3 transition-colors",
          disabled
            ? "border-line opacity-55"
            : "focus-within:border-tape",
          error && !disabled ? "border-ember-500/70" : null,
          !disabled && !error ? "border-line-strong" : null,
        )}
      >
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className="h-12 min-w-0 flex-1 bg-transparent font-display text-[1.15rem] font-bold tabular-nums text-ink outline-none placeholder:text-ink-3 disabled:cursor-not-allowed"
          placeholder="0.00"
        />
        <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-3">
          {suffix}
        </span>
        {onMax ? (
          <button
            type="button"
            onClick={onMax}
            disabled={disabled}
            className="rounded-xs border border-line-strong px-2 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-brass-300 transition-colors hover:border-brass-600 hover:bg-brass-500/10 hover:text-brass-100 disabled:pointer-events-none disabled:opacity-50"
          >
            Max
          </button>
        ) : null}
      </div>

      {error ? (
        <p
          id={`${id}-error`}
          className="font-mono text-[0.63rem] uppercase tracking-[0.14em] text-ember-400"
        >
          {error}
        </p>
      ) : helper ? (
        <p
          id={`${id}-helper`}
          className="font-mono text-[0.63rem] uppercase tracking-[0.14em] text-ink-3"
        >
          {helper}
        </p>
      ) : null}
    </div>
  );
}
