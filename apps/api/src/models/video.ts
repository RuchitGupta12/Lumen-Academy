import { Schema, model, type InferSchemaType } from 'mongoose';
import { VIDEO_STATUSES } from '@lumen/shared';

const renditionSchema = new Schema(
  {
    height: Number,
    width: Number,
    bitrateKbps: Number,
    playlist: String,
  },
  { _id: false },
);

const videoAssetSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    lesson: { type: Schema.Types.ObjectId, ref: 'Lesson', default: null },
    instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    originalName: { type: String, default: '' },
    originalKey: { type: String, default: '' },
    status: { type: String, enum: VIDEO_STATUSES, default: 'uploaded', index: true },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    durationSec: { type: Number, default: 0 },
    renditions: { type: [renditionSchema], default: [] },
    posterKey: { type: String, default: null },
    thumbnailsKey: { type: String, default: null },
    manifestKey: { type: String, default: null },
    jobId: { type: String, default: null },
    error: { type: String, default: null },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

videoAssetSchema.index({ lesson: 1 });

export type VideoAssetDoc = InferSchemaType<typeof videoAssetSchema> & {
  _id: import('mongoose').Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const VideoAsset = model('VideoAsset', videoAssetSchema);
