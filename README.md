# Ollama-on-HF-Space

Run Ollama with a lightweight REST API wrapper on Hugging Face Spaces using Docker. Exposes a simple HTTP interface to interact with local LLMs — list models, pull/delete models, and chat (with optional streaming).

---

## Stack

- **[Ollama](https://ollama.com/)** — local LLM runtime
- **Node.js + Express** — REST API wrapper
- **Docker** — containerized via HF Space

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | No | Health check + available endpoints |
| `GET` | `/models` | No | List all pulled models |
| `GET` | `/models/:name` | No | Get model details |
| `POST` | `/models/pull` | ✅ Yes | Pull a model from Ollama registry |
| `DELETE` | `/models/:name` | ✅ Yes | Delete a model |
| `POST` | `/chat` | No | Chat with a model (stream via `"stream": true`) |

### Chat Request Body

```json
{
  "model": "gemma:2b",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "stream": false,
  "options": {}
}
```

Set `"stream": true` to receive a `text/event-stream` response.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `7860` | Port the Express server listens on |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama service URL |
| `API_KEY` | *(empty)* | Secret key for protected endpoints (pull/delete) |

> ⚠️ If `API_KEY` is not set, pull and delete operations will be **disabled**.

---

## Authentication

Protected endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer your_api_key_here
```

---

## Model Recommendations

> Based on Hugging Face Spaces free tier constraints (~16GB RAM, 2 vCPUs, no GPU).

| Tier | Model | Size | Notes |
|------|-------|------|-------|
| **Basic (Free)** | `tinyllama` | ~600 MB | Default model, very fast, minimal RAM |
| **Basic (Free)** | `phi3:mini` | ~2.3 GB | Good reasoning, low footprint |
| **Basic (Free)** | `gemma:2b` | ~1.4 GB | Lightweight Google model |
| **Basic (Free)** | `qwen2:0.5b` | ~350 MB | Smallest usable model |
| **Upgraded** | `llama3.2:3b` | ~2.0 GB | Meta's latest compact model |
| **Upgraded** | `mistral:7b` | ~4.1 GB | Strong general-purpose model |
| **Upgraded** | `llama3.1:8b` | ~4.7 GB | Good balance of speed & quality |
| **Pro / Persistent** | `llama3.1:70b-q4` | ~40 GB | High quality, needs large disk |

> 💡 On basic free spaces, stick to models **under 2GB** for reliable cold-start performance.

---

## Deploying to Hugging Face Spaces

1. Create a new Space with **Docker** SDK
2. Upload all files (`Dockerfile`, `entrypoint.sh`, `index.js`, `package.json`)
3. Set `API_KEY` in **Settings → Repository secrets**
4. The space will automatically build and pull `gemma:2b` on startup

To change the default pulled model, edit `entrypoint.sh`:

```bash
ollama pull gemma:2b  # replace with your preferred model
```

---

## License

MIT