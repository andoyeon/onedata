#!/usr/bin/env python3
"""Fetch 시장금리/가계수신/기업대출 from the Bank of Korea ECOS Open API.

Uses the ECOS StatisticSearch endpoint. The service key is read from the
ECOS_API_KEY environment variable, set via GitHub Actions Secrets in
.github/workflows/update-market.yml.

Security (PROJECT_SPEC.md 섹션 0-1): ECOS embeds the key directly in the
URL PATH (not a query param), which makes it even easier to leak by
accident. This script never prints or logs the built URL or the key —
only sanitized stat_code/status info.

⚠️ CONFIG REQUIRED before this script does anything useful: each ECOS
통계표(stat_code) and 통계항목(item_code) below is a placeholder. Look up
the real codes at https://ecos.bok.or.kr → 100대 통계지표 or 통계검색 →
"코드" 보기, then fill them in. Until a config entry has both stat_code
and item_code1 set, this script skips it (prints a safe warning, writes
nothing wrong) rather than guessing.
"""
import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

API_KEY = os.environ.get("ECOS_API_KEY")
BASE_URL = "https://ecos.bok.or.kr/api/StatisticSearch"

# PROJECT_SPEC.md 섹션 3-1 서브카테고리. Fill in real codes from ecos.bok.or.kr.
CONFIG = {
    "시장금리": {
        "stat_code": None,   # e.g. "817Y002" — VERIFY at ecos.bok.or.kr before use
        "item_code1": None,
        "cycle": "M",        # D/M/Q/Y
        "unit": "%",
    },
    "가계수신": {
        "stat_code": None,   # e.g. a 예금은행 수신 관련 table — VERIFY
        "item_code1": None,
        "cycle": "M",
        "unit": "십억원",
    },
    "기업대출": {
        "stat_code": None,   # not yet identified — VERIFY
        "item_code1": None,
        "cycle": "M",
        "unit": "십억원",
    },
}


def fetch_series(name, cfg, months=24):
    if not API_KEY:
        print("ECOS_API_KEY is not set — skipping ECOS fetch.")
        return None
    if not cfg.get("stat_code") or not cfg.get("item_code1"):
        print(f"[{name}] ECOS stat_code/item_code not configured yet — skipping.")
        return None

    now = datetime.now(timezone.utc)
    end_date = now.strftime("%Y%m")
    start_date = (now - timedelta(days=31 * months)).strftime("%Y%m")

    path_parts = [
        BASE_URL,
        API_KEY,
        "json",
        "kr",
        "1",
        "1000",
        cfg["stat_code"],
        cfg["cycle"],
        start_date,
        end_date,
        cfg["item_code1"],
    ]
    url = "/".join(path_parts)

    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = json.load(resp)
    except urllib.error.URLError:
        print(f"[{name}] ECOS request failed (network error).")
        return None
    except json.JSONDecodeError:
        print(f"[{name}] ECOS response was not valid JSON.")
        return None

    if "RESULT" in data:
        # ECOS returns {"RESULT": {"CODE": ..., "MESSAGE": ...}} on error.
        # CODE/MESSAGE are ECOS-defined and never contain the key or URL.
        result = data["RESULT"]
        print(f"[{name}] ECOS API error {result.get('CODE')}: {result.get('MESSAGE')}")
        return None

    rows = data.get("StatisticSearch", {}).get("row", [])
    series = [{"period": r.get("TIME"), "value": float(r.get("DATA_VALUE", 0))} for r in rows]
    return series


def main():
    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    out_path = os.path.join(data_dir, "ecos_market.json")

    indicators = []
    for name, cfg in CONFIG.items():
        series = fetch_series(name, cfg)
        if not series:
            continue
        latest = series[-1]
        prev = series[-2] if len(series) > 1 else None
        delta = latest["value"] - prev["value"] if prev else None
        indicators.append({
            "name": name,
            "category": name,
            "unit": cfg["unit"],
            "area": "전국",
            "period_type": "월간" if cfg["cycle"] == "M" else cfg["cycle"],
            "series": series,
            "latest_period": latest["period"],
            "latest_value": latest["value"],
            "delta": delta,
        })

    if not indicators:
        print(f"No ECOS indicators configured/available; leaving {out_path} untouched.")
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
