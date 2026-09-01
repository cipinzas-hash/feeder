import json
import os
import sys
import urllib.request

client_id = os.environ["SIMKL_CLIENT_ID"]
url = f"https://api.simkl.com/oauth/pin?client_id={client_id}"
with urllib.request.urlopen(url) as resp:
    d = json.loads(resp.read())

if "user_code" not in d:
    print(f"Respuesta inesperada de Simkl: {d}", file=sys.stderr)
    sys.exit(1)

github_output = os.environ["GITHUB_OUTPUT"]
with open(github_output, "a") as f:
    f.write(f"user_code={d['user_code']}\n")
    f.write(f"verification_url={d.get('verification_url', 'https://simkl.com/pin')}\n")
    f.write(f"expires_in={d.get('expires_in', 900)}\n")
    f.write(f"interval={d.get('interval', 5)}\n")

print(json.dumps(d))
