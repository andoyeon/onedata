#!/usr/bin/env python3
"""Fetch 시장금리/가계수신/기업대출 from the Bank of Korea ECOS Open API.

Uses ECOS's KeyStatisticList endpoint (100대 통계지표) — a curated list of
~100 headline indicators searchable by name, the same style of API our
KOSIS 100대지표 integration already relies on. This avoids needing to
pre-know a 통계표코드(stat_code)/통계항목코드(item_code) for
StatisticSearch, which we could not safely verify.

The service key is read from the ECOS_API_KEY environment variable, set
via GitHub Actions Secrets in .github/workflows/update-market.yml.

Security (PROJECT_SPEC.md 섹션 0-1): ECOS embeds the key directly in the
URL PATH (not a query param). This script never prints or logs the built
URL or the key — only sanitized indicator names / status info.

⚠️ Known limitation: KeyStatisticList only returns each indicator's single
latest value, not a history, so the "series" written here is a single
point per indicator (real, not fabricated) rather than a multi-period
time series. Backfilling history needs the indicator's real StatisticSearch
stat_code/item_code, which isn't exposed by this endpoint — see README.
"""
import json
import os
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone

API_KEY = os.environ.get("ECOS_API_KEY")
BASE_URL = "https://ecos.bok.or.kr/api/KeyStatisticList"

# PROJECT_SPEC.md 섹션 3-1: 시장금리/가계수신/기업대출 모두 ECOS 소스.
# 각 서브카테고리를 100대 지표의 KEYSTAT_NAME에서 찾을 키워드 목록(정규식, 첫 매칭 사용).
KEYWORD_MAP = {
    "시장금리": r"기준금리|콜금리|국고채|시장금리|CD금리",
    "가계수신": r"수신|예금",
    "기업대출": r"기업.*대출|대출.*기업",
}


def fetch_key_statistics():
    if not API_KEY:
        print("ECOS_API_KEY is not set — skipping ECOS fetch.")
        return None

    url = "/".join([BASE_URL, API_KEY, "json", "kr", "1", "100"])
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = json.load(resp)
    except urllib.error.URLError:
        print("ECOS request failed (network error).")
        return None
    except json.JSONDecodeError:
        print("ECOS response was not valid JSON.")
        return None

    if "RESULT" in data:
        # ECOS returns {"RESULT": {"CODE": ..., "MESSAGE": ...}} on error.
        # CODE/MESSAGE are ECOS-defined and never contain the key or URL.
        result = data["RESULT"]
        print(f"ECOS API error {result.get('CODE')}: {result.get('MESSAGE')}")
        return None

    return data.get("KeyStatisticList", {}).get("row", [])


def build_indicators(rows):
    indicators = []
    for name, pattern in KEYWORD_MAP.items():
        match = next((r for r in rows if re.search(pattern, r.get("KEYSTAT_NAME", ""))), None)
        if not match:
            print(f"[{name}] no matching ECOS 100대지표 entry found — skipping.")
            continue
        try:
            value = float(str(match.get("DATA_VALUE", "")).replace(",", ""))
        except ValueError:
            print(f"[{name}] ECOS DATA_VALUE was not numeric — skipping.")
            continue
        period = match.get("P_TIME", "")
        indicators.append({
            "name": match.get("KEYSTAT_NAME", name),
            "category": name,
            "unit": match.get("UNIT_NAME", ""),
            "area": "전국",
            "period_type": {"Y": "연간", "H": "반기", "Q": "분기", "M": "월간", "D": "일간"}.get(match.get("CYCLE"), match.get("CYCLE", "")),
            "series": [{"period": period, "value": value}],
            "latest_period": period,
            "latest_value": value,
            "delta": None,
        })
    return indicators


def main():
    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    out_path = os.path.join(data_dir, "ecos_market.json")

    rows = fetch_key_statistics()
    if rows is None:
        print(f"No ECOS data fetched; leaving {out_path} untouched.")
        return

    indicators = build_indicators(rows)
    if not indicators:
        print(f"No matching ECOS indicators found; leaving {out_path} untouched.")
        return

    out = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00"),
        "source": "한국은행 ECOS",
        "category": "market-financial-ecos",
        "indicators": indicators,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"wrote {len(indicators)} ECOS indicators -> {out_path}")


if __name__ == "__main__":
    main()
