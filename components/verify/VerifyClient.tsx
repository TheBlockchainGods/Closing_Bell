"use client";

import { useRef, useState, useTransition } from "react";
import {
  FIXTURE_RECEIPT,
  FORMULA_VERSION,
  verifyRing,
  type RingReceipt,
  type VerifyResult,
} from "@closing-bell/fairness";

import { Button, ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type SnapshotJson =
  | Record<string, number>
  | Array<{ address: string; tickets: number }>;

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function parseJson(label: string, raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
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

async function readFileText(file: File): Promise<string> {
  return file.text();
}

export function VerifyClient({ apiBase }: { apiBase: string | null }) {
  const [receiptText, setReceiptText] = useState(pretty(FIXTURE_RECEIPT));
  const [snapshotText, setSnapshotText] = useState("");
  const [ringId, setRingId] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [fetching, setFetching] = useState(false);
  const receiptFileRef = useRef<HTMLInputElement>(null);
  const snapshotFileRef = useRef<HTMLInputElement>(null);

  const loadFixture = () => {
    setReceiptText(pretty(FIXTURE_RECEIPT));
    setSnapshotText("");
    setParseError(null);
    setFetchError(null);
    setResult(null);
  };

  const runVerify = () => {
    setParseError(null);
    setFetchError(null);
    const receiptParsed = parseJson("Receipt", receiptText);
    if (!receiptParsed.ok) {
      setResult(null);
      setParseError(receiptParsed.error);
      return;
    }

    let externalSnapshot: SnapshotJson | null = null;
    if (snapshotText.trim()) {
      const snapParsed = parseJson("Snapshot", snapshotText);
      if (!snapParsed.ok) {
        setResult(null);
        setParseError(snapParsed.error);
        return;
      }
      externalSnapshot = snapParsed.value as SnapshotJson;
    }

    startTransition(() => {
      setResult(verifyRing(receiptParsed.value, externalSnapshot));
    });
  };

  const onReceiptFile = async (file: File | null) => {
    if (!file) return;
    const text = await readFileText(file);
    setReceiptText(text);
    setResult(null);
    setParseError(null);
  };

  const onSnapshotFile = async (file: File | null) => {
    if (!file) return;
    const text = await readFileText(file);
    setSnapshotText(text);
    setResult(null);
    setParseError(null);
  };

  const fetchReceipt = async () => {
    setFetchError(null);
    setParseError(null);
    if (!apiBase) {
      setFetchError(
        "No public API configured (NEXT_PUBLIC_API_BASE). Paste a receipt instead.",
      );
      return;
    }
    const id = ringId.trim();
    if (!id) {
      setFetchError("missing field ring id");
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
      setReceiptText(pretty(body.receipt));
      setSnapshotText("");
      setResult(null);
    } catch {
      setFetchError(
        "API unreachable. Paste the receipt JSON for offline verify.",
      );
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="flex flex-col gap-12">
      <section className="border-t border-line pt-10">
        <h2 className="font-display text-[1.2rem] font-bold text-brass-100">
          How this works
        </h2>
        <ol className="mt-5 flex flex-col gap-3 text-[0.95rem] leading-relaxed text-ink-2">
          <li>Tickets follow public rules.</li>
          <li>Bag locks, then a snapshot freezes the ticket bag.</li>
          <li>Winner equals the published formula over that snapshot.</li>
          <li>We post a receipt (winner + inputs).</li>
          <li>
            This page recomputes. If it does not match, the receipt is wrong.
          </li>
        </ol>
        <p className="mt-5 text-[0.9rem] leading-relaxed text-ink-3">
          The keeper publishes the inputs. You verify the math. When payouts
          are still dry-run, a MATCH confirms the draw result only, not that
          funds moved.
        </p>
        <p className="mt-3 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-brass-500">
          Formula {FORMULA_VERSION}
        </p>
      </section>

      {apiBase ? (
        <section className="border-t border-line pt-10">
          <h2 className="font-display text-[1.15rem] font-bold text-brass-100">
            Fetch a published receipt
          </h2>
          <p className="mt-2 text-[0.9rem] text-ink-2">
            Optional. Paste still works fully offline.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="label-mono">Ring / window id</span>
              <input
                value={ringId}
                onChange={(e) => setRingId(e.target.value)}
                placeholder="bell-close-2026-09-15T20:00:00.000Z"
                className="h-11 rounded-sm border border-line-strong bg-floor-900 px-3 font-mono text-[0.8rem] text-ink placeholder:text-ink-3"
              />
            </label>
            <Button
              variant="secondary"
              onClick={() => void fetchReceipt()}
              disabled={fetching}
            >
              {fetching ? "Fetching…" : "Fetch receipt"}
            </Button>
          </div>
          {fetchError ? (
            <p className="mt-3 text-[0.88rem] text-ember-300" role="alert">
              {fetchError}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="border-t border-line pt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-[1.15rem] font-bold text-brass-100">
              Receipt JSON
            </h2>
            <p className="mt-2 text-[0.9rem] text-ink-2">
              Winner, window id, formula version, seed inputs, snapshot hash or
              snapshot body.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={loadFixture}>
              Load fixture
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
              onChange={(e) => void onReceiptFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <textarea
          value={receiptText}
          onChange={(e) => {
            setReceiptText(e.target.value);
            setResult(null);
            setParseError(null);
          }}
          spellCheck={false}
          rows={16}
          className="mt-4 w-full rounded-sm border border-line-strong bg-floor-900 px-3 py-3 font-mono text-[0.72rem] leading-relaxed text-ink"
          aria-label="Ring receipt JSON"
        />
      </section>

      <section className="border-t border-line pt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-[1.15rem] font-bold text-brass-100">
              Ticket snapshot (optional)
            </h2>
            <p className="mt-2 text-[0.9rem] text-ink-2">
              Wallet to tickets. Needed only when the receipt does not embed
              snapshot.
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
            onChange={(e) => void onSnapshotFile(e.target.files?.[0] ?? null)}
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
          aria-label="Ticket snapshot JSON"
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={runVerify} disabled={pending}>
          {pending ? "Recomputing…" : "Recompute winner"}
        </Button>
        <ButtonLink href="/docs" variant="secondary">
          Short rules
        </ButtonLink>
      </div>

      {parseError ? (
        <p className="text-[0.92rem] text-ember-300" role="alert">
          {parseError}
        </p>
      ) : null}

      {result ? <VerifyResults result={result} /> : null}

      <section className="border-t border-line pt-10">
        <h2 className="font-display text-[1.15rem] font-bold text-brass-100">
          How this calculation works
        </h2>
        <div className="mt-5 space-y-4 text-[0.92rem] leading-relaxed text-ink-2">
          <p>
            <span className="text-brass-200">1. Snapshot hash.</span> Sort
            wallets by address ascending. Join each line as{" "}
            <code className="font-mono text-[0.8rem] text-ink">
              address:tickets
            </code>{" "}
            with newlines. Hash the UTF-8 bytes with keccak256. That must equal
            receipt.snapshotHash.
          </p>
          <p>
            <span className="text-brass-200">2. Seed.</span> Material is{" "}
            <code className="font-mono text-[0.8rem] text-ink">
              lowercase(blockhash)|windowId|potBalance
            </code>
            . potBalance uses eight decimal places when stored as a number.
            Hash UTF-8 bytes with keccak256.
          </p>
          <p>
            <span className="text-brass-200">3. Weights.</span> Each wallet
            weight is min(tickets, floor(ticketsOut × oddsCapBps / 10000)).
            Entrants walk in weight descending, then address ascending.
          </p>
          <p>
            <span className="text-brass-200">4. Pick.</span>{" "}
            <code className="font-mono text-[0.8rem] text-ink">
              cursor = seed mod totalWeight
            </code>
            . Walk the ordered bag, subtracting each weight, until remaining is
            less than the current weight. That wallet wins.
          </p>
        </div>
      </section>
    </div>
  );
}

function VerifyResults({ result }: { result: VerifyResult }) {
  const tone = result.match
    ? "border-tape/50 bg-tape/10 text-tape"
    : "border-ember-500/50 bg-ember-500/10 text-ember-300";

  return (
    <section
      className="border-t border-line pt-10"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-xs border px-3 py-2 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em]",
          tone,
        )}
      >
        {result.match ? "Match" : "Mismatch"}
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ResultRow
          label="Computed winner"
          value={result.computedWinner ?? "n/a"}
        />
        <ResultRow
          label="Announced winner"
          value={result.announcedWinner ?? "n/a"}
        />
        <ResultRow
          label="Snapshot hash"
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
        <ResultRow label="Cursor" value={result.cursor ?? "n/a"} />
        <ResultRow
          label="Total weight"
          value={
            result.totalWeight === null ? "n/a" : String(result.totalWeight)
          }
        />
      </dl>

      {result.dryRun ? (
        <p className="mt-4 text-[0.88rem] text-ink-3">
          This receipt is marked dry-run. Verification covers the draw result,
          not a payout transfer.
        </p>
      ) : null}

      {result.errors.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-2 text-[0.88rem] text-ember-300">
          {result.errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}

      <ol className="mt-8 flex flex-col gap-4 border-t border-line pt-6">
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
    </section>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line pb-3">
      <dt className="label-mono">{label}</dt>
      <dd className="mt-1 break-all font-mono text-[0.82rem] text-ink">{value}</dd>
    </div>
  );
}
