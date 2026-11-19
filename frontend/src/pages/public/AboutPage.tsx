import { InfoPage } from './InfoPage'

export function AboutPage() {
  return (
    <InfoPage
      title="About FluentDay"
      intro="FluentDay helps people build confident English through a small, steady daily routine."
    >
      <section>
        <h2>Why small steps?</h2>
        <p>
          Fluency comes from regular practice, not occasional marathons. A few focused minutes every day — new words,
          real listening and a little speaking — add up to lasting progress.
        </p>
      </section>
      <section>
        <h2>Trustworthy content</h2>
        <p>
          Vocabulary comes from a curated list of the most useful everyday English words, with the source shown for every word.
          Listening lessons come from respected channels such as BBC Learning English. Where we use AI to add extra
          examples, we label it clearly.
        </p>
      </section>
    </InfoPage>
  )
}
