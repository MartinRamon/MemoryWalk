import { exportBackup, importBackup, triggerDownload } from '../lib/backup.ts'
import { useRef, useState } from 'react'

type Status = { tone: 'ok' | 'error'; text: string } | null

export function BackupPanel() {
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [status, setStatus] = useState<Status>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function onExport() {
    setBusy('export')
    setStatus(null)
    try {
      const { blob, filename, summary } = await exportBackup()
      triggerDownload(blob, filename)
      setStatus({
        tone: 'ok',
        text: `Copia creada: ${summary.memories} recuerdos (${summary.media} archivos) y ${summary.places} lugares importados.`,
      })
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo crear la copia.' })
    } finally {
      setBusy(null)
    }
  }

  async function onImport(file: File) {
    setBusy('import')
    setStatus(null)
    try {
      const summary = await importBackup(file)
      setStatus({
        tone: 'ok',
        text: `Restaurados ${summary.memories} recuerdos y ${summary.places} lugares. Recargando…`,
      })
      setTimeout(() => window.location.reload(), 900)
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo restaurar la copia.' })
      setBusy(null)
    }
  }

  return (
    <section className="home-section">
      <div className="section-head">
        <div>
          <p className="kicker">Datos</p>
          <h2 className="font-display text-3xl text-ink">Copia de seguridad</h2>
        </div>
      </div>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
        Tus recuerdos y lugares importados viven solo en este navegador. Descarga una copia en un
        único archivo <code>.zip</code> (fotos, vídeos y fichas) y restáurala aquí cuando cambies de
        equipo o limpies el navegador. Restaurar no borra lo que ya tengas.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-solid" disabled={busy != null} onClick={() => void onExport()}>
          {busy === 'export' ? 'Creando copia…' : 'Descargar copia'}
        </button>
        <label className={`chip ${busy != null ? 'opacity-60' : ''}`}>
          {busy === 'import' ? 'Restaurando…' : 'Restaurar copia'}
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            disabled={busy != null}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void onImport(file)
            }}
          />
        </label>
        {status ? (
          <p
            className="text-sm"
            style={{ color: status.tone === 'error' ? 'var(--color-danger)' : 'var(--color-moss)' }}
            role="status"
          >
            {status.text}
          </p>
        ) : null}
      </div>
    </section>
  )
}
