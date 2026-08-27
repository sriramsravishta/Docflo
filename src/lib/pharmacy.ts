import { supabase } from './supabase';
import {
  PharmacyInventoryRow,
  PharmacyBillRow,
  PharmacyBillItemRow,
  PharmacyQueueItem,
  PharmacyConfig
} from '../types/pharmacy';

export const getUserRole = async (authId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('auth_id', authId)
    .single();
  if (error) throw error;
  return data as { role: string; org_id: string };
};

export const getPharmacyConfig = async (orgId: string) => {
  const { data, error } = await supabase
    .from('organizations')
    .select('pharmacy_config')
    .eq('id', orgId)
    .single();
  if (error) throw error;
  return (data?.pharmacy_config as PharmacyConfig) || null;
};

export const getPharmacyQueue = async (
  orgId: string,
  date?: string
): Promise<PharmacyQueueItem[]> => {
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = targetDate.toISOString().split('T')[0] + 'T00:00:00.000Z';

  // 1. Get completed consults for the org today
  const { data: consults, error: consultsError } = await supabase
    .from('consult')
    .select(`
      id,
      patient_id,
      status,
      type,
      created_at,
      patients!inner(id, org_id, name, gender, age, phone)
    `)
    .eq('patients.org_id', orgId)
    .eq('status', 'Success')
    .eq('type', 'consultation')
    .gte('created_at', startOfDay);

  if (consultsError) throw consultsError;
  if (!consults || consults.length === 0) return [];

  const consultIds = consults.map((c: any) => c.id);

  // 2. Get bills for these consults to exclude them if already completed
  const { data: bills, error: billsError } = await supabase
    .from('pharmacy_bills')
    .select('consult_id')
    .in('consult_id', consultIds)
    .eq('status', 'completed');

  if (billsError) throw billsError;

  const billedConsultIds = new Set(bills?.map((b: any) => b.consult_id) || []);

  // 3. Filter out billed consults
  const pendingConsults = consults.filter((c: any) => !billedConsultIds.has(c.id));
  if (pendingConsults.length === 0) return [];

  const pendingConsultIds = pendingConsults.map((c: any) => c.id);

  // 4. Get medicine counts
  const { data: medicines, error: medError } = await supabase
    .from('consult_medicine')
    .select('consult_id')
    .in('consult_id', pendingConsultIds);

  if (medError) throw medError;

  const medCounts = (medicines || []).reduce((acc: Record<string, number>, med: any) => {
    acc[med.consult_id] = (acc[med.consult_id] || 0) + 1;
    return acc;
  }, {});

  return pendingConsults.map((c: any) => ({
    consult_id: c.id,
    patient_id: c.patient_id,
    patient_name: c.patients.name,
    patient_gender: c.patients.gender,
    patient_age: c.patients.age,
    patient_phone: c.patients.phone,
        consult_created_at: c.created_at,
    is_billed: false,
    medicine_count: medCounts[c.id] || 0
  }));
};

export const getConsultPrescription = async (consultId: string) => {
  const { data: medicines, error: medError } = await supabase
    .from('consult_medicine')
    .select('*')
    .eq('consult_id', consultId)
    .order('created_at', { ascending: true });
  if (medError) throw medError;

  const { data: consult, error: consultError } = await supabase
    .from('consult')
    .select(`
      patients (
        name, age, gender, phone
      )
    `)
    .eq('id', consultId)
    .single();
  if (consultError) throw consultError;

  return {
    medicines: medicines || [],
    patient: (consult as any)?.patients || null
  };
};

export const searchInventory = async (
  orgId: string,
  query: string,
  limit: number = 20
) => {
  const { data, error } = await supabase
    .from('pharmacy_inventory')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .ilike('medicine_name', `${query}%`)
    .order('medicine_name', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data as PharmacyInventoryRow[];
};

export const getInventory = async (
  orgId: string,
  options?: {
    search?: string;
    showInactive?: boolean;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }
) => {
  let query = supabase
    .from('pharmacy_inventory')
    .select('*')
    .eq('org_id', orgId);

  if (!options?.showInactive) {
    query = query.eq('is_active', true);
  }

  if (options?.search) {
    query = query.ilike('medicine_name', `%${options.search}%`);
  }

  const sortBy = options?.sortBy || 'medicine_name';
  const sortDir = options?.sortDir || 'asc';
  query = query.order(sortBy, { ascending: sortDir === 'asc' });

  const { data, error } = await query;
  if (error) throw error;
  return data as PharmacyInventoryRow[];
};

export const createInventoryItem = async (
  item: Omit<PharmacyInventoryRow, 'id' | 'created_at' | 'updated_at'>
) => {
  const { data, error } = await supabase
    .from('pharmacy_inventory')
    .insert(item)
    .select()
    .single();
  if (error) throw error;
  return data as PharmacyInventoryRow;
};

export const updateInventoryItem = async (
  id: string,
  updates: Partial<PharmacyInventoryRow>
) => {
  const { data, error } = await supabase
    .from('pharmacy_inventory')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as PharmacyInventoryRow;
};

export const deleteInventoryItem = async (id: string) => {
  const { data, error } = await supabase
    .from('pharmacy_inventory')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as PharmacyInventoryRow;
};

export const dispenseBill = async (params: {
  org_id: string;
  consult_id: string | null;
  patient_id: string;
  created_by: string;
  discount_amount: number;
  payment_mode: string;
  notes: string;
  items: Array<{
    inventory_id: string | null;
    consult_medicine_id: string | null;
    quantity: number;
    medicine_name: string;
    batch_no: string;
    expiry_date: string | null;
    mrp: number;
    sale_price: number;
    gst_percent: number;
  }>;
}) => {
    const { data, error } = await supabase.rpc('dispense_and_create_bill', {
    p_org_id: params.org_id,
    p_consult_id: params.consult_id,
    p_patient_id: params.patient_id,
    p_created_by: params.created_by,
    p_discount_amount: params.discount_amount,
    p_payment_mode: params.payment_mode,
    p_notes: params.notes,
    p_items: JSON.stringify(params.items)
  });
  if (error) throw error;
  return data as string;
};

export const getBills = async (
  orgId: string,
  dateRange?: { from: string; to: string }
) => {
  let query = supabase
    .from('pharmacy_bills')
    .select(`
      *,
      patients (name, phone)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (dateRange) {
    query = query
      .gte('created_at', dateRange.from)
      .lte('created_at', dateRange.to);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as (PharmacyBillRow & { patients: { name: string; phone: string } })[];
};

export const getBillDetails = async (billId: string) => {
  const { data: bill, error: billError } = await supabase
    .from('pharmacy_bills')
    .select(`
      *,
      patients (name, phone, age, gender)
    `)
    .eq('id', billId)
    .single();
  if (billError) throw billError;

  const { data: items, error: itemsError } = await supabase
    .from('pharmacy_bill_items')
    .select('*')
    .eq('bill_id', billId);
  if (itemsError) throw itemsError;

  return {
    bill: bill as PharmacyBillRow & { patients: { name: string; phone: string; age: number; gender: string } },
    items: items as PharmacyBillItemRow[]
  };
};

export const cancelBill = async (billId: string) => {
  const { data: items, error: itemsError } = await supabase
    .from('pharmacy_bill_items')
    .select('inventory_id, quantity')
    .eq('bill_id', billId);
  if (itemsError) throw itemsError;

  for (const item of items || []) {
    if (item.inventory_id) {
      const { data: inv, error: invError } = await supabase
        .from('pharmacy_inventory')
        .select('quantity_in_stock')
        .eq('id', item.inventory_id)
        .single();
      
      if (!invError && inv) {
        await supabase
          .from('pharmacy_inventory')
          .update({ quantity_in_stock: inv.quantity_in_stock + item.quantity })
          .eq('id', item.inventory_id);
      }
    }
  }

  const { data, error } = await supabase
    .from('pharmacy_bills')
    .update({ status: 'cancelled' })
    .eq('id', billId)
    .select()
    .single();
  if (error) throw error;
  
  return data as PharmacyBillRow;
};

export const getLowStockItems = async (orgId: string) => {
  const { data, error } = await supabase
    .from('pharmacy_inventory')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true);
  if (error) throw error;
  
  return (data as PharmacyInventoryRow[]).filter(
    (item) => item.quantity_in_stock <= (item.reorder_level || 0)
  );
};

export const getExpiringItems = async (orgId: string, withinDays: number = 90) => {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + withinDays);
  const targetDateStr = targetDate.toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('pharmacy_inventory')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .not('expiry_date', 'is', null)
    .lte('expiry_date', targetDateStr)
    .order('expiry_date', { ascending: true });
  if (error) throw error;
  
  return data as PharmacyInventoryRow[];
};
