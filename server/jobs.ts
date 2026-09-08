import { randomUUID } from 'node:crypto'
import type { IngestJobStatus, IngestStage, UrlIngestDraft } from '../src/types/ingest.ts'

type Job = IngestJobStatus & { createdAt: number; updatedAt: number }

const JOB_TTL_MS = 10 * 60_000
const jobs = new Map<string, Job>()

function prune(now: number): void {
  for (const [id, job] of jobs) {
    if (now - job.updatedAt > JOB_TTL_MS) jobs.delete(id)
  }
}

export function createJob(): string {
  const now = Date.now()
  prune(now)
  const id = randomUUID()
  jobs.set(id, { id, stage: 'reading', status: 'running', createdAt: now, updatedAt: now })
  return id
}

export function setStage(id: string, stage: IngestStage): void {
  const job = jobs.get(id)
  if (!job) return
  job.stage = stage
  job.updatedAt = Date.now()
}

export function finishJob(id: string, draft: UrlIngestDraft): void {
  const job = jobs.get(id)
  if (!job) return
  job.stage = 'done'
  job.status = 'done'
  job.draft = draft
  job.updatedAt = Date.now()
}

export function failJob(id: string, error: string): void {
  const job = jobs.get(id)
  if (!job) return
  job.stage = 'error'
  job.status = 'error'
  job.error = error
  job.updatedAt = Date.now()
}

export function getJob(id: string): IngestJobStatus | null {
  const job = jobs.get(id)
  if (!job) return null
  const { id: jobId, stage, status, draft, error } = job
  return { id: jobId, stage, status, draft, error }
}
