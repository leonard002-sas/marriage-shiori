import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { AuthScreen } from './AppComplete'

type Person = { name: string; profile: string; photoKey?: string; photoUrl?: string }
type FamilyMember = { id: string; relation: string; name: string; introduction: string }
type Project = { groom: Person; bride: Person; template: string; families: { groom: FamilyMember[]; bride: FamilyMember[] } }

const templates = [
  ['editorial', 'The Edit', '雑誌のような余白と大胆なタイポグラフィ'],
  ['botanical', 'Botanical Notes', '花と手紙を思わせるやわらかな装丁'],
  ['ryokan', '縁 - en -', '和紙、組紐、家紋のような静かな佇まい'],
  ['gallery', 'Gallery Day', '現代美術館の展示冊子のような構成'],
  ['film', 'Our Film', 'フィルム写真とキャプションの思い出感'],
  ['linen', 'Linen Table', '食卓を囲むリネンと手書きメニューの雰囲気'],
  ['garden', 'Garden Party', 'ガーデンウェディングの招待状のような軽やかさ'],
  ['artdeco', 'Golden Hour', 'アールデコのフレームと華やかな文字組み'],
  ['coastal', 'Sea & Sky', '旅のしおりのような青と余白のあるデザイン'],
  ['monochrome', 'Black Tie', 'モノクロ写真集のような端正なレイアウト'],
] as const

const blankProject: Project = { groom: { name: '', profile: '' }, bride: { name: '', profile: '' }, template: 'editorial', families: { groom: [], bride: [] } }
const relations = ['父', '母', '兄', '姉', '弟', '妹', '兄弟姉妹の配偶者', 'お子さん', 'その他']

const serialize = (project: Project) => ({ ...project, groom: { ...project.groom, photoUrl: undefined }, bride: { ...project.bride, photoUrl: undefined } })

function FamilyForm({ side, members, onChange }: { side: 'groom' | 'bride'; members: FamilyMember[]; onChange: (members: FamilyMember[]) => void }) {
  const title = side === 'groom' ? '新郎ご家族' : '新婦ご家族'
  const add = () => onChange([...members, { id: crypto.randomUUID(), relation: '父', name: '', introduction: '' }])
  return <section className="family-form"><div className="family-form-title"><div><small>FAMILY</small><h3>{title}を紹介する</h3><p>ご両親、兄弟姉妹、ご家族などを自由に追加できます。</p></div><button className="add-member" type="button" onClick={add}>＋ 家族を追加</button></div>{members.length === 0 ? <div className="empty-family">「家族を追加」から紹介したい方を登録できます。</div> : <div className="member-fields">{members.map((member, index) => <article className="member-field" key={member.id}><div className="member-count">{String(index + 1).padStart(2, '0')}</div><label>続柄<select value={member.relation} onChange={(event) => onChange(members.map((item) => item.id === member.id ? { ...item, relation: event.target.value } : item))}>{relations.map((relation) => <option key={relation}>{relation}</option>)}</select></label><label>お名前<input value={member.name} onChange={(event) => onChange(members.map((item) => item.id === member.id ? { ...item, name: event.target.value } : item))} placeholder="山田 恒一" /></label><label className="member-intro">紹介文<textarea value={member.introduction} onChange={(event) => onChange(members.map((item) => item.id === member.id ? { ...item, introduction: event.target.value } : item))} rows={3} placeholder="趣味や人柄、ふたりとの関係など" /></label><button className="remove-member" type="button" onClick={() => onChange(members.filter((item) => item.id !== member.id))}>削除</button></article>)}</div>}</section>
}

function AppFamily() {
  const [token, setToken] = useState(() => localStorage.getItem('marriage-shiori-id-token'))
  const [projectId, setProjectId] = useState<string>()
  const [draftId] = useState(() => crypto.randomUUID())
  const [project, setProject] = useState<Project>(blankProject)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const selected = useMemo(() => templates.find(([id]) => id === project.template) ?? templates[0], [project.template])

  const api = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init?.headers || {}) } })
    if (response.status === 401) { localStorage.removeItem('marriage-shiori-id-token'); setToken(null); throw new Error('ログインの有効期限が切れました。') }
    if (!response.ok) throw new Error(await response.text())
    return response.json()
  }

  useEffect(() => { if (!token) return; api('/projects').then(async ({ projects }) => { const latest = projects?.[0]; if (!latest) return; const saved = latest.project as Project; saved.families ||= { groom: [], bride: [] }; for (const side of ['groom', 'bride'] as const) if (saved[side].photoKey) { const { downloadUrl } = await api('/download-url', { method: 'POST', body: JSON.stringify({ key: saved[side].photoKey }) }); saved[side].photoUrl = downloadUrl } setProject(saved); setProjectId(latest.projectId); setMessage('保存済みのしおりを読み込みました。') }).catch(() => undefined) }, [token])

  const updatePerson = (side: 'groom' | 'bride', field: 'name' | 'profile', value: string) => setProject((current) => ({ ...current, [side]: { ...current[side], [field]: value } }))
  const uploadPhoto = async (side: 'groom' | 'bride', event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; setBusy(true); try { const preview = URL.createObjectURL(file); const { uploadUrl, key } = await api('/upload-url', { method: 'POST', body: JSON.stringify({ projectId: draftId, contentType: file.type }) }); const upload = await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': file.type }, body: file }); if (!upload.ok) throw new Error('写真のアップロードに失敗しました。'); setProject((current) => ({ ...current, [side]: { ...current[side], photoKey: key, photoUrl: preview } })); setMessage('写真をアップロードしました。') } catch (error) { setMessage(error instanceof Error ? error.message : '写真をアップロードできませんでした。') } finally { setBusy(false) } }
  const save = async () => { setBusy(true); try { const result = await api(projectId ? `/projects/${projectId}` : '/projects', { method: projectId ? 'PUT' : 'POST', body: JSON.stringify(serialize(project)) }); setProjectId(result.projectId); setMessage('しおりを保存しました。') } catch (error) { setMessage(error instanceof Error ? error.message : '保存に失敗しました。') } finally { setBusy(false) } }

  if (!token) return <AuthScreen onLogin={(nextToken) => { localStorage.setItem('marriage-shiori-id-token', nextToken); setToken(nextToken) }} />
  return <main className="family-app"><header className="family-header"><div className="brand"><div className="logo">M</div><div><small>WEDDING FAMILY BOOK</small><h1>顔合わせのしおり</h1></div></div><span className="save-message">{message}</span><button className="save" disabled={busy} onClick={save}>{busy ? '処理中…' : '保存する'}</button><button className="print-button" type="button" onClick={() => window.print()}>PDF出力</button><button className="logout" onClick={() => { localStorage.removeItem('marriage-shiori-id-token'); setToken(null) }}>ログアウト</button></header><section className="family-intro"><small>MAKE YOUR FAMILY BOOK</small><h2>ふたりと、これから家族になる<br />みなさまの紹介を一冊に。</h2><p>表紙、ふたりのページ、ご両家の紹介ページをまとめてPDFにできます。</p></section><div className="family-layout"><section className="family-editor"><div className="editor-section"><div className="section-title"><div><small>01 / TEMPLATE</small><h3>デザインを選ぶ</h3></div><p>10 STYLES</p></div><div className="template-gallery">{templates.map(([id, name, description]) => <button key={id} type="button" onClick={() => setProject((current) => ({ ...current, template: id }))} className={`template-option ${id} ${project.template === id ? 'selected' : ''}`}><span className="template-art"><i /><b /></span><strong>{name}</strong><small>{description}</small></button>)}</div></div><div className="editor-section couple-section"><div className="section-title"><div><small>02 / COUPLE</small><h3>ふたりを紹介する</h3></div></div><div className="couple-fields">{(['groom', 'bride'] as const).map((side) => <article key={side} className="couple-field"><b>{side === 'groom' ? '新郎' : '新婦'}</b><label>お名前<input value={project[side].name} onChange={(event) => updatePerson(side, 'name', event.target.value)} placeholder={side === 'groom' ? '山田 太郎' : '佐藤 花子'} /></label><label>自己紹介<textarea value={project[side].profile} onChange={(event) => updatePerson(side, 'profile', event.target.value)} rows={4} placeholder="仕事や好きなこと、家族へのひとこと" /></label><label className="upload">{project[side].photoUrl ? '写真を変更する' : '顔写真を追加する'}<input type="file" accept="image/png,image/jpeg" onChange={(event) => uploadPhoto(side, event)} /></label></article>)}</div></div><FamilyForm side="groom" members={project.families.groom} onChange={(members) => setProject((current) => ({ ...current, families: { ...current.families, groom: members } }))} /><FamilyForm side="bride" members={project.families.bride} onChange={(members) => setProject((current) => ({ ...current, families: { ...current.families, bride: members } }))} /></section><section className="book-preview"><div className="preview-head"><small>LIVE PREVIEW</small><span>{selected[1]} / 4 PAGES</span></div><div className={`book ${project.template}`}><article className="book-page cover"><div className="cover-mark">M</div><p className="cover-label">FAMILY MEETING BOOK</p><h2>{project.groom.name || '新郎'}<em>&amp;</em>{project.bride.name || '新婦'}</h2><div className="cover-line" /><p className="cover-date">OUR FIRST FAMILY DAY</p><div className="cover-shape" /></article><article className="book-page couple-page"><p className="page-number">01 / OUR STORY</p><h2>ふたりのこと</h2><div className="couple-spread">{(['groom', 'bride'] as const).map((side) => <div key={side} className="profile-card"><div className="book-photo">{project[side].photoUrl ? <img src={project[side].photoUrl} alt="" /> : <span>PHOTO</span>}</div><p className="relation">{side === 'groom' ? 'GROOM' : 'BRIDE'}</p><h3>{project[side].name || (side === 'groom' ? '新郎のお名前' : '新婦のお名前')}</h3><p>{project[side].profile || 'ここに自己紹介文が入ります。'}</p></div>)}</div></article><FamilyPage side="groom" members={project.families.groom} name={project.groom.name} /><FamilyPage side="bride" members={project.families.bride} name={project.bride.name} /></div></section></div></main>
}

function FamilyPage({ side, members, name }: { side: 'groom' | 'bride'; members: FamilyMember[]; name: string }) { return <article className="book-page relatives-page"><p className="page-number">{side === 'groom' ? '02' : '03'} / FAMILY</p><h2>{name || (side === 'groom' ? '新郎' : '新婦')}の家族</h2><p className="family-lead">これからどうぞよろしくお願いいたします。</p><div className="relative-grid">{members.length ? members.map((member) => <div className="relative-card" key={member.id}><span>{member.relation}</span><h3>{member.name || 'お名前'}</h3><p>{member.introduction || '紹介文がここに入ります。'}</p></div>) : <div className="relative-empty">ご家族の紹介を追加すると、このページに表示されます。</div>}</div></article> }

export default AppFamily
