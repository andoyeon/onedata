# onedata — 국내 공공데이터 대시보드

시장 지표(금융 전용: KOSIS/ECOS/DART) · 외국인 지표(법무부/KOSIS) · 데이터 검색을 한 사이트에서
보여주는 정적 웹 페이지입니다. 구현 스펙 전체는 [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) 참고.

## 구현 현황

- [x] **디자인 토큰 + 공통 카드/차트/뉴스 컴포넌트** — `css/tokens.css`, `css/components.css`,
      `js/render-cards.js`, `js/render-charts.js`, `js/render-news.js`.
- [~] **시장 지표 — 금융 전용으로 재구성** — 인구·물가·고용·혼인 등 비금융 지표는 완전히 제거하고,
      시장금리/가계수신/가계대출/기업대출/카드소비/환율만 남겼습니다.
      - `scripts/fetch_kosis_financial.py`: 시장금리·중앙은행 정책금리·예금은행총예금·예금취급기관
        가계대출·신용카드 개인이용금액·원달러 환율 (수동 스냅샷, 6개 실지표)
      - `scripts/fetch_dart.py`: DART 최근 공시 — 실제 동작 (DART_API_KEY)
      - `scripts/fetch_ecos.py`: ECOS 100대 통계지표(KeyStatisticList)에서 시장금리/가계수신/기업대출을
        키워드로 매칭 — ECOS_API_KEY만 있으면 동작하지만 **한 시점 값만 제공**(시계열 아님)
      - `scripts/fetch_index.py`(지표누리): 엔드포인트 미검증으로 기본 비활성
      - 카드마다 **출처 배지**(ECOS/KOSIS)로 어디서 온 데이터인지 표시. ECOS 데이터가 있으면 우선,
        없으면 KOSIS로 대체. 기업대출은 두 소스 모두 아직 없어 "준비중" 카드.
- [~] **외국인 지표 — KOSIS "외국인" 키워드 지표로 확장** — 체류외국인 총수(외국인 등록인구),
      전년대비 증감률, 연간 입국자수, **외국인과의 혼인건수**(신규), 체류자격별 분포,
      **최근 월별 국제순이동 추이**(신규, 등록인구 연간 통계보다 훨씬 최신). 국적별 분포·국적취득
      현황은 KOSIS에 없어 data.go.kr 연동 전까지 준비중.
- [x] **뉴스/보고서 요약** — 각 탭 **최상단**에 배치. 시장 지표: 금융 뉴스 + DART 최근 공시.
      외국인 지표: 외국인 투자/환율 반응/글로벌 보고서 관련 뉴스. Google News RSS 헤드라인
      파싱(제목/출처/링크, 최신 5건) — API 키 불필요, 전문 요약은 자동화 신뢰성 문제로 제외.
- [ ] `build_catalog.py` + 데이터 검색 탭
- [ ] (추후) ECOS 시계열(StatisticSearch) 연동, data.go.kr 국적별 분포 연동

### 남은 설정 (선택 — 지금도 대부분 동작)

| 파일 | 채워야 할 것 | 찾는 곳 |
|---|---|---|
| `scripts/fetch_ecos.py` | (선택) 시계열이 필요하면 `StatisticSearch`용 `stat_code`/`item_code` 조회 로직 추가 | ecos.bok.or.kr → 통계검색 → 코드 보기 |
| `scripts/fetch_immigration_datagokr.py` `ENDPOINT_URL` | 활용신청 승인된 데이터셋의 실제 요청 주소 | data.go.kr 해당 데이터셋 페이지 → "Open API 개발가이드" 탭 |
| `scripts/fetch_immigration_datagokr.py` 매핑 함수 | 실제 응답 필드명에 맞춘 매핑 (자리표시자 상태) | 위 개발가이드 탭의 출력결과 명세 |
| `scripts/fetch_index.py` `ENDPOINT_URL`/`INDICATORS` | 지표누리 요청 URL + 지표코드 | index.go.kr 해당 지표 페이지 → Open API 탭 |
| `scripts/fetch_kosis_financial.py` | (선택) 실시간 전환 시 지표별 `tblId`/`objL1`/`itmId` | kosis.kr/openapi, 각 통계표 조회화면 URL |

## 페이지 구성

### 시장 지표 (`index.html`) — 금융 전용
1. **최신 금융 뉴스 & 공시 요약** (최상단) — Google News RSS + DART 최근 공시
2. **금융 지표** — 시장금리 · 가계수신 · 가계대출 · 기업대출(준비중) · 카드소비 · 환율.
   서브카테고리 필터, 카드마다 출처 배지(ECOS/KOSIS)

### 외국인 지표 (`immigration.html`)
1. **최신 외국인 관련 뉴스 & 보고서 요약** (최상단)
2. **핵심 요약** — 체류외국인 총수 · 전년대비 증감률 · 연간 입국자수 · 외국인과의 혼인건수 · 국적취득 현황(준비중)
3. **분포 및 추이** — 국적별 분포(준비중) · 체류자격별 분포(막대) · 등록인구 연도별 추이 · 최근 월별 국제순이동

두 페이지 모두 상단 GNB로 이동하며, 현재는 **다크 테마 고정**으로 배포되어 있습니다
(`prefers-color-scheme` 무관, `css/tokens.css` 참고).

## 리포지토리 구조

```
/onedata
  /data
    kosis_financial.json   # 시장지표 - 금융 전용 KOSIS 스냅샷 (시장금리/가계수신/가계대출/카드소비/환율)
    dart_market.json       # 시장지표 - DART 최근 공시 (fetch_dart.py가 매일 자동 생성)
    ecos_market.json       # 시장지표 - ECOS 100대 통계지표 매칭 결과 (fetch_ecos.py가 매일 자동 생성)
    index_go_kr.json       # 시장지표 - 지표누리 보완 지표 (INDICATORS 설정 시 자동 생성)
    news_market.json        # 금융 뉴스 헤드라인 (fetch_news.py market)
    news_immigration.json   # 외국인 관련 뉴스 헤드라인 (fetch_news.py immigration)
    immigration_stats.json # 외국인지표 - KOSIS "외국인" 키워드 지표 스냅샷
    meta.json              # 데이터 소스 목록 + 최종 갱신 시각
  /scripts
    fetch_kosis_financial.py     # kosis_financial.json 생성 스크립트 (수동 스냅샷, 금융 전용)
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
    app.js                # 시장 지표 페이지 진입점 (financial + news 렌더)
    immigration.js         # 외국인 지표 페이지 진입점 (+ news 렌더)
  index.html               # 시장 지표 (금융 전용)
  immigration.html         # 외국인 지표
```

## 로컬에서 보기

`fetch`로 `data/*.json`을 불러오므로 파일을 직접 열지 말고 로컬 서버로 실행하세요.

```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```

## 데이터 갱신 방법 (현재: 대부분 수동 스냅샷 + 일부 자동)

**KOSIS 금융/외국인 지표 (수동 스냅샷)**
1. 각 지표(`indicator_id`)의 최신 시계열 값을 조회
2. `scripts/fetch_kosis_financial.py` / `scripts/fetch_immigration.py`의 원자료 상수를 새 값으로 교체
3. 스크립트를 실행 → `data/*.json` 재생성 (`meta.json`은 최신 `generated_at` 기준으로 병합)

**DART/ECOS/뉴스 (자동)**
`.github/workflows/update-market.yml`이 매일 자동 실행하며, 새 값이 있을 때만 커밋합니다.
로컬에서 즉시 확인하려면 `DART_API_KEY=... python3 scripts/fetch_dart.py` 처럼 환경변수로 키를
넘기면 됩니다 (커밋/로그에 키를 남기지 마세요).

**국적별 분포 / 국적취득 현황 (아직 미연동, data.go.kr 필요)**
1. [data.go.kr](https://www.data.go.kr)에서 "법무부" + 원하는 통계명으로 검색 → 활용신청 → 서비스키 발급
2. 서비스키는 GitHub Actions Secrets에 저장 (절대 코드/워크플로에 하드코딩 금지 — PROJECT_SPEC.md 섹션 0-1)
3. `scripts/fetch_immigration_datagokr.py`의 `ENDPOINT_URL`과 필드 매핑을 채우면
   `immigration.html`의 남은 준비중 카드가 자동으로 실데이터로 바뀝니다.

## 출처

- KOSIS 국가통계포털(통계청, https://kosis.kr)
- 한국은행 ECOS (https://ecos.bok.or.kr)
- DART 전자공시시스템(금융감독원, https://opendart.fss.or.kr)
- 법무부 출입국·외국인정책본부 (국적별 분포·국적취득 현황은 공공데이터포털 연동 예정, 아직 미연동)
- Google News RSS (뉴스 헤드라인)

본 페이지는 학습·개인용 비공식 시각화이며, 공식 수치는 각 기관 원본에서 확인하세요.
