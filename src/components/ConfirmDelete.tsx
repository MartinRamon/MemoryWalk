import { useEffect, useRef } from 'react'

type ConfirmDeleteProps = {
  open: boolean
  title: string
  description: string
  previewUrl?: string
  previewAlt?: string
  isVideo?: boolean
  confirmLabel?: string
  cancelLabel?: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDelete({
  open,
  title,
  description,
  previewUrl,
  previewAlt,
  isVideo = false,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Conservar',
  onCancel,
  onConfirm,
}: ConfirmDeleteProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby="confirm-delete-title"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      onClick={(event) => {
        if (event.target === ref.current) onCancel()
      }}
    >
      <p className="kicker">Acción irreversible</p>
      <h2 id="confirm-delete-title" className="font-display text-2xl leading-tight text-ink">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</p>

      {previewUrl ? (
        <div className="confirm-dialog__preview">
          {isVideo ? (
            <video src={previewUrl} className="h-full w-full object-cover" muted playsInline />
          ) : (
            <img src={previewUrl} alt={previewAlt ?? ''} className="h-full w-full object-cover" />
          )}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className="btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
