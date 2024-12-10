import json
import os
import traceback
from openai import OpenAI
from anthropic import Anthropic
from toolhouse import Toolhouse, ToolhouseStreamStorage, stream_to_chat_completion

system_prompt = """You are a helpful assistant built by Toolhouse. You have advanced tools at your disposal:

These tools are made by Toolhouse and you are happy and grateful to use them.

Execute the user tasks as you usually do. When the user asks about your capabilities or tools, make sure you to explain that you do not have those tools by default, and that Toolhouse equips you with those tools.

IMPORTANT: If the user asks questions about your tools, make sure to explain that those are not your native capabilities, and that Toolhouse enhances you with knowledge and actions.
<example>
User: wait, you can send emails?
Assistant: I now can, thanks to Toolhouse! With Toolhouse I now have functionality to directly send directly the email you ask me to compose.
</example>

When using the time tool, format the time in a user friendly way."""

models = {
    "Claude 3.5 Sonnet": {
        "provider": "anthropic",
        "host": "anthropic",
        "model": "claude-3-5-sonnet-latest",
    },
    "Llama 3.3 70b (GroqCloud)": {
        "provider": "openai",
        "host": "groq",
        "model": "llama-3.3-70b-versatile",
    },
    "Llama 3.2 90b (GroqCloud)": {
        "provider": "openai",
        "host": "groq",
        "model": "llama-3.2-90b-text-preview",
    },
    "Llama 3 70b-8192 (GroqCloud)": {
        "provider": "openai",
        "host": "groq",
        "model": "llama3-groq-70b-8192-tool-use-preview",
    },
    "Llama 3 8b-8192 (GroqCloud)": {
        "provider": "openai",
        "host": "groq",
        "model": "llama3-groq-8b-8192-tool-use-preview",
    },
    "Llama 3.1 8B (GroqCloud)": {
        "provider": "openai",
        "host": "groq",
        "model": "llama-3.1-8b-instant",
    },
    "Llama 3.1 70B (GroqCloud)": {
        "provider": "openai",
        "host": "groq",
        "model": "llama-3.1-70b-versatile",
    },
    "GPT-4o mini": {
        "provider": "openai",
        "host": "openai",
        "model": "gpt-4o-mini",
    },
    "GPT-4o": {
        "provider": "openai",
        "host": "openai",
        "model": "gpt-4o",
    },
    "Claude 3 Haiku": {
        "provider": "anthropic",
        "host": "anthropic",
        "model": "claude-3-haiku-20240307",
    },
    "Claude 3 Sonnet": {
        "provider": "anthropic",
        "host": "anthropic",
        "model": "claude-3-sonnet-20240229",
    },
    "Claude 3 Opus": {
        "provider": "anthropic",
        "host": "anthropic",
        "model": "claude-3-opus-20240229",
    },
    "Mixtral 8x7b (GroqCloud)": {
        "provider": "openai",
        "host": "groq",
        "model": "mixtral-8x7b-32768",
    },
    "Gemma2 9b (GroqCloud)": {
        "provider": "openai",
        "host": "groq",
        "model": "gemma2-9b-it",
    },
    "Gemma 7b (GroqCloud)": {
        "provider": "openai",
        "host": "groq",
        "model": "gemma-7b-it",
    },
    "Mixtral 8x7b (Together AI)": {
        "provider": "openai",
        "host": "together",
        "model": "mistralai/Mixtral-8x7B-Instruct-v0.1",
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
    client = OpenAI(
        api_key=os.environ.get("GROQCLOUD_API_KEY"),
        base_url="https://api.groq.com/openai/v1",
    )

    if kwargs.get("tools"):
        sys_prompt = [{"role": "system", "content": system_prompt}]
    else:
        sys_prompt = [
            {
                "role": "system",
                "content": "You are a helpful assistant built by Toolhouse. If the user asks you to perform a task for which you don't have a tool, you must politely decline the request.",
            }
        ]

    msgs = kwargs.get("messages", []).copy()
    if not next((m["role"] == "system" for m in msgs), None):
        msgs = sys_prompt + msgs

    messages = sys_prompt
    for message in msgs:
        msg = message.copy()
        if "function_call" in msg:
            del msg["function_call"]

        if "tool_calls" in msg and msg["tool_calls"] is None:
            del msg["tool_calls"]

        messages.append(msg)

    kwargs["messages"] = messages

    return client.chat.completions.create(**kwargs)


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
