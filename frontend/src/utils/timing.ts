import type { ServiceTicketStatus, TicketTiming } from '../api/contracts'
export function countdown(deadline: string | null | undefined, duration: number | null | undefined, now: number) {
 const at = deadline ? new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(deadline) ? deadline : `${deadline}+07:00`).getTime() : NaN
 if (!Number.isFinite(at)) return { tone: 'unknown', text: 'Chưa xác định', minutes: null }
 const delta = (at - now) / 60000
 const minutes = Math.ceil(Math.abs(delta))
 return { tone: delta < 0 ? 'red' : delta <= Math.max(15, Math.ceil((duration ?? 0) * .2)) ? 'yellow' : 'green', text: delta < 0 ? `Quá ${minutes} phút` : `Còn ${minutes} phút`, minutes: delta < 0 ? -minutes : minutes }
}
export function timingAttention(status: ServiceTicketStatus, timing: TicketTiming | undefined, now: number) {
 if (['WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED'].includes(status)) return 4
 if (status === 'WAITING_ASSIGNMENT' && countdown(timing?.assignmentDueAt, 15, now).tone === 'red') return 0
 const complete = countdown(timing?.estimatedCompletionAt, timing?.estimatedDurationMinutes, now)
 if (complete.tone === 'red') return 1
 if (complete.tone === 'yellow' || (status === 'WAITING_ASSIGNMENT' && countdown(timing?.assignmentDueAt, 15, now).tone === 'yellow')) return 2
 return 3
}
