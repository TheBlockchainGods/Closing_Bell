"use client";

import { cn } from "@/lib/cn";

interface AddressInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  helper?: string;
  error?: string;
  className?: string;
}

export function AddressInput({
  id,
  label,
  value,
  onChange,
  onSubmit,
  helper,
  error,
  className,
}: AddressInputProps) {
  const describedBy = error ? `${id}-error` : helper ? `${id}-helper` : undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="label-mono">
        {label}
      </label>

      <div
        className={cn(
          "flex items-center rounded-sm border bg-floor-950 px-3 transition-colors",
          "focus-within:border-tape",
          error ? "border-ember-500/70" : "border-line-strong",
        )}
      >
        <input
          id={id}
          type="text"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="none"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit();
            }
          }}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className="h-12 min-w-0 flex-1 bg-transparent font-mono text-[0.82rem] font-medium text-ink outline-none placeholder:text-ink-3"
          placeholder="0x0000000000000000000000000000000000000000"
        />
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
