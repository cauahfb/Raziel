type AdminPlaceholderProps = {
  title: 'Histórico Administrativo' | 'Backup'
  description: string
  status: string
}

export default function AdminPlaceholder({ title, description, status }: AdminPlaceholderProps) {
  return (
    <section className="admin-page-placeholder">
      <div className="eyebrow"><span className="eyebrow-line" />ÁREA ADMINISTRATIVA</div>
      <h1>{title}</h1>
      <p>{description}</p>
      <span>{status}</span>
    </section>
  )
}
