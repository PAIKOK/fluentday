import { InfoPage } from './InfoPage'

export function TermsPage() {
  return (
    <InfoPage title="Terms of Service" intro="Draft — to be reviewed before public launch.">
      <section>
        <h2>Your account</h2>
        <p>Keep your login details safe. You are responsible for activity on your account.</p>
      </section>
      <section>
        <h2>Cost</h2>
        <p>FluentDay is free to use. We never ask for payment or card details.</p>
      </section>
      <section>
        <h2>Content</h2>
        <p>
          Lesson content is for your personal learning only. Videos remain the property of their creators and are shown
          through the official YouTube player.
        </p>
      </section>
    </InfoPage>
  )
}
