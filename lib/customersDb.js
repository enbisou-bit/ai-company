const { supabase } = require('./supabase');

async function getCustomers() {
  if (!supabase) return { customers: [], source: 'fallback' };
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*, customer_proposals(id, proposal, added_at)')
      .order('updated_at', { ascending: false });
    if (error) return { customers: [], source: 'fallback', error: error.message };
    const customers = (data || []).map(c => ({
      ...c,
      pastProposals: (c.customer_proposals || []).map(p => ({ text: p.proposal, addedAt: p.added_at })),
    }));
    return { customers, source: 'db' };
  } catch (e) { return { customers: [], source: 'error', error: e.message }; }
}

async function getCustomerById(id) {
  if (!supabase) return { customer: null, source: 'fallback' };
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*, customer_proposals(id, proposal, added_at)')
      .eq('id', id)
      .single();
    if (error || !data) return { customer: null, source: 'fallback', error: error?.message };
    return {
      customer: {
        ...data,
        pastProposals: (data.customer_proposals || []).map(p => ({ text: p.proposal, addedAt: p.added_at })),
      },
      source: 'db',
    };
  } catch (e) { return { customer: null, source: 'error', error: e.message }; }
}

async function createCustomer({ id, name, industry, problems, notes }) {
  if (!supabase) return { error: 'Supabase未設定' };
  try {
    const { data, error } = await supabase.from('customers').insert({
      id:       id || `cu-${Date.now()}`,
      name,
      industry: industry || '',
      problems: problems || [],
      notes:    notes || '',
      contract_status: '未成約',
    }).select().single();
    if (error) return { customer: null, error: error.message };
    return { customer: { ...data, pastProposals: [] }, error: null };
  } catch (e) { return { customer: null, error: e.message }; }
}

async function updateCustomer(id, { name, industry, problems, contractStatus, notes }) {
  if (!supabase) return { error: 'Supabase未設定' };
  try {
    const updates = { updated_at: new Date().toISOString() };
    if (name             !== undefined) updates.name             = name;
    if (industry         !== undefined) updates.industry         = industry;
    if (Array.isArray(problems))        updates.problems         = problems;
    if (contractStatus   !== undefined) updates.contract_status  = contractStatus;
    if (notes            !== undefined) updates.notes            = notes;
    const { error } = await supabase.from('customers').update(updates).eq('id', id);
    return { error: error?.message || null };
  } catch (e) { return { error: e.message }; }
}

async function addProposal(customerId, proposalText) {
  if (!supabase) return { error: 'Supabase未設定' };
  try {
    const { error } = await supabase.from('customer_proposals').insert({
      customer_id: customerId,
      proposal:    proposalText,
    });
    return { error: error?.message || null };
  } catch (e) { return { error: e.message }; }
}

async function deleteCustomer(id) {
  if (!supabase) return { error: 'Supabase未設定' };
  try {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    return { error: error?.message || null };
  } catch (e) { return { error: e.message }; }
}

module.exports = { getCustomers, getCustomerById, createCustomer, updateCustomer, addProposal, deleteCustomer };
