import React from 'react';
import { PaymentMethodTransactionsScreen } from '../components/balances/PaymentMethodTransactionsScreen';
import { PAYMENT_METHOD } from '../types';

export function BankTransferTransactionsScreen() {
  return (
    <PaymentMethodTransactionsScreen
      method={PAYMENT_METHOD.BANK_TRANSFER}
      title="Bank Transfer transactions"
      description="Recorded bank transfer payments, separate from cash sales"
      icon="account-balance"
      emptyTitle="No Bank Transfer payments yet"
      emptyDescription="Payments recorded as Bank Transfer will appear in this separate view."
    />
  );
}
