#!/usr/bin/env python3
"""Fetch supplementary indicators from 지표누리 (e-나라지표, index.go.kr) — 시장 지표.

PROJECT_SPEC.md 섹션 1/3-1 lists 지표누리 as a supplementary source for
부처별 핵심 정책지표 (its role for 카드소비 specifically is optional —
scripts/fetch_kosis_financial.py already covers 카드소비 with real KOSIS
data via 신용카드 개인이용금액, so this script is for whatever *additional*
정책지표 you want to add later, not a hard requirement).

The service key is read from the INDEX_API_KEY environment variable, set
via GitHub Actions Secrets in .github/workflows/update-market.yml.

⚠️ CONFIG REQUIRED: unlike KOSIS/ECOS, index.go.kr doesn't expose a
"100대 지표 keyword search" style endpoint we could verify without an
account, so both ENDPOINT_URL and each indicator's IDX_CD (지표 코드) are
placeholders below — fill them in from index.go.kr → 원하는 지표 페이지 →
Open API 탭 (요청 URL + 지표코드가 나옵니다). Until IDX_CD values are set,
this script skips cleanly and writes nothing rather than guessing.

Security (PROJECT_SPEC.md 섹션 0-1): this script never prints or logs the
built URL or the key — only sanitized status/count info.
"""
import json
import os
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

API_KEY = os.environ.get("INDEX_API_KEY")

# Fill in after checking each indicator's Open API tab on index.go.kr.
ENDPOINT_URL = None  # e.g. "https://www.index.go.kr/openapi/openApiTblData.do"

# name -> 지표코드(IDX_CD). Add entries here once you've picked which
# 정책지표 you want to show; leave empty to skip this source entirely.
INDICATORS = {
    # "예시지표명": "1234",
}


def fetch_indicator(name, idx_cd):
    if not API_KEY or not ENDPOINT_URL:
        print("INDEX_API_KEY or ENDPOINT_URL not configured — skipping 지표누리 fetch.")
        return None

    params = {"apiKey": API_KEY, "idxCd": idx_cd, "format": "xml"}
    url = ENDPOINT_URL + "?" + urllib.parse.urlencode(params)

    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            body = resp.read()
    except urllib.error.URLError:
        print(f"[{name}] 지표누리 request failed (network error).")
        return None

    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        print(f"[{name}] 지표누리 response was not valid XML (check ENDPOINT_URL/params).")
        return None

    # TODO: adjust these tag names to match the real response schema.
    series = []
    for row in root.findall(".//row"):
        period = row.findtext("year") or row.findtext("time")
        value = row.findtext("value")
        if period and value:
            try:
                series.append({"period": period, "value": float(value.replace(",", ""))})
            except ValueError:
                continue

    if not series:
        print(f"[{name}] no usable data points parsed from 지표누리 response.")
        return None
    return series


def main():
    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    out_path = os.path.join(data_dir, "index_go_kr.json")

    if not INDICATORS:
        print("No indicators configured in INDICATORS — skipping 지표누리 fetch entirely.")
        return

    indicators = []
    for name, idx_cd in INDICATORS.items():
        series = fetch_indicator(name, idx_cd)
        if not series:
            continue
        latest = series[-1]
        prev = series[-2] if len(series) > 1 else None
        delta = latest["value"] - prev["value"] if prev else None
        indicators.append({
            "name": name,
            "category": "지표누리",
            "area": "전국",
            "series": series,
            "latest_period": latest["period"],
            "latest_value": latest["value"],
            "delta": delta,
        })

    if not indicators:
        print(f"No 지표누리 indicators available; leaving {out_path} untouched.")
        return

    out = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00"),
        "source": "지표누리(e-나라지표)",
        "category": "market-index-go-kr",
        "indicators": indicators,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"wrote {len(indicators)} 지표누리 indicators -> {out_path}")


if __name__ == "__main__":
    main()
