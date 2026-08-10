import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { User, LogOut, ArrowLeft, Heart, Settings } from 'lucide-react';

interface NavbarProps {
  showBack?: boolean;
  onManageLocations?: () => void;
}

export default function Navbar({ showBack = false, onManageLocations }: NavbarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-4 xl:px-[160px] py-3 sticky top-0 z-40">

      <div className="w-full flex items-center justify-between">

        <div className="flex items-center space-x-4">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <h1 className="text-xl font-semibold text-[#024CDB]">Docflo</h1>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <User className="w-6 h-6 text-gray-600" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm text-gray-600 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setShowMenu(false); navigate('/favorites'); }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-2 text-gray-700"
                >
                  <Heart className="w-4 h-4" />
                  <span>Favourites</span>
                </button>
                
                {/* New Manage Locations Button */}
                {onManageLocations && (
                  <button
                    onClick={() => { setShowMenu(false); onManageLocations(); }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-2 text-gray-700"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Manage Locations</span>
                  </button>
                )}

                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-2 text-gray-700"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
