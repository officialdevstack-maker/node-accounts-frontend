import { Link } from 'react-router-dom'

const pages = {
  terms: {
    title: 'Terms of Service',
    description: 'Terms for using your Spurs account will be published here.',
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'Information about how your account data is handled will be published here.',
  },
  help: {
    title: 'Help',
    description: 'For help with your Spurs account, contact your organization’s support team.',
  },
}

type InfoPageName = keyof typeof pages

const InfoPage = ({ page }: { page: InfoPageName }) => {
  const content = pages[page]

  return (
    <main className="grid min-h-screen place-items-center bg-primary px-6">
      <section className="card flex max-w-lg flex-col gap-4 p-8">
        <h1 className="text-2xl font-semibold">{content.title}</h1>
        <p className="text-sm leading-relaxed text-gray-600">{content.description}</p>
        <Link to="/login" className="text-sm font-medium text-blue-600 hover:underline">
          Back to sign in
        </Link>
      </section>
    </main>
  )
}

export default InfoPage
