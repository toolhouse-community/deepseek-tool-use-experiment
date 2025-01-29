import json
import os
import traceback
from openai import OpenAI
from anthropic import Anthropic
from toolhouse import Toolhouse, ToolhouseStreamStorage, stream_to_chat_completion
from helpers.experimental import system_prompt, run_tool, find_tool_use

models = {
    "DeepSeek R1": {
        "provider": "openai",
        "host": "groq",
        "model": "deepseek-r1-distill-llama-70b",
    },
}


def get_model(model: str):
    for label in models.keys():
        entry = models[label]
        if entry.get("model") == model:
            return entry

    return None


class LLMContextManager(object):
    def __init__(self, sdk):
        self.sdk = sdk

    def __enter__(self):
        return self.sdk

    def __exit__(self, *args):
        pass


def select_llm(host, **kwargs):
    if host == "groq":
        return call_groq(**kwargs)
    elif host == "together":
        return call_together(**kwargs)
    elif host == "openai":
        return call_openai(**kwargs)
    elif host == "anthropic":
        return call_anthropic(**kwargs)
    else:
        raise Exception(f"Invalid LLM host: {host}")


def llm_call(**kwargs):
    model = kwargs.get("model")
    provider = get_model(model).get("host")
    if not kwargs.get("stream", False):
        return LLMContextManager(select_llm(provider, **kwargs))
    else:
        return select_llm(provider, **kwargs)


def call_openai(**kwargs):
    client = OpenAI()
    args = kwargs.copy()

    if not next((m["role"] == "system" for m in args["messages"]), None):
        args["messages"] = [{"role": "system", "content": system_prompt}] + args[
            "messages"
        ]

    if args.get("system"):
        args["messages"] = [{"role": "system", "content": args.get("system")}] + args[
            "messages"
        ]
        del args["system"]

    return client.chat.completions.create(**args)


def call_anthropic(**kwargs):
    client = Anthropic()
    args = kwargs.copy()
    args["system"] = system_prompt

    if kwargs.get("tools") is None:
        del args["tools"]

    if kwargs.get("stream"):
        del args["stream"]
        return client.messages.stream(**args)
    else:
        return client.messages.create(**args)


def call_groq(**kwargs):
    args = kwargs.copy()
    client = OpenAI(
        api_key=os.environ.get("GROQCLOUD_API_KEY"),
        base_url="https://api.groq.com/openai/v1",
    )

    args = kwargs.copy()

    if not next((m["role"] == "system" for m in args["messages"]), None):
        args["messages"] = [{"role": "system", "content": args.get("system")}] + args[
            "messages"
        ]

    if args.get("system"):
        args["messages"] = [{"role": "system", "content": args.get("system")}] + args[
            "messages"
        ]
        del args["system"]

    return client.chat.completions.create(**args)


def call_together(**kwargs):
    client = OpenAI(
        api_key=os.environ.get("TOGETHER_API_KEY"),
        base_url="https://api.together.xyz/v1",
    )

    return client.chat.completions.create(**kwargs)


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
        th = Toolhouse(provider="anthropic")

        tools = th.get_tools(bundle)
        tool_results = []

        while True:
            with llm_call(
                model=model,
                system=system_prompt(tools),
                max_tokens=8192,
                messages=current_messages,
                stream=True,
                stop="</tool_use>",
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

                response = stream_to_chat_completion(response)
                tool_results.append(
                    {
                        "role": "assistant",
                        "content": response.choices[0].message.content,
                    }
                )

                if tool_call := find_tool_use(response.choices[0].message.content):
                    print("Using tool:", tool_call.get("tool_name"))
                    tool_response = run_tool(tool_call)
                    tool_results.append(
                        {
                            "role": "user",
                            "content": f"Response from {tool_call.get("tool_name")}: {tool_response.get("content").get("content")}",
                        }
                    )

                if provider == "anthropic":
                    tool_results = process_anthropic_tool_results(tool_results, history)
                else:
                    tool_results = process_default_tool_results(tool_results, history)

                # Update messages for next iteration
                current_messages.extend(tool_results)

                if (
                    len(history) > 0
                    and history[-1].get("role") == "assistant"
                    and response.choices[0].finish_reason == "stop"
                ):
                    yield format_event("end", sanitize_history(history, provider))
                    return
    except Exception as e:
        traceback.print_exc()
        yield str(e)
