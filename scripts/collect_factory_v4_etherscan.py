#!/usr/bin/env python3
import argparse
import csv
import json
import os
import pathlib
import time
import urllib.parse
import urllib.request

FACTORY = "0x777777751622c0d3258f214F9DF38E35BF45baF3"
TOPIC0 = (
    "0x2de436107c2096e039c98bbcc3c5a256"
    "0583738ce15c234557eecb4d3221aa81"
)
WALLET = "0x829AdfEdBe565F9885a7eA6Bc78912acAef055E2"
CHAIN_ID = "8453"
API = "https://api.etherscan.io/v2/api"


def pad_topic(addr: str) -> str:
    h = addr.lower().removeprefix("0x")
    if len(h) != 40:
        raise ValueError(f"bad address: {addr}")
    return "0x" + ("0" * 24) + h


def decode_coin(data: str) -> str:
    h = data[2:] if data.startswith("0x") else data
    start = 4 * 64
    word = h[start:start + 64]
    if len(word) != 64:
        raise ValueError("CoinCreatedV4 data too short for data[4]")
    return "0x" + word[-40:].lower()


def norm_int(value):
    if value is None or value == "":
        return None
    text = str(value)
    return int(text, 16) if text.startswith("0x") else int(text)


def fetch_json(params, retries=6):
    url = API + "?" + urllib.parse.urlencode(params)
    last = None

    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "jay-zora-factory-audit/0.2"},
            )
            with urllib.request.urlopen(req, timeout=60) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            last = exc
            if attempt + 1 == retries:
                raise
            time.sleep(min(8.0, 0.75 * (2 ** attempt)))

    raise last


def api_page(api_key, role, page, offset, from_block, to_block):
    params = {
        "chainid": CHAIN_ID,
        "module": "logs",
        "action": "getLogs",
        "address": FACTORY,
        "fromBlock": str(from_block),
        "toBlock": str(to_block),
        "topic0": TOPIC0,
        "page": str(page),
        "offset": str(offset),
        "apikey": api_key,
    }

    if role == "caller":
        params["topic1"] = pad_topic(WALLET)
        params["topic0_1_opr"] = "and"
    elif role == "payout":
        params["topic2"] = pad_topic(WALLET)
        params["topic0_2_opr"] = "and"
    else:
        raise ValueError(role)

    return fetch_json(params)


def receipt_identity(log):
    tx = (log.get("transactionHash") or "").lower()
    log_index = norm_int(log.get("logIndex"))
    if not tx or log_index is None:
        return None
    return tx, log_index


def endpoint_hint(rows):
    if not rows:
        return {
            "first_block": None,
            "first_tx": None,
            "last_block": None,
            "last_tx": None,
        }

    first = rows[0]
    last = rows[-1]
    return {
        "first_block": norm_int(first.get("blockNumber")),
        "first_tx": (first.get("transactionHash") or "").lower() or None,
        "last_block": norm_int(last.get("blockNumber")),
        "last_tx": (last.get("transactionHash") or "").lower() or None,
    }


def classify_result(payload):
    status = str(payload.get("status", ""))
    message = str(payload.get("message", ""))
    result = payload.get("result")

    if isinstance(result, str):
        if "no records found" in result.lower():
            return status, message, "NO_RECORDS", []
        raise RuntimeError(
            f"API error status={status} message={message} result={result}"
        )

    if not isinstance(result, list):
        raise RuntimeError(
            f"unexpected result type {type(result).__name__}"
        )

    if not result:
        return status, message, "EMPTY_LIST", []

    return status, message, "ROWS", result


def write_pagination_receipt(path, receipt):
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(receipt, sort_keys=True) + "\n")


def collect_role(
    api_key,
    role,
    raw_dir,
    pagination_path,
    offset,
    from_block,
    to_block,
    sleep_s,
    max_pages,
):
    out = []
    seen_receipts = set()
    page = 1
    confirm_next = False
    terminal_trigger = None
    confirmed_terminal = False
    terminal_confirm_page = None
    duplicate_rows = 0
    overlap_rows = 0

    while page <= max_pages:
        payload = api_page(
            api_key,
            role,
            page,
            offset,
            from_block,
            to_block,
        )
        raw_path = raw_dir / f"{role}_page_{page:05d}.json"
        raw_path.write_text(
            json.dumps(payload, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )

        status, message, result_kind, rows = classify_result(payload)
        page_ids = [
            identity
            for identity in (receipt_identity(row) for row in rows)
            if identity is not None
        ]
        page_unique = set(page_ids)
        page_duplicates = len(page_ids) - len(page_unique)
        page_overlap = len(page_unique & seen_receipts)
        duplicate_rows += page_duplicates
        overlap_rows += page_overlap

        if confirm_next and rows:
            hint = endpoint_hint(rows)
            receipt = {
                "role": role,
                "page": page,
                "offset": offset,
                "status": status,
                "message": message,
                "result_kind": result_kind,
                "result_count": len(rows),
                "stop_reason": "PREMATURE_STOP_CONFIRMED",
                "first_block": hint["first_block"],
                "first_tx": hint["first_tx"],
                "last_block": hint["last_block"],
                "last_tx": hint["last_tx"],
                "duplicates": page_duplicates,
                "overlap": page_overlap,
                "is_confirm_page": True,
            }
            write_pagination_receipt(pagination_path, receipt)
            raise RuntimeError(
                f"{role} page {page}: rows appeared after "
                f"{terminal_trigger}; previous page was not terminal"
            )

        if confirm_next and not rows:
            hint = endpoint_hint(rows)
            receipt = {
                "role": role,
                "page": page,
                "offset": offset,
                "status": status,
                "message": message,
                "result_kind": result_kind,
                "result_count": 0,
                "stop_reason": "CONFIRMED_TERMINAL",
                "first_block": hint["first_block"],
                "first_tx": hint["first_tx"],
                "last_block": hint["last_block"],
                "last_tx": hint["last_tx"],
                "duplicates": 0,
                "overlap": 0,
                "is_confirm_page": True,
            }
            write_pagination_receipt(pagination_path, receipt)
            confirmed_terminal = True
            terminal_confirm_page = page
            break

        out.extend(rows)
        seen_receipts.update(page_unique)

        if result_kind == "NO_RECORDS":
            stop_reason = "NO_RECORDS"
        elif result_kind == "EMPTY_LIST":
            stop_reason = "EMPTY_LIST"
        elif len(rows) < offset:
            stop_reason = "SHORT_PAGE"
        else:
            stop_reason = None

        hint = endpoint_hint(rows)
        receipt = {
            "role": role,
            "page": page,
            "offset": offset,
            "status": status,
            "message": message,
            "result_kind": result_kind,
            "result_count": len(rows),
            "stop_reason": stop_reason,
            "first_block": hint["first_block"],
            "first_tx": hint["first_tx"],
            "last_block": hint["last_block"],
            "last_tx": hint["last_tx"],
            "duplicates": page_duplicates,
            "overlap": page_overlap,
            "is_confirm_page": False,
        }
        write_pagination_receipt(pagination_path, receipt)

        if stop_reason is not None:
            confirm_next = True
            terminal_trigger = stop_reason

        page += 1
        time.sleep(sleep_s)

    suspect_truncation = not confirmed_terminal
    if suspect_truncation:
        raise RuntimeError(
            f"{role}: max-pages reached without terminal confirmation"
        )

    coverage = {
        "role": role,
        "pages_requested": terminal_confirm_page,
        "data_pages": terminal_confirm_page - 1,
        "terminal_trigger": terminal_trigger,
        "terminal_confirm_page": terminal_confirm_page,
        "confirmed_terminal": confirmed_terminal,
        "suspect_truncation": suspect_truncation,
        "raw_rows": len(out),
        "unique_receipts_with_ids": len(seen_receipts),
        "duplicates_within_pages": duplicate_rows,
        "overlap_across_pages": overlap_rows,
        "offset": offset,
        "max_pages": max_pages,
    }
    return out, coverage


def load_catalog(path: pathlib.Path):
    contracts = set()
    rows = 0

    with path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            rows += 1
            contract = (row.get("contract") or "").strip().lower()
            if contract:
                contracts.add(contract)

    return rows, contracts


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--api-key",
        default=os.environ.get("ETHERSCAN_API_KEY", ""),
    )
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--from-block", default="0")
    parser.add_argument("--to-block", default="999999999")
    parser.add_argument("--offset", type=int, default=1000)
    parser.add_argument("--sleep", type=float, default=0.36)
    parser.add_argument("--max-pages", type=int, default=10000)
    args = parser.parse_args()

    if not args.api_key:
        raise SystemExit("ETHERSCAN_API_KEY is required")
    if args.offset < 1 or args.offset > 1000:
        raise SystemExit("--offset must be 1..1000")
    if args.max_pages < 2:
        raise SystemExit("--max-pages must be >= 2")

    out_dir = pathlib.Path(args.out_dir)
    raw_dir = out_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    pagination_path = out_dir / "pagination_pages.jsonl"
    pagination_path.write_text("", encoding="utf-8")

    caller, caller_coverage = collect_role(
        args.api_key,
        "caller",
        raw_dir,
        pagination_path,
        args.offset,
        args.from_block,
        args.to_block,
        args.sleep,
        args.max_pages,
    )
    payout, payout_coverage = collect_role(
        args.api_key,
        "payout",
        raw_dir,
        pagination_path,
        args.offset,
        args.from_block,
        args.to_block,
        args.sleep,
        args.max_pages,
    )

    pagination = {
        "schema": "JAY_ZORA_FACTORY_V4_PAGINATION_COVERAGE_V0_1",
        "caller": caller_coverage,
        "payout": payout_coverage,
        "both_roles_confirmed_terminal": (
            caller_coverage["confirmed_terminal"]
            and payout_coverage["confirmed_terminal"]
        ),
        "suspect_truncation": (
            caller_coverage["suspect_truncation"]
            or payout_coverage["suspect_truncation"]
        ),
        "coverage_proven": False,
        "coverage_boundary": (
            "Confirmed terminal means the collector observed an empty/no-records "
            "confirmation page after the first short/empty/no-records trigger. "
            "It is stronger than no-exception completion but is not independent "
            "proof that Etherscan indexed every historical Base receipt."
        ),
    }
    (out_dir / "pagination_coverage.json").write_text(
        json.dumps(pagination, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    if not pagination["both_roles_confirmed_terminal"]:
        raise RuntimeError("both caller and payout must confirm terminal")
    if pagination["suspect_truncation"]:
        raise RuntimeError("pagination reports suspect truncation")

    receipts = {}
    for role, rows in (("caller", caller), ("payout", payout)):
        for log in rows:
            tx = (log.get("transactionHash") or "").lower()
            log_index = norm_int(log.get("logIndex"))
            if not tx or log_index is None:
                raise RuntimeError(
                    f"{role}: log missing transactionHash/logIndex"
                )

            key = (tx, log_index)
            rec = receipts.setdefault(
                key,
                {
                    "transaction_hash": tx,
                    "log_index": log_index,
                    "block_number": norm_int(log.get("blockNumber")),
                    "factory_address": (
                        log.get("address") or ""
                    ).lower(),
                    "caller_match": False,
                    "payout_match": False,
                    "coin": None,
                    "topic0": None,
                    "topic1": None,
                    "topic2": None,
                    "topic3": None,
                },
            )
            rec[f"{role}_match"] = True

            topics = log.get("topics") or []
            if len(topics) < 3:
                raise RuntimeError(
                    f"{role}: malformed topics on {tx}:{log_index}"
                )

            rec["topic0"] = (
                topics[0].lower() if len(topics) > 0 else None
            )
            rec["topic1"] = (
                topics[1].lower() if len(topics) > 1 else None
            )
            rec["topic2"] = (
                topics[2].lower() if len(topics) > 2 else None
            )
            rec["topic3"] = (
                topics[3].lower() if len(topics) > 3 else None
            )

            coin = decode_coin(log.get("data") or "0x")
            if rec["coin"] not in (None, coin):
                raise RuntimeError(
                    f"coin decode conflict on {tx}:{log_index}"
                )
            rec["coin"] = coin

    receipt_rows = sorted(
        receipts.values(),
        key=lambda row: (
            row["block_number"] or 0,
            row["log_index"],
            row["transaction_hash"],
        ),
    )
    coins = sorted(
        {row["coin"] for row in receipt_rows if row["coin"]}
    )

    catalog_path = pathlib.Path(args.catalog)
    catalog_rows, catalog = load_catalog(catalog_path)
    match = sorted(set(coins) & catalog)
    delta = sorted(set(coins) - catalog)

    (out_dir / "factory_v4_receipts.jsonl").write_text(
        "".join(
            json.dumps(row, sort_keys=True) + "\n"
            for row in receipt_rows
        ),
        encoding="utf-8",
    )
    (out_dir / "factory_v4_coins.json").write_text(
        json.dumps(coins, indent=2) + "\n",
        encoding="utf-8",
    )
    (out_dir / "v4_match.json").write_text(
        json.dumps(match, indent=2) + "\n",
        encoding="utf-8",
    )
    (out_dir / "v4_delta.json").write_text(
        json.dumps(delta, indent=2) + "\n",
        encoding="utf-8",
    )

    complete = (
        pagination["both_roles_confirmed_terminal"]
        and not pagination["suspect_truncation"]
    )
    summary = {
        "schema": "JAY_ZORA_FACTORY_V4_CONTENT_COMPARE_V0_1",
        "chain_id": 8453,
        "factory": FACTORY.lower(),
        "topic0": TOPIC0,
        "wallet": WALLET.lower(),
        "join_field": "CoinCreatedV4.data[4].coin",
        "word0_as_coin": False,
        "from_block": str(args.from_block),
        "to_block": str(args.to_block),
        "caller_rows_raw": len(caller),
        "payout_rows_raw": len(payout),
        "deduped_receipts": len(receipt_rows),
        "unique_factory_v4_coins": len(coins),
        "catalog_rows": catalog_rows,
        "catalog_unique_contracts": len(catalog),
        "v4_match_count": len(match),
        "v4_delta_count": len(delta),
        "v4_delta_contracts": delta,
        "pagination": pagination,
        "complete": complete,
        "coverage_proven": False,
        "complete_semantics": (
            "No exception reached output and both caller and payout roles "
            "confirmed terminal on an explicit follow-up page."
        ),
        "interpretation_boundary": (
            "V4_DELTA is a factory-set difference only; it is not membership "
            "in the declared 72 without matching createdCoins.count semantics."
        ),
    }
    (out_dir / "summary.json").write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
