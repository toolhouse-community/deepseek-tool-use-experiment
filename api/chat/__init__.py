from starlette.requests import Request
from starlette.responses import StreamingResponse
from llms import generate_stream
from helpers import format_user_id, get_app_name, read_config
import dotenv
import json

dotenv.load_dotenv()


async def yield_error(text):
    yield text


async def post(request: Request):
    try:
        body = await request.body()
        data = json.loads(body)
    except json.JSONDecodeError:
        return StreamingResponse(
            yield_error("JSON Decode Error"), media_type="text/plain", status_code=400
        )

    name = get_app_name(request)
    if not (config := read_config(f"./prompts/{name}.toml")):
        return StreamingResponse(
            yield_error("Configuration not found"),
            media_type="text/plain",
            status_code=404,
        )
    model = data.get("model") or config.get("main").get("model")

    if not model:
        return StreamingResponse(
            yield_error("Missing required parameter: model"),
            media_type="text/plain",
            status_code=400,
        )

    return StreamingResponse(
        generate_stream(
            messages=data.get("messages"),
            model=model,
            bundle=data.get("bundle", "default"),
            email=format_user_id(name, data.get("email")),
        ),
        media_type="text/plain",
    )
