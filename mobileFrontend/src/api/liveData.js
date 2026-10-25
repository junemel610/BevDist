const dueDate = () => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(Date.now() + 7 * 86400000));
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
};

// Keep writes and their following read together; screens never adjust stock or money locally.
export function createLiveData(api, randomUUID) {
  const retryKeys = new Map();
  const keyed = async (name, input, send) => {
    const fingerprint = JSON.stringify([name, input]);
    const requestKey = retryKeys.get(fingerprint) || randomUUID();
    retryKeys.set(fingerprint, requestKey);
    try {
      const result = await send({ ...input, requestKey });
      retryKeys.delete(fingerprint);
      return result;
    } catch (error) {
      if (error.response && error.response.status < 500) retryKeys.delete(fingerprint);
      throw error;
    }
  };
  return {
    load: async () => (await api.appDataAPI.get()).data,
    saveCustomer: async profile => (await (profile.id ? api.customersAPI.update(profile.id, profile) : api.customersAPI.create(profile))).data,
    createOrder: (customer, items, containerReturns = []) => keyed('invoice', {
      customerId: customer.id,
      items: items.map(({ productId, packId, quantity }) => ({ productId, packId, quantity })),
      dueDate: dueDate(),
      containerReturns,
    }, input => api.invoicesAPI.create(input)),
    editInvoice: (id, items, containerReturns) => api.invoicesAPI.update(id, { ...(containerReturns === undefined ? {} : { containerReturns }), items: items.map(({ productId, packId, quantity }) => ({ productId, packId, quantity })) }),
    transition: (id, status) => status === 'cancelled' ? api.invoicesAPI.cancel(id, 'Cancelled by operator') : api.invoicesAPI.deliver(id),
    payment: (customer, amountReceived, method) => keyed('payment', { customerId: customer.id || customer.customerId, amountReceived, method },
      ({ customerId, ...input }) => api.paymentsAPI.create(customerId, input)),
    restock: (supplier, items, returnedCases, newProducts = [], newCasePackTypes = []) => {
      const input = {
        ...(supplier.id ? { supplierId: supplier.id } : { newSupplier: { name: supplier.name, contact: supplier.contact, address: supplier.address } }),
        items: items.map(({ productId, packId, quantity, unitCost }) => ({ productId, packId, quantity, unitCost })),
        newProducts,
        returnedCases,
        newCasePackTypes,
      };
      return keyed('supplier-order', input, payload => api.supplierOrdersAPI.create(payload));
    },
    saveProduct: (id, profile, original) => {
      const input = {
        name: profile.name || original?.name,
        supplierId: profile.supplierId || original?.supplierId,
        supplierName: profile.supplier,
        stockReason: profile.stockReason,
        newCasePackTypes: profile.newCasePackTypes || [],
        packs: profile.casePackIds.map(packId => ({
          packId, casePrice: Number(profile.casePrices[packId]),
          lowStockThreshold: original?.stockByCasePack?.[packId]?.lowStockThreshold ?? 15,
          totalStock: Number(profile.stockByCasePack[packId].totalStock),
          expectedStock: original?.stockByCasePack?.[packId]?.totalStock ?? 0,
        })),
      };
      return id ? api.productsAPI.update(id, input) : api.productsAPI.create(input);
    },
    deleteProduct: id => api.productsAPI.remove(id),
    clear: () => retryKeys.clear(),
  };
}
