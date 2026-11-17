import { Schema, model, type InferSchemaType } from 'mongoose';

const enrollmentSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    pricePaid: { type: Number, default: 0 },
    progressPct: { type: Number, default: 0, min: 0, max: 100 },
    lastLessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', default: null },
    completedAt: { type: Date, default: null },
    certificateId: { type: Schema.Types.ObjectId, ref: 'Certificate', default: null },
  },
  { timestamps: true },
);
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

const lessonProgressSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    lesson: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    watchedSeconds: { type: Number, default: 0, min: 0 },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true },
);
lessonProgressSchema.index({ student: 1, lesson: 1 }, { unique: true });
lessonProgressSchema.index({ student: 1, course: 1 });

const certificateSchema = new Schema(
  {
    serial: { type: String, required: true, unique: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    studentName: { type: String, required: true },
    courseTitle: { type: String, required: true },
    instructorName: { type: String, default: '' },
    issuedAt: { type: Date, default: Date.now },
    pdfKey: { type: String, default: null },
    verifyHash: { type: String, required: true },
  },
  { timestamps: true },
);
certificateSchema.index({ student: 1, course: 1 }, { unique: true });

export type EnrollmentDoc = InferSchemaType<typeof enrollmentSchema> & {
  _id: import('mongoose').Types.ObjectId;
  createdAt: Date;
};
export type LessonProgressDoc = InferSchemaType<typeof lessonProgressSchema> & {
  _id: import('mongoose').Types.ObjectId;
};
export type CertificateDoc = InferSchemaType<typeof certificateSchema> & {
  _id: import('mongoose').Types.ObjectId;
  issuedAt: Date;
};

export const Enrollment = model('Enrollment', enrollmentSchema);
export const LessonProgress = model('LessonProgress', lessonProgressSchema);
export const Certificate = model('Certificate', certificateSchema);
