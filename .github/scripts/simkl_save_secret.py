import base64
import json
import os
import urllib.request

from nacl import encoding, public

repo = "cipinzas-hash/feeder"
gh_token = os.environ["GH_TOKEN"]
token_value = os.environ["TOKEN_VALUE"]
secret_name = os.environ.get("SECRET_NAME", "SIMKL_ACCESS_TOKEN")

req = urllib.request.Request(
    f"https://api.github.com/repos/{repo}/actions/secrets/public-key",
    headers={"Authorization": f"Bearer {gh_token}", "Accept": "application/vnd.github+json"},
)
pk = json.loads(urllib.request.urlopen(req).read())

public_key = public.PublicKey(pk["key"].encode("utf-8"), encoding.Base64Encoder())
sealed_box = public.SealedBox(public_key)
encrypted = base64.b64encode(sealed_box.encrypt(token_value.encode("utf-8"))).decode("utf-8")

body = json.dumps({"encrypted_value": encrypted, "key_id": pk["key_id"]}).encode("utf-8")
req2 = urllib.request.Request(
    f"https://api.github.com/repos/{repo}/actions/secrets/{secret_name}",
    data=body,
    method="PUT",
    headers={
        "Authorization": f"Bearer {gh_token}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
    },
)
resp = urllib.request.urlopen(req2)
print(f"{secret_name} guardado, status: {resp.status}")
