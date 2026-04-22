import { scrapeBoribori } from './src/scrapers/boribori'
import { scrapeLotteon } from './src/scrapers/lotteon'
import { scrapeKakao } from './src/scrapers/kakao'

async function main() {
  console.log('\n=== 보리보리 ===')
  const bori = await scrapeBoribori(['realtime', 'daily', 'weekly', 'monthly'])
  bori.forEach(s => {
    const info = s.error ? `오류: ${s.error.slice(0, 50)}` : `${s.products.length}개, 오즈키즈 ${s.ozKidsEntries.length}개`
    console.log(`  [${s.period}]: ${info}`)
    if (s.products.length > 0 && !s.error) console.log('    1위:', s.products[0].brandName, '|', s.products[0].productName.slice(0, 35))
  })

  console.log('\n=== 롯데온 ===')
  const lotte = await scrapeLotteon(['realtime', 'daily', 'weekly', 'monthly'])
  lotte.forEach(s => {
    const info = s.error ? `오류: ${s.error.slice(0, 50)}` : `${s.products.length}개, 오즈키즈 ${s.ozKidsEntries.length}개`
    console.log(`  [${s.period}]: ${info}`)
    if (s.products.length > 0 && !s.error) console.log('    1위:', s.products[0].brandName, '|', s.products[0].productName.slice(0, 35))
  })

  console.log('\n=== 카카오 ===')
  const kakao = await scrapeKakao(['realtime', 'daily', 'weekly', 'monthly'])
  kakao.forEach(s => {
    const info = s.error ? `오류: ${s.error.slice(0, 50)}` : `${s.products.length}개, 오즈키즈 ${s.ozKidsEntries.length}개`
    console.log(`  [${s.period}]: ${info}`)
    if (s.products.length > 0 && !s.error) console.log('    1위:', s.products[0].brandName, '|', s.products[0].productName.slice(0, 35))
  })
}

main().catch(console.error)
