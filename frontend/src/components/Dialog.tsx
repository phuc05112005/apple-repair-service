import { Children, isValidElement, useEffect, useRef, type ReactNode } from 'react'

function containsSubmittingLabel(node: ReactNode): boolean {
  let submitting = false
  Children.forEach(node, child => {
    if (submitting) return
    if (typeof child === 'string' && child.trim().startsWith('Đang ')) submitting = true
    else if (isValidElement<{ children?: ReactNode }>(child)) submitting = containsSubmittingLabel(child.props.children)
  })
  return submitting
}

export function ConfirmDialog({ title, children, busy, confirmLabel = 'Xóa', onCancel, onConfirm }: {
  title: string
  children: ReactNode
  busy?: boolean
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])
  return <dialog ref={ref} className="confirm-dialog" aria-labelledby="confirm-title" aria-busy={busy} onCancel={event => { event.preventDefault(); if (!busy) onCancel() }} onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <div className="dialog-icon dialog-icon--danger" aria-hidden="true">!</div>
    <h2 id="confirm-title">{title}</h2>
    <div className="dialog-copy">{children}</div>
    <div className="dialog-actions"><button className="button button--quiet" disabled={busy} onClick={onCancel}>Hủy</button><button className="button button--danger" disabled={busy} onClick={onConfirm}>{busy ? 'Đang xóa…' : confirmLabel}</button></div>
  </dialog>
}

export function DetailDrawer({ title, eyebrow, children, footer, busy = false, onClose }: {
  title: string
  eyebrow?: string
  children: ReactNode
  footer?: ReactNode
  busy?: boolean
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const locked = busy || containsSubmittingLabel(footer)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])
  return <dialog ref={ref} className="detail-dialog" aria-labelledby="drawer-title" aria-busy={locked} onCancel={event => { event.preventDefault(); if (!locked) onClose() }} onMouseDown={event => { if (event.target === event.currentTarget && !locked) onClose() }}>
    <div className="detail-dialog__panel">
      <header><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2 id="drawer-title">{title}</h2></div><button className="icon-button" aria-label="Đóng chi tiết" disabled={locked} onClick={onClose}>×</button></header>
      <div className="detail-dialog__body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </div>
  </dialog>
}

