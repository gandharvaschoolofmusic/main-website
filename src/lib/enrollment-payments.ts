type PaymentAmount = { id: string; amountMinorUnits: number; status: string };
type PaymentHistory<T extends PaymentAmount> = { payment?: T | null; payments?: readonly T[] };

/** Include legacy admission payments, without counting the same receipt twice. */
export function enrollmentPayments<T extends PaymentAmount>({ payment, payments = [] }: PaymentHistory<T>): T[] {
  const unique = new Map<string, T>();
  if (payment) unique.set(payment.id, payment);
  // The installment history is authoritative if a receipt's status has changed.
  for (const item of payments) unique.set(item.id, item);
  return [...unique.values()];
}

export function enrollmentPaidMinor(history: PaymentHistory<PaymentAmount>): number {
  return enrollmentPayments(history).reduce((sum, item) =>
    sum + (item.status === "PAID" ? item.amountMinorUnits : 0), 0);
}
