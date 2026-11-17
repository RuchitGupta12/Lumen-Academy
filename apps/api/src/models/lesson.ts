import { Schema, model, type InferSchemaType } from 'mongoose';
import { LESSON_TYPES } from '@lumen/shared';

const lessonSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    sectionId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    type: { type: String, enum: LESSON_TYPES, default: 'video' },
    order: { type: Number, default: 0 },
    durationSec: { type: Number, default: 0, min: 0 },
    isPreview: { type: Boolean, default: false },
    body: { type: String, default: '' },
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', default: null },
    liveSession: { type: Schema.Types.ObjectId, ref: 'LiveSession', default: null },
    video: { type: Schema.Types.ObjectId, ref: 'VideoAsset', default: null },
  },
  { timestamps: true },
);

lessonSchema.index({ course: 1, order: 1 });

export type LessonDoc = InferSchemaType<typeof lessonSchema> & {
  _id: import('mongoose').Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Lesson = model('Lesson', lessonSchema);
