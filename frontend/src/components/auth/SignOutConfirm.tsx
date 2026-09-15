import { useState } from 'react'
import { Button, Modal } from '../ui'
import { useAuth } from '../../context/useAuth'
import { asyncMessage } from '../../lib/asyncError'

type Props = {
  open: boolean
  onClose: () => void
}

export function SignOutConfirm({ open, onClose }: Props) {
  const { signout } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const close = () => {
    if (busy) return
    setError('')
    onClose()
  }

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      await signout()
    } catch (err) {
      setError(asyncMessage(err, 'Unable to sign out. Try again.'))
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Sign out"
      description="You will need to sign in again to access Gourmet Palace."
      size="sm"
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button tone="danger" loading={busy} onClick={() => void confirm()}>
            {busy ? 'Signing out…' : 'Sign out'}
          </Button>
        </>
      }
    >
      {error ? <p className="text-sm text-danger-subtle-text">{error}</p> : null}
    </Modal>
  )
}
