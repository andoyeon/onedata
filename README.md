# data_dic — KOSIS 데이터 대시보드

KOSIS(국가통계포털) 주요 지표를 최근 발표 순으로 정리하고 시각화하는 정적 웹 페이지입니다.

## 구성

- `index.html`, `assets/style.css`, `assets/app.js` — 대시보드 페이지 (외부 의존성 없는 순수 HTML/CSS/JS)
- `data/kosis_data.json` — 대시보드가 읽어오는 지표 스냅샷 데이터
- `scripts/build_data.py` — 위 JSON을 생성하는 스크립트 (새 데이터로 갱신할 때 재실행)

## 페이지 구성

1. **최근 발표 지표** — 주요 지표의 최신 값과 직전 시점 대비 증감을 카드로 표시
2. **지표별 추이** — 인구·물가·고용·인구동향·금융 카테고리로 필터링 가능한 시계열 꺾은선 그래프 (마우스 오버 시 시점별 값 표시, "표로 보기"로 원자료 확인 가능)
3. **최근 발표된 월간 지표** — KOSIS 월간 수록 지표 중 최근 갱신 항목 목록 (검색 가능)

라이트/다크 테마를 모두 지원합니다 (헤더 우측 버튼으로 전환).

## 로컬에서 보기

`fetch`로 `data/kosis_data.json`을 불러오므로 파일을 직접 열지 말고 간단한 로컬 서버로 실행하세요.

```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```

## 데이터 갱신 방법

`data/kosis_data.json`의 데이터는 KOSIS `koreaStat` 지표 조회 도구로 가져온 스냅샷입니다.
최신 데이터로 갱신하려면:

1. 각 지표(`indicator_id`)의 최신 시계열 값을 조회
2. `scripts/build_data.py`의 `RAW` 딕셔너리와 `RECENT_RELEASES` 목록을 새 값으로 교체
3. `python3 scripts/build_data.py` 실행 → `data/kosis_data.json` 재생성

## 출처

KOSIS 국가통계포털(통계청, https://kosis.kr). 본 페이지는 학습·개인용 비공식 시각화이며, 공식 수치는 KOSIS에서 확인하세요.
