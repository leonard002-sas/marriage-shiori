import { ChangeEvent, useState } from 'react'

type Person = { name: string; profile: string; photoUrl?: string }
type Project = { groom: Person; bride: Person; template: string }

const templates = [
  { id: 'warm', name: 'あたたかい日', color: '#d7a084' },
  { id: 'green', name: '和やか', color: '#a7ad91' },
  { id: 'simple', name: 'ふたりらしく', color: '#d8d0c4' },
]

function App() {
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

  return (
    <main className="shell">
      <header><div className="logo">M</div><div><small>WEDDING MEETING SHIORI</small><h1>顔合わせのしおり</h1></div><button className="save">保存する</button></header>
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
