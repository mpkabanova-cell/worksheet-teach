import { MathText } from './MathText'
import { criteriaDisplayLines } from '@/data/assessmentCriteria'

export function CriteriaLevelsView({ text }: { text: string }) {
  return <div className="criteria-levels">
    {criteriaDisplayLines(text).map((line, index) => <MathText key={index} as="div" text={line} />)}
  </div>
}