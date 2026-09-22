import type { Analysis, InstitutionSetup, Issue } from '../../types';

export interface StepProps {
  setup: InstitutionSetup;
  update: (fn: (s: InstitutionSetup) => InstitutionSetup) => void;
  analysis: Analysis | null;
  stepIssues: Issue[];
  goTo: (step: number) => void;
  flush: () => Promise<boolean>;
}
