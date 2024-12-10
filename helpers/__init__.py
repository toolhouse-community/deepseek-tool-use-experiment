from starlette.requests import Request
import tomllib


def read_config(file: str) -> dict | None:
    try:
        with open(file, "rb") as f:
            return tomllib.load(f)
    except FileNotFoundError as e:
        print(f"read_config FileNotFoundError: {str(e)}")
        return None
    except tomllib.TOMLDecodeError as e:
        print(f"read_config TOMLDecodeError: {str(e)}")
        return None
    except Exception as e:
        print(f"read_config Exception: {str(e)}")
        return None


def get_app_name(request: Request):
    referer = request.headers.get("referer")
    return referer.split("/")[-1]
