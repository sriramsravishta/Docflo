import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getInventory, 
  createInventoryItem, 
  updateInventoryItem, 
  deleteInventoryItem, 
  getUserRole 
} from '../../lib/pharmacy';
import { searchMedicines } from '../../lib/database';
import { PharmacyInventoryRow } from '../../types/pharmacy';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  Package, 
  X, 
  Save, 
  ChevronDown 
} from 'lucide-react';

type SortField = 'medicine_name' | 'quantity_in_stock' | 'expiry_date' | 'mrp';
type SortOrder = 'asc' | 'desc';

interface FormData {
  medicine_name: string;
  generic_name: string;
  manufacturer: string;
  batch_no: string;
  expiry_date: string;
  quantity_in_stock: number;
  mrp: number;
  sale_price: number;
  purchase_price: number;
    gst_percent: number;
  hsn_code: string;
  unit: string;
  pack_size: string;
  reorder_level: number;
  rack_location: string;
}

const initialFormData: FormData = {
  medicine_name: '',
  generic_name: '',
  manufacturer: '',
  batch_no: '',
  expiry_date: '',
  quantity_in_stock: 0,
  mrp: 0,
  sale_price: 0,
  purchase_price: 0,
    gst_percent: 12,
  hsn_code: '',
  unit: 'Tab',
  pack_size: '',
  reorder_level: 10,
  rack_location: ''
};

export default function InventoryPage() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<PharmacyInventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [sortField, setSortField] = useState<SortField>('medicine_name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [medicineSearchResults, setMedicineSearchResults] = useState<{ id: string, name: string }[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const role = await getUserRole(user.id);
      if (!role) {
        throw new Error('User role not found');
      }
      setOrgId(role.org_id);
const data = await getInventory(role.org_id, { search: searchTerm });
      setInventory(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [user, searchTerm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedInventory = [...inventory].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    
    if (valA === null || valA === undefined) valA = '';
    if (valB === null || valB === undefined) valB = '';

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSearchMedicine = async (query: string) => {
    if (!query) {
      setMedicineSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    try {
      const results = await searchMedicines(query);
      setMedicineSearchResults(results || []);
      setShowSearchResults(true);
    } catch (err) {
      console.error('Failed to search medicines', err);
    }
  };

  const onMedicineNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData({ ...formData, medicine_name: val });
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      handleSearchMedicine(val);
    }, 300);
  };

  const handleSelectMedicine = (name: string) => {
    setFormData({ ...formData, medicine_name: name });
    setShowSearchResults(false);
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData(initialFormData);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: PharmacyInventoryRow) => {
    setEditingId(item.id);
    setFormData({
      medicine_name: item.medicine_name,
      generic_name: item.generic_name || '',
      manufacturer: item.manufacturer || '',
      batch_no: item.batch_no,
      expiry_date: item.expiry_date || '',
      quantity_in_stock: item.quantity_in_stock,
      mrp: item.mrp || 0,
      sale_price: item.sale_price || 0,
      purchase_price: item.purchase_price || 0,
      gst_percentage: item.gst_percentage || 12,
      hsn_code: item.hsn_code || '',
      unit: item.unit || 'Tab',
      pack_size: item.pack_size || '',
      reorder_level: item.reorder_level || 10,
      rack_location: item.rack_location || ''
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteInventoryItem(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete item');
    }
  };

  const saveItem = async () => {
    if (!orgId) return;
    
    if (!formData.medicine_name || !formData.batch_no) {
      setFormError('Medicine Name and Batch No are required');
      return;
    }
    if (formData.quantity_in_stock < 0 || formData.mrp < 0 || formData.sale_price < 0) {
      setFormError('Quantity, MRP, and Sale Price must be non-negative');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...formData,
        organization_id: orgId
      };
      
      if (editingId) {
        await updateInventoryItem(editingId, payload);
      } else {
        await createInventoryItem(payload);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save item');
    } finally {
      setIsSaving(false);
    }
  };

  const getRowClass = (item: PharmacyInventoryRow) => {
    const isExpired = item.expiry_date && new Date(item.expiry_date) < new Date();
    const isExpiringSoon = item.expiry_date && (new Date(item.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24) <= 90;
    const isLowStock = item.reorder_level && item.quantity_in_stock <= item.reorder_level;

    let classes = 'border-b hover:bg-gray-50 ';
    if (isExpired) {
      classes += 'bg-red-50 ';
    } else if (isLowStock) {
      classes += 'border-l-4 border-l-red-500 ';
    } else if (isExpiringSoon) {
      classes += 'border-l-4 border-l-orange-500 ';
    }
    return classes;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Package className="w-6 h-6 mr-2 text-[#024CDB]" />
            Inventory Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Total Items: {inventory.length}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center px-4 py-2 bg-[#024CDB] text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </button>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search inventory by medicine name or batch..."
          className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-[#024CDB] outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-10">Loading inventory...</div>
      ) : error ? (
        <div className="text-red-500 text-center py-10 flex flex-col items-center">
          <AlertTriangle className="w-10 h-10 mb-2 text-red-500" />
          {error}
        </div>
      ) : inventory.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-xl shadow-sm border text-gray-500">
          No inventory items found. Add some stock!
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th 
                  className="p-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('medicine_name')}
                >
                  Medicine Name {sortField === 'medicine_name' && <ChevronDown className="w-4 h-4 inline" />}
                </th>
                <th className="hidden md:table-cell p-4 font-medium text-gray-600">Generic</th>
                <th className="hidden md:table-cell p-4 font-medium text-gray-600">Batch</th>
                <th 
                  className="hidden md:table-cell p-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('expiry_date')}
                >
                  Expiry {sortField === 'expiry_date' && <ChevronDown className="w-4 h-4 inline" />}
                </th>
                <th 
                  className="p-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('quantity_in_stock')}
                >
                  Stock {sortField === 'quantity_in_stock' && <ChevronDown className="w-4 h-4 inline" />}
                </th>
                <th 
                  className="p-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('mrp')}
                >
                  MRP {sortField === 'mrp' && <ChevronDown className="w-4 h-4 inline" />}
                </th>
                <th className="hidden md:table-cell p-4 font-medium text-gray-600">Sale Price</th>
                <th className="hidden lg:table-cell p-4 font-medium text-gray-600">Unit</th>
                <th className="p-4 font-medium text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedInventory.map((item) => (
                <tr key={item.id} className={getRowClass(item)}>
                  <td className="p-4">
                    <div className="font-medium text-gray-900">{item.medicine_name}</div>
                    <div className="text-xs text-gray-500 md:hidden">{item.batch_no} | Exp: {item.expiry_date}</div>
                  </td>
                  <td className="hidden md:table-cell p-4 text-sm text-gray-600">{item.generic_name || '-'}</td>
                  <td className="hidden md:table-cell p-4 text-sm text-gray-600">{item.batch_no}</td>
                  <td className="hidden md:table-cell p-4 text-sm text-gray-600">{item.expiry_date || '-'}</td>
                  <td className="p-4">
                    <span className={`font-medium ${item.reorder_level && item.quantity_in_stock <= item.reorder_level ? 'text-red-600' : 'text-gray-900'}`}>
                      {item.quantity_in_stock}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-900">₹{item.mrp}</td>
                  <td className="hidden md:table-cell p-4 text-sm text-gray-900">₹{item.sale_price}</td>
                  <td className="hidden lg:table-cell p-4 text-sm text-gray-600">{item.unit || '-'}</td>
                  <td className="p-4 text-right space-x-2">
                    <button 
                      onClick={() => openEditModal(item)}
                      className="p-2 text-gray-500 hover:text-[#024CDB] hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold">{editingId ? 'Edit Item' : 'Add New Item'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {formError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {formError}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medicine Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.medicine_name}
                    onChange={onMedicineNameChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#024CDB] outline-none"
                    placeholder="Enter medicine name..."
                  />
                  {showSearchResults && medicineSearchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {medicineSearchResults.map((res, idx) => (
                        <div 
                          key={idx}
                          className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                          onClick={() => handleSelectMedicine(res.name)}
                        >
                          {res.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Generic Name</label>
                  <input
                    type="text"
                    value={formData.generic_name}
                    onChange={(e) => setFormData({...formData, generic_name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#024CDB] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#024CDB] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch No *</label>
                  <input
                    type="text"
                    required
                    value={formData.batch_no}
                    onChange={(e) => setFormData({...formData, batch_no: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#024CDB] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#024CDB] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity in Stock *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.quantity_in_stock}
                    onChange={(e) => setFormData({...formData, quantity_in_stock: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#024CDB] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.reorder_level}
                    onChange={(e) => setFormData({...formData, reorder_level: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#024CDB] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">MRP *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.mrp}
                    onChange={(e) => setFormData({...formData, mrp: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#024CDB] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.sale_price}
                    onChange={(e) => setFormData({...formData, sale_price: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#024CDB] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({...formData, purchase_price: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#024CDB] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GST %</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.gst_percentage}
                    onChange={(e) => setFormData({...formData, gst_percentage: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#024CDB] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#024CDB] outline-none bg-white"
                  >
                    <option value="Tab">Tab</option>
                    <option value="Cap">Cap</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Inj">Inj</option>
                    <option value="Cream">Cream</option>
                    <option value="Drops">Drops</option>
                    <option value="Sachet">Sachet</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pack Size (e.g. 10s)</label>
                  <input
                    type="text"
                    value={formData.pack_size}
                    onChange={(e) => setFormData({...formData, pack_size: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#024CDB] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={formData.hsn_code}
                    onChange={(e) => setFormData({...formData, hsn_code: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#024CDB] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rack Location</label>
                  <input
                    type="text"
                    value={formData.rack_location}
                    onChange={(e) => setFormData({...formData, rack_location: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#024CDB] outline-none"
                  />
                </div>

              </div>
            </div>
            
            <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100 transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={saveItem}
                disabled={isSaving}
                className="flex items-center px-4 py-2 bg-[#024CDB] text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
