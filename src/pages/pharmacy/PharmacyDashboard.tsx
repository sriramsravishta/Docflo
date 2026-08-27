import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getPharmacyQueue, getUserRole, getLowStockItems, getExpiringItems } from '../../lib/pharmacy';
import { PharmacyQueueItem, PharmacyInventoryRow } from '../../types/pharmacy';
import { Search, Package, AlertTriangle, Clock, Pill, ChevronRight, RefreshCw, ShoppingCart } from 'lucide-react';

export default function PharmacyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [orgId, setOrgId] = useState<string | null>(null);
  const [queue, setQueue] = useState<PharmacyQueueItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<PharmacyInventoryRow[]>([]);
  const [expiringItems, setExpiringItems] = useState<PharmacyInventoryRow[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPending, setFilterPending] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const roleData = await getUserRole(user.id);
      if (!roleData?.org_id) {
        throw new Error('Organization not found for user');
      }
      
      const userOrgId = roleData.org_id;
      setOrgId(userOrgId);
      
      const [queueData, lowStockData, expiringData] = await Promise.all([
        getPharmacyQueue(userOrgId),
        getLowStockItems(userOrgId),
        getExpiringItems(userOrgId, 90)
      ]);
      
      setQueue(queueData || []);
      setLowStockItems(lowStockData || []);
      setExpiringItems(expiringData || []);
      
    } catch (err: any) {
      console.error('Error fetching pharmacy data:', err);
      setError(err.message || 'Failed to load pharmacy dashboard');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredQueue = queue.filter(item => {
    const matchesSearch = item.patient_name.toLowerCase().includes(searchQuery.toLowerCase());
       const matchesFilter = true;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#024CDB]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start">
          <AlertTriangle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium">Error Loading Dashboard</h3>
            <p className="mt-1 text-sm">{error}</p>
            <button 
              onClick={fetchData}
              className="mt-3 text-sm font-medium text-red-700 hover:text-red-800 underline"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Today's Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={fetchData}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#024CDB] focus:border-transparent outline-none"
            />
          </div>
        </div>
      </div>

      {/* Alert Banners */}
      <div className="flex flex-col gap-3 mb-6">
        {lowStockItems.length > 0 && (
          <div 
            onClick={() => navigate('/inventory')}
            className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-center justify-between cursor-pointer hover:bg-yellow-100 transition-colors"
          >
            <div className="flex items-center text-yellow-800">
              <Package className="h-5 w-5 mr-3" />
              <span className="font-medium">{lowStockItems.length} items low on stock</span>
            </div>
            <ChevronRight className="h-5 w-5 text-yellow-600" />
          </div>
        )}
        
        {expiringItems.length > 0 && (
          <div 
            onClick={() => navigate('/inventory')}
            className="bg-orange-50 border border-orange-200 p-3 rounded-lg flex items-center justify-between cursor-pointer hover:bg-orange-100 transition-colors"
          >
            <div className="flex items-center text-orange-800">
              <Clock className="h-5 w-5 mr-3" />
              <span className="font-medium">{expiringItems.length} items expiring within 90 days</span>
            </div>
            <ChevronRight className="h-5 w-5 text-orange-600" />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-2">
        <button
          onClick={() => setFilterPending(true)}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative ${
            filterPending 
              ? 'text-[#024CDB] bg-blue-50/50' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          Pending
          {filterPending && (
            <div className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-[#024CDB]"></div>
          )}
        </button>
        <button
          onClick={() => setFilterPending(false)}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative ${
            !filterPending 
              ? 'text-[#024CDB] bg-blue-50/50' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          All Consults
          {!filterPending && (
            <div className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-[#024CDB]"></div>
          )}
        </button>
      </div>

      {/* Queue Grid */}
      {filteredQueue.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center flex flex-col items-center">
          <div className="bg-gray-50 h-16 w-16 rounded-full flex items-center justify-center mb-4">
            <ShoppingCart className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {filterPending ? 'No pending consults' : 'No consults found'}
          </h3>
          <p className="text-gray-500 max-w-sm">
            {searchQuery 
              ? `No patients found matching "${searchQuery}"` 
              : 'All caught up! There are no prescriptions waiting to be dispensed right now.'}
          </p>
          {(searchQuery || !filterPending) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterPending(true);
              }}
              className="mt-4 text-[#024CDB] font-medium hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filteredQueue.map(item => (
            <div
              key={item.consult_id}
              onClick={() => navigate(`/dispense/${item.item.consult_id}`)}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer flex flex-col relative overflow-hidden group"
            >
              {/* Status indicator line */}
              <div className={`absolute top-0 left-0 w-1 h-full ${
                                'bg-[#024CDB]'
              }`}></div>
              
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg group-hover:text-[#024CDB] transition-colors line-clamp-1">
                    {item.patient_name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {item.patient_age} yrs • {item.patient_gender}
                  </p>
                </div>
                <div className="bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-sm font-medium flex items-center shrink-0">
                  <Pill className="h-3 w-3 mr-1" />
                  {item.medicine_count} meds
                </div>
              </div>
              
              <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
                <div className="flex items-center text-gray-500">
                  <Clock className="h-4 w-4 mr-1.5" />
                  <span>
                    {new Date(item.consult_created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                <span className={`font-medium ${
                                   'text-amber-600'
                }`}>
                  {item.status === 'pending' ? 'Pending' : 'Billed'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
