import React, { forwardRef } from 'react';

// Using types defined based on the requirements
export interface PharmacyBillRow {
  id: string;
  bill_number: string;
  created_at: string;
  subtotal: number;
  cgst: number;
  sgst: number;
  discount: number;
  total: number;
  payment_mode: string;
}

export interface PharmacyBillItemRow {
  id: string;
  medicine_name: string;
    batch_no: string;
  expiry_date: string;
  quantity: number;
  mrp: number;
  amount: number;
}

export interface PharmacyConfig {
  shop_name: string;
  address: string;
  phone: string;
  gstin?: string;
  dl_number_1?: string;
  dl_number_2?: string;
}

export interface BillPrintViewProps {
  bill: PharmacyBillRow;
  items: PharmacyBillItemRow[];
  patientName: string;
  patientAge: number;
  patientGender: string;
  config: PharmacyConfig;
}

const BillPrintView = forwardRef<HTMLDivElement, BillPrintViewProps>(
  ({ bill, items, patientName, patientAge, patientGender, config }, ref) => {
    // Format date for display
    const formatDate = (dateString: string) => {
      const d = new Date(dateString);
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    return (
      <div ref={ref} className="print-area bg-white text-black p-8 font-sans" style={{ maxWidth: '800px', margin: '0 auto', fontSize: '14px' }}>
        {/* Header section */}
        <div className="text-center mb-6 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-bold uppercase m-0">{config.shop_name}</h1>
          <p className="m-1">{config.address}</p>
          <p className="m-1">Phone: {config.phone}</p>
          
          <div className="flex justify-between mt-4 text-sm text-left">
            <div>
              {config.gstin && <p className="m-0"><strong>GSTIN:</strong> {config.gstin}</p>}
            </div>
            <div className="text-right">
              {config.dl_number_1 && <p className="m-0"><strong>D.L.No:</strong> {config.dl_number_1}</p>}
              {config.dl_number_2 && <p className="m-0"><strong>D.L.No 2:</strong> {config.dl_number_2}</p>}
            </div>
          </div>
        </div>

        {/* Bill Info & Patient Details */}
        <div className="flex justify-between mb-6 border-b-2 border-black pb-4">
          <div>
            <p className="m-1"><strong>Patient:</strong> {patientName}</p>
            <p className="m-1"><strong>Age/Sex:</strong> {patientAge} Y / {patientGender}</p>
          </div>
          <div className="text-right">
            <p className="m-1"><strong>Bill No:</strong> {bill.bill_number}</p>
            <p className="m-1"><strong>Date:</strong> {formatDate(bill.created_at)}</p>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full mb-6 border-collapse">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-2 px-1 w-12">S.No</th>
              <th className="text-left py-2 px-1">Medicine</th>
              <th className="text-left py-2 px-1 w-24">Batch</th>
              <th className="text-left py-2 px-1 w-20">Expiry</th>
              <th className="text-right py-2 px-1 w-16">Qty</th>
              <th className="text-right py-2 px-1 w-20">MRP</th>
              <th className="text-right py-2 px-1 w-24">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className="border-b border-gray-300">
                <td className="py-2 px-1 text-left">{index + 1}</td>
                <td className="py-2 px-1 text-left font-medium">{item.medicine_name}</td>
                <td className="py-2 px-1 text-left">{{item.batch_no}}</td>
                <td className="py-2 px-1 text-left">{item.expiry_date}</td>
                <td className="py-2 px-1 text-right">{item.quantity}</td>
                <td className="py-2 px-1 text-right">₹{item.mrp.toFixed(2)}</td>
                <td className="py-2 px-1 text-right">₹{item.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals Section */}
        <div className="flex justify-end mb-8">
          <div className="w-64 border-2 border-black p-4 rounded-sm">
            <div className="flex justify-between mb-1">
              <span>Subtotal:</span>
              <span>₹{bill.subtotal.toFixed(2)}</span>
            </div>
            {bill.discount > 0 && (
              <div className="flex justify-between mb-1">
                <span>Discount:</span>
                <span>-₹{bill.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between mb-1">
              <span>CGST:</span>
              <span>₹{bill.cgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between mb-1 border-b border-black pb-2">
              <span>SGST:</span>
              <span>₹{bill.sgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between mt-2 font-bold text-lg">
              <span>Total:</span>
              <span>₹{bill.total.toFixed(2)}</span>
            </div>
            <div className="text-xs text-right mt-1 text-gray-600">
              Paid via {bill.payment_mode}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center border-t-2 border-black pt-4 font-bold">
          <p>Thank you for your visit. Wish you a speedy recovery!</p>
          <p className="text-xs font-normal mt-2">Goods once sold cannot be taken back.</p>
        </div>
        
        {/* CSS for print media */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * {
              visibility: hidden;
            }
            .print-area, .print-area * {
              visibility: visible;
            }
            .print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
          }
        `}} />
      </div>
    );
  }
);

BillPrintView.displayName = 'BillPrintView';

export default BillPrintView;
