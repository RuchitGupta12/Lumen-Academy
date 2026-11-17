import { Schema, model, type InferSchemaType } from 'mongoose';
import { LIVE_STATUSES } from '@lumen/shared';

const liveSessionSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 140 },
    description: { type: String, default: '', maxlength: 1000 },
    scheduledAt: { type: Date, required: true, index: true },
    status: { type: String, enum: LIVE_STATUSES, default: 'scheduled', index: true },
    roomName: { type: String, required: true },
    recordingUrl: { type: String, default: null },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const chatMessageSchema = new Schema(
  {
    session: { type: Schema.Types.ObjectId, ref: 'LiveSession', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    text: { type: String, required: true, maxlength: 600 },
    kind: { type: String, enum: ['chat', 'system'], default: 'chat' },
  },
  { timestamps: true },
);
chatMessageSchema.index({ session: 1, createdAt: 1 });

export type LiveSessionDoc = InferSchemaType<typeof liveSessionSchema> & {
  _id: import('mongoose').Types.ObjectId;
  scheduledAt: Date;
};
export type ChatMessageDoc = InferSchemaType<typeof chatMessageSchema> & {
  _id: import('mongoose').Types.ObjectId;
  createdAt: Date;
};

export const LiveSession = model('LiveSession', liveSessionSchema);
export const ChatMessage = model('ChatMessage', chatMessageSchema);
