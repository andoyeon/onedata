#!/usr/bin/env python3
"""Fill in the two pieces of 외국인 지표 that KOSIS doesn't cover
(국적별 분포, 국적취득 현황) using a data.go.kr 법무부 dataset.

This is additive: it reads the existing data/immigration_stats.json
(written by fetch_immigration.py) and only overwrites
`nationality_distribution` and `stat_cards.naturalization` if the API
call succeeds. Everything else in the file (KOSIS-sourced fields) is
left untouched.

Security (PROJECT_SPEC.md 섹션 0-1): the service key is read from the
DATA_GO_KR_API_KEY environment variable and is never printed or logged,
neither is the request URL.

⚠️ CONFIG REQUIRED: data.go.kr issues a different REST endpoint per
dataset you apply for (활용신청), so ENDPOINT_URL below must be filled in
from your approved dataset's "Open API 개발가이드" tab (e.g. search
"법무부 국적별 체류외국인현황" or "법무부 국적취득현황" on data.go.kr).
Until ENDPOINT_URL is set, this script skips cleanly and leaves the
existing file untouched.
"""
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

API_KEY = os.environ.get("DATA_GO_KR_API_KEY")

# Fill in after 활용신청 approval — see docstring above.
ENDPOINT_URL = None  # e.g. "https://apis.data.go.kr/1234000/SomeService/getSomeOperation"


def call_api(params, num_rows=100):
    if not API_KEY or not ENDPOINT_URL:
        print("DATA_GO_KR_API_KEY or ENDPOINT_URL not configured — skipping data.go.kr fetch.")
        return None

    query = {
        "serviceKey": API_KEY,
        "pageNo": "1",
        "numOfRows": str(num_rows),
        "type": "json",
        **params,
    }
    url = ENDPOINT_URL + "?" + urllib.parse.urlencode(query)

    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = json.load(resp)
    except urllib.error.URLError:
        print("data.go.kr request failed (network error).")
        return None
    except json.JSONDecodeError:
        print("data.go.kr response was not valid JSON (check ENDPOINT_URL / type=json support).")
        return None

    header = data.get("response", {}).get("header", {})
    if header.get("resultCode") not in (None, "00", "0"):
        # data.go.kr's own result code/message never contain the key or URL.
        print(f"data.go.kr API error {header.get('resultCode')}: {header.get('resultMsg')}")
        return None

    return data.get("response", {}).get("body", {}).get("items")


def fetch_nationality_distribution():
    """TODO: map the dataset's actual field names once ENDPOINT_URL is set."""
    items = call_api({})
    if not items:
        return None
    # Placeholder mapping — adjust field names to match the real dataset response.
    return {
        "period": datetime.now(timezone.utc).strftime("%Y"),
        "unit": "%",
        "categories": [
            {"label": row.get("nat_nm"), "value": float(row.get("ratio", 0))}
            for row in items
            if row.get("nat_nm")
        ],
    }


def fetch_naturalization():
    """TODO: map the dataset's actual field names once ENDPOINT_URL is set."""
    items = call_api({})
    if not items:
        return None
    latest = items[-1]
    return {
        "name": "국적취득 현황",
        "unit": "명",
        "latest_period": latest.get("period"),
        "latest_value": float(latest.get("value", 0)),
    }


def main():
    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    stats_path = os.path.join(data_dir, "immigration_stats.json")

    if not os.path.exists(stats_path):
        print(f"{stats_path} not found — run fetch_immigration.py first.")
        return

    with open(stats_path, encoding="utf-8") as f:
        stats = json.load(f)

    nationality = fetch_nationality_distribution()
    naturalization = fetch_naturalization()

    if nationality is None and naturalization is None:
        print("No data.go.kr data fetched; immigration_stats.json left untouched.")
        return

    if nationality is not None:
        stats["nationality_distribution"] = nationality
    if naturalization is not None:
        stats["stat_cards"]["naturalization"] = naturalization

    with open(stats_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    print("updated immigration_stats.json with data.go.kr fields")


if __name__ == "__main__":
    main()
