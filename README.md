# onedata — 국내 공공데이터 대시보드

시장 지표(KOSIS/DART) · 외국인 지표(법무부) · 데이터 검색을 한 사이트에서 보여주는
정적 웹 페이지입니다. 구현 스펙 전체는 [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) 참고.

## 구현 현황

PROJECT_SPEC.md 섹션 5 순서 기준:

- [x] **1. 디자인 토큰 + 공통 카드/차트 컴포넌트 뼈대** — `css/tokens.css`, `css/components.css`,
      `js/render-cards.js`, `js/render-charts.js`. 기존 KOSIS 대시보드(`index.html`)를 이 위에서 재구성.
- [ ] 2. DART 수집 스크립트 + Actions 워크플로 → 시장 지표 페이지 완성
- [ ] 3. data.go.kr 법무부 외국인 통계 연동 → 외국인 지표 페이지
- [ ] 4. `build_catalog.py` + 검색 페이지
- [ ] 5. (추후) ECOS 연동

**알려진 차이점**: 현재 `data/kosis_market.json`은 실시간 KOSIS Open API 호출이 아니라
수동으로 가져온 스냅샷입니다. PROJECT_SPEC.md 섹션 0의 원칙(서비스키는 GitHub Actions
Secrets에서만 사용, 브라우저는 정적 JSON만 fetch)은 이미 지키고 있지만, "Actions cron이
서버사이드에서 API를 호출"하는 자동 갱신 파이프라인 자체는 아직 없습니다 — 섹션 5 순서 2에서
DART 파이프라인을 추가할 때 KOSIS도 같은 패턴(Actions + 서비스키 Secret)으로 전환 예정입니다.

또한 시장 지표 페이지의 카테고리 필터는 스펙 3-1의 서브카테고리(시장금리/가계수신/기업대출/카드소비,
ECOS 대상)가 아니라 현재 보유한 KOSIS 지표의 실제 분류(인구/물가/고용/인구동향/금융)를 사용합니다.
ECOS 연동 전까지는 이 상태를 유지합니다.

## 리포지토리 구조

```
/onedata
  /data
    kosis_market.json   # 시장지표 - KOSIS 스냅샷
    meta.json           # 데이터 소스 목록 + 최종 갱신 시각
  /scripts
    fetch_kosis.py       # kosis_market.json / meta.json 생성 스크립트
  /css
    tokens.css           # 디자인 토큰 (accent 컬러, 상승/하락 컬러, 간격 등)
    components.css        # 공통 컴포넌트 (지표 카드, 차트 카드, 테이블, 툴팁)
  /js
    render-cards.js       # 지표 카드 + 스파크라인 렌더러
    render-charts.js      # SVG 라인차트 렌더러 (호버 크로스헤어/툴팁, 표 보기 토글)
    app.js                # 시장 지표 페이지 진입점 (fetch → 카드/차트/검색 렌더)
  index.html
```

## 페이지 구성 (현재: 시장 지표만)

1. **최근 발표 지표** — 주요 지표의 최신 값과 직전 시점 대비 증감을 카드로 표시
2. **지표별 추이** — 카테고리 필터 + 시계열 꺾은선 그래프 (호버로 시점별 값 확인, "표로 보기"로 원자료 확인)
3. **최근 발표된 월간 지표** — KOSIS 월간 수록 지표 중 최근 갱신 항목 목록 (검색 가능)

라이트/다크 테마는 `prefers-color-scheme`을 따릅니다.

## 로컬에서 보기

`fetch`로 `data/kosis_market.json`을 불러오므로 파일을 직접 열지 말고 로컬 서버로 실행하세요.

```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```

## 데이터 갱신 방법 (현재: 수동 스냅샷)

1. 각 지표(`indicator_id`)의 최신 시계열 값을 조회
2. `scripts/fetch_kosis.py`의 `RAW` 딕셔너리와 `RECENT_RELEASES` 목록을 새 값으로 교체
3. `python3 scripts/fetch_kosis.py` 실행 → `data/kosis_market.json`, `data/meta.json` 재생성

## 출처

- KOSIS 국가통계포털(통계청, https://kosis.kr)

본 페이지는 학습·개인용 비공식 시각화이며, 공식 수치는 각 기관 원본에서 확인하세요.
