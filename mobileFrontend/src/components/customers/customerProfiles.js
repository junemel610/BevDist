export function saveCustomerProfile(customers, profile, makeId = () => `c${Date.now()}`) {
  const name = String(profile?.name ?? '').trim();
  if (!name) return { customers, customer: null, error: 'Customer name is required.' };

  const existing = customers.find(customer => customer.id === profile.id);
  const duplicate = customers.find(customer => customer.id !== profile.id
    && customer.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
  if (duplicate) return { customers, customer: null, error: 'A customer with this name already exists. Select the existing customer instead.' };
  const customer = {
    ...existing,
    ...profile,
    id: existing?.id || profile.id || makeId(),
    name,
    contact: String(profile.contact ?? existing?.contact ?? '').trim(),
    address: String(profile.address ?? existing?.address ?? '').trim(),
  };
  const next = existing
    ? customers.map(item => item.id === existing.id ? customer : item)
    : [...customers, customer];
  return { customers: next, customer, error: null };
}
