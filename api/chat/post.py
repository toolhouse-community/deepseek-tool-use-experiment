from starlette.requests import Request
from starlette.responses import JSONResponse, StreamingResponse
from toolhouse import Toolhouse, ToolhouseStreamStorage, stream_to_chat_completion
from llms import llm_call, get_model
import asyncio
import dotenv
import json
import traceback

dotenv.load_dotenv()

from starlette.requests import Request
from starlette.responses import StreamingResponse
import asyncio


def format_event(event: str, data: str):
    return f"""data: {data}
event: {event}

"""


async def generate_stream(messages: list, model: str, bundle: str = "default"):
    try:
        current_messages = messages.copy()
        history = messages.copy()
        provider = get_model(model).get("provider")
        th = Toolhouse(provider=provider)
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
                if provider == "anthropic":
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
                else:
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
                                t.model_dump()
                                for t in completion.choices[0].message.tool_calls
                            ]

                        history.append(chat)

                # Run tools on the response
                tool_results = th.run_tools(response)

                # If no more tool results, break the loop
                if not tool_results:
                    break

                if provider == "anthropic":
                    for result in tool_results:
                        content = []
                        for c in result.get("content", []):
                            content.append(
                                c.model_dump() if hasattr(c, "model_dump") else c
                            )

                        result["content"] = content
                    history.append(result)
                else:
                    history.extend(tool_results)
                # Update messages for next iteration
                current_messages.extend(tool_results)

        yield format_event("end", json.dumps(history))
    except Exception as e:
        traceback.print_exc()
        yield str(e)


async def json_error():
    yield "JSON Decode Error"


async def post_chat(request: Request):
    # Create a streaming response that sends data as it's generated
    try:
        body = await request.body()
        data = json.loads(body)
    except json.JSONDecodeError:
        return StreamingResponse(json_error(), media_type="text/plain", status_code=400)

    return StreamingResponse(
        generate_stream(
            messages=data.get("messages"),
            model=data.get("model"),
            bundle=data.get("bundle", "default"),
        ),
        media_type="text/plain",
    )
