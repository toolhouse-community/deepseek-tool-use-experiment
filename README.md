# DeepSeek R1 + Toolhouse Function Calling Proof Of Concept

This repo contains a proof-of-concept app that demonstrates how to enable function calling on DeepSeek using [Toolhouse](https://app.toolhouse.ai) as the function calling infrastructure.

**[Sign up for Toolhouse](https://toolhouse.ai) (it's free)**

![groq](https://github.com/user-attachments/assets/1ab7d578-6048-424d-9949-c7af160fdf32)


**Note:** this app is experimental and not intended for production use cases. Its sole purpose is to demonstrate DeepSeek's ability to leverage function calling using common prompt techniques.

This demo uses `deepseek-r1-distill-lama` as provided by [Groq](https://console.groq.com?utm_source=toolhouse).

## How does it work?

We use a common system prompt to instruct DeepSeek that it has tools at its disposal. We list the tools and we give DeepSeek precise instructions on how to call a tool:

```
In this environment you will have access to a set of tools you can use to help answer the user's question.

You can call them like this:
<tool_use>
{
    "function_calls": [
        {
            "tool_name": "$TOOL_NAME",
            "parameters": {"$PARAMETER_NAME": "$PARAMETER_VALUE"},
        }
    ]
}
</tool_use>

Here are the tools available:
{LIST_OF_TOOLHOUSE_TOOLS}

Make sure to call one tool at a time. Make sure to respect the parameter type, ensuring to wrap string values in quotes, and leaving numeric values unwrapped. Feel free to use as many tools as you need.

If you can't find the right tool for your purpose, say "I'm sorry, I don't have the right tools in my toolbelt to answer that question".

The user will give you a response from the tool in a message that begins with "Response from tool:". When you see that string, treat it as the tool response.
```

Because there isn't a specific `tool` role, we instructed the model to treat specific user messages as user tools results.

On each completion call, a function inspects the contents of the `assistant` message and looks for a valid function call. When detected, the function parses the call (including its arguments) and passes it to Toolhouse to run it. Toolhouse runs the tool and returns the result back to the code. From that point, the code gets the response from Toolhouse and formats it as a tool response by prepending `Response from tool:` to the tool response.

## Is that it? I heard DeepSeek R1 is bad at function calling

While our tests confirm DeepSeek R1's function calling is not on par with leading models, Groq's version performs surprisingly well at completing simple tasks. Here are some findings from our early limited testing:

- The model shows reasonable performance in selecting the right tools. 
- The model had a ~84% rate in selecting the expected tool for each task at hand.
- The model tries to avoid selecting tools. In other words, DeepSeek may not select a tool when instead it should select it. We believe this can be mitigated by adding specific prompt directives, but we haven't explored this further.
- The model's thinking step leads it to hallucinate. For example, while using the `current_time` tool, we discovered that the model tricked itself into thinking that it made a tool call, and generated a tool response with a wrong timestamp answer. This happens consistently.
- The model does not exhibit agentic capabilities that allows it to perform multiple-turn tool calls.
- The model generates structured tool calls reliably in the format we specified.
- We have yet to encounter issues like parameter hallucination, which affected leading models and smaller-parameter models.


## How to run on your environment

### Prerequisites

- A Toolhouse API key. You can get a free API key plus 500 free execution every month when you [sign up for Toolhouse](https://app.toolhouse.ai).
- A Groq API Key. You can get a free API key on their [developer console](https://console.groq.com?utm_source=toolhouse).
- Python 3.12
- Poetry

#### Setup

```bash
poetry install
```

#### Run

To run on http://0.0.0.0:8000/app/deepseek

```bash
hypercorn main:app --bind 0.0.0.0:8000
```

You can use `watchexec` to monitor changes and reload changes automatically.

```bash
watchexec -r -e py "hypercorn main:app --bind 0.0.0.0:8000"
```

To reload changes you made to the frontend, simply refresh your browser.

### Development

Because your function calling infrastructure and code are hosted on Toolhouse, all apps are actually just a collection of prompts and some business logic.

Each app has this:

- **main.py** is the main entry point. It sets up the API routes and serves static content.
- **api** contains the backend endpoints:
  - **api/chat** streams responses to the LLM you choose
- **static** contains the frontend
