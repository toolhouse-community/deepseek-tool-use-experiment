from starlette.requests import Request
from starlette.responses import StreamingResponse
from llms import generate_stream
from helpers import read_config
import json
import requests
import os


async def yield_error(text):
    yield text


async def run_prompt(config, model, users):
    total_users = len(users)
    for index, user in enumerate(users):
        try:
            yield f"Processing {user} ({index + 1}/{total_users})…\n"
            async for chunk in generate_stream(
                messages=[
                    {
                        "role": "user",
                        "content": config.get("prompts", {})
                        .get("recurring_action", {})
                        .get("text"),
                    }
                ],
                model=model,
                bundle=config.get("main").get("recurring_action_bundle", "default"),
                email=user,
            ):
                yield chunk

        except Exception as e:
            yield f"user:{user} error: {str(e)}\n"

    # Optional: Signal end of stream
    yield "[STREAM_END]"


async def post(request: Request):
    try:
        body = await request.body()
        data = json.loads(body)
    except json.JSONDecodeError:
        return StreamingResponse(
            yield_error("JSON Decode Error"), media_type="text/plain", status_code=400
        )

    name = data.get("name")
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

    toolhouse_api_key = os.environ.get("TOOLHOUSE_API_KEY")
    if not toolhouse_api_key:
        return StreamingResponse(
            yield_error("TOOLHOUSE_API_KEY is not set in your env variables."),
            media_type="text/plain",
            status_code=500,
        )

    try:
        response = requests.get(
            "https://api.toolhouse.ai/v1/users",
            headers={"Authorization": f"Bearer {toolhouse_api_key}"},
        )
        if not response.ok:
            raise ValueError(f"API error {response.status_code}: {response.text}")
        users = response.json().get("data", [])
    except Exception as e:
        return StreamingResponse(
            yield_error(f"An error occurred while calling the Toolhouse API: {str(e)}"),
            media_type="text/plain",
            status_code=500,
        )

    return StreamingResponse(run_prompt(config, model, users), media_type="text/plain")
