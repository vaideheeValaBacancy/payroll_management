/**
 * Phase 8 — Cryptographic, append-only audit chain.
 *
 * Each audit entry is hash-chained to its predecessor (blockchain-style):
 *     entryHash = SHA256( seq | timestamp | action | entityType | entityId |
 *                         performedBy | canonical(details) | prevHash )
 *
 * Any post-hoc edit to a row changes its entryHash, which breaks every
 * subsequent prevHash link — making tampering and deletion detectable.
 * Uses the Web Crypto SubtleCrypto API (available in both browser and the
 * Next.js server runtime), so there is no external dependency.
 */
import type { AuditLog } from "@/types";

export const GENESIS_HASH = "0".repeat(64);

/** Stable JSON: keys sorted recursively so the same object always serializes identically. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(obj[k])).join(",") + "}";
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compute the canonical content string for an audit entry.
 * Timestamp is reduced to epoch millis so it is deterministic across reads.
 */
function entryContent(
  entry: Pick<AuditLog, "seq" | "action" | "entityType" | "entityId" | "performedBy" | "details"> & { tsMillis: number },
  prevHash: string
): string {
  return canonical({
    seq: entry.seq,
    tsMillis: entry.tsMillis,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    performedBy: entry.performedBy,
    details: entry.details,
    prevHash,
  });
}

/** Hash a brand-new entry being appended to the chain. */
export async function computeEntryHash(
  entry: {
    seq: number;
    tsMillis: number;
    action: string;
    entityType: AuditLog["entityType"];
    entityId: string;
    performedBy: string;
    details: Record<string, unknown>;
  },
  prevHash: string
): Promise<string> {
  return sha256Hex(entryContent(entry, prevHash));
}

/** Re-derive the hash of a stored entry, for verification. */
export async function recomputeStoredHash(log: AuditLog): Promise<string> {
  const tsMillis =
    log.timestamp && typeof log.timestamp.toMillis === "function"
      ? log.timestamp.toMillis()
      : 0;
  return sha256Hex(
    entryContent(
      {
        seq: log.seq ?? 0,
        tsMillis,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        performedBy: log.performedBy,
        details: log.details,
      },
      log.prevHash ?? GENESIS_HASH
    )
  );
}

/**
 * Walk a chain (ascending seq order) and verify integrity:
 *   1. each entry's stored entryHash matches its recomputed hash (no tampering)
 *   2. each entry's prevHash equals the previous entry's entryHash (no reorder/insert)
 *   3. seq numbers are contiguous (no deletion)
 */
export async function verifyChain(logsAscending: AuditLog[]): Promise<{
  valid: boolean;
  total: number;
  verified: number;
  brokenAt: number | null;
  reason: string | null;
}> {
  let prevHash = GENESIS_HASH;
  let expectedSeq = 1;
  let verified = 0;

  for (const log of logsAscending) {
    // Legacy rows with no chain fields can't be verified — treat as unsigned.
    if (log.entryHash == null || log.seq == null) {
      return {
        valid: false,
        total: logsAscending.length,
        verified,
        brokenAt: log.seq ?? expectedSeq,
        reason: "Unsigned legacy entry found (predates cryptographic chaining)",
      };
    }

    if (log.seq !== expectedSeq) {
      return {
        valid: false,
        total: logsAscending.length,
        verified,
        brokenAt: expectedSeq,
        reason: `Sequence gap — expected ${expectedSeq}, found ${log.seq} (possible deletion)`,
      };
    }

    if (log.prevHash !== prevHash) {
      return {
        valid: false,
        total: logsAscending.length,
        verified,
        brokenAt: log.seq,
        reason: `Broken link at seq ${log.seq} — prevHash does not match prior entry`,
      };
    }

    const recomputed = await recomputeStoredHash(log);
    if (recomputed !== log.entryHash) {
      return {
        valid: false,
        total: logsAscending.length,
        verified,
        brokenAt: log.seq,
        reason: `Tampered content at seq ${log.seq} — hash mismatch`,
      };
    }

    prevHash = log.entryHash;
    expectedSeq += 1;
    verified += 1;
  }

  return { valid: true, total: logsAscending.length, verified, brokenAt: null, reason: null };
}
