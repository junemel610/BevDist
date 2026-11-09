import React from 'react';
import { PaymentMethodTransactionsScreen } from '../components/balances/PaymentMethodTransactionsScreen';
import { PAYMENT_METHOD } from '../types';

export function GCashTransactionsScreen() {
  return (
    <PaymentMethodTransactionsScreen
      method={PAYMENT_METHOD.GCASH}
      title="GCash transactions"
      description="Recorded GCash payments, separate from cash sales"
      icon="smartphone"
      emptyTitle="No GCash payments yet"
      emptyDescription="Payments recorded as GCash will appear in this separate view."
    />
  );
}
