import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  Eye,
  LockKeyhole,
  Mail,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!supabase || !isSupabaseConfigured) {
      setError('O acesso ainda não foi configurado. Configure as credenciais do Supabase no arquivo .env.local.')
      return
    }

    setLoading(true)
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (loginError) {
      setError('Não foi possível entrar. Verifique seu e-mail e sua senha.')
    }
    setLoading(false)
  }

  return (
    <main className="auth-screen">
      <div className="auth-decoration auth-decoration-one" />
      <div className="auth-decoration auth-decoration-two" />
      <section className="auth-card">
        <div className="auth-brand-mark"><BookOpen size={27} strokeWidth={1.4} /></div>
        <div className="auth-brand">RAZIEL</div>
        <div className="auth-caption">COMPENDIUM OF TALENTS</div>
        <div className="auth-divider"><span>✧</span></div>
        <div className="auth-heading">
          <span className="eyebrow">ACESSO RESTRITO</span>
          <h1>Bem-vindo de volta.</h1>
          <p>Entre para acessar o conhecimento registrado no Compendium.</p>
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
          <label htmlFor="login-email">E-mail</label>
          <div className="auth-input-wrap">
            <Mail size={16} />
            <input id="login-email" type="email" autoComplete="username" placeholder="seu@email.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>

          <label htmlFor="login-password">Senha</label>
          <div className="auth-input-wrap">
            <LockKeyhole size={16} />
            <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Sua senha" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
              <Eye size={16} />
            </button>
          </div>

          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Verificando acesso...' : 'Entrar no Compendium'}
            <ArrowUpRight size={16} />
          </button>
        </form>

        <div className="auth-footnote"><LockKeyhole size={12} />Ambiente de acesso privado</div>
        <div className="novrik-note">Acesso exclusivo Novrik <span>✧</span></div>
      </section>
      <div className="auth-bottom">RAZIEL · COMPENDIUM OF TALENTS</div>
    </main>
  )
}
