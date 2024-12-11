# AdventAI 2024 Use Cases 🎄🎁

This repo contains the AdventAI 2024 use cases built by Toolhouse.

This app uses Python 3.12 and Starlette on the backend, and has no dependencies on the frontend.

**We encourage you to try out all these apps, clone them, and make them yours!**

## Apps

Here are our apps

- Meal planner
  - Requires send_email, memory_fetch, memory_store, current_time
- X Digest
  - Requires send_email, memory_fetch, memory_store, search_X
- News Digest
  - Requires send_email, memory_fetch, memory_store, newswire, image_generation_flux
- Random pet fact
  - Requires send_email, memory_fetch, memory_store

## How to deploy these apps
These apps can deploy on any service that can host Python 3.12. For convenience, we made it easy to deploy on Heroku and Render.


## How to run on your environment

### Prerequisites

- Python 3.12.7
- Poetry

#### Setup

```bash
poetry install
```

#### Run

To run on http://0.0.0.0:8000

```bash
hypercorn main:app --bind 0.0.0.0:8000
```

You can use `watchexec` to monitor changes and reload changes automatically.

```bash
watchexec -r -e py "hypercorn main:app --bind 0.0.0.0:8000" 
```

To reload changes you made to the frontend, simply refresh your browser.

### Development

Because your function calling infrastructure anad code are hosted on Toolhouse, all apps are actually just a collection of prompts and some business logic.

Each app has this:

- **main.py** is the main entry point. It sets up the API routes and serves static content.
- **api** contains the backend endpoints:
  - **api/chat** streams responses to the LLM you choose
  - **api/cron** contains the logic to perform actions every day
  - **api/config** will read the configuration for the app you want and serve it back to the frontend
- **static** contains the frontend
- **prompts** contains the prompts needed by each use casees, as well as the UI configuration


Here is how an app gets loaded:

- Each app will be served at `/app/<your_app_name>`, where `<your_app_name>` must match one of the filenames in the `prompts` folder (for example `/app/random-pet-fact`).
- The frontend will call `/app/config`. The backend will look at the referer header to infer the app name. It will then send the appropriate configuration. For example, if you're calling `/app/random-pet-fact`, `/app/config` will open `prompts/random-pet-fact.toml`, covert it to JSON, and serve it to the frontend.
- The frontend will read the configuration and set itself up.


#### How to build a new use case

Most of the work is already done for you! Simply copy `prompts/_template.toml` and fill in the blanks. You can follow one of the other pre-configured configurations for inspiration.