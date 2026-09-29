import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { confirmSignUp, signIn, signUp } from './auth'

type Person = { name: string; profile: string; photoKey?: string; photoUrl?: string }
type Project = { groom: Person; bride: Person; template: string }

const templates = [
  { id: 'warm', name: 'あたたかい日', color: '#d7a084' },
  { id: 'green', name: '和やか', color: '#a7ad91' },
  { id: 'simple', name: 'ふたりらしく', color: '#d8d0c4' },
]

const initialProject: Project = { groom: { name: '', profile: '' }, bride: { name: '', profile: '' }, template: 'warm' }

function AuthScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'confirm'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      if (mode === 'login') onLogin(await signIn(email, password))
      else if (mode === 'signup') { await signUp(email, password); setMode('confirm'); setMessage('確認コードをメールで送信しました。') }
      else { await confirmSignUp(email, code); setMode('login'); setMessage('登録が完了しました。ログインしてください。') }
    } catch (error) { setMessage(error instanceof Error ? error.message : '処理に失敗しました。') }
    finally { setBusy(false) }
  }

  return <main className="auth-page"><div className="auth-card"><div className="logo">M</div><small>WEDDING MEETING SHIORI</small><h1>顔合わせのしおり</h1><p>{mode === 'confirm' ? 'メールに届いた確認コードを入力してください。' : 'ふたりの紹介しおりを作成しましょう。'}</p><form onSubmit={submit}>{mode === 'confirm' ? <label>確認コード<input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" required /></label> : <><label>メールアドレス<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>パスワード<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label></>}<button className="primary" disabled={busy} type="submit">{busy ? '処理中…' : mode === 'login' ? 'ログイン' : mode === 'signup' ? 'アカウントを作成' : '確認する'}</button></form>{message && <p className="auth-message">{message}</p>}{mode !== 'confirm' && <button className="auth-link" type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? '初めての方はこちら' : 'ログインに戻る'}</button>}</div></main>
}

function AppComplete() {
  const [token, setToken] = useState(() => localStorage.getItem('marriage-shiori-id-token'))
  const [projectId, setProjectId] = useState<string>()
  const [draftId] = useState(() => crypto.randomUUID())
  const [project, setProject] = useState<Project>(initialProject)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const api = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init?.headers || {}) } })
    if (response.status === 401) { localStorage.removeItem('marriage-shiori-id-token'); setToken(null); throw new Error('ログインの有効期限が切れました。') }
    if (!response.ok) throw new Error(await response.text())
    return response.json()
  }

  useEffect(() => {
    if (!token) return
    setLoading(true)
    api('/projects').then(async (data) => {
      const latest = data.projects?.[0]
      if (!latest) return
      setProjectId(latest.projectId)
      const saved = latest.project as Project
      for (const person of ['groom', 'bride'] as const) {
        if (saved[person].photoKey) {
          const result = await api('/download-url', { method: 'POST', body: JSON.stringify({ key: saved[person].photoKey }) })
          saved[person].photoUrl = result.downloadUrl
        }
      }
      setProject(saved)
      setMessage('保存済みのしおりを読み込みました。')
    }).catch(() => undefined).finally(() => setLoading(false))
  }, [token])

  const updatePerson = (person: 'groom' | 'bride', field: 'name' | 'profile', value: string) => setProject((current) => ({ ...current, [person]: { ...current[person], [field]: value } }))

  const uploadPhoto = async (person: 'groom' | 'bride', event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true); setMessage('写真をアップロード中…')
    try {
      const preview = URL.createObjectURL(file)
      const { uploadUrl, key } = await api('/upload-url', { method: 'POST', body: JSON.stringify({ projectId: draftId, contentType: file.type }) })
      const upload = await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': file.type }, body: file })
      if (!upload.ok) throw new Error('写真のアップロードに失敗しました。')
      setProject((current) => ({ ...current, [person]: { ...current[person], photoUrl: preview, photoKey: key } }))
      setMessage('写真をアップロードしました。保存ボタンでしおりに反映します。')
    } catch (error) { setMessage(error instanceof Error ? error.message : '写真のアップロードに失敗しました。') }
    finally { setBusy(false) }
  }

  const saveProject = async () => {
    setBusy(true); setMessage('保存中…')
    const body = JSON.stringify({ ...project, groom: { ...project.groom, photoUrl: undefined }, bride: { ...project.bride, photoUrl: undefined } })
    try {
      const result = await api(projectId ? `/projects/${projectId}` : '/projects', { method: projectId ? 'PUT' : 'POST', body })
      setProjectId(result.projectId)
      setMessage('しおりを保存しました。')
    } catch (error) { setMessage(error instanceof Error ? error.message : '保存に失敗しました。') }
    finally { setBusy(false) }
  }

  if (!token) return <AuthScreen onLogin={(nextToken) => { localStorage.setItem('marriage-shiori-id-token', nextToken); setToken(nextToken) }} />

  return <main className="shell"><header><div className="logo">M</div><div><small>WEDDING MEETING SHIORI</small><h1>顔合わせのしおり</h1></div><span className="save-message">{loading ? '読み込み中…' : message}</span><button className="save" onClick={saveProject} disabled={busy}>{busy ? '処理中…' : '保存する'}</button><button className="print-button" onClick={() => window.print()} type="button">PDF出力</button><button className="logout" onClick={() => { localStorage.removeItem('marriage-shiori-id-token'); setToken(null) }}>ログアウト</button></header><section className="intro"><small>STEP 01 / 03</small><h2>ふたりのことを教えてください</h2><p>顔合わせの日に、お互いの家族へ渡す小さなしおりを作ります。</p></section><div className="layout"><section className="panel editor-panel"><div className="heading"><div><small>DESIGN</small><h3>テンプレートを選ぶ</h3></div><span>01</span></div><div className="templates">{templates.map((template) => <button className={project.template === template.id ? 'template selected' : 'template'} key={template.id} onClick={() => setProject((current) => ({ ...current, template: template.id }))} type="button"><i style={{ background: template.color }} /><strong>{template.name}</strong><small>写真と文章を美しくまとめるデザイン</small></button>)}</div><div className="heading next"><div><small>PROFILE</small><h3>ふたりのプロフィール</h3></div><span>02</span></div><div className="people">{(['groom', 'bride'] as const).map((person) => <article key={person}><b>{person === 'groom' ? '新郎' : '新婦'}</b><label>お名前<input value={project[person].name} onChange={(event) => updatePerson(person, 'name', event.target.value)} placeholder={person === 'groom' ? '山田 太郎' : '佐藤 花子'} /></label><label>自己紹介<textarea value={project[person].profile} onChange={(event) => updatePerson(person, 'profile', event.target.value)} placeholder="仕事や好きなことなど" rows={4} /></label><label className="upload">{project[person].photoUrl ? '写真を変更する' : '顔写真を追加する'}<input type="file" accept="image/png,image/jpeg" onChange={(event) => uploadPhoto(person, event)} /></label></article>)}</div></section><section className="panel preview-panel"><div className="heading"><div><small>PREVIEW</small><h3>仕上がりイメージ</h3></div><span>A4</span></div><div className={`paper ${project.template}`}><small>OUR FAMILY MEETING</small><h4>はじめまして</h4><p>本日はお越しいただき、ありがとうございます。<br />これからどうぞよろしくお願いいたします。</p><div className="preview-people">{(['groom', 'bride'] as const).map((person) => <div key={person}><div className="photo">{project[person].photoUrl ? <img src={project[person].photoUrl} alt="プロフィール写真" /> : 'PHOTO'}</div><span>{project[person].name || (person === 'groom' ? '新郎のお名前' : '新婦のお名前')}</span></div>)}</div><hr /><strong>ふたりのプロフィール</strong><p>{project.groom.profile || 'ふたりのことを紹介する文章がここに入ります。'}</p><footer>With love, today and always.</footer></div></section></div></main>
}

export default AppComplete
