import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { AuthScreen } from './AppComplete'

type Side = 'groom' | 'bride'
type Person = { name: string; profile: string; photoKey?: string; photoUrl?: string }
type FamilyMember = { id: string; relation: string; name: string; introduction: string }
type Field = 'date' | 'venue' | 'address' | 'greeting' | 'schedule' | 'menu' | 'story' | 'message' | 'dressCode' | 'gift' | 'proposal' | 'pottery'
type BookTemplate = { id: string; name: string; genre: string; description: string; layout: 'brochure' | 'menu' | 'album' | 'family-tree' | 'guide' | 'newspaper'; fields: Field[]; pages: string[] }
type Project = { template?: string; groom: Person; bride: Person; content: Record<Field, string>; families: Record<Side, FamilyMember[]> }

const fields: Record<Field, { label: string; placeholder: string; rows?: number }> = {
  date: { label: '開催日・時間', placeholder: '2026.05.24 SUN　11:30 —' }, venue: { label: '会場名', placeholder: 'Restaurant Aoi' }, address: { label: '会場案内・住所', placeholder: '東京都〇〇区…／最寄駅から徒歩5分' },
  greeting: { label: 'ご挨拶', placeholder: '本日はお集まりいただき、ありがとうございます。', rows: 4 }, schedule: { label: '当日の流れ', placeholder: '11:30　はじまりのご挨拶\n12:00　お食事・ご歓談\n14:00　記念撮影', rows: 5 },
  menu: { label: 'お品書き', placeholder: '季節の前菜\n本日のお魚料理\nお肉料理\nデザート', rows: 5 }, story: { label: 'ふたりのストーリー', placeholder: '出会い／お付き合い／プロポーズなど、ふたりらしい出来事', rows: 5 },
  message: { label: 'ご家族へのメッセージ', placeholder: 'これからどうぞよろしくお願いいたします。', rows: 4 }, dressCode: { label: '当日のご案内', placeholder: 'お車でお越しの方へ／服装について など', rows: 3 }, gift: { label: '手土産・記念品', placeholder: '本日の記念に…', rows: 3 },
  proposal: { label: 'ひまわり畑でのプロポーズ', placeholder: '場所、日付、その日に交わした言葉、心に残った景色を綴ります。', rows: 5 }, pottery: { label: '陶芸体験の思い出', placeholder: '作ったもの、うまくできなかったこと、二人で笑ったことを綴ります。', rows: 5 },
}

const templates: BookTemplate[] = [
  { id: 'botanical-brochure', name: 'Botanical Table', genre: '三つ折りパンフレット', description: '草花と余白で作る、やわらかな食事会の案内。', layout: 'brochure', fields: ['date', 'venue', 'greeting', 'schedule', 'menu', 'message'], pages: ['表紙', 'ご挨拶', 'プロフィール', 'ご家族紹介'] },
  { id: 'modern-mizuhiki', name: '結 - Yui -', genre: '和モダン二つ折り', description: '水引と朱色、両家を結ぶ静かな一冊。', layout: 'family-tree', fields: ['date', 'venue', 'greeting', 'schedule', 'gift', 'message'], pages: ['表紙', '会の流れ', '家系図', 'ご挨拶'] },
  { id: 'restaurant-course', name: 'The Course', genre: 'レストランメニュー', description: 'お品書きから始まる、上質な食事会のしおり。', layout: 'menu', fields: ['date', 'venue', 'menu', 'schedule', 'greeting', 'address'], pages: ['表紙', 'お品書き', 'タイムライン', 'ご家族紹介'] },
  { id: 'photo-journal', name: 'Our Daybook', genre: '写真アルバム', description: '写真、年表、家族の言葉を綴じる記念冊子。', layout: 'album', fields: ['date', 'venue', 'story', 'message', 'schedule'], pages: ['表紙', 'ふたりの記録', 'プロフィール', '家族アルバム'] },
  { id: 'quiet-letter', name: 'A Quiet Letter', genre: 'ミニマル招待状', description: '白い紙と美しい文字だけで伝える、端正な案内。', layout: 'guide', fields: ['date', 'venue', 'address', 'greeting', 'dressCode'], pages: ['表紙', 'ご案内', '会場', 'ご挨拶'] },
  { id: 'travel-notes', name: 'First Family Trip', genre: '旅のしおり', description: '出会いから当日までを旅程のようにたどる。', layout: 'guide', fields: ['date', 'venue', 'story', 'schedule', 'address', 'message'], pages: ['表紙', '旅程', 'ふたりの物語', 'ご家族紹介'] },
  { id: 'komon-family', name: '小紋のしおり', genre: '和紙・家系図', description: '小紋と家紋風モチーフでつくる両家の紹介。', layout: 'family-tree', fields: ['date', 'venue', 'greeting', 'gift', 'message'], pages: ['表紙', 'ご挨拶', '両家のご紹介', '結び'] },
  { id: 'handwritten', name: 'Our Favourite People', genre: '手描きブック', description: '気軽なイラストと会話ネタで距離を近づける。', layout: 'album', fields: ['date', 'venue', 'story', 'schedule', 'message'], pages: ['表紙', 'ふたりのこと', 'みんなのこと', '当日の流れ'] },
  { id: 'hotel-classic', name: 'The Grand Table', genre: 'ホテルクラシック', description: '深緑と金で整える、格式ある食事会の案内状。', layout: 'menu', fields: ['date', 'venue', 'menu', 'greeting', 'dressCode'], pages: ['表紙', 'お品書き', 'ご挨拶', 'ご家族紹介'] },
  { id: 'collage-book', name: 'Family Album', genre: '写真コラージュ', description: '大切な写真を主役に、家族のページをつくる。', layout: 'album', fields: ['date', 'venue', 'story', 'message', 'gift'], pages: ['表紙', '思い出', 'ふたり', 'ご家族紹介'] },
  { id: 'gallery-zine', name: 'Gallery Day', genre: 'アート冊子', description: '色面とグリッドで見せる、現代的なプロフィール。', layout: 'newspaper', fields: ['date', 'venue', 'story', 'schedule', 'message'], pages: ['表紙', '特集：ふたり', '家族紹介', '案内'] },
  { id: 'watercolor-letter', name: 'Watercolor Letter', genre: '水彩レター', description: 'にじむ色と手紙のような言葉で伝える一冊。', layout: 'guide', fields: ['date', 'venue', 'greeting', 'message', 'address'], pages: ['表紙', '手紙', '会場案内', 'ご家族紹介'] },
  { id: 'sunday-table', name: 'Sunday Table', genre: 'カジュアル食卓', description: 'あたたかな食卓と、みんなで囲む時間のために。', layout: 'menu', fields: ['date', 'venue', 'menu', 'schedule', 'message'], pages: ['表紙', 'お品書き', '今日の流れ', 'ご家族紹介'] },
  { id: 'nordic-guide', name: 'North Light', genre: '北欧ミニマル', description: '淡い色と幾何学で、軽やかに案内するしおり。', layout: 'guide', fields: ['date', 'venue', 'schedule', 'address', 'greeting'], pages: ['表紙', 'ご案内', 'タイムライン', 'ご家族紹介'] },
  { id: 'family-times', name: 'The Family Times', genre: 'ヴィンテージ新聞', description: 'ふたりと家族のニュースを読むように楽しむ。', layout: 'newspaper', fields: ['date', 'venue', 'story', 'greeting', 'schedule', 'gift'], pages: ['一面', 'ふたりのニュース', '家族欄', '当日案内'] },
  { id: 'sunflower-promise', name: 'ひまわりの約束', genre: '思い出を綴じるA5冊子', description: 'ひまわり畑のプロポーズと陶芸の一日を、やわらかな絵とともに残す。', layout: 'album', fields: ['date', 'venue', 'greeting', 'proposal', 'pottery', 'message'], pages: ['ひまわりの表紙', 'ご挨拶', 'プロポーズ', '陶芸の一日', 'ふたり', 'ご家族紹介', '結び'] },
]

const blank = (): Project => ({ groom: { name: '', profile: '' }, bride: { name: '', profile: '' }, content: Object.fromEntries(Object.keys(fields).map((key) => [key, ''])) as Record<Field, string>, families: { groom: [], bride: [] } })
const relations = ['父', '母', '兄', '姉', '弟', '妹', '兄弟姉妹の配偶者', 'お子さん', 'その他']
const text = (project: Project, field: Field) => project.content[field] || fields[field].placeholder
const serialize = (project: Project) => ({ ...project, groom: { ...project.groom, photoUrl: undefined }, bride: { ...project.bride, photoUrl: undefined } })

function FamilyForm({ side, project, setProject }: { side: Side; project: Project; setProject: (project: Project) => void }) {
  const members = project.families[side]
  const replace = (next: FamilyMember[]) => setProject({ ...project, families: { ...project.families, [side]: next } })
  return <section className="form-card family-form"><div className="form-heading"><div><small>FAMILY</small><h3>{side === 'groom' ? '新郎側のご家族' : '新婦側のご家族'}</h3><p>紹介したい方だけを、順番も自由に登録できます。</p></div><button type="button" onClick={() => replace([...members, { id: crypto.randomUUID(), relation: '父', name: '', introduction: '' }])}>＋ 追加</button></div>{members.map((member, index) => <div className="member-row" key={member.id}><span>{String(index + 1).padStart(2, '0')}</span><select value={member.relation} onChange={(e) => replace(members.map((x) => x.id === member.id ? { ...x, relation: e.target.value } : x))}>{relations.map((relation) => <option key={relation}>{relation}</option>)}</select><input value={member.name} placeholder="お名前" onChange={(e) => replace(members.map((x) => x.id === member.id ? { ...x, name: e.target.value } : x))} /><textarea value={member.introduction} placeholder="趣味や人柄、ふたりとの関係" onChange={(e) => replace(members.map((x) => x.id === member.id ? { ...x, introduction: e.target.value } : x))} /><button type="button" className="delete" onClick={() => replace(members.filter((x) => x.id !== member.id))}>削除</button></div>)}</section>
}

type PageKind = 'cover' | 'welcome' | 'timeline' | 'menu' | 'profiles' | 'family' | 'story' | 'memory' | 'future' | 'venue' | 'thanks'
const pagePrograms: Record<string, PageKind[]> = {
  'botanical-brochure': ['cover', 'welcome', 'timeline', 'profiles', 'family', 'thanks'],
  'modern-mizuhiki': ['cover', 'welcome', 'timeline', 'family', 'future', 'thanks'],
  'restaurant-course': ['cover', 'menu', 'timeline', 'profiles', 'family', 'venue'],
  'photo-journal': ['cover', 'story', 'profiles', 'family', 'future', 'thanks'],
  'quiet-letter': ['cover', 'welcome', 'venue', 'thanks'],
  'travel-notes': ['cover', 'story', 'timeline', 'venue', 'family', 'thanks'],
  'komon-family': ['cover', 'welcome', 'family', 'future', 'thanks'],
  handwritten: ['cover', 'profiles', 'story', 'family', 'timeline', 'thanks'],
  'hotel-classic': ['cover', 'menu', 'welcome', 'profiles', 'family', 'thanks'],
  'collage-book': ['cover', 'story', 'profiles', 'family', 'future', 'thanks'],
  'gallery-zine': ['cover', 'story', 'profiles', 'family', 'venue'],
  'watercolor-letter': ['cover', 'welcome', 'venue', 'family', 'thanks'],
  'sunday-table': ['cover', 'menu', 'timeline', 'profiles', 'family'],
  'nordic-guide': ['cover', 'venue', 'timeline', 'profiles', 'family'],
  'family-times': ['cover', 'story', 'profiles', 'family', 'timeline', 'future'],
  'sunflower-promise': ['cover', 'welcome', 'memory', 'profiles', 'family', 'thanks'],
}

function Preview({ template, project }: { template: BookTemplate; project: Project }) {
  const family = (side: Side) => <div className="family-preview">{project.families[side].length ? project.families[side].map((member) => <div className="person-chip" key={member.id}><small>{member.relation}</small><strong>{member.name || 'お名前'}</strong><p>{member.introduction || '紹介文が入ります。'}</p></div>) : <p>ご家族を追加すると、ここに紹介が表示されます。</p>}</div>
  const profiles = <div className="profile-spread">{(['groom', 'bride'] as Side[]).map((side) => <div className="profile" key={side}><div className="photo">{project[side].photoUrl ? <img src={project[side].photoUrl} alt="" /> : <span>PHOTO</span>}</div><small>{side === 'groom' ? 'GROOM' : 'BRIDE'}</small><h3>{project[side].name || (side === 'groom' ? '新郎' : '新婦')}</h3><p>{project[side].profile || 'ここに自己紹介が入ります。'}</p></div>)}</div>
  const page = (kind: PageKind, index: number) => {
    if (kind === 'cover') return <article className="page cover" key={kind}><p className="cover-kicker">FAMILY MEETING</p><h1>{template.name}</h1><div className="cover-art" /><p>{text(project, 'date')}</p><p>{text(project, 'venue')}</p></article>
    if (kind === 'welcome') return <article className="page letter-page" key={kind}><small>DEAR OUR FAMILY</small><h2>ご挨拶</h2><p>{text(project, 'greeting')}</p><hr /><p>{text(project, 'dressCode')}</p></article>
    if (kind === 'timeline') return <article className="page timeline-page" key={kind}><small>THE DAY / {String(index).padStart(2, '0')}</small><h2>今日の流れ</h2><p>{text(project, 'schedule')}</p><div className="timeline-line" /></article>
    if (kind === 'menu') return <article className="page menu-page" key={kind}><small>AT {text(project, 'venue')}</small><h2>今日のお品書き</h2><p>{text(project, 'menu')}</p></article>
    if (kind === 'profiles') return <article className="page profiles-page" key={kind}><small>ABOUT US</small><h2>ふたりのこと</h2>{profiles}</article>
    if (kind === 'family') return <article className="page family-page" key={kind}><small>OUR FAMILIES</small><h2>ご家族のご紹介</h2><div className="two-columns"><section><h3>新郎側</h3>{family('groom')}</section><section><h3>新婦側</h3>{family('bride')}</section></div></article>
    if (kind === 'story') return <article className="page story-page" key={kind}><small>OUR STORY</small><h2>ふたりの<br />小さな記録</h2><p>{text(project, 'story')}</p><div className="story-stamp">01<br />02<br />03</div></article>
    if (kind === 'memory') return <article className="page memory-page" key={kind}><small>OUR MEMORIES</small><h2>ひまわりと、<br />土のぬくもり。</h2><section><h3>ひまわり畑でのプロポーズ</h3><p>{text(project, 'proposal')}</p></section><section><h3>陶芸体験の一日</h3><p>{text(project, 'pottery')}</p></section></article>
    if (kind === 'future') return <article className="page future-page" key={kind}><small>OUR NEXT CHAPTER</small><h2>これからのこと</h2><p>{text(project, 'gift')}</p><p>{text(project, 'message')}</p><div className="future-mark">∞</div></article>
    if (kind === 'venue') return <article className="page venue-page" key={kind}><small>PLACE & ACCESS</small><h2>{text(project, 'venue')}</h2><p>{text(project, 'address')}</p><div className="map-grid"><i /><i /><i /><b>●</b></div></article>
    return <article className="page thanks-page" key={kind}><small>WITH THANKS</small><h2>どうぞよろしく<br />お願いいたします。</h2><p>{text(project, 'message')}</p></article>
  }
  return <div className={`book ${template.id} format-${template.layout}`}>{(pagePrograms[template.id] || ['cover', 'welcome', 'profiles', 'family']).map(page)}</div>
}

function AppFamilyV2() {
  const [token, setToken] = useState(() => localStorage.getItem('marriage-shiori-id-token'))
  const [projectId, setProjectId] = useState<string>()
  const [draftId] = useState(() => crypto.randomUUID())
  const [project, setProject] = useState<Project>(blank)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const selected = useMemo(() => templates.find((item) => item.id === project.template), [project.template])
  const api = async (path: string, init?: RequestInit) => { const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init?.headers || {}) } }); if (response.status === 401) { localStorage.removeItem('marriage-shiori-id-token'); setToken(null); throw new Error('ログインの有効期限が切れました。') }; if (!response.ok) throw new Error(await response.text()); return response.json() }
  useEffect(() => { if (!token) return; api('/projects').then(async ({ projects }) => { const latest = projects?.[0]; if (!latest) return; const saved = latest.project as Project; saved.content ||= blank().content; saved.families ||= { groom: [], bride: [] }; for (const side of ['groom', 'bride'] as Side[]) if (saved[side].photoKey) { const { downloadUrl } = await api('/download-url', { method: 'POST', body: JSON.stringify({ key: saved[side].photoKey }) }); saved[side].photoUrl = downloadUrl }; setProject(saved); setProjectId(latest.projectId); setMessage('保存済みのしおりを読み込みました。') }).catch(() => undefined) }, [token])
  const upload = async (side: Side, event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; setBusy(true); try { const { uploadUrl, key } = await api('/upload-url', { method: 'POST', body: JSON.stringify({ projectId: draftId, contentType: file.type }) }); const response = await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': file.type }, body: file }); if (!response.ok) throw new Error('写真をアップロードできませんでした。'); setProject((current) => ({ ...current, [side]: { ...current[side], photoKey: key, photoUrl: URL.createObjectURL(file) } })) } catch (error) { setMessage(error instanceof Error ? error.message : '写真をアップロードできませんでした。') } finally { setBusy(false) } }
  const save = async () => { setBusy(true); try { const result = await api(projectId ? `/projects/${projectId}` : '/projects', { method: projectId ? 'PUT' : 'POST', body: JSON.stringify(serialize(project)) }); setProjectId(result.projectId); setMessage('しおりを保存しました。') } catch (error) { setMessage(error instanceof Error ? error.message : '保存に失敗しました。') } finally { setBusy(false) } }
  if (!token) return <AuthScreen onLogin={(next) => { localStorage.setItem('marriage-shiori-id-token', next); setToken(next) }} />
  if (!selected) return <main className="catalog"><header><div className="catalog-brand"><span>M</span><div><small>WEDDING FAMILY BOOK</small><h1>顔合わせのしおり</h1></div></div><button className="logout" onClick={() => { localStorage.removeItem('marriage-shiori-id-token'); setToken(null) }}>ログアウト</button></header><section className="catalog-hero"><small>CHOOSE A BOOK</small><h2>当日の時間に似合う、<br />一冊を選ぶ。</h2><p>選んだしおりごとに、入力する内容とページの構成が変わります。</p></section><section className="catalog-grid">{templates.map((template) => <button key={template.id} className={`catalog-card ${template.id}`} onClick={() => setProject((current) => ({ ...current, template: template.id }))}><div className="catalog-art"><i /><b /><em /></div><small>{template.genre}</small><h3>{template.name}</h3><p>{template.description}</p><span>このしおりをつくる →</span></button>)}</section></main>
  return <main className="editor"><header><button className="back" onClick={() => setProject((current) => ({ ...current, template: undefined }))}>← しおりを選び直す</button><div><small>{selected.genre}</small><h1>{selected.name}</h1></div><span className="status">{message}</span><button onClick={save} disabled={busy}>{busy ? '保存中…' : '保存する'}</button><button onClick={() => window.print()}>PDF出力</button></header><div className="editor-layout"><section className="form-panel"><div className="form-intro"><small>EDIT THIS BOOK</small><h2>{selected.name}をつくる</h2><p>このしおりに必要な項目だけを入力します。</p></div><section className="form-card"><div className="form-heading"><div><small>EVENT</small><h3>食事会の案内</h3></div></div><div className="field-grid">{selected.fields.map((key) => { const field = fields[key]; return <label key={key} className={field.rows ? 'wide' : ''}>{field.label}{field.rows ? <textarea rows={field.rows} value={project.content[key]} placeholder={field.placeholder} onChange={(e) => setProject((current) => ({ ...current, content: { ...current.content, [key]: e.target.value } }))} /> : <input value={project.content[key]} placeholder={field.placeholder} onChange={(e) => setProject((current) => ({ ...current, content: { ...current.content, [key]: e.target.value } }))} />}</label> })}</div></section><section className="form-card"><div className="form-heading"><div><small>COUPLE</small><h3>ふたりの紹介</h3></div></div><div className="couple-fields">{(['groom', 'bride'] as Side[]).map((side) => <div className="couple-input" key={side}><b>{side === 'groom' ? '新郎' : '新婦'}</b><input placeholder="お名前" value={project[side].name} onChange={(e) => setProject((current) => ({ ...current, [side]: { ...current[side], name: e.target.value } }))} /><textarea rows={4} placeholder="仕事、趣味、家族へのひとこと" value={project[side].profile} onChange={(e) => setProject((current) => ({ ...current, [side]: { ...current[side], profile: e.target.value } }))} /><label className="upload">{project[side].photoUrl ? '写真を変更' : '写真を追加'}<input type="file" accept="image/jpeg,image/png" onChange={(e) => upload(side, e)} /></label></div>)}</div></section><FamilyForm side="groom" project={project} setProject={setProject} /><FamilyForm side="bride" project={project} setProject={setProject} /></section><aside className="preview"><p>LIVE PREVIEW · {selected.pages.join(' / ')}</p><Preview template={selected} project={project} /></aside></div></main>
}

export default AppFamilyV2
