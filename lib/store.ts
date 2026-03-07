import type { ReconciliationResult } from "./types";

let lastResult: ReconciliationResult | null = null;

export function setLastResult(result: ReconciliationResult) {
  lastResult = result;
}

export function getLastResult() {
  return lastResult;
}
