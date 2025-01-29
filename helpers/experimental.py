import json
import requests
import os


def system_prompt(tools):
    json_sample_call = {
        "function_calls": [
            {
                "tool_name": "$TOOL_NAME",
                "parameters": {"$PARAMETER_NAME": "$PARAMETER_VALUE"},
            }
        ]
    }

    return f"""In this environment you will have access to a set of tools you can use to help answer the user's question.

You can call them like this:
<tool_use>
{json.dumps(json_sample_call)}
</tool_use>

Here are the tools available:
{json.dumps(tools)}

Make sure to call one tool at a time. Make sure to respect the parameter type, ensuring to wrap string values in quotes, and leaving numeric values unwrapped. Feel free to use as many tools as you need.

If you can't find the right tool for your purpose, say "I'm sorry, I don't have the right tools in my toolbelt to answer that question".

The user will give you a response from the tool in a message that begins with "Response from tool:". When you see that string, treat it as the tool response.
"""


def run_tool(tool):
    req = {
        "metadata": {"toolhouse_id": "default", "toolhouse_timezone": 0},
        "provider": "anthropic",
        "content": {
            "id": "deepseek_th_1337",
            "input": tool.get("parameters"),
            "name": tool.get("tool_name"),
            "type": "tool_use",
        },
        "bundle": "default",
    }
    print(json.dumps(req))
    response = requests.post(
        "https://api.toolhouse.ai/v1/run_tools",
        json=req,
        headers={
            "Authorization": f"Bearer {os.environ.get('TOOLHOUSE_API_KEY')}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )

    response.raise_for_status()
    return response.json()


def find_tool_use(response):
    index = response.find("<tool_use>")
    stop = response.find("</tool_use>")
    if index < 0:
        return None

    start = index + len("<tool_use>")
    out = response[start:stop].strip()
    print(out)
    j = json.loads(out)

    if j.get("function_calls"):
        return j.get("function_calls")[0]

    return None
