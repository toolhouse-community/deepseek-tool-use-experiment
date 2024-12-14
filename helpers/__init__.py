from starlette.requests import Request
from urllib.parse import urlparse
import tomllib


def read_config(file: str) -> dict | None:
    try:
        with open(file, "rb") as f:
            return tomllib.load(f)
    except FileNotFoundError as e:
        return None
    except tomllib.TOMLDecodeError as e:
        return None
    except Exception as e:
        return None


def get_app_name(request: Request):
    referer = request.headers.get("referer")
    parsed_url = urlparse(referer)
    path_segments = parsed_url.path.strip("/").split("/")
    return path_segments[-1] if path_segments else None


def format_user_id(appname: str | None, user: str | None) -> str | None:
    if appname and user:
        return f"{appname}-{user}"
    else:
        return None
