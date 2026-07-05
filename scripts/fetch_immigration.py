#!/usr/bin/env python3
"""Build data/immigration_stats.json (외국인 지표) from KOSIS snapshots.

Unlike PROJECT_SPEC.md 섹션 1-1's plan (data.go.kr 법무부 Open API), it turns
out KOSIS 100대 지표 자체가 법무부 출입국통계를 일부 재수록하고 있어 별도
data.go.kr 서비스키 없이도 아래 항목은 채울 수 있다:
  - 체류외국인 총수 / 전년대비 증감률 / 연도별 추이  <- 외국인 등록인구(전체)
    id=175 (전국, 연간) — 등록외국인 기준 공식 수치
  - 연간 입국자수                                    <- 외국인 이동(입국자) id=178
  - 최근 월별 국제순이동                              <- 외국인 이동(국제순이동) id=180
    (전국, 월간) — 등록인구보다 훨씬 최신 흐름을 보여줌
  - 외국인과의 혼인건수                               <- 외국인과의 혼인건수 id=2344
    (전국, 연간)
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

# 외국인 등록인구(전체), 전국, 연간 (KOSIS id 175)
REGISTERED_TOTAL = {
    2012: 932983, 2013: 985923, 2014: 1091531, 2015: 1143087, 2016: 1161677,
    2017: 1171762, 2018: 1246626, 2019: 1271807, 2020: 1145540, 2021: 1093891,
    2022: 1189585, 2023: 1348626, 2024: 1488353,
}

# 외국인 이동(입국자), 전국, 연간, 명 (KOSIS id 178)
ENTRANTS = {
    2015: 372935, 2016: 402203, 2017: 452657, 2018: 495079, 2019: 438220,
    2020: 233133, 2021: 220571, 2022: 412948, 2023: 479768, 2024: 450867,
}

# 외국인 이동(국제순이동), 전국, 월간, 명 (KOSIS id 180) — 최근 24개월
NET_MIGRATION_MONTHLY = [
    ("202401", 1319), ("202402", 19360), ("202403", 31952), ("202404", 17047),
    ("202405", 9254), ("202406", -5427), ("202407", -97), ("202408", 31871),
    ("202409", 18274), ("202410", 1211), ("202411", -11946), ("202412", -15062),
    ("202501", -12218), ("202502", 17352), ("202503", 31320), ("202504", 13837),
    ("202505", 5127), ("202506", -8196), ("202507", -8640), ("202508", 27514),
    ("202509", 16855), ("202510", 4837), ("202511", -16345), ("202512", -21256),
]

# 외국인과의 혼인건수, 전국, 연간, 건 (KOSIS id 2344)
FOREIGN_MARRIAGES = {
    2016: 20591, 2017: 20835, 2018: 22698, 2019: 23643, 2020: 15341,
    2021: 13102, 2022: 16666, 2023: 19717, 2024: 20759, 2025: 20701,
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


total_series = [{"period": str(y), "value": v} for y, v in sorted(REGISTERED_TOTAL.items())]
entrants_series = [{"period": str(y), "value": v} for y, v in sorted(ENTRANTS.items())]
net_migration_series = [{"period": p, "value": v} for p, v in NET_MIGRATION_MONTHLY]
marriages_series = [{"period": str(y), "value": v} for y, v in sorted(FOREIGN_MARRIAGES.items())]

total_summary = make_summary(total_series, "명")
entrants_summary = make_summary(entrants_series, "명")
net_migration_summary = make_summary(net_migration_series, "명")
marriages_summary = make_summary(marriages_series, "건")

out = {
    "generated_at": GENERATED_AT,
    "source": "KOSIS 국가통계포털 (통계청, 원자료: 법무부 출입국·외국인정책본부)",
    "stat_cards": {
        "total_foreign_residents": {"name": "외국인 등록인구(체류외국인 총수)", **total_summary},
        "yoy_change_rate": {
            "name": "전년대비 증감률",
            "unit": "%",
            "latest_period": total_summary["latest_period"],
            "latest_value": total_summary["delta_pct"],
        },
        "annual_entrants": {"name": "연간 입국자수", **entrants_summary},
        "foreign_marriages": {"name": "외국인과의 혼인건수", **marriages_summary},
        "naturalization": None,
    },
    "visa_status_distribution": {
        "period": "2024",
        "unit": "%",
        "note": "방문취업/결혼이민/영주/재외동포/유학 5개 항목은 KOSIS 수록값이며, 기타는 100%에서 이를 뺀 잔여치(비전문취업·전문인력 등)입니다.",
        "categories": [{"label": k, "value": v} for k, v in VISA_SHARE_2024.items()],
    },
    "net_migration_trend": {"name": "외국인 국제순이동(최근 월별)", **net_migration_summary},
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
