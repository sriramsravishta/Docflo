import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getConsultPrescription, searchInventory, dispenseBill, getUserRole } from '../../lib/pharmacy';
import { ConsultMedicineRow } from '../../types/db';
import { PharmacyInventoryRow, DispenseLineItem } from '../../types/pharmacy';
import { 
  ArrowLeft, 
  Search, 
  Check, 
  X, 
  AlertTriangle, 
  Package, 
  Printer, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2 
} from 'lucide-react';

interface ExtendedDispenseLineItem extends DispenseLineItem {
  searchQuery: string;
  searchResults: PharmacyInventoryRow[];
  isSearching: boolean;
}

interface ManualItem {
  id: string;
  searchQuery: string;
  isSearching: boolean;
  searchResults: PharmacyInventoryRow[];
  selectedInventory: PharmacyInventoryRow | null;
  quantityToDispense: number;
}

export default function DispenseScreen() {
  const { consultId } = useParams<{ consultId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [orgId, setOrgId] = useState<string | null>(null);
  const [patient, setPatient] = useState<{ name: string; age?: number; gender?: string } | null>(null);
  const [prescribedItems, setPrescribedItems] = useState<ExtendedDispenseLineItem[]>([]);
  const [manualItems, setManualItems] = useState<ManualItem[]>([]);
  
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      if (!user?.id || !consultId) return;
      try {
        setLoading(true);
        setError(null);
        
        const roleData = await getUserRole(user.id);
        if (!roleData?.org_id) throw new Error("Organization not found for user.");
        const currentOrgId = roleData.org_id;
        setOrgId(currentOrgId);

        const data = await getConsultPrescription(consultId);
        
        // Handle variations in getConsultPrescription return structure
        let medicines: ConsultMedicineRow[] = [];
        if (Array.isArray(data)) {
          medicines = data;
        } else if (data && typeof data === 'object') {
          if (data.medicines) medicines = data.medicines;
          if (data.patient) setPatient(data.patient);
        }

        // Build initial line items
        const initialItems: ExtendedDispenseLineItem[] = await Promise.all(
          medicines.map(async (med) => {
            let parsedQty = 1;
            if (med.quantity && !isNaN(Number(med.quantity))) {
              parsedQty = Number(med.quantity);
            } else if (typeof med.quantity === 'string') {
              const match = med.quantity.match(/\d+/);
              if (match) parsedQty = parseInt(match[0], 10);
            }

            const item: ExtendedDispenseLineItem = {
              prescribed: med,
              selectedInventory: null,
              quantityToDispense: parsedQty,
              status: 'pending',
              searchQuery: med.name || '',
              searchResults: [],
              isSearching: true,
            };

            try {
              if (med.med.name) {
                const results = await searchInventory(currentOrgId, med.name);
                item.isSearching = false;
                item.searchResults = results;

                // Auto-match if exact match or only one result with sufficient stock
                const exactMatch = results.find(
                  (r) => r.medicine_name.toLowerCase() === med.name.toLowerCase()
                );

                if (exactMatch && exactMatch.quantity_in_stock > 0) {
                  item.selectedInventory = exactMatch;
                  item.status = 'matched';
                  item.quantityToDispense = Math.min(parsedQty, exactMatch.quantity_in_stock);
                } else if (results.length > 0 && results[0].quantity_in_stock > 0) {
                  item.selectedInventory = results[0];
                  item.status = 'matched';
                  item.quantityToDispense = Math.min(parsedQty, results[0].quantity_in_stock);
                } else {
                  item.status = 'not_in_stock';
                }
              }
            } catch (err) {
              item.isSearching = false;
            }
            
            return item;
          })
        );

        setPrescribedItems(initialItems);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load prescription.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [user, consultId]);

  // --- Handlers for Prescribed Items ---

  const handleSearchInventory = async (index: number, query: string) => {
    const updated = [...prescribedItems];
    updated[index].searchQuery = query;
    updated[index].isSearching = true;
    setPrescribedItems(updated);

    if (!query || !orgId) {
      const reset = [...prescribedItems];
      reset[index].searchResults = [];
      reset[index].isSearching = false;
      setPrescribedItems(reset);
      return;
    }

    try {
      const results = await searchInventory(orgId, query);
      const newUpdated = [...prescribedItems];
      newUpdated[index].searchResults = results;
      newUpdated[index].isSearching = false;
      setPrescribedItems(newUpdated);
    } catch (err) {
      console.error(err);
      const errUpdated = [...prescribedItems];
      errUpdated[index].isSearching = false;
      setPrescribedItems(errUpdated);
    }
  };

  const handleSelectInventory = (index: number, inventoryItem: PharmacyInventoryRow) => {
    const updated = [...prescribedItems];
    updated[index].selectedInventory = inventoryItem;
    updated[index].status = 'matched';
    updated[index].searchQuery = inventoryItem.medicine_name;
    updated[index].searchResults = [];
    
    // cap quantity at available stock if necessary
    if (updated[index].quantityToDispense > inventoryItem.quantity_in_stock) {
      updated[index].quantityToDispense = inventoryItem.quantity_in_stock;
    }
    setPrescribedItems(updated);
  };

  const handleUpdateQuantity = (index: number, delta: number) => {
    const updated = [...prescribedItems];
    const item = updated[index];
    if (item.status === 'skipped') return;
    
    let newQty = item.quantityToDispense + delta;
    if (newQty < 1) newQty = 1;
    
    if (item.selectedInventory && newQty > item.selectedInventory.quantity_in_stock) {
      newQty = item.selectedInventory.quantity_in_stock;
    }
    
    updated[index].quantityToDispense = newQty;
    setPrescribedItems(updated);
  };

  const handleToggleSkip = (index: number) => {
    const updated = [...prescribedItems];
    if (updated[index].status === 'skipped') {
      updated[index].status = updated[index].selectedInventory ? 'matched' : 'pending';
    } else {
      updated[index].status = 'skipped';
    }
    setPrescribedItems(updated);
  };

  const handleRemovePrescribed = (index: number) => {
    const updated = [...prescribedItems];
    updated.splice(index, 1);
    setPrescribedItems(updated);
  };

  // --- Handlers for Manual Items ---

  const handleAddManualItem = () => {
    setManualItems([
      ...manualItems,
      {
        id: Math.random().toString(36).substring(7),
        searchQuery: '',
        isSearching: false,
        searchResults: [],
        selectedInventory: null,
        quantityToDispense: 1,
      }
    ]);
  };

  const handleSearchManualInventory = async (index: number, query: string) => {
    const updated = [...manualItems];
    updated[index].searchQuery = query;
    updated[index].isSearching = true;
    setManualItems(updated);

    if (!query || !orgId) {
      const reset = [...manualItems];
      reset[index].searchResults = [];
      reset[index].isSearching = false;
      setManualItems(reset);
      return;
    }

    try {
      const results = await searchInventory(orgId, query);
      const newUpdated = [...manualItems];
      newUpdated[index].searchResults = results;
      newUpdated[index].isSearching = false;
      setManualItems(newUpdated);
    } catch (err) {
      console.error(err);
      const errUpdated = [...manualItems];
      errUpdated[index].isSearching = false;
      setManualItems(errUpdated);
    }
  };

  const handleSelectManualInventory = (index: number, inventoryItem: PharmacyInventoryRow) => {
    const updated = [...manualItems];
    updated[index].selectedInventory = inventoryItem;
    updated[index].searchQuery = inventoryItem.medicine_name;
    updated[index].searchResults = [];
    if (updated[index].quantityToDispense > inventoryItem.quantity_in_stock) {
      updated[index].quantityToDispense = inventoryItem.quantity_in_stock;
    }
    setManualItems(updated);
  };

  const handleUpdateManualQuantity = (index: number, delta: number) => {
    const updated = [...manualItems];
    const item = updated[index];
    
    let newQty = item.quantityToDispense + delta;
    if (newQty < 1) newQty = 1;
    
    if (item.selectedInventory && newQty > item.selectedInventory.quantity_in_stock) {
      newQty = item.selectedInventory.quantity_in_stock;
    }
    
    updated[index].quantityToDispense = newQty;
    setManualItems(updated);
  };

  const handleRemoveManualItem = (index: number) => {
    const updated = [...manualItems];
    updated.splice(index, 1);
    setManualItems(updated);
  };

  // --- Bill Calculations ---

  const billSummary = useMemo(() => {
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let itemCount = 0;

    const allValidItems = [
      ...prescribedItems.filter(i => i.status === 'matched' && i.selectedInventory),
      ...manualItems.filter(i => i.selectedInventory)
    ];

    allValidItems.forEach(item => {
      if (!item.selectedInventory) return;
      const inv = item.selectedInventory;
      const qty = item.quantityToDispense;
      
      const itemTotal = (inv.sale_price || 0) * qty;
      subtotal += itemTotal;
      itemCount += qty;

      // Calculate GST (assuming sale_price is exclusive of GST for this calculation, 
      // or if inclusive, adjust formula. Standard practice in some EMRs: 
      // GST is applied on top or extracted. We'll extract or apply depending on standard.
      // We will assume sale_price is base price and GST is added on top, OR sale_price includes GST.
      // Let's assume sale_price is exclusive for explicit CGST/SGST addition).
      const cgstRate = inv.cgst_rate || 0;
      const sgstRate = inv.sgst_rate || 0;
      
      totalCgst += itemTotal * (cgstRate / 100);
      totalSgst += itemTotal * (sgstRate / 100);
    });

    let discountAmount = 0;
    if (discountType === 'flat') {
      discountAmount = discountValue || 0;
    } else {
      discountAmount = subtotal * ((discountValue || 0) / 100);
    }

    const grandTotal = subtotal - discountAmount + totalCgst + totalSgst;

    return {
      subtotal,
      totalCgst,
      totalSgst,
      discountAmount,
      grandTotal,
      itemCount,
      hasMatchedItems: allValidItems.length > 0
    };
  }, [prescribedItems, manualItems, discountType, discountValue]);


  // --- Submit ---

  const handleSubmit = async () => {
    if (!orgId || !consultId || !user) return;
    
    const validPrescribed = prescribedItems
      .filter(i => i.status === 'matched' && i.selectedInventory)
      .map(i => ({
        inventory_id: i.selectedInventory!.id,
        quantity: i.quantityToDispense,
        unit_price: i.selectedInventory!.sale_price || 0,
        prescribed_medicine_id: i.prescribed?.id
      }));

    const validManual = manualItems
      .filter(i => i.selectedInventory)
      .map(i => ({
        inventory_id: i.selectedInventory!.id,
        quantity: i.quantityToDispense,
        unit_price: i.selectedInventory!.sale_price || 0,
        prescribed_medicine_id: null
      }));

    const itemsToDispense = [...validPrescribed, ...validManual];

    if (itemsToDispense.length === 0) {
      setError("No items matched or selected to dispense.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      const payload = {
        org_id: orgId,
        consult_id: consultId,
        patient_name: patient?.name || 'Walk-in Patient',
        items: itemsToDispense,
        subtotal: billSummary.subtotal,
        discount: billSummary.discountAmount,
        cgst: billSummary.totalCgst,
        sgst: billSummary.totalSgst,
        total_amount: billSummary.grandTotal,
        payment_mode: paymentMode
      };

      const result = await dispenseBill(payload);
      if (result?.bill_id) {
        navigate(`/pharmacy/bills/${result.bill_id}`);
      } else {
        navigate(`/pharmacy/bills`);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate bill. Please check stock levels.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#024CDB] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Dispense Prescription</h1>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column - Items */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Patient Banner */}
          {patient && (
            <div className="rounded-lg bg-gray-50 p-4 border border-gray-200">
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#024CDB]/10">
                  <span className="text-lg font-bold text-[#024CDB]">
                    {patient.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{patient.name}</h2>
                  <p className="text-sm text-gray-500">
                    {patient.age ? `${patient.age} yrs` : ''} {patient.gender ? `• ${patient.gender}` : ''}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Prescribed Items */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Prescribed Medicines</h3>
            
            {prescribedItems.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No medicines prescribed in this consult.</p>
            ) : (
              prescribedItems.map((item, index) => {
                const isMatched = item.status === 'matched';
                const isSkipped = item.status === 'skipped';
                
                let borderClass = 'border-gray-200';
                if (isMatched) borderClass = 'border-l-4 border-green-500 border-y-gray-200 border-r-gray-200';
                else if (item.status === 'not_in_stock' || item.status === 'pending') borderClass = 'border-l-4 border-yellow-500 border-y-gray-200 border-r-gray-200';
                
                return (
                  <div 
                    key={index} 
                    className={`rounded-xl border bg-white p-4 transition-opacity ${isSkipped ? 'opacity-50' : ''} ${borderClass}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={isSkipped ? 'line-through' : ''}>
                        <h4 className="font-semibold text-gray-900">{item.prescribed?.medicine_name}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {item.prescribed?.dosage} • {item.prescribed?.frequency} • {item.prescribed?.duration}
                        </p>
                        {item.prescribed?.instructions && (
                          <p className="text-xs text-gray-500 mt-1">Note: {item.prescribed.instructions}</p>
                        )}
                        <p className="text-sm font-medium text-gray-700 mt-2">
                          Prescribed Qty: {item.prescribed?.quantity || 'N/A'}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleToggleSkip(index)}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          {isSkipped ? 'Undo Skip' : 'Skip'}
                        </button>
                        <button
                          onClick={() => handleRemovePrescribed(index)}
                          className="text-sm text-red-500 hover:text-red-700"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {!isSkipped && (
                      <div className="mt-4 border-t pt-4">
                        {isMatched && item.selectedInventory ? (
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center text-green-600 mb-1">
                                <Check className="h-4 w-4 mr-1" />
                                <span className="text-sm font-medium">Matched in Inventory</span>
                              </div>
                              <p className="text-sm text-gray-600">
                                Batch: {item.selectedInventory.batch_number} | Exp: {new Date(item.selectedInventory.expiry_date).toLocaleDateString()}
                              </p>
                              <p className="text-sm font-medium text-gray-900 mt-1">
                                ₹{item.selectedInventory.sale_price} / unit
                                <span className="text-gray-500 text-xs ml-2">({item.selectedInventory.quantity_in_stock} in stock)</span>
                              </p>
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              <span className="text-sm text-gray-600">Dispense:</span>
                              <div className="flex items-center border rounded-md">
                                <button 
                                  onClick={() => handleUpdateQuantity(index, -1)}
                                  className="p-1 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                  disabled={item.quantityToDispense <= 1}
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="w-10 text-center text-sm font-medium">
                                  {item.quantityToDispense}
                                </span>
                                <button 
                                  onClick={() => handleUpdateQuantity(index, 1)}
                                  className="p-1 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                  disabled={item.quantityToDispense >= item.selectedInventory.quantity_in_stock}
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-yellow-600 font-medium flex items-center">
                                <AlertTriangle className="h-4 w-4 mr-1" />
                                Not auto-matched or out of stock
                              </span>
                            </div>
                            <div className="relative">
                              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <Search className="h-4 w-4 text-gray-400" />
                              </div>
                              <input
                                type="text"
                                className="block w-full rounded-md border-gray-300 pl-10 focus:border-[#024CDB] focus:ring-[#024CDB] sm:text-sm"
                                placeholder="Search inventory to match manually..."
                                value={item.searchQuery}
                                onChange={(e) => handleSearchInventory(index, e.target.value)}
                              />
                            </div>
                            
                            {item.searchResults.length > 0 && (
                              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5">
                                {item.searchResults.map((res) => (
                                  <button
                                    key={res.id}
                                    className="flex w-full flex-col px-4 py-2 text-left hover:bg-gray-50"
                                    onClick={() => handleSelectInventory(index, res)}
                                  >
                                    <span className="font-medium text-gray-900">{res.medicine_name}</span>
                                    <span className="text-sm text-gray-500">
                                      Batch: {res.batch_number} | Stock: {res.quantity_in_stock} | ₹{res.sale_price}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Manual Items */}
          <div className="space-y-4 pt-6 border-t">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Additional Items</h3>
              <button
                onClick={handleAddManualItem}
                className="flex items-center text-sm font-medium text-[#024CDB] hover:text-blue-800"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </button>
            </div>

            {manualItems.map((item, index) => (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-full relative max-w-md">
                    {!item.selectedInventory ? (
                      <>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            className="block w-full rounded-md border-gray-300 pl-10 focus:border-[#024CDB] focus:ring-[#024CDB] sm:text-sm"
                            placeholder="Search inventory..."
                            value={item.searchQuery}
                            onChange={(e) => handleSearchManualInventory(index, e.target.value)}
                          />
                        </div>
                        {item.searchResults.length > 0 && (
                          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5">
                            {item.searchResults.map((res) => (
                              <button
                                key={res.id}
                                className="flex w-full flex-col px-4 py-2 text-left hover:bg-gray-50"
                                onClick={() => handleSelectManualInventory(index, res)}
                              >
                                <span className="font-medium text-gray-900">{res.medicine_name}</span>
                                <span className="text-sm text-gray-500">
                                  Batch: {res.batch_number} | Stock: {res.quantity_in_stock} | ₹{res.sale_price}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div>
                        <h4 className="font-semibold text-gray-900">{item.selectedInventory.medicine_name}</h4>
                        <p className="text-sm text-gray-600">
                          Batch: {item.selectedInventory.batch_number} | Exp: {new Date(item.selectedInventory.expiry_date).toLocaleDateString()}
                        </p>
                        <p className="text-sm font-medium text-gray-900 mt-1">
                          ₹{item.selectedInventory.sale_price} / unit
                          <span className="text-gray-500 text-xs ml-2">({item.selectedInventory.quantity_in_stock} in stock)</span>
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleRemoveManualItem(index)}
                    className="text-gray-400 hover:text-red-500 ml-4"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>

                {item.selectedInventory && (
                  <div className="flex items-center space-x-3 mt-4 border-t pt-4">
                    <span className="text-sm text-gray-600">Qty:</span>
                    <div className="flex items-center border rounded-md">
                      <button 
                        onClick={() => handleUpdateManualQuantity(index, -1)}
                        className="p-1 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        disabled={item.quantityToDispense <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-10 text-center text-sm font-medium">
                        {item.quantityToDispense}
                      </span>
                      <button 
                        onClick={() => handleUpdateManualQuantity(index, 1)}
                        className="p-1 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        disabled={item.quantityToDispense >= item.selectedInventory.quantity_in_stock}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>

        {/* Right Column - Bill Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-4 bg-gray-50 rounded-t-xl">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <ShoppingCart className="h-5 w-5 mr-2 text-gray-500" />
                Bill Summary
              </h2>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Items</span>
                <span className="font-medium text-gray-900">{billSummary.itemCount}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">₹{billSummary.subtotal.toFixed(2)}</span>
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-100">
                <label className="text-sm text-gray-600 block">Discount</label>
                <div className="flex space-x-2">
                  <div className="flex bg-gray-100 rounded-md p-1">
                    <button
                      className={`px-3 py-1 text-xs rounded-md ${discountType === 'flat' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}
                      onClick={() => setDiscountType('flat')}
                    >
                      ₹
                    </button>
                    <button
                      className={`px-3 py-1 text-xs rounded-md ${discountType === 'percentage' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}
                      onClick={() => setDiscountType('percentage')}
                    >
                      %
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    className="block w-full rounded-md border-gray-300 focus:border-[#024CDB] focus:ring-[#024CDB] sm:text-sm"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                  />
                </div>
                {billSummary.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount Applied</span>
                    <span>-₹{billSummary.discountAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1 pt-2 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">CGST</span>
                  <span className="font-medium text-gray-900">₹{billSummary.totalCgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">SGST</span>
                  <span className="font-medium text-gray-900">₹{billSummary.totalSgst.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-gray-900">Grand Total</span>
                  <span className="text-2xl font-bold text-[#024CDB]">₹{billSummary.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-4">
                <label className="text-sm font-medium text-gray-700 block mb-2">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Cash', 'UPI', 'Card'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setPaymentMode(mode as any)}
                      className={`py-2 px-3 text-sm rounded-md border ${
                        paymentMode === mode 
                          ? 'bg-[#024CDB]/10 border-[#024CDB] text-[#024CDB] font-medium' 
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-xl">
              <button
                onClick={handleSubmit}
                disabled={!billSummary.hasMatchedItems || submitting}
                className="w-full flex justify-center items-center rounded-md bg-[#024CDB] px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-[#024CDB] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <Printer className="h-4 w-4 mr-2" />
                    Generate Bill
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
