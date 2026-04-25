const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 7860;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const API_KEY = process.env.API_KEY || '';

app.set('json spaces', 2);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

function checkAuth(req, res, next) {
    if (!API_KEY || API_KEY.trim() === '') {
        return res.status(500).json({
            error: {
                message: 'API_KEY not configured on server',
                type: 'server_error',
            },
        });
    }
    
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({
            error: {
                message: 'Authorization header is required',
                type: 'auth_error',
            },
        });
    }
    
    if (token !== API_KEY) {
        return res.status(403).json({
            error: {
                message: 'Invalid API key',
                type: 'auth_error',
            },
        });
    }
    
    next();
}

function handleError(err, res) {
    if (err.code === 'ECONNREFUSED') {
        return res.status(503).json({
            error: {
                message: 'Ollama service is not running or not accessible',
                type: 'connection_error',
            },
        });
    }
    
    if (err.response) {
        return res.status(err.response.status).json({
            error: {
                message: err.response.data?.error || err.message,
                type: 'ollama_error',
            },
        });
    }
    
    console.error('[Error]', err);
    return res.status(500).json({
        error: {
            message: err.message || 'Internal server error',
            type: 'api_error',
        },
    });
}

function validateChat(req, res) {
    const { model, messages } = req.body;
    
    if (!model || typeof model !== 'string') {
        res.status(400).json({
            error: {
                message: 'model is required and must be a string',
                type: 'invalid_request_error',
            },
        });
        return false;
    }
    
    if (!messages || !Array.isArray(messages)) {
        res.status(400).json({
            error: {
                message: 'messages is required and must be an array',
                type: 'invalid_request_error',
            },
        });
        return false;
    }
    
    return true;
}

app.get('/', async (_req, res) => {
    let ollamaOk = false;
    try {
        await axios.get(`${OLLAMA_BASE_URL}/api/tags`);
        ollamaOk = true;
    } catch {}
    
    res.status(ollamaOk ? 200 : 503).json({
        success: ollamaOk,
        author: 'rynn-k (Randyyyyy)',
        endpoints: {
            list_models: 'GET /models',
            model_info: 'GET /models/:name',
            chat: 'POST /chat',
        },
        timestamp: new Date().toISOString()
    });
});

app.get('/models', async (_req, res) => {
    try {
        const { data } = await axios.get(`${OLLAMA_BASE_URL}/api/tags`);
        const models = data.models?.map(m => ({
            name: m.name,
            size: m.size,
            modified_at: m.modified_at,
            digest: m.digest,
            details: {
                format: m.details?.format,
                family: m.details?.family,
                parameter_size: m.details?.parameter_size,
                quantization_level: m.details?.quantization_level,
            },
        })) || [];
        
        res.json({
            success: true,
            data: {
                models,
                count: models.length,
            },
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        handleError(err, res);
    }
});

app.get('/models/:name', async (req, res) => {
    try {
        const { data } = await axios.post(`${OLLAMA_BASE_URL}/api/show`, { name: req.params.name });
        res.json({
            success: true,
            data: {
                name: req.params.name,
                modelfile: data.modelfile,
                parameters: data.parameters,
                template: data.template,
                details: data.details,
            },
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        handleError(err, res);
    }
});

app.post('/models/pull', checkAuth, async (req, res) => {
    const { name } = req.body;
    
    if (!name || typeof name !== 'string') {
        return res.status(400).json({
            error: {
                message: 'name is required and must be a string',
                type: 'invalid_request_error',
            },
        });
    }
    
    try {
        const { data } = await axios.post(`${OLLAMA_BASE_URL}/api/pull`, {
            name
        }, {
            responseType: 'stream',
            timeout: 0
        });
        
        let lastStatus = {};
        data.on('data', chunk => {
            chunk.toString().split('\n').filter(l => l.trim()).forEach(l => {
                try { lastStatus = JSON.parse(l); } catch {}
            });
        });
        
        data.on('end', () => {
            res.json({
                success: true,
                data: {
                    model: name,
                    status: lastStatus.status || 'completed',
                    digest: lastStatus.digest,
                },
                timestamp: new Date().toISOString()
            });
        });
    } catch (err) {
        handleError(err, res);
    }
});

app.delete('/models/:name', checkAuth, async (req, res) => {
    try {
        await axios.delete(`${OLLAMA_BASE_URL}/api/delete`, { data: { name: req.params.name } });
        res.json({
            success: true,
            data: {
                model: req.params.name,
                status: 'deleted',
            },
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        handleError(err, res);
    }
});

app.post('/chat', async (req, res) => {
    if (!validateChat(req, res)) return;
    const { model, messages, options, stream } = req.body;
    const isStream = stream === true;
    
    try {
        const { data } = await axios.post(`${OLLAMA_BASE_URL}/api/chat`, {
            model,
            messages,
            stream: isStream,
            options: options || {}
        }, isStream ? {
            responseType: 'stream'
        } : {});
        
        if (isStream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            data.pipe(res);
        } else {
            res.json({
                success: true,
                data: {
                    model: data.model,
                    message: data.message,
                    created_at: data.created_at,
                    done: data.done,
                    total_duration: data.total_duration,
                    load_duration: data.load_duration,
                    prompt_eval_count: data.prompt_eval_count,
                    eval_count: data.eval_count,
                },
                timestamp: new Date().toISOString()
            });
        }
    } catch (err) {
        handleError(err, res);
    }
});

app.use((err, _req, res, _next) => {
    console.error('[Error]', err.message);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal server error',
            type: 'api_error',
        },
    });
});

app.use((_req, res) => {
    res.status(404).json({
        error: {
            message: 'Not found',
            type: 'invalid_request_error',
        },
    });
});

async function startServer() {
    let attempts = 0;
    while (attempts < 30) {
        try {
            await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 2000 });
            console.log('[Ollama] Connection successful.');
            break;
        } catch {
            console.log(`[Ollama] Waiting for service... (${++attempts}/30)`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    if (attempts >= 30) console.error('[Ollama] Failed to connect after multiple attempts.');

    if (!API_KEY || API_KEY.trim() === '') {
        console.warn('[Auth] WARNING: API_KEY is not set! Pull and delete operations will be disabled.');
    } else {
        console.log('[Auth] API_KEY is configured.');
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
        console.log(`[Server] Ollama URL: ${OLLAMA_BASE_URL}`);
    });
}

process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down...');
    process.exit(0);
});

startServer();