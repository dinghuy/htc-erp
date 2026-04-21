import argparse
import json
import math
import re
import sqlite3
import subprocess
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, Optional

import pandas as pd


ACTIVE_SHEET = "10.2024"
INACTIVE_SHEET = "Nghi viec"
DEFAULT_PASSWORD = "Abc@12345"

ROLE_KEYWORDS = {
    "director": {"bgđ", "bod", "chairman", "director", "hđqt", "ban giám đốc"},
    "sales": {"sales", "kinh doanh", "sa l&d", "sales assistant", "sales executive", "sale"},
    "procurement": {"procurement", "mua hàng", "purchasing", "thu mua"},
    "accounting": {"accounting", "finance", "kế toán", "tài chính"},
    "legal": {"legal", "pháp lý", "pháp chế"},
}


@dataclass
class EmployeeRecord:
    employee_code: Optional[str]
    full_name: str
    gender: Optional[str]
    phone: Optional[str]
    role: Optional[str]
    department: Optional[str]
    date_of_birth: Optional[str]
    address: Optional[str]
    start_date: Optional[str]
    status: str
    account_status: str
    username: str
    system_role: str


def clean_text(value: object) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return None
    return text


def choose(*values: object) -> Optional[str]:
    for value in values:
        text = clean_text(value)
        if text:
            return text
    return None


def to_iso_date(value: object) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    text = clean_text(value)
    if not text:
        return None
    parse_orders = (False, True) if len(text) >= 10 and text[:4].isdigit() else (True, False)
    for dayfirst in parse_orders:
        parsed = pd.to_datetime(text, errors="coerce", dayfirst=dayfirst)
        if pd.notna(parsed):
            return parsed.strftime("%Y-%m-%d")
    return None


def normalize_gender(value: object) -> Optional[str]:
    text = (clean_text(value) or "").lower()
    if text in {"nam", "male", "m", "1"}:
        return "Nam"
    if text in {"nữ", "nu", "female", "f"}:
        return "Nữ"
    return None


def looks_like_phone(value: object) -> bool:
    text = clean_text(value)
    if not text:
        return False
    digits_only = "".join(ch for ch in text if ch.isdigit())
    letters = sum(ch.isalpha() for ch in text)
    return 9 <= len(digits_only) <= 11 and digits_only.startswith("0") and letters <= 2


def choose_phone(*values: object) -> Optional[str]:
    for value in values:
        text = clean_text(value)
        if not text:
            continue
        if looks_like_phone(text):
            return text
        matches = re.findall(r"0[\d\s./-]{8,20}", text)
        valid = []
        for match in matches:
            digits = "".join(ch for ch in match if ch.isdigit())
            if 9 <= len(digits) <= 11 and digits.startswith("0"):
                valid.append(match.strip(" /-"))
        if valid:
            return " / ".join(dict.fromkeys(valid))
    return None


def slugify_name(value: str) -> str:
    normalized = value.lower().replace("đ", "d")
    normalized = unicodedata.normalize("NFD", normalized)
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
    parts = [part for part in normalized.split() if part]
    return " ".join(parts)


def build_username(full_name: str) -> str:
    parts = slugify_name(full_name).split()
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0]
    return f"{parts[-1]}.{parts[0]}"


def normalize_role_text(*values: Optional[str]) -> str:
    raw = " ".join(value for value in values if value).strip().lower()
    return raw


def map_system_role(role: Optional[str], department: Optional[str]) -> str:
    haystack = normalize_role_text(role, department)
    if not haystack:
      return "viewer"
    for system_role, keywords in ROLE_KEYWORDS.items():
        if any(keyword in haystack for keyword in keywords):
            return system_role
    return "viewer"


def read_sheet(path: Path, sheet_name: str) -> pd.DataFrame:
    raw = pd.read_excel(path, sheet_name=sheet_name, header=None)
    header_row = raw.iloc[1].tolist()
    body = raw.iloc[2:].copy()
    body.columns = [f"c{i}" for i in range(len(header_row))]
    return body


def read_optional_sheet(path: Path, sheet_name: str) -> Optional[pd.DataFrame]:
    workbook = pd.ExcelFile(path)
    if sheet_name not in workbook.sheet_names:
        return None
    return read_sheet(path, sheet_name)


def classify_status(status_text: Optional[str]) -> tuple[str, str]:
    text = (status_text or "").strip().lower()
    if not text:
        return "Active", "active"
    if "đang làm" in text or "dang lam" in text or text == "active":
        return "Active", "active"
    return "Inactive", "locked"


def build_active_records(df: pd.DataFrame) -> Dict[str, EmployeeRecord]:
    records: Dict[str, EmployeeRecord] = {}
    for _, row in df.iterrows():
        full_name = clean_text(row.get("c4"))
        if not full_name or full_name == "Họ & tên/Full Name":
            continue

        employee_code = clean_text(row.get("c2"))
        role = choose(row.get("c17"), row.get("c18"))
        department = choose(row.get("c19"), row.get("c20"))
        status, account_status = classify_status(clean_text(row.get("c44")))
        record = EmployeeRecord(
            employee_code=employee_code,
            full_name=full_name,
            gender=normalize_gender(row.get("c7")),
            phone=choose_phone(row.get("c28"), row.get("c29")),
            role=role,
            department=department,
            date_of_birth=to_iso_date(row.get("c5")),
            address=choose(row.get("c12"), row.get("c11")),
            start_date=to_iso_date(choose(row.get("c24"), row.get("c23"))),
            status=status,
            account_status=account_status,
            username=build_username(full_name),
            system_role=map_system_role(role, department),
        )
        key = record.employee_code or record.full_name.casefold()
        records[key] = record
    return records


def build_inactive_records(df: Optional[pd.DataFrame], active_records: Dict[str, EmployeeRecord]) -> Dict[str, EmployeeRecord]:
    if df is None:
        return {}

    records: Dict[str, EmployeeRecord] = {}
    active_keys = set(active_records.keys())
    active_names = {record.full_name.casefold() for record in active_records.values()}

    for _, row in df.iterrows():
        full_name = clean_text(row.get("c4")) or clean_text(row.get("c1"))
        if not full_name or full_name == "Họ & tên/Full Name":
            continue

        employee_code = clean_text(row.get("c2"))
        key = employee_code or full_name.casefold()
        if key in active_keys or full_name.casefold() in active_names:
            continue

        role = choose(row.get("c17"), row.get("c16"), row.get("c3"))
        department = choose(row.get("c19"), row.get("c18"), row.get("c4"))
        record = EmployeeRecord(
            employee_code=employee_code,
            full_name=full_name,
            gender=normalize_gender(row.get("c7")),
            phone=choose_phone(row.get("c27"), row.get("c26"), row.get("c28"), row.get("c5")),
            role=role,
            department=department,
            date_of_birth=to_iso_date(row.get("c5") or row.get("c2")),
            address=choose(row.get("c11"), row.get("c10")),
            start_date=to_iso_date(choose(row.get("c23"), row.get("c22"))),
            status="Inactive",
            account_status="locked",
            username=build_username(full_name),
            system_role=map_system_role(role, department),
        )
        records[key] = record

    return records


def find_existing_user(cur: sqlite3.Cursor, record: EmployeeRecord) -> Optional[sqlite3.Row]:
    if record.employee_code:
        row = cur.execute(
            "SELECT * FROM User WHERE employeeCode = ? LIMIT 1",
            (record.employee_code,),
        ).fetchone()
        if row:
            return row

    return cur.execute(
        "SELECT * FROM User WHERE lower(trim(fullName)) = lower(trim(?)) LIMIT 1",
        (record.full_name,),
    ).fetchone()


def find_username_owner(cur: sqlite3.Cursor, username: str) -> Optional[sqlite3.Row]:
    return cur.execute(
        "SELECT id, username, employeeCode, fullName FROM User WHERE lower(trim(username)) = lower(trim(?)) LIMIT 1",
        (username,),
    ).fetchone()


def merged_value(existing: sqlite3.Row, field: str, incoming: Optional[str]) -> Optional[str]:
    if incoming:
        return incoming
    return existing[field]


def hash_default_password(script_path: Path, password: str) -> str:
    backend_root = script_path.parent.parent
    node_script = """
const bcrypt = require(process.argv[1]);
bcrypt.hash(process.argv[2], 10).then((hash) => console.log(hash)).catch((error) => {
  console.error(error);
  process.exit(1);
});
"""
    bcrypt_module = str((backend_root / "node_modules" / "bcryptjs").resolve())
    result = subprocess.run(
        ["node", "-e", node_script, bcrypt_module, password],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def upsert_users(db_path: Path, records: Iterable[EmployeeRecord], dry_run: bool, default_password_hash: str) -> dict:
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    inserted = 0
    updated = 0
    skipped_username_conflicts = 0
    skipped_invalid_rows = 0
    conflicts: list[dict] = []

    for record in records:
        if not record.username:
            skipped_invalid_rows += 1
            conflicts.append({"fullName": record.full_name, "reason": "username_empty"})
            continue

        existing = find_existing_user(cur, record)
        username_owner = find_username_owner(cur, record.username)
        if username_owner and (not existing or str(username_owner["id"]) != str(existing["id"])):
            skipped_username_conflicts += 1
            conflicts.append({
                "fullName": record.full_name,
                "employeeCode": record.employee_code,
                "username": record.username,
                "reason": "username_conflict",
                "ownerFullName": username_owner["fullName"],
                "ownerEmployeeCode": username_owner["employeeCode"],
            })
            continue

        if existing:
            next_username = record.username
            next_system_role = existing["systemRole"] if existing["systemRole"] and existing["systemRole"] != "viewer" else record.system_role
            next_password_hash = existing["passwordHash"] or default_password_hash
            next_must_change = existing["mustChangePassword"] if existing["passwordHash"] else 1
            cur.execute(
                """
                UPDATE User
                SET fullName = ?,
                    gender = ?,
                    phone = ?,
                    role = ?,
                    department = ?,
                    employeeCode = ?,
                    dateOfBirth = ?,
                    address = ?,
                    startDate = ?,
                    status = ?,
                    accountStatus = ?,
                    username = ?,
                    systemRole = ?,
                    passwordHash = ?,
                    mustChangePassword = ?
                WHERE id = ?
                """,
                (
                    record.full_name,
                    merged_value(existing, "gender", record.gender),
                    merged_value(existing, "phone", record.phone),
                    merged_value(existing, "role", record.role),
                    merged_value(existing, "department", record.department),
                    merged_value(existing, "employeeCode", record.employee_code),
                    merged_value(existing, "dateOfBirth", record.date_of_birth),
                    merged_value(existing, "address", record.address),
                    merged_value(existing, "startDate", record.start_date),
                    record.status,
                    record.account_status,
                    next_username,
                    next_system_role,
                    next_password_hash,
                    next_must_change,
                    existing["id"],
                ),
            )
            updated += 1
        else:
            cur.execute(
                """
                INSERT INTO User (
                    id, fullName, gender, email, phone, role, department, status,
                    username, passwordHash, systemRole, employeeCode, dateOfBirth,
                    avatar, address, startDate, accountStatus, mustChangePassword, language
                ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, 'vi')
                """,
                (
                    str(uuid.uuid4()),
                    record.full_name,
                    record.gender,
                    record.phone,
                    record.role,
                    record.department,
                    record.status,
                    record.username,
                    default_password_hash,
                    record.system_role,
                    record.employee_code,
                    record.date_of_birth,
                    record.address,
                    record.start_date,
                    record.account_status,
                ),
            )
            inserted += 1

    if dry_run:
        con.rollback()
    else:
        con.commit()
    con.close()

    return {
        "inserted": inserted,
        "updated": updated,
        "skipped_username_conflicts": skipped_username_conflicts,
        "skipped_invalid_rows": skipped_invalid_rows,
        "conflicts": conflicts[:50],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Import employee data from HTC workbook into crm.db User table.")
    parser.add_argument("--xlsx", required=True, help="Path to source xlsx file")
    parser.add_argument("--db", required=True, help="Path to sqlite database")
    parser.add_argument("--dry-run", action="store_true", help="Parse and simulate without committing changes")
    args = parser.parse_args()

    xlsx_path = Path(args.xlsx)
    db_path = Path(args.db)

    active_df = read_sheet(xlsx_path, ACTIVE_SHEET)
    inactive_df = read_optional_sheet(xlsx_path, INACTIVE_SHEET)

    active_records = build_active_records(active_df)
    inactive_records = build_inactive_records(inactive_df, active_records)
    ordered_records = list(active_records.values()) + list(inactive_records.values())
    default_password_hash = hash_default_password(Path(__file__), DEFAULT_PASSWORD)

    result = upsert_users(db_path, ordered_records, args.dry_run, default_password_hash)
    print(json.dumps({
        "dryRun": args.dry_run,
        "defaultPassword": DEFAULT_PASSWORD,
        "activeRecords": len(active_records),
        "inactiveRecords": len(inactive_records),
        "totalRecords": len(ordered_records),
        **result,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
