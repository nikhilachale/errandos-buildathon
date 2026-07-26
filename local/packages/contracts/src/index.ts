import { z } from 'zod';

export const ProviderSchema = z.enum(['demo', 'blinkit']);
export type Provider = z.infer<typeof ProviderSchema>;

export const MoneySchema = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency: z.literal('INR'),
});
export type Money = z.infer<typeof MoneySchema>;

export const ProductOfferSchema = z.object({
  available: z.boolean(),
  name: z.string().min(1),
  offerId: z.string().min(1),
  price: MoneySchema,
  unit: z.string().min(1),
});
export type ProductOffer = z.infer<typeof ProductOfferSchema>;

export const ProposalItemSchema = z.object({
  name: z.string().min(1),
  offerId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  total: MoneySchema,
  unit: z.string().min(1),
  unitPrice: MoneySchema,
});
export type ProposalItem = z.infer<typeof ProposalItemSchema>;

export const ProposalSchema = z.object({
  addressLabel: z.string().min(1),
  etaMinutes: z.number().int().positive(),
  expiresAt: z.string().datetime(),
  fees: MoneySchema,
  items: z.array(ProposalItemSchema).min(1),
  paymentMode: z.literal('cod'),
  proposalHash: z.string().regex(/^[a-f0-9]{64}$/),
  proposalId: z.string().min(1),
  provider: ProviderSchema,
  status: z.literal('prepared'),
  subtotal: MoneySchema,
  total: MoneySchema,
});
export type Proposal = z.infer<typeof ProposalSchema>;

export const LifecycleStatusSchema = z.enum([
  'prepared',
  'approved',
  'dispatching',
  'committed',
  'blocked',
  'ambiguous',
  'reconciling',
  'failed',
]);
export type LifecycleStatus = z.infer<typeof LifecycleStatusSchema>;

export const CommitResultSchema = z.discriminatedUnion('status', [
  z.object({
    providerReference: z.string().min(1),
    receiptId: z.string().min(1),
    status: z.literal('committed'),
  }),
  z.object({
    reason: z.string().min(1),
    status: z.literal('blocked'),
  }),
  z.object({
    reconciliationId: z.string().min(1),
    status: z.literal('ambiguous'),
  }),
]);
export type CommitResult = z.infer<typeof CommitResultSchema>;
