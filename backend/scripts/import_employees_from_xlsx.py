import argparse
import math
import re
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, Optional

import pandas as pd


ACTIVE_SHEET = "10.2024"
INACTIVE_SHEET = "Nghi viec"
DEPARTMENT_HINTS = {
    "marketing",
    "sales",
    "technical",
    "procurement",
    "warehouse",
    "accounting",
    "hr",
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


def clean_text(value: object) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return None
    return text


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


def choose(*values: object) -> Optional[str]:
    for value in values:
        text = clean_text(value)
        if text:
            return text
    return None


def looks_like_phone(value: object) -> bool:
    text = clean_text(value)
    if not text:
        return False
    digits_only = "".join(ch for ch in text if ch.isdigit())
    letters = sum(ch.isalpha() for ch in text)
    return (
        9 <= len(digits_only) <= 11
        and digits_only.startswith("0")
        and letters <= 2
    )


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


def read_sheet(path: Path, sheet_name: str) -> pd.DataFrame:
    raw = pd.read_excel(path, sheet_name=sheet_name, header=None)
    header_row = raw.iloc[1].tolist()
    body = raw.iloc[2:].copy()
    body.columns = [f"c{i}" for i in range(len(header_row))]
    return body


def upsert_record_map(records: Dict[str, EmployeeRecord], record: EmployeeRecord) -> None:
    key = record.employee_code or record.full_name.casefold()
    existing_key = next(
        (item_key for item_key, item in records.items() if item.full_name.casefold() == record.full_name.casefold()),
        None,
    )
    if existing_key:
        existing = records[existing_key]
        if existing.employee_code:
            return
        if record.employee_code:
            del records[existing_key]
            records[key] = record
        return
    records[key] = record


def build_active_records(df: pd.DataFrame) -> Dict[str, EmployeeRecord]:
    records: Dict[str, EmployeeRecord] = {}
    for _, row in df.iterrows():
        full_name = clean_text(row.get("c4"))
        if not full_name or full_name == "Họ & tên/Full Name":
            continue

        employee_code = clean_text(row.get("c2"))
        upsert_record_map(records, EmployeeRecord(
            employee_code=employee_code,
            full_name=full_name,
            gender=normalize_gender(row.get("c7")),
            phone=clean_text(row.get("c28")),
            role=choose(row.get("c17"), row.get("c18")),
            department=choose(row.get("c19"), row.get("c20")),
            date_of_birth=to_iso_date(row.get("c5")),
            address=choose(row.get("c12"), row.get("c11")),
            start_date=to_iso_date(choose(row.get("c24"), row.get("c23"))),
            status="Active",
            account_status="active",
        ))
    return records


def build_inactive_records(df: pd.DataFrame, active_records: Dict[str, EmployeeRecord]) -> Dict[str, EmployeeRecord]:
    records: Dict[str, EmployeeRecord] = {}
    active_keys = set(active_records.keys())
    active_names = {record.full_name.casefold() for record in active_records.values()}

    for _, row in df.iterrows():
        full_name = clean_text(row.get("c4"))
        employee_code = clean_text(row.get("c2"))
        role = choose(row.get("c17"), row.get("c16"))
        department = choose(row.get("c19"), row.get("c18"))
        phone = choose_phone(row.get("c27"), row.get("c26"), row.get("c28"))
        date_of_birth = to_iso_date(row.get("c5"))
        address = choose(row.get("c11"), row.get("c10"))
        start_date = to_iso_date(choose(row.get("c23"), row.get("c22")))

        # The intern section at the end of the sheet uses a compact layout.
        compact_name = clean_text(row.get("c1"))
        compact_role = clean_text(row.get("c3"))
        compact_department = clean_text(row.get("c4"))
        compact_layout = (
            compact_name
            and to_iso_date(row.get("c2"))
            and compact_role
            and compact_department
            and (
                not full_name
                or compact_department.strip().casefold() in DEPARTMENT_HINTS
                or len((full_name or "").split()) <= 1
            )
        )
        if compact_layout:
            full_name = clean_text(row.get("c1"))
            employee_code = None
            role = clean_text(row.get("c3"))
            department = clean_text(row.get("c4"))
            phone = clean_text(row.get("c5"))
            date_of_birth = to_iso_date(row.get("c2"))
            address = None
            start_date = None

        if not full_name or full_name == "Họ & tên/Full Name":
            continue

        key = employee_code or full_name.casefold()
        if key in active_keys or full_name.casefold() in active_names:
            continue

        gender = None
        if clean_text(row.get("c7")):
            gender = "Nam"
        elif clean_text(row.get("c8")):
            gender = "Nữ"

        upsert_record_map(records, EmployeeRecord(
            employee_code=employee_code,
            full_name=full_name,
            gender=gender,
            phone=phone,
            role=role,
            department=department,
            date_of_birth=date_of_birth,
            address=address,
            start_date=start_date,
            status="Inactive",
            account_status="inactive",
        ))
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


def merged_value(existing: sqlite3.Row, field: str, incoming: Optional[str]) -> Optional[str]:
    if incoming:
        return incoming
    return existing[field]


def upsert_users(db_path: Path, records: Iterable[EmployeeRecord], dry_run: bool) -> dict:
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    inserted = 0
    updated = 0

    for record in records:
        existing = find_existing_user(cur, record)
        if existing:
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
                    accountStatus = ?
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
                ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, NULL, NULL, 'viewer', ?, ?, NULL, ?, ?, ?, 1, 'vi')
                """,
                (
                    str(uuid.uuid4()),
                    record.full_name,
                    record.gender,
                    record.phone,
                    record.role,
                    record.department,
                    record.status,
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

    return {"inserted": inserted, "updated": updated}


def main() -> None:
    parser = argparse.ArgumentParser(description="Import employee data from HTC workbook into crm.db User table.")
    parser.add_argument("--xlsx", required=True, help="Path to source xlsx file")
    parser.add_argument("--db", required=True, help="Path to sqlite database")
    parser.add_argument("--dry-run", action="store_true", help="Parse and simulate without committing changes")
    args = parser.parse_args()

    xlsx_path = Path(args.xlsx)
    db_path = Path(args.db)

    active_df = read_sheet(xlsx_path, ACTIVE_SHEET)
    inactive_df = read_sheet(xlsx_path, INACTIVE_SHEET)

    active_records = build_active_records(active_df)
    inactive_records = build_inactive_records(inactive_df, active_records)
    ordered_records = list(active_records.values()) + list(inactive_records.values())

    result = upsert_users(db_path, ordered_records, args.dry_run)
    print(
        {
            "dryRun": args.dry_run,
            "activeRecords": len(active_records),
            "inactiveRecords": len(inactive_records),
            "totalRecords": len(ordered_records),
            **result,
        }
    )


if __name__ == "__main__":
    main()
