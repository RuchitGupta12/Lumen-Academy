import type { QuestionType } from '@lumen/shared';

export interface GradableQuestion {
  _id: unknown;
  type: QuestionType | string;
  options: string[];
  correct: number[];
  points: number;
  explanation?: string;
}

export interface SubmittedAnswer {
  questionId: string;
  selected: number[];
}

export interface GradedAnswer {
  questionId: string;
  correct: boolean;
  points: number;
  earned: number;
  explanation: string;
}

const normalise = (values: number[], optionCount: number) =>
  [...new Set(values.filter((v) => Number.isInteger(v) && v >= 0 && v < optionCount))].sort((a, b) => a - b);

const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Auto-grading rules:
 *  - single / truefalse: exact match earns full points
 *  - multi: partial credit — (hits - misses) / correctCount, floored at 0, rounded to 0.5
 */
export function gradeQuiz(questions: GradableQuestion[], answers: SubmittedAnswer[]) {
  const byId = new Map(answers.map((a) => [a.questionId, a]));
  const breakdown: GradedAnswer[] = [];
  let earned = 0;
  let maxScore = 0;

  for (const question of questions) {
    const id = String(question._id);
    maxScore += question.points;
    const submitted = byId.get(id);
    const selected = normalise(submitted?.selected ?? [], question.options.length);
    const correct = normalise(question.correct ?? [], question.options.length);

    let pointsEarned = 0;
    if (sameSet(selected, correct) && correct.length > 0) {
      pointsEarned = question.points;
    } else if (question.type === 'multi' && correct.length > 0) {
      const hits = selected.filter((s) => correct.includes(s)).length;
      const misses = selected.filter((s) => !correct.includes(s)).length;
      const ratio = Math.max(0, (hits - misses) / correct.length);
      pointsEarned = Math.round(question.points * ratio * 2) / 2;
    }

    earned += pointsEarned;
    breakdown.push({
      questionId: id,
      correct: pointsEarned === question.points,
      points: question.points,
      earned: pointsEarned,
      explanation: question.explanation ?? '',
    });
  }

  const score = maxScore === 0 ? 0 : Math.round((earned / maxScore) * 1000) / 10;
  return { score, earned, maxScore, breakdown };
}
