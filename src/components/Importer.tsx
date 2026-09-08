type ImporterProps = {
  busy: boolean
  onFiles: (files: FileList) => void
  label?: string
  tone?: 'solid' | 'chip'
}

export function Importer({ busy, onFiles, label = 'Añadir recuerdos', tone = 'solid' }: ImporterProps) {
  return (
    <label className={`${tone === 'chip' ? 'chip' : 'btn-solid'} ${busy ? 'opacity-60' : ''}`}>
      {busy ? 'Leyendo…' : label}
      <input
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        disabled={busy}
        onChange={(event) => {
          if (event.target.files?.length) onFiles(event.target.files)
          event.target.value = ''
        }}
      />
    </label>
  )
}
