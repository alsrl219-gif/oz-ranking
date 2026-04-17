# Playwright 공식 이미지 사용 (Chromium 포함)
FROM mcr.microsoft.com/playwright:v1.48.2-noble

WORKDIR /app

# 의존성 설치
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# 소스 복사
COPY . .

# 데이터 디렉토리 생성
RUN mkdir -p data/history data/errors

EXPOSE 3002

ENV NODE_ENV=production
ENV HEADLESS=true

CMD ["npx", "tsx", "src/index.ts"]
