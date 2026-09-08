import { describe, expect, it } from 'vitest'
import { createJob, failJob, finishJob, getJob, setStage } from './jobs.ts'
import type { UrlIngestDraft } from '../src/types/ingest.ts'

function draft(): UrlIngestDraft {
  return {
    sourceUrl: 'https://www.tiktok.com/@u/video/1',
    sourceKind: 'tiktok',
    caption: '',
    name: 'Felice a Testaccio',
    note: '',
    dishes: [],
    category: 'trattoria',
    location: { lat: 41.88, lng: 12.47 },
    extractor: 'grok',
  }
}

describe('jobs', () => {
  it('empieza en reading / running', () => {
    const id = createJob()
    const job = getJob(id)
    expect(job).toMatchObject({ stage: 'reading', status: 'running' })
  })

  it('avanza de etapa', () => {
    const id = createJob()
    setStage(id, 'transcribing')
    expect(getJob(id)?.stage).toBe('transcribing')
  })

  it('finishJob deja el borrador y estado done', () => {
    const id = createJob()
    finishJob(id, draft())
    const job = getJob(id)
    expect(job?.status).toBe('done')
    expect(job?.stage).toBe('done')
    expect(job?.draft?.name).toBe('Felice a Testaccio')
  })

  it('failJob deja el error y estado error', () => {
    const id = createJob()
    failJob(id, 'No hemos podido leer ese enlace.')
    const job = getJob(id)
    expect(job?.status).toBe('error')
    expect(job?.error).toBe('No hemos podido leer ese enlace.')
  })

  it('getJob devuelve null para un id desconocido', () => {
    expect(getJob('no-existe')).toBeNull()
  })
})
