from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.status import (
    HTTP_404_NOT_FOUND,
    HTTP_422_UNPROCESSABLE_ENTITY,
    HTTP_500_INTERNAL_SERVER_ERROR,
)
import tomllib


async def get(request: Request):
    referer = request.headers.get("referer")
    name = referer.split("/")[-1]
    try:
        with open(f"./prompts/{name}.toml", "rb") as f:
            out = tomllib.load(f)
            return JSONResponse(out)
    except FileNotFoundError:
        return JSONResponse({"error": "not_found"}, status_code=HTTP_404_NOT_FOUND)
    except tomllib.TOMLDecodeError:
        return JSONResponse(
            {"error": "syntax_error"}, status_code=HTTP_422_UNPROCESSABLE_ENTITY
        )
    except:
        return JSONResponse(
            {"error": "i_dont_know"}, status_code=HTTP_500_INTERNAL_SERVER_ERROR
        )
