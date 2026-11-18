import { SectionHeading } from '@/components/common/SectionHeading'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

const faqs = [
  {
    q: 'Where do the daily words come from?',
    a: 'From three curated English vocabulary books uploaded by the FluentDay team. Every word shows its source book and page number, and we never pull vocabulary from random websites.',
  },
  {
    q: 'How long does a daily lesson take?',
    a: 'Most learners finish in 15 to 25 minutes: seven words, two short videos, a quick speaking challenge and a short quiz.',
  },
  {
    q: 'Will I see the same word twice?',
    a: 'Never as a new word. A word only comes back during spaced revision, scheduled to help you remember it for good.',
  },
  {
    q: 'Can FluentDay score my pronunciation?',
    a: 'The Pronunciation Lab uses your browser’s speech recognition to show what it heard you say. That is helpful practice, but it is not a phoneme-level accuracy score — we are honest about that.',
  },
  {
    q: 'Are my notes private?',
    a: 'Yes. Your notebook, progress and quiz history belong only to your account and are protected at the database level.',
  },
  {
    q: 'Does FluentDay cost anything?',
    a: 'No. FluentDay is free, with every feature included. There are no plans, trials or card details.',
  },
]

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading
          align="left"
          eyebrow="FAQ"
          title="Questions, answered"
          description="Anything else? We are always happy to help."
        />
        <Accordion type="single" collapsible className="rounded-3xl bg-card px-6 shadow-soft ring-1 ring-border/60 sm:px-8">
          {faqs.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
