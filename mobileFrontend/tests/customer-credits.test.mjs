import test from 'node:test';
import assert from 'node:assert/strict';
import { customerCreditRows } from '../src/components/balances/balanceUtils.js';

test('customer credits retain customer identity, exclude zero balances, and sort by name', () => {
  const rows = customerCreditRows({ 'customer:b': 50, 'customer:a': 100, 'customer:c': 0 }, [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Ben' }, { id: 'c', name: 'Cal' }]);
  assert.deepEqual(rows.map(row => [row.name, row.amount]), [['Ana', 100], ['Ben', 50]]);
});
