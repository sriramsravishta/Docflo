import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getBills, getBillDetails, cancelBill, getUserRole, getPharmacyConfig } from '../../lib/pharmacy';
import { PharmacyBillRow, PharmacyBillItemRow, PharmacyConfig } from '../../types/pharmacy';
import { Search, Printer, Eye, XCircle, Calendar, IndianRupee, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getTodayDateString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export default function BillsPage() {
  const { user } = useAuth();
  
  const [orgId, setOrgId] = useState<string | null>(null);
  const [config, setConfig] = useState<PharmacyConfig | null>(null);
  
  const [fromDate, setFromDate] = useState<string>(getTodayDateString());
  const [toDate, setToDate] = useState<string>(getTodayDateString());
  const [searchQuery, setSearchQuery] = useState('');
  
  const [bills, setBills] = useState<PharmacyBillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedBill, setSelectedBill] = useState<PharmacyBillRow | null>(null);
  const [billItems, setBillItems] = useState<PharmacyBillItemRow[]>([]);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [billToCancel, setBillToCancel] = useState<PharmacyBillRow | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchInitialData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const roleData = await getUserRole(user.id);
      if (!roleData || !roleData.organization_id) {
        throw new Error('Organization not found for user.');
      }
      const currentOrgId = roleData.organization_id;
      setOrgId(currentOrgId);
      
      const configData = await getPharmacyConfig(currentOrgId);
      setConfig(configData);
      
      await fetchBillsData(currentOrgId, fromDate, toDate);
    } catch (err: any) {
      setError(err.message || 'Failed to load initial data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchBillsData = async (organizationId: string, from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBills(organizationId, from, to);
      setBills(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch bills');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleApplyDateRange = () => {
    if (orgId) {
      fetchBillsData(orgId, fromDate, toDate);
    }
  };

  const handleViewBill = async (bill: PharmacyBillRow) => {
    setSelectedBill(bill);
    setIsViewModalOpen(true);
    setLoadingDetails(true);
    try {
      const items = await getBillDetails(bill.id);
      setBillItems(items || []);
    } catch (err) {
      console.error('Failed to fetch bill details', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handlePrint = (bill: PharmacyBillRow) => {
    // If not already in view mode, fetch details first, but for simplicity we assume it's best viewed first
    // Or we can just trigger print from modal
    handleViewBill(bill).then(() => {
      setTimeout(() => {
        window.print();
      }, 500);
    });
  };

  const initiateCancel = (bill: PharmacyBillRow) => {
    setBillToCancel(bill);
    setIsCancelModalOpen(true);
  };

  const confirmCancel = async () => {
    if (!billToCancel || !orgId) return;
    setCancelling(true);
    try {
      await cancelBill(billToCancel.id);
      await fetchBillsData(orgId, fromDate, toDate);
      setIsCancelModalOpen(false);
      setBillToCancel(null);
    } catch (err: any) {
      console.error(err);
      alert('Failed to cancel bill: ' + err.message);
    } finally {
      setCancelling(false);
    }
  };

  const filteredBills = bills.filter(bill => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    const matchName = bill.patient_name?.toLowerCase().includes(lowerQuery);
    const matchNumber = bill.bill_number.toLowerCase().includes(lowerQuery);
    return matchName || matchNumber;
  });

  const totalCompletedBills = filteredBills.filter(b => b.status === 'completed').length;
  const totalRevenue = filteredBills.filter(b => b.status === 'completed').reduce((sum, b) => sum + b.total_amount, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; }
            .print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; }
            /* Hide the modal overlay and close buttons in print mode */
            .no-print { display: none !important; }
          }
        `}
      </style>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacy Bills</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and manage billing history
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border-gray-300 rounded-md shadow-sm focus:ring-[#024CDB] focus:border-[#024CDB] sm:text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border-gray-300 rounded-md shadow-sm focus:ring-[#024CDB] focus:border-[#024CDB] sm:text-sm"
            />
            <button
              onClick={handleApplyDateRange}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="relative max-w-sm w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by patient name or bill number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-[#024CDB] focus:border-[#024CDB] sm:text-sm transition duration-150 ease-in-out"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#024CDB] mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading bills...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">
            <p>{error}</p>
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No bills found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search or date range.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bill #
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {bill.bill_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {bill.patient_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {formatCurrency(bill.total_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {bill.payment_method}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(bill.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        bill.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {bill.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleViewBill(bill)}
                          className="text-gray-400 hover:text-[#024CDB] transition-colors"
                          title="View Bill"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handlePrint(bill)}
                          className="text-gray-400 hover:text-gray-900 transition-colors"
                          title="Print Bill"
                        >
                          <Printer className="h-5 w-5" />
                        </button>
                        {bill.status === 'completed' && (
                          <button
                            onClick={() => initiateCancel(bill)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Cancel Bill"
                          >
                            <XCircle className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Footer Summary */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 sm:flex sm:items-center sm:justify-between">
          <div className="text-sm text-gray-700">
            Total Bills: <span className="font-semibold">{totalCompletedBills}</span> (Completed)
          </div>
          <div className="mt-4 sm:mt-0 text-sm font-medium text-gray-900 flex items-center">
            Total Revenue: <span className="ml-2 text-lg text-[#024CDB]">{formatCurrency(totalRevenue)}</span>
          </div>
        </div>
      </div>

      {/* View Bill Modal */}
      {isViewModalOpen && selectedBill && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity no-print" aria-hidden="true" onClick={() => setIsViewModalOpen(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full sm:p-6">
              
              {/* Modal Actions (No Print) */}
              <div className="absolute top-0 right-0 pt-4 pr-4 no-print flex space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                  title="Print"
                >
                  <Printer className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                  onClick={() => setIsViewModalOpen(false)}
                >
                  <span className="sr-only">Close</span>
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              {/* Print Area content */}
              <div className="print-area sm:flex sm:items-start w-full font-mono text-sm text-gray-900 bg-white">
                <div className="w-full">
                  
                  {/* Print Header */}
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold">{config?.shop_name || 'Pharmacy Store'}</h2>
                    <p className="whitespace-pre-line">{config?.address || 'Store Address'}</p>
                    <p>GSTIN: {config?.gst_number || 'N/A'} | DL: {config?.dl_number || 'N/A'}</p>
                    <p>Phone: {config?.phone || 'N/A'}</p>
                    <div className="border-b-2 border-dashed border-gray-300 my-4"></div>
                  </div>

                  <div className="flex justify-between mb-2">
                    <div>
                      <p><strong>BILL NO:</strong> {selectedBill.bill_number}</p>
                      <p><strong>Patient:</strong> {selectedBill.patient_name || 'Cash'}</p>
                    </div>
                    <div className="text-right">
                      <p><strong>DATE:</strong> {new Date(selectedBill.created_at).toLocaleDateString('en-IN')}</p>
                      {selectedBill.doctor_name && <p><strong>Dr:</strong> {selectedBill.doctor_name}</p>}
                    </div>
                  </div>
                  
                  <div className="border-b-2 border-dashed border-gray-300 my-4"></div>

                  {/* Items Table */}
                  <div className="w-full mb-6">
                    {loadingDetails ? (
                      <p className="text-center py-4 no-print">Loading items...</p>
                    ) : (
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="py-2">#</th>
                            <th className="py-2">Medicine</th>
                            <th className="py-2">Batch</th>
                            <th className="py-2 text-right">Qty</th>
                            <th className="py-2 text-right">Rate</th>
                            <th className="py-2 text-right">Amt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {billItems.map((item, index) => (
                            <tr key={item.id} className="border-b border-gray-100 last:border-0">
                              <td className="py-2 align-top">{index + 1}</td>
                              <td className="py-2 align-top">{item.medicine_name}</td>
                              <td className="py-2 align-top text-gray-500">{item.batch_number}</td>
                              <td className="py-2 align-top text-right">{item.quantity}</td>
                              <td className="py-2 align-top text-right">{item.unit_price.toFixed(2)}</td>
                              <td className="py-2 align-top text-right">{item.total_price.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="border-b-2 border-dashed border-gray-300 my-4"></div>

                  {/* Totals */}
                  <div className="flex justify-end">
                    <div className="w-64">
                      <div className="flex justify-between py-1">
                        <span>Subtotal:</span>
                        <span>{selectedBill.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>CGST:</span>
                        <span>{selectedBill.total_cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>SGST:</span>
                        <span>{selectedBill.total_sgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>Discount:</span>
                        <span>{selectedBill.discount_amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-2 mt-2 border-t border-gray-200 font-bold text-lg">
                        <span>TOTAL:</span>
                        <span>{selectedBill.total_amount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-b-2 border-dashed border-gray-300 my-4"></div>

                  <div className="text-center text-sm mt-4">
                    <p>Payment: <span className="capitalize">{selectedBill.payment_method}</span></p>
                    <p className="mt-2">Thank you! Visit again.</p>
                  </div>

                </div>
              </div>
              
              {/* Extra Modal UI for viewing online (No Print) */}
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse no-print">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[#024CDB] text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => window.print()}
                >
                  Print Bill
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={() => setIsViewModalOpen(false)}
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {isCancelModalOpen && billToCancel && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => !cancelling && setIsCancelModalOpen(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <XCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                    Cancel Bill
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to cancel bill <strong>{billToCancel.bill_number}</strong>? 
                      This will restore inventory quantities. Continue?
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  onClick={confirmCancel}
                  disabled={cancelling}
                >
                  {cancelling ? 'Cancelling...' : 'Yes, Cancel Bill'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#024CDB] sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={() => setIsCancelModalOpen(false)}
                  disabled={cancelling}
                >
                  No, Keep It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
