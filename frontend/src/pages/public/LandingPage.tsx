import { CallToAction } from '@/features/landing/CallToAction'
import { Faq } from '@/features/landing/Faq'
import { Features } from '@/features/landing/Features'
import { Hero } from '@/features/landing/Hero'
import { HowItWorks } from '@/features/landing/HowItWorks'

export function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <Faq />
      <CallToAction />
    </>
  )
}
