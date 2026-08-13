// --- Diagnosis Filter Support ---

export const getAllCanonicalDiagnoses = async (docId: string): Promise<{ canonical: string; count: number }[]> => {
  // Get all patients' canonical diagnoses arrays, aggregate counts
  const { data, error } = await supabase
    .from('patients')
    .select('diagnoses_canonical')
    .eq('doc_id', docId);
  if (error) throw error;

  const counts: Record<string, number> = {};
  (data || []).forEach((p) => {
    const arr = Array.isArray(p.diagnoses_canonical) ? p.diagnoses_canonical : [];
    arr.forEach((d: string) => {
      counts[d] = (counts[d] || 0) + 1;
    });
  });

  return Object.entries(counts)
    .map(([canonical, count]) => ({ canonical, count }))
    .sort((a, b) => b.count - a.count);
};