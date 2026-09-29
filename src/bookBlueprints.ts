export type BookBlueprint = {
  id: string
  title: string
  format: 'a4-portrait-booklet' | 'a4-landscape-bifold' | 'a5-saddle-stitch' | 'square-string-bound'
  illustration: string
  requiredSections: string[]
  optionalSections: string[]
}

export const bookBlueprints: BookBlueprint[] = [
  { id: 'floral-keepsake', title: '花とタッセルの記念冊子', format: 'square-string-bound', illustration: '/illustrations/botanical-mizuhiki-cover.png', requiredSections: ['ご挨拶', '当日の流れ', 'ふたりのプロフィール', '両家紹介', '結び'], optionalSections: ['前撮り写真', '会場案内', '手土産'] },
  { id: 'indigo-mizuhiki', title: '藍の水引・和モダン冊子', format: 'a4-landscape-bifold', illustration: '/illustrations/botanical-mizuhiki-cover.png', requiredSections: ['ご挨拶', '食事会の進行', '両家の家系図', '今後の予定', '婚約・結婚指輪', '結び'], optionalSections: ['会場写真', '連絡先'] },
  { id: 'lace-garden', title: 'レースと草花の手綴じ冊子', format: 'a4-portrait-booklet', illustration: '/illustrations/watercolor-garden-spread.png', requiredSections: ['ご挨拶', 'ふたりのプロフィール', '思い出写真', '家族紹介', '会場案内'], optionalSections: ['お品書き', '結び'] },
  { id: 'crimson-profile', title: '紅白・和風プロフィールブック', format: 'a5-saddle-stitch', illustration: '/illustrations/botanical-mizuhiki-cover.png', requiredSections: ['ご挨拶', '当日の流れ', 'プロフィール', '思い出写真', '両家紹介', '今後の予定', '連絡先', '結び'], optionalSections: ['式場紹介', '手土産'] },
  { id: 'family-illustration', title: '似顔絵と家族の物語', format: 'a4-landscape-bifold', illustration: '/illustrations/watercolor-garden-spread.png', requiredSections: ['ご挨拶', 'ふたりのプロフィール', '家族の似顔絵紹介', 'ふたりの年表', '今後の予定', '式場紹介', '結び'], optionalSections: ['婚約指輪', '連絡先'] },
  { id: 'photo-album', title: '写真コラージュ・アルバム', format: 'a5-saddle-stitch', illustration: '/illustrations/watercolor-garden-spread.png', requiredSections: ['表紙写真', 'ご挨拶', 'ふたりの写真年表', 'プロフィール', '両家写真', '家族紹介', '結び'], optionalSections: ['お品書き', '会場案内', '今後の予定'] },
  { id: 'wedding-magazine', title: 'プロフィールマガジン', format: 'a5-saddle-stitch', illustration: '/illustrations/watercolor-garden-spread.png', requiredSections: ['表紙', 'ご挨拶', '写真特集', '詳細プロフィール', '幼少期の思い出', 'Love History', '結婚のコンセプト', 'タイムライン', '家族・ゲスト紹介', 'メニュー', '裏表紙'], optionalSections: ['席次表', 'ドリンクメニュー', 'SNS案内'] },
]
