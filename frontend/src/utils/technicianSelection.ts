export type SaveOutcome = { id: number; ok: boolean }

export function toggleSelection(selected: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function selectAllEligible(selected: ReadonlySet<number>, eligibleIds: readonly number[]): Set<number> {
  const next = new Set(selected)
  eligibleIds.forEach(id => next.add(id))
  return next
}

export function deselectAllEligible(selected: ReadonlySet<number>, eligibleIds: readonly number[]): Set<number> {
  const next = new Set(selected)
  eligibleIds.forEach(id => next.delete(id))
  return next
}

export function removeSavedSelections(selected: ReadonlySet<number>, outcomes: readonly SaveOutcome[]): Set<number> {
  const next = new Set(selected)
  outcomes.filter(outcome => outcome.ok).forEach(outcome => next.delete(outcome.id))
  return next
}
