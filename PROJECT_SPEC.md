# onedata 프로젝트 확장 스펙

이 문서는 기존 KOSIS 대시보드(GitHub Pages, https://andoyeon.github.io/onedata/)를
3개 카테고리(시장 지표 / 외국인 지표 / 데이터 검색) 구조로 확장하기 위한 구현 스펙입니다.
Claude Code는 이 문서를 기준으로 폴더 구조, 데이터 파이프라인, 페이지 컴포넌트를 구현해 주세요.

---

## 0. 핵심 아키텍처 원칙 (중요, 반드시 준수)

이 사이트는 **GitHub Pages 정적 호스팅**입니다. 따라서:

1. **서비스키(API Key)를 클라이언트 JS에 절대 하드코딩하지 않는다.**
2. 데이터 수집은 **GitHub Actions(cron 스케줄)** 가 서버 사이드에서 각 기관 Open API를 호출하고,
   결과를 `data/*.json` 형태의 정적 스냅샷 파일로 리포지토리에 커밋한다.
3. 브라우저(클라이언트)는 외부 API를 직접 호출하지 않고, **repo 내 정적 JSON만 fetch** 한다.
4. 서비스키는 GitHub Actions Secrets에 저장한다 (`KOSIS_API_KEY`, `DART_API_KEY`, `DATA_GO_KR_API_KEY` 등).

이유: 국내 공공 API 다수가 브라우저 CORS를 차단하고, 클라이언트에 키를 넣으면 노출되기 때문입니다.
지금 KOSIS 대시보드가 이미 이 패턴이라면 그 파이프라인 구조를 그대로 재사용/확장하면 됩니다.

### 0-1. 퍼블릭 레포에서 API 키 안전하게 관리하기 (필수 준수)

이 레포는 퍼블릭이므로 아래 원칙을 반드시 지켜서 구현할 것:

1. **키는 오직 GitHub Actions Secrets(Settings → Secrets and variables → Actions)에만 저장.**
   코드, 워크플로 yml, 커밋 히스토리 어디에도 키를 하드코딩하지 않는다.
2. **로그 노출 방지**: 요청 URL에 키를 쿼리파라미터로 넣는 API(KOSIS 등)는 `curl`/요청 로그를 그대로 echo하지 말 것.
   가능하면 워크플로에서 `echo "::add-mask::$API_KEY"` 로 마스킹 처리하거나, 요청 전 로그 출력 자체를 생략한다.
3. **응답 원문을 그대로 커밋하지 않기**: API 응답에 키가 포함되어 반환되는 경우가 있는지 확인하고,
   `data/*.json`에 커밋하기 전 키/토큰 필드는 스크립트에서 제거(strip)한다.
4. **fork PR 워크플로 권한 임의로 확장하지 않기**: GitHub 기본값은 외부 fork의 PR에서 실행되는 워크플로에
   Secrets를 전달하지 않음. 이 기본 동작을 바꾸는 설정(`pull_request_target` 오남용 등)은 하지 않는다.
5. **서드파티 Action은 공식/신뢰도 높은 것만 사용**: 마켓플레이스의 검증되지 않은 Action은 Secrets 접근 시
   유출 경로가 될 수 있으므로 지양한다.
6. **IP 제한형 키 주의**: 발급받은 API가 IP 화이트리스트 방식이면 GitHub Actions runner의 IP가 매번 바뀌어
   동작하지 않을 수 있으니, 서비스키 발급 시 IP 제한 여부를 확인한다.

### 0-2. 필요한 서비스키 목록 (발급 후 GitHub Actions Secrets에 등록)

| Secret 이름 | 발급처 |
|---|---|
| `KOSIS_API_KEY` | kosis.kr → Open API 신청 |
| `DART_API_KEY` | opendart.fss.or.kr → 인증키 신청 |
| `ECOS_API_KEY` | ecos.bok.or.kr → Open API 인증키 신청 |
| `INDEX_API_KEY` | index.go.kr (지표누리) → Open API 서비스 신청 |
| `DATA_GO_KR_API_KEY` | data.go.kr → 법무부 외국인 통계 데이터셋 활용신청 |

이 키들은 전부 **GitHub Actions Secrets**에만 등록한다 (Cloudflare 쪽에는 등록하지 않음 — 데이터 수집은 GitHub Actions가 담당하고 Cloudflare는 결과 정적 파일만 서빙하기 때문).

---

## 1. 데이터 소스 정리

| 카테고리 | 소스 | 연동 방식 | 갱신 주기 |
|---|---|---|---|
| 시장 지표 | KOSIS (통계청) | KOSIS Open API, 서비스키 발급 필요 (kosis.kr) — 시장금리·가계수신·기업대출 등 핵심 데이터 | 항목별 상이 (월/분기) |
| 시장 지표 | DART (금감원 전자공시) | DART Open API, 인증키 발급 필요 (opendart.fss.or.kr) — 시장금리·가계수신·기업대출 등 핵심 데이터 | 공시 발생 시 |
| 시장 지표 | 한국은행 ECOS | ECOS Open API, 인증키 발급 필요 (ecos.bok.or.kr) — 시장금리·가계수신·기업대출 등 핵심 데이터. 웹사이트 연동은 API로 지금 바로 진행 | 월/일 단위 상이 |
| 시장/정책 지표 | 지표누리 (e-나라지표, index.go.kr) | Open API (XML/HTML), 서비스 신청 필요 (index.go.kr) — 부처별 핵심 정책지표 보완용 | 지표별 상이 |
| 외국인 지표 | 법무부(출입국·외국인정책본부) | **공공데이터포털(data.go.kr) Open API** — hikorea.go.kr 직접 크롤링 금지. 인구·이동·체류자격 등 일부는 KOSIS로도 커버 가능, 국적별 세부 분포는 data.go.kr 필요 | 연보(6월말)/월보(매월) |
| 데이터 검색 | 위 소스 전체 + 기타 | 사전 수집한 카탈로그 JSON 내 검색 (실시간 외부 API 검색 아님) | 카탈로그는 주기적 재생성 |

### 1-1. 법무부 외국인 통계 연동 참고
- data.go.kr에서 "법무부" + 원하는 통계명으로 검색 (예: 국적별 체류외국인 현황, 국적별 입국자 현황 등)
- 해당 데이터셋 상세 페이지에서 "활용신청" → 서비스키 발급 → REST(JSON/XML) 호출
- hikorea.go.kr(BIX5)는 JS 렌더링 포털이라 크롤링 부적합 및 약관 리스크 있음 → 사용 금지

---

## 2. 리포지토리 구조 제안

```
/onedata
  /data
    kosis_market.json        # 시장지표 - KOSIS
    dart_market.json         # 시장지표 - DART
    ecos_market.json         # 시장지표 - ECOS (시장금리/가계수신/기업대출 등)
    index_go_kr.json         # 정책지표 - 지표누리(e-나라지표)
    immigration_stats.json   # 외국인 지표
    catalog.json             # 검색용 데이터 카탈로그 (지표명, 출처, 갱신일, 원본링크)
    meta.json                # 전체 최종 갱신 시각 등 공통 메타
  /scripts
    fetch_kosis.py (or .js)
    fetch_dart.py
    fetch_ecos.py
    fetch_index.py
    fetch_immigration.py
    build_catalog.py
  /.github/workflows
    update-market.yml        # KOSIS/DART/ECOS/지표누리 수집 스케줄
    update-immigration.yml   # 법무부 데이터 수집 스케줄
    build-catalog.yml        # 카탈로그 재생성
  /src (또는 루트, 기존 구조에 맞춰서)
    index.html
    market.html   (또는 SPA 라우트 /market)
    immigration.html
    search.html
    /css
      tokens.css   # 디자인 토큰
      components.css
    /js
      render-cards.js
      render-charts.js
      search.js
```

기존 KOSIS 페이지가 이미 다른 구조로 되어 있다면 억지로 옮기지 말고,
**"수집 스크립트 + Actions 워크플로 + 정적 JSON" 3단 구조만 동일하게 유지**하면 됩니다.

---

## 3. 사이트 정보 구조 (IA)

```
GNB: [시장 지표] [외국인 지표] [데이터 검색]   (+ 최종 갱신 시각 전역 표시)
```

### 3-1. 시장 지표 페이지
- 현재 KOSIS / DART / ECOS / 지표누리 4개 사이트 서비스키 모두 발급·등록 완료 상태 → "준비중" 없이 4곳 데이터를 바로 연동
- 서브 카테고리 필터 칩과 소스 매핑:
  - **시장금리** ← ECOS (한국은행)
  - **가계수신** ← ECOS (한국은행)
  - **기업대출** ← ECOS (한국은행)
  - **카드소비** ← KOSIS 또는 지표누리 (지표 존재 여부 확인 후 매핑, 없으면 추후 별도 소스 검토)
  - 그 외 보조 지표(기업 재무·공시 관련) ← DART
- 레이아웃: 상단 요약 카드 그리드 → 하단 지표 선택 시 시계열 라인차트
- 카드 클릭 → 해당 지표 상세(차트 확대 + 표)
- 카드 하단에 출처 배지 표시(ECOS/KOSIS/DART/지표누리 중 어디서 온 데이터인지 구분)

### 3-2. 외국인 지표 페이지
- 주 소스: data.go.kr(법무부 출입국·외국인정책본부) — 국적별 세부 분포 등
- 보조 소스: KOSIS에도 외국인 등록인구/이동(입출국)/체류자격별 비율/혼인 등 지표가 있으므로,
  data.go.kr 연동 전이라도 KOSIS만으로 우선 카드 채우기 가능 (섹션 1 참고)
- 핵심 요약 카드: 체류외국인 총수 / 전년대비 증감률 / 연간 입국자수 / 국적취득 현황
- 시각화: 국적별 분포(막대 또는 도넛), 체류자격별 분포, 연도별 추이(라인)
- 출처 고지 문구 필수: 데이터 출처에 따라 "법무부 출입국·외국인정책본부(공공데이터포털 제공)" 또는 "KOSIS 국가통계포털" 명시

### 3-3. 데이터 검색 페이지
- 검색창 + 카테고리 필터(통계청 / 금감원 / 법무부 / 기타)
- `catalog.json` 내 클라이언트 사이드 검색 (fuse.js 등 가벼운 라이브러리 사용 가능)
- 결과 카드: 지표명 / 출처 / 최근 갱신일 / 원본 링크(아웃링크) 또는 자체 상세뷰

---

## 4. 디자인 템플릿 스펙

### 4-1. 디자인 토큰 (CSS 변수로 정의)

```css
:root {
  /* 카테고리별 accent 컬러 */
  --accent-market: #2563eb;       /* 시장지표: 블루 */
  --accent-immigration: #059669;  /* 외국인지표: 그린 */
  --accent-search: #6b7280;       /* 검색: 뉴트럴 그레이 */

  /* 상승/하락 (통일해서 한 쌍만 사용) */
  --color-up: #dc2626;
  --color-down: #2563eb;

  /* 베이스 */
  --bg: #ffffff;
  --surface: #f8fafc;
  --border: #e2e8f0;
  --text-primary: #0f172a;
  --text-secondary: #64748b;

  /* 타이포 */
  --font-sans: 'Pretendard', -apple-system, sans-serif;
  --font-mono-num: 'Pretendard', 'Roboto Mono', monospace; /* 숫자 tabular-nums */

  /* 간격 */
  --space-1: 4px; --space-2: 8px; --space-3: 16px; --space-4: 24px; --space-5: 40px;

  /* 라운드/그림자 */
  --radius-card: 12px;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.06);
}

/* 다크모드는 선택사항: prefers-color-scheme 기반 대응 권장 */
```

숫자는 반드시 `font-variant-numeric: tabular-nums;` 적용 (자릿수 정렬).

### 4-2. 공통 컴포넌트: 지표 카드

구성 요소:
- 지표명 (text-secondary, 14px)
- 최근 값 (text-primary, 28~32px, bold, tabular-nums)
- 전기 대비 증감 (▲/▼ 아이콘 + 색상: --color-up / --color-down)
- 미니 스파크라인 (SVG 또는 Chart.js sparkline, accent 컬러 사용)
- 카드 스타일: `background: var(--surface); border-radius: var(--radius-card); box-shadow: var(--shadow-card); padding: var(--space-3);`

### 4-3. 차트
- 라이브러리: Chart.js (CDN, 정적 사이트에 가볍게 addable)
- 라인차트 색상은 해당 카테고리의 accent 컬러 사용
- 툴팁에 시점/값 표시, 반응형(responsive: true) 필수

### 4-4. 탭/네비게이션
- 상단 고정 GNB, 현재 탭은 해당 카테고리 accent 컬러로 밑줄 강조
- 모바일 대응: GNB를 하단 탭바 또는 햄버거로 전환 (반응형 breakpoint 768px 기준)

### 4-5. 검색 페이지 결과 카드
- 지표명 (bold) / 출처 배지(카테고리 accent 컬러의 연한 배경 pill) / 갱신일(text-secondary) / "원본 보기" 링크

---

## 5. 구현 순서 (Claude Code에 순서대로 요청 권장)

1. 디자인 토큰 CSS + 공통 카드/차트 컴포넌트 뼈대 구현
2. **시장 지표 탭**: KOSIS/DART/ECOS/지표누리 4개 fetch 스크립트 + Actions 워크플로(`update-market.yml`) 작성
   → 이미 4개 서비스키 등록 완료 상태이므로 바로 진행 가능. 각 지표를 3-1의 서브카테고리(시장금리/가계수신/기업대출/카드소비)에 매핑
3. **외국인 지표 탭**: 우선 KOSIS 기존 지표(외국인 등록인구, 이동, 체류자격별 비율 등)로 카드 채우고,
   이어서 data.go.kr 법무부 데이터셋 연동 스크립트 작성해 국적별 세부 분포 등 보강
4. `build_catalog.py`로 카탈로그 JSON 생성 → 검색 탭(3-3) 구현
5. (추후) MCP 서버로 감싸서 카카오 PlayMCP 등록 신청 — 웹사이트 운영과는 별도 트랙

---

## 6. Claude Code에게 전달 시 프롬프트 예시

```
PROJECT_SPEC.md 문서를 읽어줘. KOSIS/DART/ECOS/지표누리 4개 서비스키는
이미 GitHub Actions Secrets에 등록해뒀어(KOSIS_API_KEY, DART_API_KEY,
ECOS_API_KEY, INDEX_API_KEY). 섹션 5의 순서 2번부터 진행해줘:
4개 사이트 fetch 스크립트와 update-market.yml 워크플로를 만들어서
"시장 지표" 탭(시장금리/가계수신/기업대출/카드소비)을 완성해줘.
요청 URL이나 키 값은 절대 로그로 출력하지 마 (0-1 섹션 참고).
```
