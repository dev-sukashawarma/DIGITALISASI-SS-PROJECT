#!/usr/bin/env python3
"""Sinkronkan grant Agents SS ke TELEGRAM_ALLOWED_USERS per profil Hermes."""
import json
import os
import re
import subprocess
import tempfile
import urllib.error
import urllib.request
from pathlib import Path


HOME = Path(os.environ.get("HERMES_HOME", str(Path.home())))
HERMES_DIR = HOME / ".hermes"
ENV_FILE = HERMES_DIR / "telegram-sync.env"
STATE_FILE = HERMES_DIR / "telegram-access-sync-state.json"
API_URL = os.environ.get(
    "HERMES_TELEGRAM_SYNC_URL",
    "https://admin.sukashawarma.com/api/hermes/telegram-access",
)
SECRET = os.environ.get("HERMES_TELEGRAM_SYNC_SECRET", "")


def fail(message):
    raise SystemExit(f"Sinkronisasi Telegram gagal: {message}")


def read_state():
    try:
        value = json.loads(STATE_FILE.read_text())
        return value if isinstance(value, dict) else {}
    except FileNotFoundError:
        return {}
    except (OSError, json.JSONDecodeError):
        fail("file status sinkronisasi tidak bisa dibaca; jangan hapus agar allowlist lama tetap aman")


def parse_allowed(content):
    match = re.search(r"(?m)^TELEGRAM_ALLOWED_USERS=(.*)$", content)
    if not match:
        return set(), False
    value = match.group(1).strip().strip('"').strip("'")
    return {part.strip() for part in value.split(",") if part.strip()}, True


def write_env(path, content, allowed, existed):
    line = "TELEGRAM_ALLOWED_USERS=" + ",".join(sorted(allowed, key=lambda item: (len(item), item)))
    if existed:
        seen = False
        output = []
        for current in content.splitlines():
            if current.startswith("TELEGRAM_ALLOWED_USERS="):
                if not seen:
                    output.append(line)
                    seen = True
            else:
                output.append(current)
        updated = "\n".join(output) + ("\n" if content.endswith("\n") else "")
    else:
        updated = content + ("" if not content or content.endswith("\n") else "\n") + line + "\n"
    if updated == content:
        return False
    fd, temp_name = tempfile.mkstemp(prefix=".telegram-env-", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w") as handle:
            handle.write(updated)
        os.chmod(temp_name, 0o600)
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
    return True


def main():
    if not SECRET:
        fail("HERMES_TELEGRAM_SYNC_SECRET belum disetel")
    request = urllib.request.Request(
        API_URL,
        headers={
            "Authorization": f"Bearer {SECRET}",
            # Cloudflare Browser Integrity Check rejects urllib's default Python-urllib UA.
            "User-Agent": "curl/8.5.0",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        fail("endpoint Agents SS tidak bisa diakses")
    profiles = payload.get("profiles") if isinstance(payload, dict) else None
    if not isinstance(profiles, dict):
        fail("respons endpoint tidak valid; file konfigurasi tidak diubah")
    for slug, raw_ids in profiles.items():
        if re.fullmatch(r"[a-z][a-z0-9_-]{1,39}", slug) and (
            not isinstance(raw_ids, list)
            or any(not isinstance(item, str) or not item.isdigit() for item in raw_ids)
        ):
            fail("daftar Telegram ID tidak valid; file konfigurasi tidak diubah")

    previous = read_state()
    next_state = dict(previous)
    changed = False
    processed = 0
    for slug, raw_ids in profiles.items():
        if not re.fullmatch(r"[a-z][a-z0-9_-]{1,39}", slug):
            continue
        env_path = HERMES_DIR / "profiles" / slug / ".env"
        if not env_path.is_file():
            continue
        content = env_path.read_text()
        if not re.search(r"(?m)^TELEGRAM_BOT_TOKEN=.+$", content):
            continue

        current, exists = parse_allowed(content)
        prior = previous.get(slug, {})
        if isinstance(prior, list):  # Compatible with early state files.
            prior_managed, legacy = set(prior), current - set(prior)
        elif isinstance(prior, dict):
            prior_managed = set(prior.get("managed", []))
            legacy = set(prior.get("legacy", [])) | (current - prior_managed)
        else:
            prior_managed, legacy = set(), current
        # Old IDs and manual additions remain authorized until explicitly migrated.
        desired = set(raw_ids)
        target = legacy | desired
        next_state[slug] = {"legacy": sorted(legacy), "managed": sorted(desired)}
        changed = write_env(env_path, content, target, exists) or changed
        processed += 1

    if next_state != previous:
        STATE_FILE.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        fd, temp_name = tempfile.mkstemp(prefix=".telegram-sync-state-", dir=str(STATE_FILE.parent))
        try:
            with os.fdopen(fd, "w") as handle:
                json.dump(next_state, handle, separators=(",", ":"))
                handle.write("\n")
            os.chmod(temp_name, 0o600)
            os.replace(temp_name, STATE_FILE)
        finally:
            if os.path.exists(temp_name):
                os.unlink(temp_name)
    if changed:
        result = subprocess.run(["systemctl", "--user", "restart", "hermes-gateway"], check=False)
        if result.returncode:
            fail("allowlist berubah tetapi gateway gagal direstart; jalankan systemctl --user restart hermes-gateway")
    print(f"Sinkronisasi selesai; {processed} profil diperiksa" + (", gateway dimuat ulang." if changed else "; tidak ada perubahan."))


if __name__ == "__main__":
    main()
