export interface ConsultMedicineRow {
  id: string;
  consult_id: string;
  name: string;
  dosage?: string;
  quantity?: string;
  type?: string;
  frequency?: string;
  time?: string[];
  food?: string;
  duration?: string;
  instructions?: string;
  flags?: string;
  created_at: string;
}

export interface PharmacyInventoryRow {
  id: string;
  org_id: string;
  medicine_name: string;
  generic_name?: string;
  manufacturer?: string;
  batch_no: string;
  expiry_date?: string;
  quantity_in_stock: number;
  mrp: number;
  sale_price: number;
  purchase_price?: number;
  hsn_code?: string;
  gst_percent?: number;
  unit?: string;
  pack_size?: string;
  reorder_level?: number;
  rack_location?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PharmacyBillRow {
  id: string;
  bill_number: string;
  org_id: string;
  consult_id?: string;
  patient_id: string;
  created_by: string;
  subtotal: number;
  discount_amount?: number;
  discount_percent?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  total_amount: number;
  payment_mode?: string;
  status: string;
  notes?: string;
  created_at?: string;

  // Optional joined fields
  patient_name?: string;
  patient_age?: string;
  patient_gender?: string;
}

export interface PharmacyBillItemRow {
  id: string;
  bill_id: string;
  inventory_id?: string;
  consult_medicine_id?: string;
  medicine_name: string;
  batch_no?: string;
  expiry_date?: string;
  quantity: number;
  mrp: number;
  sale_price: number;
  gst_percent?: number;
  gst_amount?: number;
  line_total: number;
  created_at?: string;
}

export interface DispenseLineItem {
  // Prescribed med info
  consult_medicine_id?: string;
  prescribed_name: string;
  prescribed_dosage?: string;
  prescribed_quantity?: string;
  prescribed_instructions?: string;
  
  // Selected inventory item
  inventory_id?: string;
  medicine_name?: string;
  batch_no?: string;
  expiry_date?: string;
  sale_price?: number;
  mrp?: number;
  gst_percent?: number;

  // Dispense info
  quantity_to_dispense: number;
  stock_status: 'in_stock' | 'out_of_stock' | 'partial' | 'unlinked';
  available_stock?: number;
  line_total?: number;
}

export interface PharmacyConfig {
  bill_prefix?: string;
  next_bill_number?: number;
  print_header?: string;
  print_footer?: string;
  gst_enabled?: boolean;
  default_discount_percent?: number;
}

export interface PharmacyQueueItem {
  consult_id: string;
  patient_name: string;
  patient_age: string;
  patient_gender: string;
  consult_created_at: string;
  medicine_count: number;
  is_billed: boolean;
}

export type UserRole = 'Doctor' | 'Assistant' | 'Pharmacist' | 'Receptionist';
