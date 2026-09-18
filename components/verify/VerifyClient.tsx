"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  FIXTURE_RECEIPT,
  FORMULA_VERSION,
  verifyRing,
  type RingReceipt,
  type VerifyResult,
} from "@closing-bell/fairness";

import { Button, ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatEtStamp, formatGme, shortAddress } from "@/lib/format";

type SnapshotJson =
  | Record<string, number>
  | Array<{ address: string; tickets: number }>;

type RingSource = "latest" | "sample" | "pasted";

type RingSummary = {
  receipt: RingReceipt;
  source: RingSource;
  bell: string;
  timeLabel: string;
  winner: string;
  potLabel: string;
};

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function parseJson(
  label: string,
  raw: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: `${label} is empty` };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) as unknown };
  } catch {
    return { ok: false, error: `${label} is not valid JSON` };
  }
}

function bellFromWindowId(windowId: string): string {
  const match = windowId.match(/^bell-(open|lunch|close)-/i);
  if (!match) return "Bell";
  const kind = match[1].toLowerCase();
  if (kind === "open") return "Open";
  if (kind === "lunch") return "Lunch";
  return "Close";
}

function potLabelFromReceipt(receipt: RingReceipt): string {
  const raw = receipt.potBalance;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(n)) return `${formatGme(n)} GME`;
  return `${String(raw)} GME`;
}

function summarizeReceipt(
  receipt: RingReceipt,
  source: RingSource,
): RingSummary {
  const when = receipt.ringedAt ?? null;
  return {
    receipt,
    source,
    bell: bellFromWindowId(receipt.windowId),
    timeLabel: when ? formatEtStamp(when) : receipt.windowId,
    winner: shortAddress(receipt.announcedWinner),
    potLabel: potLabelFromReceipt(receipt),
  };
}

function sourceLabel(source: RingSource): string {
  if (source === "latest") return "Latest ring";
  if (source === "sample") return "Sample ring";
  return "Pasted receipt";
}

async function readFileText(file: File): Promise<string> {
  return file.text();
}

function safeVerify(
  receipt: unknown,
  externalSnapshot?: SnapshotJson | null,
): { ok: true; result: VerifyResult } | { ok: false; error: string } {
  try {
    return { ok: true, result: verifyRing(receipt, externalSnapshot) };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not run the formula check.";
    return { ok: false, error: message };
  }
}

export function VerifyClient({ apiBase }: { apiBase: string | null }) {
  const [summary, setSummary] = useState<RingSummary>(() =>
    summarizeReceipt(FIXTURE_RECEIPT, "sample"),
  );
  const [receiptText, setReceiptText] = useState(pretty(FIXTURE_RECEIPT));
  const [snapshotText, setSnapshotText] = useState("");
  const [ringId, setRingId] = useState("");
  const [loadingLatest, setLoadingLatest] = useState(Boolean(apiBase));
  const [parseError, setParseError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [fetching, setFetching] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const receiptFileRef = useRef<HTMLInputElement>(null);
  const snapshotFileRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const showResult = (next: VerifyResult) => {
    startTransition(() => {
      setResult(next);
    });
    window.setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  };

  const applyReceipt = (
    receipt: RingReceipt,
    source: RingSource,
    opts?: { clearResult?: boolean },
  ) => {
    setSummary(summarizeReceipt(receipt, source));
    setReceiptText(pretty(receipt));
    setSnapshotText("");
    setParseError(null);
    setFetchError(null);
    if (opts?.clearResult !== false) {
      setResult(null);
    }
  };

  const checkCardRing = () => {
    setParseError(null);
    const verified = safeVerify(summary.receipt, null);
    if (!verified.ok) {
      setResult(null);
      setParseError(verified.error);
      return;
    }
    showResult(verified.result);
  };

  /** Teaching tool: load the sample receipt and check it in one tap. */
  const checkSampleRing = () => {
    applyReceipt(FIXTURE_RECEIPT, "sample", { clearResult: false });
    const verified = safeVerify(FIXTURE_RECEIPT, null);
    if (!verified.ok) {
      setResult(null);
      setParseError(verified.error);
      return;
    }
    showResult(verified.result);
  };

  const loadSampleReceipt = () => {
    applyReceipt(FIXTURE_RECEIPT, "sample");
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);

    async function loadLatest() {
      if (!apiBase) {
        if (!cancelled) {
          applyReceipt(FIXTURE_RECEIPT, "sample", { clearResult: false });
          setLoadingLatest(false);
        }
        return;
      }

      setLoadingLatest(true);
      setFetchError(null);
      try {
        const listRes = await fetch(`${apiBase}/winners?limit=1`, {
          signal: controller.signal,
        });
        if (!listRes.ok) throw new Error("list failed");
        const listBody = (await listRes.json()) as {
          rows?: Array<{ id?: string; windowId?: string | null }>;
        };
        const row = listBody.rows?.[0];
        const windowId = (row?.windowId ?? row?.id ?? "").trim();
        if (!windowId) throw new Error("empty");

        const detailRes = await fetch(
          `${apiBase}/winners/${encodeURIComponent(windowId)}`,
          { signal: controller.signal },
        );
        const detail = (await detailRes.json()) as {
          receipt?: RingReceipt;
        };
        if (!detailRes.ok || !detail.receipt) throw new Error("no receipt");
        if (!cancelled) {
          applyReceipt(detail.receipt, "latest");
          setRingId(windowId);
        }
      } catch {
        if (!cancelled) {
          applyReceipt(FIXTURE_RECEIPT, "sample", { clearResult: false });
          setFetchError(
            "Could not load the latest ring from the API. Showing a sample ring instead.",
          );
        }
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) setLoadingLatest(false);
      }
    }

    void loadLatest();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per apiBase
  }, [apiBase]);

  const checkPastedReceipt = () => {
    setParseError(null);
    setFetchError(null);

    const receiptParsed = parseJson("Receipt", receiptText);
    if (!receiptParsed.ok) {
      setResult(null);
      setParseError(receiptParsed.error);
      setAdvancedOpen(true);
      return;
    }

    let externalSnapshot: SnapshotJson | null = null;
    if (snapshotText.trim()) {
      const snapParsed = parseJson("Ticket bag", snapshotText);
      if (!snapParsed.ok) {
        setResult(null);
        setParseError(snapParsed.error);
        setAdvancedOpen(true);
        return;
      }
      externalSnapshot = snapParsed.value as SnapshotJson;
    }

    if (
      receiptParsed.value &&
      typeof receiptParsed.value === "object" &&
      "announcedWinner" in (receiptParsed.value as object)
    ) {
      setSummary(
        summarizeReceipt(receiptParsed.value as RingReceipt, "pasted"),
      );
    }

    const verified = safeVerify(receiptParsed.value, externalSnapshot);
    if (!verified.ok) {
      setResult(null);
      setParseError(verified.error);
      return;
    }
    showResult(verified.result);
  };

  const onReceiptFile = async (file: File | null) => {
    if (!file) return;
    const text = await readFileText(file);
    setReceiptText(text);
    setResult(null);
    setParseError(null);
    const parsed = parseJson("Receipt", text);
    if (parsed.ok && parsed.value && typeof parsed.value === "object") {
      setSummary(summarizeReceipt(parsed.value as RingReceipt, "pasted"));
    }
  };

  const onSnapshotFile = async (file: File | null) => {
    if (!file) return;
    const text = await readFileText(file);
    setSnapshotText(text);
    setResult(null);
    setParseError(null);
  };

  const fetchById = async () => {
    setFetchError(null);
    setParseError(null);
    if (!apiBase) {
      setFetchError(
        "No public API configured. Use Check a sample ring, or paste a receipt below.",
      );
      return;
    }
    const id = ringId.trim();
    if (!id) {
      setFetchError("Enter a ring id first.");
      return;
    }
    setFetching(true);
    try {
      const res = await fetch(
        `${apiBase}/winners/${encodeURIComponent(id)}`,
      );
      const body = (await res.json()) as {
        receipt?: RingReceipt;
        message?: string;
        error?: string;
      };
      if (!res.ok || !body.receipt) {
        setFetchError(
          body.message ??
            body.error ??
            `Could not load receipt for ${id} (${res.status})`,
        );
        return;
      }
      applyReceipt(body.receipt, "latest");
    } catch {
      setFetchError(
        "API unreachable. Paste the receipt below, or check a sample ring.",
      );
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <section
        className="rounded-sm border border-line-strong bg-floor-950/80 p-5 shadow-[var(--shadow-panel)] sm:p-7"
        aria-label={sourceLabel(summary.source)}
      >
        <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-brass-500">
          {loadingLatest ? "Loading ring…" : sourceLabel(summary.source)}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <Field label="Bell" value={summary.bell} />
          <Field label="Time" value={summary.timeLabel} />
          <Field label="Announced winner" value={summary.winner} mono />
          <Field label="Pot" value={summary.potLabel} />
        </dl>

        <p className="mt-5 text-[0.88rem] leading-relaxed text-ink-3">
          A receipt is the public record of that ring (winner + ticket bag +
          inputs).
        </p>

        {fetchError && summary.source === "sample" ? (
          <p className="mt-3 text-[0.86rem] text-ink-3" role="status">
            {fetchError}
          </p>
        ) : null}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            variant="primary"
            size="lg"
            onClick={checkCardRing}
            disabled={pending}
          >
            {pending ? "Checking…" : "Check this ring"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={checkSampleRing}
            disabled={pending}
          >
            Check a sample ring
          </Button>
          <ButtonLink href="/docs" variant="ghost" size="sm">
            Docs
          </ButtonLink>
        </div>
      </section>

      {parseError ? (
        <p className="text-[0.92rem] text-ember-300" role="alert">
          {parseError}
        </p>
      ) : null}

      {result ? (
        <div ref={resultRef}>
          <VerifyOutcome result={result} />
        </div>
      ) : null}

      <section>
        <h2 className="font-display text-[1.15rem] font-bold text-brass-100">
          How this works
        </h2>
        <ol className="mt-5 flex flex-col gap-3 text-[0.95rem] leading-relaxed text-ink-2">
          <li>Tickets follow public rules.</li>
          <li>
            Bag lock freezes the ticket bag (snapshot) for the draw.
          </li>
          <li>
            A person does not pick the winner. The public Closing Bell formula
            (closing-bell-draw-v1) picks one wallet at random from the locked
            ticket list. Same list + same formula → same wallet.
          </li>
          <li>
            We post a receipt: the public ring record.
          </li>
          <li>
            This page checks it. If the winner does not match, the receipt is
            wrong.
          </li>
        </ol>
        <p className="mt-5 text-[0.9rem] leading-relaxed text-ink-3">
          The locked ticket list and formula inputs are published. You check the
          math. MATCH means the math matches the receipt. Payout settlement is
          separate from draw verification.
        </p>
      </section>

      <section className="border-t border-line pt-8">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 rounded-sm border border-line-strong bg-floor-900/60 px-4 py-3 text-left transition-colors hover:border-tape/40 hover:bg-floor-900"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          <span>
            <span className="font-display text-[1.05rem] font-bold text-brass-100">
              Advanced
            </span>
            <span className="mt-1 block text-[0.86rem] text-ink-3">
              Raw receipt (public ring record / JSON) and formula details
            </span>
          </span>
          <span
            className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-brass-500"
            aria-hidden="true"
          >
            {advancedOpen ? "Hide" : "Show"}
          </span>
        </button>

        {advancedOpen ? (
          <div className="mt-6 flex flex-col gap-10">
            {apiBase ? (
              <div>
                <h3 className="font-display text-[1.05rem] font-bold text-brass-100">
                  Load by ring id
                </h3>
                <p className="mt-2 text-[0.88rem] text-ink-2">
                  Pull a published receipt from the API when it is reachable.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="label-mono">
                      Ring id{" "}
                      <span className="normal-case tracking-normal text-ink-3">
                        (windowId)
                      </span>
                    </span>
                    <input
                      value={ringId}
                      onChange={(e) => setRingId(e.target.value)}
                      placeholder="bell-close-2026-09-15T20:00:00.000Z"
                      className="h-11 rounded-sm border border-line-strong bg-floor-900 px-3 font-mono text-[0.8rem] text-ink placeholder:text-ink-3"
                    />
                  </label>
                  <Button
                    variant="secondary"
                    onClick={() => void fetchById()}
                    disabled={fetching}
                  >
                    {fetching ? "Loading…" : "Load receipt"}
                  </Button>
                </div>
                {fetchError && summary.source !== "sample" ? (
                  <p className="mt-3 text-[0.88rem] text-ember-300" role="alert">
                    {fetchError}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-display text-[1.05rem] font-bold text-brass-100">
                    Receipt JSON
                  </h3>
                  <p className="mt-2 text-[0.88rem] text-ink-2">
                    Public ring record for audit paste or upload.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={loadSampleReceipt}
                  >
                    Load sample receipt
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => receiptFileRef.current?.click()}
                  >
                    Upload
                  </Button>
                  <input
                    ref={receiptFileRef}
                    type="file"
                    accept="application/json,.json"
                    className="sr-only"
                    onChange={(e) =>
                      void onReceiptFile(e.target.files?.[0] ?? null)
                    }
                  />
                </div>
              </div>
              <textarea
                value={receiptText}
                onChange={(e) => {
                  setReceiptText(e.target.value);
                  setResult(null);
                  setParseError(null);
                  setSummary((prev) => ({ ...prev, source: "pasted" }));
                }}
                spellCheck={false}
                rows={14}
                className="mt-4 w-full rounded-sm border border-line-strong bg-floor-900 px-3 py-3 font-mono text-[0.72rem] leading-relaxed text-ink"
                aria-label="Ring receipt JSON"
              />
            </div>

            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-display text-[1.05rem] font-bold text-brass-100">
                    Ticket bag (snapshot), optional
                  </h3>
                  <p className="mt-2 text-[0.88rem] text-ink-2">
                    Wallet to tickets. Only needed when the receipt does not
                    embed the bag.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => snapshotFileRef.current?.click()}
                >
                  Upload
                </Button>
                <input
                  ref={snapshotFileRef}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(e) =>
                    void onSnapshotFile(e.target.files?.[0] ?? null)
                  }
                />
              </div>
              <textarea
                value={snapshotText}
                onChange={(e) => {
                  setSnapshotText(e.target.value);
                  setResult(null);
                  setParseError(null);
                }}
                spellCheck={false}
                rows={8}
                placeholder='{"0x…": 100000}'
                className="mt-4 w-full rounded-sm border border-line-strong bg-floor-900 px-3 py-3 font-mono text-[0.72rem] leading-relaxed text-ink placeholder:text-ink-3"
                aria-label="Ticket bag snapshot JSON"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                onClick={checkPastedReceipt}
                disabled={pending}
              >
                {pending ? "Checking…" : "Check pasted receipt"}
              </Button>
            </div>

            <div>
              <h3 className="font-display text-[1.05rem] font-bold text-brass-100">
                How this calculation works
              </h3>
              <p className="mt-2 text-[0.88rem] text-ink-2">
                Formula{" "}
                <span className="font-mono text-[0.8rem] text-brass-200">
                  {FORMULA_VERSION}
                </span>
                : the published math that turns the ticket bag into a winner.
              </p>
              <div className="mt-5 space-y-5 text-[0.92rem] leading-relaxed text-ink-2">
                <p>
                  <span className="text-brass-200">
                    1. Hash the ticket bag so nobody can swap wallets quietly.
                  </span>{" "}
                  Technical: sort wallets by address ascending, join each line as{" "}
                  <code className="font-mono text-[0.8rem] text-ink">
                    address:tickets
                  </code>{" "}
                  with newlines, keccak256 the UTF-8 bytes. Must equal
                  receipt.snapshotHash.
                </p>
                <p>
                  <span className="text-brass-200">
                    2. Build the seed, the number the formula uses to walk the
                    bag.
                  </span>{" "}
                  Technical: material is{" "}
                  <code className="font-mono text-[0.8rem] text-ink">
                    lowercase(blockhash)|windowId|potBalance
                  </code>
                  . potBalance uses eight decimals when stored as a number.
                  keccak256 the UTF-8 bytes.
                </p>
                <p>
                  <span className="text-brass-200">
                    3. Apply the odds cap (10%): max draw weight share vs the
                    live bag.
                  </span>{" "}
                  Technical: weight = min(tickets, floor(ticketsOut ×
                  oddsCapBps / 10000)). Walk order is weight DESC, then address
                  ASC.
                </p>
                <p>
                  <span className="text-brass-200">
                    4. Pick the winner with the cursor (how far the walk goes
                    into the bag).
                  </span>{" "}
                  Technical:{" "}
                  <code className="font-mono text-[0.8rem] text-ink">
                    cursor = seed mod totalWeight
                  </code>
                  . Subtract each weight until remaining is less than the
                  current weight. That wallet wins.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="label-mono">{label}</dt>
      <dd
        className={cn(
          "mt-1.5 text-[0.95rem] text-ink",
          mono && "font-mono text-[0.88rem] tracking-[0.02em]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function VerifyOutcome({ result }: { result: VerifyResult }) {
  const matched = result.match;

  return (
    <section
      className="rounded-sm border border-line-strong bg-floor-950/60 p-5 sm:p-7"
      aria-live="polite"
      aria-atomic="true"
    >
      <p
        className={cn(
          "font-display text-[clamp(2.4rem,10vw,4.2rem)] font-extrabold uppercase leading-none tracking-[-0.03em]",
          matched ? "text-tape" : "text-ember-400",
        )}
      >
        {matched ? "Match" : "Mismatch"}
      </p>
      <p className="mt-4 max-w-xl text-[1.05rem] leading-relaxed text-ink">
        {matched
          ? "This page got the same winner from the published bag and formula."
          : "The published receipt does not match the formula. Do not trust this ring until it's fixed."}
      </p>
      <p className="mt-3 text-[0.88rem] text-ink-3">
        Payout settlement is separate from draw verification.
      </p>

      {result.errors.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-2 text-[0.88rem] text-ember-300">
          {result.errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-8 border-t border-line pt-6">
        <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-brass-500">
          Technical steps
        </p>
        <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ResultRow
            label="Computed winner"
            value={result.computedWinner ?? "n/a"}
          />
          <ResultRow
            label="Announced winner"
            value={result.announcedWinner ?? "n/a"}
          />
          <ResultRow
            label="Ticket bag hash"
            value={
              result.snapshotHashMatch === null
                ? "n/a"
                : result.snapshotHashMatch
                  ? "MATCH"
                  : "MISMATCH"
            }
          />
          <ResultRow
            label="Formula version"
            value={`${result.formulaVersion}${result.formulaVersionMatch ? "" : " (unsupported)"}`}
          />
          <ResultRow
            label="Cursor (walk position)"
            value={result.cursor ?? "n/a"}
          />
          <ResultRow
            label="Total weight"
            value={
              result.totalWeight === null ? "n/a" : String(result.totalWeight)
            }
          />
        </dl>
        <ol className="mt-6 flex flex-col gap-4">
          {result.steps.map((step) => (
            <li key={step.label}>
              <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-brass-500">
                {step.label}
              </p>
              <p className="mt-1 text-[0.88rem] leading-relaxed text-ink-2">
                {step.detail}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line pb-3">
      <dt className="label-mono">{label}</dt>
      <dd className="mt-1 break-all font-mono text-[0.82rem] text-ink">
        {value}
      </dd>
    </div>
  );
}
