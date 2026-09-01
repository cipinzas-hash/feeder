import json
import os
import sys
import urllib.error
import urllib.request

ACCOUNT_ID = os.environ["CLOUDFLARE_ACCOUNT_ID"]
API_TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]
SCRIPT_NAME = "angst-sync"
BASE = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/scripts/{SCRIPT_NAME}"


def req(method, url, headers=None, body=None, content_type=None):
    h = {"Authorization": f"Bearer {API_TOKEN}"}
    if headers:
        h.update(headers)
    if content_type:
        h["Content-Type"] = content_type
    r = urllib.request.Request(url, data=body, method=method, headers=h)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def multipart_upload_worker():
    with open("cloudflare-worker/angst-sync.js", "rb") as f:
        code = f.read()

    boundary = "----angstsyncboundary"
    metadata = json.dumps({
        "main_module": "angst-sync.js",
        "compatibility_date": "2024-09-01",
    })

    parts = []
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(b'Content-Disposition: form-data; name="metadata"\r\n')
    parts.append(b"Content-Type: application/json\r\n\r\n")
    parts.append(metadata.encode() + b"\r\n")

    parts.append(f"--{boundary}\r\n".encode())
    parts.append(b'Content-Disposition: form-data; name="angst-sync.js"; filename="angst-sync.js"\r\n')
    parts.append(b"Content-Type: application/javascript+module\r\n\r\n")
    parts.append(code + b"\r\n")

    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)

    status, data = req("PUT", BASE, body=body, content_type=f"multipart/form-data; boundary={boundary}")
    print("Subir script:", status, json.dumps(data)[:300])
    if not data.get("success"):
        sys.exit(1)


def set_secret(name, value):
    body = json.dumps({"name": name, "text": value, "type": "secret_text"}).encode()
    status, data = req("PUT", f"{BASE}/secrets", body=body, content_type="application/json")
    print(f"Secret {name}:", status, data.get("success"))
    if not data.get("success"):
        print(json.dumps(data))
        sys.exit(1)


def enable_subdomain():
    body = json.dumps({"enabled": True}).encode()
    status, data = req("POST", f"{BASE}/subdomain", body=body, content_type="application/json")
    print("Habilitar subdominio:", status, json.dumps(data)[:300])
    if not data.get("success"):
        sys.exit(1)


def get_subdomain_prefix():
    url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/subdomain"
    status, data = req("GET", url)
    print("Subdominio de cuenta:", status, json.dumps(data)[:300])
    if data.get("success") and data.get("result"):
        return data["result"].get("subdomain")
    return None


if __name__ == "__main__":
    multipart_upload_worker()
    set_secret("GITHUB_PAT", os.environ["WORKER_GITHUB_PAT"])
    set_secret("AUTH_SECRET", os.environ["WORKER_AUTH_SECRET"])
    enable_subdomain()
    prefix = get_subdomain_prefix()
    if prefix:
        worker_url = f"https://{SCRIPT_NAME}.{prefix}.workers.dev"
        print(f"WORKER_URL={worker_url}")
        github_output = os.environ.get("GITHUB_OUTPUT")
        if github_output:
            with open(github_output, "a") as f:
                f.write(f"worker_url={worker_url}\n")
