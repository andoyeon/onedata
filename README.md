# onedata — 국내 공공데이터 대시보드

시장 지표(KOSIS/DART) · 외국인 지표(법무부) · 데이터 검색을 한 사이트에서 보여주는
정적 웹 페이지입니다. 구현 스펙 전체는 [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) 참고.

## 구현 현황

PROJECT_SPEC.md 섹션 5 순서 기준:

- [x] **1. 디자인 토큰 + 공통 카드/차트 컴포넌트 뼈대** — `css/tokens.css`, `css/components.css`,
      `js/render-cards.js`, `js/render-charts.js`.
- [~] 2. DART 수집 스크립트 + Actions 워크플로 → 시장 지표 페이지 완성
      — KOSIS 쪽 금융 서브카테고리(시장금리/가계수신/카드소비)까지는 채웠고, DART 연동과
      Actions 자동화는 아직입니다.
- [~] 3. data.go.kr 법무부 외국인 통계 연동 → 외국인 지표 페이지
      — KOSIS 100대 지표가 법무부 출입국통계를 일부 재수록하고 있어, 별도 서비스키 없이
      체류외국인 총수/전년대비 증감률/연간 입국자수/체류자격별 분포/연도별 추이는 실데이터로
      채웠습니다. **국적별 분포와 국적취득(귀화) 현황은 KOSIS에 없어** data.go.kr 연동 전까지
      "준비중"으로 남아있습니다.
- [ ] 4. `build_catalog.py` + 검색 페이지
- [ ] 5. (추후) ECOS 연동

## 페이지 구성

### 시장 지표 (`index.html`)
1. **최근 발표 지표** — KOSIS 인구·물가·고용 지표 10종의 최신 값과 직전 시점 대비 증감
2. **지표별 추이** — 카테고리 필터(인구/물가/고용/인구동향/금융) + 시계열 꺾은선 그래프
3. **금융 지표** — 스펙 3-1의 서브카테고리(시장금리/가계수신/기업대출/카드소비) 필터.
   시장금리·중앙은행 정책금리·예금은행총예금·신용카드 이용금액은 실제 KOSIS 데이터,
   **기업대출은 ECOS 미연동으로 "준비중" 카드**로 자리만 표시됩니다.

### 외국인 지표 (`immigration.html`)
- 핵심 요약: 체류외국인 총수 · 전년대비 증감률 · 연간 입국자수 (KOSIS 실데이터) + 국적취득 현황(준비중)
- 분포/추이: 체류자격별 분포(막대, KOSIS 실데이터) · 연도별 추이(라인, KOSIS 실데이터) + 국적별 분포(준비중)
- KOSIS에 없는 두 항목(국적별 분포, 국적취득 현황)은 data.go.kr 법무부 Open API 서비스키가 있어야 채울 수 있습니다.

두 페이지 모두 상단 GNB로 이동하며, 현재는 **다크 테마 고정**으로 배포되어 있습니다
(`prefers-color-scheme` 무관, `css/tokens.css` 참고).

## 리포지토리 구조

```
/onedata
  /data
    kosis_market.json      # 시장지표 - KOSIS 스냅샷 (인구/물가/고용/인구동향/금융)
    kosis_financial.json   # 시장지표 - 금융 서브카테고리 스냅샷 (시장금리/가계수신/카드소비)
    immigration_stats.json # 외국인지표 - KOSIS 재수록 법무부 출입국통계 스냅샷
    meta.json              # 데이터 소스 목록 + 최종 갱신 시각
  /scripts
    fetch_kosis.py            # kosis_market.json 생성 스크립트
    fetch_kosis_financial.py  # kosis_financial.json 생성 스크립트
    fetch_immigration.py      # immigration_stats.json 생성 스크립트
  /css
    tokens.css            # 디자인 토큰 (accent 컬러, 상승/하락 컬러, 간격 등 — 다크 고정)
    components.css        # 공통 컴포넌트 (GNB, 지표 카드, 차트 카드, 준비중 카드, 테이블, 툴팁)
  /js
    render-cards.js       # 지표 카드 + 스파크라인 렌더러
    render-charts.js      # SVG 라인차트 + 막대차트 렌더러 (호버 크로스헤어/툴팁, 표 보기 토글)
    app.js                # 시장 지표 페이지 진입점 (market + financial 렌더)
    immigration.js         # 외국인 지표 페이지 진입점
  index.html               # 시장 지표
  immigration.html         # 외국인 지표
```

## 로컬에서 보기

`fetch`로 `data/*.json`을 불러오므로 파일을 직접 열지 말고 로컬 서버로 실행하세요.

```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```

## 데이터 갱신 방법 (현재: 수동 스냅샷)

**KOSIS (시장/금융/외국인 지표)**
1. 각 지표(`indicator_id`)의 최신 시계열 값을 조회
2. `scripts/fetch_kosis.py` / `scripts/fetch_kosis_financial.py` / `scripts/fetch_immigration.py`의
   원자료 상수를 새 값으로 교체
3. 세 스크립트를 실행 → `data/*.json` 재생성 (실행 순서 무관 — `meta.json`은 최신
   `generated_at` 기준으로 병합됩니다)

**국적별 분포 / 국적취득 현황 (아직 미연동, data.go.kr 필요)**
1. [data.go.kr](https://www.data.go.kr)에서 "법무부" + 원하는 통계명으로 검색 → 활용신청 → 서비스키 발급
2. 서비스키는 GitHub Actions Secrets에 저장 (절대 코드/워크플로에 하드코딩 금지 — PROJECT_SPEC.md 섹션 0-1)
3. `scripts/fetch_immigration.py`에 data.go.kr 호출을 추가해 `nationality_distribution` /
   `stat_cards.naturalization`을 채우면 `immigration.html`의 남은 준비중 카드가 자동으로 실데이터로 바뀝니다
   (필드가 채워져 있으면 `immigration.js`가 placeholder 대신 실제 카드/차트를 그리도록 이미 분기되어 있음)

## 출처

- KOSIS 국가통계포털(통계청, https://kosis.kr) — 시장/금융/외국인 지표 원자료 상당수 (외국인 지표는
  법무부 출입국·외국인정책본부 통계를 KOSIS가 재수록한 것)
- 법무부 출입국·외국인정책본부 (국적별 분포·국적취득 현황은 공공데이터포털 연동 예정, 아직 미연동)

본 페이지는 학습·개인용 비공식 시각화이며, 공식 수치는 각 기관 원본에서 확인하세요.
