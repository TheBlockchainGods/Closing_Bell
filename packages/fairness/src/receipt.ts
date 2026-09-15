import {
  FORMULA_VERSION,
  buildDrawEntrants,
  drawSeedHex,
  formatPotBalance,
  normalizeAddress,
  pickWeightedWinner,
  snapshotHash,
  snapshotToRecord,
  type TicketSnapshotInput,
} from "./draw.js";

/** Published ring receipt. Operator publishes; public verifies. */
export interface RingReceipt {
  formulaVersion: string;
  windowId: string;
  /** Winner announced by the keeper. */
  announcedWinner: string;
  blockhashAtSnapshot: string;
  /** Exact pot string (or number) used in the seed material. */
  potBalance: string | number;
  oddsCapBps: number;
  /** keccak256 of the canonical ticket snapshot. */
  snapshotHash: string;
  /**
   * Wallet → tickets at bag lock.
   * May be omitted when a separate snapshot body is supplied to verify.
   */
  snapshot?: Record<string, number> | Array<{ address: string; tickets: number }>;
  seed?: string;
  cursor?: string;
  totalWeight?: number;
  dryRun?: boolean;
  txHash?: string | null;
  ringedAt?: string;
  /** Honest framing: draw is published by the keeper for public check. */
  publishedBy?: "keeper";
}

export interface VerifyStep {
  label: string;
  detail: string;
}

export interface VerifyResult {
  ok: boolean;
  match: boolean;
  formulaVersion: string;
  formulaVersionMatch: boolean;
  computedWinner: string | null;
  announcedWinner: string | null;
  computedSeed: string | null;
  publishedSeed: string | null;
  seedMatch: boolean | null;
  computedSnapshotHash: string | null;
  publishedSnapshotHash: string | null;
  snapshotHashMatch: boolean | null;
  cursor: string | null;
  totalWeight: number | null;
  dryRun: boolean | null;
  errors: string[];
  steps: VerifyStep[];
}

export function buildRingReceipt(input: {
  windowId: string;
  announcedWinner: string;
  blockhashAtSnapshot: string;
  potBalance: string | number;
  oddsCapBps: number;
  snapshot: TicketSnapshotInput;
  dryRun?: boolean;
  txHash?: string | null;
  ringedAt?: string;
}): RingReceipt {
  const potBalance = formatPotBalance(input.potBalance);
  const snapshot = snapshotToRecord(input.snapshot);
  const entrants = buildDrawEntrants(snapshot, input.oddsCapBps);
  const seed = drawSeedHex({
    blockhashAtSnapshot: input.blockhashAtSnapshot,
    windowId: input.windowId,
    potBalance,
  });
  const picked = pickWeightedWinner(entrants, seed);

  return {
    formulaVersion: FORMULA_VERSION,
    windowId: input.windowId,
    announcedWinner: normalizeAddress(input.announcedWinner),
    blockhashAtSnapshot: input.blockhashAtSnapshot.toLowerCase(),
    potBalance,
    oddsCapBps: input.oddsCapBps,
    snapshotHash: snapshotHash(snapshot),
    snapshot,
    seed,
    cursor: picked ? picked.cursor.toString() : undefined,
    totalWeight: picked?.totalWeight,
    dryRun: input.dryRun,
    txHash: input.txHash ?? null,
    ringedAt: input.ringedAt,
    publishedBy: "keeper",
  };
}

function missing(field: string): string {
  return `missing field ${field}`;
}

/**
 * Recompute the winner from a receipt (+ optional external snapshot).
 * Same snapshot + same public formula → same winner.
 */
export function verifyRing(
  receipt: unknown,
  externalSnapshot?: TicketSnapshotInput | null,
): VerifyResult {
  const errors: string[] = [];
  const steps: VerifyStep[] = [];

  if (!receipt || typeof receipt !== "object") {
    return {
      ok: false,
      match: false,
      formulaVersion: FORMULA_VERSION,
      formulaVersionMatch: false,
      computedWinner: null,
      announcedWinner: null,
      computedSeed: null,
      publishedSeed: null,
      seedMatch: null,
      computedSnapshotHash: null,
      publishedSnapshotHash: null,
      snapshotHashMatch: null,
      cursor: null,
      totalWeight: null,
      dryRun: null,
      errors: ["receipt must be a JSON object"],
      steps,
    };
  }

  const r = receipt as Partial<RingReceipt>;
  const formulaVersion = String(r.formulaVersion ?? "");
  const formulaVersionMatch = formulaVersion === FORMULA_VERSION;
  if (!r.formulaVersion) errors.push(missing("formulaVersion"));
  else if (!formulaVersionMatch) {
    errors.push(
      `unsupported formulaVersion "${formulaVersion}" (this page knows ${FORMULA_VERSION})`,
    );
  }

  if (!r.windowId) errors.push(missing("windowId"));
  if (!r.announcedWinner) errors.push(missing("announcedWinner"));
  if (!r.blockhashAtSnapshot) errors.push(missing("blockhashAtSnapshot"));
  if (r.potBalance === undefined || r.potBalance === null || r.potBalance === "") {
    errors.push(missing("potBalance"));
  }
  if (r.oddsCapBps === undefined || r.oddsCapBps === null) {
    errors.push(missing("oddsCapBps"));
  } else if (!Number.isFinite(Number(r.oddsCapBps))) {
    errors.push("oddsCapBps must be a number");
  }
  if (!r.snapshotHash) errors.push(missing("snapshotHash"));

  const snapshotSource =
    externalSnapshot ??
    r.snapshot ??
    null;
  if (!snapshotSource) {
    errors.push(
      "missing ticket snapshot (embed receipt.snapshot or paste a separate snapshot JSON)",
    );
  }

  steps.push({
    label: "Inputs",
    detail: errors.length
      ? `Could not start: ${errors.join("; ")}`
      : `windowId=${r.windowId}, oddsCapBps=${r.oddsCapBps}, potBalance=${formatPotBalance(r.potBalance as string | number)}`,
  });

  if (errors.length > 0 || !snapshotSource) {
    return {
      ok: false,
      match: false,
      formulaVersion: FORMULA_VERSION,
      formulaVersionMatch,
      computedWinner: null,
      announcedWinner: r.announcedWinner
        ? normalizeAddress(String(r.announcedWinner))
        : null,
      computedSeed: null,
      publishedSeed: r.seed ? String(r.seed) : null,
      seedMatch: null,
      computedSnapshotHash: null,
      publishedSnapshotHash: r.snapshotHash ? String(r.snapshotHash) : null,
      snapshotHashMatch: null,
      cursor: null,
      totalWeight: null,
      dryRun: typeof r.dryRun === "boolean" ? r.dryRun : null,
      errors,
      steps,
    };
  }

  const computedSnapshotHash = snapshotHash(snapshotSource);
  const publishedSnapshotHash = String(r.snapshotHash).toLowerCase();
  const snapshotHashMatch =
    computedSnapshotHash.toLowerCase() === publishedSnapshotHash;

  steps.push({
    label: "Snapshot hash",
    detail: snapshotHashMatch
      ? `MATCH ${computedSnapshotHash}`
      : `MISMATCH computed=${computedSnapshotHash} published=${publishedSnapshotHash}`,
  });

  if (!snapshotHashMatch) {
    errors.push("snapshot hash does not match published snapshotHash");
  }

  const potBalance = formatPotBalance(r.potBalance as string | number);
  const computedSeed = drawSeedHex({
    blockhashAtSnapshot: String(r.blockhashAtSnapshot),
    windowId: String(r.windowId),
    potBalance,
  });
  const publishedSeed = r.seed ? String(r.seed).toLowerCase() : null;
  const seedMatch = publishedSeed
    ? computedSeed.toLowerCase() === publishedSeed
    : null;

  steps.push({
    label: "Seed",
    detail:
      `material = lowercase(blockhash)|windowId|pot → keccak256 → ${computedSeed}` +
      (seedMatch === false
        ? ` (published seed MISMATCH ${publishedSeed})`
        : seedMatch === true
          ? " (published seed MATCH)"
          : ""),
  });

  if (seedMatch === false) {
    errors.push("published seed does not match recomputed seed");
  }

  const entrants = buildDrawEntrants(snapshotSource, Number(r.oddsCapBps));
  steps.push({
    label: "Entrants",
    detail: `${entrants.length} wallets after odds cap; walk order is weight DESC, address ASC`,
  });

  const picked = pickWeightedWinner(entrants, computedSeed);
  if (!picked) {
    errors.push("no winner (empty bag or zero total weight)");
    steps.push({
      label: "Weighted pick",
      detail: "totalWeight=0; no winner",
    });
    return {
      ok: false,
      match: false,
      formulaVersion: FORMULA_VERSION,
      formulaVersionMatch,
      computedWinner: null,
      announcedWinner: normalizeAddress(String(r.announcedWinner)),
      computedSeed,
      publishedSeed,
      seedMatch,
      computedSnapshotHash,
      publishedSnapshotHash,
      snapshotHashMatch,
      cursor: null,
      totalWeight: 0,
      dryRun: typeof r.dryRun === "boolean" ? r.dryRun : null,
      errors,
      steps,
    };
  }

  steps.push({
    label: "Weighted pick",
    detail: `cursor = seed mod totalWeight = ${picked.cursor} (totalWeight=${picked.totalWeight}); walk until remaining < weight`,
  });

  const computedWinner = picked.winner.address;
  const announcedWinner = normalizeAddress(String(r.announcedWinner));
  const match = computedWinner === announcedWinner && snapshotHashMatch && formulaVersionMatch && seedMatch !== false;

  steps.push({
    label: "Winner",
    detail: match
      ? `MATCH ${computedWinner}`
      : `MISMATCH computed=${computedWinner} announced=${announcedWinner}`,
  });

  if (!match && computedWinner !== announcedWinner) {
    errors.push("computed winner does not match announcedWinner");
  }

  return {
    ok: errors.length === 0 && match,
    match,
    formulaVersion: FORMULA_VERSION,
    formulaVersionMatch,
    computedWinner,
    announcedWinner,
    computedSeed,
    publishedSeed,
    seedMatch,
    computedSnapshotHash,
    publishedSnapshotHash,
    snapshotHashMatch,
    cursor: picked.cursor.toString(),
    totalWeight: picked.totalWeight,
    dryRun: typeof r.dryRun === "boolean" ? r.dryRun : null,
    errors,
    steps,
  };
}
