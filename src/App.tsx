import { ChangeEvent, FormEvent, useState } from 'react'
import { confirmSignUp, signIn, signUp } from './auth'

type Person = { name: string; profile: string; photoUrl?: string }
type Project = { groom: Person; bride: Person; template: string }

const templates = [
  { id: 'warm', name: 'あたたかい日', color: '#d7a084' },
  { id: 'green', name: '和やか', color: '#a7ad91' },
  { id: 'simple', name: 'ふたりらしく', color: '#d8d0c4' },
]

function AuthScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'confirm'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    setBusy(true)
    try {
      if (mode === 'login') {
        onLogin(await signIn(email, password))
      } else if (mode === 'signup') {
        await signUp(email, password)
        setMode('confirm')
        setMessage('確認コードをメールで送信しました。')
      } else {
        await confirmSignUp(email, code)
        setMode('login')
        setMessage('登録が完了しました。ログインしてください。')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '処理に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-page"><div className="auth-card"><div className="logo">M</div><small>WEDDING MEETING SHIORI</small><h1>顔合わせのしおり</h1><p>{mode === 'confirm' ? 'メールに届いた確認コードを入力してください。' : 'ふたりの紹介しおりを作成しましょう。'}</p><form onSubmit={submit}>{mode === 'confirm' ? <label>確認コード<input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" required /></label> : <><label>メールアドレス<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>パスワード<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label></>}<button className="primary" disabled={busy} type="submit">{busy ? '処理中…' : mode === 'login' ? 'ログイン' : mode === 'signup' ? 'アカウントを作成' : '確認する'}</button></form>{message && <p className="auth-message">{message}</p>}{mode !== 'confirm' && <button className="auth-link" type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? '初めての方はこちら' : 'ログインに戻る'}</button>}</div></main>
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('marriage-shiori-id-token'))
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [project, setProject] = useState<Project>({
    groom: { name: '', profile: '' },
    bride: { name: '', profile: '' },
    template: 'warm',
  })

  const updatePerson = (person: 'groom' | 'bride', field: 'name' | 'profile', value: string) => {
    setProject((current) => ({ ...current, [person]: { ...current[person], [field]: value } }))
  }

  const updatePhoto = (person: 'groom' | 'bride', event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) setProject((current) => ({ ...current, [person]: { ...current[person], photoUrl: URL.createObjectURL(file) } }))
  }

  const saveProject = async () => {
    if (!token) return
    setSaving(true)
    setSaveMessage('')
    try {
      const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/projects`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(project),
      })
      if (response.status === 401) {
        localStorage.removeItem('marriage-shiori-id-token')
        setToken(null)
        return
      }
      if (!response.ok) throw new Error('保存に失敗しました。')
      const saved = await response.json()
      setSaveMessage(`保存しました（ID: ${saved.projectId.slice(0, 8)}…）`)
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : '保存に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  if (!token) return <AuthScreen onLogin={(nextToken) => { localStorage.setItem('marriage-shiori-id-token', nextToken); setToken(nextToken) }} />

  return (
    <main className="shell">
      <header><div className="logo">M</div><div><small>WEDDING MEETING SHIORI</small><h1>顔合わせのしおり</h1></div><span className="save-message">{saveMessage}</span><button className="save" onClick={saveProject} disabled={saving}>{saving ? '保存中…' : '保存する'}</button><button className="logout" onClick={() => { localStorage.removeItem('marriage-shiori-id-token'); setToken(null) }}>ログアウト</button></header>
      <section className="intro"><small>STEP 01 / 03</small><h2>ふたりのことを教えてください</h2><p>顔合わせの日に、お互いの家族へ渡す小さなしおりを作ります。</p></section>
      <div className="layout">
        <section className="panel">
          <div className="heading"><div><small>DESIGN</small><h3>テンプレートを選ぶ</h3></div><span>01</span></div>
          <div className="templates">{templates.map((template) => <button className={project.template === template.id ? 'template selected' : 'template'} key={template.id} onClick={() => setProject((current) => ({ ...current, template: template.id }))} type="button"><i style={{ background: template.color }} /><strong>{template.name}</strong><small>写真と文章を美しくまとめるデザイン</small></button>)}</div>
          <div className="heading next"><div><small>PROFILE</small><h3>ふたりのプロフィール</h3></div><span>02</span></div>
          <div className="people">{(['groom', 'bride'] as const).map((person) => <article key={person}><b>{person === 'groom' ? '新郎' : '新婦'}</b><label>お名前<input value={project[person].name} onChange={(event) => updatePerson(person, 'name', event.target.value)} placeholder={person === 'groom' ? '山田 太郎' : '佐藤 花子'} /></label><label>自己紹介<textarea value={project[person].profile} onChange={(event) => updatePerson(person, 'profile', event.target.value)} placeholder="仕事や好きなことなど" rows={4} /></label><label className="upload">{project[person].photoUrl ? '写真を変更する' : '顔写真を追加する'}<input type="file" accept="image/png,image/jpeg" onChange={(event) => updatePhoto(person, event)} /></label></article>)}</div>
        </section>
        <section className="panel preview-panel"><div className="heading"><div><small>PREVIEW</small><h3>仕上がりイメージ</h3></div><span>A4</span></div><div className={`paper ${project.template}`}><small>OUR FAMILY MEETING</small><h4>はじめまして</h4><p>本日はお越しいただき、ありがとうございます。<br />これからどうぞよろしくお願いいたします。</p><div className="preview-people">{(['groom', 'bride'] as const).map((person) => <div key={person}><div className="photo">{project[person].photoUrl ? <img src={project[person].photoUrl} /> : 'PHOTO'}</div><span>{project[person].name || (person === 'groom' ? '新郎のお名前' : '新婦のお名前')}</span></div>)}</div><hr /><strong>ふたりのプロフィール</strong><p>{project.groom.profile || 'ふたりのことを紹介する文章がここに入ります。'}</p><footer>With love, today and always.</footer></div><button className="primary" type="button">プレビューを保存する</button></section>
      </div>
    </main>
  )
}

export default App
