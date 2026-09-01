import json
import os
import sys
import time
import urllib.error
import urllib.request

client_id = os.environ["SIMKL_CLIENT_ID"]
user_code = os.environ["SIMKL_USER_CODE"]
interval = int(os.environ.get("SIMKL_INTERVAL", "5"))
expires_in = int(os.environ.get("SIMKL_EXPIRES_IN", "900"))

deadline = time.time() + expires_in - 30  # margen de seguridad
url = f"https://api.simkl.com/oauth/pin/{user_code}?client_id={client_id}"

token = None
while time.time() < deadline:
    time.sleep(interval)
    try:
        with urllib.request.urlopen(url) as resp:
            d = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"poll: HTTP {e.code}")
        continue
    print(f"poll: result={d.get('result')}")
    if d.get("result") == "OK" and d.get("access_token"):
        token = d["access_token"]
        break

if not token:
    print("Se agotó el tiempo de espera sin aprobación -- correr el workflow de nuevo.", file=sys.stderr)
    sys.exit(1)

print(f"::add-mask::{token}")
github_output = os.environ["GITHUB_OUTPUT"]
with open(github_output, "a") as f:
    f.write(f"token={token}\n")
