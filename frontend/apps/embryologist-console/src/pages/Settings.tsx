import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useUsers, useCreateUser, useUpdateUser } from '../hooks/useUsers'
import { useChecklistTemplates } from '../hooks/useChecklists'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { UserResponse, ChecklistTemplate, StorageLocation } from '../types'

// ---------------------------------------------------------------------------
// Storage hooks (local to Settings)
// ---------------------------------------------------------------------------

function useStorage() {
  return useQuery({
    queryKey: ['storage'],
    queryFn: () => api.get<StorageLocation[]>('/storage'),
  })
}

function useCreateStorage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      name: string
      type: string
      parent_id: string | null
      is_managed: boolean
      capacity: number | null
    }) => api.post<StorageLocation>('/storage', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage'] })
    },
  })
}

function useCreateTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      name: string
      procedure_type: string
      items: Array<{ order: number; label: string; required: boolean; field_type: string }>
    }) => api.post<ChecklistTemplate>('/checklist-templates', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-templates'] })
    },
  })
}

function useUpdateTemplate(templateId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<ChecklistTemplate>) =>
      api.patch<ChecklistTemplate>(`/checklist-templates/${templateId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-templates'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------

function Badge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Users Tab
// ---------------------------------------------------------------------------

const ROLES = ['embryologist', 'senior_embryologist', 'lab_manager', 'clinic_admin']

function UserRow({ user }: { user: UserResponse }) {
  const update = useUpdateUser(user.id)

  const handleRoleChange = (role: string) => {
    update.mutate({ role })
  }

  const handleToggleActive = () => {
    update.mutate({ is_active: !user.is_active })
  }

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{user.full_name || '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
      <td className="px-4 py-3">
        <select
          value={user.role}
          onChange={(e) => handleRoleChange(e.target.value)}
          disabled={update.isPending}
          className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={handleToggleActive}
          disabled={update.isPending}
          className="disabled:opacity-60"
          title={user.is_active ? 'Click to deactivate' : 'Click to activate'}
        >
          <Badge active={user.is_active} />
        </button>
      </td>
    </tr>
  )
}

function AddUserForm({ onClose }: { onClose: () => void }) {
  const create = useCreateUser()
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'embryologist' })
  const [err, setErr] = useState<string | null>(null)

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    try {
      await create.mutateAsync(form)
      onClose()
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to create user')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-blue-50 border border-blue-200 rounded-xl p-5 mt-4 space-y-3">
      <h3 className="font-semibold text-gray-900 text-sm">New User</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Full Name</label>
          <input
            required
            value={form.full_name}
            onChange={(e) => set('full_name', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Jane Smith"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Email</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="jane@clinic.com"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Password</label>
          <input
            required
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Role</label>
          <select
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={create.isPending}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {create.isPending ? 'Creating…' : 'Create User'}
        </button>
        <button type="button" onClick={onClose} className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
          Cancel
        </button>
      </div>
    </form>
  )
}

function UsersTab() {
  const { data, isLoading, isError, error } = useUsers()
  const [showForm, setShowForm] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Manage clinic users and their roles.</p>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add User
        </button>
      </div>

      {showForm && <AddUserForm onClose={() => setShowForm(false)} />}

      {isLoading && <p className="text-sm text-gray-400 py-4">Loading users…</p>}
      {isError && (
        <p className="text-sm text-red-600 py-4">
          {error instanceof Error ? error.message : 'Failed to load users'}
        </p>
      )}

      {!isLoading && !isError && data && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full bg-white border border-gray-200 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((user) => (
                <UserRow key={user.id} user={user} />
              ))}
            </tbody>
          </table>
          {data.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No users found.</p>}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Checklist Templates Tab
// ---------------------------------------------------------------------------

const PROCEDURE_TYPES = ['ivf', 'icsi', 'fet', 'iui', 'general']
const FIELD_TYPES = ['checkbox', 'text', 'number', 'select']

interface TemplateItem {
  order: number
  label: string
  required: boolean
  field_type: string
}

function AddTemplateForm({ onClose }: { onClose: () => void }) {
  const create = useCreateTemplate()
  const [name, setName] = useState('')
  const [procedureType, setProcedureType] = useState('general')
  const [items, setItems] = useState<TemplateItem[]>([
    { order: 1, label: '', required: true, field_type: 'checkbox' },
  ])
  const [err, setErr] = useState<string | null>(null)

  const addItem = () => {
    setItems((prev) => [...prev, { order: prev.length + 1, label: '', required: true, field_type: 'checkbox' }])
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, order: i + 1 })))
  }

  const updateItem = (index: number, field: keyof TemplateItem, value: string | number | boolean) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    try {
      await create.mutateAsync({ name, procedure_type: procedureType, items })
      onClose()
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to create template')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-blue-50 border border-blue-200 rounded-xl p-5 mt-4 space-y-4">
      <h3 className="font-semibold text-gray-900 text-sm">New Checklist Template</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Template Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Day 5 Assessment"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Procedure Type</label>
          <select
            value={procedureType}
            onChange={(e) => setProcedureType(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {PROCEDURE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Items</label>
          <button type="button" onClick={addItem} className="text-xs text-blue-600 hover:underline">
            + Add item
          </button>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
              <span className="text-xs text-gray-400 w-4">{item.order}</span>
              <input
                required
                value={item.label}
                onChange={(e) => updateItem(index, 'label', e.target.value)}
                className="flex-1 text-sm border-0 focus:outline-none"
                placeholder="Item label…"
              />
              <select
                value={item.field_type}
                onChange={(e) => updateItem(index, 'field_type', e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.required}
                  onChange={(e) => updateItem(index, 'required', e.target.checked)}
                  className="rounded"
                />
                req
              </label>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="text-gray-300 hover:text-red-400 text-sm leading-none"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={create.isPending}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {create.isPending ? 'Creating…' : 'Create Template'}
        </button>
        <button type="button" onClick={onClose} className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
          Cancel
        </button>
      </div>
    </form>
  )
}

function TemplateRow({ template }: { template: ChecklistTemplate }) {
  const update = useUpdateTemplate(template.id)

  const toggleActive = () => {
    update.mutate({ is_active: !template.is_active })
  }

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{template.name}</td>
      <td className="px-4 py-3 text-sm text-gray-600 uppercase text-xs">{template.procedure_type}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{template.items.length} items</td>
      <td className="px-4 py-3">
        <button onClick={toggleActive} disabled={update.isPending} className="disabled:opacity-60">
          <Badge active={template.is_active} />
        </button>
      </td>
    </tr>
  )
}

function ChecklistTemplatesTab() {
  const { data, isLoading, isError, error } = useChecklistTemplates()
  const [showForm, setShowForm] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Manage checklist templates for lab procedures.</p>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Template
        </button>
      </div>

      {showForm && <AddTemplateForm onClose={() => setShowForm(false)} />}

      {isLoading && <p className="text-sm text-gray-400 py-4">Loading templates…</p>}
      {isError && (
        <p className="text-sm text-red-600 py-4">
          {error instanceof Error ? error.message : 'Failed to load templates'}
        </p>
      )}

      {!isLoading && !isError && data && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full bg-white border border-gray-200 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Procedure</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((template) => (
                <TemplateRow key={template.id} template={template} />
              ))}
            </tbody>
          </table>
          {data.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No templates found.</p>}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Storage Tab
// ---------------------------------------------------------------------------

const STORAGE_TYPES = ['tank', 'canister', 'goblet', 'straw', 'box', 'shelf']

function flattenTree(locations: StorageLocation[]): StorageLocation[] {
  const result: StorageLocation[] = []
  const walk = (items: StorageLocation[]) => {
    for (const item of items) {
      result.push(item)
      if (item.children && item.children.length > 0) {
        walk(item.children)
      }
    }
  }
  walk(locations)
  return result
}

function StorageNode({ location, depth }: { location: StorageLocation; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = location.children && location.children.length > 0

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded-lg"
        style={{ paddingLeft: `${(depth + 1) * 16}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-gray-400 hover:text-gray-600 text-xs w-4 shrink-0"
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase">
          {location.type}
        </span>
        <span className="text-sm text-gray-800">{location.name}</span>
        {location.capacity != null && (
          <span className="text-xs text-gray-400 ml-auto">cap: {location.capacity}</span>
        )}
        {location.is_managed && (
          <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">managed</span>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {location.children!.map((child) => (
            <StorageNode key={child.id} location={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function AddLocationForm({
  locations,
  onClose,
}: {
  locations: StorageLocation[]
  onClose: () => void
}) {
  const create = useCreateStorage()
  const flat = flattenTree(locations)
  const [form, setForm] = useState({
    name: '',
    type: 'tank',
    parent_id: '',
    is_managed: false,
    capacity: '',
  })
  const [err, setErr] = useState<string | null>(null)

  const set = (field: string, value: string | boolean) => setForm((f) => ({ ...f, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    try {
      await create.mutateAsync({
        name: form.name,
        type: form.type,
        parent_id: form.parent_id || null,
        is_managed: form.is_managed,
        capacity: form.capacity ? parseInt(form.capacity, 10) : null,
      })
      onClose()
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to create location')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-blue-50 border border-blue-200 rounded-xl p-5 mt-4 space-y-3">
      <h3 className="font-semibold text-gray-900 text-sm">New Storage Location</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Tank A"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Type</label>
          <select
            value={form.type}
            onChange={(e) => set('type', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {STORAGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Parent Location</label>
          <select
            value={form.parent_id}
            onChange={(e) => set('parent_id', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">None (top-level)</option>
            {flat.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.type})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Capacity (optional)</label>
          <input
            type="number"
            min="0"
            value={form.capacity}
            onChange={(e) => set('capacity', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="e.g. 100"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={form.is_managed}
          onChange={(e) => set('is_managed', e.target.checked)}
          className="rounded"
        />
        Managed location
      </label>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={create.isPending}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {create.isPending ? 'Creating…' : 'Add Location'}
        </button>
        <button type="button" onClick={onClose} className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
          Cancel
        </button>
      </div>
    </form>
  )
}

function StorageTab() {
  const { data, isLoading, isError, error } = useStorage()
  const [showForm, setShowForm] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Manage storage locations for frozen samples.</p>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Location
        </button>
      </div>

      {showForm && data && <AddLocationForm locations={data} onClose={() => setShowForm(false)} />}

      {isLoading && <p className="text-sm text-gray-400 py-4">Loading storage…</p>}
      {isError && (
        <p className="text-sm text-red-600 py-4">
          {error instanceof Error ? error.message : 'Failed to load storage'}
        </p>
      )}

      {!isLoading && !isError && data && (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl overflow-hidden py-2">
          {data.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No storage locations configured.</p>
          ) : (
            data.map((location) => <StorageNode key={location.id} location={location} depth={0} />)
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

type TabId = 'users' | 'templates' | 'storage'

const TABS: { id: TabId; label: string; roles: string[] }[] = [
  { id: 'users', label: 'Users', roles: ['clinic_admin'] },
  { id: 'templates', label: 'Checklist Templates', roles: ['lab_manager', 'clinic_admin'] },
  { id: 'storage', label: 'Storage', roles: ['lab_manager', 'clinic_admin'] },
]

export default function Settings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('templates')

  if (!user || !['lab_manager', 'clinic_admin'].includes(user.role)) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-yellow-700">
          <p className="font-medium">Access restricted</p>
          <p className="text-sm mt-1">Settings are only available to lab managers and clinic admins.</p>
        </div>
      </div>
    )
  }

  const visibleTabs = TABS.filter((tab) => tab.roles.includes(user.role))

  // Ensure active tab is still visible for this role
  const resolvedTab = visibleTabs.find((t) => t.id === activeTab) ? activeTab : visibleTabs[0]?.id ?? 'templates'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure your lab platform</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              data-tour-tab={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                resolvedTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {resolvedTab === 'users' && <div data-tour="settings-users"><UsersTab /></div>}
      {resolvedTab === 'templates' && <div data-tour="settings-templates"><ChecklistTemplatesTab /></div>}
      {resolvedTab === 'storage' && <div data-tour="settings-storage"><StorageTab /></div>}
    </div>
  )
}
