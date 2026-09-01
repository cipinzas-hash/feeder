import json
import os

data = {
    "user_code": os.environ["USER_CODE"],
    "verification_url": os.environ["VERIFICATION_URL"],
    "expires_in_seconds": int(os.environ["EXPIRES_IN"]),
}
with open(".simkl-pin-pending.json", "w") as f:
    json.dump(data, f, indent=2)
