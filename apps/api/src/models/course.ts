import { Schema, model, type InferSchemaType } from 'mongoose';
import { COURSE_CATEGORIES, COURSE_LEVELS, COURSE_STATUSES } from '@lumen/shared';

const sectionSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  order: { type: Number, default: 0 },
});

const courseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, index: true },
    subtitle: { type: String, default: '', maxlength: 180 },
    description: { type: String, default: '', maxlength: 8000 },
    category: { type: String, enum: COURSE_CATEGORIES, required: true, index: true },
    level: { type: String, enum: COURSE_LEVELS, default: 'beginner' },
    price: { type: Number, default: 0, min: 0 },
    instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: COURSE_STATUSES, default: 'draft', index: true },
    tags: { type: [String], default: [] },
    cover: {
      from: { type: String, default: '#1B2029' },
      to: { type: String, default: '#0B0D11' },
      motif: { type: String, default: 'L' },
    },
    sections: { type: [sectionSchema], default: [] },
    stats: {
      durationSec: { type: Number, default: 0 },
      lessonCount: { type: Number, default: 0 },
      ratingAvg: { type: Number, default: 0 },
      ratingCount: { type: Number, default: 0 },
      enrollmentCount: { type: Number, default: 0 },
    },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

courseSchema.index({ status: 1, category: 1, price: 1 });
courseSchema.index({ title: 'text', description: 'text', tags: 'text' });

export type CourseDoc = InferSchemaType<typeof courseSchema> & {
  _id: import('mongoose').Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Course = model('Course', courseSchema);
