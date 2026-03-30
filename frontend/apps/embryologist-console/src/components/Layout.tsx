import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import DemoGuide from '../guide/DemoGuide'

export default function Layout() {
  const { user } = useAuth()

  const isManager = user?.role === 'lab_manager' || user?.role === 'clinic_admin'

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 p-4 flex flex-col">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-blue-600">IVF Lab</h2>
          <p className="text-xs text-gray-400">{user?.role}</p>
        </div>
        <nav data-tour="sidebar-nav" className="space-y-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `block px-3 py-2 rounded-md text-sm ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`
            }
          >
            Today
          </NavLink>
          <NavLink
            to="/week"
            className={({ isActive }) =>
              `block px-3 py-2 rounded-md text-sm ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`
            }
          >
            This Week
          </NavLink>
          <NavLink
            to="/export"
            className={({ isActive }) =>
              `block px-3 py-2 rounded-md text-sm ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`
            }
          >
            Export
          </NavLink>
          {isManager && (
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`
              }
            >
              Settings
            </NavLink>
          )}
        </nav>
        <button
          data-tour="replay-guide"
          onClick={() => {
            localStorage.removeItem('ivf_guide_dismissed')
            window.dispatchEvent(new Event('ivf-guide-restart'))
          }}
          className="mt-auto pt-4 text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1.5"
          title="Replay demo guide"
        >
          <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">?</span>
          Guide
        </button>
      </aside>
      <main className="flex-1">
        <Outlet />
        <DemoGuide />
      </main>
    </div>
  )
}
