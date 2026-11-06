export const DISTRIBUTOR_CATALOG = [
  {
    id: 'coca-cola', name: 'Coca-Cola', aliases: ['coca cola', 'coca-cola', 'coke'],
    groups: [
      { name: 'Small bottles', products: ['Coke Tall 8oz', 'Royal Tall 8oz', 'Sprite Tall 8oz', 'Coke Mismo', 'Royal Mismo', 'Sprite Mismo'] },
      { name: 'Family bottles', products: ['Coke Kasalo', 'Royal Kasalo', 'Sprite Kasalo', 'Coke 1.5L', 'Royal 1.5L', 'Sprite 1.5L', 'Coke Zero 1.5L'] },
      { name: 'Juice and water', products: ['Minute Maid', 'Wilkins 500mL', 'Wilkins 1L', 'Wilkins 7L'] },
    ],
  },
  {
    id: 'pepsi', name: 'Pepsi', aliases: ['pepsi', 'pepsico'],
    groups: [
      { name: 'Soft drinks', products: ['Pepsi 8oz', 'Mountain Dew 8oz', 'Mountain Dew 12oz', '7up 7oz', 'Mountain Dew Mega', 'Pepsi Mega', 'Mountain Dew Neon'] },
      { name: 'Energy and sports drinks', products: ['Sting', 'Sting Pet', 'Gatorade', 'Tropicana'] },
    ],
  },
  {
    id: 'asia-brewery', name: 'Asia Brewery', aliases: ['asia brewery', 'asia brewing'],
    groups: [
      { name: 'Drinks', products: ['Cobra', 'Cobra Pet', 'Vitamilk', 'Vitachoco'] },
      { name: 'Summit water', products: ['Summit 350mL', 'Summit 500mL', 'Summit 1L'] },
    ],
  },
  {
    id: 'arc', name: 'ARC Product', aliases: ['arc product', 'arc products'],
    groups: [{ name: 'Drinks', products: ['RC 8oz', 'Lemon Fruit Soda', 'Root Beer', 'RC Mega', 'Orange Fruit Soda'] }],
  },
  {
    id: 'san-miguel', name: 'San Miguel', aliases: ['san miguel', 'san miguel brewery'],
    groups: [{ name: 'Beer', products: ['Red Horse 500mL', 'Red Horse 1L', 'Grande', 'San Mig Light', 'San Mig Beer', 'Stallion', 'San Mig Apple'] }],
  },
  {
    id: 'magnolia', name: 'Magnolia Product', aliases: ['magnolia', 'magnolia product', 'magnolia products'],
    groups: [{ name: 'Juice drinks', products: ['Mag Apple', 'Mag Lemon', 'Mag Grapes', 'Mag Strawberry'] }],
  },
];

const normalize = value => String(value || '').toLocaleLowerCase().replace(/[^a-z0-9]/g, '');

export function distributorIdForProduct(product) {
  const supplier = String(product?.supplier || '').toLocaleLowerCase();
  return DISTRIBUTOR_CATALOG.find(distributor => distributor.aliases.some(alias => supplier.includes(alias)))?.id
    || `supplier:${product?.supplierId || normalize(supplier) || 'other'}`;
}

export function findCatalogProduct(name, products, distributorId) {
  const key = normalize(name);
  return products.find(product => distributorIdForProduct(product) === distributorId && normalize(product.name) === key);
}

export function extraProductsForDistributor(products, distributorId) {
  const distributor = DISTRIBUTOR_CATALOG.find(item => item.id === distributorId);
  const names = new Set(distributor?.groups.flatMap(group => group.products.map(normalize)) || []);
  return products.filter(product => distributorIdForProduct(product) === distributorId && !names.has(normalize(product.name)));
}

export function otherDistributorFilters(products) {
  const known = new Set(DISTRIBUTOR_CATALOG.map(item => item.id));
  const labels = new Map();
  products.forEach(product => {
    const id = distributorIdForProduct(product);
    if (!known.has(id) && id !== 'supplier:other') labels.set(id, product.supplier || 'Other distributor');
  });
  return [...labels].map(([id, name]) => ({ id, name }));
}
