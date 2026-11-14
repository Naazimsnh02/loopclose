import { SafetyGrader } from './safety-grader.service';
import type { MessageTemplate } from '../../messaging/template-library.service';

const template: MessageTemplate = {
  id: 't', programme: 'colorectal-fit', stage: 'result_issued', purpose: '', readingLevelTarget: 'grade6', variables: [],
  approval: { status: 'approved', approvedBy: 'x', approvedAt: 'y', reviewers: {} },
  body: { en: 'x', ar: 'x', ur: 'x', hi: 'x' },
  guardrails: { mustNotContain: ['you have cancer', '%'], mustPreserve: [] },
};

const llmUnavailable = { available: false, modelFor: () => 'none', call: async () => { throw new Error('n/a'); } } as never;

describe('SafetyGrader (rules mode)', () => {
  const grader = new SafetyGrader(llmUnavailable);

  it('passes clean English template text', async () => {
    const v = await grader.check({ text: 'Your test found a small amount of blood. This is not a diagnosis. A doctor will contact you.', locale: 'en', template, caseId: 'c' });
    expect(v.passed).toBe(true);
    expect(v.mode).toBe('rules');
  });

  it('blocks diagnosis phrases and percentages', async () => {
    const v = await grader.check({ text: 'There is a 30% chance you have cancer, please book soon.', locale: 'en', template, caseId: 'c' });
    expect(v.passed).toBe(false);
    expect(v.failedChecks).toEqual(expect.arrayContaining(['must_not_contain:you have cancer', 'no_percentages']));
  });

  it('blocks unrendered variables and wrong script for locale', async () => {
    const v = await grader.check({ text: 'Hello {{patientFirstName}}, this is your result notification message.', locale: 'ar', template, caseId: 'c' });
    expect(v.failedChecks).toEqual(expect.arrayContaining(['no_unrendered_variables', 'locale_script']));
  });

  it('fails closed for non-template text when the LLM is unavailable', async () => {
    const v = await grader.check({ text: 'A perfectly reasonable rephrasing of the approved message text.', locale: 'en', template, caseId: 'c', deviatesFromTemplate: true });
    expect(v.passed).toBe(false);
    expect(v.failedChecks).toContain('llm_grader_available');
  });
});
