#!/usr/bin/env python3
"""Build data/kosis_financial.json — 금융 지표 전용 (KOSIS).

이 파일은 시장 지표 탭의 유일한 KOSIS 데이터 소스입니다. 인구·물가·고용·혼인 같은
비금융 지표(예전 fetch_kosis.py/kosis_market.json)는 금융과 무관해 완전히 제외했습니다.

포함 서브카테고리:
- 시장금리 ← 시장금리(id 1202), 중앙은행 정책금리(id 1203)
- 가계수신 ← 예금은행총예금(말잔) (id 669)
- 가계대출 ← 예금취급기관 가계대출 (id 674)
- 카드소비 ← 신용카드 개인이용금액 (id 686)
- 환율   ← 원/달러 환율 (id 1209, item="한국")
- 기업대출 ← KOSIS 100대 지표 카탈로그에 없음. ECOS 연동 전까지 프런트에서 "준비중" 카드.

Raw series fetched via the koreaStat MCP tools on 2026-07-05.

TODO (섹션 0/5-2): hand-fetched snapshot, not yet a live GitHub Actions +
KOSIS Open API pipeline (needs per-indicator tblId/objL1/itmId).
"""
import json
import os

GENERATED_AT = "2026-07-05T00:00:00+09:00"


def parse_num(s):
    return float(str(s).replace(",", ""))


META = {
    "1202": {"name": "시장금리", "subcategory": "시장금리", "unit": "연리%"},
    "1203": {"name": "중앙은행 정책금리", "subcategory": "시장금리", "unit": "연리%"},
    "669": {"name": "예금은행총예금(말잔)", "subcategory": "가계수신", "unit": "십억원"},
    "674": {"name": "예금취급기관 가계대출", "subcategory": "가계대출", "unit": "십억원"},
    "686": {"name": "신용카드 개인이용금액", "subcategory": "카드소비", "unit": "백만원"},
    "1209": {"name": "원/달러 환율", "subcategory": "환율", "unit": "원"},
}

RAW = {
    "1202": [
        ("2010", "2.16"), ("2011", "3.09"), ("2012", "3.08"), ("2013", "2.59"),
        ("2014", "2.34"), ("2015", "1.65"), ("2016", "1.34"), ("2017", "1.26"),
        ("2018", "1.52"), ("2019", "1.59"), ("2020", "0.70"), ("2021", "0.61"),
        ("2022", "2.03"), ("2023", "3.51"), ("2024", "3.44"),
    ],
    "1203": [
        ("2010", "2.50"), ("2011", "3.25"), ("2012", "2.75"), ("2013", "2.50"),
        ("2014", "2.00"), ("2015", "1.50"), ("2016", "1.25"), ("2017", "1.50"),
        ("2018", "1.75"), ("2019", "1.25"), ("2020", "0.50"), ("2021", "1.00"),
        ("2022", "3.25"), ("2023", "3.50"), ("2024", "3.00"),
    ],
    "669": [
        ("202405", "2,015,348.6"), ("202406", "2,054,718.5"), ("202407", "2,026,573.5"),
        ("202408", "2,050,600.5"), ("202409", "2,070,818.2"), ("202410", "2,072,068.2"),
        ("202411", "2,082,831.7"), ("202412", "2,100,017.8"), ("202501", "2,073,334.0"),
        ("202502", "2,098,313.7"), ("202503", "2,124,660.2"), ("202504", "2,092,132.3"),
        ("202505", "2,112,820.9"), ("202506", "2,150,300.2"), ("202507", "2,136,930.6"),
        ("202508", "2,162,522.3"), ("202509", "2,198,983.7"), ("202510", "2,170,626.6"),
        ("202511", "2,185,935.3"), ("202512", "2,189,735.6"), ("202601", "2,148,225.3"),
        ("202602", "2,198,203.4"), ("202603", "2,222,685.0"), ("202604", "2,216,677.5"),
    ],
    "674": [
        ("202405", "930,889.4"), ("202406", "936,505.0"), ("202407", "942,675.3"),
        ("202408", "952,792.7"), ("202409", "959,175.6"), ("202410", "962,163.6"),
        ("202411", "965,184.3"), ("202412", "966,097.2"), ("202501", "966,770.6"),
        ("202502", "971,478.4"), ("202503", "974,475.1"), ("202504", "980,695.9"),
        ("202505", "986,280.8"), ("202506", "993,745.7"), ("202507", "997,762.2"),
        ("202508", "1,002,077.5"), ("202509", "1,003,838.1"), ("202510", "1,007,775.5"),
        ("202511", "1,010,585.7"), ("202512", "1,009,847.0"), ("202601", "1,008,293.1"),
        ("202602", "1,008,978.0"), ("202603", "1,009,606.9"), ("202604", "1,011,465.1"),
    ],
    "686": [
        ("202404", "69,635,523"), ("202405", "71,470,287"), ("202406", "69,465,828"),
        ("202407", "72,481,951"), ("202408", "71,014,563"), ("202409", "70,148,013"),
        ("202410", "73,065,817"), ("202411", "71,922,129"), ("202412", "73,073,496"),
        ("202501", "70,415,777"), ("202502", "68,907,283"), ("202503", "73,276,893"),
        ("202504", "71,797,010"), ("202505", "73,998,501"), ("202506", "71,945,249"),
        ("202507", "75,869,746"), ("202508", "73,184,139"), ("202509", "74,544,442"),
        ("202510", "73,832,191"), ("202511", "75,211,668"), ("202512", "76,480,638"),
        ("202601", "76,106,837"), ("202602", "70,112,719"), ("202603", "78,674,829"),
    ],
    "1209": [
        ("2010", "1,156.00"), ("2011", "1,107.99"), ("2012", "1,126.76"), ("2013", "1,095.04"),
        ("2014", "1,053.12"), ("2015", "1,131.52"), ("2016", "1,160.41"), ("2017", "1,130.48"),
        ("2018", "1,100.58"), ("2019", "1,166.11"), ("2020", "1,180.01"), ("2021", "1,144.61"),
        ("2022", "1,292.20"), ("2023", "1,305.93"), ("2024", "1,364.38"),
    ],
}

ORDER = ["1202", "1203", "669", "674", "686", "1209"]

# 기업대출은 KOSIS에 없어 프런트에서 준비중 카드로 표시.
SUBCATEGORIES = ["시장금리", "가계수신", "가계대출", "기업대출", "카드소비", "환율"]


def period_sort_key(period: str) -> int:
    return int(period) * 100 if len(period) == 4 else int(period)


indicators = []
for iid in ORDER:
    meta = META[iid]
    series = [{"period": p, "value": parse_num(v)} for p, v in RAW[iid]]
    latest = series[-1]
    prev = series[-2] if len(series) > 1 else None
    delta = None
    delta_pct = None
    if prev is not None and prev["value"] != 0:
        delta = latest["value"] - prev["value"]
        delta_pct = delta / prev["value"] * 100
    indicators.append({
        "id": iid,
        "name": meta["name"],
        "category": meta["subcategory"],
        "unit": meta["unit"],
        "area": "전국",
        "period_type": "연간" if len(latest["period"]) == 4 else "월간",
        "series": series,
        "latest_period": latest["period"],
        "latest_value": latest["value"],
        "delta": delta,
        "delta_pct": delta_pct,
    })

indicators.sort(key=lambda i: period_sort_key(i["latest_period"]), reverse=True)

out = {
    "generated_at": GENERATED_AT,
    "source": "KOSIS 국가통계포털 (통계청)",
    "category": "market-financial",
    "subcategories": SUBCATEGORIES,
    "indicators": indicators,
}

data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
out_path = os.path.join(data_dir, "kosis_financial.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f"wrote {len(indicators)} indicators -> {out_path}")

meta_path = os.path.join(data_dir, "meta.json")
try:
    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)
except FileNotFoundError:
    meta = {"sources": []}

meta["last_updated"] = max(GENERATED_AT, meta.get("last_updated", GENERATED_AT))
sources = {s["id"]: s for s in meta.get("sources", [])}
sources["kosis_financial"] = {
    "id": "kosis_financial",
    "label": "KOSIS 국가통계포털 (통계청) - 금융 지표",
    "category": "market-financial",
    "path": "data/kosis_financial.json",
    "last_updated": GENERATED_AT,
}
meta["sources"] = list(sources.values())

with open(meta_path, "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False, indent=2)

print(f"updated {meta_path}")
