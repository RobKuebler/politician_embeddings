export function Footer() {
  return (
    <footer className="text-center text-xs text-gray-400 py-8 mt-8">
      von{' '}
      <a href="https://robkuebler.github.io" className="underline hover:text-gray-600">
        Robert Kübler
      </a>{' '}
      | Code auf{' '}
      <a href="https://github.com/RobKuebler/politician_embeddings" className="underline hover:text-gray-600">
        GitHub
      </a>{' '}
      | Daten von{' '}
      <a href="https://www.abgeordnetenwatch.de" className="underline hover:text-gray-600">
        abgeordnetenwatch.de
      </a>
    </footer>
  )
}
