/** Preserve the existing coworking lead-time rule as catalog slugs evolve. */
export function blocksSameDayBooking(serviceSlug?: string, billingType?: string): boolean {
  return billingType === 'RECURRING' || serviceSlug === 'coworking' || serviceSlug === 'coworking-space';
}
