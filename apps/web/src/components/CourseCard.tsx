import { Link } from 'react-router-dom';
import { Clock3, Star, Users } from 'lucide-react';
import type { CourseDTO } from '@lumen/shared';
import { CourseCover } from './CourseCover';
import { Badge } from './ui';
import { cn, levelLabel, longDuration, money } from '../lib/format';

export function CourseCard({ course, className }: { course: CourseDTO; className?: string }) {
  return (
    <Link
      to={`/courses/${course.slug}`}
      className={cn(
        'group card hover-lift flex flex-col overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember',
        className,
      )}
    >
      <div className="relative">
        <CourseCover
          cover={course.cover}
          category={course.category}
          level={levelLabel[course.level] ?? course.level}
          className="aspect-[16/9] rounded-none"
        />
        {course.isEnrolled && (
          <div className="absolute bottom-2.5 left-2.5">
            <Badge tone="verdigris" dot>
              Enrolled
            </Badge>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3 className="text-[14.5px] font-medium leading-snug tracking-[-0.01em] text-ink transition-colors group-hover:text-ember">
          {course.title}
        </h3>
        <p className="line-clamp-2 text-[12px] leading-relaxed text-muted">{course.subtitle}</p>

        <div className="mt-auto space-y-2.5 pt-2">
          <p className="text-[11.5px] text-faint">{course.instructor.name}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-muted">
            <span className="inline-flex items-center gap-1">
              <Star size={11} className="fill-ochre text-ochre" />
              {course.stats.ratingAvg ? course.stats.ratingAvg.toFixed(1) : '—'}
              <span className="text-faint">({course.stats.ratingCount})</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 size={11} />
              {longDuration(course.stats.durationSec)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users size={11} />
              {course.stats.enrollmentCount}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-2.5">
            <span className="font-mono text-[13px] text-ink">{Number(course.price) === 0 ? 'Free' : money(course.price)}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
              {course.stats.lessonCount} lessons
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
