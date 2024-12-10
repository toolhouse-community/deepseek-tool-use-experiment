from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.status import HTTP_404_NOT_FOUND
from helpers import read_config, get_app_name


async def get(request: Request):
    try:
        name = get_app_name(request)
    except Exception as e:
        print(e)
        return JSONResponse({}, status_code=HTTP_404_NOT_FOUND)

    if config := read_config(f"./prompts/{name}.toml"):
        config["app_name"] = name
        return JSONResponse(config)
    else:
        return JSONResponse({}, status_code=HTTP_404_NOT_FOUND)
