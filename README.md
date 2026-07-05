# onedata — 국내 공공데이터 대시보드

시장 지표(KOSIS/DART) · 외국인 지표(법무부) · 데이터 검색을 한 사이트에서 보여주는
정적 웹 페이지입니다. 구현 스펙 전체는 [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) 참고.

## 구현 현황

PROJECT_SPEC.md 섹션 5 순서 기준:

- [x] **1. 디자인 토큰 + 공통 카드/차트 컴포넌트 뼈대** — `css/tokens.css`, `css/components.css`,
      `js/render-cards.js`, `js/render-charts.js`.
- [~] 2. KOSIS/DART/ECOS/지표누리 수집 스크립트 + Actions 워크플로 → 시장 지표 페이지 완성
      — `scripts/fetch_dart.py`는 실제로 동작합니다 (DART_API_KEY, 매일 자동 실행).
      `scripts/fetch_ecos.py`는 ECOS의 **100대 통계지표(KeyStatisticList)** API로 시장금리/가계수신/
      기업대출을 키워드로 찾아서 채웁니다 — 통계표코드를 몰라도 되는 방식이라 ECOS_API_KEY만 있으면
      바로 동작하지만, 한 시점 값만 주는 API라 **차트에는 아직 시계열이 아니라 값 1개만** 들어갑니다.
      `scripts/fetch_index.py`(지표누리)는 정확한 엔드포인트/지표코드를 확인 못 해서 자리만 있고 기본
      비활성 상태입니다. KOSIS 쪽(`fetch_kosis.py`/`fetch_kosis_financial.py`)은 여전히 수동 스냅샷이며
      금융 지표 섹션에서 ECOS 데이터가 있으면 우선 표시, 없으면 이 스냅샷으로 대체됩니다(카드에 출처
      배지로 표시).
- [~] 3. data.go.kr 법무부 외국인 통계 연동 → 외국인 지표 페이지
      — KOSIS 100대 지표가 법무부 출입국통계를 일부 재수록하고 있어, 별도 서비스키 없이
      체류외국인 총수/전년대비 증감률/연간 입국자수/체류자격별 분포/연도별 추이는 실데이터로
      채웠습니다 (`scripts/fetch_immigration.py`, `.github/workflows/update-immigration.yml`로 자동 재생성).
      **국적별 분포와 국적취득(귀화) 현황**은 KOSIS에 없어 `scripts/fetch_immigration_datagokr.py`가
      DATA_GO_KR_API_KEY로 채우도록 연결돼 있지만, **활용신청한 데이터셋의 실제 엔드포인트 URL을
      아직 안 채워서 지금은 스킵됩니다** — 아래 "남은 설정" 참고.
- [x] **뉴스/보고서 섹션** — 시장 지표 페이지에 금융 뉴스 + DART 최근 공시, 외국인 지표 페이지에
      외국인 투자/환율/글로벌 보고서 관련 뉴스를 Google News RSS에서 가져와 표시합니다
      (`scripts/fetch_news.py`, 두 워크플로에 모두 연결됨). API 키가 필요 없는 공개 RSS라 바로 동작하며,
      전문 요약이 아니라 헤드라인/출처/링크 파싱입니다 (본문 요약은 신뢰성 있게 자동화하기 어려워 제외).
- [ ] 4. `build_catalog.py` + 검색 페이지
- [ ] 5. (추후) ECOS 시계열(StatisticSearch) 연동 후 MCP 등록

### 남은 설정 (선택 — 지금도 대부분 동작하지만 더 채우면 좋아지는 것들)

| 파일 | 채워야 할 것 | 찾는 곳 |
|---|---|---|
| `scripts/fetch_ecos.py` | (선택) 시계열이 필요하면 `StatisticSearch`용 `stat_code`/`item_code`를 추가 조회하는 로직 | ecos.bok.or.kr → 통계검색 → 코드 보기 |
| `scripts/fetch_immigration_datagokr.py` `ENDPOINT_URL` | 활용신청 승인된 데이터셋의 실제 요청 주소 | data.go.kr 해당 데이터셋 페이지 → "Open API 개발가이드" 탭 |
| `scripts/fetch_immigration_datagokr.py` `fetch_nationality_distribution`/`fetch_naturalization` | 실제 응답 필드명에 맞춘 매핑 (`nat_nm`/`ratio` 등은 자리표시자) | 위 개발가이드 탭의 출력결과 명세 |
| `scripts/fetch_index.py` `ENDPOINT_URL`/`INDICATORS` | 지표누리 요청 URL + 원하는 정책지표의 지표코드 | index.go.kr 해당 지표 페이지 → Open API 탭 (카드소비는 이미 KOSIS로 채워져 있어 필수는 아님) |
| `scripts/fetch_kosis.py` / `fetch_kosis_financial.py` | (선택) 실시간 전환 시 지표별 `tblId`/`objL1`/`itmId` | kosis.kr/openapi, 각 통계표 조회화면 URL |

## 페이지 구성

### 시장 지표 (`index.html`)
1. **최근 발표 지표** — KOSIS 인구·물가·고용 지표 10종의 최신 값과 직전 시점 대비 증감
2. **지표별 추이** — 카테고리 필터(인구/물가/고용/인구동향/금융) + 시계열 꺾은선 그래프
3. **금융 지표** — 스펙 3-1의 서브카테고리(시장금리/가계수신/기업대출/카드소비) 필터. ECOS 데이터가
   있으면 그걸 우선 쓰고, 없으면 KOSIS 스냅샷으로 대체 — 카드마다 **출처 배지(ECOS/KOSIS)** 표시.
   기업대출은 아직 어느 소스에서도 못 채워서 "준비중" 카드로 남아있습니다.
4. **금융 뉴스 & 최근 공시** — Google News RSS 헤드라인 + DART 최근 공시 목록

### 외국인 지표 (`immigration.html`)
- 핵심 요약: 체류외국인 총수 · 전년대비 증감률 · 연간 입국자수 (KOSIS 실데이터) + 국적취득 현황(준비중)
- 분포/추이: 체류자격별 분포(막대, KOSIS 실데이터) · 연도별 추이(라인, KOSIS 실데이터) + 국적별 분포(준비중)
- KOSIS에 없는 두 항목(국적별 분포, 국적취득 현황)은 data.go.kr 법무부 Open API 서비스키가 있어야 채울 수 있습니다.
- **외국인 관련 뉴스 & 보고서** — 외국인 투자·환율 관련 외국인 반응·글로벌 기관 보고서 Google News RSS 헤드라인

두 페이지 모두 상단 GNB로 이동하며, 현재는 **다크 테마 고정**으로 배포되어 있습니다
(`prefers-color-scheme` 무관, `css/tokens.css` 참고).

## 리포지토리 구조

```
/onedata
  /data
    kosis_market.json      # 시장지표 - KOSIS 스냅샷 (인구/물가/고용/인구동향/금융)
    kosis_financial.json   # 시장지표 - 금융 서브카테고리 스냅샷 (시장금리/가계수신/카드소비)
    dart_market.json       # 시장지표 - DART 최근 공시 (fetch_dart.py가 매일 자동 생성)
    ecos_market.json       # 시장지표 - ECOS 100대 통계지표 매칭 결과 (fetch_ecos.py가 매일 자동 생성)
    index_go_kr.json       # 시장지표 - 지표누리 보완 지표 (INDICATORS 설정 시 자동 생성)
    news_market.json        # 금융 뉴스 헤드라인 (fetch_news.py market)
    news_immigration.json   # 외국인 관련 뉴스 헤드라인 (fetch_news.py immigration)
    immigration_stats.json # 외국인지표 - KOSIS 재수록 법무부 출입국통계 스냅샷
    meta.json              # 데이터 소스 목록 + 최종 갱신 시각
  /scripts
    fetch_kosis.py               # kosis_market.json 생성 스크립트 (수동 스냅샷)
    fetch_kosis_financial.py     # kosis_financial.json 생성 스크립트 (수동 스냅샷)
    fetch_dart.py                # dart_market.json 생성 — 실제 DART Open API 호출
    fetch_ecos.py                # ecos_market.json 생성 — ECOS 100대 통계지표 키워드 매칭
    fetch_index.py               # index_go_kr.json 생성 — 지표누리 (기본 비활성, README 참고)
    fetch_news.py                # news_market.json / news_immigration.json 생성 — Google News RSS
    fetch_immigration.py         # immigration_stats.json 생성 스크립트 (수동 스냅샷)
    fetch_immigration_datagokr.py # immigration_stats.json에 국적별분포/국적취득 추가 (엔드포인트 설정 필요)
  /.github/workflows
    update-market.yml      # DART/ECOS/지표누리/KOSIS/뉴스 시장 지표 매일 자동 수집 + 커밋
    update-immigration.yml # 외국인 지표 + 관련 뉴스 매일 자동 수집 + 커밋
  /css
    tokens.css            # 디자인 토큰 (accent 컬러, 상승/하락 컬러, 간격 등 — 다크 고정)
    components.css        # 공통 컴포넌트 (GNB, 지표 카드, 차트 카드, 뉴스 리스트, 준비중 카드, 테이블, 툴팁)
  /js
    render-cards.js       # 지표 카드 + 스파크라인 렌더러 (출처 배지 지원)
    render-charts.js      # SVG 라인차트 + 막대차트 렌더러 (호버 크로스헤어/툴팁, 표 보기 토글, 출처 배지)
    render-news.js        # 뉴스/공시 헤드라인 리스트 렌더러
    app.js                # 시장 지표 페이지 진입점 (market + financial + news 렌더)
    immigration.js         # 외국인 지표 페이지 진입점 (+ news 렌더)
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
