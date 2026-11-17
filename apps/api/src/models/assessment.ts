import { Schema, model, type InferSchemaType } from 'mongoose';
import { QUESTION_TYPES } from '@lumen/shared';

const questionSchema = new Schema(
  {
    prompt: { type: String, required: true, maxlength: 500 },
    type: { type: String, enum: QUESTION_TYPES, default: 'single' },
    options: { type: [String], default: [] },
    correct: { type: [Number], default: [] },
    points: { type: Number, default: 1, min: 1 },
    explanation: { type: String, default: '' },
  },
  { _id: true },
);

const quizSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    lesson: { type: Schema.Types.ObjectId, ref: 'Lesson', default: null, index: true },
    instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, maxlength: 160 },
    passingScore: { type: Number, default: 70, min: 1, max: 100 },
    attemptsAllowed: { type: Number, default: 3, min: 1, max: 20 },
    timeLimitSec: { type: Number, default: 0, min: 0 },
    questions: { type: [questionSchema], default: [] },
  },
  { timestamps: true },
);

const quizAttemptSchema = new Schema(
  {
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    answers: {
      type: [
        new Schema(
          {
            questionId: { type: Schema.Types.ObjectId, required: true },
            selected: { type: [Number], default: [] },
            correct: { type: Boolean, default: false },
            earned: { type: Number, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
quizAttemptSchema.index({ quiz: 1, student: 1, submittedAt: -1 });

export type QuizDoc = InferSchemaType<typeof quizSchema> & {
  _id: import('mongoose').Types.ObjectId;
};
export type QuizAttemptDoc = InferSchemaType<typeof quizAttemptSchema> & {
  _id: import('mongoose').Types.ObjectId;
  submittedAt: Date;
};

export const Quiz = model('Quiz', quizSchema);
export const QuizAttempt = model('QuizAttempt', quizAttemptSchema);
