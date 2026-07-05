#!/usr/bin/env python3
"""Fetch recent disclosures from DART (금융감독원 전자공시) — 시장 지표.

Uses the well-known DART Open API `list.json` endpoint (공시검색). The
service key is read from the DART_API_KEY environment variable, set via
GitHub Actions Secrets in .github/workflows/update-market.yml.

Security (PROJECT_SPEC.md 섹션 0-1): the request URL embeds the key as a
query parameter. This script never prints or logs the URL, the params
dict, or the key itself — only sanitized status/counts.
"""
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

API_KEY = os.environ.get("DART_API_KEY")
BASE_URL = "https://opendart.fss.or.kr/api/list.json"


def fetch_recent_disclosures(days=7, corp_cls="Y", page_count=50):
    """Return a list of recent disclosure dicts, or None if unavailable."""
    if not API_KEY:
        print("DART_API_KEY is not set — skipping DART fetch.")
        return None

    now = datetime.now(timezone.utc)
    params = {
        "crtfc_key": API_KEY,
        "bgn_de": (now - timedelta(days=days)).strftime("%Y%m%d"),
        "end_de": now.strftime("%Y%m%d"),
        "corp_cls": corp_cls,  # Y = 코스피 상장법인
        "page_no": "1",
        "page_count": str(page_count),
    }
    url = BASE_URL + "?" + urllib.parse.urlencode(params)

    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = json.load(resp)
    except urllib.error.URLError:
        print("DART request failed (network error).")
        return None
    except json.JSONDecodeError:
        print("DART response was not valid JSON.")
        return None

    status = data.get("status")
    if status != "000":
        # DART's own status/message never contain the key or URL.
        print(f"DART API returned status {status}: {data.get('message')}")
        return None

    items = []
    for row in data.get("list", []):
        rcept_no = row.get("rcept_no")
        items.append({
            "corp_name": row.get("corp_name"),
            "report_name": row.get("report_nm"),
            "receipt_date": row.get("rcept_dt"),
            "filer": row.get("flr_nm"),
            "link": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}" if rcept_no else None,
        })
    return items


def main():
    items = fetch_recent_disclosures()
    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    out_path = os.path.join(data_dir, "dart_market.json")

    if items is None:
        print(f"No new DART data fetched; leaving {out_path} untouched.")
        return

    out = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00"),
        "source": "DART 전자공시시스템 (금융감독원)",
        "category": "market-disclosures",
        "disclosures": items,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"wrote {len(items)} disclosures -> {out_path}")


if __name__ == "__main__":
    main()
