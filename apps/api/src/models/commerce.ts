import { Schema, model, type InferSchemaType } from 'mongoose';

const orderSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'usd' },
    provider: { type: String, enum: ['mock', 'stripe'], default: 'mock' },
    providerSessionId: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'paid', 'refunded', 'failed'],
      default: 'pending',
      index: true,
    },
    paidAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
// Only real provider session IDs must be unique. A sparse index would still
// index documents whose field is explicitly `null` (mock orders), so use a
// partial index keyed on the BSON string type instead.
orderSchema.index(
  { providerSessionId: 1 },
  { unique: true, partialFilterExpression: { providerSessionId: { $type: 'string' } } },
);

const ledgerSchema = new Schema(
  {
    instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    gross: { type: Number, required: true },
    platformFeePct: { type: Number, default: 20 },
    fee: { type: Number, required: true },
    net: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'available', 'reversed'], default: 'available' },
    availableAt: { type: Date, default: Date.now },
    reversedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
ledgerSchema.index({ instructor: 1, availableAt: -1 });

export type OrderDoc = InferSchemaType<typeof orderSchema> & {
  _id: import('mongoose').Types.ObjectId;
  createdAt: Date;
};
export type LedgerDoc = InferSchemaType<typeof ledgerSchema> & {
  _id: import('mongoose').Types.ObjectId;
  createdAt: Date;
};

export const Order = model('Order', orderSchema);
export const LedgerEntry = model('LedgerEntry', ledgerSchema);
