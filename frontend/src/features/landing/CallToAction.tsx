import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CallToAction() {
  return (
    <section className="px-5 pb-20 sm:px-8 sm:pb-24">
      <div className="mx-auto max-w-6xl rounded-3xl bg-forest px-6 py-14 text-center sm:px-12 sm:py-16">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">Small steps today. Fluent English tomorrow.</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-sage">Your first lesson is ready when you are.</p>
        <Button size="lg" variant="secondary" className="mt-8" asChild>
          <Link to="/register">
            Start Learning <ArrowRight />
          </Link>
        </Button>
      </div>
    </section>
  )
}
