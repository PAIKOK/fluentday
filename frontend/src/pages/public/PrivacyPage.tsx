import { InfoPage } from './InfoPage'

export function PrivacyPage() {
  return (
    <InfoPage title="Privacy Policy" intro="Draft — to be reviewed before public launch. Your learning data is yours.">
      <section>
        <h2>What we collect</h2>
        <p>
          Your account details (name, email), learning preferences, and the learning activity you create: progress,
          quiz results and notebook entries.
        </p>
      </section>
      <section>
        <h2>How we use it</h2>
        <p>
          Only to run FluentDay: preparing your daily lessons, scheduling revision and showing your progress. We do not
          sell your data.
        </p>
      </section>
      <section>
        <h2>Notifications</h2>
        <p>We only send email or push reminders if you turn them on, and you can turn them off at any time.</p>
      </section>
    </InfoPage>
  )
}
