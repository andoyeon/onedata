#!/usr/bin/env python3
"""Build data/immigration_stats.json (외국인 지표) from KOSIS snapshots.

Unlike PROJECT_SPEC.md 섹션 1-1's plan (data.go.kr 법무부 Open API), it turns
out KOSIS 100대 지표 자체가 법무부 출입국통계를 일부 재수록하고 있어 별도
data.go.kr 서비스키 없이도 아래 항목은 채울 수 있다:
  - 체류외국인 총수 / 전년대비 증감률 / 연도별 추이  <- 외국인(남자) id=2299 +
    외국인(여자) id=2300 (전국, 연간) 합산
  - 연간 입국자수                                    <- 외국인 이동(입국자) id=178
  - 체류자격별 분포                                   <- 체류자격별 외국인 입국자
    비율 id=181~185 (방문취업/결혼이민/영주/재외동포/유학, 전국, 연간)

KOSIS 100대 지표에는 없어서 여전히 미제공인 항목 (data.go.kr 서비스키 필요):
  - 국적취득 현황 (귀화)
  - 국적별 분포

Raw values fetched via the koreaStat MCP tools on 2026-07-05.
"""
import json
import os

GENERATED_AT = "2026-07-05T00:00:00+09:00"

MALE = {
    2015: 788663, 2016: 815467, 2017: 845663, 2018: 945641, 2019: 1017408,
    2020: 942619, 2021: 906507, 2022: 968784, 2023: 1093129, 2024: 1164444,
}
FEMALE = {
    2015: 575049, 2016: 598291, 2017: 633584, 2018: 705920, 2019: 761510,
    2020: 753024, 2021: 743460, 2022: 783562, 2023: 842021, 2024: 878300,
}
ENTRANTS = {
    2015: 372935, 2016: 402203, 2017: 452657, 2018: 495079, 2019: 438220,
    2020: 233133, 2021: 220571, 2022: 412948, 2023: 479768, 2024: 450867,
}

# 체류자격별 외국인 입국자 비율(%), 2024년, 전국 (KOSIS id 181~185)
VISA_SHARE_2024 = {
    "방문취업": 5.2,
    "결혼이민": 2.8,
    "영주": 1.4,
    "재외동포": 10.4,
    "유학": 12.3,
}
_known_total = sum(VISA_SHARE_2024.values())
VISA_SHARE_2024["기타"] = round(100 - _known_total, 1)

years = sorted(MALE.keys())
total_series = [{"period": str(y), "value": MALE[y] + FEMALE[y]} for y in years]
entrants_series = [{"period": str(y), "value": ENTRANTS[y]} for y in years]

def make_summary(series, unit):
    latest = series[-1]
    prev = series[-2]
    delta = latest["value"] - prev["value"]
    delta_pct = delta / prev["value"] * 100 if prev["value"] else None
    return {
        "unit": unit,
        "series": series,
        "latest_period": latest["period"],
        "latest_value": latest["value"],
        "delta": delta,
        "delta_pct": delta_pct,
    }

total_summary = make_summary(total_series, "명")
entrants_summary = make_summary(entrants_series, "명")

out = {
    "generated_at": GENERATED_AT,
    "source": "KOSIS 국가통계포털 (통계청, 원자료: 법무부 출입국·외국인정책본부)",
    "stat_cards": {
        "total_foreign_residents": {"name": "체류외국인 총수", **total_summary},
        "yoy_change_rate": {
            "name": "전년대비 증감률",
            "unit": "%",
            "latest_period": total_summary["latest_period"],
            "latest_value": total_summary["delta_pct"],
        },
        "annual_entrants": {"name": "연간 입국자수", **entrants_summary},
        "naturalization": None,
    },
    "visa_status_distribution": {
        "period": "2024",
        "unit": "%",
        "note": "방문취업/결혼이민/영주/재외동포/유학 5개 항목은 KOSIS 수록값이며, 기타는 100%에서 이를 뺀 잔여치(비전문취업·전문인력 등)입니다.",
        "categories": [{"label": k, "value": v} for k, v in VISA_SHARE_2024.items()],
    },
    "nationality_distribution": None,
}

data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
out_path = os.path.join(data_dir, "immigration_stats.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f"wrote {out_path}")

meta_path = os.path.join(data_dir, "meta.json")
try:
    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)
except FileNotFoundError:
    meta = {"sources": []}

meta["last_updated"] = max(GENERATED_AT, meta.get("last_updated", GENERATED_AT))
sources = {s["id"]: s for s in meta.get("sources", [])}
sources["immigration_stats"] = {
    "id": "immigration_stats",
    "label": "KOSIS 국가통계포털 (원자료: 법무부 출입국·외국인정책본부) - 외국인 지표",
    "category": "immigration",
    "path": "data/immigration_stats.json",
    "last_updated": GENERATED_AT,
}
meta["sources"] = list(sources.values())

with open(meta_path, "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False, indent=2)

print(f"updated {meta_path}")
