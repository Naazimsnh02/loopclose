import type { Locale, NavigatorIntent } from '@/lib/api';

/** Patient-facing chrome for the simulated phone (not clinical content; that comes from the API). */
export const PHONE_COPY: Record<Locale, { team: Record<string, string>; subtitle: string; placeholder: string; today: string; typing: string }> = {
  en: { team: { 'colorectal-fit': 'Bowel screening team', 'breast-birads': 'Breast screening team' }, subtitle: 'A person reads every message', placeholder: 'Type a message', today: 'Today', typing: 'typing' },
  ar: { team: { 'colorectal-fit': 'فريق فحص الأمعاء', 'breast-birads': 'فريق فحص الثدي' }, subtitle: 'يقرأ أحد أعضاء الفريق كل رسالة', placeholder: 'اكتب رسالة', today: 'اليوم', typing: 'يكتب' },
  ur: { team: { 'colorectal-fit': 'آنتوں کی اسکریننگ ٹیم', 'breast-birads': 'بریسٹ اسکریننگ ٹیم' }, subtitle: 'ہر پیغام ایک شخص پڑھتا ہے', placeholder: 'پیغام لکھیں', today: 'آج', typing: 'لکھ رہا ہے' },
  hi: { team: { 'colorectal-fit': 'आँत स्क्रीनिंग टीम', 'breast-birads': 'ब्रेस्ट स्क्रीनिंग टीम' }, subtitle: 'हर संदेश एक व्यक्ति पढ़ता है', placeholder: 'संदेश लिखें', today: 'आज', typing: 'लिख रहे हैं' },
};

export interface QuickReply {
  label: string; // English gloss shown to the demo operator
  text: string; // what the patient sends
  expect: NavigatorIntent;
}

const PASS: Record<string, Record<Locale, string>> = {
  'colorectal-fit': {
    en: 'I need a follow-up test called a colonoscopy',
    ar: 'سأحتاج إلى فحص تنظير القولون',
    ur: 'مجھے کولونوسکوپی ٹیسٹ کروانا ہے',
    hi: 'मुझे कोलोनोस्कोपी जाँच करवानी है',
  },
  'breast-birads': {
    en: 'I need more tests at the breast clinic, maybe a biopsy',
    ar: 'سأحتاج إلى فحوصات إضافية في عيادة الثدي وربما خزعة',
    ur: 'مجھے بریسٹ کلینک میں مزید ٹیسٹ کروانے ہیں',
    hi: 'मुझे ब्रेस्ट क्लिनिक में और जाँच करवानी है',
  },
};

const FAQ_PAIN: Record<Locale, string> = { en: 'Does it hurt?', ar: 'هل يؤلم؟', ur: 'کیا درد ہوگا؟', hi: 'क्या दर्द होगा?' };
const FAQ_CANCER: Record<Locale, string> = { en: 'Is it cancer?', ar: 'هل هو سرطان؟', ur: 'کیا یہ کینسر ہے؟', hi: 'क्या यह कैंसर है?' };
const UNSURE: Record<Locale, string> = { en: "I'm not sure", ar: 'لا أعرف', ur: 'مجھے نہیں معلوم', hi: 'मुझे पता नहीं' };
const SCARED: Record<Locale, string> = { en: "I'm really scared", ar: 'أنا خائفة جدًا', ur: 'مجھے بہت ڈر لگ رہا ہے', hi: 'मुझे बहुत डर लग रहा है' };
const HUMAN: Record<Locale, string> = { en: 'Can someone call me back?', ar: 'اتصلوا بي من فضلكم', ur: 'براہ کرم مجھے کال کریں', hi: 'कृपया मुझे कॉल करें' };
const OTHER: Record<Locale, string> = { en: 'Can my sister come with me?', ar: 'هل يمكن أن تأتي أختي معي؟', ur: 'کیا میری بہن میرے ساتھ آ سکتی ہے؟', hi: 'क्या मेरी बहन मेरे साथ आ सकती है?' };

export function quickReplies(programmeId: string, locale: Locale): QuickReply[] {
  return [
    { label: 'Correct teach-back', text: PASS[programmeId]?.[locale] ?? PASS['colorectal-fit']![locale], expect: 'teach_back_pass' },
    { label: 'Unsure', text: UNSURE[locale], expect: 'teach_back_fail' },
    { label: 'Asks about pain', text: FAQ_PAIN[locale], expect: 'faq' },
    { label: 'Asks about cancer', text: FAQ_CANCER[locale], expect: 'faq' },
    { label: 'Distress', text: SCARED[locale], expect: 'distress' },
    { label: 'Wants a person', text: HUMAN[locale], expect: 'human' },
    { label: 'Other question', text: OTHER[locale], expect: 'question' },
  ];
}

export const INTENT_META: Record<NavigatorIntent, { label: string; tone: 'danger' | 'warn' | 'info' | 'ok' | 'brand' | 'neutral' | 'ai'; outcome: string }> = {
  emergency: { label: 'Possible emergency', tone: 'danger', outcome: 'Emergency advice sent · urgent escalation to PHC clinician' },
  distress: { label: 'Distress', tone: 'warn', outcome: 'Supportive reply · urgent clinician callback raised' },
  human: { label: 'Asked for a person', tone: 'info', outcome: 'Hand-off · coordinator to call the patient' },
  teach_back_pass: { label: 'Teach-back passed', tone: 'ok', outcome: 'Acknowledgement proposed · waits for a coordinator' },
  teach_back_fail: { label: 'Teach-back not yet', tone: 'warn', outcome: 'Re-explained in simpler words, or handed to a person' },
  faq: { label: 'Approved answer', tone: 'brand', outcome: 'Answered from the clinician-approved FAQ' },
  question: { label: 'Forwarded', tone: 'neutral', outcome: 'No approved answer · forwarded to the team' },
};

/** Map the navigator's outbound template key back to the decision it represents. */
export function intentFromTemplate(templateId: string | null): NavigatorIntent | null {
  if (!templateId?.startsWith('nav:')) return null;
  if (templateId === 'nav:emergency') return 'emergency';
  if (templateId === 'nav:distress') return 'distress';
  if (templateId === 'nav:handoff_human') return 'human';
  if (templateId === 'nav:teach_back_pass') return 'teach_back_pass';
  if (templateId === 'nav:re_explain' || templateId === 'nav:handoff_not_understood') return 'teach_back_fail';
  if (templateId.startsWith('nav:faq:')) return 'faq';
  if (templateId === 'nav:question_forwarded') return 'question';
  return null;
}

export const isRtl = (locale: string) => locale === 'ar' || locale === 'ur';
