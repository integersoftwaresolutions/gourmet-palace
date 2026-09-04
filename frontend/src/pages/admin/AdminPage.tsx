import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { FiPlus } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import {
  Button,
  Input,
  Modal,
  Pill,
  Select,
  Table,
  Tabs,
  type TableColumn,
} from '../../components/ui'
import {
  ApiClientError,
  fieldErrors,
  locationsApi,
  usersApi,
  type AdminUser,
  type Location,
} from '../../lib/api'

type UserRow = AdminUser & Record<string, unknown>

export function AdminPage() {
  const navigate = useNavigate()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [usersRes, locsRes] = await Promise.all([
        usersApi.list(),
        locationsApi.list(),
      ])
      setUsers(usersRes.data.users)
      setLocations(locsRes.data.locations)
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Failed to load admin data',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [usersRes, locsRes] = await Promise.all([
          usersApi.list(),
          locationsApi.list(),
        ])
        if (cancelled) return
        setUsers(usersRes.data.users)
        setLocations(locsRes.data.locations)
      } catch (err) {
        if (cancelled) return
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'Failed to load admin data',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const userColumns: TableColumn<UserRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div>
          <p className="font-medium text-card-text">{row.name}</p>
          <p className="text-xs text-card-text-muted md:hidden">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => (
        <span className="text-card-text-muted">{row.email}</span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <Pill
          tone={
            row.role === 'owner' || row.role === 'admin' ? 'accent' : 'neutral'
          }
          variant="outline"
        >
          {row.role}
        </Pill>
      ),
    },
    {
      key: 'locations',
      header: 'Locations',
      render: (row) => (
        <span className="text-card-text-muted">
          {row.locations?.map((l) => l.name).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Pill
          tone={
            row.status === 'active'
              ? 'success'
              : row.status === 'invited'
                ? 'warning'
                : 'neutral'
          }
          variant="outline"
          dot
        >
          {row.status}
        </Pill>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        row.role === 'owner' ? null : (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditUser(row)}>Edit</Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void usersApi
                  .update(row.id, { isActive: !row.isActive })
                  .then(() => load())
                  .catch((err: unknown) =>
                    setError(
                      err instanceof ApiClientError
                        ? err.message
                        : 'Update failed',
                    ),
                  )
              }}
            >
              {row.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        ),
    },
  ]

  return (
    <AppShell
      title="Administration"
      subtitle="Users, locations, integrations, thresholds and system health"
      activeNav="admin"
      badge={
        <Pill tone="accent" variant="outline">
          Admin only
        </Pill>
      }
    >
      <Tabs
        variant="underline"
        value="users"
        onChange={(id) => {
          if (id === 'users') navigate('/admin')
          if (id === 'locations') navigate('/admin/locations')
          if (id === 'integrations') navigate('/admin/integrations')
          if (id === 'system') navigate('/admin/system')
        }}
        items={[
          { id: 'users', label: 'Users' },
          { id: 'locations', label: 'Locations' },
          { id: 'integrations', label: 'Integrations' },
          { id: 'system', label: 'System & thresholds' },
        ]}
        className="mb-6"
      />

      {error && (
        <p className="mb-4 rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger-subtle-text">
          {error}
        </p>
      )}

      <div className="mb-4 flex justify-start">
        <Button
          tone="brand"
          size="sm"
          leftIcon={<FiPlus className="size-4" />}
          onClick={() => setInviteOpen(true)}
        >
          Invite user
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-surface-text-muted">Loading…</p>
      ) : (
        <Table
          columns={userColumns}
          rows={users as UserRow[]}
          getRowKey={(row) => row.id}
          emptyMessage="No users yet"
        />
      )}

      {inviteOpen && (
        <InviteUserModal
          key="invite"
          locations={locations.filter((l) => l.status === 'active')}
          onClose={() => setInviteOpen(false)}
          onInvited={async () => {
            setInviteOpen(false)
            await load()
          }}
        />
      )}
      {editUser && (
        <EditUserModal
          key={editUser.id}
          user={editUser}
          locations={locations.filter((l) => l.status === 'active')}
          onClose={() => setEditUser(null)}
          onSaved={async () => {
            setEditUser(null)
            await load()
          }}
        />
      )}
    </AppShell>
  )
}

function InviteUserModal({
  locations,
  onClose,
  onInvited,
}: {
  locations: Location[]
  onClose: () => void
  onInvited: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'manager'>('manager')
  const [locationIds, setLocationIds] = useState<string[]>(locations[0]?.id ? [locations[0].id] : [])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e?: FormEvent) {
    e?.preventDefault()
    setLoading(true)
    setErrors({})
    setFormError(null)
    try {
      await usersApi.invite({
        name: name.trim(),
        email: email.trim(),
        role,
        locationIds: role === 'manager' ? locationIds : [],
      })
      await onInvited()
    } catch (err) {
      setErrors(fieldErrors(err))
      setFormError(
        err instanceof ApiClientError ? err.message : 'Invite failed',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Invite user"
      description="They’ll receive a time-limited activation link to set their own password."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="brand"
            loading={loading}
            onClick={() => void onSubmit()}
          >
            Send invite
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Input
          label="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
        />
        <Select
          label="Role"
          value={role}
          onChange={(v) => setRole(v as 'admin' | 'manager')}
          options={[
            { value: 'manager', label: 'Manager' },
            { value: 'admin', label: 'Admin' },
          ]}
        />
        {role === 'manager' && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-card-text">Assigned locations</legend>
            <div className="space-y-2 rounded-lg border border-card-border p-3">
              {locations.map((l) => <label key={l.id} className="flex items-center gap-2 text-sm text-card-text-muted"><input type="checkbox" checked={locationIds.includes(l.id)} onChange={e=>setLocationIds(cur=>e.target.checked?[...new Set([...cur,l.id])]:cur.filter(id=>id!==l.id))}/>{l.name}</label>)}
            </div>
            {errors.locationIds&&<p className="mt-1 text-xs text-danger-subtle-text">{errors.locationIds}</p>}
          </fieldset>
        )}
        {formError && (
          <p className="text-sm text-danger-subtle-text">{formError}</p>
        )}
      </form>
    </Modal>
  )
}



function EditUserModal({user,locations,onClose,onSaved}:{user:AdminUser;locations:Location[];onClose:()=>void;onSaved:()=>Promise<void>}) {
  const [name,setName]=useState(user.name)
  const [role,setRole]=useState<'admin'|'manager'>(user.role==='admin'?'admin':'manager')
  const [locationIds,setLocationIds]=useState<string[]>(user.locations?.filter(l=>l.id!=='*').map(l=>l.id)||[])
  const prefs=user.notificationPreferences||{email:true,inApp:true,alerts:true,brief:true}
  const [email,setEmail]=useState(prefs.email!==false),[inApp,setInApp]=useState(prefs.inApp!==false),[alerts,setAlerts]=useState(prefs.alerts!==false),[brief,setBrief]=useState(prefs.brief!==false)
  const [saving,setSaving]=useState(false),[error,setError]=useState('')
  const save=async()=>{setSaving(true);setError('');try{await usersApi.update(user.id,{name:name.trim(),role,locationIds:role==='manager'?locationIds:[],notificationPreferences:{email,inApp,alerts,brief}});await onSaved()}catch(err){setError(err instanceof ApiClientError?err.message:'Update failed')}finally{setSaving(false)}}
  return <Modal open onClose={onClose} title="Edit user" description="Role, location scope and notification subscriptions take effect on subsequent authorized requests." footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button tone="brand" loading={saving} onClick={()=>void save()}>Save changes</Button></>}><div className="space-y-4"><Input label="Full name" value={name} onChange={e=>setName(e.target.value)}/><Select label="Role" value={role} onChange={v=>setRole(v as 'admin'|'manager')} options={[{value:'manager',label:'Manager'},{value:'admin',label:'Admin'}]}/>{role==='manager'&&<fieldset><legend className="mb-2 text-sm font-medium text-card-text">Assigned locations</legend><div className="space-y-2 rounded-lg border border-card-border p-3">{locations.map(l=><label key={l.id} className="flex items-center gap-2 text-sm text-card-text-muted"><input type="checkbox" checked={locationIds.includes(l.id)} onChange={e=>setLocationIds(cur=>e.target.checked?[...new Set([...cur,l.id])]:cur.filter(id=>id!==l.id))}/>{l.name}</label>)}</div></fieldset>}<fieldset><legend className="mb-2 text-sm font-medium text-card-text">Notification & Brief subscriptions</legend><div className="grid gap-2 sm:grid-cols-2"><label className="flex items-center gap-2 text-sm text-card-text-muted"><input type="checkbox" checked={email} onChange={e=>setEmail(e.target.checked)}/>Email delivery</label><label className="flex items-center gap-2 text-sm text-card-text-muted"><input type="checkbox" checked={inApp} onChange={e=>setInApp(e.target.checked)}/>In-app notifications</label><label className="flex items-center gap-2 text-sm text-card-text-muted"><input type="checkbox" checked={alerts} onChange={e=>setAlerts(e.target.checked)}/>Alert emails</label><label className="flex items-center gap-2 text-sm text-card-text-muted"><input type="checkbox" checked={brief} onChange={e=>setBrief(e.target.checked)}/>Morning Brief emails</label></div></fieldset>{error&&<p className="text-sm text-danger-subtle-text">{error}</p>}</div></Modal>
}
