import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ScrollToTop } from '@/components/common/ScrollToTop'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RedirectIfSignedIn, RequireAdmin, RequireAuth } from '@/features/auth/guards'
import { AdminLayout } from '@/layouts/AdminLayout'
import { AppLayout } from '@/layouts/AppLayout'
import { PublicLayout } from '@/layouts/PublicLayout'
import { AdminBooksPage } from '@/pages/admin/AdminBooksPage'
import { AdminOverviewPage } from '@/pages/admin/AdminOverviewPage'
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage'
import { AdminVocabularyPage } from '@/pages/admin/AdminVocabularyPage'
import { AdminYouTubePage } from '@/pages/admin/AdminYouTubePage'
import { DashboardPage } from '@/pages/app/DashboardPage'
import { ListeningPage } from '@/pages/app/ListeningPage'
import { NotebookPage } from '@/pages/app/NotebookPage'
import { NotificationsPage } from '@/pages/app/NotificationsPage'
import { ProgressPage } from '@/pages/app/ProgressPage'
import { PronunciationPage } from '@/pages/app/PronunciationPage'
import { QuizPage } from '@/pages/app/QuizPage'
import { RevisionPage } from '@/pages/app/RevisionPage'
import { SettingsPage } from '@/pages/app/SettingsPage'
import { VocabularyPage } from '@/pages/app/VocabularyPage'
import { WordDetailPage } from '@/pages/app/WordDetailPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { AboutPage } from '@/pages/public/AboutPage'
import { ContactPage } from '@/pages/public/ContactPage'
import { LandingPage } from '@/pages/public/LandingPage'
import { PrivacyPage } from '@/pages/public/PrivacyPage'
import { TermsPage } from '@/pages/public/TermsPage'
import { UnsubscribePage } from '@/pages/public/UnsubscribePage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          <Route path="login" element={<RedirectIfSignedIn><LoginPage /></RedirectIfSignedIn>} />
          <Route path="register" element={<RedirectIfSignedIn><RegisterPage /></RedirectIfSignedIn>} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="unsubscribe" element={<UnsubscribePage />} />

          <Route path="app" element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route index element={<DashboardPage />} />
            <Route path="vocabulary" element={<VocabularyPage />} />
            <Route path="vocabulary/:wordId" element={<WordDetailPage />} />
            <Route path="listening" element={<ListeningPage />} />
            <Route path="pronunciation" element={<PronunciationPage />} />
            <Route path="quiz" element={<QuizPage />} />
            <Route path="notebook" element={<NotebookPage />} />
            <Route path="revision" element={<RevisionPage />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="books" element={<AdminBooksPage />} />
            <Route path="vocabulary" element={<AdminVocabularyPage />} />
            <Route path="youtube" element={<AdminYouTubePage />} />
            <Route path="users" element={<AdminUsersPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
