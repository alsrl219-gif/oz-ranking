// 개발: Vite 프록시 사용 (/api → localhost:3002)
// 프로덕션: VITE_API_URL 환경변수로 Railway 백엔드 URL 지정
export const API_BASE = import.meta.env.VITE_API_URL ?? ''
