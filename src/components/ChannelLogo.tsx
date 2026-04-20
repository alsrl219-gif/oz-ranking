/**
 * 채널별 브랜드 로고 컴포넌트
 * 각 브랜드의 공식 로고를 SVG/HTML로 정밀하게 재현
 */
import type { ChannelId } from '../types'

interface ChannelLogoProps {
  channelId: ChannelId
  size?: 'sm' | 'md' | 'lg'
}

export function ChannelLogo({ channelId, size = 'md' }: ChannelLogoProps) {
  const h = size === 'sm' ? 22 : size === 'lg' ? 34 : 28

  switch (channelId) {

    /* ── 쿠팡 ─────────────────────────────────────────────────────
       공식 coupang 워드마크: 각 글자마다 고유 컬러
    ─────────────────────────────────────────────────────────── */
    case 'coupang':
      return (
        <span
          className="inline-flex items-center px-2.5 rounded-lg border border-gray-200 bg-white font-extrabold tracking-tight select-none"
          style={{ height: h, fontSize: h * 0.46, letterSpacing: '-0.5px' }}
        >
          <span style={{ color: '#E53239' }}>c</span>
          <span style={{ color: '#30A64A' }}>o</span>
          <span style={{ color: '#1679C8' }}>u</span>
          <span style={{ color: '#E87722' }}>p</span>
          <span style={{ color: '#9B59B6' }}>a</span>
          <span style={{ color: '#17A8C8' }}>n</span>
          <span style={{ color: '#E87722' }}>g</span>
        </span>
      )

    /* ── 스마트스토어 (Naver N+) ───────────────────────────────────
       Naver 공식 N+ 마크: 그린 → 에메랄드 그라디언트 + 흰색 N+
    ─────────────────────────────────────────────────────────── */
    case 'smartstore':
      return (
        <span
          className="inline-flex items-center justify-center rounded-lg font-black text-white select-none"
          style={{
            height: h,
            minWidth: h * 1.4,
            fontSize: h * 0.48,
            letterSpacing: '-0.5px',
            background: 'linear-gradient(135deg, #03C75A 0%, #01A89E 100%)',
          }}
        >
          N+
        </span>
      )

    /* ── 무신사 ───────────────────────────────────────────────────
       공식 MUSINSA 로고: 검정 배경 + 흰색 광폭 레터링
    ─────────────────────────────────────────────────────────── */
    case 'musinsa':
      return (
        <span
          className="inline-flex items-center justify-center rounded-lg text-white font-black select-none"
          style={{
            height: h,
            minWidth: h * 2.8,
            fontSize: h * 0.33,
            letterSpacing: '1.8px',
            background: '#000000',
          }}
        >
          MUSINSA
        </span>
      )

    /* ── 보리보리 ─────────────────────────────────────────────────
       보리보리 핑크 브랜드 컬러 + 한글 로고
    ─────────────────────────────────────────────────────────── */
    case 'boribori':
      return (
        <span
          className="inline-flex items-center justify-center rounded-lg text-white font-extrabold select-none"
          style={{
            height: h,
            minWidth: h * 2.4,
            fontSize: h * 0.38,
            background: 'linear-gradient(135deg, #FF6B9D 0%, #FF4D85 100%)',
            letterSpacing: '-0.5px',
          }}
        >
          보리보리
        </span>
      )

    /* ── 롯데온 ───────────────────────────────────────────────────
       lotte ON 브랜드 로고: 롯데 레드 + 굵은 워드마크
    ─────────────────────────────────────────────────────────── */
    case 'lotteon':
      return (
        <span
          className="inline-flex items-center justify-center rounded-lg text-white select-none"
          style={{
            height: h,
            minWidth: h * 2.0,
            fontSize: h * 0.4,
            background: '#E60012',
          }}
        >
          <span className="font-black" style={{ letterSpacing: '-0.5px' }}>lotte</span>
          <span className="font-light" style={{ letterSpacing: '-0.3px' }}>ON</span>
        </span>
      )

    /* ── 카카오선물하기 ───────────────────────────────────────────
       Kakao 공식 노란색 + 다크 텍스트 워드마크
    ─────────────────────────────────────────────────────────── */
    case 'kakao':
      return (
        <span
          className="inline-flex items-center justify-center rounded-lg font-extrabold select-none"
          style={{
            height: h,
            minWidth: h * 1.9,
            fontSize: h * 0.38,
            background: '#FEE500',
            color: '#3C1E1E',
            letterSpacing: '-0.3px',
          }}
        >
          kakao
        </span>
      )

    default:
      return null
  }
}
