import type { Country } from '../game/types'
import { chance, pick, randInt, type Rng } from '../lib/rng'

/** hand-written handles, mostly the kind you see on Vietnamese game sites */
const CURATED: [string, Country][] = [
  ['1fool', 'vn'],
  ['ateocuimia', 'vn'],
  ['acphat1', 'vn'],
  ['anlien', 'vn'],
  ['asiacup', 'jp'],
  ['b0yfashion', 'vn'],
  ['blacktiger444', 'vn'],
  ['bsc6956g', 'vn'],
  ['cuhuoi', 'vn'],
  ['deproi', 'vn'],
  ['nhanlt', 'vn'],
  ['quangnhan123', 'vn'],
  ['sakura88', 'jp'],
  ['timnguyen', 'vn'],
  ['meomeo2k4', 'vn'],
  ['trasuatranchau', 'vn'],
  ['caphesuada', 'vn'],
  ['banhmi_pate', 'vn'],
  ['gaucon98', 'vn'],
  ['heo_con', 'vn'],
  ['thocon_xinh', 'vn'],
  ['kemdau', 'vn'],
  ['bapcai', 'vn'],
  ['mrbean_vn', 'vn'],
  ['hocmai', 'vn'],
  ['ielts8cham', 'vn'],
  ['toeic990', 'vn'],
  ['englishmoingay', 'vn'],
  ['saigonese', 'vn'],
  ['hanoi36', 'vn'],
  ['danang_boy', 'vn'],
  ['hue_thuong', 'vn'],
  ['phuquoc', 'vn'],
  ['dalat_mong_mo', 'vn'],
  ['langtu_buon', 'vn'],
  ['coemtoi', 'vn'],
  ['ngaymai', 'vn'],
  ['khongten', 'vn'],
  ['chimse', 'vn'],
  ['cavang', 'vn'],
  ['conmeoden', 'vn'],
  ['lazycat', 'vn'],
  ['sleepyfox', 'vn'],
  ['nightowl_hn', 'vn'],
  ['pho_lover', 'vn'],
  ['bunbohue', 'vn'],
  ['xoimit', 'vn'],
  ['dautaychua', 'vn'],
  ['nangmua', 'vn'],
  ['giobien', 'vn'],
  ['thangtu', 'vn'],
  ['muathu_hn', 'vn'],
  ['codon1m', 'vn'],
  ['vuive', 'vn'],
  ['hihihaha', 'vn'],
  ['kocoten', 'vn'],
  ['zzz_ngu', 'vn'],
  ['student_k65', 'vn'],
  ['bkhn_k64', 'vn'],
  ['ftu2k5', 'vn'],
  ['neu_er', 'vn'],
  ['kenji_t', 'jp'],
  ['haruto07', 'jp'],
  ['yuki_chan', 'jp'],
  ['mochi_mochi', 'jp'],
  ['minjun', 'kr'],
  ['jiwoo_k', 'kr'],
  ['seoul_cat', 'kr'],
  ['somchai', 'th'],
  ['bangkok_bee', 'th'],
  ['nok_noi', 'th'],
  ['budi_s', 'id'],
  ['putri_ayu', 'id'],
  ['jakarta_jay', 'id'],
  ['pierre_l', 'fr'],
  ['camille_b', 'fr'],
  ['lukas_m', 'de'],
  ['teacher_mike', 'us'],
  ['emily_r', 'us'],
]

const GIVEN = [
  'minh', 'anh', 'linh', 'huy', 'khoa', 'nam', 'trang', 'thao', 'quang', 'tuan', 'hai', 'long', 'phuc', 'dat', 'duc',
  'hieu', 'hoa', 'lan', 'mai', 'ngoc', 'nhung', 'phuong', 'quynh', 'son', 'thanh', 'thu', 'trung', 'tu', 'van', 'vy',
  'yen', 'bao', 'khang', 'khanh', 'kien', 'lam', 'loc', 'nghia', 'nhan', 'tam', 'thinh', 'tien', 'tri', 'vu', 'duy',
  'hung', 'cuong', 'binh', 'giang', 'ha', 'hanh', 'hoang', 'my', 'nga', 'nhi', 'oanh', 'tram', 'uyen', 'xuan', 'chi',
]
const FAMILY = ['nguyen', 'tran', 'le', 'pham', 'hoang', 'vu', 'vo', 'dang', 'bui', 'do', 'ngo', 'duong', 'ly']
const TAGS = ['hn', 'sg', 'dn', 'hp', 'ct', 'bd', 'vn', 'pro', 'kute', 'xinh', 'cute', 'dz', 'idol', 'no1']
const PREFIX = ['be', 'co', 'chu', 'mr', 'ms', 'anh', 'chi', 'boy', 'girl', 'thay', 'em']
const YEARS = ['88', '89', '90', '92', '95', '96', '97', '98', '99', '2k', '2k1', '2k2', '2k3', '2k4', '2k5', '2k6', '2k7']

function procedural(r: Rng): string {
  const a = pick(GIVEN, r)
  const b = pick(GIVEN, r)
  switch (randInt(0, 8, r)) {
    case 0:
      return `${a}${b}${pick(YEARS, r)}`
    case 1:
      return `${a}_${pick(FAMILY, r)}`
    case 2:
      return `${pick(FAMILY, r)}${a}${randInt(1, 99, r)}`
    case 3:
      return `${pick(PREFIX, r)}_${a}`
    case 4:
      return `${a}${pick(TAGS, r)}${chance(0.5, r) ? randInt(1, 99, r) : ''}`
    case 5:
      return `${a}.${b}`
    case 6:
      return `${a}${a.slice(-1)}${a.slice(-1)}${randInt(1, 999, r)}`
    case 7:
      return `${pick(PREFIX, r)}${a}${pick(YEARS, r)}`
    default:
      return `${a}${b}`
  }
}

export function botIdentities(count: number, r: Rng): { name: string; country: Country }[] {
  const out: { name: string; country: Country }[] = CURATED.map(([name, country]) => ({ name, country }))
  const used = new Set(out.map((o) => o.name))
  let guard = 0
  while (out.length < count && guard++ < 5000) {
    const name = procedural(r)
    if (used.has(name) || name.length > 15) continue
    used.add(name)
    out.push({ name, country: 'vn' })
  }
  return out.slice(0, count)
}

const ADJ = ['Swift', 'Lucky', 'Quiet', 'Brave', 'Sunny', 'Clever', 'Mighty', 'Chill', 'Witty', 'Cosmic', 'Golden', 'Jolly']
const NOUN = ['Otter', 'Mango', 'Tiger', 'Lotus', 'Panda', 'Falcon', 'Gecko', 'Comet', 'Bamboo', 'Dragon', 'Koi', 'Heron']

export function guestName() {
  return `${pick(ADJ)}${pick(NOUN)}${randInt(10, 99)}`
}

export const BIOS = [
  "Love learning English! Let's play and improve together",
  'IELTS 6.5 now, aiming for 7.5 this year',
  'Here for the listening games',
  'Practice every day, no excuses',
  'Uni student in Hanoi. Add me!',
  'Coffee first, vocabulary later',
  "Trying to beat my brother's rating",
  'One more round and then I sleep',
  'Preparing for a job interview in English',
  'Slow typer, good listener',
  'Learning English to travel the world',
  'Night owl. Usually online after 10pm',
  'Challenge me, I never say no',
  'Just started, please be nice',
  'Working on my listening for TOEIC',
  'I play during lunch breaks',
  '',
  '',
  '',
]

export const CITIES: Record<Country, string[]> = {
  vn: ['Ho Chi Minh City', 'Hanoi', 'Da Nang', 'Hai Phong', 'Can Tho', 'Hue', 'Nha Trang', 'Da Lat', 'Bien Hoa', 'Vung Tau'],
  jp: ['Tokyo', 'Osaka', 'Fukuoka'],
  kr: ['Seoul', 'Busan'],
  th: ['Bangkok', 'Chiang Mai'],
  id: ['Jakarta', 'Bandung'],
  fr: ['Paris', 'Lyon'],
  de: ['Berlin', 'Munich'],
  us: ['Seattle', 'Austin'],
}

export const COUNTRY_NAMES: Record<Country, string> = {
  vn: 'Vietnam',
  jp: 'Japan',
  kr: 'South Korea',
  th: 'Thailand',
  id: 'Indonesia',
  fr: 'France',
  de: 'Germany',
  us: 'United States',
}
