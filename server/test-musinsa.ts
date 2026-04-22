import { scrapeMusinsa } from './src/scrapers/musinsa'

scrapeMusinsa(['realtime', 'daily', 'weekly', 'monthly']).then(r => {
  r.forEach(s => {
    const info = s.error ? `오류: ${s.error}` : `${s.products.length}개, 오즈키즈 ${s.ozKidsEntries.length}개`
    console.log(`[${s.period}]: ${info}`)
    if (s.products.length > 0) {
      console.log('  1위:', s.products[0].rank, s.products[0].brandName, '|', s.products[0].productName.slice(0, 40))
      if (s.ozKidsEntries.length > 0) {
        s.ozKidsEntries.forEach(e => console.log('  🎯 오즈키즈:', e.rank, e.productName.slice(0, 40)))
      }
    }
  })
}).catch(console.error)
