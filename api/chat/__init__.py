from starlette.requests import Request
from starlette.responses import JSONResponse, StreamingResponse
from toolhouse import Toolhouse, ToolhouseStreamStorage, stream_to_chat_completion
from llms import llm_call, get_model
from helpers import get_app_name, read_config
import dotenv
import json
import traceback

dotenv.load_dotenv()


def format_event(event: str, data: str):
    return f"""data: {data}
event: {event}

"""


async def handle_anthropic_stream(stream, history):
    for chunk in stream.text_stream:
        yield format_event("chunk", chunk)
    response = stream.get_final_message()
    history.append(
        {
            "role": response.role,
            "content": [
                c.model_dump() if hasattr(c, "model_dump") else c
                for c in response.content
            ],
        }
    )
    yield response


def process_anthropic_tool_results(tool_results, history):
    for result in tool_results:
        content = []
        for c in result.get("content", []):
            content.append(c.model_dump() if hasattr(c, "model_dump") else c)
        result["content"] = content
    history.append(result)
    return tool_results


async def handle_default_stream(stream, history):
    response = ToolhouseStreamStorage()
    for chunk in stream:
        response.add(chunk)
        if chunk.choices[0].delta.content is not None:
            yield format_event("chunk", chunk.choices[0].delta.content)

    completion = stream_to_chat_completion(response)
    if completion:
        chat = {
            "role": completion.choices[0].message.role,
        }

        if completion.choices[0].message.content:
            chat["content"] = completion.choices[0].message.content

        if completion.choices[0].message.tool_calls:
            chat["tool_calls"] = [
                t.model_dump() for t in completion.choices[0].message.tool_calls
            ]

        history.append(chat)

    yield response


def process_default_tool_results(tool_results, history):
    history.extend(tool_results)
    return tool_results


def sanitize_history(history, provider):
    if provider == "anthropic":
        return json.dumps(history)

    result = []
    for i in range(len(history)):
        if i == len(history) - 1 or history[i]["role"] != history[i + 1]["role"]:
            result.append(history[i])
    return json.dumps(result)


async def generate_stream(
    messages: list, model: str, bundle: str = "default", email: str | None = None
):
    try:
        current_messages = messages.copy()
        history = messages.copy()
        provider = get_model(model).get("provider")
        th = Toolhouse(provider=provider)
        if email:
            th.set_metadata("id", email)

        tools = th.get_tools(bundle)
        tool_results = []

        while True:
            with llm_call(
                model=model,
                system="Respond directly, do not preface or end your responses with anything.",
                max_tokens=8192,
                messages=current_messages,
                tools=tools,
                stream=True,
            ) as stream:
                response = None
                async for chunk in (
                    handle_anthropic_stream(stream, history)
                    if provider == "anthropic"
                    else handle_default_stream(stream, history)
                ):
                    if isinstance(chunk, str):
                        yield chunk
                    else:
                        response = chunk

                # Run tools on the response
                tool_results = th.run_tools(response)

                # If no more tool results, break the loop
                if not tool_results:
                    break

                if provider == "anthropic":
                    tool_results = process_anthropic_tool_results(tool_results, history)
                else:
                    tool_results = process_default_tool_results(tool_results, history)

                # Update messages for next iteration
                current_messages.extend(tool_results)
        yield format_event("end", sanitize_history(history, provider))
    except Exception as e:
        traceback.print_exc()
        yield str(e)


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
            email=data.get("email"),
        ),
        media_type="text/plain",
    )
