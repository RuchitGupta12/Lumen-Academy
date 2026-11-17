import { Schema, model, type InferSchemaType } from 'mongoose';
import { ROLES } from '@lumen/shared';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'student', index: true },
    avatarUrl: { type: String, default: null },
    headline: { type: String, default: null, maxlength: 120 },
    bio: { type: String, default: null, maxlength: 2000 },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: import('mongoose').Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const User = model('User', userSchema);
