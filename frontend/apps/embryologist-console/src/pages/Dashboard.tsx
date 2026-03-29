import { useAuth } from '../hooks/useAuth'

export default function Dashboard() {
  const { user, logout } = useAuth()

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Today</h1>
          <p className="text-gray-500">
            Welcome, {user?.full_name || user?.role || 'Embryologist'}
          </p>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Sign Out
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">
          Dashboard coming soon. Active cycles and embryos needing assessment will appear here.
        </p>
      </div>
    </div>
  )
}
